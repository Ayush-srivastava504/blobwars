// Shared TypeScript types and message contracts for BlobWars.
// Defines player/food/obstacle snapshots sent over the network,
// plus the Colyseus message-type identifiers both sides send.
// Kept dependency-free so it can be imported anywhere.

export interface Vector2 {
  x: number;
  y: number;
}

export interface InputMessage {
  seq: number;
  dirX: number;
  dirY: number;
  timestamp: number;
}

export interface ShootMessage {
  dirX: number;
  dirY: number;
}

export interface ThrowBombMessage {
  dirX: number;
  dirY: number;
}

export type PlayerState = "alive" | "dead" | "respawning";

export interface PlayerSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
  mass: number;
  health: number;
  maxHealth: number;
  color: number;
  state: PlayerState;
  level: number;
  xp: number;
  kills: number;
  score: number;
  lastProcessedInputSeq: number;
  equippedWeapon: string;
  ownedWeapons: string[];
  bombs: number;
}

export interface FoodSnapshot {
  id: string;
  x: number;
  y: number;
  mass: number;
  color: number;
}

export interface ObstacleSnapshot {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface ScoreboardEntry {
  id: string;
  name: string;
  score: number;
  kills: number;
}

export interface RoomMetadata {
  roomId: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  isPrivate: boolean;
}

export const MSG = {
  INPUT: "input",
  SHOOT: "shoot",
  RESPAWN: "respawn",
  PONG: "pong",
  PING: "ping",
  KILLED: "killed",
  KILL_FEED: "killFeed",
  SLIDE: "slide",
  BUY_WEAPON: "buyWeapon",
  EQUIP_WEAPON: "equipWeapon",
  SHOP_ERROR: "shopError",
  THROW_BOMB: "throwBomb",
  EXPLOSION: "explosion",
} as const;

export type MsgType = (typeof MSG)[keyof typeof MSG];

export interface WeaponDef {
  id: string;
  name: string;
  price: number;
  damage: number;
  cooldownMs: number;
  icon: string;
}
