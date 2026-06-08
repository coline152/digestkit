"use client";
import { Suspense } from "react";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { generateSynthesePDF } from "@/lib/generatePDF";

function startOfWeekMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0=dimanche
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatFrenchLongDate(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function moodLabelFromValue(v: number | null | undefined) {
  if (v == null) return null;
  if (v >= 4) return "Bon";
  if (v === 3) return "Passable";
  if (v === 2) return "Bas";
  return "Très bas"; // 1
}

function painLabelFromValue(v: number | null | undefined) {
  if (v == null) return "";
  if (v >= 9) return "Forte";
  if (v >= 6) return "Modérée";
  if (v >= 3) return "Légère";
  return "Aucune";
}

/** Ancien format (dans notes) — on le garde juste pour lire l’historique */
function extractMoodTagIdsFromNotes(notes: string | null | undefined): string[] {
  if (!notes) return [];
  const m = notes.match(/\[mood_tags:([^\]]*)\]/);
  if (!m) return [];
  const raw = m[1].trim();
  if (!raw) return [];
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Nouveau format (dans meta) */
function extractMoodTagIdsFromMeta(meta: any): string[] {
  const arr = meta?.mood_tags;
  if (!Array.isArray(arr)) return [];
  return arr.filter((x: any) => typeof x === "string");
}

function extractMedicationsFromMeta(meta: any): {
  id: string;
  name: string;
  dosage: string;
  time: string;
  quantity: number;
}[] {
  const arr = meta?.medications;
  if (!Array.isArray(arr)) return [];

  return arr
    .flatMap((item: any) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return [];
      }

      const medication = {
        id: typeof item.id === "string" ? item.id : "",
        name: typeof item.name === "string" ? item.name.trim() : "",
        dosage: typeof item.dosage === "string" ? item.dosage.trim() : "",
        time: typeof item.time === "string" ? item.time.trim() : "",
        quantity:
          typeof item.quantity === "number" &&
          Number.isFinite(item.quantity) &&
          item.quantity > 0
            ? Math.floor(item.quantity)
            : 1,
      };

      if (!medication.name && !medication.dosage && !medication.time) {
        return [];
      }

      return [medication];
    });
}

function hasPainUnusual(meta: any): boolean {
  return meta && typeof meta.pain_unusual === "boolean" ? meta.pain_unusual : false;
}

function findEntryByIso(
  entries: { entry_date: string; pain_level: number | null; mood_level: number | null; meta?: any }[],
  iso: string
) {
  return entries.find((entry) => entry.entry_date === iso);
}

function AppHomePageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const dateParam = params.get("date"); // YYYY-MM-DD
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [moodText, setMoodText] = useState<string | null>(null);
  const [moodTagsText, setMoodTagsText] = useState<string>(""); // ex: "Irritation, stress"
  const [symptomsText, setSymptomsText] = useState<string>("");
  const [painText, setPainText] = useState<string>(""); // ex: "Modérée"
  const [painExtraText, setPainExtraText] = useState<string>(""); // ex: "★ inhabituelle"
  const [medicationLines, setMedicationLines] = useState<string[]>([]);
  const [customSections, setCustomSections] = useState<{ id: string; label: string }[]>([]);
  const [customNotesMap, setCustomNotesMap] = useState<Record<string, string>>({});
  const [painZonesText, setPainZonesText] = useState<string>("");
  const [showMenu, setShowMenu] = useState(false);

  const [showSyntheseModal, setShowSyntheseModal] = useState(false);
  const [syntheseNom, setSyntheseNom] = useState("");
  const [synthesePrenom, setSynthesePrenom] = useState("");
  const [syntheseDob, setSyntheseDob] = useState("");
  const [syntheseInfo, setSyntheseInfo] = useState("");
  const [showDownloadBanner, setShowDownloadBanner] = useState(false);

  const [showRappelModal, setShowRappelModal] = useState(false);
  const [rappelHeure, setRappelHeure] = useState("08:00");
  const [rappelConfirme, setRappelConfirme] = useState(false);

  const [showRechercheModal, setShowRechercheModal] = useState(false);
  const [showNewSectionModal, setShowNewSectionModal] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");

