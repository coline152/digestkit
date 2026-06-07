"use client";

import { Suspense } from "react";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

type PainChoice = "none" | "light" | "moderate" | "strong";

const PAIN_OPTIONS: {
  key: PainChoice;
  label: string;
  value: number;
  dotPx: number;
  dotColor: string;
}[] = [
  { key: "none", label: "aucune", value: 0, dotPx: 14, dotColor: "#EDE7DE" },
  { key: "light", label: "légère", value: 3, dotPx: 16, dotColor: "#E5576B" },
  { key: "moderate", label: "modérée", value: 6, dotPx: 22, dotColor: "#E5576B" },
  { key: "strong", label: "forte", value: 9, dotPx: 28, dotColor: "#E5576B" },
];

type PainSpot = {
  zone: number;
  text: string;
};

function formatFrenchLongDate(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readMeta(obj: any): Record<string, any> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
  return {};
}

function readPainUnusual(meta: any, notes?: string | null) {
  if (meta && typeof meta.pain_unusual === "boolean") return meta.pain_unusual;
  return (notes ?? "").includes("[pain_unusual]");
}

function readPainSpots(meta: any): PainSpot[] {
  const arr = meta?.pain_spots;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x: any) => ({
      zone: typeof x?.zone === "number" ? x.zone : null,
      text: typeof x?.text === "string" ? x.text : "",
    }))
    .filter((x: any) => x.zone != null && x.zone >= 1 && x.zone <= 6);
}

function PainPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const dateParam = params.get("date");
  const selectedDate = useMemo(() => {
    if (!dateParam) {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      return t;
    }
    return new Date(dateParam + "T00:00:00");
  }, [dateParam]);

  const isoDate = useMemo(() => toISODate(selectedDate), [selectedDate]);

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [choice, setChoice] = useState<PainChoice | null>(null);
  const [unusual, setUnusual] = useState(false);

  const [spots, setSpots] = useState<PainSpot[]>([]);
  const [activeZone, setActiveZone] = useState<number | null>(null);
  const [activeText, setActiveText] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserId(session.user.id);
      setChecking(false);
    };
    init();
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("daily_entries")
        .select("pain_level, meta, notes")
        .eq("user_id", userId)
        .eq("entry_date", isoDate)
        .maybeSingle();

      if (error || !data) return;

      if (data.pain_level != null) {
        const closest = PAIN_OPTIONS.reduce((prev, cur) => {
          return Math.abs(cur.value - data.pain_level!) <
            Math.abs(prev.value - data.pain_level!)
            ? cur
            : prev;
        });
        setChoice(closest.key);
      } else {
        setChoice(null);
      }

      const meta = (data as any).meta as any | null;
      const notes = (data as any).notes as string | null;

      setUnusual(readPainUnusual(meta, notes));

      const loadedSpots = readPainSpots(meta);
      setSpots(loadedSpots);

      if (loadedSpots.length > 0) {
        setActiveZone(loadedSpots[0].zone);
        setActiveText(loadedSpots[0].text);
      } else {
        setActiveZone(null);
        setActiveText("");
      }
    };

    load();
  }, [userId, isoDate]);

  useEffect(() => {
    if (choice === "none") {
      setActiveZone(null);
      setActiveText("");
      setSpots([]);
    }
  }, [choice]);

  const selectZone = (zone: number) => {
    setError(null);
    commitActiveZone();
    const existing = spots.find((s) => s.zone === zone);
    setActiveZone(zone);
    setActiveText(existing?.text ?? "");
  };

  const saveActiveZoneText = () => {
    if (!activeZone) return;
    setSpots((prev) => {
      const idx = prev.findIndex((s) => s.zone === activeZone);
      const cleaned = activeText.trim();
      if (!cleaned) return prev.filter((s) => s.zone !== activeZone);
      if (idx === -1) return [...prev, { zone: activeZone, text: cleaned }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], text: cleaned };
      return copy;
    });
  };

  const commitActiveZone = () => {
    if (!activeZone) return;
    const cleaned = activeText.trim();
    setSpots((prev) => {
      const idx = prev.findIndex((s) => s.zone === activeZone);
      if (!cleaned) return prev.filter((s) => s.zone !== activeZone);
      if (idx === -1) return [...prev, { zone: activeZone, text: cleaned }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], text: cleaned };
      return copy;
    });
  };

  const deleteActiveZone = () => {
    if (!activeZone) return;
    setSpots((prev) => prev.filter((s) => s.zone !== activeZone));
    setActiveText("");
    setActiveZone(null);
  };

  const handleSave = async () => {
    if (!userId) return;
    commitActiveZone();
    if (!choice) {
      setError("Choisissez une intensité.");
      return;
    }

    if (choice !== "none") {
      if (activeZone) saveActiveZoneText();
      if (spots.length === 0) {
        setError("Choisissez une zone et écrivez une description (même courte).");
        return;
      }
    }

    setSaving(true);
    setError(null);

    const selected = PAIN_OPTIONS.find((o) => o.key === choice)!;

    const { data: existing, error: fetchErr } = await supabase
      .from("daily_entries")
      .select("meta")
      .eq("user_id", userId)
      .eq("entry_date", isoDate)
      .maybeSingle();

    if (fetchErr) {
      setError(fetchErr.message);
      setSaving(false);
      return;
    }

    const existingMeta = readMeta((existing as any)?.meta);

    const nextMeta = {
      ...existingMeta,
      pain_unusual: unusual,
      pain_spots: choice === "none" ? [] : spots,
    };

    const { error } = await supabase.from("daily_entries").upsert(
      {
        user_id: userId,
        entry_date: isoDate,
        pain_level: selected.value,
        meta: nextMeta,
      },
      { onConflict: "user_id,entry_date" }
    );

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push(`/app?date=${isoDate}`);
  };

  if (checking) {
    return (
      <main className="min-h-screen bg-[#F6EFE6] p-6">
        <p className="text-sm text-slate-700">Chargement…</p>
      </main>
    );
  }

  const showDetails = choice != null && choice !== "none";

  return (
    <main className="min-h-screen bg-[#F6EFE6] text-[#13344A]">
      {/* Header */}
      <header className="px-6 pt-6 pb-4">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push(`/app?date=${isoDate}`)}
            className="w-fit text-sm underline underline-offset-2"
          >
            ← Retour
          </button>
          <h1 className="text-xl font-medium capitalize">
            {formatFrenchLongDate(selectedDate)}
          </h1>
        </div>
      </header>

      <section className="px-5 pb-10">
        {/* --- RECTANGLE CORRIGÉ --- */}
        <div className="relative rounded-[15px] bg-[#F6EFE6] shadow-sm overflow-hidden">
          {/* Ligne rose */}
          <div className="absolute left-[2px] top-[4px] bottom-[4px] w-2.5 bg-[#E0949F]" />

          {/* Container interne : bordure intérieure beige et contour gris clair */}
          <div
            className="relative rounded-[15px] border border-[#D9D9D9] shadow-sm overflow-hidden"
            style={{ boxShadow: "inset 0 0 0 4px #F6EFE6" }}
          >
            <div className="relative p-7 min-h-[70vh]">
              {/* --- RESTE DU CONTENU (inchangé) --- */}
              <h2 className="text-2xl font-semibold">Douleurs</h2>
              <p className="mt-6 text-sm leading-relaxed text-[#13344A]">
                Quelle a été l’intensité globale de vos douleurs du jour?
              </p>

              {/* Choix intensité */}
              {/* Rangée des cercles */}
<div className="mt-8 flex items-center justify-between gap-4">
  {PAIN_OPTIONS.map((o) => {
    const selected = choice === o.key;
    return (
      <button
        key={o.key}
        type="button"
        onClick={() => setChoice(o.key)}
        className="flex items-center justify-center w-16"
        aria-pressed={selected}
      >
        <span
          className={`rounded-full border ${
            selected ? "border-[#13344A] border-3" : "border-[#13344A]/25"
          }`}
          style={{
            width: o.dotPx,
            height: o.dotPx,
            backgroundColor: o.dotColor,
          }}
        />
      </button>
    );
  })}
</div>

