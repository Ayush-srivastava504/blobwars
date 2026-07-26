# Build context: repo root (see docker-compose.yml)
# Build context: repo root (see docker-compose.yml)

FROM node:20-alpine AS deps

RUN apk add --no-cache git

WORKDIR /app

COPY package.json ./
COPY package-lock.json* ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
COPY shared/package.json ./shared/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund \
    --workspace=frontend \
    --workspace=shared \
    --include-workspace-root

FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY frontend ./frontend
COPY shared ./shared

WORKDIR /app/frontend

ARG NEXT_PUBLIC_GAME_SERVER_WS
ARG NEXT_PUBLIC_GAME_SERVER_HTTP
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

ENV NEXT_PUBLIC_GAME_SERVER_WS=${NEXT_PUBLIC_GAME_SERVER_WS}
ENV NEXT_PUBLIC_GAME_SERVER_HTTP=${NEXT_PUBLIC_GAME_SERVER_HTTP}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public

EXPOSE 3000

CMD ["node", "frontend/server.js"]
