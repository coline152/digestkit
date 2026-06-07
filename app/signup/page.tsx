"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!consent) {
      setError("Vous devez accepter le traitement des données de santé.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Enregistrer le consentement RGPD
      await supabase.from("user_consents").insert({
        user_id: data.user.id,
        consent_version: "v1",
        consent_text:
          "Je consens au traitement de mes données de santé pour le fonctionnement de DigestKit.",
      });

      router.push("/app");
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Créer un compte</h1>

      <form onSubmit={handleSignup} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          type="password"
          placeholder="Mot de passe (12 caractères minimum)"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
        />

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            J’accepte le traitement de mes données de santé pour le
            fonctionnement de DigestKit.
          </span>
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white p-2 rounded"
        >
          {loading ? "Création..." : "Créer mon compte"}
        </button>
      </form>
    </main>
  );
}