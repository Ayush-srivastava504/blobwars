FROM node:20-bookworm-slim AS deps

RUN apt-get update && \
    apt-get install -y git openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY package-lock.json* ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY shared/package.json ./shared/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund \
    --workspace=backend \
    --workspace=shared \
    --include-workspace-root

FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY backend ./backend
COPY shared ./shared
COPY database ./database

WORKDIR /app/backend

RUN npx prisma generate --schema=../database/schema.prisma

FROM node:20-bookworm-slim AS runner

RUN apt-get update && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app ./

WORKDIR /app/backend

EXPOSE 2567

CMD ["npx", "tsx", "src/index.ts"]
