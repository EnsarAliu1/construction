import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { loadLocalEnvironment, localDatabaseOptions, openLocalConnection } from "../../src/server/db/config";
import { applyMigrations } from "../../src/server/db/migrate";
import { createAccount, setAccountActive } from "../../src/server/auth/accounts";
import { authenticateOperator } from "../../src/server/auth/operator";
import { fixtureLogin as login } from "../auth/mfa-fixture";
import { tokenDigest } from "../../src/server/auth/security";

loadLocalEnvironment();
export const mysqlSkip = !process.env.TEST_DATABASE_URL ? "NOT VERIFIED: disposable MySQL is not configured" : false;
export async function clientFixture() {
  const options = localDatabaseOptions(process.env.TEST_DATABASE_URL, "test", process.env.DATABASE_DISPOSABLE);
  const connection = await openLocalConnection(options);
  const operator = authenticateOperator(process.env.ADORE_OPERATOR_KEY ?? "");
  const prefix = `Synthetic-WP04-${randomUUID()}`;
  const password = randomBytes(24).toString("base64url");
  const email = `${randomUUID()}@example.invalid`;
  const accountEmails: string[] = [];
  try {
    await applyMigrations(connection);
    const [active] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM users WHERE status = 'active'");
    assert.equal(Number(active[0].total), 0, "Clients tests require an isolated database without active accounts");
    const userId = await createAccount(connection, operator, { email, displayName: "Synthetic Clients User", password, active: true });
    accountEmails.push(email);
    for (const key of [tokenDigest("login:global"), tokenDigest(`login:email:${email}`)]) await connection.execute("UPDATE auth_login_limits SET window_ends_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND) WHERE bucket_key = ?", [key]);
    const result = await login(connection, email, password);
    assert.ok(result.ok, "Synthetic fixture account must authenticate");
    if (!result.ok) throw new Error("Synthetic authentication failed");
    return {
      connection, operator, prefix, password, email, userId, token: result.token,
      input: (extra: Record<string, unknown> = {}) => ({ type: "private_person", name: prefix, ...extra }),
      async independent<T>(work: (connection: Connection) => Promise<T>) { const client = await openLocalConnection(options); try { return await work(client); } finally { await client.end(); } },
      async anotherUser() {
        const address = `${randomUUID()}@example.invalid`;
        const id = await createAccount(connection, operator, { email: address, displayName: "Synthetic Second Clients User", password, active: true }); accountEmails.push(address);
        const result = await login(connection, address, password); assert.ok(result.ok);
        if (!result.ok) throw new Error("Second synthetic authentication failed");
        return { id, token: result.token };
      },
      async close() { try { for (const address of accountEmails) await setAccountActive(connection, operator, address, false); } finally { await connection.end(); } },
    };
  } catch (error) { try { for (const address of accountEmails) await setAccountActive(connection, operator, address, false); } finally { await connection.end(); } throw error; }
}
