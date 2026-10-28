import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { localDatabaseOptions, openLocalConnection } from '../../src/server/db/config';
import { applyMigrations } from '../../src/server/db/migrate';
import { createAccount, setAccountActive, revokeAccountSessions, resetAccountPassword } from '../../src/server/auth/accounts';
import { authenticateOperator, type OperatorContext } from '../../src/server/auth/operator';
import { login } from '../../src/server/auth/login';
import { sessionUser, requireSessionUser, revokeSession } from '../../src/server/auth/sessions';
import { startEnrollment, proveEnrollment, acknowledgeCodes, verifyMfa, challengeStatus, beginFactorChange, resetMfa, cancelMfa } from '../../src/server/auth/mfa';
import { authenticator } from '../../src/server/auth/mfa-crypto';
import { newSessionToken, tokenDigest } from '../../src/server/auth/security';
import { assertMfaFixture } from './mfa-fixture';
test('mandatory MFA migration, lifecycle, atomic replay/recovery and operator boundaries on real MySQL', { skip: !process.env.TEST_DATABASE_URL, timeout: 180000 }, async (t) => {
    assertMfaFixture();
    assert.equal(process.env.AUTH_TEST_WORK_PACKAGE, 'WP-16');
    const options = localDatabaseOptions(process.env.TEST_DATABASE_URL, 'test', '1');
    assert.equal(options.database, 'fitimi_test_wp16');
    // Exercise an actual nine-migration database -> additive mandatory-MFA transition, using unchanged SQL bytes.
    const reset = spawnSync(process.execPath, ['scripts/mfa/lab.mjs', 'reset'], { encoding: 'utf8', windowsHide: true });
    assert.equal(reset.status, 0);
    const c = await openLocalConnection(options), operator = authenticateOperator(process.env.ADORE_OPERATOR_KEY!);
    let count = 0;
    type User = {
        id: string;
        email: string;
        password: string;
    };
    async function fresh() { const email = randomUUID() + '@example.invalid', password = randomBytes(24).toString('base64url'), id = await createAccount(c, operator, { email, password, displayName: 'Synthetic MFA test', active: true }); return { id, email, password }; }
    async function clearLimits() { await c.query('UPDATE auth_login_limits SET window_ends_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND)'); }
    async function begin(u: User, connection = c) {
        const r = await login(connection, u.email, u.password);
        assert(r.ok);
        if (!r.ok)
            throw new Error('Synthetic password challenge failed.');
        return r;
    }
    async function enroll(u: User) {
        const ch = await begin(u), setup = await startEnrollment(c, ch.token);
        assert(setup.ok && setup.seed);
        if (!setup.ok || !setup.seed)
            throw new Error('Setup failed.');
        const proof = await proveEnrollment(c, ch.token, authenticator(setup.seed).generate());
        assert(proof.ok && proof.codes);
        if (!proof.ok || !proof.codes)
            throw new Error('Proof failed.');
        const done = await acknowledgeCodes(c, ch.token, 'saved');
        assert(done.ok && done.token);
        if (!done.ok || !done.token)
            throw new Error('Acknowledgement failed.');
        return { seed: setup.seed, codes: proof.codes, token: done.token };
    }
    async function independent<T>(work: (connection: Connection) => Promise<T>) {
        const other = await openLocalConnection(options);
        try {
            return await work(other);
        }
        finally {
            await other.end();
        }
    }
    async function scenario(name: string, work: (u: User) => Promise<void>) {
        await t.test(name, async () => {
            await clearLimits();
            const u = await fresh();
            try {
                await work(u);
                count++;
            }
            finally {
                await setAccountActive(c, operator, u.email, false);
            }
        });
    }
    try {
        await t.test('real legacy migration revokes password-only cookies and preserves all thirteen original triggers', async () => {
            const folder = 'artifacts/wp16/legacy-migrations';
            await mkdir(folder + '/meta', { recursive: true });
            const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'));
            journal.entries = journal.entries.slice(0, 9);
            await writeFile(folder + '/meta/_journal.json', JSON.stringify(journal));
            for (const row of journal.entries)
                await copyFile('drizzle/' + row.tag + '.sql', folder + '/' + row.tag + '.sql');
            await migrate(drizzle(c), { migrationsFolder: folder, migrationsTable: '__drizzle_migrations' });
            const u = await fresh(), token = newSessionToken();
            await c.execute('INSERT INTO auth_sessions(id,user_id,token_hash,user_auth_version,expires_at) VALUES(?,?,?,1,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 8 HOUR))', [randomUUID(), u.id, tokenDigest(token)]);
            await applyMigrations(c);
            assert.equal(await sessionUser(c, token), null);
            const [old] = await c.query<RowDataPacket[]>('SELECT s.revoked_at,s.assurance_version,u.auth_version FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?', [tokenDigest(token)]);
            assert(old[0].revoked_at);
            assert.equal(old[0].assurance_version, 0);
            assert.equal(old[0].auth_version, 2);
            const [triggers] = await c.query<RowDataPacket[]>('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()');
            assert.equal(triggers.length, 13);
            await setAccountActive(c, operator, u.email, false);
        });
        await scenario('password-only/pre-MFA token has no business/session access and cannot masquerade as an MFA assurance field', async (u) => { const ch = await begin(u); assert.equal(ch.state, 'enroll'); assert.equal(await sessionUser(c, ch.token), null); await assert.rejects(requireSessionUser(c, ch.token)); assert(!(await verifyMfa(c, newSessionToken(), '000000')).ok); const [sessions] = await c.query<RowDataPacket[]>('SELECT id FROM auth_sessions WHERE user_id=?', [u.id]); assert.equal(sessions.length, 0); });
        await scenario('seed is displayed once; proof and saved-code acknowledgement are required; seeds/verifiers are not plaintext', async (u) => {
            const ch = await begin(u), setup = await startEnrollment(c, ch.token);
            assert(setup.ok && setup.seed);
            if (!setup.ok || !setup.seed)
                return;
            assert(!(await startEnrollment(c, ch.token)).ok);
            assert(!(await acknowledgeCodes(c, ch.token, 'saved')).ok);
            assert.equal(await sessionUser(c, ch.token), null);
            const valid = authenticator(setup.seed).generate();
            assert(!(await proveEnrollment(c, ch.token, valid === '000000' ? '111111' : '000000')).ok);
            const proof = await proveEnrollment(c, ch.token, valid);
            assert(proof.ok && proof.codes);
            if (!proof.ok || !proof.codes)
                return;
            assert(!(await proveEnrollment(c, ch.token, valid)).ok);
            assert.equal(await sessionUser(c, ch.token), null);
            assert(!(await acknowledgeCodes(c, ch.token, 'ignored')).ok);
            const done = await acknowledgeCodes(c, ch.token, 'saved');
            assert(done.ok && done.token);
            if (!done.ok || !done.token)
                return;
            assert(await sessionUser(c, done.token));
            assert.notEqual(done.token, ch.token);
            assert(!(await acknowledgeCodes(c, ch.token, 'saved')).ok);
            const [f] = await c.query<RowDataPacket[]>('SELECT * FROM auth_mfa_factors WHERE user_id=?', [u.id]), [codes] = await c.query<RowDataPacket[]>('SELECT * FROM auth_mfa_recovery_codes WHERE user_id=?', [u.id]), [history] = await c.query<RowDataPacket[]>('SELECT after_snapshot FROM audit_events WHERE actor_id=?', [u.id]);
            assert.equal(codes.length, 16);
            for (const secret of [setup.seed, ...proof.codes, ch.token, done.token]) {
                assert(!JSON.stringify(f).includes(secret));
                assert(!JSON.stringify(codes).includes(secret));
                assert(!JSON.stringify(history).includes(secret));
            }
        });
        await scenario('concurrent enrollment has one active factor and one acknowledged full-session winner', async (u) => {
            const a = await begin(u), b = await begin(u), sa = await startEnrollment(c, a.token), sb = await startEnrollment(c, b.token);
            assert(sa.ok && sa.seed && sb.ok && sb.seed);
            if (!sa.ok || !sa.seed || !sb.ok || !sb.seed)
                return;
            assert((await proveEnrollment(c, a.token, authenticator(sa.seed).generate())).ok);
            assert((await proveEnrollment(c, b.token, authenticator(sb.seed).generate())).ok);
            const results = await Promise.all([a, b].map(ch => independent(other => acknowledgeCodes(other, ch.token, 'saved'))));
            assert.equal(results.filter(r => r.ok).length, 1);
            const [f] = await c.query<RowDataPacket[]>('SELECT id FROM auth_mfa_factors WHERE user_id=?', [u.id]);
            assert.equal(f.length, 1);
        });
        await scenario('enrollment code is already spent; two simultaneous accepted-step submissions have one winner', async (u) => {
            const f = await enroll(u), a = await begin(u), b = await begin(u);
            assert(!(await verifyMfa(c, a.token, authenticator(f.seed).generate())).ok);
            const code = authenticator(f.seed).generate({ timestamp: Date.now() + 30000 });
            const outcomes = await Promise.all([a, b].map(ch => independent(other => verifyMfa(other, ch.token, code))));
            assert.equal(outcomes.filter(r => r.ok).length, 1);
            const success = outcomes.find(r => r.ok)!;
            assert(success.ok && success.token);
            assert(!(await verifyMfa(c, a.token, code)).ok);
            assert(!(await verifyMfa(c, b.token, code)).ok);
        });
        await scenario('recovery is password-bound and concurrent code reuse has exactly one winner', async (u) => {
            const f = await enroll(u), a = await begin(u), b = await begin(u);
            assert(!(await verifyMfa(c, newSessionToken(), f.codes[0], true)).ok);
            const results = await Promise.all([a, b].map(ch => independent(other => verifyMfa(other, ch.token, f.codes[0], true))));
            assert.equal(results.filter(r => r.ok).length, 1);
            assert(!(await verifyMfa(c, b.token, f.codes[0], true)).ok);
            const [rows] = await c.query<RowDataPacket[]>('SELECT id FROM auth_mfa_recovery_codes WHERE user_id=? AND used_at IS NOT NULL', [u.id]);
            assert.equal(rows.length, 1);
        });
        await scenario('five-attempt challenge and ten-attempt account limits cannot be reset with fresh password challenges', async (u) => {
            const f = await enroll(u);
            let ch = await begin(u);
            const correct = authenticator(f.seed).generate(), wrong = correct === '000000' ? '111111' : '000000';
            for (let i = 0; i < 5; i++)
                assert(!(await verifyMfa(c, ch.token, wrong)).ok);
            const capped = await verifyMfa(c, ch.token, f.codes[0], true);
            assert(!capped.ok && capped.limited);
            ch = await begin(u);
            for (let i = 0; i < 4; i++)
                assert(!(await verifyMfa(c, ch.token, wrong)).ok);
            const freshChallenge = await begin(u), limited = await verifyMfa(c, freshChallenge.token, f.codes[0], true);
            assert(!limited.ok && limited.limited);
            for (let retry = 0; retry < 20; retry++)
                assert(!(await verifyMfa(c, freshChallenge.token, f.codes[0], true)).ok);
            const [throttleLogs] = await c.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM audit_events WHERE actor_id=? AND action='mfa_throttled'", [u.id]);
            assert(Number(throttleLogs[0].n) <= 2);
        });
        await scenario('expired, account-disabled and operator-revoked challenges cannot consume recovery codes or issue sessions', async (u) => {
            const f = await enroll(u);
            let ch = await begin(u);
            await c.execute('UPDATE auth_mfa_challenges SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE token_hash=?', [tokenDigest(ch.token)]);
            assert(!(await verifyMfa(c, ch.token, f.codes[0], true)).ok);
            ch = await begin(u);
            await setAccountActive(c, operator, u.email, false);
            assert(!(await verifyMfa(c, ch.token, f.codes[0], true)).ok);
            await setAccountActive(c, operator, u.email, true);
            ch = await begin(u);
            await revokeAccountSessions(c, operator, u.email);
            assert(!(await verifyMfa(c, ch.token, f.codes[0], true)).ok);
            const [used] = await c.query<RowDataPacket[]>('SELECT id FROM auth_mfa_recovery_codes WHERE user_id=? AND used_at IS NOT NULL', [u.id]);
            assert.equal(used.length, 0);
        });
        await scenario('operator reset requires a real capability, independent-identity attestation, structured reason and explicit confirmation', async (u) => {
            const f = await enroll(u), pending = await begin(u), input = { reason: 'lost-authenticator-and-codes', identityVerified: true, confirmation: 'reset-mfa' };
            await assert.rejects(resetMfa(c, { kind: 'adore_operator' } as unknown as OperatorContext, u.email, input));
            for (const invalid of [{ ...input, identityVerified: false }, { ...input, confirmation: 'yes' }, { ...input, reason: 'raw secrets must not enter a reason log' }])
                await assert.rejects(resetMfa(c, operator, u.email, invalid));
            await c.execute('UPDATE auth_mfa_factors SET restore_hold=1 WHERE user_id=?', [u.id]);
            assert.equal(await sessionUser(c, f.token), null);
            assert(!(await login(c, u.email, u.password)).ok);
            assert(!(await verifyMfa(c, pending.token, f.codes[0], true)).ok);
            await assert.rejects(resetMfa(c, operator, u.email, input));
            const oldPassword = u.password;
            u.password = randomBytes(24).toString('base64url');
            await resetMfa(c, operator, u.email, { ...input, reason: 'verified-disaster-recovery', newPassword: u.password });
            assert(!(await login(c, u.email, oldPassword)).ok);
            assert.equal(await sessionUser(c, f.token), null);
            assert(!(await verifyMfa(c, pending.token, f.codes[0], true)).ok);
            const [factors] = await c.query<RowDataPacket[]>('SELECT id FROM auth_mfa_factors WHERE user_id=?', [u.id]);
            assert.equal(factors.length, 0);
            const ch = await begin(u);
            assert.equal(ch.state, 'enroll');
            assert(!(await verifyMfa(c, ch.token, f.codes[0], true)).ok);
            assert.equal(await sessionUser(c, ch.token), null);
        });
        await scenario('factor replacement requires password plus current OTP, preserves old factor until new proof/ack, then revokes it', async (u) => {
            const f = await enroll(u), code = authenticator(f.seed).generate({ timestamp: Date.now() + 30000 });
            assert(!(await beginFactorChange(c, f.token, 'wrong', code, 'replace')).ok);
            await assert.rejects(beginFactorChange(c, newSessionToken(), u.password, code, 'replace'));
            const changed = await beginFactorChange(c, f.token, u.password, code, 'replace');
            assert(changed.ok && changed.token);
            if (!changed.ok || !changed.token)
                return;
            assert(await sessionUser(c, f.token));
            const setup = await startEnrollment(c, changed.token);
            assert(setup.ok && setup.seed);
            if (!setup.ok || !setup.seed)
                return;
            assert.notEqual(setup.seed, f.seed);
            assert(!(await acknowledgeCodes(c, changed.token, 'saved')).ok);
            assert((await proveEnrollment(c, changed.token, authenticator(setup.seed).generate())).ok);
            const done = await acknowledgeCodes(c, changed.token, 'saved');
            assert(done.ok && done.token);
            assert.equal(await sessionUser(c, f.token), null);
            const ch = await begin(u);
            assert(!(await verifyMfa(c, ch.token, f.codes[0], true)).ok);
            assert((await verifyMfa(c, ch.token, authenticator(setup.seed).generate({ timestamp: Date.now() + 30000 }))).ok);
        });
        await scenario('recovery-code regeneration has fresh step-up and replaces old codes without disabling mandatory MFA', async (u) => {
            const f = await enroll(u), r = await beginFactorChange(c, f.token, u.password, authenticator(f.seed).generate({ timestamp: Date.now() + 30000 }), 'codes');
            assert(r.ok && r.codes && r.token);
            if (!r.ok || !r.codes || !r.token)
                return;
            assert((await acknowledgeCodes(c, r.token, 'saved')).ok);
            const ch = await begin(u);
            assert(!(await verifyMfa(c, ch.token, f.codes[0], true)).ok);
            assert((await verifyMfa(c, ch.token, r.codes[0], true)).ok);
        });
        await scenario('individual source-session revocation blocks a pending factor change', async (u) => {
            const f = await enroll(u), r = await beginFactorChange(c, f.token, u.password, authenticator(f.seed).generate({ timestamp: Date.now() + 30000 }), 'replace');
            assert(r.ok && r.token);
            if (!r.ok || !r.token)
                return;
            await revokeSession(c, f.token);
            assert(!(await startEnrollment(c, r.token)).ok);
        });
        await scenario('missing keys fail new challenges closed; password reset and cancellation invalidate pending state', async (u) => {
            const f = await enroll(u), ring = process.env.MFA_ENCRYPTION_KEYS;
            try {
                delete process.env.MFA_ENCRYPTION_KEYS;
                await assert.rejects(begin(u));
            }
            finally {
                process.env.MFA_ENCRYPTION_KEYS = ring;
            }
            let ch = await begin(u);
            await resetAccountPassword(c, operator, u.email, randomBytes(24).toString('base64url'));
            assert(!(await verifyMfa(c, ch.token, f.codes[0], true)).ok);
            assert.equal(await sessionUser(c, f.token), null);
            u.password = randomBytes(24).toString('base64url');
            await resetAccountPassword(c, operator, u.email, u.password);
            ch = await begin(u);
            await cancelMfa(c, ch.token);
            assert(!(await challengeStatus(c, ch.token)).ok);
        });
        await scenario('all five active equal-permission users require and complete their own MFA enrollment', async (u) => {
            const peers: User[] = [];
            try {
                for (let i = 0; i < 4; i++)
                    peers.push(await fresh());
                for (const account of [u, ...peers]) {
                    const pending = await begin(account);
                    assert.equal(await sessionUser(c, pending.token), null);
                    const full = await enroll(account);
                    assert.equal((await requireSessionUser(c, full.token)).id, account.id);
                }
                const [rows] = await c.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM users u JOIN auth_mfa_factors f ON f.user_id=u.id WHERE u.status='active'");
                assert.equal(Number(rows[0].n), 5);
            }
            finally {
                for (const peer of peers)
                    await setAccountActive(c, operator, peer.email, false);
            }
        });
        await scenario('all sixteen codes can be consumed once across simulated admission windows; exhaustion requires the enrolled authenticator', async (u) => {
            const f = await enroll(u);
            for (const code of f.codes) {
                await clearLimits();
                const ch = await begin(u);
                assert((await verifyMfa(c, ch.token, code, true)).ok);
            }
            await clearLimits();
            const ch = await begin(u);
            assert(!(await verifyMfa(c, ch.token, f.codes[0], true)).ok);
            const [unused] = await c.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM auth_mfa_recovery_codes WHERE user_id=? AND used_at IS NULL AND revoked_at IS NULL', [u.id]);
            assert.equal(Number(unused[0].n), 0);
            assert((await verifyMfa(c, ch.token, authenticator(f.seed).generate({ timestamp: Date.now() + 30000 }))).ok);
        });
        await writeFile('artifacts/wp16/mfa-db-evidence.json', JSON.stringify({ migrationTransition: true, originalTriggers: 13, scenarios: count, actualIndependentConnections: true, legacySessionDenied: true, plaintextSeedsOrCodesPersisted: false, allFiveUsersEnrolled: true, recoveryExhaustionVerified: true }, null, 2));
    }
    finally {
        await c.end();
    }
});
