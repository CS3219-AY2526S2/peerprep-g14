import type { Response } from "express";

const subscribers = new Map<string, Set<Response>>();

function detach(requestId: string, res: Response): void {
  const set = subscribers.get(requestId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    subscribers.delete(requestId);
  }
}

/**
 * Register `res` for push events for this match request id.
 * Caller must set SSE headers, send the initial snapshot, and call `unsubscribeMatchRequestSse` on disconnect.
 */
export function subscribeMatchRequestSse(requestId: string, res: Response): void {
  let set = subscribers.get(requestId);
  if (!set) {
    set = new Set();
    subscribers.set(requestId, set);
  }
  set.add(res);
}

export function unsubscribeMatchRequestSse(requestId: string, res: Response): void {
  detach(requestId, res);
}

function writeEvent(
  res: Response,
  event: string,
  data: unknown,
): boolean {
  if (res.writableEnded) {
    return false;
  }
  try {
    const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    res.write(line);
    return true;
  } catch {
    return false;
  }
}

/** Push the same JSON shape as `GET /matching/requests/:id` to all listeners for that request. */
export function broadcastMatchRequestDto(requestId: string, dto: unknown): void {
  const set = subscribers.get(requestId);
  if (!set?.size) {
    return;
  }
  for (const res of [...set]) {
    if (!writeEvent(res, "match_request", dto)) {
      detach(requestId, res);
    }
  }
}