const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const [weekEntries, setWeekEntries] = useState<
    { entry_date: string; pain_level: number | null; mood_level: number | null; meta?: any; }[]
  >([]);

    const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });

  const [todayReference] = useState<Date>(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });

  const [calendarExpanded, setCalendarExpanded] = useState(false);

  const isoDate = useMemo(() => toISODate(selectedDate), [selectedDate]);

  const today = useMemo(() => {
  const t = new Date();
  t.setHours(0,0,0,0);
  return t;
}, []);

  useEffect(() => {
    // Si une date est dans l'URL, on la prend
    if (dateParam) {
      const d = new Date(dateParam + "T00:00:00");
      if (!Number.isNaN(d.getTime())) {
        setSelectedDate(d);
      }
    }
  }, [dateParam]);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setUserId(data.session.user.id);
      setChecking(false);
    };
    checkSession();
  }, [router]);

  // ✅ Charge les sections personnalisées (persistantes)
useEffect(() => {
  if (!userId) return;

  const loadCustomSections = async () => {
    const { data, error } = await supabase
      .from("custom_sections")
      .select("id, label, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      setCustomSections([]);
      return;
    }

    setCustomSections(data.map((s) => ({ id: s.id, label: s.label })));
  };

  loadCustomSections();
}, [userId]);

  // ✅ Charge l’info “Moral” (label + tags) en lisant meta d’abord
  useEffect(() => {
    if (!userId) return;

    const loadMood = async () => {
      const { data: entry, error } = await supabase
        .from("daily_entries")
        .select("mood_level, meta, notes")
        .eq("user_id", userId)
        .eq("entry_date", isoDate)
        .maybeSingle();

      if (error || !entry) {
        setMoodText(null);
        setMoodTagsText("");
        return;
      }

      setMoodText(moodLabelFromValue(entry.mood_level));

      const meta = (entry as any).meta as any | null;

      // 1) Nouveau format : meta
      const tagIdsFromMeta = extractMoodTagIdsFromMeta(meta);

      // 2) Ancien format : notes (fallback)
      const tagIds =
        tagIdsFromMeta.length > 0 ? tagIdsFromMeta : extractMoodTagIdsFromNotes(entry.notes);

      if (tagIds.length === 0) {
        setMoodTagsText("");
        return;
      }

      const { data: states, error: statesErr } = await supabase
        .from("mood_states")
        .select("id, label")
        .eq("user_id", userId)
        .in("id", tagIds);

      if (statesErr || !states) {
        setMoodTagsText("");
        return;
      }

      const map = new Map(states.map((s) => [s.id, s.label]));
      const labelsInOrder = tagIds
        .map((id) => map.get(id))
        .filter(Boolean) as string[];

      setMoodTagsText(labelsInOrder.join(", "));
    };

    loadMood();
  }, [userId, isoDate]);

  function readMeta(obj: any): Record<string, any> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
  return {};
}

// ✅ Charge les notes du jour pour les sections personnalisées
useEffect(() => {
  if (!userId) return;

  const loadCustomNotes = async () => {
    const { data, error } = await supabase
      .from("daily_entries")
      .select("meta")
      .eq("user_id", userId)
      .eq("entry_date", isoDate)
      .maybeSingle();

    if (error || !data) {
      setCustomNotesMap({});
      return;
    }

    const meta = readMeta((data as any).meta);
    const notesObj = readMeta(meta.custom_sections_notes);

    // conversion -> Record<string,string>
    const map: Record<string, string> = {};
    for (const key of Object.keys(notesObj)) {
      if (typeof notesObj[key] === "string") map[key] = notesObj[key];
    }

    setCustomNotesMap(map);
  };

  loadCustomNotes();
}, [userId, isoDate]);

    // ✅ Charge l’info “Symptômes” en lisant meta
  useEffect(() => {
    if (!userId) return;

    const loadSymptoms = async () => {
      const { data: entry, error } = await supabase
        .from("daily_entries")
        .select("meta")
        .eq("user_id", userId)
        .eq("entry_date", isoDate)
        .maybeSingle();

      if (error || !entry) {
        setSymptomsText("");
        return;
      }

      const meta = (entry as any).meta as any | null;

      const tagIds = Array.isArray(meta?.symptom_tags)
        ? meta.symptom_tags.filter((x: any) => typeof x === "string")
        : [];

      if (tagIds.length === 0) {
        setSymptomsText("");
        return;
      }

      const { data: states, error: statesErr } = await supabase
        .from("symptom_states")
        .select("id, label")
        .eq("user_id", userId)
        .in("id", tagIds);

      if (statesErr || !states) {
        setSymptomsText("");
        return;
      }

      const map = new Map(states.map((s) => [s.id, s.label]));
      const labelsInOrder = tagIds
        .map((id: string) => map.get(id))
        .filter(Boolean) as string[];

      setSymptomsText(labelsInOrder.join(", "));
    };

    loadSymptoms();
  }, [userId, isoDate]);

  // ✅ Charge l’info “Douleurs” (intensité + inhabituelle) en lisant meta
