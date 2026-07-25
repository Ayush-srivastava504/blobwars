# Build context: repo root (see docker-compose.yml)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY backend/package.json ./backend/package.json
COPY shared/package.json ./shared/package.json
COPY frontend/package.json ./frontend/package.json
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund --workspace=backend --workspace=shared --include-workspace-root

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared ./shared
COPY backend ./backend
COPY database ./database
WORKDIR /app/backend
RUN npx prisma generate --schema=../database/schema.prisma
EXPOSE 2567
CMD ["npx", "tsx", "src/index.ts"]
