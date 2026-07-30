// Google AdSense display unit, shown in the lobby (not during gameplay,
// so it never overlaps the canvas or controls).
"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_CLIENT = "ca-pub-5594205569635986"; // matches public/ads.txt

export function AdBanner({
  adSlot = "4415938444",
  className = "",
  format = "auto",
}: {
  adSlot?: string;
  className?: string;
  format?: string;
}) {
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense script blocked (adblock, offline, etc.) — fail silently.
    }
  }, []);

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle block ${className}`}
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={adSlot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
