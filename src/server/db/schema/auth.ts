import { sql } from "drizzle-orm";
import { char, check, index, int, mysqlTable } from "drizzle-orm/mysql-core";
import { eventTime, id, referenceId, restrict, timestamps } from "./common";
import { users } from "./identity";

export const authSessions = mysqlTable("auth_sessions", {
  id: id(),
  userId: referenceId("user_id").notNull().references(() => users.id, restrict),
  tokenHash: char("token_hash", { length: 64 }).notNull().unique("auth_sessions_token_uq"),
  userAuthVersion: int("user_auth_version", { unsigned: true }).notNull(),
  assuranceVersion: int('assurance_version',{unsigned:true}).notNull().default(0),
  mfaVerifiedAt: eventTime('mfa_verified_at'),
  expiresAt: eventTime("expires_at").notNull(),
  revokedAt: eventTime("revoked_at"),
  ...timestamps(),
}, table => [
  index("auth_sessions_user_state_idx").on(table.userId, table.revokedAt, table.expiresAt),
  index("auth_sessions_expiry_idx").on(table.expiresAt),
  check("auth_sessions_version_ck", sql`${table.userAuthVersion} >= 1`),
  check('auth_sessions_assurance_ck',sql`${table.assuranceVersion} IN (0,2)`),
  check('auth_sessions_mfa_ck',sql`(${table.assuranceVersion} = 2) = (${table.mfaVerifiedAt} IS NOT NULL)`),
]);

// One durable row serializes every operator creation/activation/deactivation.
export const authAccountControl = mysqlTable("auth_account_control", {
  scope: char("scope", { length: 7 }).primaryKey(),
}, table => [check("auth_account_control_scope_ck", sql`${table.scope} = 'company'`)]);

export const authLoginLimits = mysqlTable("auth_login_limits", {
  bucketKey: char("bucket_key", { length: 64 }).primaryKey(),
  attemptCount: int("attempt_count", { unsigned: true }).notNull(),
  windowEndsAt: eventTime("window_ends_at").notNull(),
}, table => [index("auth_login_limits_expiry_idx").on(table.windowEndsAt)]);
