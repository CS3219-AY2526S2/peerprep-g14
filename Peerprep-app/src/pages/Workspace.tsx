import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import * as Y from "yjs";
import {
  Code2,
  Layout,
  Settings,
  LogOut,
  MessageSquare,
  Play,
  CheckCircle,
  XCircle,
  Loader,
  Languages,
  Loader2,
  ChevronDown,
  Lightbulb,
} from "lucide-react";
import { Button } from "../components/Button";
import { CodeEditor, type CodeEditorHandle } from "../components/CodeEditor";
import { TranslationModal } from "../components/TranslationModal";
import { ExplainModal } from "../components/ExplainModal";
import { useCurrentUserProfile } from "../hooks/useCurrentUserProfile";
import { useAuth } from "../context/AuthContext";
import "./Workspace.css";
import SessionChat from "../components/SessionChat";

interface LocationState {
  requestId?: string;
  difficulty?: string;
  topic?: string;
  programmingLanguage?: string;
  peerUserId?: string;
  peerMatchRequestId?: string;
  peerRequestedDifficulty?: string | null;
  matchingType?: "same_difficulty" | "downward" | null;
  timeAvailableMinutes?: number | null;
  peerTimeAvailableMinutes?: number | null;
  matchedTimeAvailableMinutes?: number | null;
}

const SUPPORTED_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
];

