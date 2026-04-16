import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, X, Clock } from "lucide-react";
import { Button } from "../components/Button";
import "./Matching.css";
import Card from "../components/Card";
import { useAuth } from "../context/AuthContext";
import {
  acceptFallbackSuggestion,
  cancelMatchRequest,
  disconnectMatchRequestKeepalive,
  getActiveMatchRequest,
  getMatchRequest,
  getMatchRequestSseUrl,
  reconnectMatchRequest,
  type FallbackSuggestion,
  type MatchRequestResponse,
} from "../api/matching";
import {
  clearActiveMatchRequestId,
  getActiveMatchRequestId,
  getLastTerminalMatchRequestId,
  setActiveMatchRequestId,
  setLastTerminalMatchRequestId,
  clearLastTerminalMatchRequestId,
} from "../matching/matchingSession";

interface LocationState {
  difficulty?: string;
  topic?: string;
  programmingLanguage?: string;
  allowLowerDifficultyMatch?: boolean;
  timeAvailableMinutes?: number;
  requestId?: string;
}

/**
 * Refetch `GET /requests/:id` while waiting. SSE does not push when only elapsed time changes,
 * so without this the server’s time-based suggestions (20s / 30s / 40s) would only update on
 * rare SSE broadcasts — previously a 45s poll made everything feel “stuck until ~45s”.
 */
const WAITING_STATE_POLL_MS = 10_000;

