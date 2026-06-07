import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-raleway",
});

export const metadata: Metadata = {
  title: "DigestKit",
  description: "outil d'auto-observation de douleurs et symptômes digestifs.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DigestKit",
  },
  icons: {
    apple: "/icon-512.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={`${raleway.variable} min-h-screen bg-white text-slate-900 antialiased`}>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-VM9FNS9Z01"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-VM9FNS9Z01');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}