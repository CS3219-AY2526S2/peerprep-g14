import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen,
  Target,
  Play,
  CircleGauge,
  Code2,
  Clock,
  Layers,
} from "lucide-react";
import { Select } from "../components/Select";
import { Button } from "../components/Button";
import "./Dashboard.css";
import Card from "../components/Card";
import { useAuth } from "../context/AuthContext";
import { createMatchRequest, getActiveMatchRequest } from "../api/matching";
import {
  getActiveMatchRequestId,
  setActiveMatchRequestId,
} from "../matching/matchingSession";
import {
  loadMatchFormDraft,
  saveMatchFormDraft,
} from "../matching/matchFormDraft";
import { MATCH_TOPIC_OPTIONS } from "../constants/matchTopics";

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stateFromNav = location.state as any;
  const { userId, isLoading } = useAuth();
  const [difficulty, setDifficulty] = useState(
    () => loadMatchFormDraft()?.difficulty ?? "",
  );
  const [topic, setTopic] = useState(() => loadMatchFormDraft()?.topic ?? "");
  const [programmingLanguage, setProgrammingLanguage] = useState(
    () => loadMatchFormDraft()?.programmingLanguage ?? "",
  );
  const [allowLowerDifficultyMatch, setAllowLowerDifficultyMatch] = useState(
    () => loadMatchFormDraft()?.allowLowerDifficultyMatch ?? false,
  );
  /** "" = no preference (F2 — omit from payload) */
  const [timeAvailable, setTimeAvailable] = useState(
    () => loadMatchFormDraft()?.timeAvailable ?? "",
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** False until we finish “resume” checks so we don’t double-submit before redirect to /matching. */
  const [resumeCheckDone, setResumeCheckDone] = useState(false);
  const dashboardTheme = "user";

  const [topToast, setTopToast] = useState<string | null>(
    stateFromNav?.sessionNotification || null,
  );

  useEffect(() => {
    if (topToast) {
      const t = setTimeout(() => setTopToast(null), 10000);
      return () => clearTimeout(t);
    }
  }, [topToast]);

  useEffect(() => {
    if (isLoading) return;
    if (!userId) {
      setResumeCheckDone(true);
      return;
    }
    let mounted = true;

    const checkActiveSession = async () => {
      if (!userId) {
        if (mounted) setResumeCheckDone(true);
        return;
      }

      try {
        const res = await fetch("/api/collaboration/sessions/active", {
          credentials: "include",
        });
        if (res.ok && res.status !== 204 && mounted) {
          const session = await res.json();
          if (session.status === "terminated") {
            const shownKey = `notified_termination_${session.id}`;
            if (!sessionStorage.getItem(shownKey)) {
              if (
                session.terminatedBy !== userId &&
                session.terminatedBy !== "anonymous"
              ) {
                setTopToast(
                  "Your previous session has ended. You can find a new match from the Dashboard.",
                );
              }
              sessionStorage.setItem(shownKey, "true");
            }
            // Still check for a pending match below (user may have left matching UI).
          } else if (session.status === "active") {
            const part1 = session.id.slice(0, 36);
            const part2 = session.id.slice(37);
            const isUser1 = session.user1Id === userId;
            navigate("/workspace", {
              state: {
                requestId: part1,
                peerMatchRequestId: part2,
                programmingLanguage: session.language,
                peerUserId: isUser1 ? session.user2Id : session.user1Id,
                difficulty: "",
                topic: "",
              },
            });
            if (mounted) setResumeCheckDone(true);
            return;
          }
          // Non-active session row (e.g. stale): fall through — check matching queue next.
        }
      } catch {
        /* collaboration unavailable — still try matching active */
      }

      try {
        const matchRes = await getActiveMatchRequest();
        if (!mounted) return;
        if (matchRes.ok && matchRes.data.status === "PENDING") {
          setActiveMatchRequestId(matchRes.data.id);
          navigate("/matching", {
            state: {
              requestId: matchRes.data.id,
              topic: matchRes.data.topic,
              difficulty: matchRes.data.difficulty,
              programmingLanguage: matchRes.data.programmingLanguage,
              allowLowerDifficultyMatch:
                matchRes.data.allowLowerDifficultyMatch,
              timeAvailableMinutes:
                matchRes.data.timeAvailableMinutes ?? undefined,
            },
          });
        }
      } catch {
        /* ignore */
      } finally {
        if (mounted) setResumeCheckDone(true);
      }
    };

    void checkActiveSession();
    return () => {
      mounted = false;
    };
  }, [userId, isLoading, navigate]);

  useEffect(() => {
    saveMatchFormDraft({
      topic,
      difficulty,
      programmingLanguage,
      allowLowerDifficultyMatch,
      timeAvailable,
    });
  }, [
    topic,
    difficulty,
    programmingLanguage,
    allowLowerDifficultyMatch,
    timeAvailable,
  ]);

  const handleStartMatching = async () => {
    setSubmitError(null);
    if (!difficulty || !topic || !programmingLanguage) return;
    if (!userId) {
      setSubmitError("Sign in to find a match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createMatchRequest({
        topic,
        difficulty,
        programmingLanguage,
        allowLowerDifficultyMatch,
        ...(timeAvailable !== ""
          ? { timeAvailableMinutes: Number(timeAvailable) }
          : {}),
      });
      if (result.ok) {
        setActiveMatchRequestId(result.data.id);
        navigate("/matching", {
          state: {
            difficulty,
            topic,
            programmingLanguage,
            allowLowerDifficultyMatch,
            timeAvailableMinutes:
              timeAvailable !== "" ? Number(timeAvailable) : undefined,
            requestId: result.data.id,
          },
        });
        return;
      }
      if (result.status === 409) {
        const existing = await getActiveMatchRequest();
        if (existing.ok && existing.data.status === "PENDING") {
          setActiveMatchRequestId(existing.data.id);
          navigate("/matching", {
            state: {
              requestId: existing.data.id,
              topic: existing.data.topic,
              difficulty: existing.data.difficulty,
              programmingLanguage: existing.data.programmingLanguage,
              allowLowerDifficultyMatch:
                existing.data.allowLowerDifficultyMatch,
              timeAvailableMinutes:
                existing.data.timeAvailableMinutes ?? undefined,
            },
          });
          return;
        }
        setSubmitError(
          "You already have an active match request. Open the matching screen or wait.",
        );
        return;
      }
      setSubmitError(result.message || "Could not start matching.");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Unexpected error starting match.";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const difficultyOptions = [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
  ];

  const languageOptions = [
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C++" },
    { value: "go", label: "Go" },
  ];

  const timeAvailableOptions = [
    { value: "", label: "No preference" },
    { value: "30", label: "30 minutes" },
    { value: "45", label: "45 minutes" },
    { value: "60", label: "60 minutes" },
  ];

  if (!resumeCheckDone) {
    /** Only then is “resume” copy honest (e.g. first login has no stored match id). */
    const mayResumeMatch =
      typeof window !== "undefined" && Boolean(getActiveMatchRequestId());
    return (
      <div className="dashboard-page animate-fade-in">
        <div className="dashboard-layout">
          <div className="dashboard-main-container">
            <Card
              theme={dashboardTheme}
              logo={<Target className="h-5 w-5" />}
              title="Configure Session"
              headerAlign="left"
              showDivider
              className="dashboard-content"
            >
              <p className="text-secondary text-sm" role="status">
                {mayResumeMatch
                  ? "Checking for an active session or match…"
                  : "Loading dashboard…"}
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page animate-fade-in">
      {topToast && (
        <div className="top-toast">
          <span>{topToast}</span>
        </div>
      )}
      <div className="dashboard-layout">
        <div className="dashboard-main-container">
          <Card
            theme={dashboardTheme}
            logo={<Target className="h-5 w-5" />}
            title="Configure Session"
            headerAlign="left"
            showDivider
            className="dashboard-content"
            contentClassName="dashboard-session-scroll"
          >
            <div className="form-group">
              <Select
                label="Interview Topic"
                placeholder="Select Topic"
                options={MATCH_TOPIC_OPTIONS}
                value={topic}
                onChange={setTopic}
                leftIcon={<BookOpen className="h-5 w-5" />}
              />

              <Select
                label="Difficulty Level"
                placeholder="Select Difficulty"
                options={difficultyOptions}
                value={difficulty}
                onChange={setDifficulty}
                className="mt-8"
                leftIcon={<CircleGauge className="h-5 w-5" />}
              />

              <Select
                label="Programming Language"
                placeholder="Select Language"
                options={languageOptions}
                value={programmingLanguage}
                onChange={setProgrammingLanguage}
                className="mt-8"
                leftIcon={<Code2 className="h-5 w-5" />}
              />

              <Select
                label="Time available (optional)"
                placeholder="No preference"
                options={timeAvailableOptions}
                value={timeAvailable}
                onChange={setTimeAvailable}
                className="mt-8"
                leftIcon={<Clock className="h-5 w-5" />}
              />

              <div className="dashboard-allow-lower-wrap mt-8">
                <span className="select-label select-label--user">
                  Matching flexibility
                </span>
                <label
                  className={`dashboard-allow-lower-card ${allowLowerDifficultyMatch ? "is-on" : ""}`}
                >
                  <input
                    id="allow-lower-difficulty"
                    type="checkbox"
                    className="dashboard-allow-lower-input"
                    checked={allowLowerDifficultyMatch}
                    onChange={(e) =>
                      setAllowLowerDifficultyMatch(e.target.checked)
                    }
                  />
                  <span className="dashboard-allow-lower-card-inner">
                    <span className="dashboard-allow-lower-icon" aria-hidden>
                      <Layers className="h-5 w-5" />
                    </span>
                    <span className="dashboard-allow-lower-copy">
                      <span className="dashboard-allow-lower-title">
                        Allow lower-difficulty partners
                      </span>
                      <span className="dashboard-allow-lower-tagline">
                        Same topic & language · we still match your level first
                      </span>
                    </span>
                    <span className="dashboard-allow-lower-switch" aria-hidden>
                      <span className="dashboard-allow-lower-knob" />
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {submitError ? (
              <p className="dashboard-match-error" role="alert">
                {submitError}
              </p>
            ) : null}

            <Button
              size="md"
              variant="solid"
              theme="user"
              className="mt-8"
              disabled={
                !difficulty ||
                !topic ||
                !programmingLanguage ||
                isLoading ||
                isSubmitting
              }
              onClick={() => void handleStartMatching()}
              rightIcon={<Play className="h-5 w-5" />}
            >
              {isSubmitting ? "Starting…" : "Find a Match"}
            </Button>
          </Card>
        </div>
        <div className="dashboard-right-container">
          <Card
            theme={dashboardTheme}
            title={<div className="dashboard-title">Sessions Completed</div>}
            headerAlign="left"
            showDivider
            className="dashboard-content"
          >
            <div className="stat-number">12</div>
          </Card>
        </div>
      </div>
    </div>
  );
};
