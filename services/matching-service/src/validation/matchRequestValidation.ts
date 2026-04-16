import {
  MATCH_DIFFICULTIES,
  MATCH_TOPICS,
  PROGRAMMING_LANGUAGES,
  TIME_AVAILABLE_MINUTES_ALLOWED,
  type MatchDifficulty,
  type MatchTopic,
  type ProgrammingLanguage,
  type TimeAvailableMinutes,
} from "../constants/matchingOptions.js";

export type CreateMatchRequestInput = {
  topic: MatchTopic;
  difficulty: MatchDifficulty;
  programmingLanguage: ProgrammingLanguage;
  /** F5.2 — default false when omitted */
  allowLowerDifficultyMatch: boolean;
  /** F2 — omit or null for no preference */
  timeAvailableMinutes?: TimeAvailableMinutes;
};

export class MatchRequestValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues.join("; "));
    this.name = "MatchRequestValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(
  body: Record<string, unknown>,
  key: string,
  missing: string[],
  wrongType: string[],
): string | undefined {
  const raw = body[key];
  if (raw === undefined || raw === null) {
    missing.push(`Missing required field: ${key}`);
    return undefined;
  }
  if (typeof raw !== "string") {
    wrongType.push(`Field ${key} must be a string`);
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    missing.push(`Missing required field: ${key}`);
    return undefined;
  }
  return trimmed;
}

function isMember<T extends string>(
  value: string,
  allowed: readonly T[],
): value is T {
  return (allowed as readonly string[]).includes(value);
}

function readOptionalBoolean(
  body: Record<string, unknown>,
  key: string,
  wrongType: string[],
): boolean | undefined {
  const raw = body[key];
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "boolean") {
    wrongType.push(`Field ${key} must be a boolean when provided`);
    return undefined;
  }
  return raw;
}

/**
 * F2 — optional; must be 30, 45, or 60 when provided.
 */
function readOptionalTimeAvailableMinutes(
  body: Record<string, unknown>,
  wrongType: string[],
  invalid: string[],
): TimeAvailableMinutes | undefined {
  const raw = body["timeAvailableMinutes"];
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    wrongType.push(
      "Field timeAvailableMinutes must be an integer when provided",
    );
    return undefined;
  }
  if (
    !(TIME_AVAILABLE_MINUTES_ALLOWED as readonly number[]).includes(raw)
  ) {
    invalid.push(
      `timeAvailableMinutes must be one of: ${TIME_AVAILABLE_MINUTES_ALLOWED.join(", ")} when provided`,
    );
    return undefined;
  }
  return raw as TimeAvailableMinutes;
}

/**
 * Validates POST /matching/requests JSON body (F1.1.x).
 */
export function parseCreateMatchRequestBody(
  body: unknown,
): CreateMatchRequestInput {
  if (!isRecord(body)) {
    throw new MatchRequestValidationError([
      "Request body must be a JSON object",
    ]);
  }

  const missing: string[] = [];
  const wrongType: string[] = [];
  const invalid: string[] = [];
  const topicRaw = readStringField(body, "topic", missing, wrongType);
  const difficultyRaw = readStringField(body, "difficulty", missing, wrongType);
  const languageRaw = readStringField(
    body,
    "programmingLanguage",
    missing,
    wrongType,
  );
  const allowLowerRaw = readOptionalBoolean(
    body,
    "allowLowerDifficultyMatch",
    wrongType,
  );
  const timeRaw = readOptionalTimeAvailableMinutes(body, wrongType, invalid);

  if (wrongType.length > 0) {
    throw new MatchRequestValidationError(wrongType);
  }
  if (missing.length > 0) {
    throw new MatchRequestValidationError(missing);
  }

  if (!topicRaw || !isMember(topicRaw, MATCH_TOPICS)) {
    invalid.push(
      `Invalid topic: must be exactly one of: ${MATCH_TOPICS.join(", ")}`,
    );
  }
  if (!difficultyRaw || !isMember(difficultyRaw, MATCH_DIFFICULTIES)) {
    invalid.push(
      `Invalid difficulty: must be exactly one of: ${MATCH_DIFFICULTIES.join(", ")}`,
    );
  }
  if (!languageRaw || !isMember(languageRaw, PROGRAMMING_LANGUAGES)) {
    invalid.push(
      `Invalid programmingLanguage: must be exactly one of: ${PROGRAMMING_LANGUAGES.join(", ")}`,
    );
  }

  if (invalid.length > 0) {
    throw new MatchRequestValidationError(invalid);
  }

  if (
    !topicRaw ||
    !difficultyRaw ||
    !languageRaw ||
    !isMember(topicRaw, MATCH_TOPICS) ||
    !isMember(difficultyRaw, MATCH_DIFFICULTIES) ||
    !isMember(languageRaw, PROGRAMMING_LANGUAGES)
  ) {
    throw new MatchRequestValidationError(["Invalid match request payload"]);
  }

  const out: CreateMatchRequestInput = {
    topic: topicRaw,
    difficulty: difficultyRaw,
    programmingLanguage: languageRaw,
    allowLowerDifficultyMatch: allowLowerRaw ?? false,
  };
  if (timeRaw !== undefined) {
    out.timeAvailableMinutes = timeRaw;
  }
  return out;
}
