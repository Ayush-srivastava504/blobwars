"use client";

export function PerfIndicators({ ping, fps }: { ping: number; fps: number }) {
  const pingColor = ping < 80 ? "text-green-400" : ping < 150 ? "text-yellow-400" : "text-red-400";
  const fpsColor = fps >= 50 ? "text-green-400" : fps >= 30 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="absolute top-4 left-4 flex gap-3 text-xs font-mono bg-arena-panel/80 backdrop-blur rounded-lg border border-white/10 px-3 py-2 pointer-events-none select-none">
      <span className={fpsColor}>{fps} FPS</span>
      <span className="text-white/20">|</span>
      <span className={pingColor}>{ping}ms</span>
    </div>
  );
}
