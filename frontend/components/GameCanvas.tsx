// Root game component: mounts the Phaser canvas and overlays React HUD.
// Bridges Phaser callbacks (self state, scoreboard, ping/fps, kill feed,
// death events) into React state, and forwards joystick/mute input
// back into the Phaser scene and the SFX module.
"use client";

import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import type Phaser from "phaser";
import { StatusBars } from "./StatusBars";
import { Scoreboard } from "./Scoreboard";
import { Minimap, MinimapData } from "./Minimap";
import { PerfIndicators } from "./PerfIndicators";
import { KillFeed, DeathOverlay } from "./KillFeedAndDeath";
import { Joystick } from "./Joystick";
import { setSfxMuted } from "../lib/sfx";

export function GameCanvas({ room, onExit }: { room: Room; onExit: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<any>(null);

  const [self, setSelf] = useState({
    health: 100,
    maxHealth: 100,
    mass: 20,
    level: 1,
    xp: 0,
    xpNeeded: 100,
    score: 0,
    state: "alive",
  });
  const [scoreboard, setScoreboard] = useState<{ id: string; name: string; score: number; kills: number }[]>([]);
  const [ping, setPing] = useState(0);
  const [fps, setFps] = useState(60);
  const [minimap, setMinimap] = useState<MinimapData | null>(null);
  const [killFeed, setKillFeed] = useState<{ id: number; text: string }[]>([]);
  const [deathInfo, setDeathInfo] = useState<{ byName: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const killFeedId = useRef(0);

  useEffect(() => {
    let disposed = false;

    (async () => {
      const { createGame } = await import("../game/createGame");
      if (disposed || !containerRef.current) return;

      const game = createGame(containerRef.current, room, {
        onSelfUpdate: (data) => {
          setSelf({ ...data, xpNeeded: data.xpNeeded });
          if (data.state === "alive") setDeathInfo(null);
        },
        onScoreboard: setScoreboard,
        onPing: setPing,
        onFps: setFps,
        onMinimap: (selfPos, others) => setMinimap({ self: selfPos, others }),
        onKilled: (byName) => setDeathInfo({ byName }),
        onKillFeed: (text) =>
          setKillFeed((prev) => {
            const next = [{ id: killFeedId.current++, text }, ...prev];
            return next.slice(0, 5);
          }),
      });

      gameRef.current = game;
      sceneRef.current = game.scene.keys["ArenaScene"];

      const handleResize = () => game.scale.resize(window.innerWidth, window.innerHeight);
      window.addEventListener("resize", handleResize);
      (game as any)._cleanupResize = () => window.removeEventListener("resize", handleResize);
    })();

    return () => {
      disposed = true;
      (gameRef.current as any)?._cleanupResize?.();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  useEffect(() => {
    if (killFeed.length === 0) return;
    const t = setTimeout(() => setKillFeed((prev) => prev.slice(0, -1)), 4000);
    return () => clearTimeout(t);
  }, [killFeed]);

  function handleJoystickChange(dir: { x: number; y: number }) {
    sceneRef.current?.setJoystickDirection(dir.x, dir.y);
  }

  function toggleMute() {
    setMuted((prev) => {
      const next = !prev;
      setSfxMuted(next);
      return next;
    });
  }

  function handleExit() {
    room.leave();
    onExit();
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-arena-bg">
      <div ref={containerRef} className="absolute inset-0" />

      <StatusBars
        health={self.health}
        maxHealth={self.maxHealth}
        xp={self.xp}
        xpNeeded={self.xpNeeded}
        level={self.level}
        mass={self.mass}
        score={self.score}
      />
      <Scoreboard entries={scoreboard} selfId={room.sessionId} />
      <Minimap data={minimap} />
      <PerfIndicators ping={ping} fps={fps} />
      <KillFeed messages={killFeed} />
      <Joystick onChange={handleJoystickChange} />

      <button
        onClick={handleExit}
        className="absolute top-16 left-4 px-3 py-1.5 rounded-lg bg-arena-panel/80 backdrop-blur border border-white/10 text-xs font-semibold text-white/80 hover:text-white hover:bg-arena-danger/70 transition-colors"
      >
        ← Exit to Lobby
      </button>

      <button
        onClick={toggleMute}
        className="absolute top-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-lg bg-arena-panel/80 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
        aria-label={muted ? "Unmute sound" : "Mute sound"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {deathInfo && (
        <DeathOverlay
          byName={deathInfo.byName}
          onRespawn={() => {
            sceneRef.current?.requestRespawn();
          }}
          onExit={handleExit}
        />
      )}
    </div>
  );
}
