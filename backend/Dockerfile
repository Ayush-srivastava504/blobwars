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