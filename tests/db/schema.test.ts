import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { getTableConfig, type MySqlTable } from "drizzle-orm/mysql-core";
import * as schema from "../../src/server/db/schema";

const tables = Object.values(schema).map(getTableConfig);
const initialSql = readFileSync("drizzle/0000_wp02_integrity_foundation.sql", "utf8");
const guardsSql = readFileSync("drizzle/0001_wp02_history_guards.sql", "utf8");
const authSql = readFileSync("drizzle/0002_wp03_authentication.sql", "utf8");
const required = ["users", "clients", "projects", "contracts", "contract_phases", "payments", "payment_allocations", "expenses", "expense_categories", "persons", "vehicles", "payment_receipts", "receipt_versions", "receipt_counters", "audit_events", "entity_versions", "operation_requests"];

test("all required models are present, keyed and represented in the initial migration", () => {
  assert.deepEqual(tables.map(table => table.name).sort(), [...required, "auth_sessions", "auth_account_control", "auth_login_limits"].sort());
  for (const table of tables) {
    assert.ok(table.columns.some(column => column.primary) || table.primaryKeys.length);
    assert.match(required.includes(table.name) ? initialSql : authSql, new RegExp("CREATE TABLE `" + table.name + "`"));
  }
  assert.equal((initialSql.match(/ENGINE=InnoDB/g) ?? []).length, required.length);
  assert.equal((authSql.match(/ENGINE=InnoDB/g) ?? []).length, 3);
  assert.doesNotMatch(initialSql, /\b(?:float|double|real)\b/i);
});

test("all foreign keys reference a primary/unique key and restrict update/delete", () => {
  for (const table of tables) for (const key of table.foreignKeys) {
    assert.equal(key.onDelete, "restrict");
    assert.equal(key.onUpdate, "restrict");
    assert.ok(key.getName().length <= 64);
    const { columns, foreignColumns } = key.reference();
    assert.equal(columns.length, foreignColumns.length);
    for (let i = 0; i < columns.length; i++) {
      assert.equal(columns[i].getSQLType(), foreignColumns[i].getSQLType());
      assert.ok(foreignColumns[i].primary || foreignColumns[i].isUnique);
    }
    assert.match(initialSql + authSql, new RegExp("CONSTRAINT `" + key.getName() + "` FOREIGN KEY"));
  }
  assert.doesNotMatch(initialSql, /ON (?:DELETE|UPDATE) (?:CASCADE|SET NULL)/i);
});

test("financial amounts remain exact strings with DECIMAL(19,2)", () => {
  for (const column of [schema.contracts.totalValue, schema.contractPhases.value, schema.payments.amount, schema.paymentAllocations.amount, schema.expenses.amount]) {
    assert.equal(column.getSQLType(), "decimal(19,2)");
    assert.equal(column.dataType, "string");
    assert.equal(column.notNull, true);
  }
});

test("general expenses have nullable project, supplier and vehicle associations", () => {
  assert.equal(schema.expenses.projectId.notNull, false);
  assert.equal(schema.expenses.personId.notNull, false);
  assert.equal(schema.expenses.vehicleId.notNull, false);
  assert.equal(schema.expenses.categoryId.notNull, true);
  // Client is derived through project, never a required duplicate expense field.
  assert.equal("clientId" in schema.expenses, false);
});

test("critical cardinalities, uniqueness and lookup indexes are defined", () => {
  assert.equal(schema.users.email.isUnique, true);
  assert.equal(schema.contracts.projectId.isUnique, true);
  assert.equal(schema.paymentReceipts.paymentId.isUnique, true);
  assert.equal(schema.paymentReceipts.receiptNumber.isUnique, true);
  function hasUnique(table: MySqlTable, names: string[]) {
    return getTableConfig(table).uniqueConstraints.some(key => key.columns.map(column => column.name).join(",") === names.join(","));
  }
  assert.ok(hasUnique(schema.paymentAllocations, ["payment_id", "phase_id"]));
  assert.ok(hasUnique(schema.receiptVersions, ["receipt_id", "version"]));
  assert.ok(hasUnique(schema.entityVersions, ["entity_type", "entity_id", "version"]));
  assert.ok(hasUnique(schema.operationRequests, ["operation_type", "idempotency_key"]));
  assert.match(schema.operationRequests.idempotencyKey.getSQLType(), /utf8mb4_0900_bin/);
  assert.ok(getTableConfig(schema.paymentAllocations).indexes.some(index => index.config.name === "allocations_phase_payment_idx"));
  assert.deepEqual(schema.projects.status.enumValues, ["active", "suspended", "completed"]);
  assert.deepEqual(schema.payments.status.enumValues, ["received", "cancelled"]);
});

test("transaction dates and UTC event timestamps use distinct calendar/time types", () => {
  assert.equal(schema.payments.transactionDate.getSQLType(), "date");
  assert.equal(schema.expenses.transactionDate.getSQLType(), "date");
  assert.equal(schema.payments.createdAt.getSQLType(), "datetime(3)");
  assert.equal(schema.contractPhases.deletedAt.getSQLType(), "datetime(3)");
  assert.match(initialSql, /DEFAULT \(UTC_TIMESTAMP\(3\)\)/);
});

test("migrations are loadable, ordered, named and include non-destructive history guards", () => {
  const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
  assert.equal(migrations.length, 3);
  assert.ok(migrations.every((migration, index) => index === 0 || migration.folderMillis > migrations[index - 1].folderMillis));
  assert.deepEqual(migrations.slice(0, 2).map(migration => migration.hash), ["5f972707b506644f976f71bd139f74c72f9e269bfeaba63ff3ca7165572ef16c", "21a7d78e4846ea6b53224593eca961dc92edd7bc7d48a42db8b14ed1c1ce9205"]);
  assert.ok(migrations.every(migration => migration.sql.length && migration.hash.length === 64));
  assert.equal((guardsSql.match(/CREATE TRIGGER/g) ?? []).length, 13);
  assert.match(guardsSql, /receipt_versions_no_update/);
  assert.match(guardsSql, /receipt_versions_no_delete/);
  assert.match(guardsSql, /payment_receipts_identity_guard/);
  assert.doesNotMatch(initialSql + guardsSql, /\b(?:DROP|TRUNCATE)\s+(?:TABLE|DATABASE)/i);
  assert.match(initialSql, /JSON_SCHEMA_VALID/);
});
