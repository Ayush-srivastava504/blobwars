"use client";

export function StatusBars({
  health,
  maxHealth,
  xp,
  xpNeeded,
  level,
  mass,
  score,
}: {
  health: number;
  maxHealth: number;
  xp: number;
  xpNeeded: number;
  level: number;
  mass: number;
  score: number;
}) {
  const healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const xpPct = Math.max(0, Math.min(100, (xp / xpNeeded) * 100));

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[320px] select-none pointer-events-none">
      <div className="flex justify-between text-xs mb-1 text-white/80">
        <span>Lv.{level}</span>
        <span>Mass {Math.round(mass)}</span>
        <span>Score {score}</span>
      </div>
      <div className="h-3 rounded-full bg-black/50 overflow-hidden border border-white/10">
        <div
          className="h-full bg-arena-danger transition-[width] duration-150"
          style={{ width: `${healthPct}%` }}
        />
      </div>
      <div className="h-2 mt-1 rounded-full bg-black/50 overflow-hidden border border-white/10">
        <div
          className="h-full bg-arena-xp transition-[width] duration-150"
          style={{ width: `${xpPct}%` }}
        />
      </div>
    </div>
  );
}
