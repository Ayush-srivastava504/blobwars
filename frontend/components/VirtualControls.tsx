// On-screen joystick (bottom-left) + fire button (bottom-right) for touch
// devices. Purely an input HUD: it doesn't touch game state itself, it just
// calls the small public API GameCanvas exposes on the Phaser scene
// (onMove/onMoveEnd/onFire/onFireHeld), which ArenaScene wires straight into
// the same movement/fire code path used by keyboard and canvas-tap input.
// Built with Pointer Events (not touch events) so it also works with a mouse
// during desktop testing, and uses pointer capture so dragging still tracks
// correctly even if the finger/cursor slides outside the joystick base.
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
  onFire,
  onFireHeld,
  onSlide,
  onBombAim,
  onBombThrow,
  bombCount = 0,
}: {
  onMove: (dir: { x: number; y: number }) => void;
  onMoveEnd: () => void;
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
  const [firing, setFiring] = useState(false);
  const [sliding, setSliding] = useState(false);
  const [aimingBomb, setAimingBomb] = useState(false);
  const scale = useResponsiveScale();

  // Effective pixel sizes for this render, scaled for small screens.
  const baseSize = Math.round(BASE_SIZE * scale);
  const knobSize = Math.round(KNOB_SIZE * scale);
  const maxOffset = (baseSize - knobSize) / 2;
  const fireSize = Math.round(80 * scale);
  const slideSize = Math.round(56 * scale);
  const bombSize = Math.round(56 * scale);

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
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
    setKnobOffset({ x: dx, y: dy });

    const clampedDist = Math.min(dist, maxOffset);
    const normalizedX = clampedDist > 0 ? dx / clampedDist : 0;
    const normalizedY = clampedDist > 0 ? dy / clampedDist : 0;

    // Dead zone so tiny jitter near center doesn't send a phantom direction.
    if (dist < 8) {
      onMove({ x: 0, y: 0 });
      return;
    }
    onMove({ x: normalizedX, y: normalizedY });
  }, [onMove, maxOffset]);

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

  const handleFireDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setFiring(true);
    onFire();
    onFireHeld(true);
  }, [onFire, onFireHeld]);

  const handleFireUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setFiring(false);
    onFireHeld(false);
  }, [onFireHeld]);

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

      {/* Slide button — sits just to the left of Fire so a thumb can reach both. */}
      <button
        onPointerDown={handleSlideTap}
        onContextMenu={(e) => e.preventDefault()}
        className={`pointer-events-auto absolute bottom-12 safe-bottom safe-right rounded-full border-2 flex items-center justify-center font-bold [touch-action:none] transition-colors ${
          sliding ? "bg-arena-accent border-arena-accent/70 scale-95" : "bg-arena-accent/70 border-white/20"
        }`}
        style={{
          width: slideSize,
          height: slideSize,
          right: Math.round(120 * scale),
          fontSize: Math.round(20 * scale),
          transition: "transform 80ms, background-color 80ms",
        }}
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
        className={`pointer-events-auto absolute bottom-8 right-4 safe-bottom safe-right rounded-full border-2 flex items-center justify-center font-bold [touch-action:none] transition-colors ${
          firing
            ? "bg-arena-danger border-arena-danger/70 scale-95"
            : "bg-arena-danger/70 border-white/20"
        }`}
        style={{
          width: fireSize,
          height: fireSize,
          fontSize: Math.round(24 * scale),
          transition: "transform 80ms, background-color 80ms",
        }}
        aria-label="Fire"
      >
        🔥
      </button>

      {/* Bomb button — hold to aim (shows dotted trajectory), release to throw. */}
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
          bottom: Math.round(128 * scale),
          right: Math.round(48 * scale),
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
