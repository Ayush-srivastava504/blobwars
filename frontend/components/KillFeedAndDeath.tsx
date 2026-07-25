"use client";

export function KillFeed({ messages }: { messages: string[] }) {
  return (
    <div className="absolute top-20 right-4 w-60 flex flex-col gap-1 pointer-events-none select-none">
      {messages.map((m, i) => (
        <div key={i} className="text-xs bg-black/40 rounded px-2 py-1 text-white/80 animate-in fade-in">
          {m}
        </div>
      ))}
    </div>
  );
}

export function DeathOverlay({ byName, onRespawn }: { byName: string; onRespawn: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4">
      <h2 className="text-3xl font-bold text-arena-danger">You were eliminated</h2>
      <p className="text-white/70">by {byName}</p>
      <button
        onClick={onRespawn}
        className="mt-4 px-6 py-3 rounded-lg bg-arena-accent hover:bg-blue-500 transition-colors font-semibold"
      >
        Respawn
      </button>
    </div>
  );
}
