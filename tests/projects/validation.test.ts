import assert from "node:assert/strict";
import test from "node:test";
import { cents, decimal, inputMoney } from "../../src/features/projects/money";
import { parsePlan, parseProject, parseProjectQuery } from "../../src/features/projects/validation";
const id = "10000000-0000-0000-0000-000000000001";
const project = { name: "Synthetic site", clientId: id, clientVersion: 1, status: "active", startDate: "2024-02-29", endDate: "2024-03-01" };
const phase = (value = "0.10") => ({ name: "Synthetic phase", value, sortOrder: 0 });
test("exact cent arithmetic preserves small fractions and DECIMAL values beyond safe Number precision", () => {
  assert.equal(decimal(cents("0.10") + cents("0.20")), "0.30");
  assert.equal(decimal(cents("99999999999999999.99") - cents("0.01")), "99999999999999999.98");
  assert.equal(inputMoney("00012.5"), "12.50"); assert.equal(decimal(BigInt(-1)), "-0.01");
  for (const value of ["-1", "1.001", "1e3", "NaN", "Infinity", "1,00"]) assert.throws(() => inputMoney(value));
});
test("project validation uses real calendar dates, enum/storage bounds and protected-field allowlists", () => {
  assert.equal(parseProject(project).startDate, "2024-02-29");
  for (const change of [{ name: " " }, { name: "x".repeat(201) }, { location: "x".repeat(256) }, { clientId: "invalid" }, { clientVersion: "1" }, { status: "planned" }, { startDate: "2023-02-29" }, { startDate: "2026-04-31" }, { endDate: "2024-02-01" }, { createdBy: id }, { deletedAt: "2026-01-01" }]) assert.throws(() => parseProject({ ...project, ...change }));
});
test("initial contracts require exact equality, bounded phases and exact nonnegative decimal strings", () => {
  assert.equal(parsePlan({ totalValue: "0.30", phases: [phase(), phase("0.20")] }, true).totalValue, "0.30");
  assert.equal(parsePlan({ totalValue: "0.00", phases: [] }, true).phases.length, 0);
  assert.throws(()=>parsePlan({totalValue:"0.00",phases:[{...phase("0.00"),description:"😀".repeat(17000)}]},true));
  for (const payload of [{ totalValue: "0.31", phases: [phase(), phase("0.20")] }, { totalValue: 0.1, phases: [phase()] }, { totalValue: "-0.10", phases: [phase("-0.10")] }, { totalValue: "0.10", phases: [{ ...phase(), name: "" }] }, { totalValue: "0.10", phases: [{ ...phase(), id, version: 1 }] }, { totalValue: "0.00", phases: Array.from({ length: 101 }, () => phase("0.00")) }]) assert.throws(() => parsePlan(payload, true));
});
test("combined changes reject duplicate identities, stale-shaped versions and unknown fields", () => {
  const plan = { contractId: id, version: 1, projectVersion: 1, totalValue: "0.10", phases: [{ ...phase(), id, version: 1 }], deletedPhases: [] };
  assert.equal(parsePlan(plan).phases.length, 1);
  for (const change of [{ deletedPhases: [{ id, version: 1 }] }, { version: "1" }, { actorId: id }, { contractId: null, version: 1 }, { phases: [{ ...phase(), version: 1 }] }]) assert.throws(() => parsePlan({ ...plan, ...change }));
});
test("query bounds reject unsupported filters and unbounded pagination", () => {
  assert.equal(parseProjectQuery({ status: "completed", page: "2" }).page, 2);
  for (const payload of [{ page: "10001" }, { page: -1 }, { page: [] }, { status: "draft" }, { q: "x".repeat(101) }, { clientId: "invalid" }, { unknown: true }]) assert.throws(() => parseProjectQuery(payload));
});
