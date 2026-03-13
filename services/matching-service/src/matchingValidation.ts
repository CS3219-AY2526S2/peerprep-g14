export const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export const ALLOWED_TOPICS = [
  'arrays',
  'two-pointers',
  'sliding-window',
  'stack',
  'binary-search',
  'linked-list',
  'trees',
  'graphs',
  'dp',
] as const;

export const ALLOWED_LANGUAGES = [
  'java',
  'python',
  'cpp',
] as const;

export type Difficulty = (typeof ALLOWED_DIFFICULTIES)[number];
export type Topic = (typeof ALLOWED_TOPICS)[number];
export type Language = (typeof ALLOWED_LANGUAGES)[number];

export interface MatchRequestPayload {
  topic: Topic;
  difficulty: Difficulty;
  language: Language;
}

export type MatchField = 'topic' | 'difficulty' | 'language';

export interface ValidationErrorDetail {
  field: MatchField;
  message: string;
}

export interface ValidationResult {
  value?: MatchRequestPayload;
  errors?: ValidationErrorDetail[];
}

export function validateMatchRequestPayload(body: unknown): ValidationResult {
  const errors: ValidationErrorDetail[] = [];

  const asRecord =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {};

  const rawTopic = asRecord.topic;
  const rawDifficulty = asRecord.difficulty;
  const rawLanguage = asRecord.language;

  if (rawTopic === undefined || rawTopic === null || rawTopic === '') {
    errors.push({
      field: 'topic',
      message: 'Topic is required.',
    });
  } else if (Array.isArray(rawTopic)) {
    errors.push({
      field: 'topic',
      message: 'Exactly one topic must be selected.',
    });
  }

  if (rawDifficulty === undefined || rawDifficulty === null || rawDifficulty === '') {
    errors.push({
      field: 'difficulty',
      message: 'Difficulty is required.',
    });
  } else if (Array.isArray(rawDifficulty)) {
    errors.push({
      field: 'difficulty',
      message: 'Exactly one difficulty must be selected.',
    });
  }

  if (rawLanguage === undefined || rawLanguage === null || rawLanguage === '') {
    errors.push({
      field: 'language',
      message: 'Programming language is required.',
    });
  } else if (Array.isArray(rawLanguage)) {
    errors.push({
      field: 'language',
      message: 'Exactly one programming language must be selected.',
    });
  }

  if (errors.length > 0) {
    return { errors };
  }

  const topic = String(rawTopic);
  const difficulty = String(rawDifficulty);
  const language = String(rawLanguage);

  if (!ALLOWED_TOPICS.includes(topic as Topic)) {
    errors.push({
      field: 'topic',
      message: `Topic must be one of: ${ALLOWED_TOPICS.join(', ')}.`,
    });
  }

  if (!ALLOWED_DIFFICULTIES.includes(difficulty as Difficulty)) {
    errors.push({
      field: 'difficulty',
      message: `Difficulty must be one of: ${ALLOWED_DIFFICULTIES.join(', ')}.`,
    });
  }

  if (!ALLOWED_LANGUAGES.includes(language as Language)) {
    errors.push({
      field: 'language',
      message: `Programming language must be one of: ${ALLOWED_LANGUAGES.join(', ')}.`,
    });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      topic: topic as Topic,
      difficulty: difficulty as Difficulty,
      language: language as Language,
    },
  };
}

