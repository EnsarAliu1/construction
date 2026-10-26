import { sql } from "drizzle-orm";
import { boolean, check, index, mysqlEnum, mysqlTable, varchar, text } from "drizzle-orm/mysql-core";
import { id, referenceId, restrict, softDelete, timestamps, version } from "./common";
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

export const persons = mysqlTable("persons", {
  id: id(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 254 }),
  phone: varchar("phone", { length: 64 }),
  identificationReference: varchar("identification_reference", { length: 150 }),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
}, table => [index("persons_name_idx").on(table.name)]);

export const vehicles = mysqlTable("vehicles", {
  id: id(),
  identifier: varchar("identifier", { length: 100 }).notNull().unique("vehicles_identifier_uq"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
});

export const expenseCategories = mysqlTable("expense_categories", {
  id: id(),
  name: varchar("name", { length: 150 }).notNull().unique("expense_categories_name_uq"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
});
