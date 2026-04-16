import type { RequestHandler } from "express";

const HEADER = "x-user-id";

function resolveEffectiveUserIdFromRequest(
  req: Parameters<RequestHandler>[0],
): string | null {
  const raw = req.header(HEADER);
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  return raw.trim();
}

/** Requires a non-empty `x-user-id` (gateway-injected from JWT). */
export const requireUserId: RequestHandler = (req, res, next) => {
  const id = resolveEffectiveUserIdFromRequest(req);
  if (!id) {
    res.status(401).json({ error: "Missing or empty x-user-id header" });
    return;
  }
  req.userId = id;
  next();
};
