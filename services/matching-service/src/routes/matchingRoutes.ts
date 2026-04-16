import { Router, type Request, type Response } from "express";
import {
  MatchRequestValidationError,
  parseCreateMatchRequestBody,
} from "../validation/matchRequestValidation.js";
import {
  acceptFallbackSuggestion,
  cancelMatchRequestForUser,
  createMatchRequest,
  disconnectMatchRequestForUser,
  getActiveMatchRequestForUser,
  getMatchRequestForUser,
  reconnectMatchRequestForUser,
} from "../services/matchRequestService.js";
import {
  AcceptFallbackValidationError,
  parseAcceptFallbackBody,
} from "../validation/acceptFallbackValidation.js";
import { requireUserId } from "../middleware/requireUserId.js";
import {
  matchingCreateLimiter,
  matchingGeneralLimiter,
} from "../middleware/rateLimits.js";
import { sendMatchingServerError } from "../http/sendMatchingServerError.js";
import {
  subscribeMatchRequestSse,
  unsubscribeMatchRequestSse,
} from "../sse/matchRequestSseHub.js";

const router = Router();

router.post(
  "/requests",
  requireUserId,
  matchingGeneralLimiter,
  matchingCreateLimiter,
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    try {
      const input = parseCreateMatchRequestBody(req.body);
      const result = await createMatchRequest(userId, input);
      if (!result.ok) {
        res.status(409).json({
          error:
            "You already have an active match request. Cancel it before starting a new one.",
        });
        return;
      }
      res.status(201).json(result.data);
    } catch (e) {
      if (e instanceof MatchRequestValidationError) {
        res.status(400).json({ error: "Validation failed", details: e.issues });
        return;
      }
      sendMatchingServerError(req, res, e);
    }
  },
);

router.get(
  "/requests/active",
  requireUserId,
  matchingGeneralLimiter,
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    try {
      const row = await getActiveMatchRequestForUser(userId);
      if (!row) {
        res.status(204).end();
        return;
      }
      res.status(200).json(row);
    } catch (e) {
      sendMatchingServerError(req, res, e);
    }
  },
);

router.get(
  "/requests/:id/events",
  requireUserId,
  matchingGeneralLimiter,
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const id = req.params["id"];
    if (typeof id !== "string") {
      res.status(400).json({ error: "Invalid request id" });
      return;
    }
    try {
      const row = await getMatchRequestForUser(id, userId);
      if (!row) {
        res.status(404).json({ error: "Match request not found" });
        return;
      }

      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }

      const writeSse = (event: string, data: unknown): void => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      writeSse("snapshot", row);
      subscribeMatchRequestSse(id, res);

      const pingMs = 25_000;
      const ping = setInterval(() => {
        if (res.writableEnded) {
          return;
        }
        try {
          res.write(`: ping ${Date.now()}\n\n`);
        } catch {
          /* ignore */
        }
      }, pingMs);

      let cleaned = false;
      const cleanup = (): void => {
        if (cleaned) return;
        cleaned = true;
        clearInterval(ping);
        unsubscribeMatchRequestSse(id, res);
      };
      req.on("close", cleanup);
      res.on("close", cleanup);
    } catch (e) {
      sendMatchingServerError(req, res, e);
    }
  },
);

router.get(
  "/requests/:id",
  requireUserId,
  matchingGeneralLimiter,
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const id = req.params["id"];
    if (typeof id !== "string") {
      res.status(400).json({ error: "Invalid request id" });
      return;
    }
    try {
      const row = await getMatchRequestForUser(id, userId);
      if (!row) {
        res.status(404).json({ error: "Match request not found" });
        return;
      }
      res.status(200).json(row);
    } catch (e) {
      sendMatchingServerError(req, res, e);
    }
  },
);

