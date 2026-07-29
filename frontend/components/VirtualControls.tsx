// On-screen joystick (bottom-left) + fire button (bottom-right) for touch
// devices. Purely an input HUD: it doesn't touch game state itself, it just
// calls the small public API GameCanvas exposes on the Phaser scene
// (onMove/onMoveEnd/onFire/onFireHeld), which ArenaScene wires straight into
// the same movement/fire code path used by keyboard and canvas-tap input.
// Built with Pointer Events (not touch events) so it also works with a mouse
// during desktop testing, and uses pointer capture so dragging still tracks
// correctly even if the finger/cursor slides outside the joystick base.
"use client";

import { useCallback, useRef, useState } from "react";

const BASE_SIZE = 116; // px, outer joystick ring
const KNOB_SIZE = 52; // px, draggable knob
const MAX_OFFSET = (BASE_SIZE - KNOB_SIZE) / 2; // how far the knob can travel from center

export function VirtualControls({
  onMove,
  onMoveEnd,
  onFire,
  onFireHeld,
  onSlide,
}: {
  onMove: (dir: { x: number; y: number }) => void;
  onMoveEnd: () => void;
  onFire: () => void;
  onFireHeld: (held: boolean) => void;
  onSlide: () => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [firing, setFiring] = useState(false);
  const [sliding, setSliding] = useState(false);

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > MAX_OFFSET) {
      dx = (dx / dist) * MAX_OFFSET;
      dy = (dy / dist) * MAX_OFFSET;
    }
    setKnobOffset({ x: dx, y: dy });

    const clampedDist = Math.min(dist, MAX_OFFSET);
    const normalizedX = clampedDist > 0 ? dx / clampedDist : 0;
    const normalizedY = clampedDist > 0 ? dy / clampedDist : 0;

    // Dead zone so tiny jitter near center doesn't send a phantom direction.
    if (dist < 8) {
      onMove({ x: 0, y: 0 });
      return;
    }
    onMove({ x: normalizedX, y: normalizedY });
  }, [onMove]);

  const handleJoystickPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    activePointerId.current = e.pointerId;
    setDragging(true);
    updateFromPointer(e.clientX, e.clientY);
  }, [updateFromPointer]);

  const handleJoystickPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    updateFromPointer(e.clientX, e.clientY);
  }, [updateFromPointer]);

  const releaseJoystick = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setDragging(false);
    setKnobOffset({ x: 0, y: 0 });
    onMoveEnd();
  }, [onMoveEnd]);

  const handleFireDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setFiring(true);
    onFire();
    onFireHeld(true);
  }, [onFire, onFireHeld]);

  const handleFireUp = useCallback(() => {
    setFiring(false);
    onFireHeld(false);
  }, [onFireHeld]);

  const handleSlideTap = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onSlide();
      setSliding(true);
      window.setTimeout(() => setSliding(false), 180);
    },
    [onSlide]
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none [touch-action:none]">
      {/* Joystick */}
      <div
        ref={baseRef}
        onPointerDown={handleJoystickPointerDown}
        onPointerMove={handleJoystickPointerMove}
        onPointerUp={releaseJoystick}
        onPointerCancel={releaseJoystick}
        className="pointer-events-auto absolute bottom-8 left-8 rounded-full bg-arena-panel/50 backdrop-blur border-2 border-white/20 flex items-center justify-center [touch-action:none]"
        style={{ width: BASE_SIZE, height: BASE_SIZE }}
        aria-label="Move joystick"
        role="slider"
        aria-valuenow={0}
      >
        <div
          className="rounded-full bg-white/90 border border-white/40 shadow-lg transition-transform"
          style={{
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            transitionDuration: dragging ? "0ms" : "120ms",
            opacity: dragging ? 1 : 0.85,
          }}
        />
      </div>

      {/* Slide button — sits just to the left of Fire so a thumb can reach both. */}
      <button
        onPointerDown={handleSlideTap}
        onContextMenu={(e) => e.preventDefault()}
        className={`pointer-events-auto absolute bottom-14 right-32 w-14 h-14 rounded-full border-2 flex items-center justify-center text-xl font-bold [touch-action:none] transition-colors ${
          sliding ? "bg-arena-accent border-arena-accent/70 scale-95" : "bg-arena-accent/70 border-white/20"
        }`}
        style={{ transition: "transform 80ms, background-color 80ms" }}
        aria-label="Slide"
      >
        💨
      </button>

      {/* Fire button */}
      <button
        onPointerDown={handleFireDown}
        onPointerUp={handleFireUp}
        onPointerCancel={handleFireUp}
        onPointerLeave={handleFireUp}
        onContextMenu={(e) => e.preventDefault()}
        className={`pointer-events-auto absolute bottom-10 right-8 w-20 h-20 rounded-full border-2 flex items-center justify-center text-2xl font-bold [touch-action:none] transition-colors ${
          firing
            ? "bg-arena-danger border-arena-danger/70 scale-95"
            : "bg-arena-danger/70 border-white/20"
        }`}
        style={{ transition: "transform 80ms, background-color 80ms" }}
        aria-label="Fire"
      >
        🔥
      </button>
    </div>
  );
}
