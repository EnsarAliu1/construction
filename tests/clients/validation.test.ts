import assert from "node:assert/strict";
import test from "node:test";
import { ClientValidationError, escapedSearch, parseClientId, parseClientInput, parseClientQuery, parseVersion } from "../../src/features/clients/validation";

test("client normalization permits optional contact/NUI and duplicate names without invented legal formats", () => {
  const individual = parseClientInput({ type: "private_person", name: "  Synthetic   Person  " });
  assert.equal(individual.name, "Synthetic Person"); assert.equal(individual.nui, null); assert.equal(individual.email, null);
  const business = parseClientInput({ type: "business", name: individual.name, nui: "arbitrary local identifier", email: "  EXAMPLE@EXAMPLE.INVALID ", phone: "+000 (test) 123" });
  assert.equal(business.email, "example@example.invalid"); assert.equal(business.nui, "arbitrary local identifier");
  assert.equal(parseClientInput({ type: "business", name: "Synthetic Company", nui: "  " }).nui, null);
});

test("server validation rejects missing names, invalid types, overlong/non-text contact and protected mass-assignment fields", () => {
  for (const input of [null, [], { type: "private_person", name: " " }, { type: "other", name: "Synthetic" }, { type: "business", name: "x".repeat(201) }, { type: "business", name: "Synthetic", email: "invalid" }, { type: "business", name: "Synthetic", phone: 123 }, { type: "business", name: "Synthetic", nui: "x".repeat(101) }, ...["id", "version", "deletedAt", "createdBy", "updatedBy", "deletedBy", "actorId", "password"].map(field => ({ type: "business", name: "Synthetic", [field]: "untrusted" }))]) assert.throws(() => parseClientInput(input), ClientValidationError);
});

test("versions, IDs and bounded search parameters reject malformed values", () => {
  for (const value of [undefined, "1", 0, -1, 1.5, Number.MAX_SAFE_INTEGER]) assert.throws(() => parseVersion(value));
  assert.equal(parseVersion(2), 2); assert.throws(() => parseClientId("../../login"));
  for (const input of [{ page: "-1" }, { page: "1.1" }, { page: "10001" }, { page: [] }, { type: ["business"] }, { type: "admin" }, { q: "x".repeat(101) }, { q: [] }]) assert.throws(() => parseClientQuery(input), ClientValidationError);
  assert.deepEqual(parseClientQuery({ q: "  Example  ", page: "2", type: "business" }), { q: "Example", page: 2, type: "business" });
  assert.deepEqual(parseClientQuery({}), { q: "", page: 1, type: "all" });
});

test("search treats SQL wildcard characters as literal user text", () => {
  assert.equal(escapedSearch("50%_="), "%50=%=_==%");
});
