import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, X, Clock } from "lucide-react";
import { Button } from "../components/Button";
import "./Matching.css";
import Card from "../components/Card";
import { useAuth } from "../context/AuthContext";
import {
  cancelMatchRequest,
  disconnectMatchRequestKeepalive,
  getMatchRequest,
  getResumeMatchRequest,
  reconnectMatchRequest,
} from "../api/matching";
import { getEffectiveMatchingUserId } from "../dev/matchingDevUser";
import {
  clearActiveMatchRequestId,
  getActiveMatchRequestId,
  setActiveMatchRequestId,
} from "../matching/matchingSession";

interface LocationState {
  difficulty?: string;
  topic?: string;
  programmingLanguage?: string;
  allowLowerDifficultyMatch?: boolean;
  timeAvailableMinutes?: number;
  requestId?: string;
}

/** Backend polls every 2s (matching service on port 3003, proxied as `/matching` in dev). */
const POLL_MS = 2000;

export const Matching: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as LocationState | null;
  const { userId } = useAuth();

  const [requestId, setRequestId] = useState(
    () => locState?.requestId ?? getActiveMatchRequestId() ?? "",
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
  /** F8 timeout vs F9 reconnect expiry — same card layout, different copy */
  const [terminal, setTerminal] = useState<"none" | "timeout" | "reconnect">(
    "none",
  );
  const [terminalMessage, setTerminalMessage] = useState<string | null>(null);
  const disconnectSentRef = useRef(false);

  const effectiveUserId = getEffectiveMatchingUserId(userId);

  const showTerminal = (
    kind: "timeout" | "reconnect",
    message: string,
  ) => {
    setTerminalMessage(message);
    setTerminal(kind);
    setResumeNote(null);
    setReady(false);
  };

  useEffect(() => {
    if (requestId) return;
    if (!effectiveUserId) {
      navigate("/user/dashboard", { replace: true });
      return;
    }

    let cancelled = false;
    const recover = async () => {
      const active = await getResumeMatchRequest(effectiveUserId);
      if (cancelled) return;
      if (active.ok) {
        setActiveMatchRequestId(active.data.id);
        setRequestId(active.data.id);
        if (active.data.status === "RECONNECT_EXPIRED") {
          clearActiveMatchRequestId();
          showTerminal(
            "reconnect",
            active.data.message ??
              "Your previous match request expired while disconnected. Please start a new search.",
          );
          return;
        }
        if (active.data.status === "TIMED_OUT") {
          clearActiveMatchRequestId();
          showTerminal(
            "timeout",
            active.data.message ??
              "No match was found in time. You can try again from the dashboard.",
          );
          return;
        }
        return;
      }
      navigate("/user/dashboard", { replace: true });
    };
    void recover();
    return () => {
      cancelled = true;
    };
  }, [requestId, effectiveUserId, navigate]);

  /** Bootstrap + optional reconnect (F9) */
  useEffect(() => {
    if (!requestId || !effectiveUserId) return;

    let cancelled = false;

    const boot = async () => {
      const recovering =
        !locState?.requestId && Boolean(getActiveMatchRequestId());
      if (recovering) {
        setResumeNote("Resuming search…");
      }

      setActiveMatchRequestId(requestId);
      const initial = await getMatchRequest(effectiveUserId, requestId);
      if (cancelled) return;

      if (!initial.ok) {
        const fallback = await getResumeMatchRequest(effectiveUserId);
        if (cancelled) return;
        if (fallback.ok) {
          if (fallback.data.status === "RECONNECT_EXPIRED") {
            clearActiveMatchRequestId();
            showTerminal(
              "reconnect",
              fallback.data.message ??
                "Your previous match request expired while disconnected. Please start a new search.",
            );
            return;
          }
          if (fallback.data.status === "TIMED_OUT") {
            clearActiveMatchRequestId();
            showTerminal(
              "timeout",
              fallback.data.message ??
                "No match was found in time. You can try again from the dashboard.",
            );
            return;
          }
          setActiveMatchRequestId(fallback.data.id);
          setRequestId(fallback.data.id);
          return;
        }
        clearActiveMatchRequestId();
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
        clearActiveMatchRequestId();
        showTerminal(
          "timeout",
          d.message ??
            "No match was found in time. You can try again from the dashboard.",
        );
        return;
      }

      if (d.status === "RECONNECT_EXPIRED") {
        clearActiveMatchRequestId();
        showTerminal(
          "reconnect",
          d.message ??
            "Your previous match request expired while disconnected. Please start a new search.",
        );
        return;
      }

      if (d.status === "PENDING") {
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
          const rc = await reconnectMatchRequest(effectiveUserId, requestId);
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
        setReady(true);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [requestId, effectiveUserId, navigate, locState?.requestId]);

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

  /** F9 — page unload while actively waiting */
  useEffect(() => {
    if (terminal !== "none" || !requestId || !effectiveUserId) {
      return;
    }
    disconnectSentRef.current = false;

    const sendDisconnectOnce = () => {
      if (disconnectSentRef.current) return;
      disconnectSentRef.current = true;
      disconnectMatchRequestKeepalive(effectiveUserId, requestId);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        sendDisconnectOnce();
      }
    };

    window.addEventListener("pagehide", sendDisconnectOnce);
    window.addEventListener("beforeunload", sendDisconnectOnce);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", sendDisconnectOnce);
      window.removeEventListener("beforeunload", sendDisconnectOnce);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [terminal, requestId, effectiveUserId]);

  useEffect(() => {
    if (terminal !== "none" || !ready || !effectiveUserId || !requestId) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const result = await getMatchRequest(effectiveUserId, requestId);
      if (cancelled) return;
      if (!result.ok) {
        setPollError(result.message);
        return;
      }
      setPollError(null);
      const data = result.data;

      if (data.status === "TIMED_OUT") {
        clearActiveMatchRequestId();
        setTerminalMessage(
          data.message ??
            "No match was found in time. You can try again from the dashboard.",
        );
        setTerminal("timeout");
        return;
      }
      if (data.status === "RECONNECT_EXPIRED") {
        clearActiveMatchRequestId();
        setTerminalMessage(
          data.message ??
            "Your previous match request expired while disconnected. Please start a new search.",
        );
        setTerminal("reconnect");
        return;
      }
      if (data.status === "MATCHED") {
        clearActiveMatchRequestId();
        navigate("/workspace", {
          replace: true,
          state: {
            requestId,
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
        navigate("/user/dashboard", { replace: true });
        return;
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [effectiveUserId, navigate, terminal, ready, requestId]);

  const handleCancel = async () => {
    setCancelError(null);
    if (!requestId || !effectiveUserId) {
      navigate("/user/dashboard");
      return;
    }
    setIsCancelling(true);
    try {
      const result = await cancelMatchRequest(effectiveUserId, requestId);
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
                      Checking status every {POLL_MS / 1000}s
                    </p>
                  </div>

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