function formatDifficultyLabel(d: string | undefined): string {
  if (!d) return "—";
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function formatMinutesLine(m: number | null | undefined): string {
  if (m == null) return "Not specified";
  return `${m} min`;
}

function getFileExtension(language: string | undefined): string {
  if (!language) return ".js"; // default

  switch (language.toLowerCase()) {
    case "python":
      return ".py";
    case "java":
      return ".java";
    case "c++":
    case "cpp":
      return ".cpp";
    case "c":
      return ".c";
    case "go":
      return ".go";
    case "typescript":
      return ".ts";
    case "javascript":
      return ".js";
    default:
      return ".txt";
  }
}

type ExecStatus =
  | "idle"
  | "pending"
  | "approved"
  | "running"
  | "completed"
  | "rejected";

export const Workspace: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const { data: profile } = useCurrentUserProfile();
  const { userId } = useAuth();
  const currentUser = React.useMemo(() => {
    const colors = [
      "#f56565",
      "#ed8936",
      "#ecc94b",
      "#48bb78",
      "#38b2ac",
      "#4299e1",
      "#667eea",
      "#9f7aea",
      "#ed64a6",
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    return {
      name: profile?.name || "Peer",
      color: randomColor,
    };
  }, [profile?.name]);

  const [code, setCode] = useState(
    "// Write your solution here...\n\nfunction solution() {\n  \n}",
  );
  const [sessionId, setSessionId] = useState<string>("default-session");
  const [question, setQuestion] = useState<any>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [partnerOnline, setPartnerOnline] = useState(true);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [hasSessionEnded, setHasSessionEnded] = useState(false);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const sessionEndedRef = React.useRef(false);

  // Code execution state
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [execStatus, setExecStatus] = useState<ExecStatus>("idle");
  const [execResults, setExecResults] = useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const execObserverRef = useRef<(() => void) | null>(null);
  // Dynamic Language state
  const [currentLanguage, setCurrentLanguage] = useState(
    state?.programmingLanguage || "javascript",
  );
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const [peerLanguageRequestLang, setPeerLanguageRequestLang] = useState<
    string | null
  >(null);
  const [showLanguageRequestModal, setShowLanguageRequestModal] =
    useState(false);

  // Translation state
  const [pendingTranslation, setPendingTranslation] = useState<{
    code: string;
    language: string;
    timestamp: number;
  } | null>(null);
  const [pendingLanguageChange, setPendingLanguageChange] = useState<{
    language: string;
    timestamp: number;
  } | null>(null);
  const [peerTranslationRequestLang, setPeerTranslationRequestLang] = useState<{
    language: string;
    timestamp: number;
  } | null>(null);

  const codeEditorRef = useRef<CodeEditorHandle>(null);
  const [showTranslateDropdown, setShowTranslateDropdown] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<string>("");
  const [translationTargetLang, setTranslationTargetLang] =
    useState<string>("");
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const translateDropdownRef = useRef<HTMLDivElement>(null);

  // Explain state
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationResult, setExplanationResult] = useState<string>("");
  const [showExplainModal, setShowExplainModal] = useState(false);

  // Chat service
  const [chatChannelId, setChatChannelId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const [sideToasts, setSideToasts] = useState<
    Array<{
      id: number;
      message: React.ReactNode;
      icon: string;
      border: string;
    }>
  >([]);

  const addSideToast = useCallback(
    (
      message: React.ReactNode,
      icon: string = "ℹ️",
      border: string = "var(--user-400)",
    ) => {
      const id = Date.now() + Math.random();
      setSideToasts((prev) => [...prev, { id, message, icon, border }]);
      setTimeout(() => {
        setSideToasts((prev) => prev.filter((t) => t.id !== id));
      }, 12000);
    },
    [],
  );

  const endSessionOnce = React.useCallback(
    (reason?: string) => {
      if (sessionEndedRef.current) return false;
      sessionEndedRef.current = true;
      setHasSessionEnded(true);
      setShowDisconnectModal(false);
      if (reason) {
        navigate("/user/dashboard", { state: { sessionNotification: reason } });
      } else {
        navigate("/user/dashboard");
      }
      return true;
    },
    [navigate],
  );

  async function buildChatChannelId(matchId: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(matchId);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `match_${hashHex.slice(0, 24)}`;
  }

  React.useEffect(() => {
    if (!state?.requestId || !state?.peerMatchRequestId) {
      setIsSessionLoading(false);
      return;
    }

    let mounted = true;

    const computeId = [state.requestId, state.peerMatchRequestId]
      .sort()
      .join(":");

    setSessionId(computeId);

    void buildChatChannelId(computeId).then((id) => {
      if (mounted) {
        setChatChannelId(id);
      }
    });

    const initSession = async () => {
      let retryCount = 0;
      const maxRetries = 15;

      const poll = async () => {
        if (!mounted) return;
        try {
          const sessionRes = await fetch(
            `/api/collaboration/sessions/${computeId}`,
            {
              credentials: "include",
            },
          );

          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();

            if (sessionData.status === "terminated") {
              if (mounted) {
                setIsSessionLoading(false);
                endSessionOnce(
                  "This session has ended. Returning to Dashboard.",
                );
              }
              return;
            }

            if (sessionData.language) {
              setCurrentLanguage(sessionData.language);
            }

            const qRes = await fetch(
              `/api/questions/${sessionData.questionId}`,
            );
            if (qRes.ok) {
              const qData = await qRes.json();
              if (mounted) setQuestion(qData);
            }

            if (mounted) setIsSessionLoading(false);
            return;
          }

          if (sessionRes.status === 404 && retryCount < maxRetries) {
            retryCount++;
            console.log(
              `[Workspace] Session not ready yet (try ${retryCount}/${maxRetries}), retrying...`,
            );
            setTimeout(poll, 1000);
          } else {
            if (mounted) setIsSessionLoading(false);
          }
        } catch (err) {
          console.error("Session initialization failed:", err);
          if (mounted) setIsSessionLoading(false);
        }
      };

      void poll();
    };

    void initSession();

    return () => {
      mounted = false;
    };
  }, [state, endSessionOnce]);

  // exit if Yjs WebSockets miss TCP termination CRDT
  React.useEffect(() => {
    if (!sessionId || isSessionLoading) return;
    const interval = setInterval(async () => {
      try {
        if (sessionEndedRef.current) return;
        const res = await fetch(`/api/collaboration/sessions/${sessionId}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "terminated") {
            endSessionOnce("This session has ended. Returning to Dashboard.");
          }
          return;
        }
        if (res.status === 403 || res.status === 404) {
          endSessionOnce(
            "This session is no longer available. Returning to Dashboard.",
          );
        }
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId, isSessionLoading, endSessionOnce]);

  // close translate and language dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        translateDropdownRef.current &&
        !translateDropdownRef.current.contains(e.target as Node)
      ) {
        setShowTranslateDropdown(false);
      }
      if (
        languageDropdownRef.current &&
        !languageDropdownRef.current.contains(e.target as Node)
      ) {
        setShowLanguageDropdown(false);
      }
    };
    if (showTranslateDropdown || showLanguageDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showTranslateDropdown, showLanguageDropdown]);

  const handleEndSessionInstantly = async () => {
    if (isTerminating || sessionEndedRef.current) return;
    setIsTerminating(true);
    setShowDisconnectModal(false);
    try {
      await fetch(`/api/collaboration/sessions/${sessionId}/terminate`, {
        method: "PATCH",
        credentials: "include",
      });
    } catch (e) {}
    // Mark question as completed for both users
    if (question && userId && state?.peerUserId) {
      await fetch("/api/questions/completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userIds: [userId, state.peerUserId],
          questionId: question._id || question.id,
        }),
      }).catch(console.error);
    }

    endSessionOnce();
  };

  const handleEndSession = () => {
    setShowEndSessionModal(true);
  };

  const handleSystemTerminate = async (reason: string) => {
    if (sessionEndedRef.current) return;
    try {
      await fetch(`/api/collaboration/sessions/${sessionId}/terminate`, {
        method: "PATCH",
        credentials: "include",
      });
    } catch (e) {}
    endSessionOnce(reason);
  };

  const handlePartnerPresenceChange = (isPresent: boolean) => {
    if (isTerminating || sessionEndedRef.current) return;
    setPartnerOnline(isPresent);
    if (!isPresent) setShowDisconnectModal(true);
    else setShowDisconnectModal(false);
  };

  // --- Code Execution: Yjs observer + handlers ---

  const handleYdocReady = useCallback((doc: Y.Doc) => {
    setYdoc(doc);
  }, []);

  const executeCode = useCallback(
    async (codeExecMap: Y.Map<unknown>) => {
      if (!ydoc) return;
      codeExecMap.set("status", "running");
      try {
        const codeText = ydoc.getText("monaco").toString();
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            code: codeText,
            language: state?.programmingLanguage || "javascript",
            questionId: question?._id || question?.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          codeExecMap.set("status", "completed");
          codeExecMap.set(
            "results",
            JSON.stringify({
              results: [],
              stdout: "",
              stderr: data.error || "Execution failed",
            }),
          );
        } else {
          codeExecMap.set("status", "completed");
          codeExecMap.set("results", JSON.stringify(data));
        }
      } catch (err: any) {
        codeExecMap.set("status", "completed");
        codeExecMap.set(
          "results",
          JSON.stringify({
            results: [],
            stdout: "",
            stderr: `Network error: ${err.message}`,
          }),
        );
      }
    },
    [ydoc, state?.programmingLanguage, question],
  );

  useEffect(() => {
    if (!ydoc) return;
    const codeExecMap = ydoc.getMap("codeExecution");

    const observer = () => {
      const status = codeExecMap.get("status") as ExecStatus | undefined;
      if (!status) return;

      setExecStatus(status);

      if (status === "pending") {
        const requestedBy = codeExecMap.get("requestedBy") as string;
        if (requestedBy !== userId) {
          setShowApprovalModal(true);
        }
      } else if (status === "approved") {
        setShowApprovalModal(false);
        const requestedBy = codeExecMap.get("requestedBy") as string;
        // Only the requester sends the execute request
        if (requestedBy === userId) {
          void executeCode(codeExecMap);
        }
      } else if (status === "running") {
        setShowApprovalModal(false);
      } else if (status === "completed") {
        setShowApprovalModal(false);
        const resultsStr = codeExecMap.get("results") as string;
        if (resultsStr) {
          try {
            setExecResults(JSON.parse(resultsStr));
          } catch {
            setExecResults(null);
          }
        }
      } else if (status === "rejected") {
        setShowApprovalModal(false);
        // Reset to idle after showing rejection briefly
        setTimeout(() => {
          const currentStatus = codeExecMap.get("status");
          if (currentStatus === "rejected") {
            codeExecMap.set("status", "idle");
            setExecStatus("idle");
          }
        }, 3000);
      }
    };

    codeExecMap.observe(observer);
    execObserverRef.current = () => codeExecMap.unobserve(observer);

    return () => {
      codeExecMap.unobserve(observer);
      execObserverRef.current = null;
    };
  }, [ydoc, userId, executeCode]);

  const handleRunCode = () => {
    if (!ydoc) return;
    const codeExecMap = ydoc.getMap("codeExecution");
    const currentStatus = codeExecMap.get("status") as string | undefined;
    if (currentStatus === "pending" || currentStatus === "running") return;
    ydoc.transact(() => {
      codeExecMap.set("requestedBy", userId);
      codeExecMap.set("timestamp", Date.now());
      codeExecMap.set("status", "pending");
    });
  };

  const handleApproveExecution = () => {
    if (!ydoc) return;
    const codeExecMap = ydoc.getMap("codeExecution");
    codeExecMap.set("status", "approved");
    codeExecMap.set("approvedBy", userId);
    setShowApprovalModal(false);
  };

  const handleDeclineExecution = () => {
    if (!ydoc) return;
    const codeExecMap = ydoc.getMap("codeExecution");
    codeExecMap.set("status", "rejected");
    setShowApprovalModal(false);
  };

  // translation handlers
  const handleTranslate = async (targetLanguage: string) => {
    setShowTranslateDropdown(false);
    if (!codeEditorRef.current || isTranslating) return;

    const currentCode = codeEditorRef.current.getCode();
    if (!currentCode || currentCode.trim().length === 0) {
      addSideToast(
        "There is no code to translate. Write some code first.",
        "⚠️",
        "#ed8936",
      );
      return;
    }

    setIsTranslating(true);
    setTranslationTargetLang(targetLanguage);

    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: currentCode,
          sourceLanguage: state?.programmingLanguage || "javascript",
          targetLanguage,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Translation failed");
      }

      const data = await res.json();
      setTranslationResult(data.translatedCode);
      setShowTranslationModal(true);
    } catch (err: any) {
      addSideToast(
        `Translation failed: ${err.message || "Please try again."}`,
        "❌",
        "#e53e3e",
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslationReject = () => {
    setShowTranslationModal(false);
    setTranslationResult("");
    setTranslationTargetLang("");
  };

  const handleTranslationApprove = () => {
    if (codeEditorRef.current && translationResult) {
      const timestamp = Date.now();
      setPendingTranslation({
        code: translationResult,
        language: translationTargetLang,
        timestamp,
      });
      codeEditorRef.current.broadcastTranslationApprovalRequest(
        translationTargetLang,
        timestamp,
      );
    }
    setShowTranslationModal(false);
  };

  const lastTranslationToastRef = useRef<number>(0);
  const handlePeerTranslation = useCallback(
    (language: string) => {
      const now = Date.now();
      if (now - lastTranslationToastRef.current < 2000) return; // Debounce duplicate toasts
      lastTranslationToastRef.current = now;
      addSideToast(
        `Code translated to ${SUPPORTED_LANGUAGES.find((l) => l.value === language.toLowerCase())?.label || language} by your peer`,
        "✨",
        "var(--green, #48bb78)",
      );
    },
    [addSideToast],
  );

  const handleTranslationApprovalRequest = useCallback(
    (language: string, timestamp: number) => {
      setPeerTranslationRequestLang({ language, timestamp });
    },
    [],
  );

  const handleTranslationApprovalResponse = useCallback(
    (isApproved: boolean, timestamp: number) => {
      setPendingTranslation((prev) => {
        if (prev && prev.timestamp === timestamp) {
          if (isApproved) {
            if (codeEditorRef.current) {
              codeEditorRef.current.setCode(prev.code);
              codeEditorRef.current.broadcastTranslation(prev.language);
            }
          } else {
            addSideToast(
              "Your request was denied by your peer.",
              "🚫",
              "#e53e3e",
            );
          }
          return null;
        }
        return prev;
      });
    },
    [],
  );

  const handleExplainCode = async () => {
    if (!codeEditorRef.current || isExplaining) return;

    const currentCode = codeEditorRef.current.getCode();
    if (!currentCode || currentCode.trim().length === 0) {
      addSideToast(
        "There is no code to explain. Write some code first.",
        "⚠️",
        "#ed8936",
      );
      return;
    }

    setIsExplaining(true);
    try {
      const questionText = question
        ? `${question.title}\n${question.description}`
        : "";
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: currentCode,
          question: questionText,
          language: currentLanguage,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Explanation failed");
      }

      const data = await res.json();
      setExplanationResult(data.explanation);
      setShowExplainModal(true);
    } catch (err: any) {
      addSideToast(
        `Explanation failed: ${err.message || "Please try again."}`,
        "❌",
        "#e53e3e",
      );
    } finally {
      setIsExplaining(false);
    }
  };

  // Language Change Handlers
  const handleLanguageSelect = (lang: string) => {
    setShowLanguageDropdown(false);
    if (lang === currentLanguage) return;
    const timestamp = Date.now();
    setPendingLanguageChange({ language: lang, timestamp });
    if (codeEditorRef.current) {
      codeEditorRef.current.broadcastLanguageRequest(lang);
    }
  };

  const handleLanguageChangeRequest = useCallback((language: string) => {
    setPeerLanguageRequestLang(language);
    setShowLanguageRequestModal(true);
  }, []);

  const handleLanguageChangeApproved = useCallback(
    (language: string) => {
      setPendingLanguageChange(null);
      setCurrentLanguage(language);
      addSideToast(
        `Code editor language changed to ${SUPPORTED_LANGUAGES.find((l) => l.value === language.toLowerCase())?.label || language}`,
        "✨",
        "var(--green, #48bb78)",
      );
    },
    [addSideToast],
  );

  const handleLanguageChangeResponse = useCallback(
    (isApproved: boolean) => {
      setPendingLanguageChange(null);
      if (!isApproved) {
        addSideToast("Your request was denied by your peer.", "🚫", "#e53e3e");
      }
    },
    [addSideToast],
  );

  const handleLanguageRequestReject = () => {
    if (codeEditorRef.current) {
      codeEditorRef.current.broadcastLanguageResponse(false, Date.now());
    }
    setPeerLanguageRequestLang(null);
    setShowLanguageRequestModal(false);
  };

  const handleLanguageRequestApprove = async () => {
    const targetLang = peerLanguageRequestLang;
    setPeerLanguageRequestLang(null);
    setShowLanguageRequestModal(false);
    if (!targetLang) return;

    setCurrentLanguage(targetLang);

    if (codeEditorRef.current) {
      codeEditorRef.current.broadcastLanguageApproved(targetLang);
    }

    try {
      await fetch(`/api/collaboration/sessions/${sessionId}/language`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ language: targetLang }),
      });
    } catch (err) {
      console.error("Failed to save language change", err);
    }
  };

  const yourDifficulty = formatDifficultyLabel(state?.difficulty);
  const partnerDifficulty = formatDifficultyLabel(
    state?.peerRequestedDifficulty ?? undefined,
  );
  const matchKindLabel =
    state?.matchingType === "downward"
      ? "Downward match"
      : state?.matchingType === "same_difficulty"
        ? "Same difficulty match"
        : null;

  const showMatchBanner = Boolean(state?.peerUserId);

  // filter out the current language from the translate dropdown
  const currentLangKey = currentLanguage.toLowerCase();
  const translateLanguages = SUPPORTED_LANGUAGES.filter(
    (l) =>
      l.value !== currentLangKey &&
      l.value !== (currentLangKey === "c++" ? "cpp" : currentLangKey),
  );

  return (
    <div className="workspace-layout">
      {/* Workspace Header */}
      <header className="workspace-header">
        <div className="header-left">
          <div className="workspace-brand">
            <Layout className="h-5 w-5 text-accent-primary" />
            <span className="font-semibold">PeerPrep Workspace</span>
          </div>
          <div className="session-info">
            <span className="tag-sm">{state?.difficulty || "Medium"}</span>
            <span className="tag-sm">{state?.topic || "Arrays"}</span>
            {state?.programmingLanguage ? (
              <span className="tag-sm">{state.programmingLanguage}</span>
            ) : null}
          </div>
        </div>

        <div className="header-right">
          <div className="peer-status">
            <div
              className={`status-indicator ${partnerOnline ? "online" : "offline"}`}
              style={{
                backgroundColor: partnerOnline
                  ? "var(--success-color)"
                  : "var(--danger-color)",
              }}
            ></div>
            <span className="text-sm text-secondary">
              {state?.peerUserId
                ? `Peer: ${state.peerUserId}`
                : "Peer Connected"}
            </span>
          </div>
          <Button
            variant="solid"
            theme="user"
            size="sm"
            onClick={handleEndSession}
          >
            <LogOut className="h-4 w-4 mr-2" />
            End Session
          </Button>
        </div>
      </header>

      {showMatchBanner ? (
        <div className="workspace-match-banner" role="status">
          {matchKindLabel ? (
            <>
              <p className="workspace-match-banner__title">Match</p>
              <p className="workspace-match-banner__line">
                <strong>Your requested difficulty:</strong> {yourDifficulty}
                {" · "}
                <strong>Partner requested difficulty:</strong>{" "}
                {partnerDifficulty}
              </p>
              <p className="workspace-match-banner__kind">{matchKindLabel}</p>
            </>
          ) : null}

          <p className="workspace-match-banner__title workspace-match-banner__title--sub">
            Session time (optional preference)
          </p>
          <p className="workspace-match-banner__line">
            <strong>Yours:</strong>{" "}
            {formatMinutesLine(state?.timeAvailableMinutes)}
            {" · "}
            <strong>Partner:</strong>{" "}
            {formatMinutesLine(state?.peerTimeAvailableMinutes)}
          </p>
          <p className="workspace-match-banner__line">
            <strong>Aligned time (both chose the same):</strong>{" "}
            {state?.matchedTimeAvailableMinutes != null
              ? `${state.matchedTimeAvailableMinutes} min`
              : "—"}
          </p>
          <p className="workspace-match-banner__hint">
            Time is a soft preference — different or missing times do not block
            matching.
          </p>
        </div>
      ) : null}

      {/* Main Workspace Area */}
      <main className="workspace-main">
        {/* Left Panel: Question */}
        <section className="panel question-panel">
          <div className="panel-header">
            <h2 className="panel-title">{question?.title || "1. Two Sum"}</h2>
            <div className="flex gap-2">
              <span className="tag-sm custom-tag text-success bg-success-light">
                {question?.complexity || state?.difficulty || "Easy"}
              </span>
            </div>
          </div>
          <div className="panel-content prose custom-prose">
            {question ? (
              <div dangerouslySetInnerHTML={{ __html: question.description }} />
            ) : (
              <>
                <p>
                  Given an array of integers <code>nums</code> and an integer{" "}
                  <code>target</code>, return{" "}
                  <em>
                    indices of the two numbers such that they add up to{" "}
                    <code>target</code>
                  </em>
                  .
                </p>
                <p>
                  You may assume that each input would have{" "}
                  <strong>
                    <em>exactly</em> one solution
                  </strong>
                  , and you may not use the <em>same</em> element twice.
                </p>
                <p>You can return the answer in any order.</p>
              </>
            )}

            <div className="example-block">
              <strong>Example 1:</strong>
              <pre>
                Input: nums = [2,7,11,15], target = 9{"\n"}
                Output: [0,1]{"\n"}
                Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
              </pre>
            </div>

            <div className="example-block">
              <strong>Example 2:</strong>
              <pre>
                Input: nums = [3,2,4], target = 6{"\n"}
                Output: [1,2]
              </pre>
            </div>

            {question?.imageUrls && question.imageUrls.length > 0 && (
              <div
                className="workspace-question-images"
                style={{ marginTop: "2rem" }}
              >
                <strong
                  style={{
                    display: "block",
                    marginBottom: "1rem",
                    color: "var(--text-primary)",
                  }}
                >
                  Reference Images:
                </strong>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {question.imageUrls.map((url: string, index: number) => (
                    <div
                      key={index}
                      className="workspace-image-container"
                      style={{
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <img 
                        src={url} 
                        alt={`Question reference ${index + 1}`} 
                        style={{ width: '100%', display: 'block', objectFit: 'contain' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Panel: Editor Area */}
        <section className="panel editor-panel">
          <div className="editor-header">
            <div className="editor-tabs">
              <button className="editor-tab active">
                <Code2 className="h-4 w-4 mr-2" />
                solution{getFileExtension(currentLanguage)}
              </button>
            </div>
            <div className="editor-actions">
              <Button
                size="sm"
                className="ml-2"
                onClick={handleRunCode}
                disabled={execStatus === "pending" || execStatus === "running"}
              >
                {execStatus === "running" ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {execStatus === "pending"
                  ? "Awaiting Approval..."
                  : execStatus === "running"
                    ? "Running..."
                    : "Run Code"}
              </Button>
              {/* Explain Code Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExplainCode}
                disabled={isExplaining}
                className="ml-2"
              >
                {isExplaining ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Lightbulb
                    className="h-4 w-4 mr-2"
                    style={{ color: "var(--accent-warning, #ecc94b)" }}
                  />
                )}
                {isExplaining ? "Explaining..." : "Explain"}
              </Button>
              {/* Translate Code Button */}
              <div className="translate-container" ref={translateDropdownRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setShowTranslateDropdown(!showTranslateDropdown)
                  }
                  disabled={isTranslating}
                  className="translate-btn"
                >
                  {isTranslating ? (
                    <Loader2 className="h-4 w-4 mr-2 translate-spinner" />
                  ) : (
                    <Languages className="h-4 w-4 mr-2" />
                  )}
                  {isTranslating ? "Translating..." : "Translate Code"}
                  {!isTranslating && <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>

                {showTranslateDropdown && (
                  <div className="translate-dropdown">
                    <div className="translate-dropdown__header">
                      Translate to:
                    </div>
                    {translateLanguages.map((lang) => (
                      <button
                        key={lang.value}
                        className="translate-dropdown__item"
                        onClick={() => handleTranslate(lang.value)}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="translate-container" ref={languageDropdownRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                {showLanguageDropdown && (
                  <div className="translate-dropdown">
                    <div className="translate-dropdown__header">
                      Change Language:
                    </div>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        key={lang.value}
                        className="translate-dropdown__item"
                        onClick={() => handleLanguageSelect(lang.value)}
                        style={{
                          fontWeight:
                            currentLanguage === lang.value ? "bold" : "normal",
                        }}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="editor-content" style={{ overflow: "hidden" }}>
            {isSessionLoading ? (
              <div
                style={{
                  padding: "2rem",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                Connecting to a collaborative session...
              </div>
            ) : !hasSessionEnded ? (
              <CodeEditor
                ref={codeEditorRef}
                value={code}
                onChange={(val) => setCode(val || "")}
                language={currentLanguage}
                currentUser={currentUser}
                sessionId={sessionId}
                onSystemTerminate={handleSystemTerminate}
                onPartnerPresenceChange={handlePartnerPresenceChange}
                onYdocReady={handleYdocReady}
                onPeerTranslation={handlePeerTranslation}
                onLanguageChangeRequest={handleLanguageChangeRequest}
                onLanguageChangeApproved={handleLanguageChangeApproved}
                onLanguageChangeResponse={handleLanguageChangeResponse}
                onTranslationApprovalRequest={handleTranslationApprovalRequest}
                onTranslationApprovalResponse={
                  handleTranslationApprovalResponse
                }
              />
            ) : null}
          </div>

          <div className="editor-console">
            <div className="console-header">
              <span className="text-sm font-semibold">Console Output</span>
            </div>
            <div
              className="console-content"
              style={{
                fontFamily: "monospace",
                fontSize: "13px",
                padding: "0.75rem",
                overflowY: "auto",
              }}
            >
              {execStatus === "idle" && (
                <span className="text-muted text-sm">
                  Run your code to see the output here
                </span>
              )}
              {execStatus === "pending" && (
                <span style={{ color: "var(--text-secondary)" }}>
                  <Loader className="h-4 w-4 inline-block mr-2 animate-spin" />
                  Waiting for peer approval...
                </span>
              )}
              {execStatus === "running" && (
                <span style={{ color: "var(--text-secondary)" }}>
                  <Loader className="h-4 w-4 inline-block mr-2 animate-spin" />
                  Executing code...
                </span>
              )}
              {execStatus === "rejected" && (
                <span style={{ color: "#f56565" }}>
                  Peer declined the execution request.
                </span>
              )}
              {execStatus === "completed" && execResults && (
                <div>
                  {execResults.results && execResults.results.length > 0 ? (
                    <div>
                      {execResults.results.map((r: any) => (
                        <div
                          key={r.testCase}
                          style={{
                            marginBottom: "0.5rem",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "0.5rem",
                          }}
                        >
                          {r.passed ? (
                            <CheckCircle
                              className="h-4 w-4"
                              style={{
                                color: "#48bb78",
                                flexShrink: 0,
                                marginTop: "2px",
                              }}
                            />
                          ) : (
                            <XCircle
                              className="h-4 w-4"
                              style={{
                                color: "#f56565",
                                flexShrink: 0,
                                marginTop: "2px",
                              }}
                            />
                          )}
                          <div>
                            <span style={{ fontWeight: 600 }}>
                              Test {r.testCase}:{" "}
                            </span>
                            <span
                              style={{
                                color: r.passed ? "#48bb78" : "#f56565",
                              }}
                            >
                              {r.passed ? "PASSED" : "FAILED"}
                            </span>
                            {!r.passed && (
                              <div
                                style={{
                                  marginTop: "2px",
                                  color: "var(--text-secondary)",
                                  fontSize: "12px",
                                }}
                              >
                                {r.error ? (
                                  <span>Error: {r.error}</span>
                                ) : (
                                  <>
                                    <div>Expected: {r.expected}</div>
                                    <div>Actual: {r.actual}</div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <div
                        style={{
                          marginTop: "0.75rem",
                          paddingTop: "0.5rem",
                          borderTop: "1px solid var(--border-color)",
                          fontWeight: 600,
                        }}
                      >
                        {
                          execResults.results.filter((r: any) => r.passed)
                            .length
                        }
                        /{execResults.results.length} tests passed
                      </div>
                    </div>
                  ) : null}
                  {execResults.stderr && (
                    <div
                      style={{
                        marginTop: "0.5rem",
                        color: "#f56565",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {execResults.stderr}
                    </div>
                  )}
                  {!execResults.results?.length && !execResults.stderr && (
                    <span className="text-muted text-sm">
                      No results returned.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Floating Chat Button */}
      <button className="chat-fab" onClick={() => setShowChat((v) => !v)}>
        <MessageSquare className="h-6 w-6" />
      </button>

      {/* Modal for chat */}
      {showChat && chatChannelId && !isSessionLoading && !hasSessionEnded ? (
        <div className="workspace-chat-panel">
          <SessionChat channelId={chatChannelId} />
        </div>
      ) : null}

      {/* Code Execution Approval Modal */}
      {showApprovalModal && !hasSessionEnded && (
        <div className="translation-modal-overlay">
          <div className="translation-modal" style={{ maxWidth: "450px" }}>
            <div className="translation-modal__header">
              <h2 className="translation-modal__title">Run Code Request</h2>
            </div>
            <div
              className="translation-modal__body"
              style={{ color: "var(--user-200)", fontSize: "0.95rem" }}
            >
              <p>Your peer wants to run the code. Do you approve?</p>
            </div>
            <div className="translation-modal__actions">
              <button
                className="translation-modal__btn translation-modal__btn--reject"
                onClick={handleDeclineExecution}
              >
                Decline
              </button>
              <button
                className="translation-modal__btn translation-modal__btn--approve"
                onClick={handleApproveExecution}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Side Toasts */}
      <div
        style={{
          position: "fixed",
          top: "80px",
          right: "1.5rem",
          zIndex: 9500,
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {sideToasts.map((toast) => (
          <div
            key={toast.id}
            className="translation-notification__content"
            style={{
              borderLeft: `3px solid ${toast.border}`,
              animation: "slideInRight 0.35s ease-out",
            }}
          >
            <span className="translation-notification__icon">{toast.icon}</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Translation Modal */}
      <TranslationModal
        translatedCode={translationResult}
        targetLanguage={translationTargetLang}
        onReject={handleTranslationReject}
        onApprove={handleTranslationApprove}
        isVisible={showTranslationModal}
      />

      {/* Explain Modal */}
      <ExplainModal
        explanation={explanationResult}
        isVisible={showExplainModal}
        onClose={() => setShowExplainModal(false)}
      />

      {/* Disconnection Modal */}
      {showDisconnectModal && !partnerOnline && !hasSessionEnded && (
        <div className="translation-modal-overlay">
          <div
            className="translation-modal"
            style={{ maxWidth: "500px", textAlign: "center" }}
          >
            <div
              className="translation-modal__header"
              style={{ borderBottom: "none", paddingBottom: 0 }}
            >
              <h2
                className="translation-modal__title"
                style={{
                  fontSize: "1.25rem",
                  color: "var(--accent-danger, #e53e3e)",
                }}
              >
                Peer Disconnected!
              </h2>
            </div>
            <div
              className="translation-modal__body"
              style={{ color: "var(--user-200)", fontSize: "0.95rem" }}
            >
              <p style={{ marginBottom: "1rem" }}>
                Your peer got disconnected. This session will be closed in 2
                minutes to free up resources.
              </p>
              <p>
                You can either Wait for them to reconnect, or end this session
                and Return to your Dashboard.
              </p>
            </div>
            <div
              className="translation-modal__actions"
              style={{ justifyContent: "center" }}
            >
              <button
                className="translation-modal__btn translation-modal__btn--reject"
                onClick={() => setShowDisconnectModal(false)}
              >
                Wait
              </button>
              <button
                className="translation-modal__btn translation-modal__btn--approve"
                onClick={() => void handleEndSessionInstantly()}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Session Modal */}
      {showEndSessionModal && (
        <div className="translation-modal-overlay">
          <div className="translation-modal" style={{ maxWidth: "450px" }}>
            <div className="translation-modal__header">
              <h2 className="translation-modal__title">End Session</h2>
            </div>
            <div
              className="translation-modal__body"
              style={{ color: "var(--user-200)", fontSize: "0.95rem" }}
            >
              <p>
                This will end the session for both peers. Are you sure you want
                to end this session?
              </p>
            </div>
            <div className="translation-modal__actions">
              <button
                className="translation-modal__btn translation-modal__btn--reject"
                onClick={() => setShowEndSessionModal(false)}
              >
                Cancel
              </button>
              <button
                className="translation-modal__btn translation-modal__btn--approve"
                style={{ backgroundColor: "var(--accent-danger, #e53e3e)" }}
                onClick={() => {
                  setShowEndSessionModal(false);
                  void handleEndSessionInstantly();
                }}
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Language Change Request Modal */}
      {showLanguageRequestModal && peerLanguageRequestLang && (
        <div className="translation-modal-overlay">
          <div className="translation-modal" style={{ maxWidth: "450px" }}>
            <div className="translation-modal__header">
              <h2 className="translation-modal__title">
                Language Change Request
              </h2>
            </div>
            <div
              className="translation-modal__body"
              style={{ color: "var(--user-200)", fontSize: "0.95rem" }}
            >
              <p>
                Your peer wants to change the current programming language to{" "}
                <strong>
                  {SUPPORTED_LANGUAGES.find(
                    (l) => l.value === peerLanguageRequestLang.toLowerCase(),
                  )?.label || peerLanguageRequestLang}
                </strong>
                .
              </p>
              <p style={{ marginTop: "0.5rem", opacity: 0.8 }}>
                Do you approve this change?
              </p>
            </div>
            <div className="translation-modal__actions">
              <button
                className="translation-modal__btn translation-modal__btn--reject"
                onClick={handleLanguageRequestReject}
              >
                Reject
              </button>
              <button
                className="translation-modal__btn translation-modal__btn--approve"
                onClick={handleLanguageRequestApprove}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Translation Approval Request Modal */}
      {peerTranslationRequestLang && (
        <div className="translation-modal-overlay">
          <div className="translation-modal" style={{ maxWidth: "450px" }}>
            <div className="translation-modal__header">
              <h2 className="translation-modal__title">Translation Request</h2>
            </div>
            <div
              className="translation-modal__body"
              style={{ color: "var(--user-200)", fontSize: "0.95rem" }}
            >
              <p>
                Your peer wants to use AI to translate this code into{" "}
                <strong>{peerTranslationRequestLang.language}</strong>.
              </p>
              <p style={{ marginTop: "0.5rem", opacity: 0.8 }}>
                Do you approve this change?
              </p>
            </div>
            <div className="translation-modal__actions">
              <button
                className="translation-modal__btn translation-modal__btn--reject"
                onClick={() => {
                  codeEditorRef.current?.broadcastTranslationApprovalResponse(
                    false,
                    peerTranslationRequestLang.timestamp,
                  );
                  setPeerTranslationRequestLang(null);
                }}
              >
                Reject
              </button>
              <button
                className="translation-modal__btn translation-modal__btn--approve"
                onClick={() => {
                  codeEditorRef.current?.broadcastTranslationApprovalResponse(
                    true,
                    peerTranslationRequestLang.timestamp,
                  );
                  setPeerTranslationRequestLang(null);
                }}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting Indicator */}
      {(pendingTranslation || pendingLanguageChange) && (
        <div className="waiting-indicator">
          <Loader2 className="h-4 w-4 translate-spinner" />
          <span>Waiting for peer approval...</span>
        </div>
      )}
    </div>
  );
};
