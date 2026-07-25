#!/usr/bin/env bash
# Bootstraps a fresh 1GB RAM EC2 instance (Amazon Linux 2023) to run the
# blobwars backend + postgres via docker compose.
#
# Usage (run as the ec2-user, from the repo root that you've already
# uploaded/cloned onto the instance):
#   chmod +x deploy/ec2/setup.sh
#   ./deploy/ec2/setup.sh
#
# Re-running is safe — every step is idempotent.

set -euo pipefail

echo "==> 1/5  Swap file (critical on 1GB RAM — build steps and GC spikes will OOM without it)"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
else
  echo "    /swapfile already exists, skipping"
fi
free -h

echo "==> 2/5  Docker + compose plugin"
if ! command -v docker &>/dev/null; then
  sudo dnf install -y docker
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER"
  echo "    Added $USER to the docker group — log out/in (or 'newgrp docker') before the next steps"
fi
if ! docker compose version &>/dev/null; then
  DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
  mkdir -p "$DOCKER_CONFIG/cli-plugins"
  curl -sSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
    -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
  chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
fi

echo "==> 3/5  .env"
if [ ! -f .env ]; then
  cp .env.ec2.example .env
  echo "    Created .env from template — EDIT IT NOW (JWT_SECRET, POSTGRES_PASSWORD, CORS_ORIGIN), then re-run this script."
  exit 0
fi

echo "==> 4/5  Build and run database migrations"
docker compose -f docker-compose.ec2.yml build backend
docker compose -f docker-compose.ec2.yml up -d postgres
echo "    Waiting for postgres to be healthy..."
until [ "$(docker compose -f docker-compose.ec2.yml ps -q postgres | xargs docker inspect -f '{{.State.Health.Status}}')" = "healthy" ]; do
  sleep 2
done
docker compose -f docker-compose.ec2.yml run --rm backend npx prisma migrate deploy --schema=../database/schema.prisma

echo "==> 5/5  Start the backend"
docker compose -f docker-compose.ec2.yml up -d

echo
echo "Done. Check status with:  docker compose -f docker-compose.ec2.yml ps"
echo "Tail logs with:           docker compose -f docker-compose.ec2.yml logs -f backend"
echo "Health check:             curl http://localhost:2567/health"
