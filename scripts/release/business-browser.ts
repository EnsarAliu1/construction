import {finishFixtureBrowserLogin} from '../../tests/auth/mfa-browser-fixture';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { clientFixture } from '../../tests/clients/fixture';
import { checksum, validatePdf } from '../../src/features/receipts/storage';
import { cents as euroCents, decimal as centsToEuro } from '../../src/features/projects/money';
import JSZip from 'jszip';
import { localDatabaseOptions } from '../../src/server/db/config';
const root=process.env.AUTH_TEST_WORK_PACKAGE==='WP-16'?'artifacts/wp16':'artifacts/wp15';
async function main() {
    const o = localDatabaseOptions(process.env.TEST_DATABASE_URL, 'test', '1');
    assert.equal(o.database, process.env.AUTH_LOCALIZATION_TEST==='1'?'fitimi_test_sq':(process.env.AUTH_TEST_WORK_PACKAGE==='WP-16'?'fitimi_test_wp16':'fitimi_test_wp15'));
    assert.equal(o.port, 3307);
    assert.equal(process.env.AUTH_ORIGIN, 'http://127.0.0.1:3000');
    const origin = process.env.AUTH_ORIGIN, f = await clientFixture(), browser = await chromium.launch({ channel: 'msedge', headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage(), prefix = 'QA-' + randomUUID().slice(0, 8), steps: string[] = [], errors: string[] = [], downloads: {
        kind: string;
        bytes: number;
        sha256: string;
    }[] = [];
    const api = async (path: string) => { const r = await context.request.get(origin + path); assert.equal(r.status(), 200); return r.json(); };
    const goto = (path: string) => page.goto(origin + path);
    const click = (name: string) => page.getByRole('button', { name, exact: true }).click();
    const saved = async (family: string) => { await page.waitForURL(new RegExp(`/app/${family}/[a-f0-9-]+(?:\\?.*)?$`)); return new URL(page.url()).pathname.split('/').at(-1)!; };
    const pick = async (kind: string, name: string) => { await page.locator(`#expense-${kind}`).fill(name); await page.locator(`#expense-${kind}`).press("Enter"); await page.locator(`ul[aria-label="${kind === 'project' ? "Projekti" : kind === 'category' ? "Kategoria" : kind === 'person' ? "Furnitori / Përfituesi i pagesës" : "Automjeti"} rezultatet e kërkimit"] [role="option"]`).first().click(); };
    const download = async (kind: string, trigger: () => Promise<unknown>) => { const pending = page.waitForEvent('download'); await trigger(); const d = await pending, stream = await d.createReadStream(), parts: Buffer[] = []; for await (const chunk of stream!)
        parts.push(Buffer.from(chunk)); const bytes = Buffer.concat(parts); assert(bytes.length > 100); if (kind.includes('pdf') || kind.includes('receipt') || kind.includes('historical'))
        validatePdf(bytes);
    else {
        const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
        assert(Object.keys(zip.files).length > 3);
        if (kind === 'complete-zip') {
            const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
            assert.equal(manifest.complete, true);
            for (const file of manifest.files) {
                const body = await zip.file(file.name)!.async('nodebuffer');
                assert.equal(checksum(body), file.sha256);
            }
            assert.equal(Object.keys(zip.files).filter(n => n.startsWith('receipts/') && n.endsWith('.pdf')).length, manifest.documents);
        }
        else
            assert(zip.file('[Content_Types].xml'));
    } downloads.push({ kind, bytes: bytes.length, sha256: checksum(bytes) }); return bytes; };
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/server responded with a status of (400|401|409)/.test(m.text()))
        errors.push(m.text()); });
    try {
        await goto('/administrata');
        await page.locator('#email').fill(f.email);
        await page.locator('#password').fill('wrong-password');
        await click("Hyni");
        await page.getByRole('alert').waitFor();
        assert(new URL(page.url()).pathname === '/administrata');
        await page.locator('#password').fill(f.password);
        await click("Hyni");
        await finishFixtureBrowserLogin(page,f.connection,f.userId);
        await page.waitForURL(origin + '/app');
        const initialTotals = (await api('/api/dashboard')).dashboard.totals;
        steps.push('Invalid password rejected and real-cookie login succeeds');
        async function client(type: 'private_person' | 'business', name: string) { await goto('/app/clients/new'); await page.locator('#client-type').selectOption(type); await page.locator('#client-name').fill(name); await click("Krijoni klient"); return saved('clients'); }
        const individual = await client('private_person', prefix + " Individ"), business = await client('business', prefix + " Biznes");
        await goto(`/app/clients/${individual}/edit`);
        await page.locator('#client-city').fill('Synthetic test city');
        await click("Ruani ndryshimet");
        await saved('clients');
        assert((await api(`/api/clients/${individual}`)).history.length >= 2);
        await goto('/app/clients');
        await page.locator('#clients-search').fill(prefix);
        await click("Kërkoni");
        await page.waitForURL(/q=QA-/);
        assert((await page.locator('main').innerText()).includes(prefix + " Biznes"));
        steps.push('Create individual/business, edit, search and persisted audit history');
        await goto('/app/projects/new');
        await page.locator('#project-client').fill(prefix + " Biznes");
        await page.getByRole('option').filter({hasText:prefix + " Biznes"}).click();
        await page.locator('#project-name').fill(prefix + " Ndërtim");
        await page.locator('#contract-total').fill('100.00');
        await page.locator('#phase-name-0').fill('Synthetic first');
        await page.locator('#phase-value-0').fill('60.00');
        await click("Shtoni fazë financiare");
        await page.locator('#phase-name-1').fill('Synthetic second');
        await page.locator('#phase-value-1').fill('39.00');
        await click("Krijoni projektin dhe kontratën");
        await page.getByRole('alert').waitFor();
        assert(new URL(page.url()).pathname.endsWith('/new'));
        await page.locator('#phase-value-1').fill('40.00');
        await click("Krijoni projektin dhe kontratën");
        const project = await saved('projects');
        steps.push('Create linked project/contract/phases; reject unequal sum');
        await goto(`/app/projects/${project}/contract`);
        await page.locator('#phase-value-0').fill('70.00');
        await page.locator('#phase-value-1').fill('30.00');
        await click("Ruani kontratën dhe fazat");
        await saved('projects');
        await goto(`/app/clients/${business}`);
        await page.getByText("Arkivoni klientin", { exact: true }).click();
        assert((await page.locator('main').innerText()).includes('nuk mund të arkivohet'));
        await goto(`/app/clients/${individual}`);
        await page.getByText("Arkivoni klientin", { exact: true }).click();
        await page.getByLabel("E kuptoj dhe dëshiroj ta arkivoj këtë klient.").check();
        await Promise.all([page.waitForResponse(r => r.request().method() === 'DELETE' && r.status() === 200), click("Konfirmoni arkivimin")]);
        await page.waitForURL(/notice=archived/);
        assert((await api(`/api/clients/${individual}`)).client.deletedAt);
        steps.push('Contract edits and client archive constraints/retention');
        const refs: Record<string, string> = {};
        for (const kind of ['categories', 'persons', 'vehicles']) {
            await goto(`/app/${kind}/new`);
            await page.locator(kind === 'vehicles' ? '#reference-identifier' : '#reference-name').fill(prefix + ' ' + kind);
            await page.locator('main form button[type="submit"]').click();
            refs[kind] = await saved(kind);
            if (kind !== 'categories') {
                await page.getByText('Çaktivizoni të dhënë', { exact: true }).click();
                await page.locator('details form input[type="checkbox"]').check();
                await Promise.all([page.waitForResponse(r => r.url().includes('/lifecycle') && r.status() === 200), click('Konfirmoni çaktivizimin')]);
                await goto(`/app/${kind}/${refs[kind]}`);
                await page.getByText('Riaktivizoni të dhënë', { exact: true }).click();
                await page.locator('details form input[type="checkbox"]').check();
                await Promise.all([page.waitForResponse(r => r.url().includes('/lifecycle') && r.status() === 200), click('Konfirmoni riaktivizimin')]);
                await goto(`/app/${kind}/${refs[kind]}`);
                assert((await api(`/api/references/${kind}/${refs[kind]}`)).record.isActive);
            }
        }
        steps.push('Create categories/suppliers/vehicles and exercise reference lifecycle');
        await goto('/app/expenses/new');
        await page.locator('#expense-amount').fill('2.00');
        await page.locator('#expense-transactionDate').fill('2024-02-29');
        await page.locator('#expense-description').fill('Synthetic project expense');
        await pick('category', prefix + ' categories');
        await pick('project', prefix + " Ndërtim");
        await pick('person', prefix + ' persons');
        await pick('vehicle', prefix + ' vehicles');
        const other = await context.newPage();
        await other.goto(`${origin}/app/categories/${refs.categories}`);
        await other.getByText('Çaktivizoni të dhënë', { exact: true }).click();
        await other.locator('details form input[type="checkbox"]').check();
        await Promise.all([other.waitForResponse(r => r.url().includes('/lifecycle')), other.getByRole('button', { name: 'Konfirmoni çaktivizimin', exact: true }).click()]);
        await click("Regjistroni shpenzim");
        await page.getByRole('alert').waitFor();
        assert(new URL(page.url()).pathname.endsWith('/new'));
        await other.goto(`${origin}/app/categories/${refs.categories}`);
        await other.getByText('Riaktivizoni të dhënë', { exact: true }).click();
        await other.locator('details form input[type="checkbox"]').check();
        await Promise.all([other.waitForResponse(r => r.url().includes('/lifecycle')), other.getByRole('button', { name: 'Konfirmoni riaktivizimin', exact: true }).click()]);
        await other.close();
        await pick('category', prefix + ' categories');
        await click("Regjistroni shpenzim");
        const projectExpense = await saved('expenses');
        steps.push('Inactive/stale reference rejected; linked project/supplier/vehicle expense saved after fresh selection');
        await goto('/app/expenses/new');
        await page.locator('#expense-amount').fill('3.00');
        await page.locator('#expense-transactionDate').fill('2024-02-29');
        await page.locator('#expense-description').fill('Synthetic company expense');
        await page.getByLabel("Krijoni kategori të re me këtë shpenzim").check();
        await page.locator('#expense-newCategoryName').fill(prefix + ' Inline');
        await click("Regjistroni shpenzim");
        const companyExpense = await saved('expenses');
        await goto(`/app/expenses/${companyExpense}/edit`);
        await page.locator('#expense-amount').fill('4.00');
        await page.getByLabel(/Konfirmoj korrigjimin/).check();
        await click("Konfirmoni dhe ruani korrigjimin");
        await saved('expenses');
        await goto(`/app/expenses/${projectExpense}`);
        await page.getByText("Anuloni shpenzimin", { exact: true }).click();
        await page.locator('#expense-cancellation-reason').fill('Synthetic cancellation');
        await page.getByLabel("Konfirmoj anulimin e këtij shpenzimi të regjistruar.").check();
        await Promise.all([page.waitForResponse(r => r.url().includes('/cancel') && r.status() === 200), click("Konfirmoni anulimin")]);
        await page.waitForURL(/notice=cancelled/);
        steps.push('Inline company category, expense correction/cancellation and audit');
        async function payment(amount: string, first: string, second = '') { await goto('/app/payments/new'); await pick('project', prefix + " Ndërtim"); await page.locator('[id^="payment-allocation-"]').first().waitFor(); await page.locator('#payment-amount').fill(amount); await page.locator('#payment-transactionDate').fill('2024-02-29'); await page.locator('[id^="payment-allocation-"]').nth(0).fill(first); await page.locator('[id^="payment-allocation-"]').nth(1).fill(second); }
        await payment('101.00', '101.00');
        await click("Kontrolloni ndarjen");
        await page.getByRole('alert').waitFor();
        await page.locator('#payment-amount').fill('10.00');
        await page.locator('[id^="payment-allocation-"]').nth(0).fill('6.00');
        await page.locator('[id^="payment-allocation-"]').nth(1).fill('4.00');
        await click("Konfirmoni pagesën dhe lëshoni dëftesën");
        const paymentId = await saved('payments');
        const firstPdf = await download('receipt-v1', () => page.locator('a[href$="/versions/1/pdf"]').first().click());
        steps.push('Reject overcapacity and issue split-allocation payment with actual PDF download');
        await goto(`/app/projects/${project}/contract`);
        assert(await page.getByRole('button', { name: 'Hiqni fazën 1', exact: true }).isDisabled());
        await page.locator('#phase-value-0').fill('5.00');
        await page.locator('#phase-value-1').fill('95.00');
        await click("Ruani kontratën dhe fazat");
        await page.getByRole('alert').waitFor();
        assert.equal((await api(`/api/projects/${project}`)).phases[0].value, '70.00');
        steps.push('Paid phase removal disabled and reduction below allocation rejected');
        await goto(`/app/payments/${paymentId}/edit`);
        await page.locator('#payment-amount').fill('12.00');
        await page.locator('[id^="payment-allocation-"]').nth(0).fill('7.00');
        await page.locator('[id^="payment-allocation-"]').nth(1).fill('5.00');
        await page.getByLabel(/Konfirmoj korrigjimin e pagesës/).check();
        await click("Ruani korrigjimin dhe versionin e ri të dëftesës");
        await saved('payments');
        const secondPdf = await download('receipt-v2', () => page.locator('a[href$="/versions/2/pdf"]').first().click());
        assert.notEqual(checksum(firstPdf), checksum(secondPdf));
        const oldPdf = await download('historical-v1', () => page.locator('a[href$="/versions/1/pdf"]').first().click());
        assert.equal(checksum(firstPdf), checksum(oldPdf));
        await page.getByText("Anuloni pagesën dhe dëftesën", { exact: true }).click();
        await page.locator('#receipt-cancel-reason').fill('Synthetic cancellation');
        await page.getByLabel("Konfirmoj anulimin e pagesës dhe dëftesës së saj.").check();
        await Promise.all([page.waitForResponse(r => r.url().endsWith('/cancel') && r.status() === 200), click("Konfirmoni anulimin")]);
        await goto(`/app/payments/${paymentId}`);
        assert((await page.locator('main').innerText()).includes('ANULUAR'));
        steps.push('Payment correction appends immutable v2; v1 unchanged; cancellation visible');
        await payment('70.00', '70.00');
        await click("Konfirmoni pagesën dhe lëshoni dëftesën");
        await saved('payments');
        const response = await api('/api/dashboard'), report = response.report ?? response.dashboard ?? response;
        assert.equal(report.totals.income, centsToEuro(euroCents(initialTotals.income) + BigInt(7000)));
        assert.equal(report.totals.expenses, centsToEuro(euroCents(initialTotals.expenses) + BigInt(400)));
        assert.equal(report.totals.difference, centsToEuro(BigInt(initialTotals.difference.replace('.', '')) + BigInt(6600)));
        assert((await api(`/api/projects/${project}`)).financial.verified);
        steps.push('Released capacity reused; exact dashboard/project reconciliation after correction/cancellation');
        await goto('/app/reports');
        await download('company-pdf', () => click('Shkarkoni raportin e kompanisë PDF'));
        await download('company-xlsx', () => click('Shkarkoni raportin e kompanisë XLSX'));
        await page.getByLabel(/E kuptoj që ky ZIP përmban/).check();
        await download('complete-zip', () => click("Eksportoni të gjitha të dhënat e biznesit (ZIP)"));
        steps.push('Actual browser PDF/XLSX/ZIP downloads');
        await page.setViewportSize({ width: 390, height: 844 });
        await goto('/app/clients');
        const mobile = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => ({ tag: e.tagName, cls: e.className, left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width, overflow: getComputedStyle(e).overflowX })).slice(0, 30) }));
        await fs.writeFile(root+'/mobile-overflow.json', JSON.stringify(mobile, null, 2));
        assert(mobile.width <= mobile.viewport);
        await page.keyboard.press('Tab');
        await fs.mkdir(root+'/screenshots', { recursive: true });
        await page.screenshot({ path: root+'/screenshots/business-mobile.png', fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await goto(`/app/projects/${project}`);
        await page.screenshot({ path: root+'/screenshots/business-project.png', fullPage: true });
        await page.locator('.workspace-profile>summary').click();await click("Dilni");
        await page.waitForURL(origin + '/administrata');
        assert.equal((await context.request.get(origin + '/api/clients')).status(), 401);
        assert.deepEqual(errors, []);
        steps.push('Mobile navigation/focus/overflow, screenshots and logout');
        await fs.writeFile(root+'/business-browser.json', JSON.stringify({ browser: browser.version(), steps, downloads, unexpectedErrors: errors, initialTotals, totals: report.totals }, null, 2));
        console.log(`PASS: ${steps.length} complete business browser scenarios and ${downloads.length} real downloads.`);
    }
    catch (error) {
        let text = error instanceof Error ? error.stack ?? error.message : String(error);
        for (const secret of [f.email, f.password, f.token])
            text = text.replaceAll(secret, '[redacted]');
        await fs.writeFile(root+'/business-failure.txt', text);
        await page.screenshot({ path: root+'/business-failure.png', fullPage: true }).catch(() => { });
        throw error;
    }
    finally {
        await context.close();
        await browser.close();
        await f.close();
    }
}
void main().catch(() => { console.error('Business browser verification failed; redacted diagnostic evidence retained.'); process.exitCode = 1; });
