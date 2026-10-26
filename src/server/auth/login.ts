import { randomUUID } from "node:crypto";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { verifyPassword } from "./password";
import { admitLogin } from "./rate-limit";
import { normalizeEmail, validEmail, newSessionToken, SESSION_SECONDS, tokenDigest } from "./security";
import { securityEvent, transaction } from "./store";

type LoginResult = { ok: false; limited: boolean } | { ok: true; token: string };

export async function login(connection: Connection, rawEmail: string, password: string, previousToken?: string): Promise<LoginResult> {
  const email = normalizeEmail(rawEmail);
  const operationId = randomUUID();
  if (!await admitLogin(connection, email.slice(0, 254))) {
    await securityEvent(connection, "login_failed", operationId, null, { status: "rate_limited" });
    return { ok: false, limited: true };
  }
  const [rows] = validEmail(email) ? await connection.execute<RowDataPacket[]>("SELECT id, password_hash AS passwordHash, status, auth_version AS authVersion FROM users WHERE email = ? LIMIT 1", [email]) : [[]];
  const candidate = rows[0];
  const matches = await verifyPassword(password, candidate?.passwordHash);
  if (!matches || !candidate || candidate.status !== "active") {
    await securityEvent(connection, "login_failed", operationId, null, { status: "invalid_credentials" });
    return { ok: false, limited: false };
  }
  return transaction(connection, async () => {
    const [current] = await connection.execute<RowDataPacket[]>("SELECT status, password_hash AS passwordHash, auth_version AS authVersion FROM users WHERE id = ? FOR UPDATE", [candidate.id]);
    if (!current.length || current[0].status !== "active" || current[0].passwordHash !== candidate.passwordHash || current[0].authVersion !== candidate.authVersion) {
      await securityEvent(connection, "login_failed", operationId, null, { status: "invalid_credentials" });
      return { ok: false, limited: false };
    }
    const token = newSessionToken();
    const sessionId = randomUUID();
    // Login always issues a new token; an existing session is never adopted.
    if (previousToken) await connection.execute("UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE token_hash = ? AND user_id = ? AND revoked_at IS NULL", [tokenDigest(previousToken), candidate.id]);
    await connection.execute("INSERT INTO auth_sessions (id, user_id, token_hash, user_auth_version, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND))", [sessionId, candidate.id, tokenDigest(token), candidate.authVersion, SESSION_SECONDS]);
    await securityEvent(connection, "login_success", sessionId, String(candidate.id));
    return { ok: true, token };
  });
}
