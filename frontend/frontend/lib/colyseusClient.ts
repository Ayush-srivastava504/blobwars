// Thin wrapper around the Colyseus client: creates a singleton client,
// and exposes helpers to join the public arena, join a room by id,
// or reconnect after a dropped connection using a reconnection token.
// Used by the lobby page to obtain a Room before entering gameplay.
import { Client, Room } from "colyseus.js";
import { ROOM } from "@blobwars/shared";

const WS_BASE = process.env.NEXT_PUBLIC_GAME_SERVER_WS!;

let client: Client | null = null;

export function getColyseusClient(): Client {
  if (!client) client = new Client(WS_BASE);
  return client;
}

export async function joinPublicArena(name: string): Promise<Room> {
  return getColyseusClient().joinOrCreate(ROOM.NAME, { name });
}

export async function joinRoomById(roomId: string, name: string): Promise<Room> {
  return getColyseusClient().joinById(roomId, { name });
}

export async function reconnect(reconnectionToken: string): Promise<Room> {
  return getColyseusClient().reconnect(reconnectionToken);
}
