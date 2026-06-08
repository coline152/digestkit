"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) return;
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSent(true);
    setLoading(false);
  };

  return (
    <main className="h-screen flex flex-col items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#FAF6F1" }}>
      <img src="/motif-login-haut.png" className="absolute top-0 left-0 w-full" style={{ opacity: 0.85 }} />
      <img src="/motif-login-bas.png" className="absolute bottom-0 left-0 w-full" style={{ opacity: 0.85 }} />

      <div className="relative z-10 w-full max-w-xs px-6 flex flex-col gap-5">
        <div className="mb-2">
          <h1 className="text-xl font-bold" style={{ color: "#1B3A4B" }}>Mot de passe oublié ?</h1>
          <p className="text-sm mt-1" style={{ color: "#1B3A4B" }}>Renseignez votre email pour réinitialiser votre mot de passe.</p>
        </div>

        {sent ? (
          <p className="text-sm" style={{ color: "green" }}>Email envoyé ! Vérifiez votre boîte mail.</p>
        ) : (
          <>
            <input
              type="email"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: "white", borderColor: "#E0D9D0", color: "#1B3A4B" }}
            />
            <button onClick={handleReset} disabled={loading} className="w-full py-3 rounded-full text-sm font-medium" style={{ backgroundColor: "#1B3A4B", color: "white" }}>
              {loading ? "envoi..." : "réinitialiser mon mot de passe"}
            </button>
          </>
        )}

        <button onClick={() => router.push("/login")} className="text-sm underline text-left" style={{ color: "#1B3A4B" }}>
          ← Retour à la connexion
        </button>
      </div>
    </main>
  );
}