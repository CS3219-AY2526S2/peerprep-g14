import { Prisma } from "@prisma/client";
import prisma from "../prisma.js";
import {
  getMatchTimeoutSeconds,
  MATCH_REQUEST_TIMEOUT_MESSAGE,
  getReconnectGraceSeconds,
  MATCH_REQUEST_RECONNECT_EXPIRED_MESSAGE,
} from "../config/matchLifecycle.js";
import type { CreateMatchRequestInput } from "../validation/matchRequestValidation.js";
import type { MatchRequestRow } from "../types/matchRequestRow.js";
import {
  buildMatchFoundPayload,
  publishMatchQueueEffects,
  publishMatchRequestCancelled,
  publishMatchRequestCreated,
  type MatchFoundEventPayload,
} from "../messaging/matchingDomainEvents.js";
import {
  findFirstPair,
  poolKeyString,
  type MatchPairResult,
  type MatchRequestRow as EngineMatchRequestRow,
} from "./matchingEngine.js";
import { broadcastMatchRequestDto } from "../sse/matchRequestSseHub.js";
import {
  publishMatchQueueWork,
  rabbitMatchQueueEnabled,
} from "../messaging/rabbitMatchQueue.js";
import {
  buildFallbackSuggestions,
  buildFallbackSuggestionsForTimedOut,
  type FallbackSuggestionDTO,
} from "./fallbackSuggestionsBuilder.js";
import type { AcceptFallbackBody } from "../validation/acceptFallbackValidation.js";

export type { FallbackSuggestionDTO };

type MRWhere = Prisma.MatchRequestWhereInput;
type MRUpdateManyData = Prisma.MatchRequestUncheckedUpdateManyInput;
type MRCreateData = Prisma.MatchRequestUncheckedCreateInput;

/** DB rows always match the schema; narrow when the language service uses a stale `@prisma/client`. */
function asMatchRow(v: unknown): MatchRequestRow {
  return v as MatchRequestRow;
}

/** Prisma `updateMany` `data` is an XOR type in generated clients; assert unchecked shape. */
function matchedRowUpdateData(
  partnerUserId: string,
  partnerRequestId: string,
  partnerDifficulty: string,
  partnerTimeAvailableMinutes: number | null,
  pairType: "SAME_DIFFICULTY" | "DOWNWARD",
): MRUpdateManyData {
  return {
    status: "MATCHED",
    peerUserId: partnerUserId,
    peerMatchRequestId: partnerRequestId,
    peerRequestedDifficulty: partnerDifficulty,
    peerTimeAvailableMinutes: partnerTimeAvailableMinutes,
    matchingPairType: pairType,
  } as MRUpdateManyData;
}

export type MatchPeerDTO = {
  userId: string;
  matchRequestId: string;
};

export type MatchRequestDTO = {
  id: string;
  userId: string;
  topic: string;
  difficulty: string;
  programmingLanguage: string;
  allowLowerDifficultyMatch: boolean;
  timeAvailableMinutes: number | null;
  status:
    | "PENDING"
    | "MATCHED"
    | "CANCELLED"
    | "TIMED_OUT"
    | "RECONNECT_EXPIRED";
  peerUserId: string | null;
  peerMatchRequestId: string | null;
  peer: MatchPeerDTO | null;
  peerRequestedDifficulty: string | null;
  peerTimeAvailableMinutes: number | null;
  matchedTimeAvailableMinutes: number | null;
  matchingType: "same_difficulty" | "downward" | null;
  message: string | null;
  /** F9 — while temporarily disconnected (grace active) */
  disconnectedAt: string | null;
  reconnectDeadlineAt: string | null;
  /** When status is PENDING: server-computed match-wait deadline (createdAt + timeout). Else null. */
  expiresAt: string | null;
  /** Server `MATCH_TIMEOUT_SECONDS` (for display cap; timeout status is still server-authoritative). */
  matchTimeoutSeconds: number;
  createdAt: string;
  updatedAt: string;
  /** Present when `status === "PENDING"` and connected (not in reconnect grace). */
  waitTimeMs?: number;
  /** Advisory only; must be explicitly accepted via `POST .../accept-fallback`. */
  fallbackSuggestions?: FallbackSuggestionDTO[];
};