useEffect(() => {
  if (!userId) return;

  const loadPain = async () => {
    const { data: entry, error } = await supabase
      .from("daily_entries")
      .select("pain_level, meta, notes")
      .eq("user_id", userId)
      .eq("entry_date", isoDate)
      .maybeSingle();

    if (error || !entry) {
      setPainText("");
      setPainExtraText("");
      setPainZonesText("");
      return;
    }

    // Intensité
    setPainText(painLabelFromValue(entry.pain_level));

    // Inhabituelle : nouveau format meta, sinon ancien format notes
    const meta = (entry as any).meta as any | null;

    let unusual = false;
    if (meta && typeof meta.pain_unusual === "boolean") {
      unusual = meta.pain_unusual;
    } else {
      const notes = (entry as any).notes as string | null;
      unusual = (notes ?? "").includes("[pain_unusual]");
    }

    setPainExtraText(unusual ? "★ inhabituelle" : "");

    const spots = Array.isArray(meta?.pain_spots) ? meta.pain_spots : [];
    setPainZonesText(spots.length > 0 ? `${spots.length} zone${spots.length > 1 ? "s" : ""} douloureuse${spots.length > 1 ? "s" : ""}` : "");
  };

  loadPain();
}, [userId, isoDate]);

useEffect(() => {
  if (!userId) return;

  const loadMedications = async () => {
    const { data: entry, error } = await supabase
      .from("daily_entries")
      .select("meta")
      .eq("user_id", userId)
      .eq("entry_date", isoDate)
      .maybeSingle();

    if (error || !entry) {
      setMedicationLines([]);
      return;
    }

    const meta = (entry as any).meta as any | null;
    const medications = extractMedicationsFromMeta(meta);

    if (medications.length === 0) {
      setMedicationLines([]);
      return;
    }

    const lines = medications
      .map((item) => {
        const parts = [item.name, item.dosage, item.time]
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean);

        return parts.join(" • ");
      })
      .filter(Boolean);

    setMedicationLines(lines);
  };

  loadMedications();
}, [userId, isoDate]);

  const selectedWeekStart = useMemo(
  () => startOfWeekMonday(selectedDate),
  [selectedDate]
);

const todayWeekStart = useMemo(
  () => startOfWeekMonday(todayReference),
  [todayReference]
);

const weekDays = useMemo(
  () => Array.from({ length: 7 }, (_, i) => addDays(selectedWeekStart, i)),
  [selectedWeekStart]
);

const expandedWeeks = useMemo(() => {
  const firstWeekStart = addDays(todayWeekStart, -21);

  return Array.from({ length: 4 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) =>
      addDays(firstWeekStart, weekIndex * 7 + dayIndex)
    )
  );
}, [todayWeekStart]);

  useEffect(() => {
    if (checking) return; // on attend d'avoir passé le check session

    const loadWeekEntries = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return;

     const start = calendarExpanded
      ? toISODate(expandedWeeks[0][0])
      : toISODate(selectedWeekStart);

     const end = calendarExpanded
     ? toISODate(expandedWeeks[3][6])
     : toISODate(addDays(selectedWeekStart, 6));

      const { data: entries } = await supabase
        .from("daily_entries")
        .select("entry_date, pain_level, mood_level, meta")
        .eq("user_id", session.user.id)
        .gte("entry_date", start)
        .lte("entry_date", end);

      setWeekEntries(entries ?? []);
    };

    loadWeekEntries();
  }, [checking, selectedWeekStart, calendarExpanded, expandedWeeks]);

