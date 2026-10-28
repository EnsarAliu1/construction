import { randomUUID } from "node:crypto";
const kinds = ['access.denied', 'request.throttled', 'service.unavailable', 'receipt.integrity_failed', 'export.prepared', 'backup.prepared', 'restore.completed', 'backup.failed', 'restore.failed'] as const;
type Kind = typeof kinds[number];
const windows = new Map<Kind, {
    start: number;
    count: number;
}>();
/** No actor/record/URL/body/error fields accepted. Per-process bound prevents log flooding. */
export function securitySignal(kind: Kind, status?: number) {
    if (!kinds.includes(kind) || status !== undefined && (!Number.isInteger(status) || status < 100 || status > 599))
        throw new Error('Invalid security signal.');
    const now = Date.now(), previous = windows.get(kind), window = previous && now - previous.start < 60000 ? previous : { start: now, count: 0 };
    windows.set(kind, window);
    window.count++;
    if (window.count > 20)
        return;
    console.warn(JSON.stringify({ event: kind, time: new Date(now).toISOString(), correlation: randomUUID(), ...(status ? { status } : {}) }));
}
