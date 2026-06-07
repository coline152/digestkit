import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Couleurs
const ROUGE = "#E5576B";
const JAUNE = "#F6CA6B";
const BLEU = "#13344A";
const BEIGE = "#F6EFE6";

// Positions des zones sur la silhouette (en %, par rapport à la taille affichée)
const ZONE_POSITIONS_PCT: { zone: number; leftPct: number; topPct: number }[] = [
  { zone: 1, leftPct: 13, topPct: 42 },
  { zone: 2, leftPct: 62, topPct: 42 },
  { zone: 3, leftPct: 37, topPct: 44 },
  { zone: 4, leftPct: 37, topPct: 62 },
  { zone: 5, leftPct: 62, topPct: 57 },
  { zone: 6, leftPct: 13, topPct: 57 },
  { zone: 7, leftPct: 37, topPct: 18 },
];

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

function painDotPx(level: number | null): number {
  if (level == null || level === 0) return 0;
  if (level >= 9) return 18;
  if (level >= 6) return 14;
  return 10;
}

function moodDotPx(level: number | null): number {
  if (level == null) return 0;
  if (level === 1) return 18;
  if (level === 2) return 14;
  if (level === 3) return 11;
  return 8;
}

export async function generateSynthesePDF(params: {
  nom: string;
  prenom: string;
  dob: string;
  info: string;
  entries: {
    entry_date: string;
    pain_level: number | null;
    mood_level: number | null;
    meta: any;
  }[];
  moodStatesMap: Record<string, string>; // id -> label
  symptomStatesMap: Record<string, string>; // id -> label
  customSections: { id: string; label: string }[];
}) {
  const { nom, prenom, dob, info, entries, moodStatesMap, symptomStatesMap, customSections } = params;

  if (entries.length === 0) return;

  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const firstDate = sorted[0].entry_date;
  const lastDate = sorted[sorted.length - 1].entry_date;
  const periode = `${formatShortDate(firstDate)} — ${formatShortDate(lastDate)}`;

  // --- Calculs agrégés ---

  // Zones douloureuses : nombre d'apparitions par zone
  const zoneCount: Record<number, number> = {};
  for (const e of sorted) {
    const spots = Array.isArray(e.meta?.pain_spots) ? e.meta.pain_spots : [];
    for (const s of spots) {
      if (typeof s.zone === "number") {
        zoneCount[s.zone] = (zoneCount[s.zone] ?? 0) + 1;
      }
    }
  }

  // Moral : occurrences par tag
  const moodTagCount: Record<string, number> = {};
  for (const e of sorted) {
    const tags = Array.isArray(e.meta?.mood_tags) ? e.meta.mood_tags : [];
    for (const id of tags) {
      moodTagCount[id] = (moodTagCount[id] ?? 0) + 1;
    }
  }

  // Symptômes : occurrences par tag
  const symptomTagCount: Record<string, number> = {};
  for (const e of sorted) {
    const tags = Array.isArray(e.meta?.symptom_tags) ? e.meta.symptom_tags : [];
    for (const id of tags) {
      symptomTagCount[id] = (symptomTagCount[id] ?? 0) + 1;
    }
  }

  // Médications : total de prises par médicament
  const medicationCount: Record<string, number> = {};
  for (const e of sorted) {
    const meds = Array.isArray(e.meta?.medications) ? e.meta.medications : [];
    for (const m of meds) {
      if (m?.name) {
        const key = `${m.name}${m.dosage ? " " + m.dosage : ""}`;
        medicationCount[key] = (medicationCount[key] ?? 0) + 1;
      }
    }
  }

  // --- Création du conteneur HTML invisible ---
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 1240px;
    background: white;
    font-family: Georgia, serif;
    color: ${BLEU};
  `;
  document.body.appendChild(container);

  // =====================
  // PAGE 1
  // =====================
  const page1 = document.createElement("div");
  page1.style.cssText = `width: 1240px; min-height: 877px; padding: 60px; box-sizing: border-box; background: white;`;

  // En-tête période
  page1.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 40px;">
      <div style="font-size:22px; font-weight:600; color:${BLEU};">${periode}</div>
      <div style="font-size:13px; color:${BLEU}/70; text-align:right;">
        ${prenom} ${nom}${dob ? ` · ${dob}` : ""}
        ${info ? `<br/><em>${info}</em>` : ""}
      </div>
    </div>
  `;

  // Timeline horizontale
  const timelineDiv = document.createElement("div");
  timelineDiv.style.cssText = `
    display: flex;
    align-items: center;
    gap: 2px;
    margin-bottom: 50px;
    padding: 20px 0;
    border-top: 2px solid ${ROUGE};
    border-bottom: 2px solid ${JAUNE};
    position: relative;
    overflow-x: auto;
  `;

  for (const e of sorted) {
    const painPx = painDotPx(e.pain_level);
    const moodPx = moodDotPx(e.mood_level);
    const unusual = e.meta?.pain_unusual === true;
    const dayNum = new Date(e.entry_date + "T00:00:00").getDate();

    const cell = document.createElement("div");
    cell.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 36px;
      gap: 2px;
    `;
    cell.innerHTML = `
      <div style="font-size:10px; color:${BLEU}; opacity:0.6; margin-bottom:4px;">${dayNum}</div>
      <div style="position:relative; display:flex; align-items:center; justify-content:center; height:22px;">
        ${painPx > 0 ? `<div style="width:${painPx}px; height:${painPx}px; border-radius:50%; background:${ROUGE};"></div>` : `<div style="width:6px; height:6px; border-radius:50%; background:#eee;"></div>`}
        ${unusual ? `<span style="position:absolute; font-size:10px; color:#52272D;">★</span>` : ""}
      </div>
      <div style="display:flex; align-items:center; justify-content:center; height:22px;">
        ${moodPx > 0 ? `<div style="width:${moodPx}px; height:${moodPx}px; border-radius:50%; background:${JAUNE};"></div>` : `<div style="width:6px; height:6px; border-radius:50%; background:#eee;"></div>`}
      </div>
    `;
    timelineDiv.appendChild(cell);
  }
  page1.appendChild(timelineDiv);

  // Tableau 4 colonnes
  const tableau = document.createElement("div");
  tableau.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    border: 1px solid ${BLEU}20;
    border-radius: 12px;
    overflow: hidden;
  `;

  // En-têtes colonnes
  const headers = ["Zones douloureuses", "Moral", "Symptômes récurrents", "Médications"];
  for (const h of headers) {
    const th = document.createElement("div");
    th.style.cssText = `
      padding: 16px 20px 8px;
      font-size: 14px;
      font-weight: 600;
      color: ${BLEU};
      border-bottom: 1px solid ${BLEU}20;
      ${h !== "Médications" ? `border-right: 1px solid ${BLEU}20;` : ""}
    `;
    th.textContent = h;
    if (h === "Zones douloureuses") {
      th.innerHTML = `${h}<br/><span style="font-size:11px; font-weight:400; opacity:0.6;">nombre d'apparitions</span>`;
    }
    tableau.appendChild(th);
  }

  // Colonne 1 : Zones douloureuses (silhouette)
  const col1 = document.createElement("div");
  col1.style.cssText = `padding: 20px; border-right: 1px solid ${BLEU}20; position: relative;`;

  const silhouetteContainer = document.createElement("div");
  silhouetteContainer.style.cssText = `position: relative; width: 180px; margin: 0 auto;`;

  const silhouetteImg = document.createElement("img");
  silhouetteImg.src = "/silhouette_fond_blanc.jpg";
  silhouetteImg.style.cssText = `width: 180px; height: auto; display: block;`;
  silhouetteContainer.appendChild(silhouetteImg);

  // Cercles sur silhouette
  const silhouetteH = 220; // hauteur approximative de l'image affichée
  for (const zp of ZONE_POSITIONS_PCT) {
    const count = zoneCount[zp.zone] ?? 0;
    if (count === 0) continue;
    const dot = document.createElement("div");
    const left = (zp.leftPct / 100) * 180;
    const top = (zp.topPct / 100) * silhouetteH;
    dot.style.cssText = `
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: ${ROUGE};
      left: ${left - 16}px;
      top: ${top - 16}px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: 600;
    `;
    dot.textContent = String(count);
    silhouetteContainer.appendChild(dot);
  }

  col1.appendChild(silhouetteContainer);
  tableau.appendChild(col1);

  // Colonne 2 : Moral (grille de points jaunes par tag)
  const col2 = document.createElement("div");
  col2.style.cssText = `padding: 20px; border-right: 1px solid ${BLEU}20;`;

  for (const [tagId, count] of Object.entries(moodTagCount)) {
    const label = moodStatesMap[tagId] ?? tagId;
    const tagDiv = document.createElement("div");
    tagDiv.style.cssText = `margin-bottom: 14px;`;

    // Points
    const dotsDiv = document.createElement("div");
    dotsDiv.style.cssText = `display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;`;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      dot.style.cssText = `width: 10px; height: 10px; border-radius: 50%; background: ${JAUNE};`;
      dotsDiv.appendChild(dot);
    }

    tagDiv.innerHTML = `<div style="font-size:12px; font-weight:600; margin-bottom:4px;">${count} ${label}</div>`;
    tagDiv.appendChild(dotsDiv);
    col2.appendChild(tagDiv);
  }
  tableau.appendChild(col2);

  // Colonne 3 : Symptômes récurrents
  const col3 = document.createElement("div");
  col3.style.cssText = `padding: 20px; border-right: 1px solid ${BLEU}20;`;

  for (const [tagId, count] of Object.entries(symptomTagCount)) {
    const label = symptomStatesMap[tagId] ?? tagId;
    const tagDiv = document.createElement("div");
    tagDiv.style.cssText = `margin-bottom: 14px;`;

    const dotsDiv = document.createElement("div");
    dotsDiv.style.cssText = `display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;`;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      dot.style.cssText = `width: 10px; height: 10px; border-radius: 50%; background: ${BLEU};`;
      dotsDiv.appendChild(dot);
    }

    tagDiv.innerHTML = `<div style="font-size:12px; font-weight:600; margin-bottom:4px;">${count} ${label}</div>`;
    tagDiv.appendChild(dotsDiv);
    col3.appendChild(tagDiv);
  }
  tableau.appendChild(col3);

  // Colonne 4 : Médications
  const col4 = document.createElement("div");
  col4.style.cssText = `padding: 20px;`;

  for (const [key, count] of Object.entries(medicationCount)) {
    const medDiv = document.createElement("div");
    medDiv.style.cssText = `margin-bottom: 14px;`;

    const dotsDiv = document.createElement("div");
    dotsDiv.style.cssText = `display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;`;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      dot.style.cssText = `width: 10px; height: 10px; border-radius: 50%; background: #C9CED3;`;
      dotsDiv.appendChild(dot);
    }

    medDiv.innerHTML = `<div style="font-size:12px; font-weight:600; margin-bottom:4px;">${count} ${key}</div>`;
    medDiv.appendChild(dotsDiv);
    col4.appendChild(medDiv);
  }
  tableau.appendChild(col4);

  page1.appendChild(tableau);
  container.appendChild(page1);

  // =====================
  // PAGE 2 — Détail semaine
  // =====================
  const page2 = document.createElement("div");
  page2.style.cssText = `width: 1240px; padding: 60px; box-sizing: border-box; background: white; margin-top: 40px;`;

  // Grouper par semaine
  const weeks: typeof sorted[] = [];
  let currentWeek: typeof sorted = [];
  let currentWeekNum = -1;

  for (const e of sorted) {
    const d = new Date(e.entry_date + "T00:00:00");
    const weekNum = Math.floor((d.getTime() - new Date(firstDate + "T00:00:00").getTime()) / (7 * 24 * 3600 * 1000));
    if (weekNum !== currentWeekNum) {
      if (currentWeek.length > 0) weeks.push(currentWeek);
      currentWeek = [];
      currentWeekNum = weekNum;
    }
    currentWeek.push(e);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  for (const week of weeks) {
    const weekTable = document.createElement("div");
    weekTable.style.cssText = `margin-bottom: 40px;`;

    // En-tête du tableau
    const headerRow = document.createElement("div");
    headerRow.style.cssText = `
      display: grid;
      grid-template-columns: 60px 2fr 1fr 1fr 1fr 1fr;
      border-bottom: 2px solid ${BLEU}30;
      padding-bottom: 8px;
      margin-bottom: 4px;
    `;
    ["", "Douleurs", "Moral", "Symptômes", "Médications", "Autres"].forEach((h) => {
      const th = document.createElement("div");
      th.style.cssText = `font-size: 12px; font-weight: 600; color: ${BLEU}; opacity: 0.7;`;
      th.textContent = h;
      headerRow.appendChild(th);
    });
    weekTable.appendChild(headerRow);

    // Lignes jours
    for (const e of week) {
      const d = new Date(e.entry_date + "T00:00:00");
      const dayLetter = ["D", "L", "M", "M", "J", "V", "S"][d.getDay()];
      const dayNum = d.getDate();

      const spots = Array.isArray(e.meta?.pain_spots) ? e.meta.pain_spots : [];
      const painText = spots.map((s: any) => s.text).filter(Boolean).join(" · ");

      const moodTagIds = Array.isArray(e.meta?.mood_tags) ? e.meta.mood_tags : [];
      const moodTagLabels = moodTagIds.map((id: string) => moodStatesMap[id] ?? id).join(", ");
      const moodNote = e.meta?.mood_note ?? "";
      const moodText = [moodTagLabels, moodNote].filter(Boolean).join(" · ");

      const symptomIds = Array.isArray(e.meta?.symptom_tags) ? e.meta.symptom_tags : [];
      const symptomText = symptomIds.map((id: string) => symptomStatesMap[id] ?? id).join(", ");

      const meds = Array.isArray(e.meta?.medications) ? e.meta.medications : [];
      const medText = meds.map((m: any) => `${m.name ?? ""} ${m.dosage ?? ""} ${m.time ?? ""}`.trim()).filter(Boolean).join(" · ");

      const customNotes = e.meta?.custom_sections_notes ?? {};
      const customText = customSections
        .map((s) => customNotes[s.id] ? `${s.label} : ${customNotes[s.id]}` : "")
        .filter(Boolean)
        .join(" · ");

      const row = document.createElement("div");
      row.style.cssText = `
        display: grid;
        grid-template-columns: 60px 2fr 1fr 1fr 1fr 1fr;
        border-bottom: 1px solid ${BLEU}15;
        padding: 12px 0;
        align-items: start;
        min-height: 60px;
      `;

      // Colonne date
      const dateCell = document.createElement("div");
      dateCell.style.cssText = `font-size: 13px; color: ${BLEU};`;
      dateCell.innerHTML = `<span style="opacity:0.5;">${dayLetter}</span><br/><strong>${dayNum}</strong>`;
      row.appendChild(dateCell);

      // Colonne douleur — silhouette miniature + texte
      const painCell = document.createElement("div");
      painCell.style.cssText = `font-size: 11px; color: ${BLEU}; padding-right: 12px;`;

      if (spots.length > 0) {
        const miniSilhouette = document.createElement("div");
        miniSilhouette.style.cssText = `position: relative; width: 60px; margin-bottom: 6px;`;
        const miniImg = document.createElement("img");
        miniImg.src = "/silhouette_fond_blanc.jpg";
        miniImg.style.cssText = `width: 60px; height: auto;`;
        miniSilhouette.appendChild(miniImg);

        const miniH = 73;
        for (const s of spots) {
          const zp = ZONE_POSITIONS_PCT.find((z) => z.zone === s.zone);
          if (!zp) continue;
          const dot = document.createElement("div");
          const left = (zp.leftPct / 100) * 60;
          const top = (zp.topPct / 100) * miniH;
          dot.style.cssText = `
            position: absolute;
            width: 10px; height: 10px;
            border-radius: 50%;
            background: ${ROUGE};
            left: ${left - 5}px;
            top: ${top - 5}px;
          `;
          miniSilhouette.appendChild(dot);
        }
        painCell.appendChild(miniSilhouette);
      }

      if (painText) {
        const painP = document.createElement("p");
        painP.style.cssText = `margin: 0; line-height: 1.5;`;
        painP.textContent = painText;
        painCell.appendChild(painP);
      }
      row.appendChild(painCell);

      // Autres colonnes texte
      for (const text of [moodText, symptomText, medText, customText]) {
        const cell = document.createElement("div");
        cell.style.cssText = `font-size: 11px; color: ${BLEU}; padding-right: 8px; line-height: 1.5;`;
        cell.textContent = text || "—";
        row.appendChild(cell);
      }

      weekTable.appendChild(row);
    }

    page2.appendChild(weekTable);
  }

  container.appendChild(page2);

  // =====================
  // Capture + PDF
  // =====================
  try {
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1240, 877] });

    const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    pdf.addImage(canvas1.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 1240, 877);

    pdf.addPage();
    const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const ratio = canvas2.height / canvas2.width;
    pdf.addImage(canvas2.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 1240, 1240 * ratio);

    pdf.save(`digestkit-synthese.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}