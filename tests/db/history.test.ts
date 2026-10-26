import assert from "node:assert/strict";
import test from "node:test";
import { safeHistorySnapshot, historyFields } from "../../src/server/db/history-snapshot";

test("history snapshots reject password fields and nested/unapproved payloads", () => {
  for (const value of [
    { passwordHash: "synthetic-not-a-hash" }, { password_hash: "synthetic-not-a-hash" },
    { password: "synthetic" }, { token: "synthetic" }, { name: { passwordHash: "synthetic" } },
    { arbitrary: "value" }, [], null, { version: Number.NaN }, { amount: 0.1 },
  ]) assert.throws(() => safeHistorySnapshot(value));
  assert.ok(!historyFields.some(field => /password|token|secret/i.test(field)));
});

test("safe historical values retain exact money and scalar metadata", () => {
  const input = { id: "synthetic", amount: "9007199254740993.01", version: 2, deletedAt: null, isActive: true };
  const snapshot = safeHistorySnapshot(input);
  assert.deepEqual(snapshot, input);
  assert.notEqual(snapshot, input);
});
