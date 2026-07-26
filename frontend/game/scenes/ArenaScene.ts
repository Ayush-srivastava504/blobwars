// Main Phaser scene: renders the arena, players, food, and obstacles
// from Colyseus room state, and sends local input back to the server.
// Handles client-side prediction/reconciliation, remote interpolation,
// shadows/animations/particles/SFX polish, and joystick + mouse input.
import * as Phaser from "phaser";
import { Room, getStateCallbacks } from "colyseus.js";
import {
  WORLD,
  SIM,
  massToRadius,
  stepPosition,
  MSG,
} from "@blobwars/shared";
import type { InputMessage } from "@blobwars/shared";
import { playEat, playHit, playKill, playDeath, playRespawn, playLevelUp } from "../../lib/sfx";

interface PendingInput extends InputMessage {}

interface RemoteVisual {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  circle: Phaser.GameObjects.Arc;
  nameText: Phaser.GameObjects.Text;
  healthBarBg: Phaser.GameObjects.Rectangle;
  healthBarFill: Phaser.GameObjects.Rectangle;
  targetX: number;
  targetY: number;
  targetMass: number;
  wasAlive: boolean;
}

export interface GameUICallbacks {
  onSelfUpdate: (data: {
    health: number;
    maxHealth: number;
    mass: number;
    level: number;
    xp: number;
    xpNeeded: number;
    score: number;
    state: string;
  }) => void;
  onScoreboard: (entries: { id: string; name: string; score: number; kills: number }[]) => void;
  onPing: (ms: number) => void;
  onFps: (fps: number) => void;
  onKilled: (byName: string) => void;
  onKillFeed: (text: string) => void;
  onMinimap: (
    self: { x: number; y: number },
    others: { x: number; y: number; color: number }[]
  ) => void;
}

export class ArenaScene extends Phaser.Scene {
  private room!: Room;
  private sessionId!: string;
  private ui!: GameUICallbacks;

  private remotePlayers = new Map<string, RemoteVisual>();
  private foodVisuals = new Map<string, Phaser.GameObjects.Arc>();
  private obstacleVisuals = new Map<string, Phaser.GameObjects.Arc>();

  private selfShadow?: Phaser.GameObjects.Ellipse;
  private selfCircle?: Phaser.GameObjects.Arc;
  private selfContainer?: Phaser.GameObjects.Container;
  private selfWasAlive = true;
  private selfLevel = 1;
  private selfHealth = 100;

  private inputSeq = 0;
  private pendingInputs: PendingInput[] = [];
  private lastSentAt = 0;
  private lastPingAt = 0;

  private fpsAccum = 0;
  private fpsFrames = 0;

  private joystickDir = { x: 0, y: 0 };

  constructor() {
    super("ArenaScene");
  }

