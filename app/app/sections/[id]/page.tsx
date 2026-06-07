"use client";

import { Suspense } from "react";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter, useSearchParams } from "next/navigation";

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

function SectionsPageInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();

  const sectionId = params.id;
  const dateParam = search.get("date");

  const selectedDate = useMemo(() => {
    if (dateParam) return new Date(dateParam + "T00:00:00");
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, [dateParam]);

  const isoDate = useMemo(() => toISODate(selectedDate), [selectedDate]);

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [label, setLabel] = useState("Section");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // États menu modifier
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  // Session
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

  // Charger nom section
  useEffect(() => {
    if (!userId) return;
    const loadSection = async () => {
      const { data } = await supabase
        .from("custom_sections")
        .select("label")
        .eq("user_id", userId)
        .eq("id", sectionId)
        .maybeSingle();
      if (data?.label) setLabel(data.label);
    };
    loadSection();
  }, [userId, sectionId]);

  // Charger note du jour
  useEffect(() => {
    if (!userId) return;
    const loadNote = async () => {
      const { data } = await supabase
        .from("daily_entries")
        .select("meta")
        .eq("user_id", userId)
        .eq("entry_date", isoDate)
        .maybeSingle();
      const meta = readMeta((data as any)?.meta);
      const notesMap = readMeta(meta.custom_sections_notes);
      const val = typeof notesMap[sectionId] === "string" ? notesMap[sectionId] : "";
      setNote(val);
    };
    loadNote();
  }, [userId, sectionId, isoDate]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);

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
    const existingMap = readMeta(existingMeta.custom_sections_notes);
    const nextMap = { ...existingMap, [sectionId]: note.trim() };
    const nextMeta = { ...existingMeta, custom_sections_notes: nextMap };

    const { error } = await supabase.from("daily_entries").upsert(
      { user_id: userId, entry_date: isoDate, meta: nextMeta },
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

  const handleRename = async () => {
    if (!userId) return;
    const clean = newLabel.trim();
    if (!clean) return;

    const { error } = await supabase
      .from("custom_sections")
      .update({ label: clean })
      .eq("id", sectionId)
      .eq("user_id", userId);

    if (error) {
      setError(error.message);
      return;
    }

    setLabel(clean);
    setShowRenameModal(false);
    setShowEditMenu(false);
  };

  const handleDelete = async () => {
    if (!userId) return;

    const { error } = await supabase
      .from("custom_sections")
      .delete()
      .eq("id", sectionId)
      .eq("user_id", userId);

    if (error) {
      setError(error.message);
      return;
    }

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

          {/* Ligne du haut : ← Retour à gauche, ✏️ à droite */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push(`/app?date=${isoDate}`)}
              className="w-fit text-sm underline underline-offset-2"
            >
              ← Retour
            </button>

            {/* Menu modifier */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEditMenu((v) => !v)}
                className="text-xl leading-none text-[#13344A]/60"
                aria-label="Modifier la section"
              >
                ✏️
              </button>

              {showEditMenu && (
                <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-[#13344A]/15 bg-white shadow-md">
                  <button
                    type="button"
                    onClick={() => {
                      setNewLabel(label);
                      setShowRenameModal(true);
                      setShowEditMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-[#13344A] hover:bg-[#F6EFE6]"
                  >
                    Renommer
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Date */}
          <h1 className="text-xl font-medium capitalize">
            {formatFrenchLongDate(selectedDate)}
          </h1>
        </div>
      </header>

      <section className="px-5 pb-10">
        <div className="rounded-[10px] border border-[#13344A]/20 bg-[#F6EFE6] shadow-sm overflow-hidden">
          <div className="relative p-6 min-h-[70vh]">
            <div className="absolute left-0 top-0 h-full w-2" style={{ backgroundColor: "#E9D29F" }} />

            <h2 className="text-2xl font-semibold">{label}</h2>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="J'ajoute une note."
              className="mt-6 w-full min-h-[140px] rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] p-4 text-sm outline-none"
            />

            {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="absolute left-0 right-0 bottom-8 text-center underline text-sm font-medium"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </section>

      {/* Modal renommer */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg border border-black/10 relative">
            <button
              type="button"
              onClick={() => setShowRenameModal(false)}
              className="absolute right-4 top-4 text-2xl leading-none text-[#13344A]/70"
              aria-label="Fermer"
            >
              ×
            </button>

            <div className="p-6 pt-10">
              <div className="flex justify-center">
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Nouveau nom"
                  className="w-56 rounded-full bg-[#C9CED3] px-5 py-3 text-center text-lg italic text-white placeholder:text-white/90 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleRename}
                className="mt-8 w-full text-center underline text-[#13344A] font-medium"
              >
                Renommer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
export default function SectionsPage() {
  return (
    <Suspense>
      <SectionsPageInner />
    </Suspense>
  );
}