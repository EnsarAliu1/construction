import { verifyPassword } from '../../src/server/auth/password';
import { fixtureRecoveryCode } from '../../tests/auth/mfa-fixture';
import { startEnrollment, proveEnrollment, acknowledgeCodes } from '../../src/server/auth/mfa';
import { verifyMfa } from '../../src/server/auth/mfa';
import { openMfaSeed, authenticator, recoveryVerifier } from '../../src/server/auth/mfa-crypto';
import { fixtureLogin as login } from '../../tests/auth/mfa-fixture';
import { resetMfa } from '../../src/server/auth/mfa';
import { login as passwordLogin } from '../../src/server/auth/login';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import type { RowDataPacket } from 'mysql2/promise';
import JSZip from 'jszip';
import { paymentFixture } from '../../tests/payments/fixtures';
import { localDatabaseOptions, openLocalConnection } from '../../src/server/db/config';
import { confirmPaymentWithReceipt, correctPaymentWithReceipt, cancelPaymentWithReceipt, downloadReceipt } from '../../src/features/receipts/service';
import { checksum } from '../../src/features/receipts/storage';
import { createReference } from '../../src/features/references/service';
import { createExpense } from '../../src/features/expenses/service';
import { dashboard } from '../../src/features/reporting/export';
import { sessionUser } from '../../src/server/auth/sessions';
import { setAccountActive } from '../../src/server/auth/accounts';
import { createPairedBackup, restorePairedBackup, encryptBackup, decryptBackup, databaseDigest, identity, privateDirectory } from './paired-backup';
const wp16 = process.env.AUTH_TEST_WORK_PACKAGE === 'WP-16', workPackage = wp16 ? 'WP-16' : 'WP-15', dbName = wp16 ? 'fitimi_test_wp16' : 'fitimi_test_wp15';
const root = wp16 ? 'artifacts/wp16' : 'artifacts/wp15', docker = process.env.RELEASE_DOCKER ?? 'docker';
const run = (args: string[], input?: string | Buffer) => { const r = spawnSync(docker, args, { input, encoding: input instanceof Buffer ? undefined : 'utf8', maxBuffer: 128 * 1024 * 1024, windowsHide: true }); assert.equal(r.status, 0, 'Owned Docker command failed; sensitive command output withheld.'); return Buffer.isBuffer(r.stdout) ? r.stdout : Buffer.from(r.stdout); };
function owned(id: string) { assert.match(id, /^[a-f0-9]{64}$/); const o = JSON.parse(run(['inspect', id]).toString())[0]; assert.equal(o.Id, id); assert.equal(o.Config.Labels['adore.work-package'], workPackage); assert.equal(o.Config.Labels['adore.project'], 'fitimiconstruction'); return o; }
const admin = (id: string, sql: string | Buffer) => { owned(id); return run(['exec', '-i', id, 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --user=root --batch --skip-column-names "$1"', 'sh', dbName], sql); };
async function wait(url: string) {
    for (let i = 0; i < 90; i++) {
        try {
            return await openLocalConnection(localDatabaseOptions(url, 'test', '1'));
        }
        catch {
            await pause(500);
        }
    }
    throw new Error('Owned MySQL readiness timeout.');
}
async function main() {
    assert.equal(process.env.AUTH_TEST_WORK_PACKAGE, workPackage);
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/' + dbName);
    assert.equal(new URL(process.env.DATABASE_URL!).port, '3307');
    const regressionUrl = process.env.DATABASE_URL!;
    const regression = process.env.AUTH_TEST_CONTAINER_ID!;
    owned(regression);
    run(['stop', regression]);
    const records: {
        id: string;
        volume: string;
        envFile: string;
    }[] = [], tag = randomBytes(4).toString('hex'), credentials: {
        url: string;
        password: string;
    }[] = [];
    for (const side of ['source', 'target']) {
        const name = `fitimi-${wp16 ? 'wp16' : 'wp15'}-dr-${side}-${tag}`, volume = name + '-data', envFile = `${root}/${side}-dr.env`, password = randomBytes(32).toString('hex');
        credentials.push({ password, url: `mysql://fitimi_website_test:${password}@127.0.0.1:3307/${dbName}` });
        run(['volume', 'create', '--label', 'adore.work-package=' + workPackage, '--label', 'adore.project=fitimiconstruction', volume]);
        await fs.writeFile(envFile, `MYSQL_ROOT_PASSWORD=${randomBytes(32).toString('hex')}\nMYSQL_DATABASE=${dbName}\nMYSQL_USER=fitimi_website_test\nMYSQL_PASSWORD=${password}\n`, { mode: 0o600 });
        const id = run(['create', '--name', name, '--label', 'adore.work-package=' + workPackage, '--label', 'adore.project=fitimiconstruction', '--publish', '127.0.0.1:3307:3306', '--mount', `type=volume,source=${volume},target=/var/lib/mysql`, '--env-file', envFile, 'mysql:8.4', '--skip-log-bin']).toString().trim();
        records.push({ id, volume, envFile });
    }
    await fs.writeFile(`${root}/dr-resources.json`, JSON.stringify([...JSON.parse(await fs.readFile(`${root}/dr-resources.json`, 'utf8').catch(() => '[]')), ...records]));
    const source = records[0], target = records[1];
    run(['start', source.id]);
    (await wait(credentials[0].url)).end();
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL = credentials[0].url;
    process.env.RECEIPT_STORAGE_DIR = `${root}/private-store-dr-source-${tag}`;
    const f = await paymentFixture(), c = f.connection, d = await f.fresh({ name: 'Synthetic complete recovery project' }), request = f.confirmation(d), first = await confirmPaymentWithReceipt(c, f.token, request);
    await correctPaymentWithReceipt(c, f.token, first.paymentId, { version: 1, confirmation: 'correct', payment: f.paymentInput(d, { amount: '12.00', allocations: [{ phaseId: d.phases[0].id, phaseVersion: 1, amount: '8.00' }, { phaseId: d.phases[1].id, phaseVersion: 1, amount: '4.00' }] }) });
    const second = await confirmPaymentWithReceipt(c, f.token, f.confirmation(d, { amount: '5.00', allocations: [{ phaseId: d.phases[0].id, phaseVersion: 1, amount: '5.00' }] }));
    await cancelPaymentWithReceipt(c, f.token, second.paymentId, { version: 1, confirmation: 'cancel', reason: 'Synthetic recovery cancellation' });
    const category = await createReference(c, f.token, 'categories', { name: 'Synthetic backup costs' });
    for (const [amount, project] of [['3.00', false], ['2.00', true]] as const)
        await createExpense(c, f.token, { amount, transactionDate: '2024-02-29', description: 'Synthetic recovery expense', category: { id: category.id, version: 1 }, project: project ? { id: d.project.id, version: d.project.version } : null, person: null, vehicle: null });
    await login(c, f.email, f.password);
    const [mfaBefore] = await c.query<RowDataPacket[]>('SELECT SUM(used_at IS NOT NULL) AS used,SUM(used_at IS NULL) AS unused FROM auth_mfa_recovery_codes');
    const baseline = (await dashboard(c, f.token)).totals, sourceIdentity = await identity(c);
    assert.equal(baseline.income, '12.00');
    assert.equal(baseline.expenses, '5.00');
    const key = randomBytes(32);
    await privateDirectory(`${root}/keys`);
    await fs.writeFile(`${root}/keys/${tag}.key`, key, { flag: 'wx', mode: 0o400 });
    const backupUser = 'backup_' + tag, backupPassword = randomBytes(32).toString('hex');
    admin(source.id, `CREATE USER '${backupUser}'@'localhost' IDENTIFIED BY '${backupPassword}';GRANT SELECT,SHOW VIEW,TRIGGER ON ${dbName}.* TO '${backupUser}'@'localhost';`);
    const dump = async () => { const path = `/tmp/fitimi-backup-${tag}.cnf`; return run(['exec', '-i', source.id, 'sh', '-c', 'umask 077; cat > "$1"; mysqldump --defaults-extra-file="$1" --single-transaction --triggers --hex-blob --no-tablespaces --set-gtid-purged=OFF --skip-dump-date --skip-comments "$2"; result=$?; rm -f -- "$1"; exit "$result"', 'sh', path, dbName], `[client]\nuser=${backupUser}\npassword=${backupPassword}\n`); };
    const freeze = async () => { admin(source.id, 'SET GLOBAL super_read_only=ON;'); return async () => { admin(source.id, 'SET GLOBAL super_read_only=OFF;SET GLOBAL read_only=OFF;'); }; };
    console.log('Preparing encrypted paired backup with application stopped and DB writes frozen.');
    const started = performance.now(), backup = await createPairedBackup(c, f.operator, key, `${root}/backups`, dump, freeze), backupMs = performance.now() - started;
    const encrypted = await fs.readFile(backup.file);
    assert(!encrypted.includes(Buffer.from(f.password)));
    assert(!encrypted.includes(key));
    assert.equal(backup.manifest.documents.length, 3);
    await assert.rejects(createPairedBackup(c, f.operator, key, `${root}/backups`, dump, freeze, async () => { throw Object.assign(new Error('Synthetic disk full'), { code: 'ENOSPC' }); }));
    const [flags] = await c.query<RowDataPacket[]>('SELECT @@global.super_read_only AS frozen');
    assert.equal(Number(flags[0].frozen), 0);
    assert.equal((await fs.readdir(`${root}/backups`)).filter(n => n.endsWith('.part')).length, 0);
    // This code is consumed AFTER the archived recovery point. An old backup must never revive it.
    const spentAfterSnapshot = await fixtureRecoveryCode(c, f.userId), lateChallenge = await passwordLogin(c, f.email, f.password);
    assert(lateChallenge.ok);
    if (!lateChallenge.ok)
        throw new Error('Synthetic post-snapshot challenge unavailable.');
    assert((await verifyMfa(c, lateChallenge.token, spentAfterSnapshot, true)).ok);
    const originalDigest = await databaseDigest(c);
    await c.end();
    run(['stop', source.id]);
    run(['start', target.id]);
    const restored = await wait(credentials[1].url), targetIdentity = await identity(restored);
    assert.notEqual(targetIdentity, sourceIdentity);
    const failures: string[] = [];
    const noImport = async () => { throw new Error('Validation must reject before import'); }, newRoot = () => `${root}/private-store-failure-${randomUUID()}`;
    for (const [name, data, decryption, approval, operator] of [
        ['corrupt archive', Buffer.concat([encrypted.subarray(0, encrypted.length - 1), Buffer.from([encrypted.at(-1)! ^ 1])]), key, sourceIdentity, f.operator],
        ['wrong key', encrypted, randomBytes(32), sourceIdentity, f.operator], ['wrong source identity', encrypted, key, `wrong/${dbName}`, f.operator], ['unauthorized operator', encrypted, key, sourceIdentity, { kind: 'adore_operator' }],
    ] as const) {
        await assert.rejects(restorePairedBackup(restored, operator, data, decryption, approval, newRoot(), noImport));
        failures.push(name);
    }
    for (const [name, change] of [['missing PDF', (zip: JSZip) => { zip.remove(backup.manifest.documents[0].name); }], ['tampered manifest', (zip: JSZip) => { zip.file('manifest.json', JSON.stringify({ ...backup.manifest, databaseSha256: '0'.repeat(64) })); }], ['incomplete pair', (zip: JSZip) => { zip.remove('database.sql'); }]] as const) {
        const zip = await JSZip.loadAsync(decryptBackup(encrypted, key));
        change(zip);
        const bytes = encryptBackup(await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' }), key);
        await assert.rejects(restorePairedBackup(restored, f.operator, bytes, key, sourceIdentity, newRoot(), noImport));
        failures.push(name);
    }
    await assert.rejects(restorePairedBackup(restored, f.operator, encrypted, key, targetIdentity, newRoot(), noImport));
    failures.push('same server/identity not approved');
    const [empty] = await restored.query('SHOW TABLES');
    assert.equal((empty as unknown[]).length, 0);
    const savedKeys = process.env.MFA_ENCRYPTION_KEYS;
    try {
        delete process.env.MFA_ENCRYPTION_KEYS;
        await assert.rejects(restorePairedBackup(restored, f.operator, encrypted, key, sourceIdentity, newRoot(), noImport));
        failures.push('missing separate MFA key');
    }
    finally {
        process.env.MFA_ENCRYPTION_KEYS = savedKeys;
    }
    const targetRoot = `${root}/private-store-dr-target-${tag}`;
    console.log('Restoring into independent fresh MySQL volume; original DB remains stopped and preserved.');
    const restoreStart = performance.now();
    await restorePairedBackup(restored, f.operator, encrypted, key, sourceIdentity, targetRoot, async (sql) => { admin(target.id, sql); });
    const restoreMs = performance.now() - restoreStart;
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL = credentials[1].url;
    process.env.RECEIPT_STORAGE_DIR = targetRoot;
    assert.equal(await sessionUser(restored, f.token), null);
    const [mfaRestored] = await restored.query<RowDataPacket[]>('SELECT SUM(used_at IS NOT NULL) AS used,SUM(used_at IS NULL) AS unused FROM auth_mfa_recovery_codes');
    assert.deepEqual(mfaRestored, mfaBefore);
    const passwordHeld = await passwordLogin(restored, f.email, f.password);
    assert(!passwordHeld.ok, 'Restored factors require explicit operator recovery, never normal login.');
    const [held] = await restored.query<RowDataPacket[]>('SELECT restore_hold FROM auth_mfa_factors WHERE user_id=?', [f.userId]);
    assert.equal(Number(held[0].restore_hold), 1);
    const [usable] = await restored.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM auth_mfa_recovery_codes WHERE user_id=? AND used_at IS NULL AND revoked_at IS NULL', [f.userId]);
    assert.equal(Number(usable[0].n), 0);
    const [restoredFactors] = await restored.query<RowDataPacket[]>('SELECT * FROM auth_mfa_factors WHERE user_id=?', [f.userId]);
    const originalFactor = restoredFactors[0];
    openMfaSeed({ secretCipher: originalFactor.secret_cipher, keyId: originalFactor.key_id }, f.userId, originalFactor.id);
    const [staleCode] = await restored.query<RowDataPacket[]>('SELECT used_at,revoked_at FROM auth_mfa_recovery_codes WHERE verifier=?', [recoveryVerifier(f.userId, originalFactor.id, spentAfterSnapshot)]);
    assert.equal(staleCode.length, 1);
    assert.equal(staleCode[0].used_at, null);
    assert(staleCode[0].revoked_at, 'Post-snapshot spent code must not become usable after restore.');
    const restoredPassword = randomBytes(24).toString('base64url');
    await resetMfa(restored, f.operator, f.email, { reason: 'verified-disaster-recovery', identityVerified: true, confirmation: 'reset-mfa', newPassword: restoredPassword });
    const [newPasswordRows] = await restored.query<RowDataPacket[]>('SELECT password_hash FROM users WHERE id=?', [f.userId]);
    assert(!await verifyPassword(f.password, newPasswordRows[0].password_hash));
    const passwordVerified = await passwordLogin(restored, f.email, restoredPassword);
    assert(passwordVerified.ok && passwordVerified.state === 'enroll');
    if (!passwordVerified.ok)
        throw new Error('Verified recovery enrollment unavailable.');
    const setup = await startEnrollment(restored, passwordVerified.token);
    assert(setup.ok && setup.seed);
    if (!setup.ok || !setup.seed)
        throw new Error('Restored new setup unavailable.');
    assert((await proveEnrollment(restored, passwordVerified.token, authenticator(setup.seed).generate())).ok);
    const signed = await acknowledgeCodes(restored, passwordVerified.token, 'saved');
    assert(signed.ok);
    if (!signed.ok || !signed.token)
        throw new Error('Restored account cannot authenticate');
    assert.deepEqual((await dashboard(restored, signed.token)).totals, baseline);
    for (const document of backup.manifest.documents) {
        const pdf = await downloadReceipt(restored, signed.token, document.receiptId, document.version);
        assert.equal(checksum(pdf.bytes), document.fileChecksum);
    }
    assert((await confirmPaymentWithReceipt(restored, signed.token, request)).replayed);
    const fresh = await confirmPaymentWithReceipt(restored, signed.token, f.confirmation(d, { amount: '1.00', allocations: [{ phaseId: d.phases[0].id, phaseVersion: 1, amount: '1.00' }] }));
    assert.match(fresh.receiptNumber, /-00000003$/);
    const races = await Promise.allSettled([1, 2].map(async () => {
        const other = await openLocalConnection(localDatabaseOptions(credentials[1].url, 'test', '1'));
        try {
            return await confirmPaymentWithReceipt(other, signed.token, f.confirmation(d, { amount: '40.00', allocations: [{ phaseId: d.phases[0].id, phaseVersion: 1, amount: '40.00' }] }));
        }
        finally {
            await other.end();
        }
    }));
    assert.equal(races.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(races.filter(r => r.status === 'rejected' && r.reason.code === 'CAPACITY').length, 1);
    assert.equal((await dashboard(restored, signed.token)).totals.income, '53.00');
    const retry = await passwordLogin(restored, f.email, restoredPassword);
    assert(retry.ok);
    if (retry.ok)
        assert(!(await verifyMfa(restored, retry.token, spentAfterSnapshot, true)).ok);
    await setAccountActive(restored, f.operator, f.email, false);
    await restored.end();
    run(['stop', target.id]);
    run(['start', source.id]);
    const original = await wait(credentials[0].url);
    assert.deepEqual(await databaseDigest(original), originalDigest);
    assert(await sessionUser(original, f.token));
    process.env.RECEIPT_STORAGE_DIR = `${root}/private-store-dr-source-${tag}`;
    assert.deepEqual((await dashboard(original, f.token)).totals, baseline);
    await setAccountActive(original, f.operator, f.email, false);
    await original.end();
    run(['stop', source.id]);
    run(['start', regression]);
    await (await wait(regressionUrl)).end();
    await fs.writeFile(`${root}/restore-evidence.json`, JSON.stringify({ mysql: '8.4', backupMs, restoreMs, encryptedBytes: backup.bytes, documentVersions: 3, mfaRecoveryUsageHistoryPreserved: true, restoredTotpEnrollment: true, restoreHoldAndRecoveryRevocation: true, postSnapshotSpentCodeCannotRevive: true, restoredOldPasswordReplaced: true, mfaOperatorResetAfterRestore: true, mfaKeyIds: backup.manifest.mfaKeyIds, checksums: backup.manifest.documents.map(d => ({ version: d.version, sha256: d.fileChecksum })), sourceIdentity, targetIdentity, tables: Object.keys(backup.manifest.tables).length, triggers: backup.manifest.triggers.length, migrations: 11, baselineTotals: baseline, restoredTotals: baseline, sessionRevocation: true, idempotentReplay: true, continuedReceiptNumber: fresh.receiptNumber, postRestoreRace: { success: 1, capacityConflict: 1 }, sourceUnchanged: true, failures: [...failures, 'simulated ENOSPC before publication'], productionRPO: 'NOT VERIFIED', productionRTO: 'NOT VERIFIED' }, null, 2));
    console.log('PASS: encrypted paired restore, all hashes/history, session revocation, receipt continuation, race and source isolation verified.');
}
void main().catch(async (error) => { const message = error instanceof Error ? error.stack ?? error.message : String(error); await fs.writeFile(`${root}/restore-failure.txt`, message.replace(/mysql:\/\/[^\s]+/g, '[redacted]')); console.error('Restore drill failed; sensitive outputs withheld. Preserve owned resources for diagnosis.'); process.exitCode = 1; });
