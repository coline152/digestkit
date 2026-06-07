import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-raleway",
});

export const metadata: Metadata = {
  title: "DigestKit",
  description: "outil d'auto-observation de douleurs et symptômes digestifs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={`${raleway.variable} min-h-screen bg-white text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}