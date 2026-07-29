// REST routes: guest/Google auth, profile lookup, and room listing.
// Wraps Colyseus matchMaker for public room discovery and private
// room creation/lookup by join code. DB failures degrade gracefully
// so guests can still play without persistence.
import { Router } from "express";
import { nanoid } from "nanoid";
import { matchMaker } from "@colyseus/core";
import { prisma } from "../db/prisma";
import { signSessionToken, verifySessionToken } from "../auth/jwt";
import { verifyGoogleIdToken } from "../auth/googleAuth";
import { ROOM } from "@blobwars/shared";
import { addMessage, getRecentMessages } from "./chatStore";

export const router = Router();

router.post("/auth/guest", async (req, res) => {
  const requested = String(req.body?.username || "").trim().slice(0, 16);
  const username = requested || `Guest${Math.floor(Math.random() * 99999)}`;

  try {
    const user = await prisma.user.upsert({
      where: { username },
      update: { lastLoginAt: new Date() },
      create: { username, displayName: username, isGuest: true, authProvider: "GUEST" },
    });
    const token = signSessionToken({ userId: user.id, username: user.username, isGuest: true });
    res.json({ token, user: { id: user.id, username: user.username, isGuest: true } });
  } catch (err) {
    const fallbackId = nanoid(10);
    const token = signSessionToken({ userId: fallbackId, username, isGuest: true });
    res.json({ token, user: { id: fallbackId, username, isGuest: true }, warning: "db_unavailable" });
  }
});

router.post("/auth/google", async (req, res) => {
  const idToken = req.body?.idToken;
  if (!idToken) return res.status(400).json({ error: "idToken required" });

  try {
    const profile = await verifyGoogleIdToken(idToken);
    if (!profile) return res.status(401).json({ error: "invalid_google_token" });

    const user = await prisma.user.upsert({
      where: { googleId: profile.googleId },
      update: { lastLoginAt: new Date(), avatarUrl: profile.avatarUrl },
      create: {
        username: `${profile.name.replace(/\s+/g, "").slice(0, 12)}${Math.floor(Math.random() * 999)}`,
        displayName: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
        isGuest: false,
        authProvider: "GOOGLE",
      },
    });

    const token = signSessionToken({ userId: user.id, username: user.username, isGuest: false });
    res.json({ token, user: { id: user.id, username: user.username, isGuest: false, avatarUrl: user.avatarUrl } });
  } catch (err) {
    res.status(500).json({ error: "google_auth_failed" });
  }
});

router.get("/profile/me", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifySessionToken(token);
  if (!payload) return res.status(401).json({ error: "unauthorized" });

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { stats: true },
    });
    res.json({ user });
  } catch {
    res.status(200).json({ user: { id: payload.userId, username: payload.username, isGuest: payload.isGuest } });
  }
});

router.get("/rooms", async (_req, res) => {
  try {
    const rooms = await matchMaker.query({ name: ROOM.NAME, private: false });
    res.json(
      rooms.map((r) => ({
        roomId: r.roomId,
        name: "Public Arena",
        playerCount: r.clients,
        maxPlayers: r.maxClients,
        isPrivate: false,
      }))
    );
  } catch {
    res.json([]);
  }
});

router.post("/rooms/private", async (req, res) => {
  const name = String(req.body?.name || "Private Room").slice(0, 24);
  const code = nanoid(6).toUpperCase();

  try {
    const room = await matchMaker.createRoom(ROOM.NAME, { isPrivate: true, code, name });
    res.json({ roomId: room.roomId, code });
  } catch (err) {
    res.status(500).json({ error: "failed_to_create_room" });
  }
});

router.get("/rooms/code/:code", async (req, res) => {
  try {
    const rooms = await matchMaker.query({ name: ROOM.NAME });
    const found = rooms.find((r: any) => r.metadata?.code === req.params.code.toUpperCase());
    if (!found) return res.status(404).json({ error: "not_found" });
    res.json({ roomId: found.roomId });
  } catch {
    res.status(500).json({ error: "lookup_failed" });
  }
});

// Global lobby chat: messages are kept in memory for 1 minute only (see
// chatStore.ts). The lobby page polls GET /chat/messages so old messages
// simply stop being returned once they expire — nothing to delete client-side.
router.get("/chat/messages", (_req, res) => {
  res.json(getRecentMessages());
});

router.post("/chat/send", (req, res) => {
  const username = req.body?.username;
  const text = req.body?.text;
  const message = addMessage(username, text);
  if (!message) return res.status(400).json({ error: "invalid_message" });
  res.json({ message });
});

router.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));
