// Root Next.js layout: sets page metadata and global HTML/body shell.
// Applies the game font and dark arena background to the whole app.
// Wraps every route, including the lobby and game pages.
// No client-side logic; this is a server component.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blob Wars — Multiplayer Arena",
  description: "Real-time multiplayer .io arena game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-game text-white bg-arena-bg">{children}</body>
    </html>
  );
}
