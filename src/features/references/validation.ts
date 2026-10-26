import { referenceDefinitions, type ReferenceField, type ReferenceInput, type ReferenceKind } from "./model";
export class ReferenceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400, public readonly fields: Record<string, string> = {}) { super(message); }
}
export function referenceObject(value: unknown, allowed: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new ReferenceError("INPUT", "Provide a valid reference-data form.");
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new ReferenceError("FIELDS", "Unsupported protected or unknown fields were supplied.");
  return value as Record<string, unknown>;
}
export function referenceId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)) throw new ReferenceError("NOT_FOUND", "Record not found.", 404);
  return value;
}
export function referenceVersion(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value >= 4294967295) throw new ReferenceError("VERSION", "Reload the record to obtain its current version.");
  return value;
}
export function parseReference(kind: ReferenceKind, value: unknown): ReferenceInput {
  const definition = referenceDefinitions[kind], input = referenceObject(value, definition.fields.map(field => field.key));
  const result: ReferenceInput = { name: null, email: null, phone: null, identificationReference: null, address: null, identifier: null, description: null };
  const errors: Record<string, string> = {};
  for (const field of definition.fields) {
    const raw = input[field.key];
    if (raw !== undefined && raw !== null && typeof raw !== "string") { errors[field.key] = `${field.label} must be text.`; continue; }
    const text = typeof raw === "string" ? raw.trim().replace(/\s+/gu, " ") : "";
    if (typeof raw === "string" && /[\u0000-\u001f\u007f-\u009f]/u.test(raw)) errors[field.key] = "Use plain text without control characters or line breaks.";
    else if (text.length > field.max || (field.max === 65535 && new TextEncoder().encode(text).length > 65535)) errors[field.key] = `${field.label} exceeds its storage limit.`;
    else if (field.required && !text) errors[field.key] = `Enter ${field.label.toLowerCase()}.`;
    else if (field.type === "email" && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) errors[field.key] = "Enter a valid email or leave it blank.";
    result[field.key as ReferenceField] = text ? field.type === "email" ? text.toLowerCase() : text : null;
  }
  if (Object.keys(errors).length) throw new ReferenceError("VALIDATION", "Please correct the highlighted fields.", 400, errors);
  return result;
}
export function parseReferenceQuery(value: Record<string, unknown>) {
  referenceObject(value, ["q", "status", "page"]);
  if (value.q !== undefined && (typeof value.q !== "string" || value.q.length > 100 || /[\u0000-\u001f\u007f-\u009f]/u.test(value.q))) throw new ReferenceError("SEARCH", "Search must be plain text within 100 characters.");
  const status = value.status ?? "active";
  if (typeof status !== "string" || !["active", "inactive", "all"].includes(status)) throw new ReferenceError("STATUS", "Select Active, Inactive or All.");
  if (value.page !== undefined && typeof value.page !== "number" && typeof value.page !== "string") throw new ReferenceError("PAGE", "Select a valid page.");
  const page = value.page === undefined || value.page === "" ? 1 : Number(value.page);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new ReferenceError("PAGE", "Select a page from 1 to 10000.");
  return { q: typeof value.q === "string" ? value.q.trim().replace(/\s+/gu, " ") : "", status, page };
}
