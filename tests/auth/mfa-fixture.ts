/** Test-only orchestration of genuine MFA enrollment/recovery. No production bypass or seeded factor rows. */
import assert from 'node:assert/strict';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { localDatabaseOptions } from '../../src/server/db/config';
import { login as passwordLogin } from '../../src/server/auth/login';
import { startEnrollment, proveEnrollment, acknowledgeCodes, verifyMfa } from '../../src/server/auth/mfa';
import { authenticator, recoveryVerifier } from '../../src/server/auth/mfa-crypto';
const recovery = new Map<string, string[]>();
export function rememberFixtureCodes(user: string, codes: string[]) { assertMfaFixture(); recovery.set(user, [...codes]); }
export function assertMfaFixture() { const options = localDatabaseOptions(process.env.TEST_DATABASE_URL, 'test', process.env.DATABASE_DISPOSABLE); assert(process.env.DATABASE_DISPOSABLE === '1' && options.host === '127.0.0.1' && options.port === 3307 && (/^fitimi_test_wp(?:0[3-9]|1[0-6])$/.test(options.database ?? '') || process.env.AUTH_LOCALIZATION_TEST==='1'&&options.database==='fitimi_test_sq'), 'MFA fixtures require an explicitly disposable task database.'); }
export async function fixtureRecoveryCode(c: Connection, user: string) {
    assertMfaFixture();
    const [f] = await c.query<RowDataPacket[]>('SELECT id FROM auth_mfa_factors WHERE user_id=?', [user]);
    assert(f.length);
    const choices = recovery.get(user) ?? [];
    const [available] = await c.query<RowDataPacket[]>('SELECT verifier FROM auth_mfa_recovery_codes WHERE user_id=? AND used_at IS NULL AND revoked_at IS NULL', [user]);
    const index = choices.findIndex(code => available.some(r => r.verifier === recoveryVerifier(user, f[0].id, code)));
    assert(index >= 0, 'No test recovery code available; use a new guarded fixture.');
    return choices.splice(index, 1)[0];
}
export async function completeFixtureChallenge(c: Connection, token: string, user: string, state: string) {
    assertMfaFixture();
    if (state === 'enroll') {
        const setup = await startEnrollment(c, token);
        assert(setup.ok && setup.seed);
        if (!setup.ok || !setup.seed)
            throw new Error('Fixture enrollment unavailable.');
        const proof = await proveEnrollment(c, token, authenticator(setup.seed).generate());
        assert(proof.ok && proof.codes);
        if (!proof.ok || !proof.codes)
            throw new Error('Fixture proof failed.');
        recovery.set(user, proof.codes);
        const done = await acknowledgeCodes(c, token, 'saved');
        assert(done.ok && done.token);
        return done;
    }
    const code = await fixtureRecoveryCode(c, user), done = await verifyMfa(c, token, code, true);
    assert(done.ok && done.token);
    return done;
}
export async function fixtureLogin(c: Connection, email: string, password: string, previous?: string) {
    assertMfaFixture();
    const result = await passwordLogin(c, email, password, previous);
    if (!result.ok)
        return result;
    const [u] = await c.query<RowDataPacket[]>('SELECT id FROM users WHERE email=?', [email.trim().toLowerCase()]);
    const done = await completeFixtureChallenge(c, result.token, String(u[0].id), result.state);
    if (!done.ok || !done.token)
        throw new Error('Fixture authentication failed.');
    return { ok: true as const, token: done.token };
}
