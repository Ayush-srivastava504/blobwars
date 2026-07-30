// Factory that boots a Phaser game instance for the arena.
// Configures renderer, canvas sizing, and physics, then starts
// ArenaScene with the Colyseus room and React UI callbacks.
// Called once by GameCanvas when the lobby hands off to gameplay.
import * as Phaser from "phaser";
import type { Room } from "colyseus.js";
import { ArenaScene, GameUICallbacks } from "./scenes/ArenaScene";

export function createGame(parent: HTMLDivElement, room: Room, ui: GameUICallbacks): Phaser.Game {
  const game = new Phaser.Game({
    // AUTO tries WebGL first but falls back to Canvas2D if a WebGL context
    // can't be created — important on repeat play sessions, since the
    // previous game's WebGL context may not be reclaimed by the browser/GPU
    // process instantly, and forcing WEBGL would otherwise render a blank
    // black canvas instead of gracefully falling back.
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#0b0e14",
    fps: { target: 60, forceSetTimeOut: false },
    physics: { default: "arcade" },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [ArenaScene],
  });

  game.scene.start("ArenaScene", { room, ui });
  return game;
}
