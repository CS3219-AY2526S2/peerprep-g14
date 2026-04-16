import rateLimit from "express-rate-limit";
import type { Request } from "express";

function keyByUser(req: Request): string {
  const u = req.userId;
  if (typeof u === "string" && u.length > 0) {
    return `user:${u}`;
  }
  return `ip:${req.ip ?? "unknown"}`;
}

const createWindowMs = 15 * 60 * 1000;
const createMax = Number.parseInt(
  process.env.MATCH_RATE_LIMIT_CREATE_MAX ?? "40",
  10,
);

const generalWindowMs = 60 * 1000;
const generalMax = Number.parseInt(
  process.env.MATCH_RATE_LIMIT_GENERAL_MAX ?? "300",
  10,
);

/** POST /matching/requests — cap rapid create / retry storms */
export const matchingCreateLimiter = rateLimit({
  windowMs: createWindowMs,
  max: Number.isFinite(createMax) && createMax > 0 ? createMax : 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => keyByUser(req as Request),
  message: {
    error: "Too many create attempts. Please wait and try again.",
  },
});

/** All other authenticated matching routes (GET/DELETE/POST actions) */
export const matchingGeneralLimiter = rateLimit({
  windowMs: generalWindowMs,
  max: Number.isFinite(generalMax) && generalMax > 0 ? generalMax : 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => keyByUser(req as Request),
  message: {
    error: "Too many requests. Please slow down.",
  },
});
