import { sql } from "drizzle-orm";
import { char, datetime, decimal, int } from "drizzle-orm/mysql-core";
import { randomUUID } from "node:crypto";

export const id = () => char("id", { length: 36 }).primaryKey().$defaultFn(randomUUID);
export const referenceId = (name: string) => char(name, { length: 36 });
export const money = (name: string) => decimal(name, { precision: 19, scale: 2 });
export const eventTime = (name: string) => datetime(name, { mode: "string", fsp: 3 });
export const version = () => int("version", { unsigned: true }).notNull().default(1);
export const timestamps = () => ({
  createdAt: eventTime("created_at").notNull().default(sql`(UTC_TIMESTAMP(3))`),
  updatedAt: eventTime("updated_at").notNull().default(sql`(UTC_TIMESTAMP(3))`).$onUpdateFn(() => sql`UTC_TIMESTAMP(3)`),
});
export const softDelete = () => ({ deletedAt: eventTime("deleted_at") });
export const restrict = { onDelete: "restrict", onUpdate: "restrict" } as const;
