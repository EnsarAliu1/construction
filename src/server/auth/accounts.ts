import { randomUUID } from "node:crypto";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { hashPassword } from "./password";
import { requireOperator, type OperatorContext } from "./operator";
import { ActiveAccountLimit, normalizeEmail, validEmail } from "./security";
import { securityEvent, transaction } from "./store";
import { revokeUserSessions } from "./sessions";

async function lockAccountControl(connection: Connection) {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT scope FROM auth_account_control WHERE scope = 'company' FOR UPDATE");
  if (rows.length !== 1) throw new Error("Account administration is unavailable");
}

async function requireFreeSlot(connection: Connection) {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM users WHERE status = 'active'");
  if (Number(rows[0].total) >= 5) throw new ActiveAccountLimit();
}

export async function createAccount(connection: Connection, operator: OperatorContext, input: { email: string; displayName: string; password: string; active?: boolean }) {
  requireOperator(operator);
  const email = normalizeEmail(input.email);
  const name = input.displayName.trim();
  if (!validEmail(email) || !name || name.length > 200) throw new Error("Provide a valid email and display name");
  const passwordHash = await hashPassword(input.password);
  return transaction(connection, async () => {
    await lockAccountControl(connection);
    if (input.active !== false) await requireFreeSlot(connection);
    const userId = randomUUID();
    await connection.execute("INSERT INTO users (id, display_name, email, password_hash, status) VALUES (?, ?, ?, ?, ?)", [userId, name, email, passwordHash, input.active === false ? "inactive" : "active"]);
    await securityEvent(connection, "account_created", userId, null, { status: input.active === false ? "inactive" : "active" });
    return userId;
  });
}

export async function setAccountActive(connection: Connection, operator: OperatorContext, rawEmail: string, active: boolean) {
  requireOperator(operator);
  return transaction(connection, async () => {
    await lockAccountControl(connection);
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT id, status FROM users WHERE email = ? FOR UPDATE", [normalizeEmail(rawEmail)]);
    if (!rows.length) throw new Error("Account not found");
    const userId = String(rows[0].id);
    if ((rows[0].status === "active") === active) return userId;
    if (active) await requireFreeSlot(connection);
    await connection.execute("UPDATE users SET status = ?, deactivated_at = ?, auth_version = auth_version + 1, updated_at = UTC_TIMESTAMP(3) WHERE id = ?", [active ? "active" : "inactive", active ? null : new Date().toISOString().slice(0, 23).replace("T", " "), userId]);
    await revokeUserSessions(connection, userId);
    await securityEvent(connection, active ? "account_activated" : "account_deactivated", userId, null, { status: active ? "active" : "inactive" });
    return userId;
  });
}

export async function resetAccountPassword(connection: Connection, operator: OperatorContext, rawEmail: string, password: string) {
  requireOperator(operator);
  const passwordHash = await hashPassword(password);
  return transaction(connection, async () => {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT id FROM users WHERE email = ? FOR UPDATE", [normalizeEmail(rawEmail)]);
    if (!rows.length) throw new Error("Account not found");
    const userId = String(rows[0].id);
    await connection.execute("UPDATE users SET password_hash = ?, auth_version = auth_version + 1, updated_at = UTC_TIMESTAMP(3) WHERE id = ?", [passwordHash, userId]);
    await revokeUserSessions(connection, userId);
    await securityEvent(connection, "password_reset", userId, null);
  });
}

export async function revokeAccountSessions(connection: Connection, operator: OperatorContext, rawEmail: string) {
  requireOperator(operator);
  return transaction(connection, async () => {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT id FROM users WHERE email = ? FOR UPDATE", [normalizeEmail(rawEmail)]);
    if (!rows.length) throw new Error("Account not found");
    const userId = String(rows[0].id);
    await connection.execute("UPDATE users SET auth_version = auth_version + 1, updated_at = UTC_TIMESTAMP(3) WHERE id = ?", [userId]);
    await revokeUserSessions(connection, userId);
    await securityEvent(connection, "sessions_revoked", userId, null);
  });
}
