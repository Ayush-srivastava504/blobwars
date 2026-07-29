// In-memory store for the lobby's global chat. Messages are only ever kept
// for TTL_MS (1 minute) — getRecentMessages() prunes anything older every
// time it's called, so the chat "lives" for 60s and nothing needs to be
// persisted or explicitly deleted.
//
// NOTE: this is single-process, in-memory storage. If the backend is ever
// scaled horizontally (see REDIS_URL in index.ts), each process would have
// its own independent chat history. That's an acceptable tradeoff for a
// throwaway 1-minute lobby chat, but would need to move to Redis (the way
// Colyseus presence/driver already does) to be consistent across processes.
import { nanoid } from "nanoid";

export const TTL_MS = 60_000;
const MAX_MESSAGES = 200;
const MAX_TEXT_LEN = 200;
const MAX_USERNAME_LEN = 20;

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  ts: number;
}

let messages: ChatMessage[] = [];

function prune() {
  const cutoff = Date.now() - TTL_MS;
  messages = messages.filter((m) => m.ts > cutoff);
}

export function getRecentMessages(): ChatMessage[] {
  prune();
  return messages;
}

export function addMessage(username: string, text: string): ChatMessage | null {
  const cleanUsername = String(username || "").trim().slice(0, MAX_USERNAME_LEN);
  const cleanText = String(text || "").trim().slice(0, MAX_TEXT_LEN);
  if (!cleanUsername || !cleanText) return null;

  prune();
  const message: ChatMessage = {
    id: nanoid(10),
    username: cleanUsername,
    text: cleanText,
    ts: Date.now(),
  };
  messages.push(message);
  if (messages.length > MAX_MESSAGES) messages = messages.slice(-MAX_MESSAGES);
  return message;
}
