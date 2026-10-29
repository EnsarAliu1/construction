import { referenceDefinitions, type ReferenceField, type ReferenceInput, type ReferenceKind } from "./model";
export class ReferenceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400, public readonly fields: Record<string, string> = {}) { super(message); }
}
export function referenceObject(value: unknown, allowed: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new ReferenceError("INPUT", "Plotësoni formular të vlefshëm të të dhënave referuese.");
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new ReferenceError("FIELDS", "Janë dërguar fusha të mbrojtura ose të panjohura.");
  return value as Record<string, unknown>;
}
export function referenceId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)) throw new ReferenceError("NOT_FOUND", "Të dhënat nuk u gjetën.", 404);
  return value;
}
export function referenceVersion(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value >= 4294967295) throw new ReferenceError("VERSION", "Ringarkoni të dhënat për të marrë versionin aktual.");
  return value;
}
export function parseReference(kind: ReferenceKind, value: unknown): ReferenceInput {
  const definition = referenceDefinitions[kind], input = referenceObject(value, definition.fields.map(field => field.key));
  const result: ReferenceInput = { name: null, email: null, phone: null, identificationReference: null, address: null, identifier: null, description: null };
  const errors: Record<string, string> = {};
  for (const field of definition.fields) {
    const raw = input[field.key];
    if (raw !== undefined && raw !== null && typeof raw !== "string") { errors[field.key] = `${field.label} duhet të jetë tekst.`; continue; }
    const text = typeof raw === "string" ? raw.trim().replace(/\s+/gu, " ") : "";
    if (typeof raw === "string" && /[\u0000-\u001f\u007f-\u009f]/u.test(raw)) errors[field.key] = "Përdorni tekst të thjeshtë pa karaktere kontrolluese ose ndërprerje rreshtash.";
    else if (text.length > field.max || (field.max === 65535 && new TextEncoder().encode(text).length > 65535)) errors[field.key] = `${field.label} tejkalon kufirin e ruajtjes.`;
    else if (field.required && !text) errors[field.key] = `Shkruani ${field.label.toLowerCase()}.`;
    else if (field.type === "email" && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) errors[field.key] = "Shkruani email të vlefshëm ose lëreni bosh.";
    result[field.key as ReferenceField] = text ? field.type === "email" ? text.toLowerCase() : text : null;
  }
  if (Object.keys(errors).length) throw new ReferenceError("VALIDATION", "Korrigjoni fushat e shënuara.", 400, errors);
  return result;
}
export function parseReferenceQuery(value: Record<string, unknown>) {
  referenceObject(value, ["q", "status", "page"]);
  if (value.q !== undefined && (typeof value.q !== "string" || value.q.length > 100 || /[\u0000-\u001f\u007f-\u009f]/u.test(value.q))) throw new ReferenceError("SEARCH", "Kërkimi duhet të jetë tekst i thjeshtë me deri në 100 karaktere.");
  const status = value.status ?? "active";
  if (typeof status !== "string" || !["active", "inactive", "all"].includes(status)) throw new ReferenceError("STATUS", "Zgjidhni Aktiv, Joaktiv ose Të gjitha.");
  if (value.page !== undefined && typeof value.page !== "number" && typeof value.page !== "string") throw new ReferenceError("PAGE", "Zgjidhni faqe të vlefshme.");
  const page = value.page === undefined || value.page === "" ? 1 : Number(value.page);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new ReferenceError("PAGE", "Zgjidhni faqe nga 1 deri në 10000.");
  return { q: typeof value.q === "string" ? value.q.trim().replace(/\s+/gu, " ") : "", status, page };
}
