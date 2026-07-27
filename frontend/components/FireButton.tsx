// Fixed-position fire button. Sits bottom-right. Firing once per tap,
// and auto-repeats (at the scene's own fire-rate cooldown) while held
// down, so holding the button sprays bullets in the current aim direction.
"use client";

import { useRef } from "react";

const FIRE_REPEAT_MS = 90;

export function FireButton({ onFire }: { onFire: () => void }) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function start(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onFire();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(onFire, FIRE_REPEAT_MS);
  }

  function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      className="absolute bottom-10 right-8 w-20 h-20 rounded-full bg-arena-danger/80 border-2 border-white/30 backdrop-blur touch-none select-none flex items-center justify-center text-white font-bold text-sm active:scale-95 transition-transform"
      aria-label="Fire"
    >
      FIRE
    </button>
  );
}
