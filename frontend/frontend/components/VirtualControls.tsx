// Twin-stick touch HUD: a move joystick (bottom-left) + an aim/fire
// joystick (bottom-right), plus Slide and Bomb buttons stacked above the
// aim stick. Purely an input HUD: it doesn't touch game state itself, it
// just calls the small public API GameCanvas exposes on the Phaser scene
// (onMove/onMoveEnd/onAim/onAimEnd/onFire/onFireHeld), which ArenaScene
// wires straight into the same movement/aim/fire code path used by
// keyboard+mouse input on desktop. Dragging the right stick points the gun
// (independent of movement) and fires continuously for as long as it's
// held out past the dead zone, like a standard mobile twin-stick shooter;
// releasing it snaps the knob back but leaves the gun aimed where it was.
// Built with Pointer Events (not touch events) so it also works with a
// mouse during desktop testing, and uses pointer capture so dragging still
// tracks correctly even if the finger/cursor slides outside the stick base.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Base sizes target ~375px-wide phones; shrunk further on very narrow
// screens (see useResponsiveScale) and unchanged on larger phones/tablets.
const BASE_SIZE = 116; // px, outer joystick ring
const KNOB_SIZE = 52; // px, draggable knob

/** Scales control sizing down on narrow screens (e.g. small phones in
 * portrait) so the joystick/buttons don't crowd the visible arena, and
 * keeps full size everywhere else. Recomputed on resize/orientation change. */
function useResponsiveScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      setScale(w < 360 ? 0.8 : w < 400 ? 0.9 : 1);
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);
  return scale;
}

