import { mysqlTable, mysqlEnum, varchar, index, int, check } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { id, eventTime, timestamps } from "./common";

export const users = mysqlTable("users", {
  id: id(),
  displayName: varchar("display_name", { length: 200 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().unique("users_email_uq"),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  authVersion: int("auth_version", { unsigned: true }).notNull().default(1),
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("inactive"),
  deactivatedAt: eventTime("deactivated_at"),
  ...timestamps(),
}, table => [index("users_status_idx").on(table.status), check("users_auth_version_ck", sql`${table.authVersion} >= 1`)]);
