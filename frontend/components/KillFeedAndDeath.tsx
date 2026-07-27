// HUD overlays for combat feedback: the scrolling kill feed list
// and the full-screen death overlay shown when the player is eliminated.
// Both are presentational; state and timing are owned by GameCanvas.
// Kill feed entries slide/fade in with a skull icon per elimination.
"use client";

export function KillFeed({ messages }: { messages: { id: number; text: string }[] }) {
  return (
    <div className="absolute top-20 right-4 w-60 flex flex-col gap-1 pointer-events-none select-none">
      {messages.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-2 text-xs bg-black/50 rounded px-2 py-1 text-white/85 animate-slideInRight"
        >
          <span>💀</span>
          <span>{m.text}</span>
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
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 animate-fadeIn">
      <h2 className="text-3xl font-bold text-arena-danger animate-zoomIn">
        You were eliminated
      </h2>
      <p className="text-white/70">by {byName}</p>
      <button
        onClick={onRespawn}
        className="mt-4 px-6 py-3 rounded-lg bg-arena-accent hover:bg-blue-500 transition-colors font-semibold"
      >
        Respawn
      </button>
      <button onClick={onExit} className="text-sm text-white/50 hover:text-white/80 transition-colors">
        Exit to Lobby
      </button>
    </div>
  );
}
