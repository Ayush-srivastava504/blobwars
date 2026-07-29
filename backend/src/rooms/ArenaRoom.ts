// Authoritative Colyseus room for one arena match: owns the fixed-rate
// simulation loop, movement, obstacle collision, food pickup, and
// player-vs-player combat/kill handling. Broadcasts state to clients
// at a lower patch rate and records match results to the database.
import { Room, Client } from "@colyseus/core";
import { nanoid } from "nanoid";
import { ArenaState, PlayerSchema, FoodSchema, ObstacleSchema, ZombieSchema, BulletSchema, CrateSchema, BombSchema } from "./schema/ArenaState";
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
  ZOMBIE,
  WAVE,
  BULLET,
  WEAPONS,
  SLIDE,
  CRATE,
  BOMB,
  stepPosition,
  massToRadius,
  circlesOverlap,
  distance,
} from "@blobwars/shared";
import type { InputMessage, ShootMessage, ThrowBombMessage } from "@blobwars/shared";
import { recordMatchPlayerResult } from "../db/matchRepository";

interface PendingInput extends InputMessage {}

function getWeapon(id: string) {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
}

const COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1];

export class ArenaRoom extends Room<ArenaState> {
  maxClients = ROOM.MAX_PLAYERS;

  private inputQueues = new Map<string, PendingInput[]>();
  private lastDir = new Map<string, { x: number; y: number }>();
  private nextShotAllowedAt = new Map<string, number>();
  private nextSlideAllowedAt = new Map<string, number>();
  private matchId: string | null = null;
  private colorCursor = 0;
  private bulletSpawnedAt = new Map<string, number>();
  private bombStart = new Map<string, { x: number; y: number }>();