  init(data: { room: Room; ui: GameUICallbacks }) {
    this.room = data.room;
    this.sessionId = data.room.sessionId;
    this.ui = data.ui;
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    this.physics.world.setBounds(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    this.drawGrid();

    const $ = getStateCallbacks(this.room);

    $(this.room.state).obstacles.onAdd((obstacle) => {
      const circle = this.add.circle(obstacle.x, obstacle.y, obstacle.radius, 0x2c3345, 1);
      circle.setStrokeStyle(3, 0x3d4560);
      this.obstacleVisuals.set(obstacle.id, circle);
    });

    $(this.room.state).food.onAdd((food) => {
      const circle = this.add.circle(food.x, food.y, food.mass + 2, food.color, 1);
      this.foodVisuals.set(food.id, circle);
      this.tweens.add({
        targets: circle,
        scale: { from: 1, to: 1.25 },
        duration: 700 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 500,
        ease: "Sine.easeInOut",
      });
    });
    $(this.room.state).food.onRemove((food, id) => {
      const circle = this.foodVisuals.get(id);
      circle?.destroy();
      this.foodVisuals.delete(id);
      this.handlePossibleSelfFoodPickup(food.x, food.y);
    });

    $(this.room.state).players.onAdd((player, sessionId) => {
      if (sessionId === this.sessionId) {
        this.createSelfVisual(player.x, player.y, player.mass, player.color);
        this.selfWasAlive = player.state === "alive";
        this.selfLevel = player.level;
        this.selfHealth = player.health;
      } else {
        this.createRemoteVisual(sessionId, player.x, player.y, player.mass, player.color, player.name, player.state === "alive");
      }

      $(player).onChange(() => {
        if (sessionId === this.sessionId) {
          this.reconcileSelf(player.x, player.y, player.mass, player.lastProcessedInputSeq, player.state);
          this.handleSelfStateTransition(player.state);
          if (player.state === "alive" && player.health < this.selfHealth) {
            playHit();
          }
          this.selfHealth = player.health;
          if (player.level > this.selfLevel) {
            this.selfLevel = player.level;
            playLevelUp();
            this.spawnFloatingText(player.x, player.y - 40, `Level ${player.level}!`, "#a970ff");
          }
          this.ui.onSelfUpdate({
            health: player.health,
            maxHealth: player.maxHealth,
            mass: player.mass,
            level: player.level,
            xp: player.xp,
            xpNeeded: Math.floor(100 * Math.pow(1.15, player.level - 1)),
            score: player.score,
            state: player.state,
          });
        } else {
          const rv = this.remotePlayers.get(sessionId);
          if (rv) {
            rv.targetX = player.x;
            rv.targetY = player.y;
            rv.targetMass = player.mass;
            rv.nameText.setText(player.name);
            this.handleRemoteStateTransition(rv, player.state === "alive", player.x, player.y, player.color);
          }
        }
        this.refreshScoreboard();
      });
    });

    $(this.room.state).players.onRemove((_player, sessionId) => {
      const rv = this.remotePlayers.get(sessionId);
      rv?.container.destroy();
      this.remotePlayers.delete(sessionId);
      this.refreshScoreboard();
    });

    this.room.onMessage(MSG.KILLED, (data: { by: string }) => {
      const self = this.room.state.players.get(this.sessionId);
      if (self) this.spawnDeathBurst(self.x, self.y, self.color);
      playDeath();
      this.cameras.main.shake(220, 0.008);
      this.ui.onKilled(data.by);
    });
    this.room.onMessage(MSG.KILL_FEED, (data: { victim: string; killer: string }) => {
      this.ui.onKillFeed(`${data.killer} eliminated ${data.victim}`);
      const self = this.room.state.players.get(this.sessionId);
      if (self && data.killer === self.name) {
        playKill();
        this.spawnFloatingText(self.x, self.y - 40, "+50", "#ff4f5e");
      }
    });
    this.room.onMessage(MSG.PONG, (sentAt: number) => this.ui.onPing(Date.now() - sentAt));

    this.input.mouse?.disableContextMenu();
    this.time.addEvent({ delay: 2000, loop: true, callback: () => this.sendPing() });
  }

  setJoystickDirection(x: number, y: number) {
    this.joystickDir = { x, y };
  }

  private drawGrid() {
    const g = this.add.graphics();
    g.lineStyle(1, 0x1c2233, 1);
    const step = 100;
    for (let x = 0; x <= WORLD.WIDTH; x += step) g.lineBetween(x, 0, x, WORLD.HEIGHT);
    for (let y = 0; y <= WORLD.HEIGHT; y += step) g.lineBetween(0, y, WORLD.WIDTH, y);

    const border = this.add.graphics();
    border.lineStyle(6, 0xff4f5e, 0.6);
    border.strokeRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  private createSelfVisual(x: number, y: number, mass: number, color: number) {
    const radius = massToRadius(mass);
    this.selfShadow = this.add.ellipse(0, radius * 0.55, radius * 1.6, radius * 0.7, 0x000000, 0.25);
    this.selfCircle = this.add.circle(0, 0, radius, color, 1).setStrokeStyle(3, 0xffffff, 0.9);
    this.selfContainer = this.add.container(x, y, [this.selfShadow, this.selfCircle]);
    this.cameras.main.startFollow(this.selfContainer, true, 0.12, 0.12);
  }

  private createRemoteVisual(
    sessionId: string,
    x: number,
    y: number,
    mass: number,
    color: number,
    name: string,
    alive: boolean
  ) {
    const radius = massToRadius(mass);
    const shadow = this.add.ellipse(0, radius * 0.55, radius * 1.6, radius * 0.7, 0x000000, 0.25);
    const circle = this.add.circle(0, 0, radius, color, 1).setStrokeStyle(2, 0xffffff, 0.6);
    const nameText = this.add
      .text(0, -radius - 16, name, { fontSize: "13px", color: "#ffffff", fontFamily: "Rubik, sans-serif" })
      .setOrigin(0.5);
    const healthBarBg = this.add.rectangle(0, -radius - 6, 40, 5, 0x000000, 0.5);
    const healthBarFill = this.add.rectangle(-20, -radius - 6, 40, 5, 0x2ecc71, 1).setOrigin(0, 0.5);

    const container = this.add.container(x, y, [shadow, circle, healthBarBg, healthBarFill, nameText]);
    container.setAlpha(alive ? 1 : 0.15);
    this.remotePlayers.set(sessionId, {
      container,
      shadow,
      circle,
      nameText,
      healthBarBg,
      healthBarFill,
      targetX: x,
      targetY: y,
      targetMass: mass,
      wasAlive: alive,
    });
  }

  private handleSelfStateTransition(state: string) {
    const alive = state === "alive";
    if (this.selfWasAlive && !alive) {
      this.selfContainer?.setAlpha(0.15);
    } else if (!this.selfWasAlive && alive) {
      this.selfContainer?.setAlpha(1);
      playRespawn();
    }
    this.selfWasAlive = alive;
  }

  private handleRemoteStateTransition(rv: RemoteVisual, alive: boolean, x: number, y: number, color: number) {
    if (rv.wasAlive && !alive) {
      this.spawnDeathBurst(x, y, color);
      this.tweens.add({ targets: rv.container, alpha: 0.15, duration: 250 });
    } else if (!rv.wasAlive && alive) {
      this.tweens.add({ targets: rv.container, alpha: 1, duration: 250 });
    }
    rv.wasAlive = alive;
  }

  private spawnDeathBurst(x: number, y: number, color: number) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 60 + Math.random() * 60;
      const particle = this.add.circle(x, y, 4 + Math.random() * 4, color, 0.9);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.2,
        duration: 500 + Math.random() * 200,
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string) {
    const label = this.add
      .text(x, y, text, { fontSize: "16px", fontStyle: "bold", color, fontFamily: "Rubik, sans-serif" })
      .setOrigin(0.5)
      .setShadow(0, 1, "#000000", 2);
    this.tweens.add({
      targets: label,
      y: y - 40,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private handlePossibleSelfFoodPickup(foodX: number, foodY: number) {
    const self = this.room.state.players.get(this.sessionId);
    if (!self || self.state !== "alive") return;
    const radius = massToRadius(self.mass);
    const dist = Math.hypot(self.x - foodX, self.y - foodY);
    if (dist <= radius + 12) {
      playEat();
      this.spawnFloatingText(foodX, foodY, "+1", "#2ecc71");
    }
  }

  private getInputDirection(): { x: number; y: number } {
    if (this.joystickDir.x !== 0 || this.joystickDir.y !== 0) {
      return this.joystickDir;
    }
    const pointer = this.input.activePointer;
    const cam = this.cameras.main;
    const centerX = cam.width / 2;
    const centerY = cam.height / 2;
    const dx = pointer.x - centerX;
    const dy = pointer.y - centerY;
    const len = Math.hypot(dx, dy);
    if (len < 8) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  private sendPing() {
    this.lastPingAt = Date.now();
    this.room.send(MSG.PING, this.lastPingAt);
  }

  update(_time: number, delta: number) {
    this.trackFps(delta);

    if (this.selfContainer && this.room.state.players.get(this.sessionId)?.state === "alive") {
      const dir = this.getInputDirection();
      const now = Date.now();

      const sendInterval = 1000 / SIM.TICK_RATE;
      if (now - this.lastSentAt >= sendInterval) {
        this.lastSentAt = now;
        const input: PendingInput = { seq: ++this.inputSeq, dirX: dir.x, dirY: dir.y, boost: false, timestamp: now };
        this.room.send(MSG.INPUT, input);
        this.pendingInputs.push(input);
        if (this.pendingInputs.length > 60) this.pendingInputs.shift();

        const player = this.room.state.players.get(this.sessionId);
        if (player) {
          const next = stepPosition(this.selfContainer.x, this.selfContainer.y, dir.x, dir.y, player.mass, sendInterval / 1000);
          this.selfContainer.setPosition(next.x, next.y);
          const radius = massToRadius(player.mass);
          this.selfCircle?.setRadius(radius);
          this.selfShadow?.setSize(radius * 1.6, radius * 0.7).setY(radius * 0.55);
        }
      }
    }

    const lerpFactor = Math.min(1, delta / 100);
    for (const rv of this.remotePlayers.values()) {
      rv.container.x = Phaser.Math.Linear(rv.container.x, rv.targetX, lerpFactor);
      rv.container.y = Phaser.Math.Linear(rv.container.y, rv.targetY, lerpFactor);
      const radius = massToRadius(rv.targetMass);
      rv.circle.setRadius(radius);
      rv.shadow.setSize(radius * 1.6, radius * 0.7).setY(radius * 0.55);
      rv.nameText.setY(-radius - 16);
      rv.healthBarBg.setY(-radius - 6);
      rv.healthBarFill.setY(-radius - 6);
    }

    this.emitMinimap();
  }

  private reconcileSelf(serverX: number, serverY: number, mass: number, lastProcessedSeq: number, state: string) {
    if (!this.selfContainer) return;
    if (state !== "alive") {
      this.selfContainer.setPosition(serverX, serverY);
      return;
    }

    this.pendingInputs = this.pendingInputs.filter((i) => i.seq > lastProcessedSeq);

    let x = serverX;
    let y = serverY;
    const dt = 1 / SIM.TICK_RATE;
    for (const input of this.pendingInputs) {
      const next = stepPosition(x, y, input.dirX, input.dirY, mass, dt);
      x = next.x;
      y = next.y;
    }

    this.selfContainer.setPosition(x, y);
    this.selfCircle?.setRadius(massToRadius(mass));
  }

  private refreshScoreboard() {
    const entries = Array.from(this.room.state.players.values())
      .map((p: any) => ({ id: p.id, name: p.name, score: p.score, kills: p.kills }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    this.ui.onScoreboard(entries);
  }

  private emitMinimap() {
    const self = this.room.state.players.get(this.sessionId);
    if (!self) return;
    const others = Array.from(this.remotePlayers.entries()).map(([id, rv]) => ({
      x: rv.container.x,
      y: rv.container.y,
      color: this.room.state.players.get(id)?.color ?? 0xffffff,
    }));
    this.ui.onMinimap({ x: self.x, y: self.y }, others);
  }

  private trackFps(delta: number) {
    this.fpsAccum += delta;
    this.fpsFrames += 1;
    if (this.fpsAccum >= 500) {
      const fps = Math.round((this.fpsFrames * 1000) / this.fpsAccum);
      this.ui.onFps(fps);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }
  }

  requestRespawn() {
    this.room.send(MSG.RESPAWN);
  }
}
