import { Router } from "express";
import { nanoid } from "nanoid";
import { matchMaker } from "@colyseus/core";
import { prisma } from "../db/prisma";
import { signSessionToken, verifySessionToken } from "../auth/jwt";
import { verifyGoogleIdToken } from "../auth/googleAuth";
import { ROOM } from "@blobwars/shared";

export const router = Router();

/** POST /auth/guest { username } -> creates/reuses a guest user and returns a session token */
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
    // DB not reachable in dev fallback: still let people play, just without persistence.
    const fallbackId = nanoid(10);
    const token = signSessionToken({ userId: fallbackId, username, isGuest: true });
    res.json({ token, user: { id: fallbackId, username, isGuest: true }, warning: "db_unavailable" });
  }
});

/** POST /auth/google { idToken } -> verifies with Google, upserts user, returns session token */
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

/** GET /profile/me — requires Authorization: Bearer <token> */
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

/** GET /rooms — public server list for the lobby */
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

/** POST /rooms/private { name } -> creates a private room and returns its join code */
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

/** GET /rooms/code/:code -> resolves a join code to a roomId for the client to connect to */
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

router.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));
