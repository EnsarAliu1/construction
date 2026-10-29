import { clientFields, type ClientErrors, type ClientInput, type ClientField, type ClientType } from "./model";

export class ClientValidationError extends Error {
  constructor(public readonly fields: ClientErrors) { super("Korrigjoni fushat e shënuara."); }
}
export class ClientNotFound extends Error { constructor() { super("Klienti nuk u gjet."); } }
export class ClientConflict extends Error { constructor() { super("Ky klient është ndryshuar. Ringarkoni versionin e fundit para ruajtjes."); } }
export class ClientArchived extends Error { constructor() { super("Ky klient është arkivuar dhe nuk mund të ndryshohet."); } }
export class ClientHasOpenProjects extends Error { constructor() { super("Ky klient ka projekt aktiv ose të pezulluar. Përfundoni ose zgjidhni ato projekte para arkivimit."); } }

export function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new ClientValidationError({ form: "Plotësoni formular të vlefshëm të klientit." });
  return value as Record<string, unknown>;
}

export function parseClientInput(value: unknown): ClientInput {
  const input = plainObject(value);
  const allowed = new Set(["type", ...Object.keys(clientFields)]);
  const errors: ClientErrors = {};
  if (Object.keys(input).some(key => !allowed.has(key))) errors.form = "Janë dërguar fusha të palejuara. Ringarkoni formularin dhe provoni përsëri.";
  if (input.type !== "private_person" && input.type !== "business") errors.type = "Zgjidhni Individ ose Biznes.";
  const result: Record<string, string | null> = {};
  for (const [key, field] of Object.entries(clientFields)) {
    const value = input[key];
    if (value !== undefined && value !== null && typeof value !== "string") {
      errors[key as ClientField] = `${field.label} duhet të jetë tekst.`; continue;
    }
    const text = typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
    if (text.length > field.max) errors[key as ClientField] = `Përdorni jo më shumë se ${field.max} karaktere.`;
    if (/[\u0000-\u001f\u007f]/u.test(text)) errors[key as ClientField] = "Hiqni karakteret kontrolluese të palejuara.";
    result[key] = text || null;
  }
  if (!result.name) errors.name = "Shkruani emrin e klientit.";
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) errors.email = "Shkruani email të vlefshëm ose lëreni bosh.";
  if (Object.keys(errors).length) throw new ClientValidationError(errors);
  return { ...result, type: input.type as ClientType, name: result.name! , email: result.email?.toLowerCase() ?? null } as ClientInput;
}

export function parseVersion(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value >= 4294967295) throw new ClientValidationError({ version: "Ringarkoni klientin për të marrë versionin aktual." });
  return value;
}

export function parseClientId(value: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new ClientNotFound();
  return value;
}

export type ClientQuery = { q: string; type: ClientType | "all"; page: number };
export const PAGE_SIZE = 20;
export function parseClientQuery(input: { q?: unknown; type?: unknown; page?: unknown }): ClientQuery {
  if (input.q !== undefined && (typeof input.q !== "string" || input.q.length > 100)) throw new ClientValidationError({ form: "Kërkimi mund të përmbajë deri në 100 karaktere." });
  const type = input.type ?? "all";
  if (typeof type !== "string" || !["all", "private_person", "business"].includes(type)) throw new ClientValidationError({ type: "Zgjidhni filtër të vlefshëm të llojit të klientit." });
  if (input.page !== undefined && typeof input.page !== "string" && typeof input.page !== "number") throw new ClientValidationError({ form: "Zgjidhni faqe të vlefshme." });
  const page = input.page === undefined || input.page === "" ? 1 : Number(input.page);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new ClientValidationError({ form: "Zgjidhni faqe të vlefshme nga 1 deri në 10000." });
  return { q: typeof input.q === "string" ? input.q.trim().replace(/\s+/gu, " ") : "", type: type as ClientQuery["type"], page };
}

export function escapedSearch(value: string) { return `%${value.replace(/[=%_]/g, character => `=${character}`)}%`; }