router.post(
  "/requests/:id/accept-fallback",
  requireUserId,
  matchingGeneralLimiter,
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const id = req.params["id"];
    if (typeof id !== "string") {
      res.status(400).json({ error: "Invalid request id" });
      return;
    }
    try {
      const body = parseAcceptFallbackBody(req.body);
      const result = await acceptFallbackSuggestion(userId, id, body);
      if (result.ok) {
        res.status(200).json(result.data);
        return;
      }
      if (result.code === "NOT_FOUND") {
        res.status(404).json({ error: "Match request not found" });
        return;
      }
      if (result.code === "NOT_PENDING") {
        res.status(409).json({
          error: "Only an active waiting match request can be updated",
        });
        return;
      }
      if (result.code === "DISCONNECTED") {
        res.status(409).json({
          error:
            "Reconnect your session before changing search options, or cancel from the dashboard.",
        });
        return;
      }
      if (result.code === "CONFLICT") {
        res.status(409).json({
          error:
            "You already have an active match request. Cancel it before starting a new one.",
        });
        return;
      }
      res.status(409).json({
        error:
          "This suggestion is no longer available. Refresh the page for updated options.",
      });
    } catch (e) {
      if (e instanceof AcceptFallbackValidationError) {
        res.status(400).json({ error: "Validation failed", details: e.issues });
        return;
      }
      sendMatchingServerError(req, res, e);
    }
  },
);

router.delete(
  "/requests/:id",
  requireUserId,
  matchingGeneralLimiter,
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const id = req.params["id"];
    if (typeof id !== "string") {
      res.status(400).json({ error: "Invalid request id" });
      return;
    }
    try {
      const result = await cancelMatchRequestForUser(id, userId);
      if (result.ok) {
        res.status(200).json(result.data);
        return;
      }
      if (result.code === "NOT_FOUND") {
        res.status(404).json({ error: "Match request not found" });
        return;
      }
      if (result.code === "TIMED_OUT") {
        res.status(409).json({
          error:
            "This match request has timed out and cannot be cancelled. Start a new search from the dashboard.",
        });
        return;
      }
      if (result.code === "RECONNECT_EXPIRED") {
        res.status(409).json({
          error:
            "This match request expired while you were disconnected. Start a new search from the dashboard.",
        });
        return;
      }
      res.status(409).json({
        error: "Only pending match requests can be cancelled",
      });
    } catch (e) {
      sendMatchingServerError(req, res, e);
    }
  },
);

router.post(
  "/requests/:id/disconnect",
  requireUserId,
  matchingGeneralLimiter,
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const id = req.params["id"];
    if (typeof id !== "string") {
      res.status(400).json({ error: "Invalid request id" });
      return;
    }
    try {
      const result = await disconnectMatchRequestForUser(id, userId);
      if (result.ok) {
        res.status(200).json(result.data);
        return;
      }
      if (result.code === "NOT_FOUND") {
        res.status(404).json({ error: "Match request not found" });
        return;
      }
      res.status(409).json({
        error: "Only an active waiting match request can be marked disconnected",
      });
    } catch (e) {
      sendMatchingServerError(req, res, e);
    }
  },
);

router.post(
  "/requests/:id/reconnect",
  requireUserId,
  matchingGeneralLimiter,
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const id = req.params["id"];
    if (typeof id !== "string") {
      res.status(400).json({ error: "Invalid request id" });
      return;
    }
    try {
      const result = await reconnectMatchRequestForUser(id, userId);
      if (result.ok) {
        res.status(200).json(result.data);
        return;
      }
      if (result.code === "NOT_FOUND") {
        res.status(404).json({ error: "Match request not found" });
        return;
      }
      if (result.code === "RECONNECT_EXPIRED") {
        res.status(409).json({
          error:
            "Reconnect grace has expired. You can start a new search from the dashboard.",
        });
        return;
      }
      if (result.code === "NOT_DISCONNECTED") {
        res.status(409).json({
          error: "This request is not in a disconnected state",
        });
        return;
      }
      res.status(409).json({
        error: "Only a pending match request can be reconnected",
      });
    } catch (e) {
      sendMatchingServerError(req, res, e);
    }
  },
);

export default router;
