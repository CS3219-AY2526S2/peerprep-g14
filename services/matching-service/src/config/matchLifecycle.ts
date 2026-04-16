/**
 * F8 — max wait for a PENDING match request before automatic TIMED_OUT.
 * Set `MATCH_TIMEOUT_SECONDS` in the environment (e.g. `10` for local testing).
 */
export function getMatchTimeoutSeconds(): number {
  const raw = process.env.MATCH_TIMEOUT_SECONDS;
  if (raw === undefined || String(raw).trim() === "") {
    return 60;
  }
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) {
    return 60;
  }
  return n;
}

/** Human-readable copy for API responses when status is TIMED_OUT */
export const MATCH_REQUEST_TIMEOUT_MESSAGE =
  "No match was found within the time limit. You can try again from the dashboard.";

/**
 * F9 — grace period to reconnect after temporary disconnect while PENDING.
 * Set `RECONNECT_GRACE_SECONDS` (e.g. `10` for quick local tests).
 */
export function getReconnectGraceSeconds(): number {
  const raw = process.env.RECONNECT_GRACE_SECONDS;
  if (raw === undefined || String(raw).trim() === "") {
    return 30;
  }
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) {
    return 30;
  }
  return n;
}

export const MATCH_REQUEST_RECONNECT_EXPIRED_MESSAGE =
  "Your previous match request expired while disconnected. Please start a new search from the dashboard.";
