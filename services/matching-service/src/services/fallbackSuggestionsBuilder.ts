import type { MatchRequestRow } from "../types/matchRequestRow.js";
import {
  MATCH_TOPICS,
  topicDisplayLabel,
  type MatchTopic,
} from "../constants/matchingOptions.js";
import {
  NEARBY_TOPICS,
  fallbackScoreDeltaMin,
  fallbackSuggestDownwardAfterMs,
  fallbackSuggestNearbyAfterMs,
  fallbackSuggestPopularAfterMs,
} from "../config/fallbackSuggestions.js";
import { getMatchTimeoutSeconds } from "../config/matchLifecycle.js";
import { getTopicActivityScoresCached } from "./topicActivityScores.js";

export type FallbackSuggestionAction =
  | { type: "update_request"; patch: { allowLowerDifficultyMatch: boolean } }
  | { type: "create_new_request"; newCriteria: { topic: string } };

export type FallbackSuggestionDTO = {
  type:
    | "enable_downward_matching"
    | "switch_topic_nearby"
    | "switch_topic_popular";
  title: string;
  description: string;
  action: FallbackSuggestionAction;
};

function isMatchTopic(s: string): s is MatchTopic {
  return (MATCH_TOPICS as readonly string[]).includes(s);
}

/**
 * Core suggestion list from criteria + elapsed wait (no status checks).
 * Callers enforce PENDING vs TIMED_OUT / window rules.
 */
async function buildFallbackSuggestionsAtWaitTime(
  row: MatchRequestRow,
  waitTimeMs: number,
): Promise<FallbackSuggestionDTO[]> {
  const scores = await getTopicActivityScoresCached();
  const currentTopic = row.topic;
  const currentScore = scores[currentTopic] ?? 0;
  const deltaMin = fallbackScoreDeltaMin();

  const out: FallbackSuggestionDTO[] = [];

  const tDown = fallbackSuggestDownwardAfterMs();
  const tNear = fallbackSuggestNearbyAfterMs();
  const tPop = fallbackSuggestPopularAfterMs();

  // 1) Enable downward — time only; medium/hard; not already enabled
  if (
    waitTimeMs >= tDown &&
    (row.difficulty === "hard" || row.difficulty === "medium") &&
    !row.allowLowerDifficultyMatch
  ) {
    out.push({
      type: "enable_downward_matching",
      title: "Allow lower difficulty",
      description:
        "Allow lower difficulty matching to increase your chances.",
      action: {
        type: "update_request",
        patch: { allowLowerDifficultyMatch: true },
      },
    });
  }

  // 2) Nearby topic — one neighbor with meaningfully higher aggregate score
  if (waitTimeMs >= tNear) {
    const neighbors = NEARBY_TOPICS[currentTopic] ?? [];
    let bestTopic: string | null = null;
    let bestScore = -Infinity;
    for (const n of neighbors) {
      if (!isMatchTopic(n)) continue;
      const sc = scores[n] ?? 0;
      if (sc - currentScore >= deltaMin && sc > bestScore) {
        bestScore = sc;
        bestTopic = n;
      }
    }
    if (bestTopic !== null) {
      const label = topicDisplayLabel(bestTopic);
      out.push({
        type: "switch_topic_nearby",
        title: `Try ${label}`,
        description: `${label} is a closely related topic with higher recent activity.`,
        action: {
          type: "create_new_request",
          newCriteria: { topic: bestTopic },
        },
      });
    }
  }

  // 3) Popular topic — best aggregate score excluding current; must beat current clearly
  if (waitTimeMs >= tPop) {
    let bestTopic: string | null = null;
    let bestScore = -Infinity;
    for (const t of MATCH_TOPICS) {
      if (t === currentTopic) continue;
      const sc = scores[t] ?? 0;
      if (sc > bestScore) {
        bestScore = sc;
        bestTopic = t;
      }
    }
    if (
      bestTopic !== null &&
      bestScore - currentScore >= deltaMin &&
      isMatchTopic(bestTopic)
    ) {
      // Avoid duplicating the same topic as the nearby suggestion
      const nearbyPick = out.find((s) => s.type === "switch_topic_nearby");
      const nearbyTopic =
        nearbyPick?.action.type === "create_new_request"
          ? nearbyPick.action.newCriteria.topic
          : null;
      if (bestTopic !== nearbyTopic) {
        const label = topicDisplayLabel(bestTopic);
        out.push({
          type: "switch_topic_popular",
          title: `Try ${label}`,
          description: `${label} has been popular recently.`,
          action: {
            type: "create_new_request",
            newCriteria: { topic: bestTopic },
          },
        });
      }
    }
  }

  return out;
}

/**
 * Builds 0–3 advisory suggestions. Does not read live pool membership.
 * Only for PENDING rows with disconnectedAt === null (actively waiting in matcher).
 */
export async function buildFallbackSuggestions(
  row: MatchRequestRow,
  waitTimeMs: number,
): Promise<FallbackSuggestionDTO[]> {
  if (row.status !== "PENDING" || row.disconnectedAt !== null) {
    return [];
  }

  const matchWindowEndMs =
    row.createdAt.getTime() + getMatchTimeoutSeconds() * 1000;
  if (Date.now() >= matchWindowEndMs) {
    return [];
  }

  return buildFallbackSuggestionsAtWaitTime(row, waitTimeMs);
}

/**
 * Same rules as a full-length wait, for TIMED_OUT rows (GET after timeout / return visit).
 * Lets clients show what would have been suggested without persisting suggestions in DB.
 */
export async function buildFallbackSuggestionsForTimedOut(
  row: MatchRequestRow,
): Promise<FallbackSuggestionDTO[]> {
  if (row.status !== "TIMED_OUT") {
    return [];
  }
  const waitTimeMs = getMatchTimeoutSeconds() * 1000 - 1;
  return buildFallbackSuggestionsAtWaitTime(row, waitTimeMs);
}
