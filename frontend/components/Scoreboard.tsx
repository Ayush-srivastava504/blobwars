"use client";

interface Entry {
  id: string;
  name: string;
  score: number;
  kills: number;
}

export function Scoreboard({ entries, selfId }: { entries: Entry[]; selfId: string }) {
  return (
    <div className="absolute top-4 right-4 w-52 bg-arena-panel/80 backdrop-blur rounded-lg border border-white/10 p-3 pointer-events-none select-none">
      <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Leaderboard</div>
      <ol className="space-y-1">
        {entries.map((e, i) => (
          <li
            key={e.id}
            className={`flex justify-between text-sm ${e.id === selfId ? "text-arena-accent font-semibold" : "text-white/80"}`}
          >
            <span className="truncate max-w-[110px]">
              {i + 1}. {e.name}
            </span>
            <span>{e.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