export function VirtualControls({
  onMove,
  onMoveEnd,
  onAim,
  onAimEnd,
  onFire,
  onFireHeld,
  onSlide,
  onBombAim,
  onBombThrow,
  bombCount = 0,
}: {
  onMove: (dir: { x: number; y: number }) => void;
  onMoveEnd: () => void;
  onAim: (dir: { x: number; y: number }) => void;
  onAimEnd: () => void;
  onFire: () => void;
  onFireHeld: (held: boolean) => void;
  onSlide: () => void;
  onBombAim?: (aiming: boolean) => void;
  onBombThrow?: () => void;
  bombCount?: number;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [sliding, setSliding] = useState(false);
  const [aimingBomb, setAimingBomb] = useState(false);
  const scale = useResponsiveScale();

  // Aim/fire stick — separate base ref, pointer id, knob offset, and
  // dragging state so it operates fully independently of the move stick
  // (both can be held by different fingers at the same time).
  const fireBaseRef = useRef<HTMLDivElement>(null);
  const activeFirePointerId = useRef<number | null>(null);
  const [fireKnobOffset, setFireKnobOffset] = useState({ x: 0, y: 0 });
  const [firing, setFiring] = useState(false);

  // Effective pixel sizes for this render, scaled for small screens.
  const baseSize = Math.round(BASE_SIZE * scale);
  const knobSize = Math.round(KNOB_SIZE * scale);
  const maxOffset = (baseSize - knobSize) / 2;
  const slideSize = Math.round(56 * scale);
  const bombSize = Math.round(56 * scale);

  // Shared drag math for both sticks: given a base element and a pointer
  // position, returns the clamped knob offset (for rendering) plus the
  // normalized direction (or {0,0} inside the dead zone).
  const computeStickVector = useCallback(
    (base: HTMLDivElement, clientX: number, clientY: number) => {
      const rect = base.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > maxOffset) {
        dx = (dx / dist) * maxOffset;
        dy = (dy / dist) * maxOffset;
      }

      const clampedDist = Math.min(dist, maxOffset);
      // Dead zone so tiny jitter near center doesn't send a phantom direction.
      const normalized =
        dist < 8
          ? { x: 0, y: 0 }
          : { x: dx / (clampedDist || 1), y: dy / (clampedDist || 1) };

      return { offset: { x: dx, y: dy }, normalized };
    },
    [maxOffset]
  );

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const { offset, normalized } = computeStickVector(base, clientX, clientY);
    setKnobOffset(offset);
    onMove(normalized);
  }, [onMove, computeStickVector]);

  const updateFireFromPointer = useCallback((clientX: number, clientY: number) => {
    const base = fireBaseRef.current;
    if (!base) return;
    const { offset, normalized } = computeStickVector(base, clientX, clientY);
    setFireKnobOffset(offset);
    onAim(normalized);
    // Firing is gated on being pushed out of the dead zone — a bare tap in
    // the center (normalized {0,0}) aims nowhere new and shouldn't fire.
    const pushed = normalized.x !== 0 || normalized.y !== 0;
    setFiring(pushed);
    onFireHeld(pushed);
  }, [onAim, onFireHeld, computeStickVector]);

  // IMPORTANT: every handler below calls e.stopPropagation() in addition to
  // e.preventDefault(). These controls are plain HTML elements layered over
  // the Phaser canvas, not part of it — but Phaser's input manager listens
  // globally on `window` (so it can still catch a drag/release that leaves
  // the canvas), so an un-stopped pointerdown on the joystick/fire button
  // bubbles up to window and gets picked up by Phaser too. That made
  // `this.input.activePointer.leftButtonDown()` read true while the
  // joystick was merely being dragged, which the desktop "hold to fire"
  // check in ArenaScene.update() interpreted as a held mouse button — i.e.
  // the joystick appeared to fire on its own. Stopping propagation here
  // keeps these HUD controls fully isolated from Phaser's input, so only
  // the explicit onFire/onFireHeld calls below can ever trigger a shot.
  const handleJoystickPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    activePointerId.current = e.pointerId;
    setDragging(true);
    updateFromPointer(e.clientX, e.clientY);
  }, [updateFromPointer]);

  const handleJoystickPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateFromPointer(e.clientX, e.clientY);
  }, [updateFromPointer]);

  const releaseJoystick = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    activePointerId.current = null;
    setDragging(false);
    setKnobOffset({ x: 0, y: 0 });
    onMoveEnd();
  }, [onMoveEnd]);

  const handleFirePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    activeFirePointerId.current = e.pointerId;
    // Fire immediately on touchdown (matches the old tap-to-fire button),
    // in addition to the continuous hold-to-fire driven by updateFireFromPointer.
    onFire();
    updateFireFromPointer(e.clientX, e.clientY);
  }, [onFire, updateFireFromPointer]);

  const handleFirePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activeFirePointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateFireFromPointer(e.clientX, e.clientY);
  }, [updateFireFromPointer]);

  const releaseFireStick = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activeFirePointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    activeFirePointerId.current = null;
    setFiring(false);
    setFireKnobOffset({ x: 0, y: 0 });
    onFireHeld(false);
    onAimEnd();
  }, [onFireHeld, onAimEnd]);

  const handleSlideTap = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onSlide();
      setSliding(true);
      window.setTimeout(() => setSliding(false), 180);
    },
    [onSlide]
  );

  // Bomb: press-and-hold shows the dotted aim trajectory (see ArenaScene),
  // releasing actually throws it. Same pointer-capture / stopPropagation
  // pattern as Fire so it can't leak into Phaser's input.
  const handleBombDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (bombCount <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setAimingBomb(true);
    onBombAim?.(true);
  }, [onBombAim, bombCount]);

  const handleBombUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (aimingBomb) {
      onBombThrow?.();
    }
    setAimingBomb(false);
    onBombAim?.(false);
  }, [onBombAim, onBombThrow, aimingBomb]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none [touch-action:none]">
      {/* Joystick */}
      <div
        ref={baseRef}
        onPointerDown={handleJoystickPointerDown}
        onPointerMove={handleJoystickPointerMove}
        onPointerUp={releaseJoystick}
        onPointerCancel={releaseJoystick}
        className="pointer-events-auto absolute bottom-6 left-4 safe-bottom safe-left rounded-full bg-arena-panel/50 backdrop-blur border-2 border-white/20 flex items-center justify-center [touch-action:none]"
        style={{ width: baseSize, height: baseSize }}
        aria-label="Move joystick"
        role="slider"
        aria-valuenow={0}
      >
        <div
          className="rounded-full bg-white/90 border border-white/40 shadow-lg transition-transform"
          style={{
            width: knobSize,
            height: knobSize,
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            transitionDuration: dragging ? "0ms" : "120ms",
            opacity: dragging ? 1 : 0.85,
          }}
        />
      </div>

      {/* Aim/fire joystick — mirrors the move stick on the right. Dragging it
          points the gun and fires continuously past the dead zone; a bare
          tap still fires once immediately (see handleFirePointerDown). */}
      <div
        ref={fireBaseRef}
        onPointerDown={handleFirePointerDown}
        onPointerMove={handleFirePointerMove}
        onPointerUp={releaseFireStick}
        onPointerCancel={releaseFireStick}
        className={`pointer-events-auto absolute bottom-6 right-4 safe-bottom safe-right rounded-full backdrop-blur border-2 flex items-center justify-center [touch-action:none] transition-colors ${
          firing ? "bg-arena-danger/30 border-arena-danger/60" : "bg-arena-panel/50 border-white/20"
        }`}
        style={{ width: baseSize, height: baseSize }}
        aria-label="Aim and fire joystick"
        role="slider"
        aria-valuenow={0}
      >
        {/* Static backdrop icon so the stick reads as "fire" even centered/idle. */}
        <span
          className="absolute pointer-events-none opacity-40"
          style={{ fontSize: Math.round(28 * scale) }}
        >
          🔥
        </span>
        <div
          className={`rounded-full border shadow-lg transition-transform flex items-center justify-center ${
            firing ? "bg-arena-danger border-arena-danger/70" : "bg-white/90 border-white/40"
          }`}
          style={{
            width: knobSize,
            height: knobSize,
            transform: `translate(${fireKnobOffset.x}px, ${fireKnobOffset.y}px)`,
            transitionDuration: activeFirePointerId.current !== null ? "0ms" : "120ms",
            opacity: activeFirePointerId.current !== null ? 1 : 0.85,
          }}
        />
      </div>

      {/* Slide button — stacked above the fire stick, centered over it. */}
      <button
        onPointerDown={handleSlideTap}
        onContextMenu={(e) => e.preventDefault()}
        className={`pointer-events-auto absolute safe-bottom safe-right rounded-full border-2 flex items-center justify-center font-bold [touch-action:none] transition-colors ${
          sliding ? "bg-arena-accent border-arena-accent/70 scale-95" : "bg-arena-accent/70 border-white/20"
        }`}
        style={{
          width: slideSize,
          height: slideSize,
          bottom: Math.round(24 * scale) + baseSize + Math.round(12 * scale),
          right: Math.round(16 * scale) + baseSize / 2 - slideSize / 2,
          fontSize: Math.round(20 * scale),
          transition: "transform 80ms, background-color 80ms",
        }}
        aria-label="Slide"
      >
        💨
      </button>

      {/* Bomb button — hold to aim (shows dotted trajectory), release to throw.
          Stacked above Slide, same horizontal center as the fire stick. */}
      <button
        onPointerDown={handleBombDown}
        onPointerUp={handleBombUp}
        onPointerCancel={handleBombUp}
        onPointerLeave={handleBombUp}
        onContextMenu={(e) => e.preventDefault()}
        disabled={bombCount <= 0}
        className={`pointer-events-auto absolute safe-bottom safe-right rounded-full border-2 flex items-center justify-center font-bold [touch-action:none] transition-colors ${
          bombCount <= 0
            ? "bg-black/30 border-white/10 opacity-40"
            : aimingBomb
            ? "bg-orange-500 border-orange-300 scale-95"
            : "bg-orange-600/70 border-white/20"
        }`}
        style={{
          width: bombSize,
          height: bombSize,
          bottom: Math.round(24 * scale) + baseSize + Math.round(12 * scale) + slideSize + Math.round(12 * scale),
          right: Math.round(16 * scale) + baseSize / 2 - bombSize / 2,
          fontSize: Math.round(20 * scale),
          transition: "transform 80ms, background-color 80ms",
        }}
        aria-label="Throw bomb"
      >
        💣
        {bombCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-black/80 border border-white/20 text-[10px] flex items-center justify-center">
            {bombCount}
          </span>
        )}
      </button>
    </div>
  );
}
