import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { loadLocalEnvironment, localDatabaseOptions, openLocalConnection } from "../../src/server/db/config";
import { createAccount, resetAccountPassword, revokeAccountSessions, setAccountActive } from "../../src/server/auth/accounts";
import { authenticateOperator, type OperatorContext } from "../../src/server/auth/operator";
import { ActiveAccountLimit, tokenDigest } from "../../src/server/auth/security";
import {fixtureLogin as login} from "./mfa-fixture";
import { requireSessionUser, revokeSession, sessionUser } from "../../src/server/auth/sessions";
import { applyMigrations } from "../../src/server/db/migrate";

loadLocalEnvironment();

test("real authentication, sessions, operator lifecycle and concurrent account limits", {
  timeout: 60_000,
  skip: !process.env.TEST_DATABASE_URL ? "NOT VERIFIED: disposable MySQL is not configured" : false,
}, async t => {
  const options = localDatabaseOptions(process.env.TEST_DATABASE_URL, "test", process.env.DATABASE_DISPOSABLE);
  const connection = await openLocalConnection(options);
  const operator = authenticateOperator(process.env.ADORE_OPERATOR_KEY ?? "");
  const prefix = randomUUID();
  const password = randomBytes(24).toString("base64url");
  const users: string[] = [];
  const createdEmails: string[] = [];
  const secrets: string[] = [password];
  const email = `${prefix}@example.invalid`;
  async function create(emailValue: string, active = true, client: Connection = connection) {
    const id = await createAccount(client, operator, { email: emailValue, displayName: "Synthetic Authentication Test", password, active });
    users.push(id); createdEmails.push(emailValue); return id;
  }
  async function resetLimiter() {
    // Expire only the global test bucket and buckets for this suite's synthetic emails.
    const keys = [tokenDigest("login:global"), tokenDigest("mfa:global"), ...users.map(id=>tokenDigest(`mfa:verify:${id}`)), ...createdEmails.map(value => tokenDigest(`login:email:${value.toLowerCase()}`))];
    for (const key of keys) await connection.execute("UPDATE auth_login_limits SET window_ends_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND) WHERE bucket_key = ?", [key]);
  }
  async function independent<T>(work: (client: Connection) => Promise<T>) {
    const client = await openLocalConnection(options);
    try { return await work(client); } finally { await client.end(); }
  }
  try {
    await applyMigrations(connection);
    const [initial] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM users WHERE status = 'active'");
    assert.equal(Number(initial[0].total), 0, "Use an isolated database without active accounts");
    const userId = await create(email.toUpperCase());
    let token = "";

    await t.test("valid credentials use normalized email, salted hashes and a hashed session token", async () => {
      const result = await login(connection, `  ${email.toUpperCase()} `, password);
      assert.ok(result.ok, "Valid credentials must authenticate");
      if (!result.ok) return;
      token = result.token; secrets.push(token);
      const [rows] = await connection.execute<RowDataPacket[]>("SELECT u.password_hash, u.email, s.token_hash FROM users u JOIN auth_sessions s ON s.user_id = u.id WHERE u.id = ?", [userId]);
      assert.ok(String(rows[0].password_hash).startsWith("$argon2id$"));
      assert.ok(rows[0].password_hash !== password);
      assert.ok(rows[0].token_hash === tokenDigest(token) && rows[0].token_hash !== token);
      assert.equal(rows[0].email, email);
      assert.equal((await requireSessionUser(connection, token)).id, userId);
    });

    await t.test("wrong password, unknown email and disabled account share the same failure shape", async () => {
      const unknown = `${randomUUID()}@example.invalid`;
      const disabled = `${randomUUID()}@example.invalid`;
      await create(disabled, false);
      for (const [address, supplied] of [[email, "incorrect-password"], [unknown, password], [disabled, password]]) {
        const result = await login(connection, address, supplied);
        assert.deepEqual(result, { ok: false, limited: false });
      }
      await assert.rejects(requireSessionUser(connection, undefined));
    });

    await t.test("repeated attempts are limited and a later expired window permits admission", async () => {
      await resetLimiter();
      for (let i = 0; i < 5; i++) assert.ok(!(await login(connection, email, "incorrect-password")).ok);
      const limited = await login(connection, email, password);
      assert.deepEqual(limited, { ok: false, limited: true });
      await resetLimiter();
      const result = await login(connection, email, password, token);
      assert.ok(result.ok);
      if (result.ok) {
        assert.ok(result.token !== token, "Login rotates the token");
        assert.equal(await sessionUser(connection, token), null);
        token = result.token; secrets.push(token);
      }
    });

    await t.test("expiration, logout, repeated logout and invalidated-token reuse are rejected", async () => {
      await connection.execute("UPDATE auth_sessions SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND) WHERE token_hash = ?", [tokenDigest(token)]);
      assert.equal(await sessionUser(connection, token), null);
      await resetLimiter();
      const result = await login(connection, email, password);
      assert.ok(result.ok);
      if (result.ok) {
        secrets.push(result.token);
        await revokeSession(connection, result.token);
        await revokeSession(connection, result.token);
        assert.equal(await sessionUser(connection, result.token), null);
      }
    });

    await t.test("concurrent logins are bounded and produce distinct server-managed sessions", async () => {
      await resetLimiter();
      const results = await Promise.all(Array.from({ length: 8 }, () => independent(client => login(client, email, password))));
      const authenticated = results.filter(result => result.ok);
      assert.equal(authenticated.length, 5);
      assert.equal(results.filter(result => !result.ok && result.limited).length, 3);
      assert.equal(new Set(authenticated.map(result => result.ok ? result.token : "")).size, 5);
      for (const result of authenticated) if (result.ok) secrets.push(result.token);
    });

    await t.test("deactivation, reactivation and password reset invalidate previous sessions atomically", async () => {
      await resetLimiter();
      const result = await login(connection, email, password);
      assert.ok(result.ok);
      if (!result.ok) return;
      secrets.push(result.token);
      await setAccountActive(connection, operator, email, false);
      assert.equal(await sessionUser(connection, result.token), null);
      assert.ok(!(await login(connection, email, password)).ok);
      await setAccountActive(connection, operator, email, true);
      assert.equal(await sessionUser(connection, result.token), null, "Reactivation must not revive sessions");
      const current = await login(connection, email, password);
      assert.ok(current.ok);
      const replacement = randomBytes(24).toString("base64url"); secrets.push(replacement);
      await resetAccountPassword(connection, operator, email, replacement);
      if (current.ok) { secrets.push(current.token); assert.equal(await sessionUser(connection, current.token), null); }
      await resetLimiter();
      assert.ok(!(await login(connection, email, password)).ok);
      const recovered = await login(connection, email, replacement);
      assert.ok(recovered.ok);
      if (recovered.ok) {
        secrets.push(recovered.token);
        await revokeAccountSessions(connection, operator, email);
        assert.equal(await sessionUser(connection, recovered.token), null);
      }
    });

    await t.test("ordinary clients cannot administer accounts and duplicate emails are rejected", async () => {
      const forged = { kind: "client", userId } as unknown as OperatorContext;
      await assert.rejects(createAccount(connection, forged, { email: `${randomUUID()}@example.invalid`, displayName: "Unauthorized", password }));
      await assert.rejects(setAccountActive(connection, forged, email, true));
      await assert.rejects(resetAccountPassword(connection, forged, email, password));
      await assert.rejects(revokeAccountSessions(connection, forged, email));
      let rejected = false;
      try { await create(email); } catch (error) { rejected = Boolean(error && typeof error === "object" && "errno" in error && error.errno === 1062); }
      assert.ok(rejected, "Case-insensitive duplicate emails must be rejected");
    });

    await t.test("concurrent creation permits five active accounts and rejects a sixth", async () => {
      for (const address of createdEmails) await setAccountActive(connection, operator, address, false);
      const outcomes = await Promise.allSettled(Array.from({ length: 6 }, (_, index) => independent(client => create(`${prefix}-limit-${index}@example.invalid`, true, client))));
      assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 5);
      assert.ok(outcomes.filter(result => result.status === "rejected").every(result => result.reason instanceof ActiveAccountLimit));
      const [rows] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM users WHERE status = 'active'");
      assert.equal(Number(rows[0].total), 5);
    });

    await t.test("deactivation frees a slot; concurrent activations cannot overfill it", async () => {
      const [active] = await connection.query<RowDataPacket[]>("SELECT email FROM users WHERE status = 'active' ORDER BY id");
      await setAccountActive(connection, operator, String(active[0].email), false);
      const first = `${prefix}-activation-a@example.invalid`, second = `${prefix}-activation-b@example.invalid`;
      await create(first, false); await create(second, false);
      const outcomes = await Promise.allSettled([first, second].map(address => independent(client => setAccountActive(client, operator, address, true))));
      assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
      assert.ok(outcomes.filter(result => result.status === "rejected").every(result => result.reason instanceof ActiveAccountLimit));
      const [rows] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM users WHERE status = 'active'");
      assert.equal(Number(rows[0].total), 5);
    });

    await t.test("security audit records contain required events and no passwords/hashes/tokens", async () => {
      const [events] = await connection.query<RowDataPacket[]>("SELECT action, before_snapshot, after_snapshot FROM audit_events WHERE entity_type = 'authentication'");
      const actions = new Set(events.map(event => event.action));
      for (const action of ["login_success", "login_failed", "logout", "account_created", "account_deactivated", "account_activated", "password_reset", "sessions_revoked"]) assert.ok(actions.has(action), action);
      const snapshots = JSON.stringify(events);
      assert.ok(!snapshots.includes("$argon2") && !snapshots.includes("passwordHash") && !snapshots.includes("password_hash") && !snapshots.includes("token_hash"));
      assert.ok(secrets.every(value => !snapshots.includes(value)), "Security snapshots must exclude credential values");
    });
  } finally {
    // Immutable audit actors keep their identities. Deactivate only our synthetic users.
    for (const address of createdEmails) await setAccountActive(connection, operator, address, false);
    for (const id of users) {
      const [active] = await connection.execute<RowDataPacket[]>("SELECT id FROM auth_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(3)", [id]);
      assert.equal(active.length, 0);
    }
    await connection.end();
  }
});
