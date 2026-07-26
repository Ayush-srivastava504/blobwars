// Backend entrypoint: boots Express (CORS + REST routes) and the
// Colyseus game server on one HTTP server, registering ArenaRoom.
// Uses Redis presence/driver when REDIS_URL is set for multi-process
// scaling, otherwise runs single-process. Exposes /colyseus monitor in dev.
import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { Encoder } from "@colyseus/schema";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { RedisPresence } from "@colyseus/redis-presence";
import { RedisDriver } from "@colyseus/redis-driver";
import { ArenaRoom } from "./rooms/ArenaRoom";
import { router } from "./http/routes";
import { ROOM } from "@blobwars/shared";

Encoder.BUFFER_SIZE = 64 * 1024;

const PORT = Number(process.env.PORT || 2567);
const REDIS_URL = process.env.REDIS_URL;

const allowedOrigins = [
  "https://blobwars.site",
  "https://www.blobwars.site",
];

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use("/", router);

const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
  presence: REDIS_URL ? new RedisPresence(REDIS_URL) : undefined,
  driver: REDIS_URL ? new RedisDriver(REDIS_URL) : undefined,
});

gameServer.define(ROOM.NAME, ArenaRoom);

if (process.env.NODE_ENV !== "production") {
  app.use("/colyseus", monitor());
}

gameServer.listen(PORT).then(() => {
  console.log(`[blobwars] game+matchmaking server listening on :${PORT}`);
  console.log(
    `[blobwars] redis presence: ${
      REDIS_URL ? "enabled" : "disabled (single-process mode)"
    }`
  );
  console.log(`[blobwars] Allowed CORS origins: ${allowedOrigins.join(", ")}`);
});