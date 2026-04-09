import type { Request } from "express";

const HEADER = "x-user-id";
const DEV_QUERY_KEYS = ["x-user-id", "userId"] as const;

/**
 * Resolves the authenticated user id for matching routes.
 * In development, the client may send `x-user-id` for local fake users.
 * In production, the gateway must set `x-user-id` after real auth; the browser does not send fake identities.
 */
export function resolveEffectiveUserIdFromRequest(req: Request): string | null {
  const raw = req.header(HEADER);
  if (raw !== undefined && raw.trim() !== "") {
    return raw.trim();
  }

  // Keepalive/sendBeacon cannot set custom headers; allow query fallback in non-prod only.
  if (process.env["NODE_ENV"] !== "production") {
    for (const key of DEV_QUERY_KEYS) {
      const q = req.query[key];
      const v = typeof q === "string" ? q.trim() : "";
      if (v !== "") return v;
    }
  }
  return null;
}
