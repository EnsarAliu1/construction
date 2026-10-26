import { sql } from "drizzle-orm";
import { check, index, json, mysqlTable, unique, varchar, type AnyMySqlColumn } from "drizzle-orm/mysql-core";
import { eventTime, id, referenceId, restrict, version } from "./common";
import { users } from "./identity";
import { historyJsonSchema, type HistorySnapshot } from "../history-snapshot";

export function safeSnapshotCheck(name: string, column: AnyMySqlColumn) {
  // The JSON schema is a fixed code constant, never user input.
  const literal = sql.raw(`'${JSON.stringify(historyJsonSchema).replaceAll("'", "''")}'`);
  return check(name, sql`JSON_SCHEMA_VALID(${literal}, ${column})`);
}

export const auditEvents = mysqlTable("audit_events", {
  id: id(),
  actorId: referenceId("actor_id").references(() => users.id, restrict),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: referenceId("entity_id").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  beforeSnapshot: json("before_snapshot").$type<HistorySnapshot>(),
  afterSnapshot: json("after_snapshot").$type<HistorySnapshot>(),
  recordedAt: eventTime("recorded_at").notNull().default(sql`(UTC_TIMESTAMP(3))`),
  operationId: referenceId("operation_id"),
}, table => [
  index("audit_entity_recorded_idx").on(table.entityType, table.entityId, table.recordedAt),
  index("audit_actor_recorded_idx").on(table.actorId, table.recordedAt),
  index("audit_operation_idx").on(table.operationId),
  safeSnapshotCheck("audit_before_safe_ck", table.beforeSnapshot),
  safeSnapshotCheck("audit_after_safe_ck", table.afterSnapshot),
]);

export const entityVersions = mysqlTable("entity_versions", {
  id: id(),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: referenceId("entity_id").notNull(),
  version: version(),
  snapshot: json("snapshot").$type<HistorySnapshot>().notNull(),
  recordedAt: eventTime("recorded_at").notNull().default(sql`(UTC_TIMESTAMP(3))`),
}, table => [
  unique("entity_versions_identity_uq").on(table.entityType, table.entityId, table.version),
  check("entity_versions_version_ck", sql`${table.version} >= 1`),
  safeSnapshotCheck("entity_versions_safe_ck", table.snapshot),
]);
