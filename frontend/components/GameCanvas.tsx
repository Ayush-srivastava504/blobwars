// Root game component that mounts the Phaser canvas and React HUD.
// Bridges ArenaScene callbacks (UI, scoreboard, minimap, performance, death) into React state.
// Renders on-screen virtual joystick and fire controls for mobile and desktop testing.
// Forwards virtual input to the active ArenaScene through its public control API.
// Manages game lifecycle, audio controls, window resize, and cleanup.
"use client";

import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import type Phaser from "phaser";
import { MSG } from "@blobwars/shared";
import { StatusBars } from "./StatusBars";
import { Scoreboard } from "./Scoreboard";
import { Minimap, MinimapData } from "./Minimap";
import { PerfIndicators } from "./PerfIndicators";
import { KillFeed, DeathOverlay } from "./KillFeedAndDeath";
import { VirtualControls } from "./VirtualControls";
import { Shop } from "./Shop";
import { setSfxMuted } from "../lib/sfx";
import { isTouchDevice } from "../lib/device";

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
    coins: 0,
    state: "alive",
    equippedWeapon: "pistol",
    ownedWeapons: ["pistol"] as string[],
    bombs: 0,
  });
  const [shopOpen, setShopOpen] = useState(false);
  const [scoreboard, setScoreboard] = useState<{ id: string; name: string; score: number; kills: number }[]>([]);
  const [ping, setPing] = useState(0);
  const [fps, setFps] = useState(60);
  const [minimap, setMinimap] = useState<MinimapData | null>(null);
  const [killFeed, setKillFeed] = useState<{ id: number; text: string }[]>([]);
  const [deathInfo, setDeathInfo] = useState<{ byName: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [waveInfo, setWaveInfo] = useState<{ wave: number; waveState: string; waveEndsOrStartsAt: number } | null>(
    null
  );
  const killFeedId = useRef(0);

  useEffect(() => {
    setIsMobile(isTouchDevice());
  }, []);

  const getArenaScene = () => {
    const scene = sceneRef.current ?? gameRef.current?.scene.getScene("ArenaScene");
    if (scene) {
      sceneRef.current = scene;
    }
    return scene as any;
  };

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
        onWaveUpdate: setWaveInfo,
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
      const game = gameRef.current;
      if (game) {
        try {
          const gl = (game.renderer as any)?.gl;
          gl?.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {
          // best-effort only
        }
        game.destroy(true, false);
      }
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  useEffect(() => {
    if (killFeed.length === 0) return;
    const t = setTimeout(() => setKillFeed((prev) => prev.slice(0, -1)), 4000);
    return () => clearTimeout(t);
  }, [killFeed]);

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
        coins={self.coins}
        bombs={self.bombs}
        raised
      />
      <Scoreboard entries={scoreboard} selfId={room.sessionId} />
      <Minimap data={minimap} raised />
      <PerfIndicators ping={ping} fps={fps} waveInfo={waveInfo} />
      <KillFeed messages={killFeed} />

      {isMobile && (
        <VirtualControls
          onMove={(dir) => getArenaScene()?.setVirtualMove?.(dir)}
          onMoveEnd={() => getArenaScene()?.clearVirtualMove?.()}
          onFire={() => getArenaScene()?.virtualFire?.()}
          onFireHeld={(held) => getArenaScene()?.setVirtualFireHeld?.(held)}
          onSlide={() => getArenaScene()?.virtualSlide?.()}
          onBombAim={(aiming) => getArenaScene()?.setBombAiming?.(aiming)}
          onBombThrow={() => getArenaScene()?.throwBomb?.()}
          bombCount={self.bombs}
        />
      )}

      <button
        onClick={() => setShopOpen(true)}
        className="absolute top-1/2 -translate-y-1/2 right-2 sm:right-4 safe-right px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-arena-panel/80 backdrop-blur border border-white/10 text-[11px] sm:text-xs font-semibold text-white/80 hover:text-white hover:bg-yellow-500/30 transition-colors flex items-center gap-1 sm:gap-1.5 z-20"
      >
        🛒 Shop
      </button>

      <Shop
        open={shopOpen}
        coins={self.coins}
        ownedWeapons={self.ownedWeapons}
        equippedWeapon={self.equippedWeapon}
        onBuy={(weaponId) => {
          room.send(MSG.BUY_WEAPON, weaponId);
          // Optimistic: don't wait for the server patch to round-trip
          // before the gun overlay / Shop UI reflect the new weapon.
          setSelf((s) => ({
            ...s,
            equippedWeapon: weaponId,
            ownedWeapons: s.ownedWeapons.includes(weaponId) ? s.ownedWeapons : [...s.ownedWeapons, weaponId],
          }));
          getArenaScene()?.setEquippedWeaponPreview?.(weaponId);
        }}
        onEquip={(weaponId) => {
          room.send(MSG.EQUIP_WEAPON, weaponId);
          setSelf((s) => ({ ...s, equippedWeapon: weaponId }));
          getArenaScene()?.setEquippedWeaponPreview?.(weaponId);
        }}
        onClose={() => setShopOpen(false)}
      />

      <button
        onClick={handleExit}
        className="absolute top-2 sm:top-4 left-2 sm:left-4 safe-top safe-left px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-arena-panel/80 backdrop-blur border border-white/10 text-[11px] sm:text-xs font-semibold text-white/80 hover:text-white hover:bg-arena-danger/70 transition-colors z-20"
      >
        ← <span className="hidden sm:inline">Exit to Lobby</span>
        <span className="sm:hidden">Exit</span>
      </button>

      <button
        onClick={toggleMute}
        className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 safe-top w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-arena-panel/80 backdrop-blur border border-white/10 flex items-center justify-center text-sm sm:text-base text-white/80 hover:text-white transition-colors z-20"
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
