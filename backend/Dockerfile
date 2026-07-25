# ---------- Dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache git

COPY package.json ./
COPY backend/package.json ./backend/package.json
COPY shared/package.json ./shared/package.json
COPY frontend/package.json ./frontend/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund \
    --workspace=backend \
    --workspace=shared \
    --include-workspace-root

# ---------- Runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache git

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY backend ./backend
COPY shared ./shared
COPY database ./database

WORKDIR /app/backend

RUN npx prisma generate --schema=../database/schema.prisma

EXPOSE 2567

CMD ["npx", "tsx", "src/index.ts"]