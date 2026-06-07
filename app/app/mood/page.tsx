"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

type MoodChoice = "good" | "ok" | "low" | "very_low";

const MOOD_OPTIONS: {
  key: MoodChoice;
  label: string;
  value: number;
  dotPx: number;
  dotColor: string;
}[] = [
  { key: "good", label: "bon", value: 4, dotPx: 14, dotColor: "#E6D39B" },
  { key: "ok", label: "passable", value: 3, dotPx: 18, dotColor: "#E6D39B" },
  { key: "low", label: "bas", value: 2, dotPx: 24, dotColor: "#E6D39B" },
  { key: "very_low", label: "très bas", value: 1, dotPx: 30, dotColor: "#E6D39B" },
];

const DEFAULT_MOOD_STATES = [
  "fatigue",
  "irritation",
  "solitude",
  "calme",
  "sérénité",
  "tristesse",
  "joie",
  "stress",
];

// --- Helpers notes (ancien format v1) : on les garde pour lire l'historique
const TAG_BLOCK_RE = /\[mood_tags:[^\]]*\]/g;
const NOTE_BLOCK_RE = /\[mood_note:[^\]]*\]/g;

function extractMoodTags(notes: string | null | undefined): string[] {
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

function extractMoodNote(notes: string | null | undefined): string {
  if (!notes) return "";
  const m = notes.match(/\[mood_note:([^\]]*)\]/);
  return m ? m[1].trim() : "";
}

// --- Helpers meta (nouveau format)
function readMetaMoodTags(meta: any): string[] {
  const arr = meta?.mood_tags;
  if (!Array.isArray(arr)) return [];
  return arr.filter((x: any) => typeof x === "string");
}

function readMetaMoodNote(meta: any): string {
  const v = meta?.mood_note;
  return typeof v === "string" ? v : "";
}

// --- Dates
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

