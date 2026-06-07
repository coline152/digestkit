"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
      return;
    }

    router.push("/app");
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setError("Vérifie tes emails pour confirmer ton compte !");
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Entre ton email d'abord");
      return;
    }
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotSent(true);
    setError(null);
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#FAF6F1" }}
    >
      {/* Motif en haut */}
      <div
        className="absolute top-0 left-0 w-full h-48 bg-no-repeat"
        style={{
          backgroundImage: "url('/motif-login-haut.png')",
          backgroundSize: "cover",
          backgroundPosition: "top center",
          opacity: 0.85,
        }}
      />

      {/* Motif en bas */}
      <div
        className="absolute bottom-0 left-0 w-full h-48 bg-no-repeat"
        style={{
          backgroundImage: "url('/motif-login-bas.png')",
          backgroundSize: "cover",
          backgroundPosition: "top center",
          opacity: 0.85,
        }}
      />

      {/* Contenu */}
      <div className="relative z-10 w-full max-w-xs px-6 flex flex-col gap-5">
        <div className="mb-2">
          <h1 className="text-xl font-bold" style={{ color: "#1B3A4B" }}>
            Bienvenue sur Digestkit!
          </h1>
          <p className="text-sm mt-1" style={{ color: "#1B3A4B" }}>
            Créez un compte ou connectez-vous pour commencer.
          </p>
        </div>

        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 text-sm outline-none"
          style={{ backgroundColor: "white", borderColor: "#E0D9D0", color: "#1B3A4B" }}
        />

        <div className="relative w-full">
  <input
    type={showPassword ? "text" : "password"}
    placeholder="mot de passe"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    className="w-full border rounded-xl px-4 py-3 text-sm outline-none pr-10"
    style={{ backgroundColor: "white", borderColor: "#E0D9D0", color: "#1B3A4B" }}
  />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
  >
    {showPassword ? (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    )}
  </button>
</div>

        {/* Case à cocher + mot de passe oublié */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm" style={{ color: "#1B3A4B" }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4"
            />
            se souvenir de moi sur cet appareil
          </label>

          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm underline text-left"
            style={{ color: "#1B3A4B" }}
          >
            mot de passe oublié
          </button>
        </div>

        {/* Messages */}
        {error && (
          <p className="text-sm" style={{ color: forgotSent ? "green" : "#E05C5C" }}>
            {error}
          </p>
        )}
        {forgotSent && (
          <p className="text-sm" style={{ color: "green" }}>
            Email de réinitialisation envoyé !
          </p>
        )}

        {/* Boutons */}
        <button
          onClick={handleSignUp}
          disabled={loading}
          className="w-full py-3 rounded-full text-sm font-medium"
          style={{ backgroundColor: "#1B3A4B", color: "white" }}
        >
          créer mon compte
        </button>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 rounded-full text-sm font-medium border"
          style={{ backgroundColor: "transparent", borderColor: "#1B3A4B", color: "#1B3A4B" }}
        >
          {loading ? "connexion..." : "me connecter"}
        </button>
      </div>
    </main>
  );
}