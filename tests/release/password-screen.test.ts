import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { hashPassword, verifyPassword } from '../../src/server/auth/password';
test('offline screening rejects common long passwords without changing existing password verification', async () => { const list = readFileSync('assets/security/common-passwords.txt', 'utf8').trim().split(/\r?\n/); assert(new Set(list).size >= 3000); const common = list.find(p => p.length >= 12)!; assert(common); assert.throws(() => hashPassword(common)); const value = 'An individually chosen long phrase 73!'; const encoded = await hashPassword(value); assert(await verifyPassword(value, encoded)); });
