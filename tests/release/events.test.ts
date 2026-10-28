import assert from 'node:assert/strict';
import test from 'node:test';
import { securitySignal } from '../../src/server/operations/events';
test('security events are structured, bounded and exclude caller secrets or business values', t => { const rows: string[] = []; t.mock.method(console, 'warn', (value: string) => rows.push(value)); for (let i = 0; i < 30; i++)
    securitySignal('access.denied', 401); assert.equal(rows.length, 20); for (const row of rows) {
    const data = JSON.parse(row);
    assert.deepEqual(Object.keys(data).sort(), ['correlation', 'event', 'status', 'time']);
    assert.equal(data.status, 401);
} assert.throws(() => securitySignal('password' as never)); });
