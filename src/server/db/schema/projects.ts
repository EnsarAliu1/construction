import { sql } from "drizzle-orm";
import { check, date, index, int, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { eventTime, id, money, referenceId, restrict, softDelete, timestamps, version } from "./common";
import { clients } from "./parties";

export const projects = mysqlTable("projects", {
  id: id(),
  clientId: referenceId("client_id").notNull().references(() => clients.id, restrict),
  name: varchar("name", { length: 200 }).notNull(),
  location: varchar("location", { length: 255 }),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  status: mysqlEnum("status", ["active", "suspended", "completed"]).notNull().default("active"),
  ...softDelete(),
  ...timestamps(),
}, table => [
  index("projects_client_idx").on(table.clientId),
  index("projects_status_deleted_idx").on(table.status, table.deletedAt),
  check("projects_dates_ck", sql`${table.endDate} IS NULL OR ${table.startDate} IS NULL OR ${table.endDate} >= ${table.startDate}`),
]);

// A stable contract identity per project; revisions use version + entity_versions.
export const contracts = mysqlTable("contracts", {
  id: id(),
  projectId: referenceId("project_id").notNull().unique("contracts_project_uq").references(() => projects.id, restrict),
  totalValue: money("total_value").notNull(),
  version: version(),
  status: mysqlEnum("status", ["draft", "active", "cancelled"]).notNull().default("draft"),
  activatedAt: eventTime("activated_at"),
  cancelledAt: eventTime("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  ...timestamps(),
}, table => [
  check("contracts_total_ck", sql`${table.totalValue} >= 0`),
  check("contracts_version_ck", sql`${table.version} >= 1`),
]);

export const contractPhases = mysqlTable("contract_phases", {
  id: id(),
  contractId: referenceId("contract_id").notNull().references(() => contracts.id, restrict),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  value: money("value").notNull(),
  sortOrder: int("sort_order", { unsigned: true }).notNull().default(0),
  version: version(),
  ...softDelete(),
  ...timestamps(),
}, table => [
  index("phases_contract_deleted_order_idx").on(table.contractId, table.deletedAt, table.sortOrder),
  check("phases_value_ck", sql`${table.value} >= 0`),
  check("phases_version_ck", sql`${table.version} >= 1`),
]);
