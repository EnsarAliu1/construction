import { eurDecimal } from "@/server/db/money";
import { cents, decimal } from "./money";

export const MAX_PHASES = 100;
export const PROJECT_PAGE_SIZE = 20;
export class ProjectError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}
export const conflict = () => new ProjectError("CONFLICT", "This project or contract has changed. Reload its latest version before saving again.", 409);
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new ProjectError("INPUT", "Provide a valid project/contract form.");
  if (Object.keys(value).some(key => !keys.includes(key))) throw new ProjectError("FIELDS", "Unsupported protected or unknown fields were supplied.");
  return value as Record<string, unknown>;
}
export function uuid(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)) throw new ProjectError("ID", "Select a valid record reference.");
  return value;
}
export function expectedVersion(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value >= 4294967295) throw new ProjectError("VERSION", "Reload the record to obtain its current version.");
  return value;
}
function text(value: unknown, label: string, max: number, required = false) {
  if (value === undefined || value === null || value === "") { if (required) throw new ProjectError("REQUIRED", `${label} is required.`); return null; }
  if (typeof value !== "string") throw new ProjectError("TEXT", `${label} must be text.`);
  const result = value.trim();
  if (result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result) || (max === 65535 && new TextEncoder().encode(result).length > 65535)) throw new ProjectError("TEXT", `${label} exceeds its storage limit or contains unsupported characters.`);
  if (!result && required) throw new ProjectError("REQUIRED", `${label} is required.`);
  return result || null;
}
function calendar(value: unknown, label: string) {
  const result = text(value, label, 10);
  if (!result) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(result);
  if (!match) throw new ProjectError("DATE", `${label} must use YYYY-MM-DD.`);
  const [year, month, day] = match.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new ProjectError("DATE", `${label} must be a valid calendar date.`);
  return result;
}
export type ProjectInput = ReturnType<typeof parseProject>;
export function parseProject(value: unknown) {
  const input = object(value, ["clientId", "clientVersion", "name", "location", "startDate", "endDate", "status"]);
  if (!["active", "suspended", "completed"].includes(String(input.status)) || typeof input.status !== "string") throw new ProjectError("STATUS", "Select Active, Suspended or Completed.");
  const startDate = calendar(input.startDate, "Start date"), endDate = calendar(input.endDate, "End date");
  if (startDate && endDate && endDate < startDate) throw new ProjectError("DATES", "End date cannot be before the start date.");
  return { clientId: uuid(input.clientId), clientVersion: expectedVersion(input.clientVersion), name: text(input.name, "Project name", 200, true)!, location: text(input.location, "Location", 255), startDate, endDate, status: input.status as "active" | "suspended" | "completed" };
}
export function amount(value: unknown): string {
  if (typeof value !== "string") throw new ProjectError("MONEY", "EUR amounts must be exact decimal strings, for example 123.45.");
  try { return eurDecimal(value); } catch { throw new ProjectError("MONEY", "Use nonnegative EUR amounts with exactly two decimals and at most 17 whole digits."); }
}
export type PhaseInput = { id?: string; version?: number; name: string; description: string | null; value: string; sortOrder: number };
export function parsePhase(value: unknown, initial: boolean): PhaseInput {
  const input = object(value, initial ? ["name", "description", "value", "sortOrder"] : ["id", "version", "name", "description", "value", "sortOrder"]);
  const existing = input.id !== undefined;
  if (!existing && input.version !== undefined) throw new ProjectError("VERSION", "A new phase cannot supply an existing version.");
  if (typeof input.sortOrder !== "number" || !Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 4294967295) throw new ProjectError("ORDER", "Phase display order must be a nonnegative integer within its storage limit.");
  return { ...(existing ? { id: uuid(input.id), version: expectedVersion(input.version) } : {}), name: text(input.name, "Phase name", 200, true)!, description: text(input.description, "Phase description", 65535), value: amount(input.value), sortOrder: input.sortOrder };
}
export type ContractPlan = ReturnType<typeof parsePlan>;
export function parsePlan(value: unknown, initial = false) {
  const input = object(value, initial ? ["totalValue", "phases"] : ["contractId", "version", "projectVersion", "totalValue", "phases", "deletedPhases"]);
  if (!initial && input.contractId === null && input.version !== null) throw new ProjectError("VERSION", "A new contract must use a null contract identity and version.");
  if (!Array.isArray(input.phases) || input.phases.length > MAX_PHASES) throw new ProjectError("PHASES", `Supply at most ${MAX_PHASES} active phases.`);
  const phases = input.phases.map(phase => parsePhase(phase, initial));
  const totalValue = amount(input.totalValue);
  const removed = initial ? [] : input.deletedPhases;
  if (!Array.isArray(removed) || removed.length > MAX_PHASES) throw new ProjectError("PHASES", "Supply an explicit bounded list of intended phase deletions.");
  const deletedPhases = removed.map(value => { const row = object(value, ["id", "version"]); return { id: uuid(row.id), version: expectedVersion(row.version) }; });
  const ids = [...phases.flatMap(phase => phase.id ? [phase.id] : []), ...deletedPhases.map(phase => phase.id)];
  if (new Set(ids).size !== ids.length) throw new ProjectError("DUPLICATE", "A phase identity may appear only once in a save.");
  const sum = phases.reduce((sum, phase) => sum + cents(phase.value), BigInt(0));
  if (sum !== cents(totalValue)) throw new ProjectError("TOTAL", `Contract total ${totalValue} EUR must equal active phase total ${decimal(sum)} EUR. Adjust the final values and save them together.`);
  return { totalValue, phases, deletedPhases, contractId: initial || input.contractId === null ? null : uuid(input.contractId), version: initial || input.contractId === null ? null : expectedVersion(input.version), projectVersion: initial ? null : expectedVersion(input.projectVersion) };
}
export function parseProjectQuery(value: Record<string, unknown>) {
  object(value, ["q", "status", "clientId", "page"]);
  const q = text(value.q, "Search", 100) ?? "";
  const status = value.status ?? "all";
  if (typeof status !== "string" || !["all", "active", "suspended", "completed"].includes(status)) throw new ProjectError("STATUS", "Select a valid project status filter.");
  if (value.page !== undefined && typeof value.page !== "string" && typeof value.page !== "number") throw new ProjectError("PAGE", "Select a valid page.");
  const page = value.page === undefined || value.page === "" ? 1 : Number(value.page);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new ProjectError("PAGE", "Select a page from 1 to 10000.");
  return { q, status, clientId: value.clientId ? uuid(value.clientId) : null, page };
}
