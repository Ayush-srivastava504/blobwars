// Shared, tunable game-balance constants for BlobWars.
// Imported by both the Colyseus server and the Phaser client so
// simulation math stays identical on both sides.
// Values here are the single source of truth for gameplay tuning.

export const WORLD = {
  WIDTH: 4000,
  HEIGHT: 4000,
  BOUNDARY_PADDING: 20,
} as const;

export const SIM = {
  TICK_RATE: 30,
  PATCH_RATE: 20,
  BASE_SPEED: 220,
  SPEED_MASS_FALLOFF: 0.0025,
  MIN_SPEED: 60,
} as const;

export const PLAYER = {
  START_MASS: 20,
  MIN_MASS: 10,
  MAX_MASS: 4000,
  START_HEALTH: 100,
  MAX_HEALTH: 100,
  RADIUS_MASS_FACTOR: 4.2,
  BASE_RADIUS: 12,
  RESPAWN_DELAY_MS: 2500,
  DAMAGE_PER_MASS_DIFF: 0.12,
  INVULNERABLE_MS_AFTER_SPAWN: 1500,
} as const;

export const FOOD = {
  COUNT: 400,
  MASS: 4,
  RADIUS: 5,
  RESPAWN_MS: 4000,
} as const;

export const OBSTACLES = [
  { x: 1000, y: 1000, radius: 140 },
  { x: 3000, y: 1000, radius: 180 },
  { x: 1000, y: 3000, radius: 160 },
  { x: 3000, y: 3000, radius: 140 },
  { x: 2000, y: 2000, radius: 220 },
  { x: 2000, y: 700, radius: 90 },
  { x: 2000, y: 3300, radius: 90 },
  { x: 700, y: 2000, radius: 90 },
  { x: 3300, y: 2000, radius: 90 },
] as const;

export const SPAWN_POINTS = [
  { x: 300, y: 300 },
  { x: 3700, y: 300 },
  { x: 300, y: 3700 },
  { x: 3700, y: 3700 },
  { x: 2000, y: 300 },
  { x: 2000, y: 3700 },
  { x: 300, y: 2000 },
  { x: 3700, y: 2000 },
] as const;

export const ROOM = {
  MAX_PLAYERS: 40,
  NAME: "arena",
} as const;

export const XP = {
  PER_FOOD: 1,
  PER_KILL: 50,
  PER_ZOMBIE_KILL: 15,
  LEVEL_BASE: 100,
  LEVEL_GROWTH: 1.15,
} as const;

export const ZOMBIE = {
  BASE_HEALTH: 30,
  HEALTH_GROWTH_PER_WAVE: 1.18,
  BASE_SPEED: 90,
  SPEED_GROWTH_PER_WAVE: 1.03,
  MAX_SPEED: 180,
  RADIUS: 16,
  CONTACT_DAMAGE: 8,
  ATTACK_COOLDOWN_MS: 800,
  DAMAGE_PER_PLAYER_MASS: 0.35,
  COINS_PER_KILL: 10,
} as const;

export const BULLET = {
  SPEED: 900,
  DAMAGE: 8,
  RADIUS: 5,
  LIFETIME_MS: 1200,
  COOLDOWN_MS: 220,
} as const;

// Coin-shop weapon catalog. "pistol" is free/starting and can't be sold back.
// icon paths point at /public/assets/weapons/shop/*.png (used by both the
// shop UI and the small hand-gun overlay drawn on the hero sprite).
export const WEAPONS: import("./types").WeaponDef[] = [
  { id: "pistol", name: "Pistol", price: 0, damage: 8, cooldownMs: 220, icon: "/assets/weapons/shop/pistol.png" },
  { id: "glock18", name: "Glock 18", price: 150, damage: 11, cooldownMs: 190, icon: "/assets/weapons/shop/glock18.png" },
  { id: "deagle", name: "Desert Eagle", price: 350, damage: 22, cooldownMs: 320, icon: "/assets/weapons/shop/deagle.png" },
  { id: "tmp", name: "TMP Machine Pistol", price: 500, damage: 7, cooldownMs: 90, icon: "/assets/weapons/shop/tmp.png" },
  { id: "aug", name: "AUG Rifle", price: 900, damage: 14, cooldownMs: 140, icon: "/assets/weapons/shop/aug.png" },
  { id: "barret", name: "Barret .50cal", price: 1600, damage: 45, cooldownMs: 650, icon: "/assets/weapons/shop/barret.png" },
];

export const SLIDE = {
  DISTANCE: 150,
  COOLDOWN_MS: 1400,
  DURATION_MS: 260,
} as const;

export const WAVE = {
  BASE_COUNT: 5,
  COUNT_GROWTH_PER_WAVE: 3,
  MAX_ZOMBIES_ALIVE: 120,
  INTERMISSION_MS: 6000,
  FIRST_WAVE_DELAY_MS: 4000,
} as const;

// Supply crate dropped once when a wave is cleared. Any player who walks
// over it gets healed, a handful of coins, and 2 throwable bombs.
export const CRATE = {
  RADIUS: 26,
  HEAL_AMOUNT: 40,
  COINS_MIN: 20,
  COINS_MAX: 50,
  BOMBS_GRANTED: 2,
} as const;

// Thrown grenade: travels in a straight line from the thrower out to
// MAX_RANGE (or until it hits an obstacle) and then explodes, dealing AOE
// damage to zombies caught in EXPLOSION_RADIUS. MAX_RANGE doubles as the
// length of the dotted aim-trajectory line drawn on the client while the
// throw button is held.
export const BOMB = {
  SPEED: 700,
  MAX_RANGE: 420,
  EXPLOSION_RADIUS: 110,
  DAMAGE: 60,
  STARTING_COUNT: 0,
} as const;
