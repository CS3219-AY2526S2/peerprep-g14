import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'go'];

// display names for nicer prompt formatting
const LANGUAGE_DISPLAY: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  go: 'Go',
};

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
    const { code, sourceLanguage, targetLanguage } = req.body;

    // validate inputs
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({ error: 'Code is required and must be a non-empty string.' });
    }

    if (!targetLanguage || !SUPPORTED_LANGUAGES.includes(targetLanguage.toLowerCase())) {
      return res.status(400).json({
        error: `Target language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
      });
    }

    // rate limiting using x-user-id header set by auth-service
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    if (!checkRateLimit(userId)) {
      return res.status(429).json({
        error: 'Too many translation requests. Please wait a few seconds before trying again.',
      });
    }

    // validate API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

    const sourceLangDisplay = LANGUAGE_DISPLAY[sourceLanguage?.toLowerCase()] || sourceLanguage || 'the original language';
    const targetLangDisplay = LANGUAGE_DISPLAY[targetLanguage.toLowerCase()];

    const prompt = `You are a code translation assistant. Translate the following ${sourceLangDisplay} code to ${targetLangDisplay}.

Rules:
- Return ONLY the translated code, no explanations, no markdown fences, no comments about the translation.
- Preserve the logic and structure as closely as possible.
- Use idiomatic patterns for the target language.
- If the code contains comments, translate them too.
- If the code contains errors, do not fix them, translate them as is. 

Code to translate:
${code}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    let translatedCode = response.text();

    // strip markdown code fences if the model wraps them anyway
    translatedCode = translatedCode
      .replace(/^```[\w]*\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim();

    return res.json({
      translatedCode,
      targetLanguage: targetLanguage.toLowerCase(),
      targetLanguageDisplay: targetLangDisplay,
    });
  } catch (error: any) {
    console.error('[AI Service] Translation error:', error);

    if (error?.message?.includes('API_KEY')) {
      return res.status(500).json({ error: 'Invalid Gemini API key.' });
    }

    return res.status(500).json({ error: 'Translation failed. Please try again.' });
  }
});

export default router;