export default function MoodPage() {
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

  const [choice, setChoice] = useState<MoodChoice | null>(null);
  const [moodStates, setMoodStates] = useState<{ id: string; label: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [newStateLabel, setNewStateLabel] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Session
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

  // 2) Liste permanente mood_states (+ init par défaut si vide)
  useEffect(() => {
    if (!userId) return;

    const loadStates = async () => {
      const { data, error } = await supabase
        .from("mood_states")
        .select("id, label, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) return;

      if (!data || data.length === 0) {
        const payload = DEFAULT_MOOD_STATES.map((label) => ({ user_id: userId, label }));
        await supabase.from("mood_states").upsert(payload, { onConflict: "user_id,label" });

        const { data: data2 } = await supabase
          .from("mood_states")
          .select("id, label, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (data2) setMoodStates(data2.map(({ id, label }) => ({ id, label })));
        return;
      }

      setMoodStates(data.map(({ id, label }) => ({ id, label })));
    };

    loadStates();
  }, [userId]);

  // 3) Charger l'entrée du jour (mood + meta/notes)
  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("daily_entries")
        .select("mood_level, meta, notes")
        .eq("user_id", userId)
        .eq("entry_date", isoDate)
        .maybeSingle();

      if (error || !data) {
        setChoice(null);
        setSelectedTags([]);
        setNote("");
        return;
      }

      // mood_level
      if (data.mood_level != null) {
        const exact = MOOD_OPTIONS.find((o) => o.value === data.mood_level);
        if (exact) setChoice(exact.key);
        else {
          const closest = MOOD_OPTIONS.reduce((prev, cur) => {
            return Math.abs(cur.value - data.mood_level!) < Math.abs(prev.value - data.mood_level!) ? cur : prev;
          });
          setChoice(closest.key);
        }
      } else {
        setChoice(null);
      }

      // ✅ Lire d’abord meta, sinon fallback sur notes (ancien format)
      const meta = (data as any).meta as any | null;
      const tagsFromMeta = readMetaMoodTags(meta);
      const noteFromMeta = readMetaMoodNote(meta);

      if (tagsFromMeta.length || noteFromMeta.length) {
        setSelectedTags(tagsFromMeta);
        setNote(noteFromMeta);
      } else {
        setSelectedTags(extractMoodTags(data.notes));
        setNote(extractMoodNote(data.notes));
      }
    };

    load();
  }, [userId, isoDate]);

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addMoodState = async () => {
    if (!userId) return;
    const label = newStateLabel.trim();
    if (!label) return;

    const clean = label.toLowerCase();

    const { error } = await supabase
      .from("mood_states")
      .upsert({ user_id: userId, label: clean }, { onConflict: "user_id,label" });

    if (error) {
      setError(error.message);
      return;
    }

    const { data } = await supabase
      .from("mood_states")
      .select("id, label, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (data) setMoodStates(data.map(({ id, label }) => ({ id, label })));

    setNewStateLabel("");
    setShowAddModal(false);
  };

  const handleSave = async () => {
    if (!userId) return;

    if (!choice) {
      setError("Choisissez un moral.");
      return;
    }

    setSaving(true);
    setError(null);

    const selected = MOOD_OPTIONS.find((o) => o.key === choice)!;

    // 1) Lire meta existant (pour fusionner)
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

    const existingMeta =
      existing && (existing as any).meta && typeof (existing as any).meta === "object"
        ? (existing as any).meta
        : {};

    // 2) Fusion : garder l'existant + mettre à jour mood_tags / mood_note
    const nextMeta = {
      ...existingMeta,
      mood_tags: selectedTags,
      mood_note: note.trim(),
    };

    // 3) Upsert
    const { error } = await supabase.from("daily_entries").upsert(
      {
        user_id: userId,
        entry_date: isoDate,
        mood_level: selected.value,
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

  return (
    <main className="min-h-screen bg-[#F6EFE6] text-[#13344A]">
      {/* Header */}
<header className="px-5 pt-6 pb-4">
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
        <div className="rounded-[10px] border border-[#13344A]/20 bg-[#F6EFE6] shadow-sm overflow-hidden">
          <div className="relative p-6 min-h-[70vh]">
            <div className="absolute left-0 top-0 h-full w-2" style={{ backgroundColor: "#E6D39B" }} />

            <h2 className="text-2xl font-semibold">Moral</h2>

            <p className="mt-6 text-sm leading-relaxed text-[#13344A]">Quel a été votre moral du jour ?</p>

            {/* Choix moral */}
            {/* Rangée des cercles — centrés verticalement */}
<div className="mt-8 flex items-center justify-between gap-4">
  {MOOD_OPTIONS.map((o) => {
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
          className={[
            "rounded-full border",
            selected ? "border-[#13344A] border-3" : "border-[#13344A]/25",
          ].join(" ")}
          style={{ width: o.dotPx, height: o.dotPx, backgroundColor: o.dotColor }}
        />
      </button>
    );
  })}
</div>

{/* Rangée des étiquettes — alignées sous les cercles */}
<div className="mt-3 flex items-start justify-between gap-4">
  {MOOD_OPTIONS.map((o) => (
    <span key={o.key} className={["w-16 text-center text-sm", choice === o.key ? "font-bold" : ""].join(" ")}>
      {o.label}
    </span>
  ))}
</div>

            {/* Partie conditionnelle */}
            {choice && (
              <>
                <p className="mt-10 text-sm leading-relaxed text-[#13344A]">Comment décrieriez-vous votre état ?</p>

                <div className="mt-6 flex flex-wrap gap-3">
                  {moodStates.map((s) => {
                    const checked = selectedTags.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleTag(s.id)}
                        className={[
                          "px-4 py-2 rounded-full border text-sm transition",
                          checked
                            ? "bg-[#13344A] text-[#F6EFE6] border-[#13344A]"
                            : "bg-[#F6EFE6] text-[#13344A] border-[#13344A]/25",
                        ].join(" ")}
                      >
                        {s.label}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="text-sm italic text-[#13344A]/70"
                  >
                    + ajouter
                  </button>
                </div>

                <div className="mt-6">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="J’ajoute une note"
                    className="w-full min-h-[120px] rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] p-4 text-sm outline-none"
                  />
                </div>
              </>
            )}

            {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !choice}
              className={[
                "absolute left-0 right-0 bottom-8 text-center underline text-sm font-medium",
                saving || !choice ? "opacity-40" : "opacity-100",
              ].join(" ")}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </section>

      {/* MODAL FIGMA */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg border border-black/10 relative">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-2xl leading-none text-[#13344A]/70"
              aria-label="Fermer"
            >
              ×
            </button>

            <div className="p-6 pt-10">
              <div className="flex justify-center">
                <input
                  value={newStateLabel}
                  onChange={(e) => setNewStateLabel(e.target.value)}
                  placeholder="nouvel état"
                  className="w-56 rounded-full bg-[#C9CED3] px-5 py-3 text-center text-lg italic text-white placeholder:text-white/90 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={addMoodState}
                className="mt-8 w-full text-center underline text-[#13344A] font-medium"
              >
                Ajouter l&apos;état
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}