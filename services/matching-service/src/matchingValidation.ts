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

export const ALLOWED_TIME_AVAILABLE_MINUTES = [30, 45, 60] as const;

export type Difficulty = (typeof ALLOWED_DIFFICULTIES)[number];
export type Topic = (typeof ALLOWED_TOPICS)[number];
export type Language = (typeof ALLOWED_LANGUAGES)[number];
export type TimeAvailableMinutes = (typeof ALLOWED_TIME_AVAILABLE_MINUTES)[number];

export interface MatchRequestPayload {
  topic: Topic;
  difficulty: Difficulty;
  language: Language;
  timeAvailableMinutes?: TimeAvailableMinutes | undefined;
}

export type MatchField = 'topic' | 'difficulty' | 'language' | 'timeAvailableMinutes';

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
  const rawTimeAvailable = asRecord.timeAvailableMinutes ?? asRecord.timeAvailable;

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

  // Optional preference: time available in minutes
  let timeAvailableMinutes: TimeAvailableMinutes | undefined;
  if (rawTimeAvailable !== undefined && rawTimeAvailable !== null && rawTimeAvailable !== '') {
    if (Array.isArray(rawTimeAvailable)) {
      errors.push({
        field: 'timeAvailableMinutes',
        message: 'At most one time selection is allowed.',
      });
    } else {
      const parsed = Number(rawTimeAvailable);
      if (!Number.isFinite(parsed) || !ALLOWED_TIME_AVAILABLE_MINUTES.includes(parsed as TimeAvailableMinutes)) {
        errors.push({
          field: 'timeAvailableMinutes',
          message: `Time available must be one of: ${ALLOWED_TIME_AVAILABLE_MINUTES.join(', ')} minutes.`,
        });
      } else {
        timeAvailableMinutes = parsed as TimeAvailableMinutes;
      }
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      topic: topic as Topic,
      difficulty: difficulty as Difficulty,
      language: language as Language,
      timeAvailableMinutes,
    },
  };
}

