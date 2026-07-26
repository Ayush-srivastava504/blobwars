// Shared Prisma client singleton, cached on globalThis in dev so hot
// reloads don't exhaust database connections. Production always gets
// a fresh instance per process start.
// Imported by routes and the match repository for all DB access.
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.__prisma = prisma;