const todayIndexInWeek = useMemo(() => {
  return weekDays.findIndex((d) => isSameDay(d, today));
}, [weekDays, today]);

  const dayLetters = ["L", "M", "M", "J", "V", "S", "D"];

  function painDotPx(level: number | null) {
    if (level == null || level === 0) return 0;
    if (level >= 9) return 28; // forte
    if (level >= 6) return 22; // modérée
    if (level >= 3) return 16; // légère
    return 14; // aucune (ou très faible)
  }

  function moodDotPx(level: number | null) {
    if (level == null) return 0;
    if (level === 1) return 30; // très bas
    if (level === 2) return 24; // bas
    if (level === 3) return 18; // passable
    return 14; // bon (=4)
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-[#F6EFE6] p-6">
        <p className="text-sm text-slate-700">Chargement…</p>
      </main>
    );
  }

  return (
    <main
onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
onTouchEnd={(e) => {
  if (touchStartX === null) return;
  const diff = touchStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) < 50) return;
  const newDate = new Date(selectedDate);
  newDate.setDate(selectedDate.getDate() + (diff > 0 ? 1 : -1));
  newDate.setHours(0, 0, 0, 0);
  if (newDate <= today) setSelectedDate(newDate);
  setTouchStartX(null);
}}
>
      {/* Header */}
      <header className="px-6 pt-6 pb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium capitalize tracking-tight">
            {formatFrenchLongDate(selectedDate)}
          </h1>

          <div className="relative">
  <button
    type="button"
    aria-label="Menu"
    className="h-10 w-10 grid place-items-center"
    onClick={() => setShowMenu((v) => !v)}
  >
    <div className="flex flex-col gap-1.5">
      <span className="block h-[3px] w-7 rounded bg-[#13344A]" />
      <span className="block h-[3px] w-7 rounded bg-[#13344A]" />
      <span className="block h-[3px] w-7 rounded bg-[#13344A]" />
    </div>
  </button>

  {showMenu && (
    <>
      {/* Fond transparent pour fermer au clic extérieur */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => setShowMenu(false)}
      />

      {/* Menu déroulant */}
      <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl bg-[#13344A] text-[#F6EFE6] shadow-xl overflow-hidden">
        {[
          { label: "télécharger la synthèse", action: () => setShowSyntheseModal(true) },
          { label: "ajouter un rappel quotidien", action: () => setShowRappelModal(true) },
          { label: "participer à la recherche", action: () => setShowRechercheModal(true) },
          { label: "paramètres", action: () => router.push("/app/settings") },
          { label: "déconnexion", action: async () => {
  await supabase.auth.signOut();
  router.replace("/login");
}},
        ].map(({ label, action }, idx, arr) => (
          <div key={label}>
            <button
              type="button"
              onClick={() => { action(); setShowMenu(false); }}
              className="w-full px-5 py-4 text-left text-sm hover:bg-white/10 transition"
            >
              {label}
            </button>
            {idx < arr.length - 1 && (
              <div className="h-px bg-white/10 mx-5" />
            )}
          </div>
        ))}
      </div>
    </>
  )}
</div>
        </div>
      </header>

      <div className="h-px bg-[#13344A]/25" />

      {/* Week selector */}
      <section className="px-6 pt-5 pb-2">
{calendarExpanded && (
  <div className="pt-2">
    {expandedWeeks.map((week, weekIndex) => (
      <div key={weekIndex} className={weekIndex > 0 ? "mt-5" : ""}>
        <div className="flex items-center justify-between text-lg font-medium tracking-wide">
          {week.map((d, idx) => (
            <div key={idx} className="w-10 text-center">
              {d.getDate()}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          {week.map((d, idx) => {
  const iso = toISODate(d);
  const selected = isSameDay(d, selectedDate);
  const isToday = isSameDay(d, today);
  const entry = findEntryByIso(weekEntries, iso);

  const painPx = painDotPx(entry?.pain_level ?? null);
  const moodPx = moodDotPx(entry?.mood_level ?? null);
  const unusual = hasPainUnusual(entry?.meta);

  return (
    <button
      key={idx}
      type="button"
      onClick={() => {
        setSelectedDate(d);
        setCalendarExpanded(false);
      }}
      className={[
        "relative h-20 w-10 rounded-full flex flex-col overflow-hidden",
       isToday ? "bg-[#E3D7C7]" : "bg-[#EFE6DA]",
  selected ? "ring-2 ring-[#13344A]/50" : "ring-1 ring-[#13344A]/20",
      ].join(" ")}
      aria-label={`Choisir ${formatFrenchLongDate(d)}`}
    >
      <div className="relative flex flex-1 items-center justify-center">
  {(painPx > 0 || entry?.pain_level === 0) && (
    <div
      style={{
        width: painPx > 0 ? painPx : 14,
        height: painPx > 0 ? painPx : 14,
        borderRadius: 9999,
        backgroundColor: entry?.pain_level === 0 ? "#F6EFE6" : "#E5576B",
        border: entry?.pain_level === 0 ? "1px solid #13344A" : "none",
      }}
    />
  )}

  {unusual && (
    <span className="absolute text-[18px] leading-none text-[#52272D]">
      ★
    </span>
  )}
</div>

      <div className="relative flex flex-1 items-center justify-center">
        {moodPx > 0 && (
          <div
            style={{
              width: moodPx,
              height: moodPx,
              borderRadius: 9999,
              backgroundColor: "#F6CA6B",
            }}
          />
        )}
      </div>
    </button>
  );
})}
        </div>
      </div>
    ))}
  </div>
)}
        <div className="relative">
          <div className="absolute left-0 right-0 -top-[21px] flex items-start justify-between pointer-events-none">
  {weekDays.map((d, idx) => (
    <div key={idx} className="w-10 flex justify-center">
     {isSameDay(d, selectedDate) ? (
  <div className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[12px] border-l-transparent border-r-transparent border-t-[#13344A]" />
) : (
  <div className="h-[12px] w-[20px]" />
)}
    </div>
  ))}
</div>

{!calendarExpanded && (
  <>
    <div className="flex items-center justify-between text-lg font-medium tracking-wide">
      {dayLetters.map((letter, idx) => (
        <div key={idx} className="w-10 text-center">
          {letter}
        </div>
      ))}
    </div>

    <div className="mt-4 flex items-center justify-between">
      {weekDays.map((d, idx) => {
  const selected = isSameDay(d, selectedDate);
  const isToday = isSameDay(d, today);
  const iso = toISODate(d);

  const entry = weekEntries.find((e) => e.entry_date === iso);
  const painPx = painDotPx(entry?.pain_level ?? null);
  const moodPx = moodDotPx(entry?.mood_level ?? null);
  const unusual = hasPainUnusual(entry?.meta);

  return (
    <button
      key={idx}
      type="button"
      onClick={() => setSelectedDate(d)}
      className={[
        "relative h-20 w-10 rounded-full flex flex-col overflow-hidden",
        isToday ? "bg-[#E3D7C7]" : "bg-[#EFE6DA]",
  selected ? "ring-2 ring-[#13344A]/50" : "ring-1 ring-[#13344A]/20",
      ].join(" ")}
      aria-label={`Choisir ${formatFrenchLongDate(d)}`}
    >
      <div className="relative flex flex-1 items-center justify-center">
  {(painPx > 0 || entry?.pain_level === 0) && (
    <div
      style={{
        width: painPx > 0 ? painPx : 14,
        height: painPx > 0 ? painPx : 14,
        borderRadius: 9999,
        backgroundColor: entry?.pain_level === 0 ? "#F6EFE6" : "#E5576B",
        border: entry?.pain_level === 0 ? "1px solid #13344A" : "none",
      }}
    />
  )}

  {unusual && (
    <span className="absolute text-[18px] leading-none text-[#52272D]">
      ★
    </span>
  )}
</div>

      <div className="relative flex flex-1 items-center justify-center">
        {moodPx > 0 && (
          <div
            style={{
              width: moodPx,
              height: moodPx,
              borderRadius: 9999,
              backgroundColor: "#F6CA6B",
            }}
          />
        )}
      </div>
    </button>
  );
})}
    </div>
  </>
)}

          <div className="mt-6 flex justify-center">
            <button
            type="button"
            onClick={() => setCalendarExpanded((v) => !v)}
            className="h-1.5 w-20 rounded-full bg-[#13344A]/20">
            </button>
          </div>
        </div>
      </section>

      <div className="h-px bg-[#13344A]/25" />

      {/* Cards stack */}

{/* Cards stack */}
<section className="px-5 py-6 pb-13">
  <div className="rounded-2xl border border-[#13344A]/20 bg-[#F6EFE6] shadow-sm overflow-hidden">
  
          <CardRow
            title="Douleurs"
            color="#E0949F"
            value={painText || "appuyer pour renseigner la carte"}
            subtitle={[painExtraText, painZonesText].filter(Boolean).join(" · ")}
            onClick={() => router.push(`/app/pain?date=${toISODate(selectedDate)}`)}
          />
          <div className="h-px bg-[#13344A]/15" />
          <CardRow
            title="Moral"
            color="#E9D29F"
            value={moodText ?? "appuyer pour renseigner la carte"}
            subtitle={moodTagsText}
            onClick={() => router.push(`/app/mood?date=${toISODate(selectedDate)}`)}
          />
          <div className="h-px bg-[#13344A]/15" />
          <CardRow
            title="Symptômes"
            color="#8FA7B5"
            subtitle={symptomsText || "appuyer pour renseigner la carte"}
            onClick={() => router.push(`/app/symptoms?date=${toISODate(selectedDate)}`)}
          />
          <div className="h-px bg-[#13344A]/15" />
          <CardRow
            title="Médications"
            color="#8FA7B5"
            value={medicationLines.length > 0 ? medicationLines[0] : "appuyer pour renseigner la carte"}
            details={medicationLines.length > 1 ? medicationLines.slice(1) : []}
            onClick={() => router.push(`/app/medications?date=${toISODate(selectedDate)}`)}
          />
          {customSections.length > 0 && (
            <>
              <div className="h-px bg-[#13344A]/15" />
              {customSections.map((s, idx) => {
                const note = customNotesMap[s.id] ?? "";
                const subtitle = note.trim() ? note.trim() : "appuyer pour renseigner la carte";
                return (
                  <div key={s.id}>
                    <CardRow
                      title={s.label}
                      color="#F6CA6B"
                      value={subtitle}
                      onClick={() => router.push(`/app/sections/${s.id}?date=${toISODate(selectedDate)}`)}
                    />
                    {idx !== customSections.length - 1 && <div className="h-px bg-[#13344A]/15" />}
                  </div>
                );
              })}
            </>
          )}
        
      
        </div>
      </section>

      {/* Floating action button */}
      <button
        type="button"
        aria-label="Ajouter"
        onClick={() => setShowNewSectionModal(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full border-2 border-[#13344A] bg-[#F6EFE6] shadow-md grid place-items-center"
      >
        <span className="text-3xl leading-none text-[#13344A]">+</span>
      </button>
      {/* Bandeau notification téléchargement */}
{showDownloadBanner && (
  <div className="fixed top-0 left-0 right-0 z-50 bg-white px-6 py-5 shadow-md">
    <p className="text-sm text-[#13344A]">Un nouveau document a été téléchargé avec succès !</p>
    <button
      type="button"
      onClick={() => setShowDownloadBanner(false)}
      className="mt-1 text-sm italic text-[#13344A] underline underline-offset-2"
    >
      appuyer pour fermer
    </button>
  </div>
)}

{/* Modale télécharger la synthèse */}
{showSyntheseModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-6">
    <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg border border-black/10 relative">
      <button
        type="button"
        onClick={() => setShowSyntheseModal(false)}
        className="absolute right-4 top-4 text-2xl leading-none text-[#13344A]/70"
        aria-label="Fermer"
      >
        ×
      </button>

      <div className="p-6 pt-10 flex flex-col gap-4">
        <p className="text-sm text-[#13344A]">
          Saisissez les informations que vous souhaitez voir apparaître sur votre synthèse.
        </p>
        <p className="text-sm italic text-[#13344A]/70">
          Elles ne seront ni enregistrées ni corrélées à vos données renseignées dans l'application.
        </p>

        <input
          value={syntheseNom}
          onChange={(e) => setSyntheseNom(e.target.value)}
          placeholder="Nom"
          className="w-full rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] px-4 py-3 text-sm outline-none"
        />
        <input
          value={synthesePrenom}
          onChange={(e) => setSynthesePrenom(e.target.value)}
          placeholder="Prénom"
          className="w-full rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] px-4 py-3 text-sm outline-none"
        />
        <input
          value={syntheseDob}
          onChange={(e) => setSyntheseDob(e.target.value)}
          placeholder="Date de naissance"
          className="w-full rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] px-4 py-3 text-sm outline-none"
        />
        <input
          value={syntheseInfo}
          onChange={(e) => setSyntheseInfo(e.target.value)}
          placeholder="Informations complémentaires"
          className="w-full rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] px-4 py-3 text-sm outline-none"
        />

        <button
          type="button"
          onClick={async () => {
  if (!userId) return;

  // 1) Calculer la période : 4 dernières semaines
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fourWeeksAgo = new Date(today);
  fourWeeksAgo.setDate(today.getDate() - 28);

  // 2) Charger les entrées
  const { data: entries } = await supabase
    .from("daily_entries")
    .select("entry_date, pain_level, mood_level, meta")
    .eq("user_id", userId)
    .gte("entry_date", toISODate(fourWeeksAgo))
    .lte("entry_date", toISODate(today))
    .order("entry_date", { ascending: true });

  if (!entries || entries.length === 0) {
    alert("Aucune donnée à exporter.");
    return;
  }

  // 3) Charger mood_states et symptom_states
  const { data: moodStates } = await supabase.from("mood_states").select("id, label").eq("user_id", userId);
  const { data: symptomStates } = await supabase.from("symptom_states").select("id, label").eq("user_id", userId);

  const moodStatesMap = Object.fromEntries((moodStates ?? []).map((s) => [s.id, s.label]));
  const symptomStatesMap = Object.fromEntries((symptomStates ?? []).map((s) => [s.id, s.label]));

  // 4) Générer le PDF
  await generateSynthesePDF({
    nom: syntheseNom,
    prenom: synthesePrenom,
    dob: syntheseDob,
    info: syntheseInfo,
    entries,
    moodStatesMap,
    symptomStatesMap,
    customSections,
  });

  setShowSyntheseModal(false);
  setSyntheseNom("");
  setSynthesePrenom("");
  setSyntheseDob("");
  setSyntheseInfo("");
  setShowDownloadBanner(true);
  setTimeout(() => setShowDownloadBanner(false), 5000);
}}
          className="mt-2 w-full text-center underline text-[#13344A] font-medium"
        >
          Télécharger
        </button>
      </div>
    </div>
  </div>
)}
{/* Modale rappel quotidien */}
{showRappelModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-6">
    <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg border border-black/10 relative">
      <button
        type="button"
        onClick={() => { setShowRappelModal(false); setRappelConfirme(false); }}
        className="absolute right-4 top-4 text-2xl leading-none text-[#13344A]/70"
        aria-label="Fermer"
      >
        ×
      </button>

      <div className="p-6 pt-10 flex flex-col gap-4">
        {rappelConfirme ? (
          <>
            <p className="text-sm text-[#13344A]">
              Rappel enregistré pour <strong>{rappelHeure}</strong> chaque jour.
            </p>
            <p className="text-sm italic text-[#13344A]/70">
              Gardez l'application ouverte dans votre navigateur pour recevoir la notification.
            </p>
            <button
              type="button"
              onClick={() => { setShowRappelModal(false); setRappelConfirme(false); }}
              className="mt-2 w-full text-center underline text-[#13344A] font-medium"
            >
              Fermer
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-[#13344A]">
              À quelle heure souhaitez-vous recevoir votre rappel quotidien ?
            </p>
            <p className="text-sm italic text-[#13344A]/70">
              Vous recevrez chaque jour une notification "Compléter mon DigestKit".
            </p>

            <input
              type="time"
              value={rappelHeure}
              onChange={(e) => setRappelHeure(e.target.value)}
              className="w-full rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] px-4 py-3 text-sm outline-none"
            />

            <button
              type="button"
              onClick={async () => {
                if (!("Notification" in window)) {
                  alert("Les notifications ne sont pas supportées sur ce navigateur.");
                  return;
                }

                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                  alert("Vous avez refusé les notifications. Modifiez les paramètres de votre navigateur pour les activer.");
                  return;
                }

                // Calcul du délai jusqu'à la prochaine occurrence de l'heure choisie
                const [hours, minutes] = rappelHeure.split(":").map(Number);
                const now = new Date();
                const next = new Date();
                next.setHours(hours, minutes, 0, 0);
                if (next <= now) next.setDate(next.getDate() + 1);
                const delay = next.getTime() - now.getTime();

                setTimeout(() => {
                  new Notification("DigestKit", {
                    body: "Compléter mon DigestKit",
                  });
                }, delay);

                setRappelConfirme(true);
              }}
              className="mt-2 w-full text-center underline text-[#13344A] font-medium"
            >
              Enregistrer
            </button>
          </>
        )}
      </div>
    </div>
  </div>
)}
{/* Modale participer à la recherche */}
{showRechercheModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-6">
    <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg border border-black/10 relative">
      <button
        type="button"
        onClick={() => setShowRechercheModal(false)}
        className="absolute right-4 top-4 text-2xl leading-none text-[#13344A]/70"
        aria-label="Fermer"
      >
        ×
      </button>

      <div className="p-6 pt-10 flex flex-col gap-4">
        <p className="text-sm text-[#13344A]">
          Souhaitez-vous participer à la recherche sur les maladies chroniques digestives ?
        </p>
        <p className="text-sm text-[#13344A]">
          Vos données sont précieuses pour comprendre plus en détails ces pathologies, leurs symptomes et leurs corrélations. En acceptant de partager vos données, vous pouvez aider à faire avancer la recherche.
        </p>
        <p className="text-sm text-[#13344A]">
          Les données partagées sont exclusivement utilisées à des fins de recherche. Elles sont anonymisées et traitées de façon strictement confidentielle par les acteurs de la recherche publique.
        </p>

        <div className="mt-2 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              // Action participation à implémenter plus tard
              setShowRechercheModal(false);
            }}
            className="w-full text-left underline text-[#13344A] font-medium text-sm"
          >
            je participe
          </button>
          <button
            type="button"
            onClick={() => setShowRechercheModal(false)}
            className="w-full text-left underline text-[#13344A] font-medium text-sm"
          >
            je ne souhaite pas participer
          </button>
        </div>
      </div>
    </div>
  </div>
)} 

{showNewSectionModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-6">
    <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg border border-black/10 relative">
      <button
        type="button"
        onClick={() => { setShowNewSectionModal(false); setNewSectionTitle(""); }}
        className="absolute right-4 top-4 text-2xl leading-none text-[#13344A]/70"
        aria-label="Fermer"
      >
        ×
      </button>
      <div className="p-6 pt-10 flex flex-col gap-4">
        <p className="text-base font-semibold text-[#13344A]">
          Titre de la nouvelle section
        </p>
        <input
          value={newSectionTitle}
          onChange={(e) => setNewSectionTitle(e.target.value)}
          placeholder="ex: journal alimentaire, menstruations..."
          className="w-full rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] px-4 py-3 text-sm outline-none italic placeholder:text-[#13344A]/40"
        />
        <button
          type="button"
          onClick={async () => {
            if (!newSectionTitle.trim() || !userId) return;
            const { data, error } = await supabase
              .from("custom_sections")
              .insert({ user_id: userId, label: newSectionTitle.trim() })
              .select("id, label")
              .single();
            if (!error && data) {
              setCustomSections((prev) => [...prev, { id: data.id, label: data.label }]);
              setShowNewSectionModal(false);
              setNewSectionTitle("");
              router.push(`/app/sections/${data.id}?date=${toISODate(selectedDate)}`);
            }
          }}
          className="mt-2 w-full text-center underline text-[#13344A] font-medium"
        >
          Créer une nouvelle section
        </button>
      </div>
    </div>
  </div>
)}

    </main>
  );
}


function CardRow({
  title,
  color,
  onClick,
  value,
  subtitle,
  details = [],
}: {
  title: string;
  color: string;
  onClick?: () => void;
  value?: string | null;
  subtitle?: string;
  details?: string[];
}) {
  const commonClass = "relative min-h-[120px] w-full p-6 text-left";

  const content = (
    <>
      <div className="absolute left-0 top-0 h-full w-2" style={{ backgroundColor: color }} />

      <h2 className="text-xl font-semibold text-[#13344A]">{title}</h2>

           {value != null && (
        <p className="mt-3 text-sm font-semibold text-[#13344A]">
          {value}
        </p>
      )}

      {details.length > 0 ? (
        <div className="mt-1 space-y-1">
          {details.map((line, index) => (
            <p key={index} className="text-sm text-[#13344A]/75">
              {line}
            </p>
          ))}
        </div>
      ) : subtitle ? (
        <p className="mt-1 text-sm text-[#13344A]/75">{subtitle}</p>
      ) : (
        <div className="mt-6" />
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={commonClass}>
        {content}
      </button>
    );
  }

  return <div className={commonClass}>{content}</div>;
}


export default function AppHomePage() {
  return (
    <Suspense>
      <AppHomePageInner />
    </Suspense>
  );
}