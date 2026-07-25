import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { RedisPresence } from "@colyseus/redis-presence";
import { RedisDriver } from "@colyseus/redis-driver";
import { ArenaRoom } from "./rooms/ArenaRoom";
import { router } from "./http/routes";
import { ROOM } from "@blobwars/shared";

const PORT = Number(process.env.PORT || 2567);
const REDIS_URL = process.env.REDIS_URL; // e.g. redis://redis:6379

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use("/", router);

const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
  // Redis presence + driver let this process horizontally scale: multiple game-server
  // instances share room discovery / pub-sub through Redis instead of process memory.
  presence: REDIS_URL ? new RedisPresence(REDIS_URL) : undefined,
  driver: REDIS_URL ? new RedisDriver(REDIS_URL) : undefined,
});

gameServer.define(ROOM.NAME, ArenaRoom);

if (process.env.NODE_ENV !== "production") {
  app.use("/colyseus", monitor());
}

gameServer.listen(PORT).then(() => {
  console.log(`[blobwars] game+matchmaking server listening on :${PORT}`);
  console.log(`[blobwars] redis presence: ${REDIS_URL ? "enabled" : "disabled (single-process mode)"}`);
});