export const Matching: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as LocationState | null;
  const { userId, isLoading: authLoading } = useAuth();

  const initialRequestId =
    locState?.requestId ??
    getActiveMatchRequestId() ??
    getLastTerminalMatchRequestId() ??
    null;
  const [requestId, setRequestId] = useState<string | null>(initialRequestId);
  /** After tab close, session/local storage may be empty — resolve from `GET /requests/active`. */
  const [idResolution, setIdResolution] = useState<"pending" | "done">(() =>
    initialRequestId ? "done" : "pending",
  );

  /** Merged from route + GET; drives the detail rows */
  const [row, setRow] = useState<LocationState | null>(() =>
    locState?.requestId ? locState : null,
  );
  const [ready, setReady] = useState(false);
  const [resumeNote, setResumeNote] = useState<string | null>(null);

  const [secondsElapsed, setSecondsElapsed] = useState(0);
  /** Display-only wait timer: aligned once from `createdAt`, then ticks locally (capped at server timeout). */
  const timerBaseRef = useRef(0);
  const timerAnchorMsRef = useRef<number | null>(null);
  const matchTimeoutSecRef = useRef(60);

  const syncWaitTimerFromServer = (createdAtIso: string, matchTimeoutSeconds: number) => {
    matchTimeoutSecRef.current = matchTimeoutSeconds;
    const createdAtMs = Date.parse(createdAtIso);
    if (Number.isNaN(createdAtMs)) {
      return;
    }
    const actualElapsed = Math.max(
      0,
      Math.floor((Date.now() - createdAtMs) / 1000),
    );
    const capped = Math.min(actualElapsed, matchTimeoutSeconds);
    timerBaseRef.current = capped;
    timerAnchorMsRef.current = Date.now();
    setSecondsElapsed(capped);
  };
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [fallbackSuggestions, setFallbackSuggestions] = useState<
    FallbackSuggestion[]
  >([]);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [fallbackBusy, setFallbackBusy] = useState<string | null>(null);
  /** F8 timeout vs F9 reconnect expiry — same card layout, different copy */
  const [terminal, setTerminal] = useState<"none" | "timeout" | "reconnect">(
    "none",
  );
  const [terminalMessage, setTerminalMessage] = useState<string | null>(null);

  /** Resolve request id from server when the tab was closed (no cached id). */
  useEffect(() => {
    if (authLoading) return;
    if (idResolution === "done") return;
    if (!userId) {
      setIdResolution("done");
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await getActiveMatchRequest();
      if (cancelled) return;
      if (r.ok && r.data.status === "PENDING") {
        setRequestId(r.data.id);
        setActiveMatchRequestId(r.data.id);
      } else {
        const last = getLastTerminalMatchRequestId();
        if (last) {
          const detail = await getMatchRequest(last);
          if (cancelled) return;
          if (detail.ok && detail.data.status === "TIMED_OUT") {
            setRequestId(detail.data.id);
          } else {
            clearLastTerminalMatchRequestId();
          }
        }
      }
      setIdResolution("done");
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, idResolution, userId]);

  useEffect(() => {
    if (authLoading) return;
    if (idResolution !== "done") return;
    if (!requestId) {
      navigate("/user/dashboard", { replace: true });
    }
  }, [authLoading, idResolution, requestId, navigate]);

  /** Bootstrap + optional reconnect (F9) */
  useEffect(() => {
    if (authLoading) return;
    if (idResolution !== "done" || !requestId || !userId) return;

    let cancelled = false;

    const boot = async () => {
      const recovering =
        !locState?.requestId && Boolean(getActiveMatchRequestId());
      if (recovering) {
        setResumeNote("Resuming search…");
      }

      const initial = await getMatchRequest(requestId);
      if (cancelled) return;

      if (!initial.ok) {
        clearActiveMatchRequestId();
        clearLastTerminalMatchRequestId();
        navigate("/user/dashboard", { replace: true });
        return;
      }

      const d = initial.data;

      if (d.status === "MATCHED") {
        clearActiveMatchRequestId();
        navigate("/workspace", {
          replace: true,
          state: {
            requestId,
            difficulty: d.difficulty,
            topic: d.topic,
            programmingLanguage: d.programmingLanguage,
            peerUserId: d.peer?.userId,
            peerMatchRequestId: d.peer?.matchRequestId,
            peerRequestedDifficulty: d.peerRequestedDifficulty,
            matchingType: d.matchingType,
            timeAvailableMinutes: d.timeAvailableMinutes,
            peerTimeAvailableMinutes: d.peerTimeAvailableMinutes,
            matchedTimeAvailableMinutes: d.matchedTimeAvailableMinutes,
          },
        });
        return;
      }

      if (d.status === "CANCELLED") {
        clearActiveMatchRequestId();
        navigate("/user/dashboard", { replace: true });
        return;
      }

      if (d.status === "TIMED_OUT") {
        setLastTerminalMatchRequestId(requestId);
        clearActiveMatchRequestId();
        setRow({
          requestId,
          topic: d.topic,
          difficulty: d.difficulty,
          programmingLanguage: d.programmingLanguage,
          allowLowerDifficultyMatch: d.allowLowerDifficultyMatch,
          timeAvailableMinutes: d.timeAvailableMinutes ?? undefined,
        });
        setFallbackSuggestions(d.fallbackSuggestions ?? []);
        setTerminalMessage(
          d.message ??
            "No match was found in time. You can try again from the dashboard.",
        );
        setTerminal("timeout");
        setResumeNote(null);
        setReady(true);
        return;
      }

      if (d.status === "RECONNECT_EXPIRED") {
        clearActiveMatchRequestId();
        setTerminalMessage(
          d.message ??
            "Your previous match request expired while disconnected. Please start a new search.",
        );
        setTerminal("reconnect");
        setResumeNote(null);
        return;
      }

      if (d.status === "PENDING") {
        setActiveMatchRequestId(requestId);
        setRow({
          requestId,
          topic: d.topic,
          difficulty: d.difficulty,
          programmingLanguage: d.programmingLanguage,
          allowLowerDifficultyMatch: d.allowLowerDifficultyMatch,
          timeAvailableMinutes: d.timeAvailableMinutes ?? undefined,
        });

        if (d.disconnectedAt) {
          setResumeNote("Reconnecting…");
          const rc = await reconnectMatchRequest(requestId);
          if (cancelled) return;
          if (!rc.ok) {
            clearActiveMatchRequestId();
            setTerminalMessage(
              rc.message ||
                "Reconnect grace expired. Please start a new search from the dashboard.",
            );
            setTerminal("reconnect");
            setResumeNote(null);
            return;
          }
        }

        setResumeNote(null);
        syncWaitTimerFromServer(
          d.createdAt,
          d.matchTimeoutSeconds ?? 60,
        );
        setFallbackSuggestions(d.fallbackSuggestions ?? []);
        setReady(true);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    idResolution,
    requestId,
    userId,
    navigate,
    locState?.requestId,
  ]);

  useEffect(() => {
    if (terminal !== "none" || !ready) return;

    const timer = window.setInterval(() => {
      const anchor = timerAnchorMsRef.current;
      if (anchor == null) return;
      const elapsed =
        timerBaseRef.current +
        Math.floor((Date.now() - anchor) / 1000);
      const cap = matchTimeoutSecRef.current;
      setSecondsElapsed(Math.min(elapsed, cap));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [terminal, ready]);

  /** Hide advisory fallbacks when the wait reaches the server match cap (before TIMED_OUT may arrive). */
  useEffect(() => {
    if (terminal !== "none" || !ready) return;
    if (secondsElapsed >= matchTimeoutSecRef.current) {
      setFallbackSuggestions([]);
    }
  }, [secondsElapsed, ready, terminal]);

  /** F9 — page unload while actively waiting */
  useEffect(() => {
    if (terminal !== "none" || !ready || !requestId || !userId) {
      return;
    }
    const onLeave = () => {
      disconnectMatchRequestKeepalive(requestId);
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [terminal, ready, requestId, userId]);

  useEffect(() => {
    if (terminal !== "none" || !ready || !userId || !requestId) {
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let es: EventSource | null = null;
    let fallbackIntervalId: ReturnType<typeof setInterval> | undefined;
    let fallbackPollInFlight = false;

    const applyMatchPayload = (data: MatchRequestResponse) => {
      if (cancelled) return;
      if (data.status === "TIMED_OUT") {
        setLastTerminalMatchRequestId(data.id);
        clearActiveMatchRequestId();
        setRow({
          topic: data.topic,
          difficulty: data.difficulty,
          programmingLanguage: data.programmingLanguage,
          allowLowerDifficultyMatch: data.allowLowerDifficultyMatch,
          timeAvailableMinutes: data.timeAvailableMinutes ?? undefined,
        });
        setFallbackSuggestions(data.fallbackSuggestions ?? []);
        setTerminalMessage(
          data.message ??
            "No match was found in time. You can try again from the dashboard.",
        );
        setTerminal("timeout");
        setReady(true);
        return;
      }
      if (data.status === "RECONNECT_EXPIRED") {
        clearActiveMatchRequestId();
        setFallbackSuggestions([]);
        setTerminalMessage(
          data.message ??
            "Your previous match request expired while disconnected. Please start a new search.",
        );
        setTerminal("reconnect");
        return;
      }
      if (data.status === "MATCHED") {
        clearActiveMatchRequestId();
        setFallbackSuggestions([]);
        navigate("/workspace", {
          replace: true,
          state: {
            requestId: data.id,
            difficulty: data.difficulty,
            topic: data.topic,
            programmingLanguage: data.programmingLanguage,
            peerUserId: data.peer?.userId,
            peerMatchRequestId: data.peer?.matchRequestId,
            peerRequestedDifficulty: data.peerRequestedDifficulty,
            matchingType: data.matchingType,
            timeAvailableMinutes: data.timeAvailableMinutes,
            peerTimeAvailableMinutes: data.peerTimeAvailableMinutes,
            matchedTimeAvailableMinutes: data.matchedTimeAvailableMinutes,
          },
        });
        return;
      }
      if (data.status === "CANCELLED") {
        clearActiveMatchRequestId();
        setFallbackSuggestions([]);
        navigate("/user/dashboard", { replace: true });
        return;
      }
      if (data.status === "PENDING") {
        if (data.id !== requestId) {
          setRequestId(data.id);
          setActiveMatchRequestId(data.id);
        }
        setRow({
          topic: data.topic,
          difficulty: data.difficulty,
          programmingLanguage: data.programmingLanguage,
          allowLowerDifficultyMatch: data.allowLowerDifficultyMatch,
          timeAvailableMinutes: data.timeAvailableMinutes ?? undefined,
        });
        setFallbackSuggestions(data.fallbackSuggestions ?? []);
        syncWaitTimerFromServer(
          data.createdAt,
          data.matchTimeoutSeconds ?? 60,
        );
      }
    };

    const runFallbackHttpPoll = async () => {
      if (fallbackPollInFlight) return;
      fallbackPollInFlight = true;
      try {
        const result = await getMatchRequest(requestId);
        if (cancelled) return;
        if (!result.ok) {
          setPollError(result.message);
          return;
        }
        setPollError(null);
        applyMatchPayload(result.data);
      } finally {
        fallbackPollInFlight = false;
      }
    };

    const url = getMatchRequestSseUrl(requestId);

    const connectSse = () => {
      if (cancelled) return;
      clearTimeout(reconnectTimer);
      es?.close();
      es = new EventSource(url, { withCredentials: true });

      const onPayload = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data) as MatchRequestResponse;
          setPollError(null);
          applyMatchPayload(data);
        } catch {
          if (!cancelled) setPollError("Invalid update from server");
        }
      };
      es.addEventListener("snapshot", onPayload);
      es.addEventListener("match_request", onPayload);
      es.onopen = () => {
        if (!cancelled) setPollError(null);
      };

      es.onerror = () => {
        if (cancelled) return;
        setPollError("Live connection interrupted. Reconnecting…");
        es?.close();
        reconnectTimer = setTimeout(connectSse, 3000);
      };
    };

    connectSse();
    fallbackIntervalId = setInterval(() => {
      void runFallbackHttpPoll();
    }, WAITING_STATE_POLL_MS);

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      es?.close();
      if (fallbackIntervalId !== undefined) {
        clearInterval(fallbackIntervalId);
      }
    };
  }, [userId, navigate, terminal, ready, requestId]);

  const handleAcceptFallback = async (s: FallbackSuggestion) => {
    const currentId = requestId;
    if (!currentId) return;
    if (
      s.type !== "enable_downward_matching" &&
      s.action.type !== "create_new_request"
    ) {
      return;
    }
    setFallbackError(null);
    setFallbackBusy(s.type);
    const wasTimeoutTerminal = terminal === "timeout";
    let body:
      | { type: "enable_downward_matching" }
      | { type: "switch_topic_nearby"; topic: string }
      | { type: "switch_topic_popular"; topic: string };
    if (s.type === "enable_downward_matching") {
      body = { type: "enable_downward_matching" };
    } else if (s.action.type === "create_new_request") {
      const topic = s.action.newCriteria.topic;
      body =
        s.type === "switch_topic_nearby"
          ? { type: "switch_topic_nearby", topic }
          : { type: "switch_topic_popular", topic };
    } else {
      setFallbackBusy(null);
      return;
    }
    const result = await acceptFallbackSuggestion(currentId, body);
    setFallbackBusy(null);
    if (!result.ok) {
      setFallbackError(result.message);
      return;
    }
    const data = result.data;
    if (wasTimeoutTerminal) {
      clearLastTerminalMatchRequestId();
      setActiveMatchRequestId(data.id);
      setRequestId(data.id);
      setTerminal("none");
      setTerminalMessage(null);
      setFallbackSuggestions(data.fallbackSuggestions ?? []);
      setRow({
        topic: data.topic,
        difficulty: data.difficulty,
        programmingLanguage: data.programmingLanguage,
        allowLowerDifficultyMatch: data.allowLowerDifficultyMatch,
        timeAvailableMinutes: data.timeAvailableMinutes ?? undefined,
      });
      syncWaitTimerFromServer(
        data.createdAt,
        data.matchTimeoutSeconds ?? 60,
      );
      setReady(true);
      return;
    }
    if (data.id !== currentId) {
      setRequestId(data.id);
      setActiveMatchRequestId(data.id);
    }
    setRow({
      topic: data.topic,
      difficulty: data.difficulty,
      programmingLanguage: data.programmingLanguage,
      allowLowerDifficultyMatch: data.allowLowerDifficultyMatch,
      timeAvailableMinutes: data.timeAvailableMinutes ?? undefined,
    });
    setFallbackSuggestions(data.fallbackSuggestions ?? []);
    syncWaitTimerFromServer(
      data.createdAt,
      data.matchTimeoutSeconds ?? 60,
    );
  };

  const handleCancel = async () => {
    setCancelError(null);
    if (!requestId || !userId) {
      navigate("/user/dashboard");
      return;
    }
    setIsCancelling(true);
    try {
      const result = await cancelMatchRequest(requestId);
      if (!result.ok) {
        setCancelError(result.message);
        return;
      }
      clearActiveMatchRequestId();
      navigate("/user/dashboard");
    } finally {
      setIsCancelling(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isTerminal = terminal !== "none";
  const title = !isTerminal
    ? "Finding a Peer..."
    : terminal === "timeout"
      ? "Timeout"
      : "Search ended";

  if (authLoading || idResolution === "pending") {
    return (
      <div className="matching-layout animate-fade-in">
        <div className="matching-container">
          <Card theme="user" className="matching-card">
            <div className="matching-card__inner">
              <p className="matching-poll-hint" role="status">
                Loading your match…
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="matching-layout animate-fade-in">
      <div className="matching-container">
        <Card theme="user" className="matching-card">
          <div className="matching-card__inner">
            {isTerminal ? (
              <>
                <div className="matching-hero matching-hero--timeout">
                  <div className="matching-hero__core matching-hero__core--timeout">
                    <Clock className="matching-hero__icon" />
                  </div>
                </div>
                <div className="matching-hero__title">{title}</div>
                <div className="matching-info">
                  <p className="matching-timeout-message" role="status">
                    {terminalMessage}
                  </p>
                  {fallbackSuggestions.length > 0 && terminal === "timeout" ? (
                    <div
                      className="matching-fallback matching-fallback--terminal"
                      role="region"
                      aria-label="Optional search adjustments after timeout"
                    >
                      <p className="matching-fallback__intro">
                        Your search timed out — optional ideas you can still try (or start again from
                        the dashboard):
                      </p>
                      <ul className="matching-fallback__list">
                        {fallbackSuggestions.map((s) => (
                          <li key={s.type} className="matching-fallback__item">
                            <div className="matching-fallback__copy">
                              <span className="matching-fallback__kind">
                                {s.type === "enable_downward_matching"
                                  ? "Lower difficulty"
                                  : s.type === "switch_topic_nearby"
                                    ? "Nearby topic"
                                    : "Popular topic"}
                              </span>
                              <strong>{s.title}</strong>
                              <p>{s.description}</p>
                            </div>
                            <Button
                              theme="user"
                              variant="solid"
                              size="sm"
                              disabled={fallbackBusy !== null}
                              onClick={() => void handleAcceptFallback(s)}
                            >
                              {fallbackBusy === s.type ? "Applying…" : "Use this"}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {fallbackError && terminal === "timeout" ? (
                    <p className="matching-fallback__error" role="alert">
                      {fallbackError}
                    </p>
                  ) : null}
                  <div className="matching-actions">
                    <Button
                      theme="user"
                      variant="solid"
                      onClick={() => navigate("/user/dashboard")}
                    >
                      Back to dashboard
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="matching-hero">
                  <div className="matching-pulse-ring matching-pulse-ring--1" />
                  <div className="matching-pulse-ring matching-pulse-ring--2" />
                  <div className="matching-pulse-ring matching-pulse-ring--3" />

                  <div className="matching-hero__core">
                    <Users className="matching-hero__icon" />
                  </div>
                </div>
                <div className="matching-hero__title">{title}</div>

                <div className="matching-info">
                  {resumeNote ? (
                    <p className="matching-poll-hint" role="status">
                      {resumeNote}
                    </p>
                  ) : null}

                  <div className="matching-details">
                    <div className="detail-item">
                      <span className="detail-label">Topic</span>
                      <span className="detail-value">{row?.topic ?? "—"}</span>
                    </div>

                    <div className="detail-item">
                      <span className="detail-label">Difficulty</span>
                      <span className="detail-value">
                        {row?.difficulty ?? "—"}
                      </span>
                    </div>

                    <div className="detail-item">
                      <span className="detail-label">Language</span>
                      <span className="detail-value">
                        {row?.programmingLanguage ?? "—"}
                      </span>
                    </div>

                    <div className="detail-item">
                      <span className="detail-label">Allow lower difficulty</span>
                      <span className="detail-value">
                        {row?.allowLowerDifficultyMatch ? "On" : "Off"}
                      </span>
                    </div>

                    <div className="detail-item">
                      <span className="detail-label">Time available</span>
                      <span className="detail-value">
                        {row?.timeAvailableMinutes != null
                          ? `${row.timeAvailableMinutes} min`
                          : "Not specified"}
                      </span>
                    </div>
                  </div>

                  <div className="matching-timer">
                    <span className="timer-text">{formatTime(secondsElapsed)}</span>
                    <p className="timer-subtext">
                      This page updates while you wait. If you’ve been waiting a while, we may offer
                      optional ideas to help you find a match — you can ignore them or try one.
                    </p>
                  </div>

                  {fallbackSuggestions.length > 0 ? (
                    <div className="matching-fallback" role="region" aria-label="Optional search adjustments">
                      <p className="matching-fallback__intro">
                        Still waiting — optional ways to broaden your search (you choose):
                      </p>
                      <ul className="matching-fallback__list">
                        {fallbackSuggestions.map((s) => (
                          <li key={s.type} className="matching-fallback__item">
                            <div className="matching-fallback__copy">
                              <span className="matching-fallback__kind">
                                {s.type === "enable_downward_matching"
                                  ? "Lower difficulty"
                                  : s.type === "switch_topic_nearby"
                                    ? "Nearby topic"
                                    : "Popular topic"}
                              </span>
                              <strong>{s.title}</strong>
                              <p>{s.description}</p>
                            </div>
                            <Button
                              theme="user"
                              variant="solid"
                              size="sm"
                              disabled={fallbackBusy !== null || !ready}
                              onClick={() => void handleAcceptFallback(s)}
                            >
                              {fallbackBusy === s.type ? "Applying…" : "Use this"}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {fallbackError ? (
                    <p className="matching-fallback__error" role="alert">
                      {fallbackError}
                    </p>
                  ) : null}

                  {pollError ? (
                    <p className="matching-poll-hint" role="status">
                      {pollError}
                      <span className="matching-poll-retry"> Will retry shortly.</span>
                    </p>
                  ) : null}

                  <div className="matching-actions">
                    {cancelError ? (
                      <p className="matching-cancel-error" role="alert">
                        {cancelError}
                      </p>
                    ) : null}
                    <Button
                      theme="user"
                      variant="ghost"
                      onClick={() => void handleCancel()}
                      disabled={isCancelling || !ready}
                      leftIcon={<X className="h-4 w-4" />}
                    >
                      {isCancelling ? "Cancelling…" : "Cancel Search"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
