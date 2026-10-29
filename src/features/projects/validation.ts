import { eurDecimal } from "@/server/db/money";
import { cents, decimal } from "./money";

export const MAX_PHASES = 100;
export const PROJECT_PAGE_SIZE = 20;
export class ProjectError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}
export const conflict = () => new ProjectError("CONFLICT", "Projekti ose kontrata është ndryshuar. Ringarkoni versionin e fundit para ruajtjes.", 409);
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new ProjectError("INPUT", "Plotësoni formular të vlefshëm të projektit dhe kontratës.");
  if (Object.keys(value).some(key => !keys.includes(key))) throw new ProjectError("FIELDS", "Janë dërguar fusha të mbrojtura ose të panjohura.");
  return value as Record<string, unknown>;
}
export function uuid(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)) throw new ProjectError("ID", "Zgjidhni referencë të vlefshme të të dhënave.");
  return value;
}
export function expectedVersion(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value >= 4294967295) throw new ProjectError("VERSION", "Ringarkoni të dhënat për të marrë versionin aktual.");
  return value;
}
function text(value: unknown, label: string, max: number, required = false) {
  if (value === undefined || value === null || value === "") { if (required) throw new ProjectError("REQUIRED", `${label} është e detyrueshme.`); return null; }
  if (typeof value !== "string") throw new ProjectError("TEXT", `${label} duhet të jetë tekst.`);
  const result = value.trim();
  if (result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result) || (max === 65535 && new TextEncoder().encode(result).length > 65535)) throw new ProjectError("TEXT", `${label} tejkalon kufirin e ruajtjes ose përmban karaktere të palejuara.`);
  if (!result && required) throw new ProjectError("REQUIRED", `${label} është e detyrueshme.`);
  return result || null;
}
function calendar(value: unknown, label: string) {
  const result = text(value, label, 10);
  if (!result) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(result);
  if (!match) throw new ProjectError("DATE", `${label} duhet të ketë formatin VVVV-MM-DD.`);
  const [year, month, day] = match.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new ProjectError("DATE", `${label} duhet të jetë datë kalendarike e vlefshme.`);
  return result;
}
export type ProjectInput = ReturnType<typeof parseProject>;
export function parseProject(value: unknown) {
  const input = object(value, ["clientId", "clientVersion", "name", "location", "startDate", "endDate", "status"]);
  if (!["active", "suspended", "completed"].includes(String(input.status)) || typeof input.status !== "string") throw new ProjectError("STATUS", "Zgjidhni Aktiv, Pezulluar ose Përfunduar.");
  const startDate = calendar(input.startDate, "Data e fillimit"), endDate = calendar(input.endDate, "Data e përfundimit");
  if (startDate && endDate && endDate < startDate) throw new ProjectError("DATES", "Data e përfundimit nuk mund të jetë para datës së fillimit.");
  return { clientId: uuid(input.clientId), clientVersion: expectedVersion(input.clientVersion), name: text(input.name, "Emri i projektit", 200, true)!, location: text(input.location, "Lokacioni", 255), startDate, endDate, status: input.status as "active" | "suspended" | "completed" };
}
export function amount(value: unknown): string {
  if (typeof value !== "string") throw new ProjectError("MONEY", "Shumat në EUR duhet të jenë vlera të sakta dhjetore në formë teksti, për shembull 123.45.");
  try { return eurDecimal(value); } catch { throw new ProjectError("MONEY", "Përdorni shuma jonegative në EUR me saktësisht dy shifra dhjetore dhe deri në 17 shifra të plota."); }
}
export type PhaseInput = { id?: string; version?: number; name: string; description: string | null; value: string; sortOrder: number };
export function parsePhase(value: unknown, initial: boolean): PhaseInput {
  const input = object(value, initial ? ["name", "description", "value", "sortOrder"] : ["id", "version", "name", "description", "value", "sortOrder"]);
  const existing = input.id !== undefined;
  if (!existing && input.version !== undefined) throw new ProjectError("VERSION", "Faza e re nuk mund të ketë version ekzistues.");
  if (typeof input.sortOrder !== "number" || !Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 4294967295) throw new ProjectError("ORDER", "Renditja e fazës duhet të jetë numër i plotë jonegativ brenda kufirit të ruajtjes.");
  return { ...(existing ? { id: uuid(input.id), version: expectedVersion(input.version) } : {}), name: text(input.name, "Emri i fazës", 200, true)!, description: text(input.description, "Përshkrimi i fazës", 65535), value: amount(input.value), sortOrder: input.sortOrder };
}
export type ContractPlan = ReturnType<typeof parsePlan>;
export function parsePlan(value: unknown, initial = false) {
  const input = object(value, initial ? ["totalValue", "phases"] : ["contractId", "version", "projectVersion", "totalValue", "phases", "deletedPhases"]);
  if (!initial && input.contractId === null && input.version !== null) throw new ProjectError("VERSION", "Kontrata e re duhet të ketë identifikues dhe version bosh.");
  if (!Array.isArray(input.phases) || input.phases.length > MAX_PHASES) throw new ProjectError("PHASES", `Jepni jo më shumë se ${MAX_PHASES} faza aktive.`);
  const phases = input.phases.map(phase => parsePhase(phase, initial));
  const totalValue = amount(input.totalValue);
  const removed = initial ? [] : input.deletedPhases;
  if (!Array.isArray(removed) || removed.length > MAX_PHASES) throw new ProjectError("PHASES", "Jepni listë të qartë të fazave që dëshironi të hiqni, brenda kufirit të lejuar.");
  const deletedPhases = removed.map(value => { const row = object(value, ["id", "version"]); return { id: uuid(row.id), version: expectedVersion(row.version) }; });
  const ids = [...phases.flatMap(phase => phase.id ? [phase.id] : []), ...deletedPhases.map(phase => phase.id)];
  if (new Set(ids).size !== ids.length) throw new ProjectError("DUPLICATE", "Identifikuesi i fazës mund të paraqitet vetëm një herë gjatë ruajtjes.");
  const sum = phases.reduce((sum, phase) => sum + cents(phase.value), BigInt(0));
  if (sum !== cents(totalValue)) throw new ProjectError("TOTAL", `Shuma e kontratës ${totalValue} EUR duhet të jetë e barabartë me shumën e fazave aktive ${decimal(sum)} EUR. Përshtatni vlerat përfundimtare dhe ruajini së bashku.`);
  return { totalValue, phases, deletedPhases, contractId: initial || input.contractId === null ? null : uuid(input.contractId), version: initial || input.contractId === null ? null : expectedVersion(input.version), projectVersion: initial ? null : expectedVersion(input.projectVersion) };
}
export function parseProjectQuery(value: Record<string, unknown>) {
  object(value, ["q", "status", "clientId", "page"]);
  const q = text(value.q, "Kërkoni", 100) ?? "";
  const status = value.status ?? "all";
  if (typeof status !== "string" || !["all", "active", "suspended", "completed"].includes(status)) throw new ProjectError("STATUS", "Zgjidhni filtër të vlefshëm të gjendjes së projektit.");
  if (value.page !== undefined && typeof value.page !== "string" && typeof value.page !== "number") throw new ProjectError("PAGE", "Zgjidhni faqe të vlefshme.");
  const page = value.page === undefined || value.page === "" ? 1 : Number(value.page);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new ProjectError("PAGE", "Zgjidhni faqe nga 1 deri në 10000.");
  return { q, status, clientId: value.clientId ? uuid(value.clientId) : null, page };
}