function matchingPairTypeToApi(
  t: "SAME_DIFFICULTY" | "DOWNWARD" | null,
): "same_difficulty" | "downward" | null {
  if (t === null) return null;
  return t === "SAME_DIFFICULTY" ? "same_difficulty" : "downward";
}

function computedMatchedTimeMinutes(
  self: number | null,
  peer: number | null,
): number | null {
  if (self != null && peer != null && self === peer) return self;
  return null;
}

function pendingMatchTimeoutCutoff(): Date {
  const sec = getMatchTimeoutSeconds();
  return new Date(Date.now() - sec * 1000);
}

/**
 * F10.1 — Map DB rows to the engine input shape after eligibility filtering.
 * Eligibility (enforced in `tryMatchQueue`): `PENDING`, `disconnectedAt == null`
 * (connected / not beyond grace for matching), not `MATCHED`; `expirePendingRequests`
 * runs first so timed-out and reconnect-expired rows are not `PENDING`.
 */
function toEngineRow(r: MatchRequestRow): EngineMatchRequestRow {
  return {
    id: r.id,
    userId: r.userId,
    topic: r.topic,
    difficulty: r.difficulty,
    programmingLanguage: r.programmingLanguage,
    allowLowerDifficultyMatch: r.allowLowerDifficultyMatch,
    timeAvailableMinutes: r.timeAvailableMinutes,
    createdAt: r.createdAt,
  };
}

/**
 * F8 / F9 — expire reconnect grace first, then match-timeout for non-disconnected PENDING rows.
 * Returns rows that transitioned to `TIMED_OUT` (for domain events after commit).
 */
async function expirePendingRequests(
  tx: Prisma.TransactionClient | typeof prisma,
): Promise<{
  timedOutRows: MatchRequestRow[];
  reconnectExpiredPairs: { id: string; userId: string }[];
}> {
  const now = new Date();

  const reconnectCandidates = await tx.matchRequest.findMany({
    where: {
      status: "PENDING",
      disconnectedAt: { not: null },
      reconnectDeadlineAt: { lte: now },
    } as MRWhere,
  });
  const reconnectExpiredPairs = reconnectCandidates.map((r) => ({
    id: r.id,
    userId: r.userId,
  }));

  if (reconnectExpiredPairs.length > 0) {
    await tx.matchRequest.updateMany({
      where: {
        id: { in: reconnectExpiredPairs.map((p) => p.id) },
        status: "PENDING",
        disconnectedAt: { not: null },
        reconnectDeadlineAt: { lte: now },
      } as MRWhere,
      data: {
        status: "RECONNECT_EXPIRED",
        disconnectedAt: null,
        reconnectDeadlineAt: null,
      } as unknown as MRUpdateManyData,
    });
  }

  const cutoff = pendingMatchTimeoutCutoff();
  const toTimeOut = await tx.matchRequest.findMany({
    where: {
      status: "PENDING",
      disconnectedAt: null,
      createdAt: { lte: cutoff },
    } as MRWhere,
  });
  if (toTimeOut.length === 0) {
    return { timedOutRows: [], reconnectExpiredPairs };
  }

  await tx.matchRequest.updateMany({
    where: {
      id: { in: toTimeOut.map((r) => r.id) },
    } as MRWhere,
    data: { status: "TIMED_OUT" } as unknown as MRUpdateManyData,
  });
  return {
    timedOutRows: toTimeOut.map((r) => asMatchRow(r)),
    reconnectExpiredPairs,
  };
}

export type MatchQueueEffects = {
  timedOutRows: MatchRequestRow[];
  reconnectExpiredPairs: { id: string; userId: string }[];
  matches: MatchFoundEventPayload[];
};

function dtoMessage(status: MatchRequestDTO["status"]): string | null {
  if (status === "TIMED_OUT") return MATCH_REQUEST_TIMEOUT_MESSAGE;
  if (status === "RECONNECT_EXPIRED") {
    return MATCH_REQUEST_RECONNECT_EXPIRED_MESSAGE;
  }
  return null;
}

