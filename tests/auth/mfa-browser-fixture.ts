import type { Page } from '@playwright/test';
import type { Connection } from 'mysql2/promise';
import { fixtureRecoveryCode, assertMfaFixture } from './mfa-fixture';
/** Legacy business-browser fixtures still perform a real second-factor form submission. */
export async function finishFixtureBrowserLogin(page: Page, c: Connection, user: string) {
    assertMfaFixture();
    await page.waitForURL(/\/administrata\/mfa(?:\?|$)/);
    await page.getByRole('button', { name: "Përdorni një kod rikuperimi", exact: true }).click();
    await page.locator('#mfa-code').fill(await fixtureRecoveryCode(c, user));
    await page.getByRole('button', { name: "Përdorni kodin e rikuperimit", exact: true }).click();
}
