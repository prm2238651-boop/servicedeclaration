import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POLICE NATIONALE — DECLARATION/MALI",
  description: "Plateforme sécurisée de vérification et suivi des DECLARATION/MALI.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
