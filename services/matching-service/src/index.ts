import express, { type Application, type Request, type Response } from 'express';
import cors, { type CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { validateMatchRequestPayload } from './matchingValidation.js';
import {
  cancelMatchRequest,
  findActiveRequestByUserId,
  getMatchRequestById,
  recordMatchRequest,
  markMatchRequestsMatched,
  selectNextMatchPair,
} from './matchRequestStore.js';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3002;

const corsOptions: CorsOptions = {
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

app.post('/matching/requests', (req: Request, res: Response) => {
  const { value, errors } = validateMatchRequestPayload(req.body);

  if (errors && errors.length > 0) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      errors,
    });
  }

  const headers = req.headers;
  const rawUserId = headers['x-user-id'];
  const userId: string | null = Array.isArray(rawUserId)
    ? rawUserId[0] ?? null
    : (rawUserId ?? null);

  if (!userId) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'x-user-id header is required.',
    });
  }

  const existingPending = findActiveRequestByUserId(userId);
  if (existingPending) {
    return res.status(409).json({
      error: 'ACTIVE_MATCH_REQUEST_EXISTS',
      message: 'User already has an active pending match request.',
      matchRequestId: existingPending.id,
    });
  }

  const stored = recordMatchRequest(userId, value!);

  return res.status(201).json({
    message: 'Match request recorded for processing.',
    matchRequest: stored,
  });
});

app.get('/matching/requests/:id', (req: Request, res: Response) => {
  const requestId = req.params.id as string;
  const request = getMatchRequestById(requestId);

  if (!request) {
    return res.status(404).json({
      error: 'MATCH_REQUEST_NOT_FOUND',
      message: 'Match request not found.',
    });
  }

  return res.status(200).json({
    matchRequest: request,
  });
});

app.delete('/matching/requests/:id', (req: Request, res: Response) => {
  const headers = req.headers;
  const rawUserId = headers['x-user-id'];
  const userId: string | null = Array.isArray(rawUserId)
    ? rawUserId[0] ?? null
    : (rawUserId ?? null);

  if (!userId) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'x-user-id header is required.',
    });
  }

  const requestId = req.params.id as string;
  const result = cancelMatchRequest(requestId, userId);

  if (result.status === 'NOT_FOUND_OR_NOT_OWNED') {
    return res.status(404).json({
      error: 'MATCH_REQUEST_NOT_FOUND',
      message: 'Match request not found for this user.',
    });
  }

  if (result.status === 'NOT_PENDING') {
    return res.status(409).json({
      error: 'MATCH_REQUEST_NOT_PENDING',
      message: 'Only pending match requests can be cancelled.',
      matchRequest: result.request,
    });
  }

  return res.status(200).json({
    message: 'Match request cancelled.',
    matchRequest: result.request,
  });
});

app.post('/matching/attempt', (_req: Request, res: Response) => {
  const pair = selectNextMatchPair();

  if (!pair) {
    return res.status(200).json({
      message: 'No eligible match found.',
      match: null,
    });
  }

  const { requester, partner } = pair;

  markMatchRequestsMatched([requester.id, partner.id]);

  return res.status(200).json({
    message: 'Match formed.',
    match: {
      requester,
      partner,
      topic: requester.topic,
      language: requester.language,
      difficulties: {
        requester: requester.difficulty,
        partner: partner.difficulty,
      },
      matchingType: 'same_difficulty',
    },
  });
});

app.listen(PORT, () => {
  console.log(`Matching Service is running on http://localhost:${PORT}`);
});

