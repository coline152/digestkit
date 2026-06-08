"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!consent) {
      setError("Vous devez accepter le traitement des données de santé.");
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("user_consents").insert({
        user_id: data.user.id,
        consent_version: "v1",
        consent_text: "Je consens au traitement de mes données de santé pour le fonctionnement de DigestKit.",
      });
      router.push("/app");
    }

    setLoading(false);
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#FAF6F1" }}>
      <img src="/motif-login-haut.png" className="absolute top-0 left-0 w-full" style={{ opacity: 0.85 }} />
      <img src="/motif-login-bas.png" className="absolute bottom-0 left-0 w-full" style={{ opacity: 0.85 }} />

      <div className="relative z-10 w-full max-w-xs px-6 flex flex-col gap-5">
        <div className="mb-2">
          <h1 className="text-xl font-bold" style={{ color: "#1B3A4B" }}>Bienvenue sur Digestkit!</h1>
          <p className="text-sm mt-1" style={{ color: "#1B3A4B" }}>Créez un compte pour commencer.</p>
        </div>

        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 text-sm outline-none"
          style={{ backgroundColor: "white", borderColor: "#E0D9D0", color: "#1B3A4B" }}
        />

        <input
          type="password"
          placeholder="mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 text-sm outline-none"
          style={{ backgroundColor: "white", borderColor: "#E0D9D0", color: "#1B3A4B" }}
        />

        <input
          type="password"
          placeholder="confirmation du mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 text-sm outline-none"
          style={{ backgroundColor: "white", borderColor: "#E0D9D0", color: "#1B3A4B" }}
        />

        <label className="flex items-start gap-2 text-sm" style={{ color: "#1B3A4B" }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 w-4 h-4"
          />
          <span>J'accepte le traitement de mes données de santé pour le fonctionnement de DigestKit.</span>
        </label>

        {error && <p className="text-sm" style={{ color: "#E05C5C" }}>{error}</p>}

        <button
          onClick={handleSignUp}
          disabled={loading}
          className="w-full py-3 rounded-full text-sm font-medium"
          style={{ backgroundColor: "#1B3A4B", color: "white" }}
        >
          {loading ? "création..." : "créer mon compte"}
        </button>

        <button
          onClick={() => router.push("/login")}
          className="text-sm underline text-left"
          style={{ color: "#1B3A4B" }}
        >
          ← Déjà un compte ? Me connecter
        </button>
      </div>
    </main>
  );
}