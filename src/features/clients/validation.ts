import { clientFields, type ClientErrors, type ClientInput, type ClientField, type ClientType } from "./model";

export class ClientValidationError extends Error {
  constructor(public readonly fields: ClientErrors) { super("Please correct the highlighted fields."); }
}
export class ClientNotFound extends Error { constructor() { super("Client not found."); } }
export class ClientConflict extends Error { constructor() { super("This client has changed. Reload the latest version before saving again."); } }
export class ClientArchived extends Error { constructor() { super("This client is archived and cannot be changed."); } }
export class ClientHasOpenProjects extends Error { constructor() { super("This client has an active or suspended project. Complete or resolve those projects before archiving."); } }

export function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new ClientValidationError({ form: "Provide a valid client form." });
  return value as Record<string, unknown>;
}

export function parseClientInput(value: unknown): ClientInput {
  const input = plainObject(value);
  const allowed = new Set(["type", ...Object.keys(clientFields)]);
  const errors: ClientErrors = {};
  if (Object.keys(input).some(key => !allowed.has(key))) errors.form = "Unsupported fields were supplied. Reload the form and try again.";
  if (input.type !== "private_person" && input.type !== "business") errors.type = "Select Individual or Business.";
  const result: Record<string, string | null> = {};
  for (const [key, field] of Object.entries(clientFields)) {
    const value = input[key];
    if (value !== undefined && value !== null && typeof value !== "string") {
      errors[key as ClientField] = `${field.label} must be text.`; continue;
    }
    const text = typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
    if (text.length > field.max) errors[key as ClientField] = `Use at most ${field.max} characters.`;
    if (/[\u0000-\u001f\u007f]/u.test(text)) errors[key as ClientField] = "Remove unsupported control characters.";
    result[key] = text || null;
  }
  if (!result.name) errors.name = "Enter the client name.";
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) errors.email = "Enter a valid email or leave it blank.";
  if (Object.keys(errors).length) throw new ClientValidationError(errors);
  return { ...result, type: input.type as ClientType, name: result.name! , email: result.email?.toLowerCase() ?? null } as ClientInput;
}

export function parseVersion(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value >= 4294967295) throw new ClientValidationError({ version: "Reload the client to obtain its current version." });
  return value;
}

export function parseClientId(value: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new ClientNotFound();
  return value;
}

export type ClientQuery = { q: string; type: ClientType | "all"; page: number };
export const PAGE_SIZE = 20;
export function parseClientQuery(input: { q?: unknown; type?: unknown; page?: unknown }): ClientQuery {
  if (input.q !== undefined && (typeof input.q !== "string" || input.q.length > 100)) throw new ClientValidationError({ form: "Search must be at most 100 characters." });
  const type = input.type ?? "all";
  if (typeof type !== "string" || !["all", "private_person", "business"].includes(type)) throw new ClientValidationError({ type: "Select a valid client type filter." });
  if (input.page !== undefined && typeof input.page !== "string" && typeof input.page !== "number") throw new ClientValidationError({ form: "Select a valid page." });
  const page = input.page === undefined || input.page === "" ? 1 : Number(input.page);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new ClientValidationError({ form: "Select a valid page between 1 and 10000." });
  return { q: typeof input.q === "string" ? input.q.trim().replace(/\s+/gu, " ") : "", type: type as ClientQuery["type"], page };
}

export function escapedSearch(value: string) { return `%${value.replace(/[=%_]/g, character => `=${character}`)}%`; }
