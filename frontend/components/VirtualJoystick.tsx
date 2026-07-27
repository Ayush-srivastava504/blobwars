// Fixed-position virtual joystick for movement. Sits bottom-left, tracks
// the active pointer relative to where it was first pressed (not a fixed
// center), and reports a normalized [-1, 1] vector via onChange every
// frame while dragged, resetting to zero on release.
"use client";

import { useRef, useState } from "react";

const BASE_SIZE = 120;
const KNOB_SIZE = 56;
const MAX_RADIUS = (BASE_SIZE - KNOB_SIZE) / 2;

export function VirtualJoystick({ onChange }: { onChange: (x: number, y: number) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    originRef.current = { x: e.clientX, y: e.clientY };
    setActive(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (pointerIdRef.current !== e.pointerId || !originRef.current) return;
    let dx = e.clientX - originRef.current.x;
    let dy = e.clientY - originRef.current.y;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_RADIUS) {
      dx = (dx / dist) * MAX_RADIUS;
      dy = (dy / dist) * MAX_RADIUS;
    }
    setKnob({ x: dx, y: dy });
    onChange(dx / MAX_RADIUS, dy / MAX_RADIUS);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    originRef.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  }

  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="absolute bottom-8 left-8 rounded-full bg-arena-panel/60 border border-white/15 backdrop-blur touch-none select-none"
      style={{ width: BASE_SIZE, height: BASE_SIZE }}
    >
      <div
        className="absolute rounded-full bg-white/80 border border-white/40 pointer-events-none transition-opacity"
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          left: BASE_SIZE / 2 - KNOB_SIZE / 2 + knob.x,
          top: BASE_SIZE / 2 - KNOB_SIZE / 2 + knob.y,
          opacity: active ? 1 : 0.6,
        }}
      />
    </div>
  );
}
