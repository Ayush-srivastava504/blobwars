// Authoritative Colyseus room for one arena match: owns the fixed-rate
// simulation loop, movement, obstacle collision, food pickup, and
// player-vs-player combat/kill handling. Broadcasts state to clients
// at a lower patch rate and records match results to the database.
import { Room, Client } from "@colyseus/core";
import { nanoid } from "nanoid";
import { ArenaState, PlayerSchema, FoodSchema, ObstacleSchema } from "./schema/ArenaState";
import {
  WORLD,
  SIM,
  PLAYER,
  FOOD,
  OBSTACLES,
  SPAWN_POINTS,
  ROOM,
  XP,
  MSG,
  stepPosition,
  massToRadius,
  circlesOverlap,
} from "@blobwars/shared";
import type { InputMessage } from "@blobwars/shared";
import { recordMatchPlayerResult } from "../db/matchRepository";

interface PendingInput extends InputMessage {}

const COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1];

export class ArenaRoom extends Room<ArenaState> {
  maxClients = ROOM.MAX_PLAYERS;

  private inputQueues = new Map<string, PendingInput[]>();
  private lastDir = new Map<string, { x: number; y: number }>();
  private matchId: string | null = null;
  private colorCursor = 0;

  async onCreate(options: { isPrivate?: boolean; code?: string; name?: string }) {
    this.setState(new ArenaState());
    this.setMetadata({
      isPrivate: !!options?.isPrivate,
      code: options?.code ?? null,
      name: options?.name ?? "Public Arena",
    });
    this.seedObstacles();
    this.seedFood();

    this.onMessage(MSG.INPUT, (client, message: InputMessage) => {
      const queue = this.inputQueues.get(client.sessionId);
      if (queue) {
          if (queue.length < 12) queue.push(message);
      }
    });

    this.onMessage(MSG.RESPAWN, (client) => {
      this.respawnPlayer(client.sessionId);
    });

    this.onMessage(MSG.PING, (client, ts: number) => {
      client.send(MSG.PONG, ts);
    });

    const dt = 1000 / SIM.TICK_RATE;
    this.setSimulationInterval(() => this.tick(dt / 1000), dt);

    this.setPatchRate(1000 / SIM.PATCH_RATE);

    try {
      this.matchId = await this.createMatchRecord();
    } catch {
      this.matchId = null;
    }
  }

  private seedObstacles() {
    OBSTACLES.forEach((o, i) => {
      const s = new ObstacleSchema();
      s.id = `obs_${i}`;
      s.x = o.x;
      s.y = o.y;
      s.radius = o.radius;
      this.state.obstacles.set(s.id, s);
    });
  }

  private seedFood() {
    for (let i = 0; i < FOOD.COUNT; i++) {
      this.spawnFood();
    }
  }

  private spawnFood() {
    const pos = this.randomFreePosition(FOOD.RADIUS);
    const f = new FoodSchema();
    f.id = nanoid(8);
    f.x = pos.x;
    f.y = pos.y;
    f.mass = FOOD.MASS;
    f.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.state.food.set(f.id, f);
  }

