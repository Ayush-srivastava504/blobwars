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
const REDIS_URL = process.env.REDIS_URL;

const app = express();

// Trust the reverse proxy (nginx) in front of this so req.ip / req.protocol
// reflect the real client instead of the proxy hop.
app.set("trust proxy", 1);

// Normalize (trim + strip trailing slash) so "https://blobwars.site/" and
// "https://blobwars.site" both match — a trailing-slash mismatch is one of
// the most common causes of a CORS rejection that looks like a bug.
const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:3000,https://blobwars.site,https://www.blobwars.site"
)
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = same-origin request, server-to-server call, curl,
      // Colyseus' own matchmaking probe, etc. Always allow.
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
        return callback(null, true);
      }

      // Reject WITHOUT throwing — throwing here is what turns a routine CORS
      // rejection into an unhandled error that Express reports as a 500.
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use("/", router);

// Catch-all error handler: anything thrown/rejected in a route above lands
// here instead of falling through to Express' default HTML error page.
// This is what fixes stray "Internal Server Error" responses.
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[blobwars] unhandled request error:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "internal_server_error" });
  }
);

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
});