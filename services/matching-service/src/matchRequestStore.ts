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

