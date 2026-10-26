import { sql } from "drizzle-orm";
import { check, date, index, mysqlEnum, mysqlTable, text, unique } from "drizzle-orm/mysql-core";
import { eventTime, id, money, referenceId, restrict, timestamps, version } from "./common";
import { users } from "./identity";
import { expenseCategories, persons, vehicles } from "./parties";
import { contractPhases, projects } from "./projects";

export const payments = mysqlTable("payments", {
  id: id(),
  projectId: referenceId("project_id").notNull().references(() => projects.id, restrict),
  amount: money("amount").notNull(),
  transactionDate: date("transaction_date", { mode: "string" }).notNull(),
  method: mysqlEnum("method", ["cash", "bank"]).notNull(),
  status: mysqlEnum("status", ["received", "cancelled"]).notNull().default("received"),
  cancelledAt: eventTime("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  cancelledBy: referenceId("cancelled_by").references(() => users.id, restrict),
  createdBy: referenceId("created_by").references(() => users.id, restrict),
  version: version(),
  ...timestamps(),
}, table => [
  index("payments_project_status_date_idx").on(table.projectId, table.status, table.transactionDate),
  index("payments_status_date_idx").on(table.status, table.transactionDate),
  index("payments_created_by_idx").on(table.createdBy),
  index("payments_cancelled_by_idx").on(table.cancelledBy),
  check("payments_amount_ck", sql`${table.amount} > 0`),
  check("payments_version_ck", sql`${table.version} >= 1`),
  check("payments_cancellation_ck", sql`(${table.status} = 'received' AND ${table.cancelledAt} IS NULL AND ${table.cancellationReason} IS NULL) OR (${table.status} = 'cancelled' AND ${table.cancelledAt} IS NOT NULL AND ${table.cancellationReason} IS NOT NULL)`),
]);

export const paymentAllocations = mysqlTable("payment_allocations", {
  id: id(),
  paymentId: referenceId("payment_id").notNull().references(() => payments.id, restrict),
  phaseId: referenceId("phase_id").notNull().references(() => contractPhases.id, restrict),
  amount: money("amount").notNull(),
  ...timestamps(),
}, table => [
  unique("allocations_payment_phase_uq").on(table.paymentId, table.phaseId),
  index("allocations_phase_payment_idx").on(table.phaseId, table.paymentId),
  check("allocations_amount_ck", sql`${table.amount} > 0`),
]);

export const expenses = mysqlTable("expenses", {
  id: id(),
  amount: money("amount").notNull(),
  transactionDate: date("transaction_date", { mode: "string" }).notNull(),
  categoryId: referenceId("category_id").notNull().references(() => expenseCategories.id, restrict),
  description: text("description").notNull(),
  projectId: referenceId("project_id").references(() => projects.id, restrict),
  personId: referenceId("person_id").references(() => persons.id, restrict),
  vehicleId: referenceId("vehicle_id").references(() => vehicles.id, restrict),
  status: mysqlEnum("status", ["recorded", "cancelled"]).notNull().default("recorded"),
  cancelledAt: eventTime("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  createdBy: referenceId("created_by").references(() => users.id, restrict),
  cancelledBy: referenceId("cancelled_by").references(() => users.id, restrict),
  version: version(),
  ...timestamps(),
}, table => [
  index("expenses_date_status_idx").on(table.transactionDate, table.status),
  index("expenses_project_date_idx").on(table.projectId, table.transactionDate),
  index("expenses_category_date_idx").on(table.categoryId, table.transactionDate),
  index("expenses_person_idx").on(table.personId),
  index("expenses_vehicle_idx").on(table.vehicleId),
  index("expenses_created_by_idx").on(table.createdBy),
  index("expenses_cancelled_by_idx").on(table.cancelledBy),
  check("expenses_amount_ck", sql`${table.amount} > 0`),
  check("expenses_version_ck", sql`${table.version} >= 1`),
  check("expenses_cancellation_ck", sql`(${table.status} = 'recorded' AND ${table.cancelledAt} IS NULL AND ${table.cancellationReason} IS NULL) OR (${table.status} = 'cancelled' AND ${table.cancelledAt} IS NOT NULL AND ${table.cancellationReason} IS NOT NULL)`),
]);
