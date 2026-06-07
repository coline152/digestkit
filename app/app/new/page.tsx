"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

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

export default function NewSectionPage() {
  const router = useRouter();
  const params = useSearchParams();

  const dateParam = params.get("date");
  const selectedDate = useMemo(() => {
    if (dateParam) return new Date(dateParam + "T00:00:00");
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, [dateParam]);

  const isoDate = useMemo(() => toISODate(selectedDate), [selectedDate]);

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const createSection = async () => {
    if (!userId) return;
    const clean = label.trim();
    if (!clean) {
      setError("Écris un nom de section.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data, error } = await supabase
      .from("custom_sections")
      .insert({ user_id: userId, label: clean })
      .select("id")
      .single();

    if (error || !data) {
      setError(error?.message ?? "Erreur création.");
      setSaving(false);
      return;
    }

    router.push(`/app/sections/${data.id}?date=${isoDate}`);
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
      <header className="px-5 pt-6 pb-4">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push(`/app/new?date=${toISODate(selectedDate)}`)}
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
            <div className="absolute left-0 top-0 h-full w-2" style={{ backgroundColor: "#F6CA6B" }} />

            <h2 className="text-2xl font-semibold italic text-[#13344A]/60">
              Nommer la nouvelle section
            </h2>

            <div className="mt-6">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Sommeil, Sport, Stress..."
                className="w-full rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] p-4 text-sm outline-none"
              />
            </div>

            {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

            <button
              type="button"
              onClick={createSection}
              disabled={saving}
              className="absolute left-0 right-0 bottom-8 text-center underline text-sm font-medium"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </section>
      
    </main>
  );
}