  async onCreate(options: { isPrivate?: boolean; code?: string; name?: string }) {
    this.setState(new ArenaState());
    this.setMetadata({
      isPrivate: !!options?.isPrivate,
      code: options?.code ?? null,
      name: options?.name ?? "Public Arena",
    });
    this.seedObstacles();
    this.seedFood();
    this.state.waveState = "intermission";
    this.state.waveEndsOrStartsAt = Date.now() + WAVE.FIRST_WAVE_DELAY_MS;

    this.onMessage(MSG.INPUT, (client, message: InputMessage) => {
      console.log("INPUT RECEIVED:", message);
      const queue = this.inputQueues.get(client.sessionId);
      if (queue && queue.length < 12) {
        queue.push(message);
      }
    });

    this.onMessage(MSG.SHOOT, (client, message: ShootMessage) => {
      this.handleShoot(client.sessionId, message);
    });

    this.onMessage(MSG.RESPAWN, (client) => {
      this.respawnPlayer(client.sessionId);
    });

    this.onMessage(MSG.PING, (client, ts: number) => {
      client.send(MSG.PONG, ts);
    });

    this.onMessage(MSG.BUY_WEAPON, (client, weaponId: string) => {
      this.handleBuyWeapon(client, weaponId);
    });

    this.onMessage(MSG.EQUIP_WEAPON, (client, weaponId: string) => {
      this.handleEquipWeapon(client, weaponId);
    });

    this.onMessage(MSG.SLIDE, (client) => {
      this.handleSlide(client.sessionId);
    });

    this.onMessage(MSG.THROW_BOMB, (client, message: ThrowBombMessage) => {
      this.handleThrowBomb(client.sessionId, message);
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
    player.equippedWeapon = "pistol";
    // ownedWeapons already defaults to ["pistol"] from the schema field init.

    this.state.players.set(client.sessionId, player);
    this.inputQueues.set(client.sessionId, []);
    this.lastDir.set(client.sessionId, { x: 0, y: 0 });
    this.nextShotAllowedAt.set(client.sessionId, 0);
    this.nextSlideAllowedAt.set(client.sessionId, 0);
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
    this.nextShotAllowedAt.delete(client.sessionId);
    this.nextSlideAllowedAt.delete(client.sessionId);
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
    // A thrown error in here previously meant the whole fixed-rate simulation
    // loop for this room could stop advancing (no player movement resolution,
    // no zombie AI, no wave spawns) for every client in the room, with no
    // obvious symptom other than everything appearing frozen. Isolate each
    // tick so one bad frame logs and gets skipped instead of stalling the
    // whole room permanently.
    try {
      this.runTick(dtSeconds);
    } catch (err) {
      console.error("[ArenaRoom] tick() failed, skipping this frame:", err);
    }
  }

  private runTick(dtSeconds: number) {
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
    this.updateWaves();
    this.updateZombies(dtSeconds);
    this.handleZombieCombat();
    this.updateBullets(dtSeconds);
    this.handleCrateCollisions();
    this.updateBombs(dtSeconds);
  }

  // ---- Shooting (fire-button bullets, zombies-only PvE damage) ----

  private handleShoot(sessionId: string, message: ShootMessage) {
    const player = this.state.players.get(sessionId);
    if (!player || player.state !== "alive") return;

    const weapon = getWeapon(player.equippedWeapon);
    const now = Date.now();
    const allowedAt = this.nextShotAllowedAt.get(sessionId) ?? 0;
    if (now < allowedAt) return;
    this.nextShotAllowedAt.set(sessionId, now + weapon.cooldownMs);

    const len = Math.hypot(message.dirX, message.dirY) || 1;
    const dirX = message.dirX / len;
    const dirY = message.dirY / len;
    const radius = massToRadius(player.mass);

    const bullet = new BulletSchema();
    bullet.id = nanoid(8);
    bullet.ownerId = sessionId;
    bullet.x = player.x + dirX * (radius + 4);
    bullet.y = player.y + dirY * (radius + 4);
    bullet.dirX = dirX;
    bullet.dirY = dirY;
    bullet.damage = weapon.damage;
    this.state.bullets.set(bullet.id, bullet);
    this.bulletSpawnedAt.set(bullet.id, now);
  }

  // ---- Coin shop: buy/equip guns with coins earned from zombie kills ----

  private handleBuyWeapon(client: Client, weaponId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const weapon = WEAPONS.find((w) => w.id === weaponId);
    if (!weapon) return;

    if (player.ownedWeapons.includes(weapon.id)) {
      // Already owned — just equip it instead of erroring.
      player.equippedWeapon = weapon.id;
      return;
    }
    if (player.coins < weapon.price) {
      client.send(MSG.SHOP_ERROR, { reason: "not_enough_coins", weaponId: weapon.id });
      return;
    }

    player.coins -= weapon.price;
    player.ownedWeapons.push(weapon.id);
    player.equippedWeapon = weapon.id;
  }

  private handleEquipWeapon(client: Client, weaponId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (!player.ownedWeapons.includes(weaponId)) return;
    player.equippedWeapon = weaponId;
  }

  // ---- Slide/dash mobility move (bound to the on-screen Slide button /
  // desktop Shift key alongside Fire — see VirtualControls + ArenaScene) ----

  private handleSlide(sessionId: string) {
    const player = this.state.players.get(sessionId);
    if (!player || player.state !== "alive") return;

    const now = Date.now();
    const allowedAt = this.nextSlideAllowedAt.get(sessionId) ?? 0;
    if (now < allowedAt) return;
    this.nextSlideAllowedAt.set(sessionId, now + SLIDE.COOLDOWN_MS);

    const dir = this.lastDir.get(sessionId) ?? { x: 0, y: 0 };
    const len = Math.hypot(dir.x, dir.y);
    const dirX = len > 0.01 ? dir.x / len : 1;
    const dirY = len > 0.01 ? dir.y / len : 0;

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    let nx = player.x + dirX * SLIDE.DISTANCE;
    let ny = player.y + dirY * SLIDE.DISTANCE;
    const radius = massToRadius(player.mass);
    nx = clamp(nx, WORLD.BOUNDARY_PADDING + radius, WORLD.WIDTH - WORLD.BOUNDARY_PADDING - radius);
    ny = clamp(ny, WORLD.BOUNDARY_PADDING + radius, WORLD.HEIGHT - WORLD.BOUNDARY_PADDING - radius);

    for (const obstacle of this.state.obstacles.values()) {
      if (circlesOverlap(nx, ny, radius, obstacle.x, obstacle.y, obstacle.radius)) {
        const dx = nx - obstacle.x;
        const dy = ny - obstacle.y;
        const dist = Math.hypot(dx, dy) || 1;
        const overlap = radius + obstacle.radius - dist;
        nx += (dx / dist) * overlap;
        ny += (dy / dist) * overlap;
      }
    }

    player.x = nx;
    player.y = ny;
  }

  private updateBullets(dtSeconds: number) {
    if (this.state.bullets.size === 0) return;
    const now = Date.now();

    for (const [bulletId, bullet] of this.state.bullets) {
      const spawnedAt = this.bulletSpawnedAt.get(bulletId) ?? now;
      if (now - spawnedAt >= BULLET.LIFETIME_MS) {
        this.removeBullet(bulletId);
        continue;
      }

      bullet.x += bullet.dirX * BULLET.SPEED * dtSeconds;
      bullet.y += bullet.dirY * BULLET.SPEED * dtSeconds;

      if (bullet.x < 0 || bullet.x > WORLD.WIDTH || bullet.y < 0 || bullet.y > WORLD.HEIGHT) {
        this.removeBullet(bulletId);
        continue;
      }

      let blocked = false;
      for (const obstacle of this.state.obstacles.values()) {
        if (circlesOverlap(bullet.x, bullet.y, BULLET.RADIUS, obstacle.x, obstacle.y, obstacle.radius)) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        this.removeBullet(bulletId);
        continue;
      }

      // Zombies only — bullets never damage other players (PvE weapon).
      for (const [zombieId, zombie] of this.state.zombies) {
        if (zombie.state !== "alive") continue;
        if (!circlesOverlap(bullet.x, bullet.y, BULLET.RADIUS, zombie.x, zombie.y, ZOMBIE.RADIUS)) continue;

        zombie.health = Math.max(0, zombie.health - bullet.damage);
        this.removeBullet(bulletId);
        if (zombie.health <= 0) {
          this.killZombie(zombieId, bullet.ownerId);
        }
        break;
      }
    }
  }

  private removeBullet(bulletId: string) {
    this.state.bullets.delete(bulletId);
    this.bulletSpawnedAt.delete(bulletId);
  }

  // ---- Wave spawner ----

  private updateWaves() {
    const now = Date.now();
    const aliveZombies = this.countAliveZombies();

    if (this.state.waveState === "intermission") {
      if (now >= this.state.waveEndsOrStartsAt) {
        this.startNextWave();
      }
      return;
    }

    // waveState === "active": once every zombie from this wave is dead, go to intermission.
    if (aliveZombies === 0) {
      this.state.waveState = "intermission";
      this.state.waveEndsOrStartsAt = now + WAVE.INTERMISSION_MS;
      this.broadcast(MSG.KILL_FEED, { victim: "", killer: `Wave ${this.state.wave} cleared!` });
      this.spawnCrate();
    }
  }

  // ---- Supply crate: dropped once per cleared wave. Grants a heal, a
  // handful of coins, and 2 throwable bombs to whichever player reaches it
  // first. ----

  private spawnCrate() {
    const pos = this.randomFreePosition(CRATE.RADIUS);
    const crate = new CrateSchema();
    crate.id = nanoid(8);
    crate.x = pos.x;
    crate.y = pos.y;
    this.state.crates.set(crate.id, crate);
  }

  private handleCrateCollisions() {
    if (this.state.crates.size === 0) return;

    for (const player of this.state.players.values()) {
      if (player.state !== "alive") continue;
      const radius = massToRadius(player.mass);

      for (const [crateId, crate] of this.state.crates) {
        if (!circlesOverlap(player.x, player.y, radius, crate.x, crate.y, CRATE.RADIUS)) continue;

        player.health = Math.min(player.maxHealth, player.health + CRATE.HEAL_AMOUNT);
        player.coins += Math.floor(CRATE.COINS_MIN + Math.random() * (CRATE.COINS_MAX - CRATE.COINS_MIN));
        player.bombs += CRATE.BOMBS_GRANTED;
        this.state.crates.delete(crateId);
        this.broadcast(MSG.KILL_FEED, { victim: "", killer: `${player.name} grabbed the supply crate!` });
        break;
      }
    }
  }

  // ---- Thrown bombs: fly in a straight line out to BOMB.MAX_RANGE (or
  // until they hit an obstacle/world edge), then explode dealing AOE
  // damage to zombies — same PvE-only pattern as bullets. ----

  private handleThrowBomb(sessionId: string, message: ThrowBombMessage) {
    const player = this.state.players.get(sessionId);
    if (!player || player.state !== "alive") return;
    if (player.bombs <= 0) return;

    const len = Math.hypot(message.dirX, message.dirY) || 1;
    const dirX = message.dirX / len;
    const dirY = message.dirY / len;
    const radius = massToRadius(player.mass);

    player.bombs -= 1;

    const bomb = new BombSchema();
    bomb.id = nanoid(8);
    bomb.ownerId = sessionId;
    bomb.x = player.x + dirX * (radius + 6);
    bomb.y = player.y + dirY * (radius + 6);
    bomb.dirX = dirX;
    bomb.dirY = dirY;
    this.state.bombs.set(bomb.id, bomb);
    this.bombStart.set(bomb.id, { x: bomb.x, y: bomb.y });
  }

  private updateBombs(dtSeconds: number) {
    if (this.state.bombs.size === 0) return;

    for (const [bombId, bomb] of this.state.bombs) {
      bomb.x += bomb.dirX * BOMB.SPEED * dtSeconds;
      bomb.y += bomb.dirY * BOMB.SPEED * dtSeconds;

      const start = this.bombStart.get(bombId);
      const traveled = start ? distance(bomb.x, bomb.y, start.x, start.y) : 0;

      let shouldExplode = traveled >= BOMB.MAX_RANGE;
      if (bomb.x < 0 || bomb.x > WORLD.WIDTH || bomb.y < 0 || bomb.y > WORLD.HEIGHT) shouldExplode = true;
      if (!shouldExplode) {
        for (const obstacle of this.state.obstacles.values()) {
          if (circlesOverlap(bomb.x, bomb.y, 6, obstacle.x, obstacle.y, obstacle.radius)) {
            shouldExplode = true;
            break;
          }
        }
      }

      if (shouldExplode) {
        this.explodeBomb(bombId, bomb);
      }
    }
  }

  private explodeBomb(bombId: string, bomb: BombSchema) {
    this.broadcast(MSG.EXPLOSION, { x: bomb.x, y: bomb.y });

    for (const [zombieId, zombie] of this.state.zombies) {
      if (zombie.state !== "alive") continue;
      if (distance(bomb.x, bomb.y, zombie.x, zombie.y) > BOMB.EXPLOSION_RADIUS) continue;

      zombie.health = Math.max(0, zombie.health - BOMB.DAMAGE);
      if (zombie.health <= 0) {
        this.killZombie(zombieId, bomb.ownerId);
      }
    }

    this.state.bombs.delete(bombId);
    this.bombStart.delete(bombId);
  }

  private startNextWave() {
    this.state.wave += 1;
    this.state.waveState = "active";
    const count = Math.min(
      WAVE.BASE_COUNT + (this.state.wave - 1) * WAVE.COUNT_GROWTH_PER_WAVE,
      WAVE.MAX_ZOMBIES_ALIVE
    );
    for (let i = 0; i < count; i++) {
      this.spawnZombie(this.state.wave);
    }
    this.broadcast(MSG.KILL_FEED, { victim: "", killer: `Wave ${this.state.wave} incoming!` });
  }

  private countAliveZombies(): number {
    let n = 0;
    for (const z of this.state.zombies.values()) {
      if (z.state === "alive") n++;
    }
    return n;
  }

  private spawnZombie(wave: number) {
    const pos = this.randomFreePosition(ZOMBIE.RADIUS);
    const z = new ZombieSchema();
    z.id = nanoid(8);
    z.x = pos.x;
    z.y = pos.y;
    z.health = ZOMBIE.BASE_HEALTH * Math.pow(ZOMBIE.HEALTH_GROWTH_PER_WAVE, wave - 1);
    z.maxHealth = z.health;
    z.state = "alive";
    z.wave = wave;
    this.state.zombies.set(z.id, z);
    this.zombieAttackCooldown.set(z.id, 0);
  }

  // ---- Zombie AI ----

  private zombieAttackCooldown = new Map<string, number>();

  private updateZombies(dtSeconds: number) {
    if (this.state.zombies.size === 0) return;

    const alivePlayers = Array.from(this.state.players.values()).filter((p) => p.state === "alive");
    const wave = this.state.wave;
    const speed = Math.min(
      ZOMBIE.BASE_SPEED * Math.pow(ZOMBIE.SPEED_GROWTH_PER_WAVE, wave - 1),
      ZOMBIE.MAX_SPEED
    );

    for (const zombie of this.state.zombies.values()) {
      if (zombie.state !== "alive") continue;
      if (alivePlayers.length === 0) continue;

      let nearest: PlayerSchema | null = null;
      let nearestDist = Infinity;
      for (const p of alivePlayers) {
        const d = distance(zombie.x, zombie.y, p.x, p.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = p;
        }
      }
      if (!nearest) continue;
      zombie.targetId = nearest.id;

      const dx = nearest.x - zombie.x;
      const dy = nearest.y - zombie.y;
      const len = Math.hypot(dx, dy) || 1;
      let nx = zombie.x + (dx / len) * speed * dtSeconds;
      let ny = zombie.y + (dy / len) * speed * dtSeconds;

      for (const obstacle of this.state.obstacles.values()) {
        if (circlesOverlap(nx, ny, ZOMBIE.RADIUS, obstacle.x, obstacle.y, obstacle.radius)) {
          const odx = nx - obstacle.x;
          const ody = ny - obstacle.y;
          const odist = Math.hypot(odx, ody) || 1;
          const overlap = ZOMBIE.RADIUS + obstacle.radius - odist;
          nx += (odx / odist) * overlap;
          ny += (ody / odist) * overlap;
        }
      }

      zombie.x = nx;
      zombie.y = ny;
    }
  }

  private handleZombieCombat() {
    const now = Date.now();

    for (const [zombieId, zombie] of this.state.zombies) {
      if (zombie.state !== "alive") continue;

      for (const [playerId, player] of this.state.players) {
        if (player.state !== "alive" || now < player.spawnProtectedUntil) continue;

        const playerRadius = massToRadius(player.mass);
        if (!circlesOverlap(zombie.x, zombie.y, ZOMBIE.RADIUS, player.x, player.y, playerRadius)) continue;

        // Zombie bites player (rate-limited).
        const cooldownUntil = this.zombieAttackCooldown.get(zombieId) ?? 0;
        if (now >= cooldownUntil) {
          player.health = Math.max(0, player.health - ZOMBIE.CONTACT_DAMAGE);
          this.zombieAttackCooldown.set(zombieId, now + ZOMBIE.ATTACK_COOLDOWN_MS);
          if (player.health <= 0) {
            this.killPlayerByZombie(playerId);
          }
        }

        // Player's mass grinds the zombie down on contact.
        const damage = player.mass * ZOMBIE.DAMAGE_PER_PLAYER_MASS * (1 / SIM.TICK_RATE);
        zombie.health = Math.max(0, zombie.health - damage);
        if (zombie.health <= 0) {
          this.killZombie(zombieId, playerId);
          break;
        }
      }
    }
  }

  private killZombie(zombieId: string, killerId: string) {
    const zombie = this.state.zombies.get(zombieId);
    const killer = this.state.players.get(killerId);
    if (!zombie) return;

    zombie.state = "dead";
    this.state.zombies.delete(zombieId);
    this.zombieAttackCooldown.delete(zombieId);

    if (killer) {
      killer.coins += ZOMBIE.COINS_PER_KILL;
      killer.kills += 1;
      killer.score += ZOMBIE.COINS_PER_KILL;
      this.addXp(killer, XP.PER_ZOMBIE_KILL);
    }
  }

  private killPlayerByZombie(victimId: string) {
    const victim = this.state.players.get(victimId);
    if (!victim) return;

    victim.state = "dead";
    victim.deaths += 1;

    this.broadcast(MSG.KILL_FEED, { victim: victim.name, killer: "a zombie" });

    const client = this.clients.find((c) => c.sessionId === victimId);
    client?.send(MSG.KILLED, { by: "a zombie" });

    this.clock.setTimeout(() => {
      if (this.state.players.has(victimId)) {
        this.respawnPlayer(victimId);
      }
    }, PLAYER.RESPAWN_DELAY_MS);
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
