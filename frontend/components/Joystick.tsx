// On-screen virtual joystick: a draggable stick inside a fixed base,
// reporting a normalized -1..1 direction vector while held.
// Shown bottom-left, works with mouse or touch pointer events.
// Reports {x:0,y:0} and hides the stick offset when released.
"use client";

import { useRef, useState } from "react";

const BASE_SIZE = 110;
const STICK_SIZE = 50;
const MAX_OFFSET = (BASE_SIZE - STICK_SIZE) / 2;

export function Joystick({ onChange }: { onChange: (dir: { x: number; y: number }) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  function updateFromClient(clientX: number, clientY: number) {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, MAX_OFFSET);
    const nx = (dx / len) * clamped;
    const ny = (dy / len) * clamped;
    setOffset({ x: nx, y: ny });

    const magnitude = Math.min(len / MAX_OFFSET, 1);
    if (magnitude < 0.15) {
      onChange({ x: 0, y: 0 });
    } else {
      onChange({ x: dx / len, y: dy / len });
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    activePointerId.current = e.pointerId;
    setActive(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromClient(e.clientX, e.clientY);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (activePointerId.current !== e.pointerId) return;
    updateFromClient(e.clientX, e.clientY);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setActive(false);
    setOffset({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  }

  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="absolute bottom-6 left-6 rounded-full bg-black/30 border border-white/15 touch-none select-none"
      style={{ width: BASE_SIZE, height: BASE_SIZE }}
    >
      <div
        className="absolute rounded-full bg-white/25 border border-white/40 transition-[background-color] pointer-events-none"
        style={{
          width: STICK_SIZE,
          height: STICK_SIZE,
          left: BASE_SIZE / 2 - STICK_SIZE / 2 + offset.x,
          top: BASE_SIZE / 2 - STICK_SIZE / 2 + offset.y,
          backgroundColor: active ? "rgba(79,157,255,0.45)" : undefined,
        }}
      />
    </div>
  );
}
