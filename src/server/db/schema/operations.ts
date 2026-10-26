import { sql } from "drizzle-orm";
import { check, customType, index, json, mysqlEnum, mysqlTable, unique, varchar } from "drizzle-orm/mysql-core";
import { id, timestamps } from "./common";
import { safeSnapshotCheck } from "./history";
import type { HistorySnapshot } from "../history-snapshot";

const exactKey = customType<{ data: string; driverData: string }>({
  dataType: () => "varchar(128) COLLATE utf8mb4_0900_bin",
});

export const operationRequests = mysqlTable("operation_requests", {
  id: id(),
  operationType: varchar("operation_type", { length: 64 }).notNull(),
  idempotencyKey: exactKey("idempotency_key").notNull(),
  requestFingerprint: varchar("request_fingerprint", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["processing", "completed", "failed"]).notNull().default("processing"),
  resultMetadata: json("result_metadata").$type<HistorySnapshot>(),
  ...timestamps(),
}, table => [
  unique("operations_type_key_uq").on(table.operationType, table.idempotencyKey),
  index("operations_status_created_idx").on(table.status, table.createdAt),
  check("operations_key_ck", sql`CHAR_LENGTH(${table.idempotencyKey}) > 0`),
  check("operations_fingerprint_ck", sql`CHAR_LENGTH(${table.requestFingerprint}) = 64 AND ${table.requestFingerprint} REGEXP '^[0-9a-f]{64}$'`),
  safeSnapshotCheck("operations_result_safe_ck", table.resultMetadata),
]);
