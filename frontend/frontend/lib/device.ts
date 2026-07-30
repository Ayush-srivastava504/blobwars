// Shared touch/desktop device detection.
// Used by the lobby (to preview the right control scheme before playing)
// and by GameCanvas (to only mount the on-screen joystick/fire button on
// touch devices instead of always showing it on desktop too).
"use client";

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches;
  const hasTouchPoints = navigator.maxTouchPoints > 0;
  return Boolean(hasCoarsePointer || hasTouchPoints);
}
