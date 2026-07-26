// Shared, pure math helpers for BlobWars movement and combat.
// Used identically on the server (authoritative simulation) and
// client (prediction) so both stay numerically in sync.
// No side effects; every function here is deterministic.

import { PLAYER, SIM, WORLD } from "./constants";

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function massToRadius(mass: number): number {
  return PLAYER.BASE_RADIUS + Math.sqrt(Math.max(mass, 0)) * PLAYER.RADIUS_MASS_FACTOR * 0.25;
}

export function massToSpeed(mass: number): number {
  const speed = SIM.BASE_SPEED - mass * SIM.SPEED_MASS_FALLOFF * SIM.BASE_SPEED * 0.01;
  return clamp(speed, SIM.MIN_SPEED, SIM.BASE_SPEED);
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number
): boolean {
  return distance(ax, ay, bx, by) < ar + br;
}

export function stepPosition(
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  mass: number,
  dtSeconds: number
): Vector2Like {
  const len = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / len;
  const ny = dirY / len;
  const speed = massToSpeed(mass);
  const radius = massToRadius(mass);

  let nextX = x + nx * speed * dtSeconds;
  let nextY = y + ny * speed * dtSeconds;

  nextX = clamp(nextX, radius + WORLD.BOUNDARY_PADDING, WORLD.WIDTH - radius - WORLD.BOUNDARY_PADDING);
  nextY = clamp(nextY, radius + WORLD.BOUNDARY_PADDING, WORLD.HEIGHT - radius - WORLD.BOUNDARY_PADDING);

  return { x: nextX, y: nextY };
}

interface Vector2Like {
  x: number;
  y: number;
}
