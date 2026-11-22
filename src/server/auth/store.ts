import { randomUUID } from "node:crypto";
import type { Connection } from "mysql2/promise";
import {openApplicationConnection} from '../db/application';
import { safeHistorySnapshot, type HistorySnapshot } from "../db/history-snapshot";
import {isTidbConnection} from '../db/tidb';

export async function withAuthConnection<T>(work: (connection: Connection) => Promise<T>) {
  const {connection,close}=await openApplicationConnection();
  try { return await work(connection); } finally { await close(); }
}

export async function transaction<T>(connection: Connection, work: () => Promise<T>) {
  // TiDB snapshot reads must observe the generation committed before the physical user lock.
  if(isTidbConnection(connection))await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
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
