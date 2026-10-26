import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { getTableConfig } from "drizzle-orm/mysql-core";
import type { Connection, RowDataPacket } from "mysql2/promise";
import * as schema from "../../src/server/db/schema";

export const expectedTriggers = [
  ["receipt_versions_no_update", "receipt_versions", "UPDATE"],
  ["receipt_versions_no_delete", "receipt_versions", "DELETE"],
  ["audit_events_no_update", "audit_events", "UPDATE"],
  ["audit_events_no_delete", "audit_events", "DELETE"],
  ["entity_versions_no_update", "entity_versions", "UPDATE"],
  ["entity_versions_no_delete", "entity_versions", "DELETE"],
  ["payments_no_delete", "payments", "DELETE"],
  ["expenses_no_delete", "expenses", "DELETE"],
  ["contracts_no_delete", "contracts", "DELETE"],
  ["contract_phases_no_delete", "contract_phases", "DELETE"],
  ["payment_allocations_no_delete", "payment_allocations", "DELETE"],
  ["payment_receipts_no_delete", "payment_receipts", "DELETE"],
  ["payment_receipts_identity_guard", "payment_receipts", "UPDATE"],
] as const;

/** Compare the real server metadata with the application's declared schema. */
export async function verifyDatabaseSchema(connection: Connection) {
  const configs = Object.values(schema).map(getTableConfig);
  const [tables] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME");
  const [columns] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS columnType, IS_NULLABLE AS nullable, COLLATION_NAME AS collation, NUMERIC_PRECISION AS numericPrecision, NUMERIC_SCALE AS numericScale FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION");
  const [indexes] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME AS tableName, INDEX_NAME AS name, NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS position, COLUMN_NAME AS columnName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX");
  const [foreignKeys] = await connection.query<RowDataPacket[]>("SELECT k.TABLE_NAME AS tableName, k.CONSTRAINT_NAME AS name, k.COLUMN_NAME AS columnName, k.REFERENCED_TABLE_NAME AS foreignTable, k.REFERENCED_COLUMN_NAME AS foreignColumn, r.UPDATE_RULE AS updateRule, r.DELETE_RULE AS deleteRule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA AND k.TABLE_NAME = r.TABLE_NAME AND k.CONSTRAINT_NAME = r.CONSTRAINT_NAME WHERE k.CONSTRAINT_SCHEMA = DATABASE() ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION");
  const [checks] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME AS tableName, CONSTRAINT_NAME AS name, ENFORCED AS enforced FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'CHECK' ORDER BY TABLE_NAME, CONSTRAINT_NAME");
  const [triggers] = await connection.query<RowDataPacket[]>("SELECT TRIGGER_NAME AS name, EVENT_OBJECT_TABLE AS tableName, EVENT_MANIPULATION AS event, ACTION_TIMING AS timing, ACTION_STATEMENT AS statement FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() ORDER BY TRIGGER_NAME");
  assert.deepEqual(tables.map(table => table.name).sort(), [...configs.map(table => table.name), "__drizzle_migrations"].sort());
  assert.ok(tables.every(table => table.engine === "InnoDB"));

  function verifyIndex(tableName: string, name: string, names: string[], unique: boolean) {
    const actual = indexes.filter(index => index.tableName === tableName && index.name === name);
    assert.deepEqual(actual.map(index => index.columnName), names, `${tableName}.${name}: index columns`);
    assert.ok(actual.every(index => Number(index.nonUnique) === (unique ? 0 : 1)), `${tableName}.${name}: index uniqueness`);
  }

  let expectedForeignKeys = 0;
  let expectedChecks = 0;
  for (const table of configs) {
    const actualColumns = columns.filter(column => column.tableName === table.name);
    assert.deepEqual(actualColumns.map(column => column.name).sort(), table.columns.map(column => column.name).sort());
    for (const column of table.columns) {
      const actual = actualColumns.find(candidate => candidate.name === column.name)!;
      const expectedType = column.getSQLType().replace(/ COLLATE .*/i, "").replace(/^boolean$/, "tinyint(1)").toLowerCase();
      assert.equal(actual.columnType, expectedType, `${table.name}.${column.name}: SQL type`);
      assert.equal(actual.nullable, column.notNull ? "NO" : "YES", `${table.name}.${column.name}: nullability`);
      if (expectedType === "decimal(19,2)") {
        assert.equal(Number(actual.numericPrecision), 19);
        assert.equal(Number(actual.numericScale), 2);
      }
      if (column.isUnique) verifyIndex(table.name, column.uniqueName!, [column.name], true);
    }
    verifyIndex(table.name, "PRIMARY", table.columns.filter(column => column.primary).map(column => column.name), true);
    for (const index of table.indexes) {
      const names = index.config.columns.map(column => {
        assert.ok("name" in column, "Expression indexes need explicit inspection support");
        return String(column.name);
      });
      verifyIndex(table.name, index.config.name, names, Boolean(index.config.unique));
    }
    for (const unique of table.uniqueConstraints) verifyIndex(table.name, unique.getName()!, unique.columns.map(column => column.name), true);
    for (const key of table.foreignKeys) {
      expectedForeignKeys++;
      const reference = key.reference();
      const actual = foreignKeys.filter(candidate => candidate.tableName === table.name && candidate.name === key.getName());
      assert.deepEqual(actual.map(row => row.columnName), reference.columns.map(column => column.name));
      assert.deepEqual(actual.map(row => row.foreignColumn), reference.foreignColumns.map(column => column.name));
      assert.ok(actual.every(row => row.foreignTable === getTableConfig(reference.foreignTable).name && row.updateRule === "RESTRICT" && row.deleteRule === "RESTRICT"));
    }
    for (const check of table.checks) {
      expectedChecks++;
      assert.ok(checks.some(actual => actual.tableName === table.name && actual.name === check.name && actual.enforced === "YES"), `${check.name}: enforced check`);
    }
  }
  assert.equal(foreignKeys.length, expectedForeignKeys);
  assert.equal(checks.length, expectedChecks);
  assert.equal(columns.find(column => column.tableName === "operation_requests" && column.name === "idempotency_key")?.collation, "utf8mb4_0900_bin");
  assert.equal(triggers.length, expectedTriggers.length);
  for (const [name, tableName, event] of expectedTriggers) assert.ok(triggers.some(trigger => trigger.name === name && trigger.tableName === tableName && trigger.event === event && trigger.timing === "BEFORE"), `${name}: trigger metadata`);

  return {
    tables: configs.length,
    foreignKeys: foreignKeys.length,
    indexes: new Set(indexes.filter(index => index.tableName !== "__drizzle_migrations").map(index => `${index.tableName}.${index.name}`)).size,
    checks: checks.length,
    triggers: triggers.length,
    fingerprint: createHash("sha256").update(JSON.stringify({ tables, columns, indexes, foreignKeys, checks, triggers })).digest("hex"),
  };
}
