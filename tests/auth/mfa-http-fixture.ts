import assert from 'node:assert/strict';
import type { Connection } from 'mysql2/promise';
import { authenticator } from '../../src/server/auth/mfa-crypto';
import { assertMfaFixture, rememberFixtureCodes, fixtureRecoveryCode } from './mfa-fixture';
export function hostCookie(response: Response, name: string) { const value = response.headers.getSetCookie().find(s => s.startsWith(name + '=') && !s.startsWith(name + '=;')); assert(value, `Expected ${name} cookie.`); return value.split(';')[0]; }
/** Complete the actual HTTP second factor, never inject an assurance flag or construct a full session. */
export async function finishFixtureHttpLogin(c: Connection, user: string, response: Response, returnTo: string) {
    assertMfaFixture();
    const body = await response.clone().json(), pending = hostCookie(response, '__Host-fitimi_pre_auth'), origin = process.env.AUTH_ORIGIN!;
    assert.match(pending, /^__Host-fitimi_pre_auth=/);
    assert.match(response.headers.getSetCookie().find(v => v.startsWith('__Host-fitimi_pre_auth='))!, /SameSite=Strict/i);
    assert.equal((await fetch(origin + '/api/auth/session', { headers: { Cookie: pending } })).status, 401);
    const send = (data: object) => fetch(origin + '/api/auth/mfa', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: pending }, body: JSON.stringify({ ...data, returnTo }) });
    let complete: Response;
    if (body.state === 'enroll') {
        const start = await send({ action: 'start' });
        assert.equal(start.status, 200);
        const setup = await start.json();
        assert(setup.seed && setup.qr);
        const proof = await send({ action: 'enroll', code: authenticator(setup.seed).generate() });
        assert.equal(proof.status, 200);
        const codes = await proof.json();
        assert.equal(codes.codes.length, 16);
        rememberFixtureCodes(user, codes.codes);
        complete = await send({ action: 'acknowledge', confirmation: 'saved' });
    }
    else
        complete = await send({ action: 'recovery', code: await fixtureRecoveryCode(c, user) });
    assert.equal(complete.status, 200);
    return complete;
}
