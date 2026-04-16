/**
 * F10.1 — Matching decision order (PeerPrep)
 *
 * The engine receives **only** rows already filtered as eligible by the service layer:
 * (1) active match request: `PENDING`, connected (`disconnectedAt == null`), not matched —
 *     timeouts / reconnect-expired / cancelled are excluded before `findFirstPair` runs.
 *
 * Within the engine:
 * (2–3) Group by hard constraints: same `topic`, same `programmingLanguage`.
 * (4) Within each pool, consider requesters in **longest-waiting** order:
 *     earliest `createdAt` first (then `userId`, then `id` for stability).
 * (5–6) For each requester: try **same-difficulty** partners first; if none,
 *       try **downward** only if `allowLowerDifficultyMatch` — never upward.
 * (7) Among eligible partners at that difficulty stage, **prefer** exact `timeAvailableMinutes`
 *     when both sides specified the same value; missing/mismatched time never blocks.
 * (8) Deterministic tie-break: `createdAt` asc → `userId` asc → `id` asc.
 * (9) Finalization is done in `matchRequestService.tryMatchQueue` (not here).
 */

export type MatchRequestRow = {
  id: string;
  userId: string;
  topic: string;
  difficulty: string;
  programmingLanguage: string;
  allowLowerDifficultyMatch: boolean;
  /** F2 — null if not specified; never a hard filter */
  timeAvailableMinutes: number | null;
  createdAt: Date;
};

export type MatchingTypeApi = "same_difficulty" | "downward";

export type MatchPairResult = {
  requester: MatchRequestRow;
  partner: MatchRequestRow;
  matchingType: MatchingTypeApi;
};

function poolKey(r: MatchRequestRow): string {
  return poolKeyString(r.topic, r.programmingLanguage);
}

/** Stable pool id — same as `poolKey` / DB grouping for `(topic, programmingLanguage)`. */
export function poolKeyString(topic: string, programmingLanguage: string): string {
  return `${topic}\0${programmingLanguage}`;
}

/**
 * F10.1 §8 — Tie-break: earliest submission, then ascending `userId`, then `id`.
 */
export function compareMatchRequests(
  a: MatchRequestRow,
  b: MatchRequestRow,
): number {
  const t = a.createdAt.getTime() - b.createdAt.getTime();
  if (t !== 0) return t;
  const u = a.userId.localeCompare(b.userId);
  if (u !== 0) return u;
  return a.id.localeCompare(b.id);
}

/** F10.1 §3–4 — Group eligible rows by `(topic, programmingLanguage)`. */
export function groupByTopicAndLanguage(
  eligible: MatchRequestRow[],
): Map<string, MatchRequestRow[]> {
  const byPool = new Map<string, MatchRequestRow[]>();
  for (const r of eligible) {
    const k = poolKey(r);
    let list = byPool.get(k);
    if (!list) {
      list = [];
      byPool.set(k, list);
    }
    list.push(r);
  }
  return byPool;
}

/** Deterministic order across pools (stable, readable). */
export function sortedPoolKeys(byPool: Map<string, MatchRequestRow[]>): string[] {
  return [...byPool.keys()].sort((a, b) => a.localeCompare(b));
}

/**
 * F10.1 §4 — Longest-waiting first = earliest `createdAt` (same as ascending queue fairness).
 */
export function orderRequestersLongestWaitingFirst(
  pool: MatchRequestRow[],
): MatchRequestRow[] {
  return [...pool].sort(compareMatchRequests);
}

/** F10.1 §7 — Prefer exact time match when both specified; ranking only. */
function timePreferenceRank(
  requester: MatchRequestRow,
  candidate: MatchRequestRow,
): number {
  const rt = requester.timeAvailableMinutes;
  const ct = candidate.timeAvailableMinutes;
  if (rt != null && ct != null && rt === ct) return 1;
  return 0;
}

/**
 * F10.1 §7–8 — Among partners already filtered by difficulty rules:
 * prefer exact time match, then `compareMatchRequests`.
 */
function orderPartnerCandidates(
  requester: MatchRequestRow,
  partners: MatchRequestRow[],
): MatchRequestRow[] {
  return [...partners].sort((a, b) => {
    const pa = timePreferenceRank(requester, a);
    const pb = timePreferenceRank(requester, b);
    if (pa !== pb) return pb - pa;
    return compareMatchRequests(a, b);
  });
}

/** F5.1 — Hard > Medium > Easy */
const DIFFICULTY_RANK: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

function difficultyRank(d: string): number {
  return DIFFICULTY_RANK[d] ?? 0;
}

/** True iff partner’s difficulty is strictly lower than requester’s (downward only). */
export function isStrictlyLowerDifficulty(
  partnerDifficulty: string,
  requesterDifficulty: string,
): boolean {
  const pr = difficultyRank(partnerDifficulty);
  const rr = difficultyRank(requesterDifficulty);
  if (pr === 0 || rr === 0) return false;
  return pr < rr;
}

/**
 * F10.1 §5–6 — Same-difficulty partners first; downward only if opted in.
 */
function findPartnerForRequester(
  requester: MatchRequestRow,
  othersInPool: MatchRequestRow[],
): MatchPairResult | null {
  const others = othersInPool.filter((p) => p.userId !== requester.userId);

  const sameDifficulty = others.filter((p) => p.difficulty === requester.difficulty);
  const bestSame = orderPartnerCandidates(requester, sameDifficulty)[0];
  if (bestSame !== undefined) {
    return {
      requester,
      partner: bestSame,
      matchingType: "same_difficulty",
    };
  }

  if (!requester.allowLowerDifficultyMatch) {
    return null;
  }

  const downward = others.filter((p) =>
    isStrictlyLowerDifficulty(p.difficulty, requester.difficulty),
  );
  const bestDown = orderPartnerCandidates(requester, downward)[0];
  if (bestDown !== undefined) {
    return {
      requester,
      partner: bestDown,
      matchingType: "downward",
    };
  }

  return null;
}

/**
 * F10.1 — Select the first pair that can be formed, scanning pools and requesters deterministically.
 */
export function findFirstPair(
  eligiblePending: MatchRequestRow[],
): MatchPairResult | null {
  if (eligiblePending.length < 2) return null;

  const byPool = groupByTopicAndLanguage(eligiblePending);

  for (const k of sortedPoolKeys(byPool)) {
    const pool = byPool.get(k)!;
    const requesters = orderRequestersLongestWaitingFirst(pool);

    for (const requester of requesters) {
      const pair = findPartnerForRequester(requester, pool);
      if (pair !== null) return pair;
    }
  }

  return null;
}
