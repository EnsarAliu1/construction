import { randomUUID } from "node:crypto";
import type { Connection } from "mysql2/promise";
import { loadLocalEnvironment, localDatabaseOptions, openLocalConnection } from "../db/config";
import { safeHistorySnapshot, type HistorySnapshot } from "../db/history-snapshot";
import {demoMode} from '../demo/policy';

export async function withAuthConnection<T>(work: (connection: Connection) => Promise<T>) {
  if(!demoMode())loadLocalEnvironment();
  const connection = demoMode() ? await (await import('../demo/runtime')).openDemoConnection() : await openLocalConnection(localDatabaseOptions(process.env.DATABASE_URL, "development", process.env.DATABASE_DISPOSABLE));
  try { return await work(connection); } finally { await connection.end(); }
}

export async function transaction<T>(connection: Connection, work: () => Promise<T>) {
  await connection.beginTransaction();
  try { const result = await work(); await connection.commit(); return result; }
  catch (error) {
    await connection.rollback();
    if (error && typeof error === "object" && "code" in error && "errno" in error) {
      throw Object.assign(new Error("Authentication database operation rejected"), { code: String(error.code), errno: Number(error.errno) });
    }
    throw error;
  }
}

export async function securityEvent(connection: Connection, action: string, entityId: string, actorId: string | null, snapshot: HistorySnapshot = {}) {
  await connection.execute("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_snapshot, operation_id) VALUES (?, ?, 'authentication', ?, ?, ?, ?)",
    [randomUUID(), actorId, entityId, action, JSON.stringify(safeHistorySnapshot(snapshot)), randomUUID()]);
}
