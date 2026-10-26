import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import type { Connection } from "mysql2/promise";
import { auditEvents, clients, contractPhases, contracts, entityVersions, paymentAllocations, payments, projects, users } from "@/server/db/schema";
import { requireSessionUser } from "@/server/auth/sessions";
import { safeHistorySnapshot } from "@/server/db/history-snapshot";
import { escapedSearch } from "@/features/clients/validation";
import { cents, decimal } from "./money";
import { MAX_PHASES, PROJECT_PAGE_SIZE, ProjectError, conflict, expectedVersion, object, parsePlan, parseProject, parseProjectQuery, uuid, type ContractPlan } from "./validation";

type Db = MySql2Database<Record<string, never>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type ClientChoice = { id: string; name: string; version: number };

async function mutation<P, R>(connection: Connection, token: string | undefined, parse: () => P, work: (tx: Tx, input: P, actor: string, operation: string) => Promise<R>) {
  const identity = await requireSessionUser(connection, token);
  const input = parse();
  return drizzle(connection).transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, identity.id)).for("share");
    const actor = await requireSessionUser(connection, token);
    return work(tx, input, actor.id, randomUUID());
  }, { isolationLevel: "read committed" });
}
async function record(tx: Tx, actorId: string, operationId: string, entityType: string, action: string, before: object | null, after: { id: string; version: number }) {
  const snapshot = safeHistorySnapshot({ ...after });
  await tx.insert(auditEvents).values({ id: randomUUID(), actorId, operationId, entityType, entityId: after.id, action, beforeSnapshot: before ? safeHistorySnapshot({ ...before }) : null, afterSnapshot: snapshot });
  await tx.insert(entityVersions).values({ id: randomUUID(), entityType, entityId: after.id, version: after.version, snapshot });
}
async function lockClients(tx: Tx, ids: string[]) {
  return tx.select().from(clients).where(inArray(clients.id, [...new Set(ids)].sort())).orderBy(asc(clients.id)).for("update");
}
function activeClient(rows: Awaited<ReturnType<typeof lockClients>>, id: string, version: number) {
  const client = rows.find(row => row.id === id);
  if (!client) throw new ProjectError("CLIENT", "Select an existing active client.");
  if (client.deletedAt) throw new ProjectError("ARCHIVED_CLIENT", "This client is archived. Select an active client.", 409);
  if (client.version !== version) throw conflict();
}
async function lockProject(tx: Tx, id: string, version: number, targetClientId?: string) {
  // Preflight discovers lock targets only. Recheck under locks; never acquire a
  // missing parent after locking its child. Matches WP-04 client -> project order.
  const [hint] = await tx.select({ clientId: projects.clientId }).from(projects).where(eq(projects.id, id)).limit(1);
  if (!hint) throw new ProjectError("NOT_FOUND", "Project not found.", 404);
  const parents = await lockClients(tx, [hint.clientId, ...(targetClientId ? [targetClientId] : [])]);
  const [project] = await tx.select().from(projects).where(eq(projects.id, id)).for("update");
  if (!project || project.deletedAt) throw new ProjectError("NOT_FOUND", "Project not found.", 404);
  if (project.clientId !== hint.clientId || project.version !== version) throw conflict();
  return { project, parents };
}
async function allocations(db: Pick<Db, "select">, phaseIds: string[], projectId: string) {
  if (!phaseIds.length) return new Map<string, bigint>();
  // Mutation callers already hold client/project/contract/phase aggregate locks.
  // Future allocation AND payment-status writers must hold the same parent locks.
  // READ COMMITTED sees their latest committed totals after waiting for the lock.
  const rows = await db.select({ phaseId: paymentAllocations.phaseId,
    paid: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'received' THEN ${paymentAllocations.amount} ELSE 0 END), 0)`,
    invalid: sql<number>`SUM(CASE WHEN ${payments.projectId} <> ${projectId} THEN 1 ELSE 0 END)`,
  }).from(paymentAllocations).innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .where(inArray(paymentAllocations.phaseId, phaseIds)).groupBy(paymentAllocations.phaseId).limit(MAX_PHASES);
  if (rows.some(row => Number(row.invalid) > 0)) throw new ProjectError("ALLOCATION_RELATIONSHIP", "Stored allocations have an invalid project relationship and require correction.", 409);
  return new Map(rows.map(row => [row.phaseId, BigInt(String(row.paid).replace(".", ""))]));
}

async function insertContract(tx: Tx, projectId: string, plan: ContractPlan, actor: string, operation: string) {
  if (plan.phases.some(phase => phase.id) || plan.deletedPhases.length || plan.contractId || plan.version !== null) throw new ProjectError("PHASE_ID", "A new contract accepts only new phases and no existing identities.");
  const id = randomUUID();
  await tx.insert(contracts).values({ id, projectId, totalValue: plan.totalValue, status: "active", activatedAt: sql`UTC_TIMESTAMP(3)`, createdBy: actor, updatedBy: actor });
  const [contract] = await tx.select().from(contracts).where(eq(contracts.id, id));
  await record(tx, actor, operation, "contract", "contract_created", null, contract);
  for (const phase of plan.phases) {
    const phaseId = randomUUID();
    await tx.insert(contractPhases).values({ id: phaseId, contractId: id, name: phase.name, description: phase.description, value: phase.value, sortOrder: phase.sortOrder, createdBy: actor, updatedBy: actor });
    const [saved] = await tx.select().from(contractPhases).where(eq(contractPhases.id, phaseId));
    await record(tx, actor, operation, "phase", "phase_created", null, saved);
  }
  return contract;
}

export async function createProject(connection: Connection, token: string | undefined, value: unknown) {
  return mutation(connection, token, () => {
    const body = object(value, ["project", "contract"]);
    return { project: parseProject(body.project), plan: parsePlan(body.contract, true) };
  }, async (tx, { project, plan }, actor, operation) => {
    activeClient(await lockClients(tx, [project.clientId]), project.clientId, project.clientVersion);
    const { clientVersion: _clientVersion, ...fields } = project; void _clientVersion;
    const id = randomUUID();
    await tx.insert(projects).values({ ...fields, id, createdBy: actor, updatedBy: actor });
    const [saved] = await tx.select().from(projects).where(eq(projects.id, id));
    await record(tx, actor, operation, "project", "project_created", null, saved);
    await insertContract(tx, id, plan, actor, operation);
    return saved;
  });
}
export async function updateProject(connection: Connection, token: string | undefined, id: string, value: unknown) {
  return mutation(connection, token, () => {
    uuid(id); const body = object(value, ["version", "project"]);
    return { version: expectedVersion(body.version), project: parseProject(body.project) };
  }, async (tx, input, actor, operation) => {
    const { project: before, parents } = await lockProject(tx, id, input.version, input.project.clientId);
    activeClient(parents, input.project.clientId, input.project.clientVersion);
    const { clientVersion: _clientVersion, ...fields } = input.project; void _clientVersion;
    await tx.update(projects).set({ ...fields, version: before.version + 1, updatedBy: actor, updatedAt: sql`UTC_TIMESTAMP(3)` }).where(eq(projects.id, id));
    const [after] = await tx.select().from(projects).where(eq(projects.id, id));
    await record(tx, actor, operation, "project", "project_updated", before, after);
    return after;
  });
}
export async function saveContract(connection: Connection, token: string | undefined, projectId: string, value: unknown) {
  return mutation(connection, token, () => { uuid(projectId); return parsePlan(value); }, async (tx, plan, actor, operation) => {
    await lockProject(tx, projectId, plan.projectVersion!);
    const [before] = await tx.select().from(contracts).where(eq(contracts.projectId, projectId)).for("update");
    if (!before) return insertContract(tx, projectId, plan, actor, operation);
    if (plan.contractId === null) throw conflict();
    if (before.id !== plan.contractId) throw new ProjectError("CONTRACT", "The contract does not belong to this project.");
    if (before.status === "cancelled") throw new ProjectError("CANCELLED", "Cancelled contracts are retained read-only; restoration is outside this workflow.", 409);
    if (before.version !== plan.version) throw conflict();
    const current = await tx.select().from(contractPhases).where(and(eq(contractPhases.contractId, before.id), isNull(contractPhases.deletedAt))).orderBy(asc(contractPhases.id)).limit(MAX_PHASES + 1).for("update");
    if (current.length > MAX_PHASES) throw new ProjectError("PHASE_LIMIT", "This historical contract exceeds the editor's supported phase limit.", 409);
    const submitted = [...plan.phases.filter(phase => phase.id), ...plan.deletedPhases];
    if (submitted.length !== current.length || current.some(row => !submitted.some(phase => phase.id === row.id))) throw new ProjectError("PHASE_SET", "Include every active phase exactly once, either retained or explicitly removed. Foreign, unknown or archived phases cannot be changed.");
    for (const phase of submitted) if (current.find(row => row.id === phase.id)?.version !== phase.version) throw conflict();
    const paid = await allocations(tx, current.map(row => row.id), projectId);
    for (const phase of plan.phases) if (phase.id && cents(phase.value) < (paid.get(phase.id) ?? BigInt(0))) throw new ProjectError("CAPACITY", `Phase '${phase.name}' cannot be reduced below its active paid amount of ${decimal(paid.get(phase.id)!)} EUR.`, 409);
    for (const phase of plan.deletedPhases) if ((paid.get(phase.id) ?? BigInt(0)) > BigInt(0)) throw new ProjectError("PAID_PHASE", "A phase with active allocations cannot be archived. Cancelled-payment history alone does not block removal.", 409);
    for (const phase of plan.phases) {
      const old = current.find(row => row.id === phase.id);
      if (old) {
        if (old.name === phase.name && old.description === phase.description && old.value === phase.value && old.sortOrder === phase.sortOrder) continue;
        await tx.update(contractPhases).set({ name: phase.name, description: phase.description, value: phase.value, sortOrder: phase.sortOrder, version: old.version + 1, updatedBy: actor, updatedAt: sql`UTC_TIMESTAMP(3)` }).where(eq(contractPhases.id, old.id));
        const [after] = await tx.select().from(contractPhases).where(eq(contractPhases.id, old.id));
        await record(tx, actor, operation, "phase", "phase_updated", old, after);
      } else {
        const id = randomUUID();
        await tx.insert(contractPhases).values({ id, contractId: before.id, name: phase.name, description: phase.description, value: phase.value, sortOrder: phase.sortOrder, createdBy: actor, updatedBy: actor });
        const [after] = await tx.select().from(contractPhases).where(eq(contractPhases.id, id));
        await record(tx, actor, operation, "phase", "phase_created", null, after);
      }
    }
    for (const phase of plan.deletedPhases) {
      const old = current.find(row => row.id === phase.id)!;
      await tx.update(contractPhases).set({ deletedAt: sql`UTC_TIMESTAMP(3)`, deletedBy: actor, updatedBy: actor, version: old.version + 1, updatedAt: sql`UTC_TIMESTAMP(3)` }).where(eq(contractPhases.id, phase.id));
      const [after] = await tx.select().from(contractPhases).where(eq(contractPhases.id, phase.id));
      await record(tx, actor, operation, "phase", "phase_archived", old, after);
    }
    await tx.update(contracts).set({ totalValue: plan.totalValue, version: before.version + 1, updatedBy: actor, status: "active", activatedAt: before.activatedAt ?? sql`UTC_TIMESTAMP(3)`, updatedAt: sql`UTC_TIMESTAMP(3)` }).where(eq(contracts.id, before.id));
    const [after] = await tx.select().from(contracts).where(eq(contracts.id, before.id));
    await record(tx, actor, operation, "contract", "contract_updated", before, after);
    return after;
  });
}
export async function chooseClients(connection: Connection, token: string | undefined, q: unknown = ""): Promise<ClientChoice[]> {
  await requireSessionUser(connection, token);
  if (typeof q !== "string" || q.length > 100) throw new ProjectError("SEARCH", "Client search must be at most 100 characters.");
  return drizzle(connection).select({ id: clients.id, name: clients.name, version: clients.version }).from(clients).where(and(isNull(clients.deletedAt), q.trim() ? sql`${clients.name} LIKE ${escapedSearch(q.trim())} ESCAPE '='` : undefined)).orderBy(asc(clients.name), asc(clients.id)).limit(20);
}
export async function listProjects(connection: Connection, token: string | undefined, value: Record<string, unknown> = {}) {
  await requireSessionUser(connection, token); const query = parseProjectQuery(value); const db = drizzle(connection);
  const where = and(isNull(projects.deletedAt), query.status === "all" ? undefined : eq(projects.status, query.status as "active" | "suspended" | "completed"), query.clientId ? eq(projects.clientId, query.clientId) : undefined,
    query.q ? or(...[projects.name, projects.location, clients.name].map(column => sql`${column} LIKE ${escapedSearch(query.q)} ESCAPE '='`)) : undefined);
  const [total] = await db.select({ value: count() }).from(projects).innerJoin(clients, eq(clients.id, projects.clientId)).where(where);
  const rows = await db.select({ id: projects.id, name: projects.name, clientId: projects.clientId, clientName: clients.name, status: projects.status, startDate: projects.startDate, endDate: projects.endDate, totalValue: contracts.totalValue })
    .from(projects).innerJoin(clients, eq(clients.id, projects.clientId)).leftJoin(contracts, eq(contracts.projectId, projects.id)).where(where).orderBy(asc(projects.name), asc(projects.id)).limit(PROJECT_PAGE_SIZE).offset((query.page - 1) * PROJECT_PAGE_SIZE);
  return { rows, total: Number(total.value), pageSize: PROJECT_PAGE_SIZE, query };
}
export async function getProject(connection: Connection, token: string | undefined, id: string) {
  await requireSessionUser(connection, token); uuid(id);
  return drizzle(connection).transaction(async tx => {
    const [joined] = await tx.select({ project: projects, client: { id: clients.id, name: clients.name, version: clients.version, deletedAt: clients.deletedAt } }).from(projects).innerJoin(clients, eq(clients.id, projects.clientId)).where(and(eq(projects.id, id), isNull(projects.deletedAt))).limit(1);
    if (!joined) throw new ProjectError("NOT_FOUND", "Project not found.", 404);
    const [contract] = await tx.select().from(contracts).where(eq(contracts.projectId, id)).limit(1);
    const phaseRows = contract ? await tx.select().from(contractPhases).where(and(eq(contractPhases.contractId, contract.id), isNull(contractPhases.deletedAt))).orderBy(asc(contractPhases.sortOrder), asc(contractPhases.id)).limit(MAX_PHASES + 1) : [];
    if (phaseRows.length > MAX_PHASES) throw new ProjectError("PHASE_LIMIT", "This historical contract exceeds the supported phase limit.", 409);
    const paid = await allocations(tx, phaseRows.map(row => row.id), id);
    const phases = phaseRows.map(phase => ({ ...phase, paid: decimal(paid.get(phase.id) ?? BigInt(0)), remaining: decimal(cents(phase.value) - (paid.get(phase.id) ?? BigInt(0))) }));
    const phaseIds = tx.select({ id: contractPhases.id }).from(contractPhases).where(eq(contractPhases.contractId, contract?.id ?? ""));
    const history = await tx.select({ id: auditEvents.id, entityType: auditEvents.entityType, action: auditEvents.action, recordedAt: auditEvents.recordedAt, operationId: auditEvents.operationId, actorName: users.displayName, before: auditEvents.beforeSnapshot, after: auditEvents.afterSnapshot }).from(auditEvents).leftJoin(users, eq(users.id, auditEvents.actorId))
      .where(or(and(eq(auditEvents.entityType, "project"), eq(auditEvents.entityId, id)), contract ? and(eq(auditEvents.entityType, "contract"), eq(auditEvents.entityId, contract.id)) : undefined, contract ? and(eq(auditEvents.entityType, "phase"), inArray(auditEvents.entityId, phaseIds)) : undefined)).orderBy(desc(auditEvents.recordedAt), desc(auditEvents.id)).limit(20);
    return { ...joined, contract: contract ?? null, phases, phaseTotal: decimal(phases.reduce((sum, phase) => sum + cents(phase.value), BigInt(0))), history };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export type ProjectDetail = Awaited<ReturnType<typeof getProject>>;
