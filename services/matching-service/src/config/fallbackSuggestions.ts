/**
 * Opt-in fallback suggestions: timings and topic adjacency.
 * Suggestions are advisory only; matching correctness is unchanged.
 */

export function fallbackSuggestDownwardAfterMs(): number {
  return Number.parseInt(
    process.env.FALLBACK_SUGGEST_DOWNWARD_AFTER_MS ?? "20000",
    10,
  );
}

export function fallbackSuggestNearbyAfterMs(): number {
  return Number.parseInt(
    process.env.FALLBACK_SUGGEST_NEARBY_AFTER_MS ?? "30000",
    10,
  );
}

export function fallbackSuggestPopularAfterMs(): number {
  return Number.parseInt(
    process.env.FALLBACK_SUGGEST_POPULAR_AFTER_MS ?? "40000",
    10,
  );
}

/** Minimum score delta vs current topic to suggest nearby or popular switch. */
export function fallbackScoreDeltaMin(): number {
  const raw = process.env.FALLBACK_SCORE_DELTA_MIN?.trim();
  if (raw === undefined || raw === "") {
    return 0.5;
  }
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0.5;
}

/**
 * Fixed nearby-topic graph (topic id → neighbor topic ids).
 * Must stay aligned with `MATCH_TOPICS` / product.
 */
export const NEARBY_TOPICS: Record<string, readonly string[]> = {
  arrays: ["two-pointers", "sliding-window", "binary-search"],
  "two-pointers": ["arrays", "sliding-window"],
  "sliding-window": ["arrays", "two-pointers"],
  stack: ["linked-list", "trees"],
  "binary-search": ["arrays", "trees"],
  "linked-list": ["stack", "trees"],
  trees: ["graphs", "binary-search"],
  graphs: ["trees", "dp"],
  dp: ["trees", "graphs"],
};
