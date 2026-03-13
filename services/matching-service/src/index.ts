import express, { type Application, type Request, type Response } from 'express';
import cors, { type CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { validateMatchRequestPayload } from './matchingValidation.js';
import { recordMatchRequest } from './matchRequestStore.js';

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

  const stored = recordMatchRequest(userId, value!);

  return res.status(201).json({
    message: 'Match request recorded for processing.',
    matchRequest: stored,
  });
});

app.listen(PORT, () => {
  console.log(`Matching Service is running on http://localhost:${PORT}`);
});

