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
- **No frontend** — deploy the Next.js app separately (Vercel, Amplify, another
  small instance, whatever). Point its `NEXT_PUBLIC_GAME_SERVER_*` env vars at
  this instance's IP/domain.
- **No nginx container** — if you need TLS (`wss://` for an https:// frontend),
  run nginx natively on the host instead of in Docker; see
  `deploy/ec2/nginx-wss.conf.example`. Skip it entirely if you're fine with
  plain `ws://` for now.

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
     `JWT_SECRET`, `POSTGRES_PASSWORD`, and `CORS_ORIGIN` (your frontend's
     exact origin).
   - Run it again: builds the backend image, brings up postgres, runs
     `prisma migrate deploy`, then starts the backend.
4. `curl http://localhost:2567/health` should return `{"status":"ok",...}`.
5. (Optional) set up `deploy/ec2/nginx-wss.conf.example` + certbot if you need `wss://`.

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
