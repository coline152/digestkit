"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SettingsPage() {
  const router = useRouter();

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return;
    setLoadingEmail(true);
    setEmailMessage(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      setEmailMessage("Erreur : " + error.message);
    } else {
      setEmailMessage("Un email de confirmation a été envoyé à " + newEmail);
      setNewEmail("");
    }
    setLoadingEmail(false);
  };

  const handleUpdatePassword = async () => {
    if (!newPassword.trim()) return;
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoadingPassword(true);
    setPasswordMessage(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMessage("Erreur : " + error.message);
    } else {
      setPasswordMessage("Mot de passe mis à jour avec succès !");
      setNewPassword("");
      setConfirmPassword("");
    }
    setLoadingPassword(false);
  };

  return (
    <main className="min-h-screen bg-[#F6EFE6] text-[#13344A]">
      <header className="px-5 pt-6 pb-4">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push("/app")}
            className="w-fit text-sm underline underline-offset-2"
          >
            ← Retour
          </button>
          <h1 className="text-xl font-medium">Paramètres</h1>
        </div>
      </header>

      <section className="px-5 pt-6 pb-10 flex flex-col gap-8">

        {/* Modifier l'email */}
        <div className="rounded-2xl border border-[#13344A]/20 bg-white shadow-sm p-6 flex flex-col gap-4">
          <h2 className="text-base font-semibold">Modifier l'email</h2>
          <input
            type="email"
            placeholder="Nouvel email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] px-4 py-3 text-sm outline-none"
          />
          {emailMessage && (
            <p className="text-sm" style={{ color: emailMessage.startsWith("Erreur") ? "#E05C5C" : "green" }}>
              {emailMessage}
            </p>
          )}
          <button
            type="button"
            onClick={handleUpdateEmail}
            disabled={loadingEmail}
            className="w-full text-center underline text-sm font-medium"
          >
            {loadingEmail ? "Enregistrement..." : "Mettre à jour l'email"}
          </button>
        </div>

        {/* Modifier le mot de passe */}
        <div className="rounded-2xl border border-[#13344A]/20 bg-white shadow-sm p-6 flex flex-col gap-4">
          <h2 className="text-base font-semibold">Modifier le mot de passe</h2>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] px-4 py-3 text-sm outline-none pr-10"
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
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-[#13344A]/25 bg-[#F6EFE6] px-4 py-3 text-sm outline-none"
          />
          {passwordMessage && (
            <p className="text-sm" style={{ color: passwordMessage.startsWith("Erreur") || passwordMessage.includes("correspondent") ? "#E05C5C" : "green" }}>
              {passwordMessage}
            </p>
          )}
          <button
            type="button"
            onClick={handleUpdatePassword}
            disabled={loadingPassword}
            className="w-full text-center underline text-sm font-medium"
          >
            {loadingPassword ? "Enregistrement..." : "Mettre à jour le mot de passe"}
          </button>
        </div>

      </section>
    </main>
  );
}