import crypto from 'crypto';
import type { MatchRequestPayload } from './matchingValidation.js';

export type MatchRequestStatus = 'PENDING' | 'MATCHED' | 'CANCELLED';

export interface StoredMatchRequest extends MatchRequestPayload {
  id: string;
  userId: string | null;
  status: MatchRequestStatus;
  createdAt: Date;
}

const inMemoryMatchRequests: StoredMatchRequest[] = [];

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
  | { requester: StoredMatchRequest; partner: StoredMatchRequest }
  | null {
  const pending = getPendingMatchRequests();

  if (pending.length < 2) {
    return null;
  }

  const sortedPending = [...pending].sort(compareStoredMatchRequests);

  for (const requester of sortedPending) {
    const pool = getActivePool(requester.topic, requester.language);

    const candidates = pool
      .filter(
        (candidate) =>
          candidate.id !== requester.id &&
          candidate.difficulty === requester.difficulty,
      )
      .sort(compareStoredMatchRequests);

    const partner = candidates[0];

    if (partner) {
      return { requester, partner };
    }
  }

  return null;
}

export function markMatchRequestsMatched(
  requestIds: [string, string],
): StoredMatchRequest[] {
  const [firstId, secondId] = requestIds;
  const matched: StoredMatchRequest[] = [];

  for (const req of inMemoryMatchRequests) {
    if (req.id === firstId || req.id === secondId) {
      req.status = 'MATCHED';
      matched.push(req);
    }
  }

  return matched;
}

