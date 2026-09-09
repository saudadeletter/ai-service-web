import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalDb = globalThis as unknown as { aiServiceDb?: PrismaClient };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  if (!globalDb.aiServiceDb) {
    const poolSize = Number(process.env.DATABASE_POOL_SIZE || 5);
    if (!Number.isInteger(poolSize) || poolSize < 1 || poolSize > 20)
      throw new Error("Invalid DATABASE_POOL_SIZE");
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: poolSize,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    });
    globalDb.aiServiceDb = new PrismaClient({ adapter });
  }
  return globalDb.aiServiceDb;
}
