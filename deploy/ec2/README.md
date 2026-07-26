# Deploying the blobwars backend to a 1GB RAM EC2 instance

## Why this differs from `docker-compose.yml`

The repo's root `docker-compose.yml` runs postgres + redis + backend + frontend +
nginx together — fine on a dev machine, but five services (two of them Node/JS
processes, one a full DB) will not fit in 1GB of RAM, especially during
`npm install` / `prisma generate` / image builds, which spike well above idle
usage.

`docker-compose.ec2.yml` at the repo root instead runs **just postgres + backend**:

- **No redis** — `backend/src/index.ts` already runs Colyseus in single-process
  presence/driver mode when `REDIS_URL` is unset. Redis is only for horizontal
  scaling across multiple instances, which doesn't apply here.
- **No frontend** — the Next.js app is deployed separately on Vercel at
  `blobwars.site` / `www.blobwars.site`. Its `NEXT_PUBLIC_GAME_SERVER_*` env
  vars (see `frontend/.env.production`) point at this instance's domain.
- **No nginx container** — since the frontend is served over `https://`, the
  browser requires `wss://` (not plain `ws://`) to talk to this backend, so
  TLS is not optional here. Run nginx natively on the host instead of in
  Docker; see `deploy/ec2/nginx-wss.conf.example`, which is preconfigured for
  `api.blobwars.site`.

### DNS + security group

- Point an **A record** for `api.blobwars.site` at this instance's public IP.
- Security group inbound: **22** (SSH, restrict to your IP), **80** and
  **443** (for nginx + certbot). You can close 2567 to the internet once
  nginx is fronting it — nginx reaches the backend over `127.0.0.1:2567`.

## Instance

- **Type:** `t3.micro` or `t2.micro` (1GB RAM, burstable CPU — fine for a
  30Hz/20-players-per-room game loop at modest concurrency; a sustained full
  40-player room will use real CPU credits, keep an eye on `docker stats`).
- **AMI:** Amazon Linux 2023 (script below assumes `dnf`; swap `apt` in for
  Ubuntu).
- **Storage:** 20GB gp3 is plenty.
- **Security group:** inbound 22 (SSH, restrict to your IP), 2567 (backend,
  or 80/443 instead if you put nginx in front), outbound open.

## Steps

1. Get the code onto the instance (`scp` the zip, or `git clone` if it's in a repo).
2. `cd` into the project root (where `docker-compose.ec2.yml` lives).
3. `chmod +x deploy/ec2/setup.sh && ./deploy/ec2/setup.sh`
   - First run: provisions a 2GB swapfile, installs Docker, then stops and
     asks you to fill in `.env` (copied from `.env.ec2.example`) — set
     `JWT_SECRET`, `POSTGRES_PASSWORD`, and confirm `CORS_ORIGIN` is
     `https://blobwars.site,https://www.blobwars.site` (already the default
     in `.env.ec2.example`).
   - Run it again: builds the backend image, brings up postgres, runs
     `prisma migrate deploy`, then starts the backend.
4. `curl http://localhost:2567/health` should return `{"status":"ok",...}`.
5. Set up `deploy/ec2/nginx-wss.conf.example` + certbot for `api.blobwars.site`
   (see "DNS + security group" above) — this is **required**, not optional,
   since the frontend needs `wss://`.
6. On Vercel, deploy `frontend/` with the domain `blobwars.site` /
   `www.blobwars.site` attached. `frontend/.env.production` already points
   `NEXT_PUBLIC_GAME_SERVER_WS`/`_HTTP` at `api.blobwars.site` — override in
   the Vercel dashboard instead if you'd rather not commit them.

## Operating it

```
docker compose -f docker-compose.ec2.yml ps            # status
docker compose -f docker-compose.ec2.yml logs -f backend
docker stats                                            # watch memory live — this is the important one on 1GB
```

If you see the backend or postgres container get OOM-killed (`docker compose ps`
will show it restarting), check `docker stats` during peak load — you may need
to lower `mem_limit` on the *other* service, drop `max_connections` further in
`deploy/postgres/postgresql.conf`, or move up to a 2GB instance. The swapfile
buys headroom for spikes, not a permanently over-committed working set.

## Updating code

```
git pull   # or re-upload
docker compose -f docker-compose.ec2.yml build backend
docker compose -f docker-compose.ec2.yml up -d backend
```
