"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";

function AppHomePageInner() {
  const router = useRouter();

  return (
    <main
      className="fixed inset-0 flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#FAF6F1" }}
    >
      {/* Motif en haut */}
      <img
  src="/motif-accueil-haut.png"
  className="absolute top-0 left-0 w-full"
  style={{ opacity: 0.85 }}
/>

      {/* Motif en bas */}
     <img
  src="/motif-accueil-bas.png"
  className="absolute bottom-0 left-0 w-full"
  style={{ opacity: 0.85 }}
/>

      {/* Contenu */}
      <div className="relative z-10 w-full max-w-xs px-6 flex flex-col gap-4">
        <h1 className="text-xl font-bold" style={{ color: "#1B3A4B" }}>
          Bienvenue sur Digestkit!
        </h1>
        <p className="text-sm" style={{ color: "#1B3A4B" }}>
          Cette application mobile vous permet de prendre en note vos symptomes et douleurs digestives au quotidien.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="text-sm underline text-left"
          style={{ color: "#1B3A4B" }}
        >
          → commencer
        </button>
      </div>
    </main>
  );
}

export default function AppHomePage() {
  return (
    <Suspense>
      <AppHomePageInner />
    </Suspense>
  );
}