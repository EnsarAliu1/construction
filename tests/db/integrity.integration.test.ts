import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { RowDataPacket } from "mysql2/promise";
import { loadLocalEnvironment, localDatabaseOptions, openLocalConnection } from "../../src/server/db/config";
import { applyMigrations } from "../../src/server/db/migrate";
import { payments } from "../../src/server/db/schema";
import { verifyDatabaseSchema } from "./schema-inspection";

loadLocalEnvironment();

test("disposable MySQL 8.4 migrations and schema integrity", {
  timeout: 30_000,
  skip: !process.env.TEST_DATABASE_URL ? "NOT VERIFIED: TEST_DATABASE_URL is absent; no MySQL database was accessed" : false,
}, async t => {
  const options = localDatabaseOptions(process.env.TEST_DATABASE_URL, "test", process.env.DATABASE_DISPOSABLE);
  const connection = await openLocalConnection(options);
  const expectedNames = ["users", "clients", "projects", "contracts", "contract_phases", "payments", "payment_allocations", "expenses", "expense_categories", "persons", "vehicles", "payment_receipts", "receipt_versions", "receipt_counters", "audit_events", "entity_versions", "operation_requests", "auth_sessions", "auth_account_control", "auth_login_limits"];
  const fixture = Object.fromEntries(["user", "client", "project", "contract", "phase", "deletedPhase", "payment", "secondPayment", "category", "person", "vehicle", "expense", "allocation", "receipt", "receiptVersion", "audit", "entityVersion", "operation"].map(key => [key, randomUUID()]));

  type TestValue = string | number | boolean | null;
  async function rejectsSql(sql: string, values: TestValue[], errno: number) {
    await assert.rejects(connection.execute(sql, values), error => Boolean(
      error && typeof error === "object" && "errno" in error && error.errno === errno &&
      (errno !== 1644 || ("sqlState" in error && error.sqlState === "45000" && "code" in error && error.code === "ER_SIGNAL_EXCEPTION"))
    ));
  }
  async function insert(table: string, values: Record<string, TestValue>) {
    assert.ok(expectedNames.includes(table));
    assert.ok(Object.keys(values).every(key => /^[a-z_]+$/.test(key)));
    const columns = Object.keys(values).map(key => `\`${key}\``).join(", ");
    await connection.execute(`INSERT INTO \`${table}\` (${columns}) VALUES (${Object.keys(values).map(() => "?").join(", ")})`, Object.values(values));
  }

  try {
    await t.test("empty-database migration and repeat application", async () => {
      const [existing] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
      assert.ok(existing.every(row => [...expectedNames, "__drizzle_migrations"].includes(String(row.name))), "Refusing database with unknown existing tables");
      if (existing.length) {
        assert.equal(existing.length, expectedNames.length + 1, "Use an empty database or the fully migrated dedicated test database");
        t.diagnostic("Existing test schema: fresh empty-database execution is not exercised in this run.");
      } else t.diagnostic("Applying migrations to the empty dedicated disposable test database.");
      await applyMigrations(connection);
      const [first] = await connection.query<RowDataPacket[]>("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at");
      assert.equal(first.length, 9);
      assert.deepEqual(first.map(row => row.hash), readMigrationFiles({ migrationsFolder: "drizzle" }).map(migration => migration.hash));
      const beforeRepeat = await verifyDatabaseSchema(connection);
      await applyMigrations(connection);
      const [second] = await connection.query<RowDataPacket[]>("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at");
      assert.deepEqual(second, first);
      const afterRepeat = await verifyDatabaseSchema(connection);
      assert.deepEqual(afterRepeat, beforeRepeat, "Repeat migration must preserve all schema objects");
      t.diagnostic(`Verified ${afterRepeat.tables} tables, ${afterRepeat.foreignKeys} foreign keys, ${afterRepeat.indexes} application indexes, ${afterRepeat.checks} enforced checks and ${afterRepeat.triggers} triggers.`);
      const [tables] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '__drizzle_migrations'");
      assert.deepEqual(tables.map(row => row.name).sort(), [...expectedNames].sort());
      assert.ok(tables.every(row => row.engine === "InnoDB"));
      const [triggers] = await connection.query<RowDataPacket[]>("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()");
      assert.equal(triggers.length, 13);
    });

    // All synthetic fixture writes, including immutable rows, disappear on rollback.
    // DDL is already committed separately by MySQL. No DROP/TRUNCATE/reset is used.
    await connection.beginTransaction();
    try {
      await insert("users", { id: fixture.user, display_name: "Synthetic Test User", email: `${fixture.user}@example.invalid`, password_hash: "synthetic-not-a-usable-password-hash" });
      await insert("clients", { id: fixture.client, type: "business", name: "Synthetic Test Client" });
      await insert("projects", { id: fixture.project, client_id: fixture.client, name: "Synthetic Test Project" });
      await insert("contracts", { id: fixture.contract, project_id: fixture.project, total_value: "125.10" });
      await insert("contract_phases", { id: fixture.phase, contract_id: fixture.contract, name: "Synthetic Phase", value: "100.10" });
      await insert("contract_phases", { id: fixture.deletedPhase, contract_id: fixture.contract, name: "Synthetic Unallocated Phase", value: "25.00", sort_order: 1 });
      await insert("payments", { id: fixture.payment, project_id: fixture.project, amount: "100.10", transaction_date: "2026-01-02", method: "bank", created_by: fixture.user });
      await insert("payments", { id: fixture.secondPayment, project_id: fixture.project, amount: "1.00", transaction_date: "2026-01-02", method: "cash" });
      await insert("payment_allocations", { id: fixture.allocation, payment_id: fixture.payment, phase_id: fixture.phase, amount: "100.10" });
      await insert("expense_categories", { id: fixture.category, name: `Synthetic ${fixture.category}` });
      await insert("persons", { id: fixture.person, name: "Synthetic Supplier" });
      await insert("vehicles", { id: fixture.vehicle, identifier: `Synthetic-${fixture.vehicle}` });
      await insert("expenses", { id: fixture.expense, category_id: fixture.category, amount: "0.10", transaction_date: "2026-01-02", description: "Synthetic general company expense" });
      await insert("payment_receipts", { id: fixture.receipt, payment_id: fixture.payment, receipt_number: `SYNTHETIC-${fixture.receipt}`, status: "issued" });
      const receiptVersion = { receipt_id: fixture.receipt, version: 1, content_snapshot: JSON.stringify({ amount: "100.10" }), storage_reference: "synthetic://not-a-document", file_checksum: "a".repeat(64), issued_at: "2026-01-02 03:04:05.678", issued_by: fixture.user };
      await insert("receipt_versions", { id: fixture.receiptVersion, ...receiptVersion });
      await insert("audit_events", { id: fixture.audit, actor_id: fixture.user, entity_type: "payment", entity_id: fixture.payment, action: "synthetic_test", after_snapshot: JSON.stringify({ amount: "100.10" }) });
      await insert("entity_versions", { id: fixture.entityVersion, entity_type: "contract", entity_id: fixture.contract, version: 1, snapshot: JSON.stringify({ totalValue: "125.10" }) });
      await insert("operation_requests", { id: fixture.operation, operation_type: "synthetic_test", idempotency_key: fixture.operation, request_fingerprint: "b".repeat(64) });

      await t.test("unique email, contract, allocation, receipt identity and receipt version", async () => {
        await assert.rejects(insert("users", { id: randomUUID(), display_name: "Synthetic Duplicate", email: `${fixture.user}@EXAMPLE.INVALID`, password_hash: "synthetic" }), { errno: 1062 });
        await assert.rejects(insert("contracts", { id: randomUUID(), project_id: fixture.project, total_value: "0.00" }), { errno: 1062 });
        await assert.rejects(insert("payment_allocations", { id: randomUUID(), payment_id: fixture.payment, phase_id: fixture.phase, amount: "0.01" }), { errno: 1062 });
        await assert.rejects(insert("payment_receipts", { id: randomUUID(), payment_id: fixture.secondPayment, receipt_number: `SYNTHETIC-${fixture.receipt}` }), { errno: 1062 });
        await assert.rejects(insert("payment_receipts", { id: randomUUID(), payment_id: fixture.payment, receipt_number: `SYNTHETIC-${randomUUID()}` }), { errno: 1062 });
        await assert.rejects(insert("receipt_versions", { id: randomUUID(), ...receiptVersion }), { errno: 1062 });
      });

      await t.test("foreign keys reject orphan projects, payments, phases and allocations", async () => {
        await assert.rejects(insert("projects", { id: randomUUID(), client_id: randomUUID(), name: "Synthetic Orphan" }), { errno: 1452 });
        await assert.rejects(insert("payments", { id: randomUUID(), project_id: randomUUID(), amount: "1.00", transaction_date: "2026-01-02", method: "cash" }), { errno: 1452 });
        await assert.rejects(insert("contract_phases", { id: randomUUID(), contract_id: randomUUID(), name: "Synthetic Orphan", value: "1.00" }), { errno: 1452 });
        await assert.rejects(insert("payment_allocations", { id: randomUUID(), payment_id: randomUUID(), phase_id: fixture.phase, amount: "1.00" }), { errno: 1452 });
        await assert.rejects(insert("payment_allocations", { id: randomUUID(), payment_id: fixture.payment, phase_id: randomUUID(), amount: "1.00" }), { errno: 1452 });
        await rejectsSql("DELETE FROM clients WHERE id = ?", [fixture.client], 1451);
        await rejectsSql("DELETE FROM projects WHERE id = ?", [fixture.project], 1451);
      });

      await t.test("exact decimal roundtrip, strict overflow, dates and optional expense associations", async () => {
        const mapped = await drizzle(connection).select({ amount: payments.amount, date: payments.transactionDate }).from(payments).where(eq(payments.id, fixture.payment));
        assert.deepEqual(mapped, [{ amount: "100.10", date: "2026-01-02" }]);
        await connection.execute("UPDATE expenses SET amount = ? WHERE id = ?", ["9007199254740993.01", fixture.expense]);
        const [rows] = await connection.execute<RowDataPacket[]>("SELECT amount, transaction_date, project_id, person_id, vehicle_id FROM expenses WHERE id = ?", [fixture.expense]);
        assert.equal(rows[0].amount, "9007199254740993.01");
        assert.equal(rows[0].transaction_date, "2026-01-02");
        for (const field of ["project_id", "person_id", "vehicle_id"]) assert.equal(rows[0][field], null);
        await rejectsSql("UPDATE expenses SET amount = ? WHERE id = ?", ["100000000000000000.00", fixture.expense], 1264);
        await rejectsSql("UPDATE expenses SET amount = ? WHERE id = ?", ["-0.01", fixture.expense], 3819);
        await rejectsSql("UPDATE expenses SET category_id = NULL WHERE id = ?", [fixture.expense], 1048);
        await connection.execute("UPDATE expenses SET project_id = ?, person_id = ?, vehicle_id = ? WHERE id = ?", [fixture.project, fixture.person, fixture.vehicle, fixture.expense]);
        await rejectsSql("UPDATE expenses SET person_id = ? WHERE id = ?", [randomUUID(), fixture.expense], 1452);
      });

      await t.test("project status validation and retained logical deletion/cancellation identities", async triggerTests => {
        for (const status of ["active", "suspended", "completed"]) await connection.execute("UPDATE projects SET status = ? WHERE id = ?", [status, fixture.project]);
        await rejectsSql("UPDATE projects SET status = ? WHERE id = ?", ["invalid", fixture.project], 1265);
        await connection.execute("UPDATE contract_phases SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?", [fixture.deletedPhase]);
        const [phases] = await connection.execute<RowDataPacket[]>("SELECT id, deleted_at FROM contract_phases WHERE id = ?", [fixture.deletedPhase]);
        assert.equal(phases[0].id, fixture.deletedPhase);
        assert.notEqual(phases[0].deleted_at, null);
        await rejectsSql("UPDATE payments SET status = 'cancelled' WHERE id = ?", [fixture.payment], 3819);
        await connection.execute("UPDATE payments SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(3), cancellation_reason = 'Synthetic test cancellation' WHERE id = ?", [fixture.payment]);
        await connection.execute("UPDATE expenses SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(3), cancellation_reason = 'Synthetic test cancellation' WHERE id = ?", [fixture.expense]);
        await connection.execute("UPDATE contract_phases SET description = ?, version = version + 1 WHERE id = ?", ["Synthetic corrected description", fixture.phase]);
        await connection.execute("UPDATE contracts SET status = 'active', activated_at = UTC_TIMESTAMP(3), version = version + 1 WHERE id = ?", [fixture.contract]);
        const [allocations] = await connection.execute<RowDataPacket[]>("SELECT id FROM payment_allocations WHERE payment_id = ?", [fixture.payment]);
        assert.equal(allocations[0].id, fixture.allocation);
        for (const [table, id] of [["payments", fixture.payment], ["expenses", fixture.expense], ["contracts", fixture.contract], ["contract_phases", fixture.phase], ["payment_allocations", fixture.allocation], ["payment_receipts", fixture.receipt]]) {
          assert.ok(expectedNames.includes(table));
          await triggerTests.test(`trigger ${table}_no_delete`, async () => {
            await rejectsSql(`DELETE FROM \`${table}\` WHERE id = ?`, [id], 1644);
          });
        }
      });

      await t.test("receipt corrections append versions, retain numbering, and cannot change issued content", async triggerTests => {
        await insert("receipt_versions", { id: randomUUID(), ...receiptVersion, version: 2 });
        const [rows] = await connection.execute<RowDataPacket[]>("SELECT MAX(version) AS current_version, COUNT(*) AS total FROM receipt_versions WHERE receipt_id = ?", [fixture.receipt]);
        assert.equal(Number(rows[0].current_version), 2);
        assert.equal(Number(rows[0].total), 2);
        await triggerTests.test("trigger receipt_versions_no_update", async () => {
          await rejectsSql("UPDATE receipt_versions SET storage_reference = ? WHERE id = ?", ["synthetic://modified", fixture.receiptVersion], 1644);
        });
        await triggerTests.test("trigger receipt_versions_no_delete", async () => {
          await rejectsSql("DELETE FROM receipt_versions WHERE id = ?", [fixture.receiptVersion], 1644);
        });
        await triggerTests.test("trigger payment_receipts_identity_guard", async () => {
          await rejectsSql("UPDATE payment_receipts SET receipt_number = ? WHERE id = ?", ["SYNTHETIC-CHANGED", fixture.receipt], 1644);
          await rejectsSql("UPDATE payment_receipts SET payment_id = ? WHERE id = ?", [fixture.secondPayment, fixture.receipt], 1644);
          await rejectsSql("UPDATE payment_receipts SET id = ? WHERE id = ?", [randomUUID(), fixture.receipt], 1644);
          await connection.execute("UPDATE payment_receipts SET status = 'void' WHERE id = ?", [fixture.receipt]);
        });
      });

      await t.test("history is append-only and credential/nested snapshots are rejected by MySQL", async triggerTests => {
        for (const snapshot of [{ passwordHash: "synthetic" }, { password_hash: "synthetic" }, { name: { passwordHash: "synthetic" } }]) {
          await assert.rejects(insert("audit_events", { id: randomUUID(), entity_type: "user", entity_id: fixture.user, action: "synthetic_test", after_snapshot: JSON.stringify(snapshot) }), { errno: 3819 });
          await assert.rejects(insert("entity_versions", { id: randomUUID(), entity_type: "user", entity_id: fixture.user, version: 1, snapshot: JSON.stringify(snapshot) }), { errno: 3819 });
        }
        await assert.rejects(insert("entity_versions", { id: randomUUID(), entity_type: "contract", entity_id: fixture.contract, version: 1, snapshot: "{}" }), { errno: 1062 });
        for (const [table, id] of [["audit_events", fixture.audit], ["entity_versions", fixture.entityVersion]]) {
          await triggerTests.test(`trigger ${table}_no_update`, async () => {
            await rejectsSql(`UPDATE \`${table}\` SET entity_type = ? WHERE id = ?`, ["synthetic_changed", id], 1644);
          });
          await triggerTests.test(`trigger ${table}_no_delete`, async () => {
            await rejectsSql(`DELETE FROM \`${table}\` WHERE id = ?`, [id], 1644);
          });
        }
      });

      await t.test("idempotency scope is unique and keys are case-sensitive; company counter is singular", async () => {
        await assert.rejects(insert("operation_requests", { id: randomUUID(), operation_type: "synthetic_test", idempotency_key: fixture.operation, request_fingerprint: "b".repeat(64) }), { errno: 1062 });
        await insert("operation_requests", { id: randomUUID(), operation_type: "another_synthetic_operation", idempotency_key: fixture.operation, request_fingerprint: "b".repeat(64) });
        const key = `synthetic-${randomUUID()}`;
        for (const value of [key, key.toUpperCase()]) await insert("operation_requests", { id: randomUUID(), operation_type: "synthetic_test", idempotency_key: value, request_fingerprint: "b".repeat(64) });
        const [existingCounters] = await connection.query<RowDataPacket[]>("SELECT scope FROM receipt_counters WHERE scope='company'");
        if (!existingCounters.length) await insert("receipt_counters", { scope: "company", next_number: "1" });
        await assert.rejects(insert("receipt_counters", { scope: "company", next_number: "2" }), { errno: 1062 });
        await assert.rejects(insert("receipt_counters", { scope: "project", next_number: "1" }), { errno: 3819 });
      });
    } finally { await connection.rollback(); }

    await t.test("all synthetic fixture writes were rolled back", async () => {
      const identities = [
        ["users", fixture.user], ["clients", fixture.client], ["projects", fixture.project],
        ["contracts", fixture.contract], ["contract_phases", fixture.phase], ["contract_phases", fixture.deletedPhase],
        ["payments", fixture.payment], ["payments", fixture.secondPayment], ["payment_allocations", fixture.allocation],
        ["expenses", fixture.expense], ["expense_categories", fixture.category], ["persons", fixture.person],
        ["vehicles", fixture.vehicle], ["payment_receipts", fixture.receipt], ["audit_events", fixture.audit],
        ["entity_versions", fixture.entityVersion], ["operation_requests", fixture.operation],
      ];
      for (const [table, id] of identities) {
        assert.ok(expectedNames.includes(table));
        const [rows] = await connection.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM \`${table}\` WHERE id = ?`, [id]);
        assert.equal(Number(rows[0].total), 0, table);
      }
      const [versions] = await connection.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM receipt_versions WHERE receipt_id = ?", [fixture.receipt]);
      assert.equal(Number(versions[0].total), 0);
    });

    await t.test("ordinary InnoDB commit is visible on a separate authenticated connection", async () => {
      const clientId = randomUUID();
      const projectId = randomUUID();
      const observer = await openLocalConnection(options);
      try {
        await connection.beginTransaction();
        try {
          await insert("clients", { id: clientId, type: "private_person", name: "Synthetic Commit Test" });
          await insert("projects", { id: projectId, client_id: clientId, name: "Synthetic Committed Project" });
          await connection.commit();
        } catch (error) { await connection.rollback(); throw error; }
        const [rows] = await observer.execute<RowDataPacket[]>("SELECT p.id FROM projects p JOIN clients c ON c.id = p.client_id WHERE p.id = ? AND c.id = ?", [projectId, clientId]);
        assert.equal(rows[0]?.id, projectId);
      } finally {
        await observer.end();
        // Delete only the two known synthetic, nonfinancial rows created above.
        await connection.beginTransaction();
        try {
          await connection.execute("DELETE FROM projects WHERE id = ?", [projectId]);
          await connection.execute("DELETE FROM clients WHERE id = ?", [clientId]);
          await connection.commit();
        } catch (error) { await connection.rollback(); throw error; }
      }
    });

    await t.test("foreign-key error followed by rollback leaves no partial writes", async () => {
      const clientId = randomUUID();
      const projectId = randomUUID();
      await assert.rejects(async () => {
        await connection.beginTransaction();
        try {
          await insert("clients", { id: clientId, type: "private_person", name: "Synthetic Rollback Test" });
          await insert("projects", { id: projectId, client_id: clientId, name: "Synthetic Rolled Back Project" });
          await insert("projects", { id: randomUUID(), client_id: randomUUID(), name: "Synthetic Rejected Project" });
          await connection.commit();
        } catch (error) { await connection.rollback(); throw error; }
      }, { errno: 1452 });
      for (const [table, id] of [["clients", clientId], ["projects", projectId]]) {
        const [rows] = await connection.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM \`${table}\` WHERE id = ?`, [id]);
        assert.equal(Number(rows[0].total), 0);
      }
    });
  } finally { await connection.end(); }
});
