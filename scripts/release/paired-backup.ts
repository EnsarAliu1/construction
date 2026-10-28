import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import JSZip from 'jszip';
import { requireOperator, type OperatorContext } from '../../src/server/auth/operator';
import { PrivateReceiptStore, checksum, validatePdf } from '../../src/features/receipts/storage';
import { secureWindowsReceiptDirectory } from '../../src/features/receipts/permissions';
import { securityEvent } from '../../src/server/auth/store';
import { securitySignal } from '../../src/server/operations/events';
const MAX = 128 * 1024 * 1024, dbName = 'fitimi_test_wp15';
type Row = Record<string, unknown>;
type Manifest = {
    format: 'fitimi-paired/1';
    id: string;
    createdAt: string;
    retainUntil: string;
    sourceIdentity: string;
    owner: {
        application: string;
        owner: string;
        database: string;
    };
    databaseSha256: string;
    tables: Record<string, {
        count: number;
        sha256: string;
    }>;
    triggers: Row[];
    documents: {
        name: string;
        storageReference: string;
        fileChecksum: string;
        receiptId: string;
        version: number;
    }[];
};
export async function identity(c: Connection) { const [r] = await c.query<RowDataPacket[]>('SELECT DATABASE() AS db,@@server_uuid AS uuid,VERSION() AS version'); assert.equal(r[0].db, dbName); assert.match(r[0].version, /^8\.4\./); return `${r[0].uuid}/${r[0].db}`; }
export async function databaseDigest(c: Connection) {
    const [extra] = await c.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE())+(SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()) AS count");
    assert.equal(Number(extra[0].count), 0, 'This reviewed format does not silently omit routines or scheduled events.');
    const [names] = await c.query<RowDataPacket[]>('SHOW TABLES'), tables: Manifest['tables'] = {};
    let totalRows = 0;
    for (const row of names) {
        const name = String(Object.values(row)[0]);
        assert(/^[a-z_0-9]+$/.test(name));
        const [count] = await c.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${name}\``);
        totalRows += Number(count[0].n);
        assert(totalRows <= 20000, 'Reference backup exceeds its reviewed total-row memory limit; no truncated archive is produced.');
        const [rows] = await c.query<RowDataPacket[]>(`SELECT * FROM \`${name}\` ORDER BY ${name === 'auth_login_limits' ? 'bucket_key' : name === 'auth_account_control' || name === 'receipt_counters' ? 'scope' : 'id'}`);
        tables[name] = { count: rows.length, sha256: checksum(Buffer.from(JSON.stringify(rows))) };
    }
    const [triggers] = await c.query<RowDataPacket[]>('SELECT TRIGGER_NAME AS name,ACTION_TIMING AS timing,EVENT_MANIPULATION AS event,EVENT_OBJECT_TABLE AS tableName,ACTION_STATEMENT AS statement FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY TRIGGER_NAME');
    assert.equal(triggers.length, 13);
    assert.equal(tables.__drizzle_migrations?.count, 9);
    return { tables, triggers: triggers as Row[] };
}
export async function privateDirectory(path: string) {
    const root = resolve(path), base = resolve('artifacts/wp15');
    assert(root.startsWith(base + '\\') || root.startsWith(base + '/'));
    const rel = relative(base, root);
    assert(!isAbsolute(rel) && !rel.startsWith('..'));
    let parent = dirname(root);
    while (true) {
        try {
            assert(!(await fs.lstat(parent)).isSymbolicLink());
        }
        catch (e) {
            if (!(e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT'))
                throw e;
        }
        const next = dirname(parent);
        if (next === parent)
            break;
        parent = next;
    }
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    assert(!(await fs.lstat(root)).isSymbolicLink());
    await secureWindowsReceiptDirectory(root, randomUUID());
    return root;
}
export function encryptBackup(plain: Buffer, key: Buffer) {
    assert.equal(key.length, 32);
    assert(plain.length <= MAX);
    const iv = randomBytes(12), header = Buffer.from(JSON.stringify({ format: 'fitimi-encrypted/1', cipher: 'aes-256-gcm', iv: iv.toString('base64') })), size = Buffer.alloc(4);
    size.writeUInt32BE(header.length);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(header);
    return Buffer.concat([size, header, cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
}
export function decryptBackup(data: Buffer, key: Buffer) {
    assert.equal(key.length, 32);
    assert(data.length > 24 && data.length < MAX + 4096);
    const n = data.readUInt32BE(0);
    assert(n > 0 && n <= 1024 && data.length > n + 20);
    const header = data.subarray(4, 4 + n), h = JSON.parse(header.toString());
    assert.equal(h.format, 'fitimi-encrypted/1');
    assert.equal(h.cipher, 'aes-256-gcm');
    const iv = Buffer.from(h.iv, 'base64');
    assert.equal(iv.length, 12);
    const cipher = createDecipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(header);
    cipher.setAuthTag(data.subarray(-16));
    return Buffer.concat([cipher.update(data.subarray(4 + n, -16)), cipher.final()]);
}
/** Only bounded STORE ZIPs produced by this workflow; reject compressed/ZIP64 bombs before decompression. */
function validateZip(data: Buffer) {
    assert(data.length <= MAX && data.length >= 22);
    const end = data.length - 22;
    assert.equal(data.readUInt32LE(end), 0x06054b50);
    assert.equal(data.readUInt16LE(end + 20), 0);
    const count = data.readUInt16LE(end + 10), offset = data.readUInt32LE(end + 16);
    assert(count > 0 && count <= 1024);
    let pos = offset, total = 0;
    const names = new Set<string>();
    for (let i = 0; i < count; i++) {
        assert(pos + 46 <= end);
        assert.equal(data.readUInt32LE(pos), 0x02014b50);
        assert.equal(data.readUInt16LE(pos + 10), 0);
        const size = data.readUInt32LE(pos + 24);
        assert.equal(size, data.readUInt32LE(pos + 20));
        total += size;
        assert(total <= MAX);
        const n = data.readUInt16LE(pos + 28), extra = data.readUInt16LE(pos + 30), comment = data.readUInt16LE(pos + 32);
        assert(pos + 46 + n + extra + comment <= end);
        const name = data.subarray(pos + 46, pos + 46 + n).toString();
        assert(!names.has(name));
        assert(name === 'manifest.json' || name === 'database.sql' || /^receipts\/[a-f0-9-]{36}\.pdf$/.test(name));
        names.add(name);
        pos += 46 + n + extra + comment;
    }
    assert.equal(pos, end);
    assert.equal(pos - offset, data.readUInt32LE(end + 12));
    return names;
}
export async function validatePairedArchive(data: Buffer, key: Buffer, approveSource: string) {
    const plain = decryptBackup(data, key), names = validateZip(plain), zip = await JSZip.loadAsync(plain, { checkCRC32: true }), manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as Manifest;
    assert.equal(manifest.format, 'fitimi-paired/1');
    assert(Number.isFinite(Date.parse(manifest.createdAt)));
    assert.equal(manifest.retainUntil,new Date(Date.parse(manifest.createdAt)+30*86400000).toISOString());
    assert.equal(manifest.sourceIdentity, approveSource);
    assert.match(manifest.id, /^[a-f0-9-]{36}$/);
    assert.equal(manifest.owner.application, 'fitimi-private-receipts-v1');
    assert.equal(manifest.owner.database, manifest.sourceIdentity);
    assert.match(manifest.owner.owner, /^[a-f0-9-]{36}$/);
    assert(manifest.documents.length <= 256);
    assert.equal(names.size, manifest.documents.length + 2);
    const sql = await zip.file('database.sql')!.async('nodebuffer');
    assert(sql.length < 64 * 1024 * 1024);
    assert.equal(checksum(sql), manifest.databaseSha256);
    const documents = new Map<string, Buffer>();
    for (const doc of manifest.documents) {
        assert(/^receipts\/[a-f0-9-]{36}\.pdf$/.test(doc.name));
        assert(!documents.has(doc.name));
        assert.equal(doc.storageReference, `r/${manifest.owner.owner}/${doc.name.split('/')[1]}`);
        assert(names.has(doc.name));
        const bytes = await zip.file(doc.name)!.async('nodebuffer');
        validatePdf(bytes);
        assert.equal(checksum(bytes), doc.fileChecksum);
        documents.set(doc.name, bytes);
    }
    return { manifest, sql, documents };
}
export async function createPairedBackup(c: Connection, operator: OperatorContext, key: Buffer, output: string, dump: () => Promise<Buffer>, freeze: () => Promise<() => Promise<void>>, fault: () => Promise<void> = async () => { }) {
    requireOperator(operator);
    const source = await identity(c), store = new PrivateReceiptStore(source);
    await store.initialize();
    const lock = store.lockName();
    const [lease] = await c.query<RowDataPacket[]>('SELECT GET_LOCK(?,5) AS acquired', [lock]);
    assert.equal(Number(lease[0].acquired), 1);
    let thaw: (() => Promise<void>) | undefined;
    try {
        await securityEvent(c, 'backup_started', randomUUID(), null, { status: 'preparing' });
        thaw = await freeze();
        const [state] = await c.query<RowDataPacket[]>('SELECT @@global.super_read_only AS frozen');
        assert.equal(Number(state[0].frozen), 1);
        const id = randomUUID(), createdAt = new Date().toISOString(), owner = JSON.parse(await fs.readFile(resolve(store.root, '.owner.json'), 'utf8')), sql = await dump();
        assert(sql.length < 64 * 1024 * 1024);
        const digest = await databaseDigest(c);
        const [rows] = await c.query<RowDataPacket[]>('SELECT receipt_id,version,storage_reference,file_checksum FROM receipt_versions ORDER BY id');
        assert(rows.length <= 256);
        const zip = new JSZip(), documents: Manifest['documents'] = [];
        zip.file('database.sql', sql);
        let size = sql.length;
        for (const row of rows) {
            const bytes = await store.read(String(row.storage_reference), String(row.file_checksum));
            size += bytes.length;
            assert(size <= MAX);
            const name = 'receipts/' + String(row.storage_reference).split('/').at(-1);
            assert(!documents.some(d => d.name === name));
            zip.file(name, bytes, { createFolders: false });
            documents.push({ name, storageReference: String(row.storage_reference), fileChecksum: String(row.file_checksum), receiptId: String(row.receipt_id), version: Number(row.version) });
        }
        const manifest: Manifest = { format: 'fitimi-paired/1', id, createdAt, retainUntil: new Date(Date.parse(createdAt) + 30 * 86400000).toISOString(), sourceIdentity: source, owner, databaseSha256: checksum(sql), ...digest, documents };
        zip.file('manifest.json', JSON.stringify(manifest));
        const plain = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' }), encrypted = encryptBackup(plain, key);
        await validatePairedArchive(encrypted, key, source);
        const root = await privateDirectory(output), part = resolve(root, `${id}.part`), final = resolve(root, `${id}.fitimi`);
        const file = await fs.open(part, 'wx', 0o600);
        try {
            await file.writeFile(encrypted.subarray(0, Math.floor(encrypted.length / 2)));
            await fault();
            await file.writeFile(encrypted.subarray(Math.floor(encrypted.length / 2)));
            await file.sync();
        }
        catch (error) {
            await file.close();
            await fs.unlink(part);
            throw error;
        }
        await file.close();
        await fs.link(part, final);
        await fs.unlink(part);
        await fs.chmod(final, 0o400);
        securitySignal('backup.prepared');
        return { file: final, manifest, bytes: encrypted.length };
    }
    catch (error) {
        securitySignal('backup.failed');
        throw error;
    }
    finally {
        await thaw?.();
        await c.query('DO RELEASE_LOCK(?)', [lock]);
    }
}
export async function restorePairedBackup(c: Connection, operator: OperatorContext, data: Buffer, key: Buffer, approveSource: string, targetRoot: string, importSql: (sql: Buffer) => Promise<void>) {
    requireOperator(operator);
    const target = await identity(c);
    assert.notEqual(target, approveSource);
    const paired = await validatePairedArchive(data, key, approveSource), [tables] = await c.query<RowDataPacket[]>('SHOW TABLES');
    assert.equal(tables.length, 0, 'Restore only to a verified fresh isolated target.');
    const root = resolve(targetRoot);
    assert.equal(await fs.stat(root).then(() => true, () => false), false);
    await privateDirectory(root);
    try {
        for (const [name, bytes] of paired.documents) {
            const file = resolve(root, name.split('/')[1]);
            assert.equal(dirname(file), root);
            const h = await fs.open(file, 'wx', 0o400);
            try {
                await h.writeFile(bytes);
                await h.sync();
            }
            finally {
                await h.close();
            }
        }
        await importSql(paired.sql);
        const actual = await databaseDigest(c);
        assert.deepEqual(actual.tables, paired.manifest.tables);
        assert.deepEqual(actual.triggers, paired.manifest.triggers);
        const [refs] = await c.query<RowDataPacket[]>('SELECT storage_reference,file_checksum FROM receipt_versions');
        assert.equal(refs.length, paired.documents.size);
        for (const row of refs) {
            const name = 'receipts/' + String(row.storage_reference).split('/').at(-1);
            assert(paired.documents.has(name));
            assert.equal(checksum(paired.documents.get(name)!), String(row.file_checksum));
        }
        await c.query('UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE revoked_at IS NULL');
        await c.query('UPDATE users SET auth_version=auth_version+1');
        await securityEvent(c, 'restore_completed', paired.manifest.id, null, { status: 'sessions_revoked' });
        const owner = { ...paired.manifest.owner, database: target };
        await fs.writeFile(resolve(root, '.owner.json'), JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
        securitySignal('restore.completed');
        return { manifest: paired.manifest, targetIdentity: target, owner };
    }
    catch (error) {
        securitySignal('restore.failed');
        throw error;
    }
}
