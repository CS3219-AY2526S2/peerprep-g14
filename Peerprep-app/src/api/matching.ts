/**
 * Matching API is always reached via the gateway: `/api/matching` → auth (JWT cookies) → matching-service.
 * The SPA must be served on an origin where `/api` routes to that gateway (production) or Vite proxies `/api` in dev.
 */
export function getMatchingApiPrefix(): string {
  return "/api/matching";
}

function matchingFetchInit(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return {
    ...init,
    headers,
    /** Required for httpOnly session cookies through the auth gateway. */
    credentials: "include",
  };
}

export type FallbackSuggestionAction =
  | { type: "update_request"; patch: { allowLowerDifficultyMatch: boolean } }
  | { type: "create_new_request"; newCriteria: { topic: string } };

export type FallbackSuggestion = {
  type:
    | "enable_downward_matching"
    | "switch_topic_nearby"
    | "switch_topic_popular";
  title: string;
  description: string;
  action: FallbackSuggestionAction;
};

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
  /** Server-side wait duration when status is PENDING (connected). */
  waitTimeMs?: number;
  /** Advisory; accept via `acceptFallbackSuggestion`. Included for `PENDING` while waiting and for `TIMED_OUT` so suggestions stay visible after timeout / return visits. */
  fallbackSuggestions?: FallbackSuggestion[];
};

export async function createMatchRequest(body: {
  topic: string;
  difficulty: string;
  programmingLanguage: string;
  allowLowerDifficultyMatch?: boolean;
  /** Omit when user leaves “no preference” */
  timeAvailableMinutes?: number;
}): Promise<
  { ok: true; data: MatchRequestResponse } | { ok: false; status: number; message: string }
> {
  const prefix = getMatchingApiPrefix();
  const url = `${prefix}/requests`;

  let res: Response;
  try {
    res = await fetch(
      url,
      matchingFetchInit({
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  } catch (e) {
    const hint = e instanceof Error ? e.message : "Network error";
    return {
      ok: false,
      status: 0,
      message: `Cannot reach matching service (${hint}).`,
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
  requestId: string,
): Promise<
  { ok: true; data: MatchRequestResponse } | { ok: false; status: number; message: string }
> {
  const prefix = getMatchingApiPrefix();
  const url = `${prefix}/requests/${encodeURIComponent(requestId)}/disconnect`;

  let res: Response;
  try {
    res = await fetch(
      url,
      matchingFetchInit({
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
  requestId: string,
): Promise<
  { ok: true; data: MatchRequestResponse } | { ok: false; status: number; message: string }
> {
  const prefix = getMatchingApiPrefix();
  const url = `${prefix}/requests/${encodeURIComponent(requestId)}/reconnect`;

  let res: Response;
  try {
    res = await fetch(
      url,
      matchingFetchInit({
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
 * Fire-and-forget disconnect for tab close / navigation (F9).
 * Prefer `sendBeacon` (more reliable on unload); fall back to `fetch({ keepalive: true })`.
 */
export function disconnectMatchRequestKeepalive(requestId: string): void {
  const prefix = getMatchingApiPrefix();
  const url = `${prefix}/requests/${encodeURIComponent(requestId)}/disconnect`;
  const body = "{}";
  const blob = new Blob([body], { type: "application/json" });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const ok = navigator.sendBeacon(url, blob);
    if (ok) return;
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  void fetch(url, {
    method: "POST",
    headers,
    body,
    keepalive: true,
    credentials: "include",
  });
}

/**
 * Current user’s single PENDING match request, if any (`GET .../requests/active` → 200 or 204).
 */
export async function getActiveMatchRequest(): Promise<
  | { ok: true; data: MatchRequestResponse }
  | { ok: false; status: number; message: string }
> {
  const prefix = getMatchingApiPrefix();
  const url = `${prefix}/requests/active`;

  let res: Response;
  try {
    res = await fetch(url, matchingFetchInit({ method: "GET" }));
  } catch (e) {
    const hint = e instanceof Error ? e.message : "Network error";
    return {
      ok: false,
      status: 0,
      message: `Cannot reach matching service (${hint})`,
    };
  }

  if (res.status === 204) {
    return {
      ok: false,
      status: 204,
      message: "No active match request",
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

/** Relative URL for `EventSource` (same origin as the app → gateway → matching SSE). */
export function getMatchRequestSseUrl(requestId: string): string {
  const prefix = getMatchingApiPrefix();
  return `${prefix}/requests/${encodeURIComponent(requestId)}/events`;
}

export async function getMatchRequest(
  requestId: string,
): Promise<
  | { ok: true; data: MatchRequestResponse }
  | { ok: false; status: number; message: string }
> {
  const prefix = getMatchingApiPrefix();
  const url = `${prefix}/requests/${encodeURIComponent(requestId)}`;

  let res: Response;
  try {
    res = await fetch(url, matchingFetchInit({ method: "GET" }));
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

/** User explicitly accepts an opt-in fallback (downward matching or topic switch). */
export async function acceptFallbackSuggestion(
  requestId: string,
  body:
    | { type: "enable_downward_matching" }
    | { type: "switch_topic_nearby"; topic: string }
    | { type: "switch_topic_popular"; topic: string },
): Promise<
  { ok: true; data: MatchRequestResponse } | { ok: false; status: number; message: string }
> {
  const prefix = getMatchingApiPrefix();
  const url = `${prefix}/requests/${encodeURIComponent(requestId)}/accept-fallback`;

  let res: Response;
  try {
    res = await fetch(
      url,
      matchingFetchInit({
        method: "POST",
        body: JSON.stringify(body),
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
    const err = (await res.json()) as { error?: string; details?: string[] };
    if (err.error) message = err.error;
    else if (err.details?.length) message = err.details.join("; ");
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message };
}

export async function cancelMatchRequest(
  requestId: string,
): Promise<
  { ok: true; data: MatchRequestResponse } | { ok: false; status: number; message: string }
> {
  const prefix = getMatchingApiPrefix();
  const url = `${prefix}/requests/${encodeURIComponent(requestId)}`;

  let res: Response;
  try {
    res = await fetch(url, matchingFetchInit({ method: "DELETE" }));
  } catch (e) {
    const hint = e instanceof Error ? e.message : "Network error";
    return {
      ok: false,
      status: 0,
      message: `Cannot reach matching service (${hint}).`,
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