  private randomFreePosition(radius: number): { x: number; y: number } {
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = WORLD.BOUNDARY_PADDING + radius + Math.random() * (WORLD.WIDTH - 2 * (WORLD.BOUNDARY_PADDING + radius));
      const y = WORLD.BOUNDARY_PADDING + radius + Math.random() * (WORLD.HEIGHT - 2 * (WORLD.BOUNDARY_PADDING + radius));
      const collides = OBSTACLES.some((o) => circlesOverlap(x, y, radius, o.x, o.y, o.radius));
      if (!collides) return { x, y };
    }
    return { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 };
  }

  onJoin(client: Client, options: { name?: string; userId?: string }) {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = (options?.name || `Guest${Math.floor(Math.random() * 9999)}`).slice(0, 16);
    player.color = COLORS[this.colorCursor++ % COLORS.length];
    this.placeAtSpawn(player);
    player.mass = PLAYER.START_MASS;
    player.health = PLAYER.START_HEALTH;
    player.maxHealth = PLAYER.MAX_HEALTH;
    player.state = "alive";
    player.spawnProtectedUntil = Date.now() + PLAYER.INVULNERABLE_MS_AFTER_SPAWN;

    this.state.players.set(client.sessionId, player);
    this.inputQueues.set(client.sessionId, []);
    this.lastDir.set(client.sessionId, { x: 0, y: 0 });
  }

  private placeAtSpawn(player: PlayerSchema) {
    const sp = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
    player.x = sp.x;
    player.y = sp.y;
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    try {
      if (!consented) {
        await this.allowReconnection(client, 20);
        return;
      }
    } catch {
    }

    if (player && this.matchId) {
      recordMatchPlayerResult(this.matchId, {
        userId: null,
        guestName: player.name,
        kills: player.kills,
        deaths: player.deaths,
        finalScore: player.score,
        finalMass: Math.round(player.mass),
      }).catch(() => {});
    }

    this.state.players.delete(client.sessionId);
    this.inputQueues.delete(client.sessionId);
    this.lastDir.delete(client.sessionId);
  }

  onDispose() {
  }

  private respawnPlayer(sessionId: string) {
    const player = this.state.players.get(sessionId);
    if (!player || player.state === "alive") return;
    this.placeAtSpawn(player);
    player.mass = PLAYER.START_MASS;
    player.health = PLAYER.START_HEALTH;
    player.state = "alive";
    player.spawnProtectedUntil = Date.now() + PLAYER.INVULNERABLE_MS_AFTER_SPAWN;
  }

  private tick(dtSeconds: number) {
    this.state.serverTime = Date.now();

    for (const [sessionId, player] of this.state.players) {
      if (player.state !== "alive") continue;

      const queue = this.inputQueues.get(sessionId);
      let dir = this.lastDir.get(sessionId) ?? { x: 0, y: 0 };

      if (queue && queue.length > 0) {
        for (const input of queue) {
          dir = { x: input.dirX, y: input.dirY };
          player.lastProcessedInputSeq = input.seq;
        }
        queue.length = 0;
        this.lastDir.set(sessionId, dir);
      }

      const next = stepPosition(player.x, player.y, dir.x, dir.y, player.mass, dtSeconds);

      const radius = massToRadius(player.mass);
      let resolvedX = next.x;
      let resolvedY = next.y;
      for (const obstacle of this.state.obstacles.values()) {
        if (circlesOverlap(resolvedX, resolvedY, radius, obstacle.x, obstacle.y, obstacle.radius)) {
          const dx = resolvedX - obstacle.x;
          const dy = resolvedY - obstacle.y;
          const dist = Math.hypot(dx, dy) || 1;
          const overlap = radius + obstacle.radius - dist;
          resolvedX += (dx / dist) * overlap;
          resolvedY += (dy / dist) * overlap;
        }
      }

      player.x = resolvedX;
      player.y = resolvedY;
    }

    this.handleFoodCollisions();
    this.handlePlayerCombat();
  }

  private handleFoodCollisions() {
    for (const player of this.state.players.values()) {
      if (player.state !== "alive") continue;
      const radius = massToRadius(player.mass);

      for (const [foodId, food] of this.state.food) {
        if (circlesOverlap(player.x, player.y, radius, food.x, food.y, FOOD.RADIUS)) {
          player.mass = Math.min(player.mass + food.mass, PLAYER.MAX_MASS);
          this.addXp(player, XP.PER_FOOD);
          player.score += 1;
          this.state.food.delete(foodId);
          this.scheduleFoodRespawn();
        }
      }
    }
  }

  private scheduleFoodRespawn() {
    this.clock.setTimeout(() => {
      if (this.state.food.size < FOOD.COUNT) this.spawnFood();
    }, FOOD.RESPAWN_MS);
  }

  private handlePlayerCombat() {
    const players = Array.from(this.state.players.entries()).filter(([, p]) => p.state === "alive");

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const [idA, a] = players[i];
        const [idB, b] = players[j];
        const now = Date.now();
        if (now < a.spawnProtectedUntil || now < b.spawnProtectedUntil) continue;

        const ra = massToRadius(a.mass);
        const rb = massToRadius(b.mass);
        if (!circlesOverlap(a.x, a.y, ra, b.x, b.y, rb)) continue;

        const [big, small, bigId, smallId] = a.mass >= b.mass ? [a, b, idA, idB] : [b, a, idB, idA];
        const massDiff = big.mass - small.mass;
        if (massDiff <= 0) continue;

        const damage = massDiff * PLAYER.DAMAGE_PER_MASS_DIFF;
        small.health = Math.max(0, small.health - damage);

        if (small.health <= 0) {
          this.killPlayer(smallId, bigId);
        }
      }
    }
  }

  private killPlayer(victimId: string, killerId: string) {
    const victim = this.state.players.get(victimId);
    const killer = this.state.players.get(killerId);
    if (!victim) return;

    victim.state = "dead";
    victim.deaths += 1;

    if (killer) {
      const gainedMass = victim.mass * 0.5;
      killer.mass = Math.min(killer.mass + gainedMass, PLAYER.MAX_MASS);
      killer.kills += 1;
      killer.score += 50;
      this.addXp(killer, XP.PER_KILL);
    }

    this.broadcast(MSG.KILL_FEED, {
      victim: victim.name,
      killer: killer?.name ?? "the arena",
    });

    const client = this.clients.find((c) => c.sessionId === victimId);
    client?.send(MSG.KILLED, { by: killer?.name ?? "the arena" });

    this.clock.setTimeout(() => {
      if (this.state.players.has(victimId)) {
        this.respawnPlayer(victimId);
      }
    }, PLAYER.RESPAWN_DELAY_MS);
  }

  private addXp(player: PlayerSchema, amount: number) {
    player.xp += amount;
    const needed = Math.floor(XP.LEVEL_BASE * Math.pow(XP.LEVEL_GROWTH, player.level - 1));
    if (player.xp >= needed) {
      player.xp -= needed;
      player.level += 1;
    }
  }

  private async createMatchRecord(): Promise<string | null> {
    try {
      const { createMatchForRoom } = await import("../db/matchRepository");
      return await createMatchForRoom(this.roomId, ROOM.NAME);
    } catch {
      return null;
    }
  }
}
