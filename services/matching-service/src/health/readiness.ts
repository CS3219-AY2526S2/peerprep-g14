import amqplib from "amqplib";
import prisma from "../prisma.js";

const READY_TIMEOUT_MS = Number.parseInt(
  process.env.READINESS_TIMEOUT_MS ?? "5000",
  10,
);

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("check timed out")), ms),
    ),
  ]);
}

export type ReadinessResult = {
  ok: boolean;
  checks: Record<string, string>;
};

/**
 * Orchestration readiness: Postgres required; RabbitMQ checked only when `RABBITMQ_URL` is set.
 */
export async function runReadinessChecks(): Promise<ReadinessResult> {
  const checks: Record<string, string> = {};

  try {
    await withTimeout(
      prisma.$queryRaw`SELECT 1 as readiness_check`,
      READY_TIMEOUT_MS,
    );
    checks.postgres = "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    checks.postgres = msg;
    return { ok: false, checks };
  }

  const rabbitUrl = process.env.RABBITMQ_URL?.trim();
  if (!rabbitUrl) {
    checks.rabbitmq = "skipped";
    return { ok: true, checks };
  }

  let conn: Awaited<ReturnType<typeof amqplib.connect>> | null = null;
  try {
    conn = await withTimeout(amqplib.connect(rabbitUrl), READY_TIMEOUT_MS);
    await conn.close();
    checks.rabbitmq = "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    checks.rabbitmq = msg;
    if (conn) {
      try {
        await conn.close();
      } catch {
        /* ignore */
      }
    }
    return { ok: false, checks };
  }

  return { ok: true, checks };
}
