"use client";

import { useEffect, useState } from "react";
import type { Room } from "colyseus.js";
import {
  getUser,
  loginAsGuest,
  loginWithGoogle,
  fetchPublicRooms,
  createPrivateRoom,
  resolveRoomCode,
  RoomListing,
  SessionUser,
} from "@/lib/session";
import { joinPublicArena, joinRoomById } from "@/lib/colyseusClient";
import { GameCanvas } from "@/components/GameCanvas";

declare global {
  interface Window {
    google?: any;
  }
}

export default function LobbyPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [username, setUsername] = useState("");
  const [rooms, setRooms] = useState<RoomListing[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [privateCode, setPrivateCode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    const existing = getUser();
    if (existing) setUser(existing);
  }, []);

  useEffect(() => {
    if (user) refreshRooms();
    const interval = setInterval(() => {
      if (user) refreshRooms();
    }, 5000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user && window.google && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          try {
            const u = await loginWithGoogle(resp.credential);
            setUser(u);
          } catch {
            setError("Google login failed");
          }
        },
      });
      const el = document.getElementById("google-btn");
      if (el) window.google.accounts.id.renderButton(el, { theme: "filled_blue", size: "large" });
    }
  }, [user]);

  async function refreshRooms() {
    setRooms(await fetchPublicRooms());
  }

  async function handleGuestLogin() {
    try {
      const u = await loginAsGuest(username);
      setUser(u);
    } catch {
      setError("Could not log in as guest — is the backend running?");
    }
  }

  async function handlePlayPublic() {
    if (!user) return;
    setConnecting(true);
    setError(null);
    try {
      const r = await joinPublicArena(user.username);
      setRoom(r);
    } catch (e) {
      setError("Failed to join arena. Server may be offline.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleJoinRoom(roomId: string) {
    if (!user) return;
    setConnecting(true);
    setError(null);
    try {
      const r = await joinRoomById(roomId, user.username);
      setRoom(r);
    } catch {
      setError("Failed to join room.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleCreatePrivate() {
    try {
      const { roomId, code } = await createPrivateRoom(`${user?.username}'s room`);
      setPrivateCode(code);
      await handleJoinRoom(roomId);
    } catch {
      setError("Failed to create private room.");
    }
  }

  async function handleJoinByCode() {
    try {
      const roomId = await resolveRoomCode(joinCode);
      await handleJoinRoom(roomId);
    } catch {
      setError("Invalid or expired room code.");
    }
  }

  if (room) {
    return <GameCanvas room={room} />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <script src="https://accounts.google.com/gsi/client" async defer />

      <h1 className="text-5xl font-extrabold mb-2 tracking-tight">
        Blob<span className="text-arena-accent">Wars</span>
      </h1>
      <p className="text-white/50 mb-10">Real-time multiplayer arena — eat, grow, survive.</p>

      {!user ? (
        <div className="w-full max-w-sm bg-arena-panel rounded-xl border border-white/10 p-6 space-y-4">
          <input
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 outline-none focus:border-arena-accent"
            placeholder="Choose a username"
            maxLength={16}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            onClick={handleGuestLogin}
            className="w-full py-2 rounded-lg bg-arena-accent hover:bg-blue-500 font-semibold transition-colors"
          >
            Play as Guest
          </button>
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <div className="h-px bg-white/10 flex-1" />
            OR
            <div className="h-px bg-white/10 flex-1" />
          </div>
          <div id="google-btn" className="flex justify-center" />
        </div>
      ) : (
        <div className="w-full max-w-md space-y-6">
          <div className="bg-arena-panel rounded-xl border border-white/10 p-6 text-center">
            <p className="text-white/60 text-sm mb-3">
              Playing as <span className="text-white font-semibold">{user.username}</span>
            </p>
            <button
              disabled={connecting}
              onClick={handlePlayPublic}
              className="w-full py-3 rounded-lg bg-arena-accent hover:bg-blue-500 font-bold text-lg transition-colors disabled:opacity-50"
            >
              {connecting ? "Connecting…" : "Play Now"}
            </button>
          </div>

          <div className="bg-arena-panel rounded-xl border border-white/10 p-6 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handleCreatePrivate}
                className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
              >
                Create Private Room
              </button>
            </div>
            {privateCode && (
              <p className="text-xs text-white/60 text-center">
                Share code: <span className="font-mono text-arena-accent">{privateCode}</span>
              </p>
            )}
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 outline-none focus:border-arena-accent text-sm"
                placeholder="Enter room code"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
              <button
                onClick={handleJoinByCode}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
              >
                Join
              </button>
            </div>
          </div>

          <div className="bg-arena-panel rounded-xl border border-white/10 p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm uppercase tracking-wider text-white/50">Public Servers</h3>
              <button onClick={refreshRooms} className="text-xs text-arena-accent hover:underline">
                Refresh
              </button>
            </div>
            {rooms.length === 0 ? (
              <p className="text-white/40 text-sm">No active servers — be the first to play!</p>
            ) : (
              <ul className="space-y-2">
                {rooms.map((r) => (
                  <li key={r.roomId} className="flex justify-between items-center text-sm">
                    <span>{r.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white/40">
                        {r.playerCount}/{r.maxPlayers}
                      </span>
                      <button
                        onClick={() => handleJoinRoom(r.roomId)}
                        className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                      >
                        Join
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-arena-danger text-sm">{error}</p>}
    </main>
  );
}
