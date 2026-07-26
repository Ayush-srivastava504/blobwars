// Factory that boots a Phaser game instance for the arena.
// Configures renderer, canvas sizing, and physics, then starts
// ArenaScene with the Colyseus room and React UI callbacks.
// Called once by GameCanvas when the lobby hands off to gameplay.
import * as Phaser from "phaser";
import type { Room } from "colyseus.js";
import { ArenaScene, GameUICallbacks } from "./scenes/ArenaScene";

export function createGame(parent: HTMLDivElement, room: Room, ui: GameUICallbacks): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
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
