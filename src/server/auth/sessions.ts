import { randomUUID } from "node:crypto";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { securityEvent, transaction } from "./store";
import { AuthenticationRequired, tokenDigest, validSessionToken, type AuthenticatedUser } from "./security";

export async function sessionUser(connection: Connection, token: string | undefined): Promise<AuthenticatedUser | null> {
  if (!validSessionToken(token)) return null;
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT u.id, u.display_name AS displayName, u.email FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP(3) AND u.status = 'active' AND u.auth_version = s.user_auth_version LIMIT 1", [tokenDigest(token)]);
  return rows.length ? { id: String(rows[0].id), displayName: String(rows[0].displayName), email: String(rows[0].email) } : null;
}

export async function requireSessionUser(connection: Connection, token: string | undefined) {
  const user = await sessionUser(connection, token);
  if (!user) throw new AuthenticationRequired();
  return user;
}

export async function revokeSession(connection: Connection, token: string | undefined) {
  if (!validSessionToken(token)) return;
  const [identity] = await connection.execute<RowDataPacket[]>("SELECT user_id AS userId FROM auth_sessions WHERE token_hash = ?", [tokenDigest(token)]);
  if (!identity.length) return;
  await transaction(connection, async () => {
    // Match login/operator lock ordering: user first, then session rows.
    await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [identity[0].userId]);
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT id, user_id AS userId, revoked_at AS revokedAt FROM auth_sessions WHERE token_hash = ? FOR UPDATE", [tokenDigest(token)]);
    if (!rows.length || rows[0].revokedAt) return;
    await connection.execute("UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE id = ?", [rows[0].id]);
    await securityEvent(connection, "logout", String(rows[0].id), String(rows[0].userId));
  });
}

export async function revokeUserSessions(connection: Connection, userId: string) {
  await connection.execute("UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND revoked_at IS NULL", [userId]);
}

export function newCorrelationId() { return randomUUID(); }
