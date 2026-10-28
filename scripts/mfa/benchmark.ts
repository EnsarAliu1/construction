import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { localDatabaseOptions, openLocalConnection } from '../../src/server/db/config';
import { authenticateOperator } from '../../src/server/auth/operator';
import { createAccount, setAccountActive } from '../../src/server/auth/accounts';
import { verifyPassword } from '../../src/server/auth/password';
import { login } from '../../src/server/auth/login';
import { sessionUser } from '../../src/server/auth/sessions';
import { startEnrollment, proveEnrollment, acknowledgeCodes, verifyMfa } from '../../src/server/auth/mfa';
import { acceptedStep, authenticator } from '../../src/server/auth/mfa-crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { assertMfaFixture } from '../../tests/auth/mfa-fixture';
async function main() {
    assertMfaFixture();
    assert.equal(process.env.AUTH_TEST_WORK_PACKAGE, 'WP-16');
    const c = await openLocalConnection(localDatabaseOptions(process.env.TEST_DATABASE_URL, 'test', '1')), operator = authenticateOperator(process.env.ADORE_OPERATOR_KEY!), samples: Record<string, number[]> = { argonVerification: [], passwordToChallenge: [], enrollmentProofAndAcknowledgement: [], totpAndFullSession: [], fullSessionGuard: [], totpPrimitiveOnly: [] };
    async function measure<T>(kind: string, work: () => Promise<T>) { const started = performance.now(), result = await work(); samples[kind].push(performance.now() - started); return result; }
    try {
        for (let run = 0; run < 10; run++) {
            await c.query('UPDATE auth_login_limits SET window_ends_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND)');
            const email = randomUUID() + '@example.invalid', password = randomBytes(24).toString('base64url'), id = await createAccount(c, operator, { email, password, displayName: 'Synthetic MFA latency user', active: true });
            try {
                const [hash] = await c.query<RowDataPacket[]>('SELECT password_hash FROM users WHERE id=?', [id]);
                assert(await measure('argonVerification', () => verifyPassword(password, hash[0].password_hash)));
                const ch = await measure('passwordToChallenge', () => login(c, email, password));
                assert(ch.ok);
                if (!ch.ok)
                    throw new Error('Synthetic password challenge failed.');
                const setup = await startEnrollment(c, ch.token);
                assert(setup.ok && setup.seed);
                if (!setup.ok || !setup.seed)
                    throw new Error('Synthetic setup failed.');
                const seed = setup.seed;
                await measure('enrollmentProofAndAcknowledgement', async () => { assert((await proveEnrollment(c, ch.token, authenticator(seed).generate())).ok); assert((await acknowledgeCodes(c, ch.token, 'saved')).ok); });
                const next = await login(c, email, password);
                assert(next.ok);
                if (!next.ok)
                    throw new Error('Synthetic second challenge failed.');
                const code = authenticator(seed).generate({ timestamp: Date.now() + 30000 });
                const full = await measure('totpAndFullSession', () => verifyMfa(c, next.token, code));
                assert(full.ok && full.token);
                if (!full.ok || !full.token)
                    throw new Error('Synthetic full session failed.');
                const token = full.token;
                assert(await measure('fullSessionGuard', () => sessionUser(c, token)));
                const started = performance.now();
                assert(acceptedStep(seed, code) !== null);
                samples.totpPrimitiveOnly.push(performance.now() - started);
            }
            finally {
                await setAccountActive(c, operator, email, false);
            }
        }
    }
    finally {
        await c.end();
    }
    const result = Object.fromEntries(Object.entries(samples).map(([key, values]) => { values.sort((a, b) => a - b); return [key, { n: values.length, medianMs: values[Math.floor(values.length / 2)], sampleP95Ms: values.at(-1), minMs: values[0] }]; }));
    await writeFile('artifacts/wp16/auth-latency.json', JSON.stringify({ scope: 'Local Node service timings against disposable MySQL; ten fresh sequential accounts; no production percentile claim.', standaloneFullSessionInsertion: 'NOT VERIFIED separately; included in authoritative TOTP verification transaction.', samples: result }, null, 2));
    console.log('PASS: measured password/TOTP/full-assurance service latency across ten genuine enrolled synthetic accounts.');
}
void main().catch(() => { console.error('MFA latency measurement failed; sensitive values withheld.'); process.exitCode = 1; });
