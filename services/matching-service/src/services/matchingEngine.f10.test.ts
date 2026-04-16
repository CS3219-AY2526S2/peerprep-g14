/**
 * F10.1 — Executable checks for matching order (run: `npm run test` in matching-service).
 */
import { strict as assert } from "node:assert";
import {
  compareMatchRequests,
  findFirstPair,
  groupByTopicAndLanguage,
  isStrictlyLowerDifficulty,
  orderRequestersLongestWaitingFirst,
  type MatchRequestRow,
} from "./matchingEngine.js";

function mk(
  base: Pick<MatchRequestRow, "id" | "userId"> &
    Partial<Omit<MatchRequestRow, "id" | "userId">>,
): MatchRequestRow {
  return {
    topic: "arrays",
    programmingLanguage: "typescript",
    difficulty: "medium",
    allowLowerDifficultyMatch: false,
    timeAvailableMinutes: null,
    createdAt: new Date("2025-01-01T10:00:00Z"),
    ...base,
  };
}

// --- compareMatchRequests / tie-break ---
{
  const a = mk({
    id: "a",
    userId: "u1",
    createdAt: new Date("2025-01-01T10:00:00Z"),
  });
  const b = mk({
    id: "b",
    userId: "u1",
    createdAt: new Date("2025-01-01T10:01:00Z"),
  });
  assert(compareMatchRequests(a, b) < 0, "earlier createdAt first");
}

{
  const a = mk({
    id: "a",
    userId: "u1",
    createdAt: new Date("2025-01-01T10:00:00Z"),
  });
  const b = mk({
    id: "b",
    userId: "u2",
    createdAt: new Date("2025-01-01T10:00:00Z"),
  });
  assert(compareMatchRequests(a, b) < 0, "same time: userId asc");
}

{
  const a = mk({
    id: "a",
    userId: "u1",
    createdAt: new Date("2025-01-01T10:00:00Z"),
  });
  const b = mk({
    id: "b",
    userId: "u1",
    createdAt: new Date("2025-01-01T10:00:00Z"),
  });
  assert(compareMatchRequests(a, b) < 0, "same time/user: id asc");
}

// --- pool grouping ---
{
  const r1 = mk({ id: "1", userId: "a", topic: "t1", programmingLanguage: "python" });
  const r2 = mk({ id: "2", userId: "b", topic: "t1", programmingLanguage: "python" });
  const r3 = mk({ id: "3", userId: "c", topic: "t2", programmingLanguage: "python" });
  const m = groupByTopicAndLanguage([r1, r2, r3]);
  assert.equal(m.size, 2);
  assert.equal(m.get("t1\0python")?.length, 2);
  assert.equal(m.get("t2\0python")?.length, 1);
}

// --- longest-waiting requester is first in pool order ---
{
  const older = mk({
    id: "a",
    userId: "u1",
    createdAt: new Date("2025-01-01T09:00:00Z"),
  });
  const newer = mk({
    id: "b",
    userId: "u2",
    createdAt: new Date("2025-01-01T10:00:00Z"),
  });
  const ordered = orderRequestersLongestWaitingFirst([newer, older]);
  assertEqualIds(ordered, ["a", "b"]);
}

function assertEqualIds(rows: MatchRequestRow[], ids: string[]): void {
  assert.deepStrictEqual(
    rows.map((r) => r.id),
    ids,
  );
}

// --- same-difficulty before downward ---
{
  const r1 = mk({
    id: "r1",
    userId: "a",
    difficulty: "hard",
    allowLowerDifficultyMatch: true,
  });
  const r2 = mk({
    id: "r2",
    userId: "b",
    difficulty: "hard",
    createdAt: new Date("2025-01-01T10:01:00Z"),
  });
  const r3 = mk({
    id: "r3",
    userId: "c",
    difficulty: "medium",
    createdAt: new Date("2025-01-01T10:02:00Z"),
  });
  const pair = findFirstPair([r1, r2, r3]);
  assert(pair !== null);
  assert.equal(pair!.matchingType, "same_difficulty");
  assert.equal(pair!.requester.id, "r1");
  assert.equal(pair!.partner.id, "r2");
}

// --- downward only when opted in ---
{
  const r1 = mk({
    id: "r1",
    userId: "a",
    difficulty: "hard",
    allowLowerDifficultyMatch: false,
  });
  const r2 = mk({
    id: "r2",
    userId: "b",
    difficulty: "medium",
    createdAt: new Date("2025-01-01T10:01:00Z"),
  });
  assert.equal(findFirstPair([r1, r2]), null);
}

{
  const r1 = mk({
    id: "r1",
    userId: "a",
    difficulty: "hard",
    allowLowerDifficultyMatch: true,
  });
  const r2 = mk({
    id: "r2",
    userId: "b",
    difficulty: "medium",
    createdAt: new Date("2025-01-01T10:01:00Z"),
  });
  const pair = findFirstPair([r1, r2]);
  assert(pair !== null);
  assert.equal(pair!.matchingType, "downward");
  assert.equal(pair!.partner.id, "r2");
}

// --- never upward ---
{
  const r1 = mk({
    id: "r1",
    userId: "a",
    difficulty: "easy",
    allowLowerDifficultyMatch: true,
  });
  const r2 = mk({
    id: "r2",
    userId: "b",
    difficulty: "hard",
    createdAt: new Date("2025-01-01T10:01:00Z"),
  });
  assert.equal(findFirstPair([r1, r2]), null);
}

assert(!isStrictlyLowerDifficulty("hard", "easy"));
assert(isStrictlyLowerDifficulty("easy", "hard"));

// --- time preference: exact match preferred among same-difficulty ---
{
  const r1 = mk({
    id: "r1",
    userId: "a",
    timeAvailableMinutes: 45,
    createdAt: new Date("2025-01-01T10:00:00Z"),
  });
  const r2 = mk({
    id: "r2",
    userId: "b",
    timeAvailableMinutes: 60,
    createdAt: new Date("2025-01-01T10:01:00Z"),
  });
  const r3 = mk({
    id: "r3",
    userId: "c",
    timeAvailableMinutes: 45,
    createdAt: new Date("2025-01-01T10:02:00Z"),
  });
  const pair = findFirstPair([r1, r2, r3]);
  assert(pair !== null);
  assert.equal(pair!.partner.id, "r3");
}

// --- different topic / language: no cross-pool match ---
{
  const a = mk({
    id: "a",
    userId: "u1",
    topic: "graphs",
    programmingLanguage: "typescript",
  });
  const b = mk({
    id: "b",
    userId: "u2",
    topic: "arrays",
    programmingLanguage: "typescript",
  });
  assert.equal(findFirstPair([a, b]), null);
}

console.log("matchingEngine F10 tests passed");
