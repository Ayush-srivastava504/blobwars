// Client for the lobby's global chat REST endpoints. The chat only exists
// on the homepage/lobby (not in-game) and messages live for 1 minute —
// enforced server-side (see backend/src/http/chatStore.ts), so this file
// just polls and posts; it never needs to expire messages itself.
"use client";

const HTTP_BASE = process.env.NEXT_PUBLIC_GAME_SERVER_HTTP!;

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  ts: number;
}

export async function fetchChatMessages(): Promise<ChatMessage[]> {
  const res = await fetch(`${HTTP_BASE}/chat/messages`);
  if (!res.ok) return [];
  return res.json();
}

export async function sendChatMessage(username: string, text: string): Promise<void> {
  await fetch(`${HTTP_BASE}/chat/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, text }),
  });
}
