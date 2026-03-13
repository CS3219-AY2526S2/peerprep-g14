import crypto from 'crypto';
import type { Difficulty, MatchRequestPayload } from './matchingValidation.js';

export type MatchRequestStatus = 'PENDING' | 'MATCHED' | 'CANCELLED';
export type MatchingType = 'same_difficulty' | 'downward';

export interface StoredMatchRequest extends MatchRequestPayload {
  id: string;
  userId: string | null;
  status: MatchRequestStatus;
  createdAt: Date;
  matchedWithRequestId?: string | null;
  matchingType?: MatchingType;
}

const inMemoryMatchRequests: StoredMatchRequest[] = [];

const difficultyRank: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

function compareUserIds(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function compareStoredMatchRequests(a: StoredMatchRequest, b: StoredMatchRequest): number {
  const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
  if (createdDiff !== 0) {
    return createdDiff;
  }

  const userIdDiff = compareUserIds(a.userId, b.userId);
  if (userIdDiff !== 0) {
    return userIdDiff;
  }

  if (a.id === b.id) {
    return 0;
  }

  return a.id < b.id ? -1 : 1;
}

export function findActiveRequestByUserId(
  userId: string | null,
): StoredMatchRequest | undefined {
  if (!userId) {
    return undefined;
  }

  return inMemoryMatchRequests.find(
    (req) => req.status === 'PENDING' && req.userId === userId,
  );
}

export function getMatchRequestById(requestId: string): StoredMatchRequest | undefined {
  return inMemoryMatchRequests.find((req) => req.id === requestId);
}

export interface CancelMatchRequestResultBase {
  request: StoredMatchRequest;
}

export type CancelMatchRequestResult =
  | { status: 'CANCELLED' } & CancelMatchRequestResultBase
  | { status: 'NOT_PENDING' } & CancelMatchRequestResultBase
  | { status: 'NOT_FOUND_OR_NOT_OWNED'; request?: undefined };

export function cancelMatchRequest(
  requestId: string,
  userId: string | null,
): CancelMatchRequestResult {
  if (!userId) {
    return { status: 'NOT_FOUND_OR_NOT_OWNED' };
  }

  const request = inMemoryMatchRequests.find((req) => req.id === requestId);

  if (!request || request.userId !== userId) {
    return { status: 'NOT_FOUND_OR_NOT_OWNED' };
  }

  if (request.status !== 'PENDING') {
    return { status: 'NOT_PENDING', request };
  }

  request.status = 'CANCELLED';
  return { status: 'CANCELLED', request };
}

export function getActivePool(
  topic: MatchRequestPayload['topic'],
  language: MatchRequestPayload['language'],
): StoredMatchRequest[] {
  return inMemoryMatchRequests.filter(
    (req) =>
      req.status === 'PENDING' &&
      req.topic === topic &&
      req.language === language,
  );
}

export function recordMatchRequest(
  userId: string | null,
  payload: MatchRequestPayload,
): StoredMatchRequest {
  const request: StoredMatchRequest = {
    id: crypto.randomUUID(),
    userId,
    status: 'PENDING',
    createdAt: new Date(),
    ...payload,
  };

  inMemoryMatchRequests.push(request);
  return request;
}

export function getPendingMatchRequests(): StoredMatchRequest[] {
  return inMemoryMatchRequests.filter((req) => req.status === 'PENDING');
}

export function selectNextMatchPair():
  | { requester: StoredMatchRequest; partner: StoredMatchRequest; matchingType: MatchingType }
  | null {
  const pending = getPendingMatchRequests();

  if (pending.length < 2) {
    return null;
  }

  const sortedPending = [...pending].sort(compareStoredMatchRequests);

  for (const requester of sortedPending) {
    const pool = getActivePool(requester.topic, requester.language);

    // First, attempt same-difficulty matching (F5.3)
    const sameDifficultyCandidates = pool
      .filter(
        (candidate) =>
          candidate.id !== requester.id &&
          candidate.difficulty === requester.difficulty,
      )
      .sort(compareStoredMatchRequests);

    const sameDifficultyPartner = sameDifficultyCandidates[0];

    if (sameDifficultyPartner) {
      return { requester, partner: sameDifficultyPartner, matchingType: 'same_difficulty' };
    }

    // If no same-difficulty partner exists, consider downward matching (F5.4)
    if (!requester.allowLowerDifficultyMatch) {
      // Selected user did not opt in to downward matching
      continue;
    }

    const requesterRank = difficultyRank[requester.difficulty];

    const downwardCandidates = pool
      .filter((candidate) => {
        if (candidate.id === requester.id) {
          return false;
        }

        const candidateRank = difficultyRank[candidate.difficulty];

        // Strictly lower difficulty than requester (F5.4.2),
        // and never match anyone with higher difficulty than they selected (F5.5)
        return candidateRank < requesterRank;
      })
      .sort(compareStoredMatchRequests);

    const downwardPartner = downwardCandidates[0];

    if (downwardPartner) {
      return { requester, partner: downwardPartner, matchingType: 'downward' };
    }
  }

  return null;
}

export function markMatchRequestsMatched(
  requestIds: [string, string],
  matchingType: MatchingType,
): StoredMatchRequest[] {
  const [firstId, secondId] = requestIds;
  const matched: StoredMatchRequest[] = [];

  for (const req of inMemoryMatchRequests) {
    if (req.id === firstId) {
      req.status = 'MATCHED';
      req.matchedWithRequestId = secondId;
      req.matchingType = matchingType;
      matched.push(req);
    } else if (req.id === secondId) {
      req.status = 'MATCHED';
      req.matchedWithRequestId = firstId;
      req.matchingType = matchingType;
      matched.push(req);
    }
  }

  return matched;
}

