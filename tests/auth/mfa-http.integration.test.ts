import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type { RowDataPacket } from 'mysql2/promise';
import JSZip from 'jszip';
import { clientFixture } from '../clients/fixture';
import { login } from '../../src/server/auth/login';
import { fixtureRecoveryCode } from './mfa-fixture';
import { openMfaSeed } from '../../src/server/auth/mfa-crypto';
test('real HTTP pre-MFA denial, request controls, full assurance and secret-free export', { skip: !process.env.TEST_DATABASE_URL, timeout: 180000 }, async (t) => {
    const f = await clientFixture(), origin = 'http://127.0.0.1:3000', c = f.connection, ch = await login(c, f.email, f.password);
    assert(ch.ok);
    if (!ch.ok)
        return;
    const pending = `__Host-fitimi_pre_auth=${ch.token}`, asSession = `__Host-fitimi_session=${ch.token}`, full = `__Host-fitimi_session=${f.token}`;
    let denials = 0;
    const request = (path: string, method = 'GET', cookie = pending, body?: object, source = origin) => fetch(origin + path, { method, redirect: 'manual', headers: { Cookie: cookie, Origin: source, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    try {
        await t.test('every declared business API method and private page denies pending and disguised pending tokens', async () => {
            const inventory = JSON.parse(await readFile('docs/security/endpoint-inventory.json', 'utf8')) as {
                path: string;
                kind: string;
                methods: string[];
            }[];
            for (const e of inventory) {
                if (e.path.startsWith('/api/auth/'))
                    continue;
                for (const section of e.path.includes('[section]') ? ['categories', 'persons', 'vehicles', 'accounts'] : e.path.includes('[kind]') ? ['categories', 'persons', 'vehicles'] : ['categories']) {
                    const path = e.path.replace('[kind]', section).replace('[section]', section).replace('[id]', randomUUID()).replace('[key]', randomUUID()).replace('[version]', '1');
                    for (const cookie of [pending, asSession])
                        for (const method of e.methods) {
                            const r = await request(path, method, cookie, ['GET', 'HEAD'].includes(method) ? undefined : {});
                            assert.equal(r.status, e.kind === 'page' ? 307 : 401, `${method} ${path}`);
                            assert.match(r.headers.get('cache-control') ?? '', /no-store/);
                            denials++;
                        }
                }
            }
            assert(denials >= 160);
            assert.equal((await request('/api/auth/session')).status, 401);
            assert.equal((await request('/api/auth/session', 'GET', asSession)).status, 401);
        });
        await t.test('CSRF, bounded/unknown fields, fake assurance and full-cookie-as-challenge cannot bypass verification', async () => {
            assert.equal((await request('/api/auth/mfa', 'POST', pending, { action: 'verify', code: '000000' }, 'https://wrong.example')).status, 403);
            assert.equal((await request('/api/auth/mfa', 'POST', pending, { action: 'verify', code: '000000', mfaPassed: true })).status, 400);
            assert.equal((await request('/api/auth/mfa', 'GET', full)).status, 401);
            assert.equal((await request('/api/auth/mfa', 'POST', pending, { action: 'verify', code: '123' })).status, 401);
            assert.equal((await request('/api/auth/session', 'GET', pending + '; mfaPassed=true')).status, 401);
        });
        await t.test('pending tokens cannot run the actual protected logout Server Action as fully authenticated', async () => {
            const manifest = JSON.parse(await readFile(process.env.FITIMI_TEST_BUILD==='sq'?'.next-sq/server/server-reference-manifest.json':'.next-wp16/server/server-reference-manifest.json', 'utf8')), action = Object.entries(manifest.node as Record<string, {
                exportedName?: string;
            }>).find(([, v]) => v.exportedName === 'logoutAction');
            assert(action);
            const response = await fetch(origin + '/app', { method: 'POST', headers: { Cookie: pending, Origin: origin, 'Next-Action': action[0], 'Content-Type': 'text/plain;charset=UTF-8' }, body: '[]', redirect: 'manual' });
            assert([200, 303].includes(response.status));
            assert.equal(response.headers.get('x-action-redirect'), '/administrata;push');
            assert.equal((await request('/api/auth/session', 'GET', asSession)).status, 401);
        });
        await t.test('approved single-use recovery issues a different full session; all further completion attempts fail', async () => {
            const response = await request('/api/auth/mfa', 'POST', pending, { action: 'recovery', code: await fixtureRecoveryCode(c, f.userId), returnTo: '/app' });
            assert.equal(response.status, 200);
            const body = await response.json();
            assert(body.ok && !Object.hasOwn(body, 'token'));
            const cookie = response.headers.getSetCookie().find(s => s.startsWith('__Host-fitimi_session='))!;
            assert(cookie && !cookie.includes(ch.token));
            assert.match(cookie, /HttpOnly/);
            assert(/SameSite=Lax/i.test(cookie), 'Full session requires SameSite=Lax.');
            assert.match(cookie, /Secure/);
            assert.equal((await request('/api/auth/session', 'GET', cookie.split(';')[0])).status, 200);
            assert.equal((await request('/api/auth/mfa', 'POST', pending, { action: 'recovery', code: '0'.repeat(32) })).status, 401);
        });
        await t.test('business ZIP excludes encrypted factors, key IDs, verifiers, seeds, pending challenges and runtime keys', async () => {
            const [factors] = await c.query<RowDataPacket[]>('SELECT * FROM auth_mfa_factors WHERE user_id=?', [f.userId]), [codes] = await c.query<RowDataPacket[]>('SELECT verifier FROM auth_mfa_recovery_codes WHERE user_id=?', [f.userId]), factor = factors[0], seed = openMfaSeed({ secretCipher: factor.secret_cipher, keyId: factor.key_id }, f.userId, factor.id);
            const response = await request('/api/exports/business', 'POST', full, { confirmation: 'export-all' });
            assert.equal(response.status, 200);
            assert.match(response.headers.get('cache-control')!, /no-store/);
            const zip = await JSZip.loadAsync(await response.arrayBuffer());
            const secrets = [seed, factor.secret_cipher, factor.key_id, ch.token, ...codes.map(row => row.verifier), ...Object.values(JSON.parse(process.env.MFA_ENCRYPTION_KEYS!)) as string[]];
            for (const file of Object.values(zip.files)) {
                assert(!/auth_mfa|mfa_challenge|recovery_codes/.test(file.name));
                if (/\.(json|csv)$/.test(file.name)) {
                    const text = await file.async('string');
                    for (const secret of secrets)
                        assert(!text.includes(secret));
                    assert(!text.includes('auth_mfa_factors'));
                }
            }
        });
        await t.test('explicit pending cancellation cannot elevate an account or preserve a usable challenge', async () => {
            const next = await login(c, f.email, f.password);
            assert(next.ok);
            if (!next.ok)
                return;
            const cookie = `__Host-fitimi_pre_auth=${next.token}`;
            assert.equal((await request('/api/auth/mfa', 'POST', cookie, { action: 'cancel' })).status, 200);
            assert.equal((await request('/api/auth/mfa', 'GET', cookie)).status, 401);
            assert.equal((await request('/api/auth/session', 'GET', `__Host-fitimi_session=${next.token}`)).status, 401);
        });
        await t.test('restored-factor hold blocks even unrevoked full cookies, pending factors and password-only restart', async () => {
            const race = await login(c, f.email, f.password);
            assert(race.ok);
            if (!race.ok)
                return;
            await c.execute('UPDATE auth_mfa_factors SET restore_hold=1 WHERE user_id=?', [f.userId]);
            assert.equal((await request('/api/auth/session', 'GET', full)).status, 401);
            assert.equal((await request('/api/clients', 'GET', full)).status, 401);
            assert.equal((await request('/api/auth/mfa', 'POST', `__Host-fitimi_pre_auth=${race.token}`, { action: 'recovery', code: await fixtureRecoveryCode(c, f.userId) })).status, 401);
            assert.equal((await request('/api/auth/login', 'POST', '', { email: f.email, password: f.password })).status, 401);
        });
        const [logs] = await c.query<RowDataPacket[]>('SELECT after_snapshot FROM audit_events WHERE actor_id=?', [f.userId]);
        assert(!JSON.stringify(logs).includes(ch.token));
        await writeFile('artifacts/wp16/mfa-http-evidence.json', JSON.stringify({ pendingBusinessDenialRequests: denials, fullAssuranceRequired: true, secretExportExclusion: true, serverActionDenied: true }, null, 2));
    }
    finally {
        await f.close();
    }
});
