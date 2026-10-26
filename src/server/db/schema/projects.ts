import { sql } from "drizzle-orm";
import { check, date, index, int, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { eventTime, id, money, referenceId, restrict, softDelete, timestamps, version } from "./common";
import { clients } from "./parties";
import { users } from "./identity";

export const projects = mysqlTable("projects", {
  id: id(),
  clientId: referenceId("client_id").notNull().references(() => clients.id, restrict),
  name: varchar("name", { length: 200 }).notNull(),
  location: varchar("location", { length: 255 }),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  status: mysqlEnum("status", ["active", "suspended", "completed"]).notNull().default("active"),
  version: version(),
  createdBy: referenceId("created_by").references(() => users.id, restrict),
  updatedBy: referenceId("updated_by").references(() => users.id, restrict),
  ...softDelete(),
  ...timestamps(),
}, table => [
  index("projects_client_idx").on(table.clientId),
  index("projects_status_deleted_idx").on(table.status, table.deletedAt),
  index("projects_created_by_idx").on(table.createdBy),
  index("projects_updated_by_idx").on(table.updatedBy),
  check("projects_version_ck", sql`${table.version} >= 1`),
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
  createdBy: referenceId("created_by").references(() => users.id, restrict),
  updatedBy: referenceId("updated_by").references(() => users.id, restrict),
  ...timestamps(),
}, table => [
  index("contracts_created_by_idx").on(table.createdBy),
  index("contracts_updated_by_idx").on(table.updatedBy),
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
  createdBy: referenceId("created_by").references(() => users.id, restrict),
  updatedBy: referenceId("updated_by").references(() => users.id, restrict),
  deletedBy: referenceId("deleted_by").references(() => users.id, restrict),
  ...softDelete(),
  ...timestamps(),
}, table => [
  index("phases_contract_deleted_order_idx").on(table.contractId, table.deletedAt, table.sortOrder),
  index("phases_created_by_idx").on(table.createdBy),
  index("phases_updated_by_idx").on(table.updatedBy),
  index("phases_deleted_by_idx").on(table.deletedBy),
  check("phases_value_ck", sql`${table.value} >= 0`),
  check("phases_version_ck", sql`${table.version} >= 1`),
]);
