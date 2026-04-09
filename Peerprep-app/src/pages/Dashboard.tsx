import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Target, Play, CircleGauge, Code2, Clock } from "lucide-react";
import { Select } from "../components/Select";
import { Button } from "../components/Button";
import "./Dashboard.css";
import Card from "../components/Card";
import { useAuth } from "../context/AuthContext";
import { createMatchRequest, getActiveMatchRequest } from "../api/matching";
import { getEffectiveMatchingUserId } from "../dev/matchingDevUser";
import { setActiveMatchRequestId } from "../matching/matchingSession";

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userId, isLoading } = useAuth();
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");
  const [programmingLanguage, setProgrammingLanguage] = useState("");
  const [allowLowerDifficultyMatch, setAllowLowerDifficultyMatch] = useState(false);
  /** "" = no preference (F2 — omit from payload) */
  const [timeAvailable, setTimeAvailable] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingActiveRequest, setCheckingActiveRequest] = useState(true);
  const dashboardTheme = "user";

  useEffect(() => {
    if (isLoading) {
      setCheckingActiveRequest(true);
      return;
    }
    const effectiveId = getEffectiveMatchingUserId(userId);
    if (!effectiveId) {
      setCheckingActiveRequest(false);
      return;
    }

    let cancelled = false;
    const ensureNoActiveRequest = async () => {
      const active = await getActiveMatchRequest(effectiveId);
      if (cancelled) return;
      if (active.ok) {
        setActiveMatchRequestId(active.data.id);
        navigate("/matching", {
          replace: true,
          state: { requestId: active.data.id },
        });
        return;
      }
      setCheckingActiveRequest(false);
    };
    void ensureNoActiveRequest();
    return () => {
      cancelled = true;
    };
  }, [isLoading, userId, navigate]);

  if (checkingActiveRequest) {
    return null;
  }

  const handleStartMatching = async () => {
    setSubmitError(null);
    if (!difficulty || !topic || !programmingLanguage) return;
    const effectiveId = getEffectiveMatchingUserId(userId);
    if (!effectiveId) {
      setSubmitError("Sign in to find a match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createMatchRequest(effectiveId, {
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
        setSubmitError(
          "You already have an active match request. Cancel it from the matching screen or wait.",
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

  const topicOptions = [
    { value: "arrays", label: "Arrays & Hashing" },
    { value: "two-pointers", label: "Two Pointers" },
    { value: "sliding-window", label: "Sliding Window" },
    { value: "stack", label: "Stack" },
    { value: "binary-search", label: "Binary Search" },
    { value: "linked-list", label: "Linked List" },
    { value: "trees", label: "Trees" },
    { value: "graphs", label: "Graphs" },
    { value: "dp", label: "Dynamic Programming" },
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

  return (
    <div className="animate-fade-in">
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
                options={topicOptions}
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

              <label className="dashboard-allow-lower mt-8">
                <input
                  type="checkbox"
                  checked={allowLowerDifficultyMatch}
                  onChange={(e) =>
                    setAllowLowerDifficultyMatch(e.target.checked)
                  }
                />
                <span>Allow lower difficulty match</span>
              </label>
              <p className="dashboard-allow-lower-hint text-secondary text-sm mt-2">
                When on, you may be paired with someone who chose an easier
                level (same topic and language). Same level is always tried
                first.
              </p>
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
