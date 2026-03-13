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

