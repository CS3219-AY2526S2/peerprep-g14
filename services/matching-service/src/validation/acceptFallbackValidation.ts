import { MATCH_TOPICS } from "../constants/matchingOptions.js";

export type AcceptFallbackBody =
  | { type: "enable_downward_matching" }
  | { type: "switch_topic_nearby"; topic: string }
  | { type: "switch_topic_popular"; topic: string };

export class AcceptFallbackValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues.join("; "));
    this.name = "AcceptFallbackValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAcceptFallbackBody(body: unknown): AcceptFallbackBody {
  if (!isRecord(body)) {
    throw new AcceptFallbackValidationError(["Body must be a JSON object"]);
  }
  const t = body["type"];
  if (typeof t !== "string" || t.trim() === "") {
    throw new AcceptFallbackValidationError(['Missing or invalid "type"']);
  }

  if (t === "enable_downward_matching") {
    return { type: "enable_downward_matching" };
  }

  const topicRaw = body["topic"];
  if (typeof topicRaw !== "string" || topicRaw.trim() === "") {
    throw new AcceptFallbackValidationError([
      'Field "topic" is required for topic switch',
    ]);
  }
  const topic = topicRaw.trim();
  if (!(MATCH_TOPICS as readonly string[]).includes(topic)) {
    throw new AcceptFallbackValidationError([`Invalid topic: ${topic}`]);
  }

  if (t === "switch_topic_nearby") {
    return { type: "switch_topic_nearby", topic };
  }
  if (t === "switch_topic_popular") {
    return { type: "switch_topic_popular", topic };
  }

  throw new AcceptFallbackValidationError([
    `Unknown fallback type: ${t}`,
  ]);
}
