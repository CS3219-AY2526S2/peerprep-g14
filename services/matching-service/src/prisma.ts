import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

/**
 * Pool tuning (override via env — keep below your Supabase / Postgres max connections).
 * - PG_POOL_MAX — default 10 (was 2; reduces queueing under concurrent HTTP + tryMatchQueueAndPublish)
 * - PG_CONNECTION_TIMEOUT_MS — default 10000 (wait for a free pool slot / TCP connect)
 * - PG_POOL_IDLE_MS — default 30000 (close idle clients)
 * - PG_STATEMENT_TIMEOUT_MS — optional; PostgreSQL `statement_timeout` in ms (0 = disable server-side limit)
 */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const poolMax = parsePositiveInt(process.env.PG_POOL_MAX, 10);
const connectionTimeoutMillis = parsePositiveInt(
  process.env.PG_CONNECTION_TIMEOUT_MS,
  10_000,
);
const idleTimeoutMillis = parsePositiveInt(process.env.PG_POOL_IDLE_MS, 30_000);
const statementTimeoutMsRaw = process.env.PG_STATEMENT_TIMEOUT_MS?.trim();

const pool = new pg.Pool({
  connectionString,
  max: poolMax > 0 ? poolMax : 10,
  idleTimeoutMillis,
  connectionTimeoutMillis: connectionTimeoutMillis > 0 ? connectionTimeoutMillis : 10_000,
});

if (statementTimeoutMsRaw !== undefined && statementTimeoutMsRaw !== "") {
  const ms = Number.parseInt(statementTimeoutMsRaw, 10);
  if (Number.isFinite(ms) && ms >= 0) {
    pool.on("connect", (client) => {
      void client.query(`SET statement_timeout TO ${ms}`);
    });
  }
}

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;

/** Call after HTTP server has stopped accepting work; closes Prisma then the pg pool. */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
}
