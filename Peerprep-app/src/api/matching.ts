/**
 * Base URL for the matching API (matching-service listens on port **3003**; question-service is 3002).
 * - In Vite dev, use same-origin `/matching/...` (proxied to the gateway or `localhost:3003` — see vite.config.ts).
 * - Set `VITE_MATCHING_SERVICE_URL` (e.g. `http://localhost:3003`) when not using the proxy.
 */
export function getMatchingServiceBaseUrl(): string {
  const envUrl = import.meta.env.VITE_MATCHING_SERVICE_URL as string | undefined;
  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "";
  }
  return "http://localhost:3003";
}

function matchingFetchInit(
  effectiveUserId: string | null,
  init: RequestInit = {},
): RequestInit {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  // Fake / local testing: only the dev build sends x-user-id from the browser.
  // Production relies on the gateway to set x-user-id after auth (do not send from client).
  if (import.meta.env.DEV && effectiveUserId) {
    headers.set("x-user-id", effectiveUserId);
  }

  return {
    ...init,
    headers,
    credentials: import.meta.env.PROD ? "include" : "same-origin",
  };
}

export type MatchRequestResponse = {
  id: string;
  userId: string;
  topic: string;
  difficulty: string;
  programmingLanguage: string;
  allowLowerDifficultyMatch: boolean;
  /** F2 — optional minutes preference */
  timeAvailableMinutes: number | null;
  status:
    | "PENDING"
    | "MATCHED"
    | "CANCELLED"
    | "TIMED_OUT"
    | "RECONNECT_EXPIRED";
  /** F8 / F9 — when status is TIMED_OUT or RECONNECT_EXPIRED */
  message: string | null;
  /** F9 — temporary disconnect (grace) */
  disconnectedAt: string | null;
  reconnectDeadlineAt: string | null;
  peerUserId: string | null;
  peerMatchRequestId: string | null;
  peer: { userId: string; matchRequestId: string } | null;
  /** Partner’s requested difficulty when MATCHED */
  peerRequestedDifficulty: string | null;
  /** Partner’s time preference when MATCHED */
  peerTimeAvailableMinutes: number | null;
  /** Both specified and equal; else null */
  matchedTimeAvailableMinutes: number | null;
  /** Same-difficulty vs cross-level (downward) match when MATCHED */
  matchingType: "same_difficulty" | "downward" | null;
  /** When PENDING: match-wait deadline (for display). Null otherwise. */
  expiresAt: string | null;
  /** Server match timeout seconds (display cap only). */
  matchTimeoutSeconds: number;
  createdAt: string;
  updatedAt: string;
};

export async function createMatchRequest(
  effectiveUserId: string | null,
  body: {
    topic: string;
    difficulty: string;
    programmingLanguage: string;
    allowLowerDifficultyMatch?: boolean;
    /** Omit when user leaves “no preference” */
    timeAvailableMinutes?: number;
  },
): Promise<
  { ok: true; data: MatchRequestResponse } | { ok: false; status: number; message: string }
