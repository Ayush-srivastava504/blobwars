// HUD overlays for combat feedback: the scrolling kill feed list
// and the full-screen death overlay shown when the player is eliminated.
// Both are presentational; state and timing are owned by GameCanvas.
// Kill feed entries slide/fade in with a skull icon per elimination.
"use client";

export function KillFeed({ messages }: { messages: { id: number; text: string }[] }) {
  return (
    <div className="absolute top-24 sm:top-28 right-2 sm:right-4 safe-right w-40 sm:w-60 flex flex-col gap-1 pointer-events-none select-none">
      {messages.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs bg-black/50 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 text-white/85 animate-slideInRight"
        >
          <span>💀</span>
          <span className="truncate">{m.text}</span>
        </div>
      ))}
    </div>
  );
}

export function DeathOverlay({
  byName,
  onRespawn,
  onExit,
}: {
  byName: string;
  onRespawn: () => void;
  onExit: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 sm:gap-4 px-4 safe-bottom animate-fadeIn">
      <h2 className="text-2xl sm:text-3xl font-bold text-arena-danger text-center animate-zoomIn">
        You were eliminated
      </h2>
      <p className="text-white/70 text-sm sm:text-base">by {byName}</p>
      <button
        onClick={onRespawn}
        className="mt-2 sm:mt-4 px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg bg-arena-accent hover:bg-blue-500 transition-colors font-semibold text-sm sm:text-base"
      >
        Respawn
      </button>
      <button onClick={onExit} className="text-xs sm:text-sm text-white/50 hover:text-white/80 transition-colors">
        Exit to Lobby
      </button>
    </div>
  );
}
