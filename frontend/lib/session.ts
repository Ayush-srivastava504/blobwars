"use client";

const HTTP_BASE = process.env.NEXT_PUBLIC_GAME_SERVER_HTTP!;
const TOKEN_KEY = "blobwars_token";
const USER_KEY = "blobwars_user";

export interface SessionUser {
  id: string;
  username: string;
  isGuest: boolean;
  avatarUrl?: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function persist(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function loginAsGuest(username: string): Promise<SessionUser> {
  const res = await fetch(`${HTTP_BASE}/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) throw new Error("Guest login failed");
  const data = await res.json();
  persist(data.token, data.user);
  return data.user;
}

export async function loginWithGoogle(idToken: string): Promise<SessionUser> {
  const res = await fetch(`${HTTP_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Google login failed");
  const data = await res.json();
  persist(data.token, data.user);
  return data.user;
}

export interface RoomListing {
  roomId: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  isPrivate: boolean;
}

export async function fetchPublicRooms(): Promise<RoomListing[]> {
  const res = await fetch(`${HTTP_BASE}/rooms`);
  if (!res.ok) return [];
  return res.json();
}

export async function createPrivateRoom(name: string): Promise<{ roomId: string; code: string }> {
  const res = await fetch(`${HTTP_BASE}/rooms/private`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create private room");
  return res.json();
}

export async function resolveRoomCode(code: string): Promise<string> {
  const res = await fetch(`${HTTP_BASE}/rooms/code/${code.toUpperCase()}`);
  if (!res.ok) throw new Error("Room not found");
  const data = await res.json();
  return data.roomId;
}
