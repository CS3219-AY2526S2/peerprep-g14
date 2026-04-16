import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// simple in-memory rate limiter: 1 request per 10 seconds per user
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 10_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimitMap.get(userId);
  if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
    return false; // rate limited
  }
  rateLimitMap.set(userId, now);
  return true;
}

// clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > RATE_LIMIT_MS * 6) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

router.post('/', async (req: any, res: any) => {
  try {
    const { code, preferences, question, language } = req.body;

    // validate inputs
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({ error: 'Code is required and must be a non-empty string.' });
    }

    // rate limiting using x-user-id header set by auth-service
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    if (!checkRateLimit(userId)) {
      return res.status(429).json({
        error: 'Too many explanation requests. Please wait a few seconds before trying again.',
      });
    }

    // validate API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

    let prompt = `You are an expert programming assistant. Please provide an explanation for the following code.\n`;
    
    if (language) {
      prompt += `\nIMPORTANT REQUIREMENT: The code is expected to be written in ${language}. If the provided code is clearly NOT written in ${language}, you MUST reply ONLY with: "The provided code is not written in ${language}." Do not provide any explanation.\n`;
    }

    if (question) {
       prompt += `\nThe code is a solution to the following question:\n${question}\n`;
    }

    prompt += `\nCode to explain:\n${code}\n\nRules:\n- Provide a basic response in words.\n- Do NOT use diagrams or images.`;

    if (preferences && typeof preferences === 'string' && preferences.trim().length > 0) {
      prompt += `\n\nThe user has specific preferences for how the explanation should be delivered. Please adhere to these preferences: ${preferences}`;
    }

    const result = await model.generateContent(prompt);
    const response = result.response;
    const explanation = response.text().trim();

    return res.json({
      explanation,
    });
  } catch (error: any) {
    console.error('[AI Service] Explanation error:', error);

    if (error?.message?.includes('API_KEY')) {
      return res.status(500).json({ error: 'Invalid Gemini API key.' });
    }

    return res.status(500).json({ error: 'Explanation failed. Please try again.' });
  }
});

export default router;
