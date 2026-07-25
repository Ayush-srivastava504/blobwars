"use client";

import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import type Phaser from "phaser";
import { StatusBars } from "./StatusBars";
import { Scoreboard } from "./Scoreboard";
import { Minimap, MinimapData } from "./Minimap";
import { PerfIndicators } from "./PerfIndicators";
import { KillFeed, DeathOverlay } from "./KillFeedAndDeath";

export function GameCanvas({ room }: { room: Room }) {
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
  const [killFeed, setKillFeed] = useState<string[]>([]);
  const [deathInfo, setDeathInfo] = useState<{ byName: string } | null>(null);

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
            const next = [text, ...prev];
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

      {deathInfo && (
        <DeathOverlay
          byName={deathInfo.byName}
          onRespawn={() => {
            sceneRef.current?.requestRespawn();
          }}
        />
      )}
    </div>
  );
}
