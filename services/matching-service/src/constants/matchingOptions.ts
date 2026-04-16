/**
 * Allowed values for match requests. Keep in sync with frontend selects where applicable.
 */
export const MATCH_TOPICS = [
  "arrays",
  "two-pointers",
  "sliding-window",
  "stack",
  "binary-search",
  "linked-list",
  "trees",
  "graphs",
  "dp",
] as const;

export type MatchTopic = (typeof MATCH_TOPICS)[number];

export const MATCH_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type MatchDifficulty = (typeof MATCH_DIFFICULTIES)[number];

export const PROGRAMMING_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
  "go",
] as const;

export type ProgrammingLanguage = (typeof PROGRAMMING_LANGUAGES)[number];

/** F2 — optional session length preference (minutes) */
export const TIME_AVAILABLE_MINUTES_ALLOWED = [30, 45, 60] as const;

export type TimeAvailableMinutes = (typeof TIME_AVAILABLE_MINUTES_ALLOWED)[number];

/** Human-readable labels for match topic ids (aligned with product copy). */
const TOPIC_DISPLAY_LABELS: Record<string, string> = {
  arrays: "Arrays & Hashing",
  "two-pointers": "Two Pointers",
  "sliding-window": "Sliding Window",
  stack: "Stack",
  "binary-search": "Binary Search",
  "linked-list": "Linked List",
  trees: "Trees",
  graphs: "Graphs",
  dp: "Dynamic Programming",
};

export function topicDisplayLabel(topicId: string): string {
  return TOPIC_DISPLAY_LABELS[topicId] ?? topicId;
}