function toDTO(row: MatchRequestRow): MatchRequestDTO {
  const timeoutSec = getMatchTimeoutSeconds();
  const peer =
    row.status === "MATCHED" &&
    row.peerUserId !== null &&
    row.peerMatchRequestId !== null
      ? {
          userId: row.peerUserId,
          matchRequestId: row.peerMatchRequestId,
        }
      : null;

  const matchedTimeAvailableMinutes = computedMatchedTimeMinutes(
    row.timeAvailableMinutes,
    row.peerTimeAvailableMinutes,
  );

  const expiresAt =
    row.status === "PENDING"
      ? new Date(row.createdAt.getTime() + timeoutSec * 1000).toISOString()
      : null;

  return {
    id: row.id,
    userId: row.userId,
    topic: row.topic,
    difficulty: row.difficulty,
    programmingLanguage: row.programmingLanguage,
    allowLowerDifficultyMatch: row.allowLowerDifficultyMatch,
    timeAvailableMinutes: row.timeAvailableMinutes,
    status: row.status,
    peerUserId: row.peerUserId,
    peerMatchRequestId: row.peerMatchRequestId,
    peer,
    peerRequestedDifficulty: row.peerRequestedDifficulty,
    peerTimeAvailableMinutes: row.peerTimeAvailableMinutes,
    matchedTimeAvailableMinutes,
    matchingType: matchingPairTypeToApi(row.matchingPairType),
    message: dtoMessage(row.status),
    disconnectedAt: row.disconnectedAt?.toISOString() ?? null,
    reconnectDeadlineAt: row.reconnectDeadlineAt?.toISOString() ?? null,
    expiresAt,
    matchTimeoutSeconds: timeoutSec,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Public DTO for API/SSE: adds wait time + opt-in fallback suggestions for connected PENDING rows.
 * Does not change matching semantics.
 */
async function toPublicMatchRequestDto(
  row: MatchRequestRow,
): Promise<MatchRequestDTO> {
  const base = toDTO(row);
  if (row.status === "TIMED_OUT") {
    const fallbackSuggestions = await buildFallbackSuggestionsForTimedOut(row);
    return { ...base, fallbackSuggestions };
  }
  if (row.status !== "PENDING" || row.disconnectedAt !== null) {
    return base;
  }
  const waitTimeMs = Date.now() - row.createdAt.getTime();
  const timeoutSec = getMatchTimeoutSeconds();
  const matchWindowEndMs = row.createdAt.getTime() + timeoutSec * 1000;
  /**
   * Past the match-wait window, the matcher will soon set `TIMED_OUT`. Do not show
   * advisory fallbacks in this gap (or after timeout) — the search has effectively ended.
   */
  if (Date.now() >= matchWindowEndMs) {
    return {
      ...base,
      waitTimeMs,
      fallbackSuggestions: [],
    };
  }
  const fallbackSuggestions = await buildFallbackSuggestions(row, waitTimeMs);
  return {
    ...base,
    waitTimeMs,
    fallbackSuggestions,
  };
}

/** Read-through DTO without running the matcher (used for SSE after queue effects already ran). */
async function loadMatchRequestDtoForUserNoSideEffect(
  id: string,
  userId: string,
): Promise<MatchRequestDTO | null> {
  const row = await prisma.matchRequest.findFirst({
    where: { id, userId } as MRWhere,
  });
  return row ? toPublicMatchRequestDto(asMatchRow(row)) : null;
}

async function notifyMatchRequestSseAfterQueueEffects(
  q: MatchQueueEffects,
): Promise<void> {
  for (const p of q.reconnectExpiredPairs) {
    const dto = await loadMatchRequestDtoForUserNoSideEffect(p.id, p.userId);
    if (dto) broadcastMatchRequestDto(p.id, dto);
  }
  for (const r of q.timedOutRows) {
    const dto = await loadMatchRequestDtoForUserNoSideEffect(r.id, r.userId);
    if (dto) broadcastMatchRequestDto(r.id, dto);
  }
  for (const m of q.matches) {
    const dtoA = await loadMatchRequestDtoForUserNoSideEffect(
      m.requestAId,
      m.userAId,
    );
    const dtoB = await loadMatchRequestDtoForUserNoSideEffect(
      m.requestBId,
      m.userBId,
    );
    if (dtoA) broadcastMatchRequestDto(m.requestAId, dtoA);
    if (dtoB) broadcastMatchRequestDto(m.requestBId, dtoB);
  }
}

export async function tryMatchQueue(): Promise<MatchQueueEffects> {
  const timedOutRows: MatchRequestRow[] = [];
  const matches: MatchFoundEventPayload[] = [];
  let reconnectExpiredPairs: { id: string; userId: string }[] = [];

  await prisma.$transaction(async (tx) => {
    const expired = await expirePendingRequests(tx);
    timedOutRows.push(...expired.timedOutRows);
    reconnectExpiredPairs = expired.reconnectExpiredPairs;

    /**
     * Per-pool matching: load only `(topic, programmingLanguage)` slices (not all PENDING rows).
     * Order matches `sortedPoolKeys` / F10.1 — same outcome as one global `findFirstPair`, less memory.
     */
    while (true) {
      const pendingPoolKeys = await tx.matchRequest.findMany({
        where: {
          status: "PENDING",
          disconnectedAt: null,
        } as MRWhere,
        select: { topic: true, programmingLanguage: true },
        distinct: ["topic", "programmingLanguage"],
      });

      if (pendingPoolKeys.length === 0) {
        return;
      }

      const sortedPools = [...pendingPoolKeys].sort((x, y) =>
        poolKeyString(x.topic, x.programmingLanguage).localeCompare(
          poolKeyString(y.topic, y.programmingLanguage),
        ),
      );

      let pair: MatchPairResult | null = null;
      for (const { topic, programmingLanguage } of sortedPools) {
        const pendingRows = await tx.matchRequest.findMany({
          where: {
            status: "PENDING",
            disconnectedAt: null,
            topic,
            programmingLanguage,
          } as MRWhere,
        });
        const pending = pendingRows
          .map((r) => asMatchRow(r))
          .filter((r) => r.disconnectedAt === null);

        pair = findFirstPair(pending.map(toEngineRow));
        if (pair !== null) {
          break;
        }
      }

      if (pair === null) {
        return;
      }

      const { requester: a, partner: b, matchingType } = pair;

      const prismaPairType =
        matchingType === "same_difficulty"
          ? ("SAME_DIFFICULTY" as const)
          : ("DOWNWARD" as const);

      const first = await tx.matchRequest.updateMany({
        where: {
          id: a.id,
          status: "PENDING",
          userId: a.userId,
          disconnectedAt: null,
        } as MRWhere,
        data: matchedRowUpdateData(
          b.userId,
          b.id,
          b.difficulty,
          b.timeAvailableMinutes,
          prismaPairType,
        ),
      });

      if (first.count !== 1) {
        return;
      }

      const second = await tx.matchRequest.updateMany({
        where: {
          id: b.id,
          status: "PENDING",
          userId: b.userId,
          disconnectedAt: null,
        } as MRWhere,
        data: matchedRowUpdateData(
          a.userId,
          a.id,
          a.difficulty,
          a.timeAvailableMinutes,
          prismaPairType,
        ),
      });

      if (second.count !== 1) {
        throw new Error("Match finalization invariant failed");
      }

      matches.push(buildMatchFoundPayload(a, b, matchingType));
    }
  });

  return { timedOutRows, reconnectExpiredPairs, matches };
}

/**
 * Best-effort matcher + RabbitMQ publish. Logs failures; does not throw (callers stay HTTP-safe).
 * Single place for timeout `match.timed_out` publishes to avoid duplicate events vs ad-hoc publish.
 */
async function tryMatchQueueAndPublish(): Promise<void> {
  try {
    const q = await tryMatchQueue();
    await publishMatchQueueEffects(q);
    await notifyMatchRequestSseAfterQueueEffects(q);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[matching] tryMatchQueueAndPublish failed: ${msg}`);
  }
}

/** Matcher + Rabbit + SSE fan-out; safe to call from a background tick or queue consumer. */
export async function runMatchQueueTick(): Promise<void> {
  await tryMatchQueueAndPublish();
}

/**
 * When `RABBITMQ_URL` is set, enqueue matcher work (consumer runs `runMatchQueueTick`).
 * Otherwise runs inline. Falls back to inline if publish fails.
 */
export async function scheduleMatchQueueRun(reason: string): Promise<void> {
  if (rabbitMatchQueueEnabled()) {
    try {
      await publishMatchQueueWork(reason);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(
        `[matching] publishMatchQueueWork(${reason}) failed: ${msg}; falling back to inline`,
      );
      await tryMatchQueueAndPublish();
    }
    return;
  }
  await tryMatchQueueAndPublish();
}

export async function createMatchRequest(
  userId: string,
  input: CreateMatchRequestInput,
): Promise<
  { ok: true; data: MatchRequestDTO } | { ok: false; code: "CONFLICT" }
> {
  try {
    await scheduleMatchQueueRun("create_pre");

    const created = await prisma.matchRequest.create({
      data: {
        userId,
        topic: input.topic,
        difficulty: input.difficulty,
        programmingLanguage: input.programmingLanguage,
        allowLowerDifficultyMatch: input.allowLowerDifficultyMatch,
        ...(input.timeAvailableMinutes != null
          ? { timeAvailableMinutes: input.timeAvailableMinutes }
          : {}),
        status: "PENDING",
      } as MRCreateData,
    });

    await publishMatchRequestCreated(asMatchRow(created));

    await scheduleMatchQueueRun("create_post");

    const refreshed = await prisma.matchRequest.findUnique({
      where: { id: created.id },
    });
    if (!refreshed) {
      throw new Error("Match request missing after create");
    }
    return {
      ok: true,
      data: await toPublicMatchRequestDto(asMatchRow(refreshed)),
    };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, code: "CONFLICT" };
    }
    throw e;
  }
}

export async function getMatchRequestForUser(
  id: string,
  userId: string,
): Promise<MatchRequestDTO | null> {
  await scheduleMatchQueueRun("get_match_request");

  const row = await prisma.matchRequest.findFirst({
    where: { id, userId } as MRWhere,
  });
  return row ? toPublicMatchRequestDto(asMatchRow(row)) : null;
}

/** At most one PENDING row per user (partial unique index). */
export async function getActiveMatchRequestForUser(
  userId: string,
): Promise<MatchRequestDTO | null> {
  await scheduleMatchQueueRun("get_active_match_request");

  const row = await prisma.matchRequest.findFirst({
    where: { userId, status: "PENDING" } as MRWhere,
  });
  return row ? toPublicMatchRequestDto(asMatchRow(row)) : null;
}

export async function disconnectMatchRequestForUser(
  id: string,
  userId: string,
): Promise<
  | { ok: true; data: MatchRequestDTO }
  | { ok: false; code: "NOT_FOUND" | "NOT_PENDING" }
> {
  await scheduleMatchQueueRun("disconnect");

  const row = await prisma.matchRequest.findFirst({
    where: { id, userId } as MRWhere,
  });
  if (!row) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const r0 = asMatchRow(row);
  if (r0.status !== "PENDING") {
    return { ok: false, code: "NOT_PENDING" };
  }

  if (r0.disconnectedAt !== null) {
    const d = await toPublicMatchRequestDto(r0);
    broadcastMatchRequestDto(id, d);
    return { ok: true, data: d };
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + getReconnectGraceSeconds() * 1000);

  const updated = await prisma.matchRequest.updateMany({
    where: {
      id,
      userId,
      status: "PENDING",
      disconnectedAt: null,
    } as MRWhere,
    data: {
      disconnectedAt: now,
      reconnectDeadlineAt: deadline,
    } as MRUpdateManyData,
  });

  if (updated.count === 0) {
    const again = await prisma.matchRequest.findFirst({
      where: { id, userId } as MRWhere,
    });
    if (!again) {
      return { ok: false, code: "NOT_FOUND" };
    }
    const ra = asMatchRow(again);
    if (ra.status !== "PENDING") {
      return { ok: false, code: "NOT_PENDING" };
    }
    await scheduleMatchQueueRun("disconnect");
    const dRa = await toPublicMatchRequestDto(ra);
    broadcastMatchRequestDto(id, dRa);
    return { ok: true, data: dRa };
  }

  const refreshed = await prisma.matchRequest.findFirst({
    where: { id, userId } as MRWhere,
  });
  if (!refreshed) {
    return { ok: false, code: "NOT_FOUND" };
  }
  await scheduleMatchQueueRun("disconnect");
  const dRef = await toPublicMatchRequestDto(asMatchRow(refreshed));
  broadcastMatchRequestDto(id, dRef);
  return { ok: true, data: dRef };
}

export async function reconnectMatchRequestForUser(
  id: string,
  userId: string,
): Promise<
  | { ok: true; data: MatchRequestDTO }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "NOT_PENDING"
        | "NOT_DISCONNECTED"
        | "RECONNECT_EXPIRED";
    }
> {
  await scheduleMatchQueueRun("reconnect");

  const row = await prisma.matchRequest.findFirst({
    where: { id, userId } as MRWhere,
  });
  if (!row) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const r = asMatchRow(row);
  if (r.status === "RECONNECT_EXPIRED") {
    return { ok: false, code: "RECONNECT_EXPIRED" };
  }
  if (r.status !== "PENDING") {
    return { ok: false, code: "NOT_PENDING" };
  }
  if (r.disconnectedAt === null) {
    return { ok: false, code: "NOT_DISCONNECTED" };
  }

  const now = new Date();
  const deadlineMs = r.reconnectDeadlineAt?.getTime() ?? null;
  const graceExpired = deadlineMs !== null && deadlineMs <= now.getTime();

  if (graceExpired) {
    const expired = await prisma.matchRequest.updateMany({
      where: {
        id,
        userId,
        status: "PENDING",
        disconnectedAt: { not: null },
        reconnectDeadlineAt: { lte: now },
      } as MRWhere,
      data: {
        status: "RECONNECT_EXPIRED",
        disconnectedAt: null,
        reconnectDeadlineAt: null,
      } as unknown as MRUpdateManyData,
    });
    if (expired.count === 0) {
      const again = await prisma.matchRequest.findFirst({
        where: { id, userId } as MRWhere,
      });
      if (!again) {
        return { ok: false, code: "NOT_FOUND" };
      }
      const ag = asMatchRow(again);
      if (ag.status === "RECONNECT_EXPIRED") {
        return { ok: false, code: "RECONNECT_EXPIRED" };
      }
      if (ag.status === "PENDING" && ag.disconnectedAt === null) {
        await scheduleMatchQueueRun("reconnect");
        const after = await prisma.matchRequest.findFirst({
          where: { id, userId } as MRWhere,
        });
        if (!after) {
          return { ok: false, code: "NOT_FOUND" };
        }
        const dAfter = await toPublicMatchRequestDto(asMatchRow(after));
        broadcastMatchRequestDto(id, dAfter);
        return { ok: true, data: dAfter };
      }
      if (ag.status !== "PENDING") {
        return { ok: false, code: "NOT_PENDING" };
      }
      return { ok: false, code: "NOT_DISCONNECTED" };
    }
    return { ok: false, code: "RECONNECT_EXPIRED" };
  }

  const cleared = await prisma.matchRequest.updateMany({
    where: {
      id,
      userId,
      status: "PENDING",
      disconnectedAt: { not: null },
      OR: [{ reconnectDeadlineAt: null }, { reconnectDeadlineAt: { gt: now } }],
    } as unknown as MRWhere,
    data: {
      disconnectedAt: null,
      reconnectDeadlineAt: null,
    } as MRUpdateManyData,
  });

  if (cleared.count === 0) {
    const again = await prisma.matchRequest.findFirst({
      where: { id, userId } as MRWhere,
    });
    if (!again) {
      return { ok: false, code: "NOT_FOUND" };
    }
    const ag2 = asMatchRow(again);
    if (ag2.disconnectedAt === null && ag2.status === "PENDING") {
      await scheduleMatchQueueRun("reconnect");
      const after = await prisma.matchRequest.findFirst({
        where: { id, userId } as MRWhere,
      });
      if (!after) {
        return { ok: false, code: "NOT_FOUND" };
      }
      const dAfter2 = await toPublicMatchRequestDto(asMatchRow(after));
      broadcastMatchRequestDto(id, dAfter2);
      return { ok: true, data: dAfter2 };
    }
    if (ag2.status !== "PENDING") {
      return { ok: false, code: "NOT_PENDING" };
    }
    return { ok: false, code: "NOT_DISCONNECTED" };
  }

  await scheduleMatchQueueRun("reconnect");

  const refreshed = await prisma.matchRequest.findFirst({
    where: { id, userId } as MRWhere,
  });
  if (!refreshed) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const dRecon = await toPublicMatchRequestDto(asMatchRow(refreshed));
  broadcastMatchRequestDto(id, dRecon);
  return { ok: true, data: dRecon };
}

async function acceptFallbackFromTimedOutRow(
  userId: string,
  row: MatchRequestRow,
  body: AcceptFallbackBody,
): Promise<
  | { ok: true; data: MatchRequestDTO }
  | { ok: false; code: "NOT_APPLICABLE" | "CONFLICT" }
> {
  const suggestions = await buildFallbackSuggestionsForTimedOut(row);
  if (body.type === "enable_downward_matching") {
    const allowed = suggestions.some(
      (s) => s.type === "enable_downward_matching",
    );
    if (!allowed || row.allowLowerDifficultyMatch) {
      return { ok: false, code: "NOT_APPLICABLE" };
    }
    return createMatchRequest(userId, {
      topic: row.topic,
      difficulty: row.difficulty,
      programmingLanguage: row.programmingLanguage,
      allowLowerDifficultyMatch: true,
      ...(row.timeAvailableMinutes != null
        ? { timeAvailableMinutes: row.timeAvailableMinutes }
        : {}),
    } as CreateMatchRequestInput);
  }
  const topic = body.topic;
  const suggestion = suggestions.find(
    (s) =>
      s.type === body.type &&
      s.action.type === "create_new_request" &&
      s.action.newCriteria.topic === topic,
  );
  if (!suggestion) {
    return { ok: false, code: "NOT_APPLICABLE" };
  }
  return createMatchRequest(userId, {
    topic,
    difficulty: row.difficulty,
    programmingLanguage: row.programmingLanguage,
    allowLowerDifficultyMatch: row.allowLowerDifficultyMatch,
    ...(row.timeAvailableMinutes != null
      ? { timeAvailableMinutes: row.timeAvailableMinutes }
      : {}),
  } as CreateMatchRequestInput);
}

/**
 * User explicitly accepts an advisory fallback. Downward: PATCH in place, preserves `createdAt`.
 * Topic switch: cancel old PENDING row, create new (new queue position / `createdAt`).
 * For `TIMED_OUT`, applies the same ideas by creating a new PENDING request (old row unchanged).
 */
export async function acceptFallbackSuggestion(
  userId: string,
  id: string,
  body: AcceptFallbackBody,
): Promise<
  | { ok: true; data: MatchRequestDTO }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "NOT_PENDING"
        | "DISCONNECTED"
        | "NOT_APPLICABLE"
        | "CONFLICT";
    }
> {
  await scheduleMatchQueueRun("accept_fallback_pre");

  const existing = await prisma.matchRequest.findFirst({
    where: { id, userId } as MRWhere,
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const row = asMatchRow(existing);
  if (row.status === "TIMED_OUT") {
    return acceptFallbackFromTimedOutRow(userId, row, body);
  }
  if (row.status !== "PENDING") {
    return { ok: false, code: "NOT_PENDING" };
  }
  if (row.disconnectedAt !== null) {
    return { ok: false, code: "DISCONNECTED" };
  }

  const timeoutSec = getMatchTimeoutSeconds();
  if (Date.now() >= row.createdAt.getTime() + timeoutSec * 1000) {
    return { ok: false, code: "NOT_APPLICABLE" };
  }

  const waitTimeMs = Date.now() - row.createdAt.getTime();
  const suggestions = await buildFallbackSuggestions(row, waitTimeMs);

  if (body.type === "enable_downward_matching") {
    const allowed =
      suggestions.some((s) => s.type === "enable_downward_matching") ||
      row.allowLowerDifficultyMatch;
    if (!allowed) {
      return { ok: false, code: "NOT_APPLICABLE" };
    }
    if (row.allowLowerDifficultyMatch) {
      const fresh = await prisma.matchRequest.findFirst({
        where: { id, userId } as MRWhere,
      });
      if (!fresh) {
        return { ok: false, code: "NOT_FOUND" };
      }
      const dto = await toPublicMatchRequestDto(asMatchRow(fresh));
      broadcastMatchRequestDto(id, dto);
      return { ok: true, data: dto };
    }

    const updated = await prisma.matchRequest.updateMany({
      where: {
        id,
        userId,
        status: "PENDING",
        disconnectedAt: null,
        allowLowerDifficultyMatch: false,
      } as MRWhere,
      data: { allowLowerDifficultyMatch: true } as MRUpdateManyData,
    });
    if (updated.count === 0) {
      return { ok: false, code: "NOT_APPLICABLE" };
    }
    await scheduleMatchQueueRun("accept_fallback_downward");
    const refreshed = await prisma.matchRequest.findFirst({
      where: { id, userId } as MRWhere,
    });
    if (!refreshed) {
      return { ok: false, code: "NOT_FOUND" };
    }
    const dto = await toPublicMatchRequestDto(asMatchRow(refreshed));
    broadcastMatchRequestDto(id, dto);
    return { ok: true, data: dto };
  }

  const topic = body.topic;
  const suggestion = suggestions.find(
    (s) =>
      s.type === body.type &&
      s.action.type === "create_new_request" &&
      s.action.newCriteria.topic === topic,
  );
  if (!suggestion) {
    return { ok: false, code: "NOT_APPLICABLE" };
  }

  const createdRow = await prisma.$transaction(async (tx) => {
    const cur = await tx.matchRequest.findFirst({
      where: {
        id,
        userId,
        status: "PENDING",
        disconnectedAt: null,
      } as MRWhere,
    });
    if (!cur) {
      return null;
    }
    const c = asMatchRow(cur);
    await tx.matchRequest.updateMany({
      where: { id, userId, status: "PENDING" } as MRWhere,
      data: {
        status: "CANCELLED",
        disconnectedAt: null,
        reconnectDeadlineAt: null,
      } as unknown as MRUpdateManyData,
    });
    return tx.matchRequest.create({
      data: {
        userId,
        topic,
        difficulty: c.difficulty,
        programmingLanguage: c.programmingLanguage,
        allowLowerDifficultyMatch: c.allowLowerDifficultyMatch,
        ...(c.timeAvailableMinutes != null
          ? { timeAvailableMinutes: c.timeAvailableMinutes }
          : {}),
        status: "PENDING",
      } as MRCreateData,
    });
  });

  if (!createdRow) {
    return { ok: false, code: "NOT_FOUND" };
  }

  await publishMatchRequestCancelled(id, userId);
  await publishMatchRequestCreated(asMatchRow(createdRow));
  await scheduleMatchQueueRun("accept_fallback_topic_switch");

  const newId = createdRow.id;
  const dto = await toPublicMatchRequestDto(asMatchRow(createdRow));
  broadcastMatchRequestDto(newId, dto);
  return { ok: true, data: dto };
}

export async function cancelMatchRequestForUser(
  id: string,
  userId: string,
): Promise<
  | { ok: true; data: MatchRequestDTO }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "NOT_PENDING" }
  | { ok: false; code: "TIMED_OUT" }
  | { ok: false; code: "RECONNECT_EXPIRED" }
> {
  await scheduleMatchQueueRun("cancel");

  const existing = await prisma.matchRequest.findFirst({
    where: { id, userId } as MRWhere,
  });

  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const ex = asMatchRow(existing);
  if (ex.status === "TIMED_OUT") {
    return { ok: false, code: "TIMED_OUT" };
  }
  if (ex.status === "RECONNECT_EXPIRED") {
    return { ok: false, code: "RECONNECT_EXPIRED" };
  }
  if (ex.status !== "PENDING") {
    return { ok: false, code: "NOT_PENDING" };
  }

  const cancelled = await prisma.matchRequest.updateMany({
    where: { id, userId, status: "PENDING" } as MRWhere,
    data: {
      status: "CANCELLED",
      disconnectedAt: null,
      reconnectDeadlineAt: null,
    } as MRUpdateManyData,
  });

  if (cancelled.count === 0) {
    const again = await prisma.matchRequest.findFirst({
      where: { id, userId } as MRWhere,
    });
    if (!again) {
      return { ok: false, code: "NOT_FOUND" };
    }
    const ag = asMatchRow(again);
    if (ag.status === "TIMED_OUT") {
      return { ok: false, code: "TIMED_OUT" };
    }
    if (ag.status === "RECONNECT_EXPIRED") {
      return { ok: false, code: "RECONNECT_EXPIRED" };
    }
    if (ag.status !== "PENDING") {
      return { ok: false, code: "NOT_PENDING" };
    }
    return { ok: false, code: "NOT_PENDING" };
  }

  const updated = await prisma.matchRequest.findFirst({
    where: { id, userId } as MRWhere,
  });
  if (!updated) {
    return { ok: false, code: "NOT_FOUND" };
  }
  await publishMatchRequestCancelled(id, userId);
  await scheduleMatchQueueRun("cancel");
  const cancelledDto = toDTO(asMatchRow(updated));
  broadcastMatchRequestDto(id, cancelledDto);
  return { ok: true, data: cancelledDto };
}
