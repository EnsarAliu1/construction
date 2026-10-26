import { sql } from "drizzle-orm";
import { boolean, check, index, mysqlEnum, mysqlTable, varchar, text } from "drizzle-orm/mysql-core";
import { eventTime, id, referenceId, restrict, softDelete, timestamps, version } from "./common";
import { users } from "./identity";

export const clients = mysqlTable("clients", {
  id: id(),
  type: mysqlEnum("type", ["private_person", "business"]).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  nui: varchar("nui", { length: 100 }),
  email: varchar("email", { length: 254 }),
  phone: varchar("phone", { length: 64 }),
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  city: varchar("city", { length: 150 }),
  postalCode: varchar("postal_code", { length: 32 }),
  country: varchar("country", { length: 100 }),
  version: version(),
  createdBy: referenceId("created_by").references(() => users.id, restrict),
  updatedBy: referenceId("updated_by").references(() => users.id, restrict),
  deletedBy: referenceId("deleted_by").references(() => users.id, restrict),
  ...softDelete(),
  ...timestamps(),
}, table => [
  index("clients_name_idx").on(table.name), index("clients_deleted_idx").on(table.deletedAt),
  index("clients_type_deleted_idx").on(table.type, table.deletedAt),
  index("clients_created_by_idx").on(table.createdBy), index("clients_updated_by_idx").on(table.updatedBy), index("clients_deleted_by_idx").on(table.deletedBy),
  check("clients_version_ck", sql`${table.version} >= 1`),
]);

const referenceMetadata = () => ({
  version: version(),
  createdBy: referenceId("created_by").references(() => users.id, restrict),
  updatedBy: referenceId("updated_by").references(() => users.id, restrict),
  deactivatedAt: eventTime("deactivated_at"),
  deactivatedBy: referenceId("deactivated_by").references(() => users.id, restrict),
});

export const persons = mysqlTable("persons", {
  id: id(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 254 }),
  phone: varchar("phone", { length: 64 }),
  identificationReference: varchar("identification_reference", { length: 150 }),
  address: text("address"),
  ...referenceMetadata(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
}, table => [
  index("persons_name_idx").on(table.name), index("persons_active_name_idx").on(table.isActive, table.name),
  index("persons_created_by_idx").on(table.createdBy), index("persons_updated_by_idx").on(table.updatedBy), index("persons_deactivated_by_idx").on(table.deactivatedBy),
  check("persons_version_ck", sql`${table.version} >= 1`), check("persons_active_ck", sql`${table.isActive} IN (0, 1)`),
]);

export const vehicles = mysqlTable("vehicles", {
  id: id(),
  identifier: varchar("identifier", { length: 100 }).notNull().unique("vehicles_identifier_uq"),
  description: text("description"),
  ...referenceMetadata(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
}, table => [
  index("vehicles_active_identifier_idx").on(table.isActive, table.identifier),
  index("vehicles_created_by_idx").on(table.createdBy), index("vehicles_updated_by_idx").on(table.updatedBy), index("vehicles_deactivated_by_idx").on(table.deactivatedBy),
  check("vehicles_version_ck", sql`${table.version} >= 1`), check("vehicles_active_ck", sql`${table.isActive} IN (0, 1)`),
]);

export const expenseCategories = mysqlTable("expense_categories", {
  id: id(),
  name: varchar("name", { length: 150 }).notNull().unique("expense_categories_name_uq"),
  ...referenceMetadata(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
}, table => [
  index("categories_active_name_idx").on(table.isActive, table.name),
  index("categories_created_by_idx").on(table.createdBy), index("categories_updated_by_idx").on(table.updatedBy), index("categories_deactivated_by_idx").on(table.deactivatedBy),
  check("categories_version_ck", sql`${table.version} >= 1`), check("categories_active_ck", sql`${table.isActive} IN (0, 1)`),
]);
