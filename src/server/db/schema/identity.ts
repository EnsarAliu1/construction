import { mysqlTable, mysqlEnum, varchar, index } from "drizzle-orm/mysql-core";
import { id, eventTime, timestamps } from "./common";

export const users = mysqlTable("users", {
  id: id(),
  displayName: varchar("display_name", { length: 200 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().unique("users_email_uq"),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("inactive"),
  deactivatedAt: eventTime("deactivated_at"),
  ...timestamps(),
}, table => [index("users_status_idx").on(table.status)]);
