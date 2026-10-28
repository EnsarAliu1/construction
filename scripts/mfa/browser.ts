import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { chromium } from '@playwright/test';
import { localDatabaseOptions, openLocalConnection } from '../../src/server/db/config';
import { authenticateOperator } from '../../src/server/auth/operator';
import { createAccount, setAccountActive } from '../../src/server/auth/accounts';
import { resetMfa } from '../../src/server/auth/mfa';
import { authenticator } from '../../src/server/auth/mfa-crypto';
import { tokenDigest } from '../../src/server/auth/security';
import { assertMfaFixture } from '../../tests/auth/mfa-fixture';
async function main() {
    assertMfaFixture();
    assert.equal(process.env.AUTH_TEST_WORK_PACKAGE, 'WP-16');
    const origin = 'http://127.0.0.1:3000', root = 'artifacts/wp16', c = await openLocalConnection(localDatabaseOptions(process.env.TEST_DATABASE_URL, 'test', '1')), operator = authenticateOperator(process.env.ADORE_OPERATOR_KEY!), email = randomUUID() + '@example.invalid', password = randomBytes(24).toString('base64url');
    await createAccount(c, operator, { email, password, displayName: 'Synthetic MFA browser user', active: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage(), scenarios: string[] = [], errors: string[] = [], secrets = new Set([password]), timings: {
        kind: string;
        ms: number;
    }[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/server responded with a status of (401|429)/.test(m.text()))
        errors.push(m.text()); });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin || route.request().url().startsWith('data:') ? route.continue() : route.abort());
    const click = (name: string) => page.getByRole('button', { name, exact: true }).click();
    const signed = async (path = '/app') => { await page.waitForURL(origin + path); await page.locator('h1').waitFor(); assert.equal((await context.request.get(origin + '/api/auth/session')).status(), 200); };
    const login = async () => { await c.query('UPDATE auth_login_limits SET window_ends_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND)'); await page.goto(origin + '/login'); await page.locator('#email').fill(email); await page.locator('#password').fill(password); const t = performance.now(); await click('Sign in'); await page.waitForURL(/\/login\/mfa/); await page.locator('#mfa-code').waitFor({ state: 'attached' }).catch(() => { }); timings.push({ kind: 'password-to-MFA-page', ms: performance.now() - t }); };
    const logout = async () => { await click('Sign out'); await page.waitForURL(origin + '/login'); assert.equal((await context.request.get(origin + '/api/auth/session')).status(), 401); };
    const storageSafe = async () => { const values = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })); for (const value of secrets)
        assert(!values.includes(value)); };
    const enroll = async (destination = '/app', refreshCodes = false) => {
        await click('Show authenticator setup');
        const seed = (await page.getByTestId('mfa-manual-key').innerText()).trim();
        secrets.add(seed);
        assert.match(seed, /^[A-Z2-7]{32}$/);
        assert((await page.getByAltText('Authenticator setup QR code').getAttribute('src'))?.startsWith('data:image/'));
        const current = authenticator(seed).generate();
        await page.locator('#mfa-code').fill(current === '000000' ? '111111' : '000000');
        await click('Verify authenticator setup');
        await page.getByRole('alert').waitFor();
        assert.equal((await context.request.get(origin + '/api/auth/session')).status(), destination === '/app/security' ? 200 : 401);
        await page.locator('#mfa-code').fill(authenticator(seed).generate());
        await click('Verify authenticator setup');
        await page.getByTestId('mfa-recovery-code').first().waitFor();
        const codes = await page.getByTestId('mfa-recovery-code').allTextContents();
        assert.equal(codes.length, 16);
        for (const code of codes)
            secrets.add(code);
        if (refreshCodes) {
            await page.reload();
            await page.getByText('Codes were already displayed for this attempt.', { exact: false }).waitFor();
            assert.equal(await page.getByTestId('mfa-recovery-code').count(), 0);
        }
        await page.getByLabel('I saved my recovery codes securely.').check();
        await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/auth/mfa') && r.request().method() === 'POST'), click('Finish secure sign-in')]);
        await signed(destination);
        await storageSafe();
        return { seed, codes };
    };
    try {
        await login();
        const pending = (await context.cookies()).find(v => v.name === '__Host-fitimi_pre_auth');
        assert(pending && pending.httpOnly && pending.secure && pending.sameSite === 'Strict');
        secrets.add(pending.value);
        assert.equal((await context.request.get(origin + '/api/clients')).status(), 401);
        assert.equal((await context.request.get(origin + '/api/receipts/' + randomUUID() + '/versions/1/pdf')).status(), 401);
        assert(!(await context.cookies()).some(v => v.name === '__Host-fitimi_session'));
        await click('Show authenticator setup');
        const abandoned = (await page.getByTestId('mfa-manual-key').innerText()).trim();
        secrets.add(abandoned);
        await page.reload();
        await page.getByText('Setup was already displayed.', { exact: false }).waitFor();
        assert.equal(await page.getByTestId('mfa-manual-key').count(), 0);
        scenarios.push('Password-only cookie denies business/PDF access; abandoned setup does not activate; refresh never re-displays secret');
        await page.getByRole('link', { name: 'Restart sign-in', exact: true }).click();
        await login();
        let factor = await enroll('/app', true);
        scenarios.push('Actual QR/manual enrollment, invalid proof, one-time recovery display/refresh, acknowledgement and first full session');
        await logout();
        await login();
        const firstCode = authenticator(factor.seed).generate({ timestamp: Date.now() + 30000 }), firstStep = Math.floor(Date.now() / 30000) + 1;
        await page.locator('#mfa-code').fill(firstCode);
        const t = performance.now();
        await click('Verify and sign in');
        await signed();
        timings.push({ kind: 'TOTP-submit-to-useful-private-page', ms: performance.now() - t });
        scenarios.push('Actual password + authenticator form creates a new secure full session');
        await logout();
        await login();
        await page.locator('#mfa-code').fill(firstCode);
        await click('Verify and sign in');
        await page.getByRole('alert').waitFor();
        assert.equal((await context.request.get(origin + '/api/auth/session')).status(), 401);
        scenarios.push('Spent TOTP step is rejected through the real form');
        await click('Use a recovery code');
        await page.locator('#mfa-code').fill(factor.codes[0]);
        await click('Use recovery code');
        await signed();
        await logout();
        await login();
        await click('Use a recovery code');
        await page.locator('#mfa-code').fill(factor.codes[0]);
        await click('Use recovery code');
        await page.getByRole('alert').waitFor();
        await page.locator('#mfa-code').fill(factor.codes[1]);
        await click('Use recovery code');
        await signed();
        scenarios.push('Password-bound recovery succeeds once and reused code is rejected');
        await page.goto(origin + '/app/security');
        await page.locator('#stepup-password').waitFor();
        await page.locator('#stepup-password').fill('wrong-password');
        await page.locator('#stepup-code').fill('000000');
        await click('Verify security change');
        await page.getByRole('alert').waitFor();
        assert.equal(await page.getByTestId('mfa-manual-key').count(), 0);
        // Wait only until the next eligible authenticator step; never rewind replay state or bypass MFA in browser tests.
        while (Math.floor(Date.now() / 30000) + 1 <= firstStep)
            await pause(250);
        await page.locator('#stepup-password').fill(password);
        await page.locator('#stepup-code').fill(authenticator(factor.seed).generate({ timestamp: Date.now() + 30000 }));
        await click('Verify security change');
        const oldCodes = factor.codes;
        factor = await enroll('/app/security');
        await page.locator('#stepup-password').waitFor();
        scenarios.push('Actual factor replacement requires fresh password/current OTP and new authenticator possession; sessions/codes rotate');
        await page.locator('#stepup-purpose').selectOption('codes');
        await page.locator('#stepup-password').fill(password);
        await page.locator('#stepup-code').fill(authenticator(factor.seed).generate({ timestamp: Date.now() + 30000 }));
        await click('Verify security change');
        await page.getByTestId('mfa-recovery-code').first().waitFor();
        const replacementCodes = await page.getByTestId('mfa-recovery-code').allTextContents();
        assert.equal(replacementCodes.length, 16);
        for (const code of replacementCodes)
            secrets.add(code);
        await page.getByLabel('I saved my recovery codes securely.').check();
        await click('Finish secure sign-in');
        await page.locator('#stepup-password').waitFor();
        await storageSafe();
        scenarios.push('Actual stepped-up recovery-code regeneration displays one replacement set');
        await logout();
        await login();
        await click('Use a recovery code');
        await page.locator('#mfa-code').fill(oldCodes[2]);
        await click('Use recovery code');
        await page.getByRole('alert').waitFor();
        await page.locator('#mfa-code').fill(replacementCodes[0]);
        await click('Use recovery code');
        await signed();
        scenarios.push('Old factor generation codes stay invalid; current replacement recovery code works');
        await resetMfa(c, operator, email, { reason: 'lost-authenticator-and-codes', identityVerified: true, confirmation: 'reset-mfa' });
        assert.equal((await context.request.get(origin + '/api/clients')).status(), 401);
        await page.goto(origin + '/app');
        await page.waitForURL(/\/login/);
        await login();
        await page.getByRole('button', { name: 'Show authenticator setup', exact: true }).waitFor();
        factor = await enroll();
        scenarios.push('Operator reset revokes real browser session and requires fresh proved enrollment');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(origin + '/app/security');
        await page.locator('#stepup-password').waitFor();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.keyboard.press('Tab');
        await storageSafe();
        await mkdir(root + '/screenshots', { recursive: true });
        await page.screenshot({ path: root + '/screenshots/mfa-security-mobile.png', fullPage: true });
        scenarios.push('Mobile keyboard/security form, layout and secret-free browser storage');
        await logout();
        await login();
        const activePending = (await context.cookies()).find(v => v.name === '__Host-fitimi_pre_auth')!;
        await c.execute('UPDATE auth_mfa_challenges SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE token_hash=?', [tokenDigest(activePending.value)]);
        await page.reload();
        await page.getByRole('alert').waitFor();
        assert.equal((await context.request.get(origin + '/api/clients')).status(), 401);
        scenarios.push('Expired real challenge shows safe restart feedback and denies private access');
        await login();
        const acceptedCodes = new Set([-1, 0, 1].map(delta => authenticator(factor.seed).generate({ timestamp: Date.now() + delta * 30000 }))), invalidCode = ['000000', '111111', '222222', '333333'].find(code => !acceptedCodes.has(code))!;
        for (let i = 0; i < 5; i++) {
            await page.locator('#mfa-code').fill(invalidCode);
            await click('Verify and sign in');
            await page.getByRole('alert').waitFor();
        }
        await page.locator('#mfa-code').fill(invalidCode);
        await click('Verify and sign in');
        await page.getByRole('alert').filter({ hasText: 'Too many' }).waitFor();
        assert.equal((await context.request.get(origin + '/api/auth/session')).status(), 401);
        scenarios.push('Persisted five-attempt challenge limit produces actual browser throttle feedback');
        await login();
        await setAccountActive(c, operator, email, false);
        await page.locator('#mfa-code').fill(authenticator(factor.seed).generate({ timestamp: Date.now() + 30000 }));
        await click('Verify and sign in');
        await page.getByRole('alert').waitFor();
        assert.equal((await context.request.get(origin + '/api/clients')).status(), 401);
        await storageSafe();
        await page.goto(origin + '/login');
        await page.screenshot({ path: root + '/screenshots/mfa-logged-out.png', fullPage: true });
        scenarios.push('Account disabled during MFA is denied and no factor material remains in browser persistence');
        assert.deepEqual(errors, []);
        await writeFile(root + '/mfa-browser-evidence.json', JSON.stringify({ browser: browser.version(), scenarios, unexpectedErrors: errors, timings, fixtureAdmissionWindows: 'Explicitly expired only in synthetic setup between independent UI scenarios; throttle scenario itself retains real SQL limits.' }, null, 2));
        console.log(`PASS: ${scenarios.length} genuine MFA browser scenarios; ${browser.version()}.`);
    }
    catch (error) {
        let text = error instanceof Error ? error.stack ?? error.message : String(error);
        for (const secret of [email, ...secrets])
            text = text.replaceAll(secret, '[redacted]');
        await writeFile(root + '/mfa-browser-failure.txt', text);
        throw new Error('MFA browser verification failed; redacted local diagnostics retained.');
    }
    finally {
        await context.close();
        await browser.close();
        await setAccountActive(c, operator, email, false);
        await c.end();
    }
}
void main().catch(() => { console.error('MFA browser verification failed; no secrets displayed.'); process.exitCode = 1; });
