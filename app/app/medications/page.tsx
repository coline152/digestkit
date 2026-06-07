"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

type MedicationItem = {
  id: string;
  name: string;
  dosage: string;
  time: string;
  quantity: number;
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

function readMeta(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function createEmptyMedication(): MedicationItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    dosage: "",
    time: "",
    quantity: 1,
  };
}

function readMedicationsFromMeta(meta: unknown): MedicationItem[] {
  const safeMeta = readMeta(meta);
  const raw = safeMeta.medications;

  if (!Array.isArray(raw)) {
    return [createEmptyMedication()];
  }

  const cleaned = raw
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;

      const record = item as Record<string, unknown>;

      const id =
        typeof record.id === "string" && record.id.trim()
          ? record.id
          : crypto.randomUUID();

      const name = typeof record.name === "string" ? record.name : "";
      const dosage = typeof record.dosage === "string" ? record.dosage : "";
      const time = typeof record.time === "string" ? record.time : "";
      const quantity =
        typeof record.quantity === "number" && Number.isFinite(record.quantity) && record.quantity > 0
          ? Math.floor(record.quantity)
          : 1;

      return {
        id,
        name,
        dosage,
        time,
        quantity,
      };
    })
    .filter(Boolean) as MedicationItem[];

  return cleaned.length > 0 ? cleaned : [createEmptyMedication()];
}

export default function MedicationsPage() {
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

  const [medications, setMedications] = useState<MedicationItem[]>([createEmptyMedication()]);
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
        .select("meta")
        .eq("user_id", userId)
        .eq("entry_date", isoDate)
        .maybeSingle();

      if (error || !data) {
        setMedications([createEmptyMedication()]);
        return;
      }

      const loaded = readMedicationsFromMeta((data as any).meta);
      setMedications(loaded);
    };

    load();
  }, [userId, isoDate]);

  const updateMedication = (
    id: string,
    field: keyof MedicationItem,
    value: string | number
  ) => {
    setMedications((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const incrementQuantity = (id: string) => {
    setMedications((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decrementQuantity = (id: string) => {
    setMedications((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity - 1) }
          : item
      )
    );
  };

  const addMedication = () => {
    setMedications((prev) => [...prev, createEmptyMedication()]);
  };

  const removeMedication = (id: string) => {
    setMedications((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length > 0 ? next : [createEmptyMedication()];
    });
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    setError(null);

    const cleanedMedications = medications
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        dosage: item.dosage.trim(),
        time: item.time.trim(),
        quantity: Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1,
      }))
      .filter((item) => item.name || item.dosage || item.time || item.quantity !== 1);

    const { data: existing, error: fetchErr } = await supabase
      .from("daily_entries")
      .select("pain_level, mood_level, meta")
      .eq("user_id", userId)
      .eq("entry_date", isoDate)
      .maybeSingle();

    if (fetchErr) {
      setError(fetchErr.message);
      setSaving(false);
      return;
    }

    const existingMeta = readMeta(existing?.meta);

    const nextMeta = {
      ...existingMeta,
      medications: cleanedMedications,
    };

    const { error: saveErr } = await supabase.from("daily_entries").upsert(
      {
        user_id: userId,
        entry_date: isoDate,
        pain_level: existing?.pain_level ?? null,
        mood_level: existing?.mood_level ?? null,
        meta: nextMeta,
      },
      { onConflict: "user_id,entry_date" }
    );

    if (saveErr) {
      setError(saveErr.message);
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
          <div className="relative min-h-[70vh] p-6">
            <div
              className="absolute left-0 top-0 h-full w-2"
              style={{ backgroundColor: "#B8C6D0" }}
            />

            <h2 className="text-2xl font-semibold">Médications</h2>

            <p className="mt-6 text-sm leading-relaxed text-[#13344A]">
              Avez-vous pris un médicament ?
            </p>

            <div className="mt-8 space-y-8">
              {medications.map((item, index) => (
                <div key={item.id} className="space-y-4">
                  <div className="grid grid-cols-[1fr_100px] gap-4">
                    <div>
                      <label className="mb-2 block text-sm">Nom du médicament</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          updateMedication(item.id, "name", e.target.value)
                        }
                        placeholder="Paracétamol"
                        className="h-12 w-full border border-[#13344A]/20 bg-[#F6EFE6] px-4 text-sm outline-none placeholder:text-[#13344A]/35"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm">Dosage</label>
                      <input
                        type="text"
                        value={item.dosage}
                        onChange={(e) =>
                          updateMedication(item.id, "dosage", e.target.value)
                        }
                        placeholder="500 mg"
                        className="h-12 w-full border border-[#13344A]/20 bg-[#F6EFE6] px-4 text-sm outline-none placeholder:text-[#13344A]/35"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_110px] gap-4 items-end">
                    <div>
                      <label className="mb-2 block text-sm">Heure de prise</label>
                      <input
                        type="time"
                        value={item.time}
                        onChange={(e) =>
                          updateMedication(item.id, "time", e.target.value)
                        }
                        className="h-12 w-full border border-[#13344A]/20 bg-[#F6EFE6] px-4 text-sm outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm">Quantité</label>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => decrementQuantity(item.id)}
                          className="h-10 w-10 text-xl"
                        >
                          −
                        </button>

                        <div className="flex h-12 w-12 items-center justify-center border border-[#13344A]/20 text-sm">
                          {item.quantity}
                        </div>

                        <button
                          type="button"
                          onClick={() => incrementQuantity(item.id)}
                          className="h-10 w-10 text-xl"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {medications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMedication(item.id)}
                      className="text-sm underline text-[#13344A]/70"
                    >
                      Supprimer cette prise
                    </button>
                  )}

                  {index !== medications.length - 1 && (
                    <div className="pt-2">
                      <div className="h-px bg-[#13344A]/10" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addMedication}
              className="mt-8 block w-full text-center underline text-sm"
            >
              + Ajouter une nouvelle prise
            </button>

            {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={[
                "absolute bottom-8 left-0 right-0 text-center text-sm font-medium underline",
                saving ? "opacity-40" : "opacity-100",
              ].join(" ")}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}