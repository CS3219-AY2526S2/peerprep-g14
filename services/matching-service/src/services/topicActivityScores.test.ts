import assert from "node:assert/strict";
import { test } from "node:test";
import { topicScoreFromComponents } from "./topicActivityScores.js";

test("topicScoreFromComponents matches weighted formula", () => {
  assert.equal(topicScoreFromComponents(0, 0, 0), 0);
  assert.equal(topicScoreFromComponents(2, 10, 0), 0.5 * 2 + 0.4 * 10 - 0.1 * 0);
  assert.equal(topicScoreFromComponents(0, 0, 10), -1);
});
