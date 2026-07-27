// Top-right leaderboard panel listing players ranked by score.
// Highlights the local player's own row and animates row reordering
// with a FLIP transition so rank changes slide smoothly instead of
// popping. Purely presentational; entries are provided by GameCanvas.
"use client";

import { useLayoutEffect, useRef } from "react";

interface Entry {
  id: string;
  name: string;
  score: number;
  kills: number;
}

export function Scoreboard({ entries, selfId }: { entries: Entry[]; selfId: string }) {
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const prevPositions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const nextPositions = new Map<string, number>();

    rowRefs.current.forEach((el, id) => {
      nextPositions.set(id, el.getBoundingClientRect().top);
    });

    rowRefs.current.forEach((el, id) => {
      const prevTop = prevPositions.current.get(id);
      const nextTop = nextPositions.get(id);
      if (prevTop === undefined || nextTop === undefined) return;
      const delta = prevTop - nextTop;
      if (delta === 0) return;

      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 300ms ease-out";
        el.style.transform = "translateY(0)";
      });
    });

    prevPositions.current = nextPositions;
  }, [entries]);

  return (
    <div className="absolute top-4 right-4 w-52 bg-arena-panel/80 backdrop-blur rounded-lg border border-white/10 p-3 pointer-events-none select-none">
      <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Leaderboard</div>
      <ol className="space-y-1">
        {entries.map((e, i) => (
          <li
            key={e.id}
            ref={(el) => {
              if (el) rowRefs.current.set(e.id, el);
              else rowRefs.current.delete(e.id);
            }}
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
