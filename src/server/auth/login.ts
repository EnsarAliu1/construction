import { randomUUID } from "node:crypto";
import type { Connection } from "mysql2/promise";
import { verifyPassword } from "./password";
import { admitLogin } from "./rate-limit";
import { normalizeEmail, validEmail, tokenDigest } from "./security";
import { securityEvent, transaction } from "./store";
import {authUsers,authReadLock,lockAuthUser,authUserQuery} from "./user-version";
import {passwordChallenge} from "./mfa";

type LoginResult = { ok: false; limited: boolean } | { ok: true; token: string; state: "enroll"|"verify"|"ack" };

export async function login(connection: Connection, rawEmail: string, password: string, previousToken?: string): Promise<LoginResult> {
  const email = normalizeEmail(rawEmail);
  const operationId = randomUUID();
  if (!await admitLogin(connection, email.slice(0, 254))) {
    await securityEvent(connection, "login_failed", operationId, null, { status: "rate_limited" });
    return { ok: false, limited: true };
  }
  const [rows] = validEmail(email) ? await authUserQuery(connection,`SELECT id, password_hash AS passwordHash, status, auth_version AS authVersion FROM ${authUsers(connection)} WHERE email = ? LIMIT 1`, [email]) : [[]];
  const candidate = rows[0];
  const matches = await verifyPassword(password, candidate?.passwordHash);
  if (!matches || !candidate || candidate.status !== "active") {
    await securityEvent(connection, "login_failed", operationId, null, { status: "invalid_credentials" });
    return { ok: false, limited: false };
  }
  return transaction(connection, async () => {
    await lockAuthUser(connection,String(candidate.id));
    const [current] = await authUserQuery(connection,`SELECT status, password_hash AS passwordHash, auth_version AS authVersion FROM ${authUsers(connection)} WHERE id = ? ${authReadLock(connection)}`, [candidate.id]);
    if (!current.length || current[0].status !== "active" || current[0].passwordHash !== candidate.passwordHash || current[0].authVersion !== candidate.authVersion) {
      await securityEvent(connection, "login_failed", operationId, null, { status: "invalid_credentials" });
      return { ok: false, limited: false };
    }
    // Password verification creates only an isolated five-minute MFA challenge.
    if (previousToken) await connection.execute("UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE token_hash = ? AND user_id = ? AND revoked_at IS NULL", [tokenDigest(previousToken), candidate.id]);
    return passwordChallenge(connection, String(candidate.id), Number(candidate.authVersion));
  });
}