> {
  const base = getMatchingServiceBaseUrl();
  const url = `${base}/matching/requests`;

  let res: Response;
  try {
    res = await fetch(
      url,
      matchingFetchInit(effectiveUserId, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  } catch (e) {
    const hint = e instanceof Error ? e.message : "Network error";
    return {
      ok: false,
      status: 0,
      message: `Cannot reach matching service (${hint}). Start it with: cd services/matching-service && npm run dev`,
    };
  }

  if (res.ok) {
    const data = (await res.json()) as MatchRequestResponse;
    return { ok: true, data };
  }

  let message = res.statusText;
  try {
    const err = (await res.json()) as { error?: string; details?: string[] };
    if (err.error) message = err.error;
    else if (err.details?.length) message = err.details.join("; ");
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message };
}

export async function disconnectMatchRequest(
  effectiveUserId: string | null,
  requestId: string,
): Promise<
  { ok: true; data: MatchRequestResponse } | { ok: false; status: number; message: string }
> {
  const base = getMatchingServiceBaseUrl();
  const url = `${base}/matching/requests/${encodeURIComponent(requestId)}/disconnect`;

  let res: Response;
  try {
    res = await fetch(
      url,
      matchingFetchInit(effectiveUserId, {
        method: "POST",
        body: "{}",
      }),
    );
  } catch (e) {
    const hint = e instanceof Error ? e.message : "Network error";
    return { ok: false, status: 0, message: hint };
  }

  if (res.ok) {
    const data = (await res.json()) as MatchRequestResponse;
    return { ok: true, data };
  }

  let message = res.statusText;
  try {
    const err = (await res.json()) as { error?: string };
    if (err.error) message = err.error;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message };
}

export async function reconnectMatchRequest(
  effectiveUserId: string | null,
  requestId: string,
): Promise<
  { ok: true; data: MatchRequestResponse } | { ok: false; status: number; message: string }
> {
  const base = getMatchingServiceBaseUrl();
  const url = `${base}/matching/requests/${encodeURIComponent(requestId)}/reconnect`;

  let res: Response;
  try {
    res = await fetch(
      url,
      matchingFetchInit(effectiveUserId, {
        method: "POST",
        body: "{}",
      }),
    );
  } catch (e) {
    const hint = e instanceof Error ? e.message : "Network error";
    return { ok: false, status: 0, message: hint };
  }

  if (res.ok) {
    const data = (await res.json()) as MatchRequestResponse;
    return { ok: true, data };
  }

  let message = res.statusText;
  try {
    const err = (await res.json()) as { error?: string };
    if (err.error) message = err.error;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message };
}

/**
 * Fire-and-forget disconnect for page unload (F9). Uses keepalive so the request may complete after navigation.
 */
export function disconnectMatchRequestKeepalive(
  effectiveUserId: string | null,
  requestId: string,
): void {
  const base = getMatchingServiceBaseUrl();
  const rawUrl = `${base}/matching/requests/${encodeURIComponent(requestId)}/disconnect`;
  const withUserQuery =
    import.meta.env.DEV && effectiveUserId
      ? `${rawUrl}?userId=${encodeURIComponent(effectiveUserId)}`
      : rawUrl;

  // Beacon is most reliable during tab close/navigation; dev user id goes via query.
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const body = new Blob(["{}"], { type: "text/plain;charset=UTF-8" });
    if (navigator.sendBeacon(withUserQuery, body)) {
      return;
    }
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (import.meta.env.DEV && effectiveUserId) {
    headers.set("x-user-id", effectiveUserId);
  }
  void fetch(withUserQuery, {
    method: "POST",
    headers,
    body: "{}",
    keepalive: true,
    credentials: import.meta.env.PROD ? "include" : "same-origin",
  });
}

export async function getMatchRequest(
  effectiveUserId: string | null,
  requestId: string,
): Promise<
  | { ok: true; data: MatchRequestResponse }
  | { ok: false; status: number; message: string }
> {
  const base = getMatchingServiceBaseUrl();
  const url = `${base}/matching/requests/${encodeURIComponent(requestId)}`;

  let res: Response;
  try {
    res = await fetch(
      url,
      matchingFetchInit(effectiveUserId, { method: "GET" }),
    );
  } catch (e) {
    const hint = e instanceof Error ? e.message : "Network error";
    return {
      ok: false,
      status: 0,
      message: `Cannot reach matching service (${hint})`,
    };
  }

  if (res.ok) {
    const data = (await res.json()) as MatchRequestResponse;
    return { ok: true, data };
  }

  let message = res.statusText;
  try {
    const err = (await res.json()) as { error?: string };
    if (err.error) message = err.error;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message };
}

export async function getActiveMatchRequest(
  effectiveUserId: string | null,
): Promise<
  | { ok: true; data: MatchRequestResponse }
  | { ok: false; status: number; message: string }
> {
  const base = getMatchingServiceBaseUrl();
  const url = `${base}/matching/requests/active`;

  let res: Response;
  try {
    res = await fetch(
      url,
      matchingFetchInit(effectiveUserId, { method: "GET" }),
    );
  } catch (e) {
    const hint = e instanceof Error ? e.message : "Network error";
    return {
      ok: false,
      status: 0,
      message: `Cannot reach matching service (${hint})`,
    };
  }

  if (res.ok) {
    const data = (await res.json()) as MatchRequestResponse;
    return { ok: true, data };
  }

  let message = res.statusText;
  try {
    const err = (await res.json()) as { error?: string };
    if (err.error) message = err.error;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message };
}

export async function getLatestMatchRequest(
  effectiveUserId: string | null,
): Promise<
  | { ok: true; data: MatchRequestResponse }
  | { ok: false; status: number; message: string }
> {
  const base = getMatchingServiceBaseUrl();
  const url = `${base}/matching/requests/latest`;

  let res: Response;
  try {
    res = await fetch(
      url,
      matchingFetchInit(effectiveUserId, { method: "GET" }),
    );
  } catch (e) {
    const hint = e instanceof Error ? e.message : "Network error";
    return {
      ok: false,
      status: 0,
      message: `Cannot reach matching service (${hint})`,
    };
  }

  if (res.ok) {
    const data = (await res.json()) as MatchRequestResponse;
    return { ok: true, data };
  }

  let message = res.statusText;
  try {
    const err = (await res.json()) as { error?: string };
    if (err.error) message = err.error;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message };
}

export async function cancelMatchRequest(
  effectiveUserId: string | null,
  requestId: string,
): Promise<
  { ok: true; data: MatchRequestResponse } | { ok: false; status: number; message: string }
> {
  const base = getMatchingServiceBaseUrl();
  const url = `${base}/matching/requests/${encodeURIComponent(requestId)}`;

  let res: Response;
  try {
    res = await fetch(
      url,
      matchingFetchInit(effectiveUserId, { method: "DELETE" }),
    );
  } catch (e) {
    const hint = e instanceof Error ? e.message : "Network error";
    return {
      ok: false,
      status: 0,
      message: `Cannot reach matching service (${hint}). Is it running on port 3003?`,
    };
  }

  if (res.ok) {
    const data = (await res.json()) as MatchRequestResponse;
    return { ok: true, data };
  }

  let message = res.statusText;
  try {
    const err = (await res.json()) as { error?: string };
    if (err.error) message = err.error;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message };
}
