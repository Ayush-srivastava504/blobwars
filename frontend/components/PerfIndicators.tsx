// Top-left HUD badges: live FPS/ping, plus the current wave and a
// countdown to the next wave (or "Wave active" while zombies remain).
// Colors shift green/yellow/red based on simple health thresholds.
// Pure presentational component, values passed down from GameCanvas.
// The countdown ticks locally off waveEndsOrStartsAt so it doesn't
// need a server update every second.
"use client";

import { useEffect, useState } from "react";

interface WaveInfo {
  wave: number;
  waveState: string;
  waveEndsOrStartsAt: number;
}

export function PerfIndicators({
  ping,
  fps,
  waveInfo,
}: {
  ping: number;
  fps: number;
  waveInfo: WaveInfo | null;
}) {
  const pingColor = ping < 80 ? "text-green-400" : ping < 150 ? "text-yellow-400" : "text-red-400";
  const fpsColor = fps >= 50 ? "text-green-400" : fps >= 30 ? "text-yellow-400" : "text-red-400";

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = waveInfo ? Math.max(0, Math.ceil((waveInfo.waveEndsOrStartsAt - now) / 1000)) : 0;

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2 select-none pointer-events-none">
      <div className="flex gap-3 text-xs font-mono bg-arena-panel/80 backdrop-blur rounded-lg border border-white/10 px-3 py-2">
        <span className={fpsColor}>{fps} FPS</span>
        <span className="text-white/20">|</span>
        <span className={pingColor}>{ping}ms</span>
      </div>
      {waveInfo && (
        <div className="flex gap-2 text-xs font-mono bg-arena-panel/80 backdrop-blur rounded-lg border border-white/10 px-3 py-2">
          <span className="text-white/90 font-semibold">Wave {waveInfo.wave}</span>
          <span className="text-white/20">|</span>
          {waveInfo.waveState === "active" ? (
            <span className="text-arena-danger">Active</span>
          ) : (
            <span className="text-arena-accent">Next in {secondsLeft}s</span>
          )}
        </div>
      )}
    </div>
  );
}
