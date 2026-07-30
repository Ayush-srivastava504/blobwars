// Bottom-center HUD: health bar, XP bar, level, mass, score, and coins.
// Computes percentage fills from raw values passed down by GameCanvas.
// Purely presentational, no internal state.
// Bar widths are clamped to 0-100% to guard against bad input data.
"use client";

export function StatusBars({
  health,
  maxHealth,
  xp,
  xpNeeded,
  level,
  mass,
  score,
  coins,
  bombs,
  raised,
}: {
  health: number;
  maxHealth: number;
  xp: number;
  xpNeeded: number;
  level: number;
  mass: number;
  score: number;
  coins: number;
  bombs?: number;
  raised?: boolean;
}) {
  const healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const xpPct = Math.max(0, Math.min(100, (xp / xpNeeded) * 100));

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 w-[min(300px,92vw)] sm:w-[min(320px,88vw)] safe-bottom select-none pointer-events-none transition-[bottom] duration-150 ${
        raised ? "bottom-36 sm:bottom-40" : "bottom-3 sm:bottom-4"
      }`}
    >
      <div className="flex justify-between flex-wrap gap-x-2 text-[10px] sm:text-xs mb-1 text-white/80">
        <span>Lv.{level}</span>
        <span>Mass {Math.round(mass)}</span>
        <span className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-yellow-400">🪙 {coins}</span>
          {!!bombs && <span className="text-orange-400">💣 {bombs}</span>}
          <span>Score {score}</span>
        </span>
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
