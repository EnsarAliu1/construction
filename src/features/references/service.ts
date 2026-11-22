import {lockBusinessUser} from "@/server/db/user-lock";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, or, sql } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import type { Connection } from "mysql2/promise";
import { auditEvents, entityVersions, expenseCategories, expenses, persons, users, vehicles } from "@/server/db/schema";
import { safeHistorySnapshot } from "@/server/db/history-snapshot";
import { requireSessionUser } from "@/server/auth/sessions";
import { escapedSearch } from "@/features/clients/validation";
import { referenceDefinitions, type ReferenceInput, type ReferenceKind, type ReferenceRecord } from "./model";
import { ReferenceError, parseReference, parseReferenceQuery, referenceId, referenceObject, referenceVersion } from "./validation";

type Db = MySql2Database<Record<string, never>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
const tableFor = (kind: ReferenceKind) => kind === "categories" ? expenseCategories : kind === "persons" ? persons : vehicles;
const labelFor = (kind: ReferenceKind) => kind === "categories" ? expenseCategories.name : kind === "persons" ? persons.name : vehicles.identifier;
function normalized(row: Omit<ReferenceRecord, "label">): ReferenceRecord { return { ...row, label: row.name ?? row.identifier ?? "" }; }
function search(kind: ReferenceKind, q: string) {
  const columns = kind === "categories" ? [expenseCategories.name] : kind === "persons" ? [persons.name, persons.email, persons.phone, persons.identificationReference, persons.address] : [vehicles.identifier, vehicles.description];
  return q ? or(...columns.map(column => sql`${column} LIKE ${escapedSearch(q)} ESCAPE '='`)) : undefined;
}
async function find(db: Pick<Db, "select">, kind: ReferenceKind, id: string, lock = false) {
  const table = tableFor(kind), query = db.select().from(table).where(eq(table.id, id)).limit(1);
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw new ReferenceError("NOT_FOUND", "Të dhënat nuk u gjetën.", 404);
  return normalized(row);
}
async function writeAudit(tx: Tx, kind: ReferenceKind, actorId: string, action: string, before: ReferenceRecord | null, after: ReferenceRecord) {
  function snapshot(row: ReferenceRecord) { const { label: _label, ...fields } = row; void _label; return safeHistorySnapshot(fields); }
  const entityType = referenceDefinitions[kind].entity, afterSnapshot = snapshot(after);
  await tx.insert(auditEvents).values({ id: randomUUID(), actorId, entityType, entityId: after.id, action, beforeSnapshot: before ? snapshot(before) : null, afterSnapshot, operationId: randomUUID() });
  await tx.insert(entityVersions).values({ id: randomUUID(), entityType, entityId: after.id, version: after.version, snapshot: afterSnapshot });
}
function duplicate(error: unknown, constraint: string): boolean {
  if (!error || typeof error !== "object") return false;
  if ("errno" in error && error.errno === 1062 && "sqlMessage" in error && typeof error.sqlMessage === "string" && error.sqlMessage.includes(constraint)) return true;
  return "cause" in error && error.cause !== error && duplicate(error.cause, constraint);
}
async function mutation<P, R>(connection: Connection, token: string | undefined, kind: ReferenceKind, parse: () => P, work: (tx: Tx, input: P, actor: string) => Promise<R>) {
  const identity = await requireSessionUser(connection, token); const input = parse();
  try {
    return await drizzle(connection).transaction(async tx => {
      await lockBusinessUser(tx,connection,identity.id);
      const actor = await requireSessionUser(connection, token);
      return work(tx, input, actor.id);
    }, { isolationLevel: "read committed" });
  } catch (error) {
    if (kind !== "persons" && duplicate(error, kind === "categories" ? "expense_categories_name_uq" : "vehicles_identifier_uq")) {
      const field = kind === "categories" ? "name" : "identifier";
      throw new ReferenceError("DUPLICATE", "Ky emër ose identifikues i përket të dhënave ekzistuese, përfshirë ato joaktive. Gjeni regjistrimin fillestar në vend që të krijoni dublikatë.", 409, { [field]: "Është regjistruar më parë. Ndryshimet e shkronjave të mëdha ose thekseve nuk krijojnë identitet të veçantë." });
    }
    throw error;
  }
}
async function insert(tx: Tx, kind: ReferenceKind, id: string, value: ReferenceInput, actor: string) {
  const metadata = { id, createdBy: actor, updatedBy: actor };
  if (kind === "categories") await tx.insert(expenseCategories).values({ ...metadata, name: value.name! });
  else if (kind === "persons") await tx.insert(persons).values({ ...metadata, name: value.name!, email: value.email, phone: value.phone, identificationReference: value.identificationReference, address: value.address });
  else await tx.insert(vehicles).values({ ...metadata, identifier: value.identifier!, description: value.description });
}
async function edit(tx: Tx, kind: ReferenceKind, id: string, value: ReferenceInput, metadata: { version: number; updatedBy: string }) {
  if (kind === "categories") await tx.update(expenseCategories).set({ ...metadata, name: value.name!, updatedAt: sql`UTC_TIMESTAMP(3)` }).where(eq(expenseCategories.id, id));
  else if (kind === "persons") await tx.update(persons).set({ ...metadata, name: value.name!, email: value.email, phone: value.phone, identificationReference: value.identificationReference, address: value.address, updatedAt: sql`UTC_TIMESTAMP(3)` }).where(eq(persons.id, id));
  else await tx.update(vehicles).set({ ...metadata, identifier: value.identifier!, description: value.description, updatedAt: sql`UTC_TIMESTAMP(3)` }).where(eq(vehicles.id, id));
}
/** Internal transaction primitive. Caller must authenticate, hold the user lock and own the transaction. */
export async function insertCategoryInTransaction(tx: Tx, name: string, actor: string, operationId: string = randomUUID()) {
  const value = parseReference("categories", { name });
  const id = randomUUID();
  try { await insert(tx, "categories", id, value, actor); }
  catch (error) {
    if (duplicate(error, "expense_categories_name_uq")) throw new ReferenceError("DUPLICATE", "Kjo kategori ekziston, përfshirë kategoritë joaktive.", 409, { newCategoryName: "Zgjidhni kategorinë ekzistuese ose përdorni emër tjetër." });
    throw error;
  }
  const after = await find(tx, "categories", id);
  const { label: _label, ...fields } = after; void _label;
  const snapshot = safeHistorySnapshot(fields);
  await tx.insert(auditEvents).values({ id: randomUUID(), actorId: actor, operationId, entityType: "expense_category", entityId: id, action: "reference_created", afterSnapshot: snapshot });
  await tx.insert(entityVersions).values({ id: randomUUID(), entityType: "expense_category", entityId: id, version: 1, snapshot });
  return after;
}
export async function createReference(connection: Connection, token: string | undefined, kind: ReferenceKind, value: unknown) {
  return mutation(connection, token, kind, () => parseReference(kind, value), async (tx, input, actor) => {
    if (kind === "categories") {
      try { return await insertCategoryInTransaction(tx, input.name!, actor); }
      catch (error) {
        if (error instanceof ReferenceError && error.code === "DUPLICATE") throw new ReferenceError("DUPLICATE", error.message, 409, { name: "Është regjistruar më parë. Ndryshimet e shkronjave të mëdha ose thekseve nuk krijojnë identitet të veçantë." });
        throw error;
      }
    }
    const id = randomUUID(); await insert(tx, kind, id, input, actor); const after = await find(tx, kind, id);
    await writeAudit(tx, kind, actor, "reference_created", null, after); return after;
  });
}
export async function updateReference(connection: Connection, token: string | undefined, kind: ReferenceKind, id: string, value: unknown) {
  return mutation(connection, token, kind, () => { referenceId(id); const body = referenceObject(value, ["version", "record"]); return { version: referenceVersion(body.version), record: parseReference(kind, body.record) }; }, async (tx, input, actor) => {
    const before = await find(tx, kind, id, true);
    if (before.version !== input.version) throw new ReferenceError("CONFLICT", "Të dhënat janë ndryshuar. Ringarkoni versionin e fundit para ruajtjes.", 409);
    // Corrections to inactive records are allowed; ordinary edits never change status.
    await edit(tx, kind, id, input.record, { version: before.version + 1, updatedBy: actor }); const after = await find(tx, kind, id);
    await writeAudit(tx, kind, actor, "reference_updated", before, after); return after;
  });
}
export async function changeReferenceLifecycle(connection: Connection, token: string | undefined, kind: ReferenceKind, id: string, value: unknown) {
  return mutation(connection, token, kind, () => {
    referenceId(id); const body = referenceObject(value, ["version", "action", "confirmation"]);
    if ((body.action !== "deactivate" && body.action !== "reactivate") || body.confirmation !== body.action) throw new ReferenceError("CONFIRMATION", "Konfirmoni shprehimisht çaktivizimin ose riaktivizimin.");
    return { version: referenceVersion(body.version), active: body.action === "reactivate" };
  }, async (tx, input, actor) => {
    const before = await find(tx, kind, id, true);
    if (before.version !== input.version) throw new ReferenceError("CONFLICT", "Të dhënat janë ndryshuar. Ringarkoni versionin e fundit para ndryshimit të gjendjes.", 409);
    if (before.isActive === input.active) throw new ReferenceError("LIFECYCLE", `Këto të dhëna janë tashmë ${input.active ? "active" : "inactive"}.`, 409);
    const table = tableFor(kind);
    await tx.update(table).set({ isActive: input.active, version: before.version + 1, updatedBy: actor, deactivatedBy: input.active ? null : actor, deactivatedAt: input.active ? null : sql`UTC_TIMESTAMP(3)`, updatedAt: sql`UTC_TIMESTAMP(3)` }).where(eq(table.id, id));
    const after = await find(tx, kind, id); await writeAudit(tx, kind, actor, input.active ? "reference_reactivated" : "reference_deactivated", before, after); return after;
  });
}
export async function listReferences(connection: Connection, token: string | undefined, kind: ReferenceKind, value: Record<string, unknown> = {}) {
  await requireSessionUser(connection, token); const query = parseReferenceQuery(value), table = tableFor(kind), db = drizzle(connection);
  const where = and(query.status === "all" ? undefined : eq(table.isActive, query.status === "active"), search(kind, query.q));
  const [total] = await db.select({ value: count() }).from(table).where(where);
  const rows = await db.select().from(table).where(where).orderBy(asc(labelFor(kind)), asc(table.id)).limit(20).offset((query.page - 1) * 20);
  return { rows: rows.map(normalized), total: Number(total.value), pageSize: 20, query };
}
export async function getReference(connection: Connection, token: string | undefined, kind: ReferenceKind, id: string) {
  await requireSessionUser(connection, token); referenceId(id); const db = drizzle(connection), record = await find(db, kind, id);
  const entityType = referenceDefinitions[kind].entity;
  const history = await db.select({ id: auditEvents.id, action: auditEvents.action, actorName: users.displayName, recordedAt: auditEvents.recordedAt, before: auditEvents.beforeSnapshot, after: auditEvents.afterSnapshot }).from(auditEvents).leftJoin(users, eq(users.id, auditEvents.actorId)).where(and(eq(auditEvents.entityType, entityType), eq(auditEvents.entityId, id))).orderBy(desc(auditEvents.recordedAt), desc(auditEvents.id)).limit(20);
  const column = kind === "categories" ? expenses.categoryId : kind === "persons" ? expenses.personId : expenses.vehicleId;
  const [usage] = await db.select({ value: count() }).from(expenses).where(eq(column, id));
  return { record, history, expenseReferences: Number(usage.value) };
}
export async function selectActiveReferences(connection: Connection, token: string | undefined, kind: ReferenceKind, q: string = "") {
  await requireSessionUser(connection, token); const query = parseReferenceQuery({ q }), table = tableFor(kind);
  return drizzle(connection).select({ id: table.id, label: labelFor(kind), version: table.version }).from(table).where(and(eq(table.isActive, true), search(kind, query.q))).orderBy(asc(labelFor(kind)), asc(table.id)).limit(20);
}
export const activeCategories = (c: Connection, token: string | undefined, q = "") => selectActiveReferences(c, token, "categories", q);
export const activePersons = (c: Connection, token: string | undefined, q = "") => selectActiveReferences(c, token, "persons", q);
export const activeVehicles = (c: Connection, token: string | undefined, q = "") => selectActiveReferences(c, token, "vehicles", q);
