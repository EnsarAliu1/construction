import { sql } from "drizzle-orm";
import { bigint, check, index, json, mysqlEnum, mysqlTable, text, unique, varchar } from "drizzle-orm/mysql-core";
import { eventTime, id, referenceId, restrict, timestamps, version } from "./common";
import { payments } from "./finance";
import { users } from "./identity";
import { safeSnapshotCheck } from "./history";
import type { HistorySnapshot } from "../history-snapshot";

export const paymentReceipts = mysqlTable("payment_receipts", {
  id: id(),
  paymentId: referenceId("payment_id").notNull().unique("receipts_payment_uq").references(() => payments.id, restrict),
  receiptNumber: varchar("receipt_number", { length: 64 }).notNull().unique("receipts_number_uq"),
  status: mysqlEnum("status", ["draft", "issued", "void"]).notNull().default("draft"),
  version: version(),
  createdBy: referenceId("created_by").references(() => users.id, restrict),
  updatedBy: referenceId("updated_by").references(() => users.id, restrict),
  cancelledBy: referenceId("cancelled_by").references(() => users.id, restrict),
  cancelledAt: eventTime("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  ...timestamps(),
},table=>[
  index("receipts_created_by_idx").on(table.createdBy),
  index("receipts_updated_by_idx").on(table.updatedBy),
  index("receipts_cancelled_by_idx").on(table.cancelledBy),
  check("receipts_version_ck",sql`${table.version} >= 1`),
]);

// Current version is the maximum version for this receipt, not a circular parent FK.
export const receiptVersions = mysqlTable("receipt_versions", {
  id: id(),
  receiptId: referenceId("receipt_id").notNull().references(() => paymentReceipts.id, restrict),
  version: version(),
  contentSnapshot: json("content_snapshot").$type<HistorySnapshot>().notNull(),
  storageReference: varchar("storage_reference", { length: 512 }).notNull(),
  fileChecksum: varchar("file_checksum", { length: 64 }).notNull(),
  issuedAt: eventTime("issued_at").notNull(),
  issuedBy: referenceId("issued_by").references(() => users.id, restrict),
}, table => [
  unique("receipt_versions_receipt_version_uq").on(table.receiptId, table.version),
  index("receipt_versions_issuer_idx").on(table.issuedBy),
  check("receipt_versions_version_ck", sql`${table.version} >= 1`),
  check("receipt_versions_checksum_ck", sql`CHAR_LENGTH(${table.fileChecksum}) = 64 AND ${table.fileChecksum} REGEXP '^[0-9a-f]{64}$'`),
  safeSnapshotCheck("receipt_versions_safe_ck", table.contentSnapshot),
]);

export const receiptCounters = mysqlTable("receipt_counters", {
  scope: varchar("scope", { length: 32 }).primaryKey().default("company"),
  nextNumber: bigint("next_number", { mode: "bigint", unsigned: true }).notNull().default(sql`1`),
  ...timestamps(),
}, table => [
  check("receipt_counters_scope_ck", sql`${table.scope} = 'company'`),
  check("receipt_counters_next_ck", sql`${table.nextNumber} >= 1`),
]);
