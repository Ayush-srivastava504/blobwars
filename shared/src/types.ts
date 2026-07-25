export interface Vector2 {
  x: number;
  y: number;
}

/** Client -> Server input message, sent every input frame (not every render frame). */
export interface InputMessage {
  seq: number; // monotonically increasing, used for client reconciliation
  dirX: number; // normalized direction -1..1
  dirY: number; // normalized direction -1..1
  boost: boolean; // split/boost action
  timestamp: number;
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

// Colyseus room message type identifiers (kept as string literal union for safety)
export const MSG = {
  INPUT: "input",
  RESPAWN: "respawn",
  PONG: "pong",
  PING: "ping",
  KILLED: "killed",
  KILL_FEED: "killFeed",
} as const;

export type MsgType = (typeof MSG)[keyof typeof MSG];
