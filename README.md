# BlobWars — Multiplayer Arena (Agar.io / Surviv.io-style)

A real-time, server-authoritative 2D multiplayer browser game.

## What's actually working here

- **Full gameplay loop**: server-authoritative movement, food consumption, mass-based
  combat, health, death, respawn, XP/leveling, score — running at a fixed 30Hz simulation
  tick independent of network/render rate.
- **Client-side prediction + reconciliation**: the local player moves instantly using the
  same `stepPosition()` function that runs on the server (`shared/src/math.ts`); when the
  server echoes back authoritative state, unacknowledged inputs are replayed on top of it.
- **Remote player interpolation** so other players don't appear jittery between state patches.
- **Full auth flow**: guest login (instant) and Google login (ID-token verified server-side).
- **Lobby**: public server list, quick play matchmaking (Colyseus `joinOrCreate`), create
  private room + shareable code, join by code.
- **Full UI HUD**: health bar, XP bar, live scoreboard, minimap, ping indicator, FPS counter,
  kill feed, death/respawn screen.
- **One polished map**: 4000×4000 arena, 9 static obstacles, 8 spawn points, food field,
  hard boundary.
- **Reconnection support** via Colyseus `allowReconnection`.
- **Prisma schema** covering Users, PlayerStats, Rooms, Matches, MatchPlayer — match
  results are persisted on player leave.
- **Docker Compose** stack: Postgres, Redis, backend, frontend, Nginx reverse proxy, wired
  for horizontal scaling (Redis presence/driver so multiple game-server instances can share
  room discovery).

## What's intentionally stubbed / left for you to extend

This is a working foundation, not a finished live-service game. Be honest with yourself
about what's left before "thousands of concurrent players in production":

- **Anti-cheat / input validation is minimal.** The server trusts direction vectors within
  reason but doesn't yet rate-limit or sanity-check for speed hacking beyond what
  `stepPosition()` naturally caps. Add server-side anomaly detection before going live.
- **No load balancer / matchmaking director for multi-region.** Colyseus's Redis driver
  lets you run N backend processes, but you'll want a proper LB (e.g. `@colyseus/proxy` or
  a cloud LB with sticky sessions) in front of them.
- **Google OAuth needs your own Client ID** in `.env` — the verification code is complete,
  but you must create the OAuth consent screen + credentials in Google Cloud Console.
- **No animations beyond size/color changes** — sprite-based character animations aren't
  included; players render as circles (agar.io-style), which is genre-appropriate but you
  may want surviv.io-style sprites for a different feel.
- **Single map, no game modes** — architecture supports adding more (`ROOM.NAME` per mode,
  new `OBSTACLES`/`SPAWN_POINTS` sets), but only "FFA arena" is implemented.
- **No automated tests, no CI/CD, no monitoring/observability stack** (Prometheus/Grafana,
  error tracking, etc.) — add these before production traffic.
- **Rate limiting / DDoS protection at the edge** isn't configured in the Nginx config.

## Architecture

```
blobwars/
├── shared/         # Types, constants, and pure math shared by client + server
│                    # (this is what keeps prediction and authority numerically identical)
├── backend/         # Colyseus game server + Express REST API (auth, rooms, matchmaking)
│   └── src/
│       ├── rooms/        # ArenaRoom: authoritative simulation loop
│       ├── auth/         # JWT + Google ID token verification
│       ├── db/           # Prisma client + match persistence
│       └── http/         # REST routes
├── frontend/         # Next.js 15 App Router + Phaser 3 client
│   ├── app/           # Lobby page (single-page: swaps to GameCanvas once connected)
│   ├── game/           # Phaser scene: prediction, reconciliation, rendering
│   ├── components/     # HUD overlays (React, layered above the Phaser canvas)
│   └── lib/             # Auth/session + Colyseus client helpers
├── database/         # Prisma schema (Users, PlayerStats, Rooms, Matches, MatchPlayer)
├── nginx/             # Reverse proxy config
└── docker-compose.yml
```

**Why Colyseus over raw Socket.IO**: Colyseus gives you room-based matchmaking,
delta-compressed binary state sync (`@colyseus/schema`), and built-in reconnection out of
the box — all things you'd otherwise hand-roll on top of Socket.IO.

## Local development (without Docker)

Prerequisites: Node 20+, Postgres, Redis (or just skip Redis for single-process dev).

```bash
# 1. Install dependencies (workspace root)
npm install

# 2. Copy env
cp .env.example .env
# edit DATABASE_URL, and optionally GOOGLE_CLIENT_ID

# 3. Generate Prisma client + run migrations
cd backend
npm run prisma:generate
npx prisma migrate dev --schema=../database/schema.prisma --name init

# 4. Run backend (Colyseus + REST, port 2567)
npm run dev

# 5. In a new terminal — run frontend (Next.js, port 3000)
cd ../frontend
npm run dev
```

Visit `http://localhost:3000`, play as a guest, click **Play Now**.

Colyseus dev monitor (room inspector) is available at `http://localhost:2567/colyseus`
outside production mode.

## Running with Docker Compose (production-style)

```bash
cp .env.example .env
# fill in real secrets: JWT_SECRET, GOOGLE_CLIENT_ID, POSTGRES_PASSWORD

docker compose up --build
```

This brings up Postgres, Redis, the backend, the frontend, and Nginx on port 80. Run
migrations once against the running Postgres container:

```bash
docker compose exec backend npx prisma migrate deploy --schema=../database/schema.prisma
```

## Scaling notes

- The simulation tick (30Hz) and network patch rate (20Hz) are decoupled in
  `shared/src/constants.ts` (`SIM.TICK_RATE` / `SIM.PATCH_RATE`) — tune these first if you
  need to trade CPU for bandwidth per room.
- Each `ArenaRoom` instance owns one arena (up to `ROOM.MAX_PLAYERS = 40`). To support more
  concurrent players, run more backend processes behind the Redis driver/presence (already
  wired in `backend/src/index.ts`) and let Colyseus's matchmaker spread players across rooms
  and processes.
- Match results are written to Postgres on player disconnect — this is fire-and-forget
  (`.catch(() => {})`) so a slow DB never blocks gameplay; consider a queue (e.g. via Redis)
  if the DB becomes a bottleneck at scale.
