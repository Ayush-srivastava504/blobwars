// Root Next.js layout: sets page metadata and global HTML/body shell.
// Applies the game font and dark arena background to the whole app.
// Wraps every route, including the lobby and game pages.
// No client-side logic; this is a server component.
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const SITE_NAME = "Blob Wars";
const SITE_DESCRIPTION =
  "Blob Wars is a free real-time multiplayer .io arena shooter — survive zombie waves, earn coins, buy and upgrade guns, and battle other players. Play instantly in your browser, no download.";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://blobwars.io";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Blob Wars — Free Multiplayer Zombie Arena .io Game",
    template: "%s — Blob Wars",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "blob wars",
    "io game",
    "multiplayer io games",
    "browser game",
    "zombie survival game",
    "free online shooter",
    "multiplayer zombie game",
    "gun game online",
  ],
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Blob Wars — Free Multiplayer Zombie Arena .io Game",
    description: SITE_DESCRIPTION,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Blob Wars gameplay" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blob Wars — Free Multiplayer Zombie Arena .io Game",
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b0e14",
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

        {/* Google AdSense loader — publisher id matches public/ads.txt */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5594205569635986"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="font-game text-white bg-arena-bg">{children}</body>
    </html>
  );
}
