/**
 * Single source of truth for tunable game parameters.
 * Imported by BOTH the Colyseus server and the Phaser client so that
 * client-side prediction stays numerically identical to server simulation.
 */

export const WORLD = {
  WIDTH: 4000,
  HEIGHT: 4000,
  BOUNDARY_PADDING: 20,
} as const;

export const SIM = {
  TICK_RATE: 30, // authoritative simulation steps per second
  PATCH_RATE: 20, // state broadcast rate per second
  BASE_SPEED: 220, // px/s at minimum mass
  SPEED_MASS_FALLOFF: 0.0025, // larger blobs move slower
  MIN_SPEED: 60,
} as const;

export const PLAYER = {
  START_MASS: 20,
  MIN_MASS: 10,
  MAX_MASS: 4000,
  START_HEALTH: 100,
  MAX_HEALTH: 100,
  RADIUS_MASS_FACTOR: 4.2, // radius = BASE_RADIUS + sqrt(mass) * factor
  BASE_RADIUS: 12,
  RESPAWN_DELAY_MS: 2500,
  DAMAGE_PER_MASS_DIFF: 0.12, // combat damage scaling when larger eats smaller via contact
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
  LEVEL_BASE: 100,
  LEVEL_GROWTH: 1.15,
} as const;
