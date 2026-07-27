// Root Next.js layout: sets page metadata and global HTML/body shell.
// Applies the game font and dark arena background to the whole app.
// Wraps every route, including the lobby and game pages.
// No client-side logic; this is a server component.
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ChunkErrorHandler from "./chunk-error-handler";

export const metadata: Metadata = {
  title: "Blob Wars — Multiplayer Arena",
  description: "Real-time multiplayer .io arena game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-M2RM89PDNW"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-M2RM89PDNW');
          `}
        </Script>
      </head>
      <body className="font-game text-white bg-arena-bg">
        <ChunkErrorHandler />
        {children}
      </body>
    </html>
  );
}