{/* Rangée des étiquettes */}
<div className="mt-3 flex items-start justify-between gap-4">
  {PAIN_OPTIONS.map((o) => (
    <span key={o.key} className={["w-16 text-center text-sm", choice === o.key ? "font-bold" : ""].join(" ")}>
      {o.label}
    </span>
  ))}
</div>

              {/* Douleur inhabituelle */}
              <button
                type="button"
                className="mt-10 flex items-center gap-3 text-sm"
                onClick={() => setUnusual((v) => !v)}
                aria-pressed={unusual}
              >
                <Star filled={unusual} />
                <span>douleur inhabituelle</span>
              </button>

              {/* ✅ Bloc qui apparaît seulement si douleur != aucune */}
              {showDetails && (
                <>
                  <p className="mt-10 text-sm font-medium text-[#13344A]">
                    Où se situent vos douleurs ?
                  </p>
                  <p className="mt-1 text-sm italic text-[#13344A]/70">
                    Appuyer sur une zone de la silhouette pour ajouter une douleur.
                  </p>

                  <div className="mt-6 flex justify-center">
                    <div className="relative w-[260px]">
                      <img
                        src="/silhouette.png"
                        alt="Silhouette corps"
                        className="w-full h-auto"
                      />
                      {ZONE_POSITIONS.map((z) => {
                        const idx = spots.findIndex((s) => s.zone === z.zone);
                        const hasInfo = idx !== -1;
                        const isActive = activeZone === z.zone;
                        const isBlue = isActive || hasInfo;
                        const number = idx + 1;

                        return (
                          <button
                            key={z.zone}
                            type="button"
                            onClick={() => selectZone(z.zone)}
                            className={`absolute rounded-full transition flex items-center justify-center ${
                              isActive ? "ring-2 ring-[#13344A]/50" : ""
                            }`}
                            style={{
                              width: 60,
                              height: 60,
                              left: z.left,
                              top: z.top,
                              backgroundColor: isBlue
                                ? "#13344A"
                                : "rgba(201,206,211,0.3)",
                            }}
                          >
                            {(isActive || hasInfo) && (
                              <span className="text-[#F6EFE6] font-semibold text-lg">
                                {hasInfo ? number : spots.length + 1}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="text-base font-semibold text-[#13344A]">
                      {activeZone
                        ? `Douleur ${Math.max(
                            1,
                            spots.findIndex((s) => s.zone === activeZone) + 1
                          )}`
                        : "Douleur"}
                    </p>

                    <p className="mt-1 text-sm italic text-[#13344A]/70">
                      Intensité, heure, durée, évolution, sensations…
                    </p>

                    <textarea
                      value={activeText}
                      onChange={(e) => setActiveText(e.target.value)}
                      onBlur={saveActiveZoneText}
                      placeholder="Je détaille ma douleur."
                      className="mt-4 w-full min-h-[110px] rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] p-4 text-sm outline-none"
                    />
                    {activeZone && (
                      <button
                        type="button"
                        onClick={deleteActiveZone}
                        className="mt-3 text-sm underline text-[#5B1E26]"
                      >
                        supprimer cette zone
                      </button>
                    )}

                    <p className="mt-2 text-xs text-[#13344A]/60">
                      Astuce : clique une autre zone pour ajouter une autre douleur.
                    </p>
                  </div>
                </>
              )}

              {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="absolute left-0 right-0 bottom text-center underline text-sm font-medium"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const ZONE_POSITIONS: { zone: number; left: number; top: number }[] = [
  { zone: 1, left: 35, top: 160 },
  { zone: 2, left: 160, top: 160 },
  { zone: 3, left: 97, top: 170 },
  { zone: 4, left: 97, top: 240 },
  { zone: 5, left: 160, top: 220 },
  { zone: 6, left: 35, top: 220 },
  { zone: 7, left: 97, top: 70 },
];

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "#5B1E26" : "none"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2l2.7 6.4L21.6 9l-5 4.3L18 20.2 12 16.8 6 20.2l1.4-6.9-5-4.3 6.9-.6L12 2z"
        stroke="#5B1E26"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export default function PainPage() {
  return (
    <Suspense>
      <PainPageInner />
    </Suspense>
  );
}