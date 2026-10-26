import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { archiveClient, createClient, getClient, listClients, updateClient } from "../../src/features/clients/service";
import { ClientArchived, ClientConflict, ClientHasOpenProjects, ClientValidationError } from "../../src/features/clients/validation";
import { AuthenticationRequired } from "../../src/server/auth/security";
import { setAccountActive } from "../../src/server/auth/accounts";
import { clientFixture, mysqlSkip } from "./fixture";

test("Clients CRUD, history, concurrency and atomic audit against real MySQL 8.4", { skip: mysqlSkip, timeout: 120_000 }, async t => {
  const f = await clientFixture(); const c = f.connection;
  try {
    let person = await createClient(c, f.token, f.input({ name: `${f.prefix} Person`, email: " PERSON@EXAMPLE.INVALID ", phone: "+000 (synthetic) 01", addressLine1: "Synthetic Street 1", addressLine2: "Test floor", city: "Synthetic City", postalCode: "TEST", country: "Synthetic Country" }));
    await t.test("individual creation persists normalized optional fields, stable ID and actor-attributed audit/version", async () => {
      assert.equal(person.email, "person@example.invalid"); assert.equal(person.nui, null); assert.equal(person.version, 1); assert.equal(person.createdBy, f.userId);
      const detail = await getClient(c, f.token, person.id);
      assert.equal(detail.client.id, person.id); assert.equal(detail.projectCount, 0); assert.equal(detail.history.length, 1);
      const [audit] = await c.execute<RowDataPacket[]>("SELECT * FROM audit_events WHERE entity_type='client' AND entity_id=?", [person.id]);
      assert.equal(audit[0].actor_id, f.userId); assert.equal(audit[0].action, "client_created"); assert.equal(audit[0].before_snapshot, null); assert.ok(audit[0].operation_id); assert.ok(audit[0].recorded_at);
      assert.equal(audit[0].after_snapshot.phone, person.phone); assert.equal(audit[0].after_snapshot.addressLine2, person.addressLine2);
      const [versions] = await c.execute<RowDataPacket[]>("SELECT * FROM entity_versions WHERE entity_type='client' AND entity_id=?", [person.id]); assert.equal(versions.length, 1);
    });
    await t.test("business creation accepts optional/arbitrary NUI and duplicate names/contact without merging", async () => {
      const one = await createClient(c, f.token, f.input({ type: "business", name: `${f.prefix} Same name`, nui: `${f.prefix} arbitrary NUI`, phone: "shared contact" }));
      const two = await createClient(c, f.token, f.input({ type: "business", name: one.name, phone: one.phone }));
      assert.equal(two.nui, null); assert.ok(one.id !== two.id); assert.equal(one.type, "business");
      const result = await listClients(c, f.token, { q: one.name, type: "business" }); assert.equal(result.total, 2);
      assert.equal((await getClient(c, f.token, one.id)).client.nui, one.nui); assert.equal((await getClient(c, f.token, two.id)).client.id, two.id);
    });
    await t.test("invalid types, empty names, bad contacts and mass assignment create no business/audit writes", async () => {
      const [before] = await c.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM clients");
      for (const extra of [{ name: " " }, { type: "other" }, { email: "invalid" }, { name: "x".repeat(201) }, { createdBy: randomUUID() }, { deletedAt: "2026-01-01" }, { password: "must-never-be-audited" }]) await assert.rejects(createClient(c, f.token, f.input(extra)), ClientValidationError);
      const [after] = await c.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM clients"); assert.equal(after[0].total, before[0].total);
    });
    await t.test("database search covers contacts, identifiers, city and street; type filters and literal wildcards are safe", async () => {
      for (const q of [person.name, person.email!, person.phone!, person.city!, person.addressLine1!]) assert.ok((await listClients(c, f.token, { q })).rows.some(row => row.id === person.id));
      assert.equal((await listClients(c, f.token, { q: person.name, type: "business" })).total, 0);
      assert.equal((await listClients(c, f.token, { q: `${f.prefix} arbitrary NUI` })).total, 1);
      const literal = await createClient(c, f.token, f.input({ name: `${f.prefix} literal%_=` }));
      assert.deepEqual((await listClients(c, f.token, { q: literal.name })).rows.map(row => row.id), [literal.id]);
      assert.equal((await listClients(c, f.token, { q: "' OR 1=1 --" })).total, 0);
    });
    await t.test("reads are bounded to 20 and pagination is stable with no repeated IDs", async () => {
      for (let i = 0; i < 21; i++) await createClient(c, f.token, f.input({ name: `${f.prefix}-paged-${String(i).padStart(2, "0")}` }));
      const first = await listClients(c, f.token, { q: `${f.prefix}-paged-`, page: 1 }); const second = await listClients(c, f.token, { q: `${f.prefix}-paged-`, page: 2 });
      assert.equal(first.total, 21); assert.equal(first.rows.length, 20); assert.equal(second.rows.length, 1); assert.equal(new Set([...first.rows, ...second.rows].map(row => row.id)).size, 21);
    });
    await t.test("editing and clearing contacts writes complete before/after snapshots and increments the version", async () => {
      const before = person;
      person = await updateClient(c, f.token, person.id, person.version, f.input({ name: `${f.prefix} Updated Person`, email: "", phone: "", city: "Updated Synthetic City" }));
      assert.equal(person.version, 2); assert.equal(person.email, null); assert.equal(person.phone, null); assert.equal(person.updatedBy, f.userId);
      const detail = await getClient(c, f.token, person.id); const edit = detail.history.find(event => event.action === "client_updated")!;
      assert.equal(edit.before!.email, before.email); assert.equal(edit.after!.email, null); assert.equal(edit.after!.city, person.city);
    });
    await t.test("stale update and stale archive reject without an extra audit or write", async () => {
      await assert.rejects(updateClient(c, f.token, person.id, 1, f.input()), ClientConflict);
      await assert.rejects(archiveClient(c, f.token, person.id, 1, "archive"), ClientConflict);
      const detail = await getClient(c, f.token, person.id); assert.equal(detail.client.version, 2); assert.equal(detail.history.length, 2);
    });
    await t.test("two real concurrent editors yield exactly one winner and one conflict", async () => {
      const client = await createClient(c, f.token, f.input({ name: `${f.prefix} Concurrent` }));
      const outcomes = await Promise.allSettled(["A", "B"].map(suffix => f.independent(connection => updateClient(connection, f.token, client.id, 1, f.input({ name: `${f.prefix} Winner ${suffix}` })))));
      assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
      assert.ok(outcomes.some(result => result.status === "rejected" && result.reason instanceof ClientConflict));
      const detail = await getClient(c, f.token, client.id); assert.equal(detail.client.version, 2); assert.equal(detail.history.length, 2);
      const winner = outcomes.find(result => result.status === "fulfilled"); assert.ok(winner?.status === "fulfilled"); if (winner?.status === "fulfilled") assert.equal(detail.client.name, winner.value.name);
    });
    await t.test("active/suspended projects prevent archiving; completed references survive logical deletion", async () => {
      const client = await createClient(c, f.token, f.input({ name: `${f.prefix} Linked` })); const projectId = randomUUID();
      await c.execute("INSERT INTO projects (id, client_id, name, status) VALUES (?, ?, 'Synthetic linked project', 'active')", [projectId, client.id]);
      await assert.rejects(archiveClient(c, f.token, client.id, 1, "archive"), ClientHasOpenProjects);
      await c.execute("UPDATE projects SET status='suspended' WHERE id=?", [projectId]); await assert.rejects(archiveClient(c, f.token, client.id, 1, "archive"), ClientHasOpenProjects);
      await c.execute("UPDATE projects SET status='completed' WHERE id=?", [projectId]);
      const archived = await archiveClient(c, f.token, client.id, 1, "archive"); assert.ok(archived.deletedAt); assert.equal(archived.deletedBy, f.userId); assert.equal(archived.version, 2);
      assert.equal((await listClients(c, f.token, { q: client.name })).total, 0);
      const detail = await getClient(c, f.token, client.id); assert.equal(detail.client.id, client.id); assert.equal(detail.relatedProjects[0].id, projectId); assert.equal(detail.history.length, 2);
      await assert.rejects(updateClient(c, f.token, client.id, 2, f.input()), ClientArchived); await assert.rejects(archiveClient(c, f.token, client.id, 2, "archive"), ClientArchived);
      await assert.rejects(c.execute("DELETE FROM clients WHERE id=?", [client.id]), (error: unknown) => Boolean(error && typeof error === "object" && "errno" in error && error.errno === 1451));
    });
    await t.test("archive confirmation is mandatory and no-project clients can be archived", async () => {
      const client = await createClient(c, f.token, f.input({ name: `${f.prefix} Archive` }));
      await assert.rejects(archiveClient(c, f.token, client.id, 1, undefined), ClientValidationError);
      assert.ok((await archiveClient(c, f.token, client.id, 1, "archive")).deletedAt);
    });
    await t.test("legacy clients retain their identity and unknown actor metadata without invented history", async () => {
      const id = randomUUID();
      await c.execute("INSERT INTO clients (id, type, name) VALUES (?, 'private_person', ?)", [id, `${f.prefix} Legacy`]);
      const before = await getClient(c, f.token, id); assert.equal(before.client.version, 1); assert.equal(before.client.createdBy, null); assert.equal(before.history.length, 0);
      const after = await updateClient(c, f.token, id, 1, f.input({ name: `${f.prefix} Legacy corrected` })); assert.equal(after.id, id); assert.equal(after.createdBy, null); assert.equal(after.updatedBy, f.userId);
      const detail = await getClient(c, f.token, id); assert.equal(detail.history.length, 1); assert.equal(detail.history[0].before!.createdBy, null);
    });
    await t.test("audit storage failure rolls back create, update and archive including versions", async () => {
      const client = await createClient(c, f.token, f.input({ name: `${f.prefix} Rollback existing` }));
      const rejectedName = `${f.prefix} Rollback new`;
      const trigger = `wp04_audit_failure_${randomUUID().replaceAll("-", "")}`;
      // Disposable test-only failure injection, never replacing any existing guard.
      await c.query(`CREATE TRIGGER \`${trigger}\` BEFORE INSERT ON audit_events FOR EACH ROW BEGIN IF NEW.entity_type='client' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic audit persistence failure'; END IF; END`);
      try {
        await assert.rejects(createClient(c, f.token, f.input({ name: rejectedName })));
        await assert.rejects(updateClient(c, f.token, client.id, 1, f.input({ name: `${f.prefix} Must rollback` })));
        await assert.rejects(archiveClient(c, f.token, client.id, 1, "archive"));
        const detail = await getClient(c, f.token, client.id); assert.deepEqual(detail.client, client); assert.equal(detail.history.length, 1);
        assert.equal((await listClients(c, f.token, { q: rejectedName })).total, 0);
        const [versions] = await c.execute<RowDataPacket[]>("SELECT version FROM entity_versions WHERE entity_type='client' AND entity_id=?", [client.id]); assert.deepEqual(versions.map(row => row.version), [1]);
      } finally { await c.query(`DROP TRIGGER \`${trigger}\``); }
      const [triggers] = await c.query<RowDataPacket[]>("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()"); assert.equal(triggers.length, 13);
    });
    await t.test("anonymous calls are denied before record lookup or validation for every operation", async () => {
      for (const token of [undefined, "malformed"]) for (const operation of [() => listClients(c, token), () => getClient(c, token, "invalid-id"), () => createClient(c, token, {}), () => updateClient(c, token, person.id, 2, {}), () => archiveClient(c, token, person.id, 2, "archive")]) await assert.rejects(operation(), AuthenticationRequired);
    });
    await t.test("another authenticated user has equal client permissions and audit uses the real actor", async () => {
      const other = await f.anotherUser();
      const updated = await updateClient(c, other.token, person.id, person.version, f.input({ name: `${f.prefix} Second operator correction` }));
      assert.equal(updated.updatedBy, other.id); assert.equal(updated.createdBy, f.userId);
      const [events] = await c.execute<RowDataPacket[]>("SELECT actor_id FROM audit_events WHERE entity_type='client' AND entity_id=? AND action='client_updated' ORDER BY recorded_at DESC LIMIT 1", [person.id]); assert.equal(events[0].actor_id, other.id);
      person = updated;
    });
    await t.test("deactivation invalidates an existing session for reads and all mutations", async () => {
      await setAccountActive(c, f.operator, f.email, false);
      for (const operation of [() => listClients(c, f.token), () => getClient(c, f.token, person.id), () => createClient(c, f.token, f.input()), () => updateClient(c, f.token, person.id, person.version, f.input()), () => archiveClient(c, f.token, person.id, person.version, "archive")]) await assert.rejects(operation(), AuthenticationRequired);
    });
  } finally { await f.close(); }
});
