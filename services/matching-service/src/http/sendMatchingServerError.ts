import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

const PUBLIC_ERROR_MESSAGE = "Could not complete the request" as const;

/** Prisma “transient / infra” codes → HTTP 503 (see Prisma error reference). */
const PRISMA_TRANSIENT_503 = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
]);

function routeLabel(req: Request): string {
  const path = `${req.baseUrl ?? ""}${req.path}`;
  return `${req.method} ${path}`;
}

function getErrorName(err: unknown): string {
  if (err instanceof Error) return err.name;
  return "Unknown";
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Walk `cause` chain; Prisma uses `code` Pxxxx; PostgreSQL driver often uses SQLSTATE (5 chars).
 */
function extractPrismaAndPgCodes(err: unknown): {
  prismaCode?: string;
  pgCode?: string;
} {
  let prismaCode: string | undefined;
  let pgCode: string | undefined;
  let cur: unknown = err;
  for (let depth = 0; depth < 10 && cur !== undefined && cur !== null; depth++) {
    if (typeof cur === "object" && cur !== null && "code" in cur) {
      const code = (cur as { code: unknown }).code;
      if (typeof code === "string") {
        if (/^P[0-9]{4}$/.test(code)) {
          prismaCode ??= code;
        } else if (/^[0-9A-Z]{5}$/.test(code) && !code.startsWith("P")) {
          pgCode ??= code;
        }
      }
    }
    cur =
      typeof cur === "object" && cur !== null && "cause" in cur
        ? (cur as { cause: unknown }).cause
        : undefined;
  }
  const out: { prismaCode?: string; pgCode?: string } = {};
  if (prismaCode !== undefined) out.prismaCode = prismaCode;
  if (pgCode !== undefined) out.pgCode = pgCode;
  return out;
}

function isPrismaClientInitializationError(err: unknown): boolean {
  return err instanceof Error && err.name === "PrismaClientInitializationError";
}

function httpStatusForError(err: unknown): 503 | 500 {
  if (isPrismaClientInitializationError(err)) {
    return 503;
  }

  const { prismaCode } = extractPrismaAndPgCodes(err);
  if (prismaCode && PRISMA_TRANSIENT_503.has(prismaCode)) {
    return 503;
  }

  const errno = err as NodeJS.ErrnoException | undefined;
  if (
    errno &&
    typeof errno.code === "string" &&
    ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(errno.code)
  ) {
    return 503;
  }

  const msg = getErrorMessage(err).toLowerCase();
  if (
    msg.includes("econnrefused") ||
    msg.includes("connection refused") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("server closed the connection")
  ) {
    return 503;
  }

  return 500;
}

/**
 * Structured server error: one JSON log line per failure (no x-request-id).
 * `errorId` is always returned in the JSON body so clients/support can correlate with server logs
 * without exposing internal error details (message stays generic).
 */
export function sendMatchingServerError(
  req: Request,
  res: Response,
  err: unknown,
): void {
  const errorId = randomUUID();
  const { prismaCode, pgCode } = extractPrismaAndPgCodes(err);
  const status = httpStatusForError(err);

  const logLine = {
    service: "matching-service",
    errorId,
    route: routeLabel(req),
    userId: req.userId ?? null,
    prismaCode: prismaCode ?? null,
    pgCode: pgCode ?? null,
    errorName: getErrorName(err),
    message: getErrorMessage(err),
  };

  console.error(JSON.stringify(logLine));

  res.status(status).json({
    error: PUBLIC_ERROR_MESSAGE,
    errorId,
  });
}
