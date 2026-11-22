import {withReadSnapshot} from "@/server/db/read-snapshot";
import {lockBusinessUser} from "@/server/db/user-lock";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import type { Connection } from "mysql2/promise";
import { auditEvents, clients, entityVersions, expenseCategories, expenses, persons, projects, users, vehicles } from "@/server/db/schema";
import { requireSessionUser } from "@/server/auth/sessions";
import { safeHistorySnapshot } from "@/server/db/history-snapshot";
import { escapedSearch } from "@/features/clients/validation";
import { insertCategoryInTransaction } from "@/features/references/service";
import { referenceId } from "@/features/references/validation";
import { ExpenseError, parseCancellation, parseCorrection, parseExpense, parseExpenseQuery, text, type ExpenseInput, type Selection } from "./validation";

type Db = MySql2Database<Record<string, never>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type ExpenseRecord = typeof expenses.$inferSelect;
const conflict = () => new ExpenseError("CONFLICT", "Shpenzimi ose një e dhënë e përzgjedhur ka ndryshuar. Ringarkoni vlerat e fundit para ruajtjes.", 409);
async function find(db: Pick<Db,"select">, id: string, lock = false) {
  const query = db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw new ExpenseError("NOT_FOUND", "Shpenzimi nuk u gjet.", 404);
  return row;
}
async function audit(tx: Tx, actorId: string, operationId: string, action: string, before: ExpenseRecord | null, after: ExpenseRecord) {
  const snapshot = safeHistorySnapshot({ ...after });
  await tx.insert(auditEvents).values({ id: randomUUID(), actorId, operationId, entityType: "expense", entityId: after.id, action, beforeSnapshot: before ? safeHistorySnapshot({ ...before }) : null, afterSnapshot: snapshot });
  await tx.insert(entityVersions).values({ id: randomUUID(), entityType: "expense", entityId: after.id, version: after.version, snapshot });
}
async function mutation<P,R>(c: Connection, token: string | undefined, parse: () => P, work: (tx: Tx, input: P, actor: string, operation: string) => Promise<R>) {
  const user = await requireSessionUser(c, token), input = parse();
  return drizzle(c).transaction(async tx => {
    await lockBusinessUser(tx,c,user.id);
    const actor = await requireSessionUser(c, token);
    return work(tx, input, actor.id, randomUUID());
  }, { isolationLevel: "read committed" });
}
/** Parent discovery is only a hint. Lock all old/new clients, then projects in UUID order; recheck parent hints. */
async function lockAssociations(tx: Tx, before: ExpenseRecord | null, input: ExpenseInput | null) {
  const projectIds = [...new Set([before?.projectId, input?.project?.id].filter((id): id is string => Boolean(id)))].sort();
  if (projectIds.length) {
    const hints = await tx.select().from(projects).where(inArray(projects.id, projectIds));
    if (hints.length !== projectIds.length) throw new ExpenseError("PROJECT", "Projekti i përzgjedhur është i padisponueshëm.", 409, { project: "Zgjidhni një projekt të lejuar." });
    const parentIds = [...new Set(hints.map(row => row.clientId))].sort();
    const parents = await tx.select().from(clients).where(inArray(clients.id, parentIds)).orderBy(asc(clients.id)).for("update");
    const locked = await tx.select().from(projects).where(inArray(projects.id, projectIds)).orderBy(asc(projects.id)).for("update");
    for (const row of locked) if (hints.find(hint => hint.id === row.id)?.clientId !== row.clientId) throw conflict();
    if (input?.project) {
      const row = locked.find(row => row.id === input.project!.id);
      if (!row || row.version !== input.project.version) throw conflict();
      // Retaining a historical association is permitted; new associations require active parents/project.
      if (before?.projectId !== row.id && (row.deletedAt || row.status !== "active" || parents.find(parent => parent.id === row.clientId)?.deletedAt)) throw new ExpenseError("PROJECT", "Lidhjet e reja kërkojnë projekt dhe klient aktiv.", 409, { project: "Zgjidhni projekt aktiv me klient aktiv." });
    }
  }
  for (const [table, oldId, selected, field] of [
    [expenseCategories, before?.categoryId, input?.category, "category"],
    [persons, before?.personId, input?.person, "person"],
    [vehicles, before?.vehicleId, input?.vehicle, "vehicle"],
  ] as const) {
    const ids = [...new Set([oldId, selected?.id].filter((id): id is string => Boolean(id)))].sort();
    if (!ids.length) continue;
    const rows = await tx.select({ id: table.id, version: table.version, isActive: table.isActive }).from(table).where(inArray(table.id, ids)).orderBy(asc(table.id)).for("update");
    if (rows.length !== ids.length) throw new ExpenseError("REFERENCE", "Një e dhënë e përzgjedhur nuk ekziston më.", 409, { [field]: "Zgjidhni të dhëna ekzistuese." });
    if (selected) {
      const row = rows.find(row => row.id === selected.id)!;
      if (row.version !== selected.version) throw conflict();
      if (oldId !== row.id && !row.isActive) throw new ExpenseError("INACTIVE", "Lidhjet e reja kërkojnë të dhëna referuese aktive.", 409, { [field]: "Zgjidhni të dhëna aktive." });
    }
  }
}
function fields(input: ExpenseInput, categoryId: string) {
  return { amount: input.amount, transactionDate: input.transactionDate, description: input.description, categoryId, projectId: input.project?.id ?? null, personId: input.person?.id ?? null, vehicleId: input.vehicle?.id ?? null };
}
export async function createExpense(c: Connection, token: string | undefined, value: unknown) {
  return mutation(c, token, () => parseExpense(value), async (tx, input, actor, operation) => {
    // Create inline category at its fixed category lock position, before optional persons/vehicles.
    // Parent locks must precede the insertion (which obtains the category's unique-key lock).
    if (input.newCategoryName) {
      const parentOnly = { ...input, category: null, person: null, vehicle: null };
      await lockAssociations(tx, null, parentOnly);
      const category = await insertCategoryInTransaction(tx, input.newCategoryName, actor, operation);
      input.category = { id: category.id, version: category.version };
    }
    await lockAssociations(tx, null, input);
    const id = randomUUID();
    await tx.insert(expenses).values({ ...fields(input, input.category!.id), id, createdBy: actor, updatedBy: actor });
    const saved = await find(tx, id); await audit(tx, actor, operation, "expense_created", null, saved); return saved;
  });
}
export async function correctExpense(c: Connection, token: string | undefined, id: string, value: unknown) {
  return mutation(c, token, () => { referenceId(id); return parseCorrection(value); }, async (tx, input, actor, operation) => {
    const hint = await find(tx, id);
    await lockAssociations(tx, hint, input.expense);
    const before = await find(tx, id, true);
    if (before.version !== input.version || hint.version !== before.version) throw conflict();
    if (before.status !== "recorded") throw new ExpenseError("CANCELLED", "Shpenzimet e anuluara ruhen vetëm për shikim.", 409);
    await tx.update(expenses).set({ ...fields(input.expense, input.expense.category!.id), updatedBy: actor, version: before.version + 1, updatedAt: sql`UTC_TIMESTAMP(3)` }).where(eq(expenses.id, id));
    const after = await find(tx, id); await audit(tx, actor, operation, "expense_corrected", before, after); return after;
  });
}
export async function cancelExpense(c: Connection, token: string | undefined, id: string, value: unknown) {
  return mutation(c, token, () => { referenceId(id); return parseCancellation(value); }, async (tx, input, actor, operation) => {
    const hint = await find(tx, id); await lockAssociations(tx, hint, null);
    const before = await find(tx, id, true);
    if (before.version !== input.version || hint.version !== before.version) throw conflict();
    if (before.status !== "recorded") throw new ExpenseError("CANCELLED", "Ky shpenzim është anuluar më parë.", 409);
    await tx.update(expenses).set({ status: "cancelled", cancelledBy: actor, updatedBy: actor, cancelledAt: sql`UTC_TIMESTAMP(3)`, cancellationReason: input.reason, version: before.version + 1, updatedAt: sql`UTC_TIMESTAMP(3)` }).where(eq(expenses.id, id));
    const after = await find(tx, id); await audit(tx, actor, operation, "expense_cancelled", before, after); return after;
  });
}
const joined = (db: Pick<Db,"select">) => db.select({ record: expenses, category: { id: expenseCategories.id, label: expenseCategories.name, version: expenseCategories.version, isActive: expenseCategories.isActive }, project: { id: projects.id, label: projects.name, version: projects.version, status: projects.status, deletedAt: projects.deletedAt }, client: { id: clients.id, label: clients.name }, person: { id: persons.id, label: persons.name, version: persons.version, isActive: persons.isActive }, vehicle: { id: vehicles.id, label: vehicles.identifier, version: vehicles.version, isActive: vehicles.isActive } }).from(expenses).innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id)).leftJoin(projects, eq(expenses.projectId, projects.id)).leftJoin(clients, eq(projects.clientId, clients.id)).leftJoin(persons, eq(expenses.personId, persons.id)).leftJoin(vehicles, eq(expenses.vehicleId, vehicles.id));
export async function getExpense(c: Connection, token: string | undefined, id: string) {
  await requireSessionUser(c, token); referenceId(id);
  return withReadSnapshot(c,async tx => {
    const [data] = await joined(tx).where(eq(expenses.id, id)).limit(1);
    if (!data) throw new ExpenseError("NOT_FOUND", "Shpenzimi nuk u gjet.", 404);
    const history = await tx.select({ id: auditEvents.id, action: auditEvents.action, actorName: users.displayName, recordedAt: auditEvents.recordedAt, before: auditEvents.beforeSnapshot, after: auditEvents.afterSnapshot }).from(auditEvents).leftJoin(users, eq(users.id, auditEvents.actorId)).where(and(eq(auditEvents.entityType,"expense"),eq(auditEvents.entityId,id))).orderBy(desc(auditEvents.recordedAt),desc(auditEvents.id)).limit(20);
    return { ...data, history };
  });
}
export async function listExpenses(c: Connection, token: string | undefined, value: Record<string,unknown> = {}) {
  await requireSessionUser(c, token); const query = parseExpenseQuery(value);
  const where = and(query.status === "all" ? undefined : eq(expenses.status, query.status), query.from ? gte(expenses.transactionDate,query.from) : undefined, query.to ? lte(expenses.transactionDate,query.to) : undefined, query.categoryId ? eq(expenses.categoryId,query.categoryId) : undefined, query.projectId === "company" ? isNull(expenses.projectId) : query.projectId ? eq(expenses.projectId,query.projectId) : undefined, query.personId ? eq(expenses.personId,query.personId) : undefined, query.vehicleId ? eq(expenses.vehicleId,query.vehicleId) : undefined, query.q ? or(...[expenses.description,expenseCategories.name,projects.name,clients.name,persons.name,vehicles.identifier].map(column => sql`${column} LIKE ${escapedSearch(query.q)} ESCAPE '='`)) : undefined);
  return withReadSnapshot(c,async tx => {
    const [{ total }] = await tx.select({total: count()}).from(expenses).innerJoin(expenseCategories,eq(expenses.categoryId,expenseCategories.id)).leftJoin(projects,eq(expenses.projectId,projects.id)).leftJoin(clients,eq(projects.clientId,clients.id)).leftJoin(persons,eq(expenses.personId,persons.id)).leftJoin(vehicles,eq(expenses.vehicleId,vehicles.id)).where(where);
    const rows = await joined(tx).where(where).orderBy(desc(expenses.transactionDate),desc(expenses.id)).limit(20).offset((query.page-1)*20);
    // No misleading totals on a page; future reports must explicitly filter recorded status.
    return { rows, total: Number(total), pageSize: 20, query };
  });
}
export async function chooseExpenseProjects(c: Connection, token: string | undefined, value: unknown = "", historical = false) {
  await requireSessionUser(c, token); const q = text(value,"q",100,false);
  return drizzle(c).select({ id: projects.id, label: projects.name, version: projects.version }).from(projects).innerJoin(clients,eq(projects.clientId,clients.id)).where(and(historical ? undefined : isNull(projects.deletedAt),historical ? undefined : isNull(clients.deletedAt),historical ? undefined : eq(projects.status,"active"),q ? or(sql`${projects.name} LIKE ${escapedSearch(q)} ESCAPE '='`,sql`${clients.name} LIKE ${escapedSearch(q)} ESCAPE '='`) : undefined)).orderBy(asc(projects.name),asc(projects.id)).limit(20);
}
export type ExpenseDetails = Awaited<ReturnType<typeof getExpense>>;
export type ExpenseChoice = Selection & { label: string; isActive?: boolean };
