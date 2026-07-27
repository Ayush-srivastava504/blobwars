// Detects a failed Next.js chunk load (stale client after a redeploy swapped
// out the old build's hashed chunk files) and auto-reloads the page once so
// the user picks up the new HTML + chunk manifest instead of seeing a broken
// screen. Guards against a reload loop with sessionStorage in case the chunk
// is missing for some other, non-transient reason.
"use client";

import { useEffect } from "react";

const RELOAD_GUARD_KEY = "chunk-reload-attempted";

function isChunkLoadError(message: string | undefined | null): boolean {
  if (!message) return false;
  return message.includes("ChunkLoadError") || message.includes("Loading chunk");
}

export default function ChunkErrorHandler() {
  useEffect(() => {
    const reloadOnce = () => {
      if (!sessionStorage.getItem(RELOAD_GUARD_KEY)) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
        window.location.reload();
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.message) || isChunkLoadError(event.error?.message)) {
        reloadOnce();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = typeof reason === "string" ? reason : reason?.message;
      if (isChunkLoadError(message)) {
        reloadOnce();
      }
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
