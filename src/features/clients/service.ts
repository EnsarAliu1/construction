import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import type { Connection } from "mysql2/promise";
import { auditEvents, clients, entityVersions, projects, users } from "@/server/db/schema";
import { safeHistorySnapshot } from "@/server/db/history-snapshot";
import { requireSessionUser } from "@/server/auth/sessions";
import { PAGE_SIZE, ClientArchived, ClientConflict, ClientHasOpenProjects, ClientNotFound, ClientValidationError, escapedSearch, parseClientId, parseClientInput, parseClientQuery, parseVersion } from "./validation";
import type { ClientRecord } from "./model";

type Database = MySql2Database<Record<string, never>>;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function authorizedMutation<T>(connection: Connection, token: string | undefined, work: (tx: Tx, actorId: string) => Promise<T>) {
  // Authenticate before any input-specific lookup, then lock/recheck live identity
  // inside the transaction so deactivation cannot race an authorized mutation.
  const identity = await requireSessionUser(connection, token);
  return drizzle(connection).transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, identity.id)).for("share");
    const current = await requireSessionUser(connection, token);
    return work(tx, current.id);
  });
}

async function auditChange(tx: Tx, actorId: string, action: string, before: ClientRecord | null, after: ClientRecord) {
  const snapshot = safeHistorySnapshot({ ...after });
  await tx.insert(auditEvents).values({
    id: randomUUID(), actorId, entityType: "client", entityId: after.id, action,
    beforeSnapshot: before ? safeHistorySnapshot({ ...before }) : null,
    afterSnapshot: snapshot, operationId: randomUUID(),
  });
  await tx.insert(entityVersions).values({ id: randomUUID(), entityType: "client", entityId: after.id, version: after.version, snapshot });
}

async function lockedClient(tx: Tx, id: string, version: unknown) {
  parseClientId(id); const expected = parseVersion(version);
  const [current] = await tx.select().from(clients).where(eq(clients.id, id)).for("update");
  if (!current) throw new ClientNotFound();
  if (current.deletedAt) throw new ClientArchived();
  if (current.version !== expected) throw new ClientConflict();
  return current;
}

export async function createClient(connection: Connection, token: string | undefined, value: unknown) {
  return authorizedMutation(connection, token, async (tx, actorId) => {
    const input = parseClientInput(value); const id = randomUUID();
    await tx.insert(clients).values({ ...input, id, createdBy: actorId, updatedBy: actorId });
    const [after] = await tx.select().from(clients).where(eq(clients.id, id));
    await auditChange(tx, actorId, "client_created", null, after);
    return after;
  });
}

export async function updateClient(connection: Connection, token: string | undefined, id: string, version: unknown, value: unknown) {
  return authorizedMutation(connection, token, async (tx, actorId) => {
    const input = parseClientInput(value);
    const before = await lockedClient(tx, id, version);
    await tx.update(clients).set({ ...input, version: before.version + 1, updatedBy: actorId, updatedAt: sql`UTC_TIMESTAMP(3)` })
      .where(and(eq(clients.id, id), eq(clients.version, before.version), isNull(clients.deletedAt)));
    const [after] = await tx.select().from(clients).where(eq(clients.id, id));
    await auditChange(tx, actorId, "client_updated", before, after);
    return after;
  });
}

export async function archiveClient(connection: Connection, token: string | undefined, id: string, version: unknown, confirmation: unknown) {
  return authorizedMutation(connection, token, async (tx, actorId) => {
    if (confirmation !== "archive") throw new ClientValidationError({ form: "Confirm that this client should be archived." });
    const before = await lockedClient(tx, id, version);
    const linked = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.clientId, id), isNull(projects.deletedAt), inArray(projects.status, ["active", "suspended"]))).limit(1).for("update");
    if (linked.length) throw new ClientHasOpenProjects();
    await tx.update(clients).set({ deletedAt: sql`UTC_TIMESTAMP(3)`, deletedBy: actorId, updatedBy: actorId, version: before.version + 1, updatedAt: sql`UTC_TIMESTAMP(3)` })
      .where(and(eq(clients.id, id), eq(clients.version, before.version), isNull(clients.deletedAt)));
    const [after] = await tx.select().from(clients).where(eq(clients.id, id));
    await auditChange(tx, actorId, "client_archived", before, after);
    return after;
  });
}

export async function listClients(connection: Connection, token: string | undefined, value: { q?: unknown; type?: unknown; page?: unknown } = {}) {
  await requireSessionUser(connection, token);
  const query = parseClientQuery(value);
  const pattern = escapedSearch(query.q);
  const conditions = and(isNull(clients.deletedAt), query.type === "all" ? undefined : eq(clients.type, query.type), query.q ? or(
    ...[clients.name, clients.email, clients.phone, clients.nui, clients.city, clients.addressLine1].map(column => sql`${column} LIKE ${pattern} ESCAPE '='`)
  ) : undefined);
  const db = drizzle(connection);
  const [total] = await db.select({ value: count() }).from(clients).where(conditions);
  const rows = await db.select().from(clients).where(conditions).orderBy(asc(clients.name), asc(clients.id)).limit(PAGE_SIZE).offset((query.page - 1) * PAGE_SIZE);
  return { rows, total: Number(total.value), pageSize: PAGE_SIZE, query };
}

export async function getClient(connection: Connection, token: string | undefined, id: string) {
  await requireSessionUser(connection, token); parseClientId(id);
  const db = drizzle(connection);
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!client) throw new ClientNotFound();
  const relatedProjects = await db.select({ id: projects.id, name: projects.name, status: projects.status, deletedAt: projects.deletedAt }).from(projects).where(eq(projects.clientId, id)).orderBy(desc(projects.createdAt), asc(projects.id)).limit(5);
  const [projectCount] = await db.select({ value: count() }).from(projects).where(eq(projects.clientId, id));
  const [openProjects] = await db.select({ value: count() }).from(projects).where(and(eq(projects.clientId, id), isNull(projects.deletedAt), inArray(projects.status, ["active", "suspended"])));
  const history = await db.select({ id: auditEvents.id, action: auditEvents.action, actorName: users.displayName, recordedAt: auditEvents.recordedAt, before: auditEvents.beforeSnapshot, after: auditEvents.afterSnapshot }).from(auditEvents).leftJoin(users, eq(auditEvents.actorId, users.id))
    .where(and(eq(auditEvents.entityType, "client"), eq(auditEvents.entityId, id))).orderBy(desc(auditEvents.recordedAt), desc(auditEvents.id)).limit(20);
  return { client, relatedProjects, projectCount: Number(projectCount.value), hasOpenProjects: Number(openProjects.value) > 0, history };
}
