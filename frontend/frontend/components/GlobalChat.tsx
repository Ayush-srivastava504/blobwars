// Global lobby chat. Lives only on the homepage (unmounted the moment a
// Room is joined, since GameCanvas takes over the screen). Polls the
// backend every 1.5s; the backend itself only ever keeps a message for 60s
// (see chatStore.ts's TTL_MS), so messages just quietly stop appearing in
// the next poll once they expire — nothing to track or time out here.
"use client";

import { useEffect, useRef, useState } from "react";
import { fetchChatMessages, sendChatMessage, ChatMessage } from "@/lib/chat";

const POLL_MS = 1500;
const MAX_TEXT_LEN = 200;

export function GlobalChat({ username }: { username: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const msgs = await fetchChatMessages();
      if (!cancelled) setMessages(msgs);
    };
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    try {
      await sendChatMessage(username, text);
      setMessages(await fetchChatMessages());
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-arena-panel rounded-xl border border-white/10 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm uppercase tracking-wider text-white/50">Global Chat</h3>
        <span className="text-[11px] text-white/30">messages disappear after 1 min</span>
      </div>

      <div ref={listRef} className="h-40 overflow-y-auto flex flex-col gap-1.5 pr-1 mb-3">
        {messages.length === 0 ? (
          <p className="text-white/30 text-sm m-auto">No messages yet — say hi!</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm leading-snug break-words">
              <span className="text-arena-accent font-semibold">{m.username}: </span>
              <span className="text-white/80">{m.text}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 outline-none focus:border-arena-accent text-sm"
          placeholder="Say something…"
          maxLength={MAX_TEXT_LEN}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="px-4 py-2 rounded-lg bg-arena-accent hover:bg-blue-500 transition-colors text-sm font-semibold disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
