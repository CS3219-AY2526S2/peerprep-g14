import { Router, type Request, type Response } from "express";
import {
  MatchRequestValidationError,
  parseCreateMatchRequestBody,
} from "../validation/matchRequestValidation.js";
import {
  cancelMatchRequestForUser,
  createMatchRequest,
  disconnectMatchRequestForUser,
  getActiveMatchRequestForUser,
  getLatestMatchRequestForUser,
  getMatchRequestForUser,
  getResumeMatchRequestForUser,
  reconnectMatchRequestForUser,
} from "../services/matchRequestService.js";
import { requireUserId } from "../middleware/requireUserId.js";

const router = Router();

/** Same shape as other handlers; used when Prisma/IO throws unexpectedly. */
const SERVER_ERROR_BODY = { error: "Could not complete the request" } as const;

function sendServerError(res: Response, err: unknown): void {
  console.error("[matching-routes]", err);
  res.status(500).json(SERVER_ERROR_BODY);
}

router.post(
  "/requests",
  requireUserId,
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
      sendServerError(res, e);
    }
  },
);

router.get(
  "/requests/active",
  requireUserId,
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    try {
      const row = await getActiveMatchRequestForUser(userId);
      if (!row) {
        res.status(404).json({ error: "No active match request" });
        return;
      }
      res.status(200).json(row);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

router.get(
  "/requests/latest",
  requireUserId,
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    try {
      const row = await getLatestMatchRequestForUser(userId);
      if (!row) {
        res.status(404).json({ error: "No recent match request" });
        return;
      }
      res.status(200).json(row);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

router.get(
  "/requests/resume",
  requireUserId,
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    try {
      const row = await getResumeMatchRequestForUser(userId);
      if (!row) {
        res.status(404).json({ error: "No resumable match request" });
        return;
      }
      res.status(200).json(row);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

router.get(
  "/requests/:id",
  requireUserId,
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
      sendServerError(res, e);
    }
  },
);

router.delete(
  "/requests/:id",
  requireUserId,
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
      sendServerError(res, e);
    }
  },
);

router.post(
  "/requests/:id/disconnect",
  requireUserId,
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
      sendServerError(res, e);
    }
  },
);

router.post(
  "/requests/:id/reconnect",
  requireUserId,
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
      sendServerError(res, e);
    }
  },
);

export default router;
