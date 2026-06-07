"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleReset = async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("Erreur : " + error.message);
    } else {
      setMessage("Mot de passe mis à jour !");
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#FAF6F1" }}
    >
      <div className="w-full max-w-xs flex flex-col gap-4">
        <h1 className="text-xl font-bold" style={{ color: "#1B3A4B" }}>
          Nouveau mot de passe
        </h1>
        <input
          type="password"
          placeholder="nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 text-sm outline-none"
          style={{ backgroundColor: "white", borderColor: "#E0D9D0" }}
        />
        <button
          onClick={handleReset}
          className="w-full py-3 rounded-full text-sm font-medium"
          style={{ backgroundColor: "#1B3A4B", color: "white" }}
        >
          Mettre à jour
        </button>
        {message && <p className="text-sm" style={{ color: "#1B3A4B" }}>{message}</p>}
      </div>
    </main>
  );
}