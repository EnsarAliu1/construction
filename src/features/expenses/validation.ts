import { inputMoney, cents } from "@/features/projects/money";
import { ReferenceError, referenceId, referenceObject, referenceVersion } from "@/features/references/validation";

export { ReferenceError as ExpenseError };
export type Selection = { id: string; version: number };
export type ExpenseInput = { amount: string; transactionDate: string; description: string; category: Selection | null; newCategoryName: string | null; project: Selection | null; person: Selection | null; vehicle: Selection | null };
export function text(value: unknown, field: string, max = 65535, required = true): string {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) throw new ReferenceError("VALIDATION", "Use plain text without control characters.", 400, { [field]: "Enter plain text." });
  const result = value.trim().replace(/\s+/gu, " ");
  if ((required && !result) || result.length > max || new TextEncoder().encode(result).length > 65535) throw new ReferenceError("VALIDATION", "Please correct the highlighted field.", 400, { [field]: `Enter ${required ? "1" : "0"}–${max} characters within the text storage limit.` });
  return result;
}
export function date(value: unknown, field = "transactionDate") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1000-01-01" || value > "9999-12-31" || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) !== value) throw new ReferenceError("DATE", "Enter a valid calendar date.", 400, { [field]: "Use a real date from 1000-01-01 to 9999-12-31." });
  return value;
}
function selection(value: unknown, field: string): Selection | null {
  if (value === undefined || value === null) return null;
  try { const item = referenceObject(value, ["id", "version"]); return { id: referenceId(item.id), version: referenceVersion(item.version) }; }
  catch { throw new ReferenceError("REFERENCE", "Select an existing record and its current version.", 400, { [field]: "Search and select the record again." }); }
}
export function parseExpense(value: unknown, inline = true): ExpenseInput {
  const input = referenceObject(value, ["amount", "transactionDate", "description", "category", "newCategoryName", "project", "person", "vehicle"]);
  let amount: string;
  try { if (typeof input.amount !== "string" || !/^\d{1,17}(?:\.\d{1,2})?$/.test(input.amount.trim())) throw new Error(); amount = inputMoney(input.amount); if (cents(amount) <= BigInt(0)) throw new Error(); }
  catch { throw new ReferenceError("AMOUNT", "Enter a positive EUR amount with at most two decimals.", 400, { amount: "Use 0.01–99999999999999999.99 EUR, without separators." }); }
  const category = selection(input.category, "category");
  const newCategoryName = input.newCategoryName === undefined || input.newCategoryName === null || input.newCategoryName === "" ? null : text(input.newCategoryName, "newCategoryName", 150);
  if ((category ? 1 : 0) + (newCategoryName ? 1 : 0) !== 1 || (!inline && newCategoryName)) throw new ReferenceError("CATEGORY", "Select one category; inline creation is available on new expenses.", 400, { category: "Choose an active category or create one on a new expense." });
  return { amount, transactionDate: date(input.transactionDate), description: text(input.description, "description"), category, newCategoryName, project: selection(input.project, "project"), person: selection(input.person, "person"), vehicle: selection(input.vehicle, "vehicle") };
}
export function parseCorrection(value: unknown) {
  const input = referenceObject(value, ["version", "confirmation", "expense"]);
  if (input.confirmation !== "correct") throw new ReferenceError("CONFIRMATION", "Explicitly confirm this correction.");
  return { version: referenceVersion(input.version), expense: parseExpense(input.expense, false) };
}
export function parseCancellation(value: unknown) {
  const input = referenceObject(value, ["version", "confirmation", "reason"]);
  if (input.confirmation !== "cancel") throw new ReferenceError("CONFIRMATION", "Explicitly confirm cancellation.");
  return { version: referenceVersion(input.version), reason: text(input.reason, "reason") };
}
export function parseExpenseQuery(value: Record<string, unknown>) {
  referenceObject(value, ["q", "from", "to", "categoryId", "projectId", "personId", "vehicleId", "status", "page"]);
  const q = value.q === undefined ? "" : text(value.q, "q", 100, false);
  const from = value.from === undefined || value.from === "" ? "" : date(value.from, "from");
  const to = value.to === undefined || value.to === "" ? "" : date(value.to, "to");
  if (from && to && from > to) throw new ReferenceError("DATE", "The end date must follow the start date.");
  const optionalId = (field: string) => value[field] === undefined || value[field] === "" ? "" : referenceId(value[field]);
  const projectId = value.projectId === "company" ? "company" : optionalId("projectId");
  const status = value.status ?? "recorded";
  if (status !== "recorded" && status !== "cancelled" && status !== "all") throw new ReferenceError("STATUS", "Select Recorded, Cancelled or All.");
  if (value.page !== undefined && (typeof value.page !== "string" && typeof value.page !== "number")) throw new ReferenceError("PAGE", "Invalid page.");
  const page = value.page === undefined || value.page === "" ? 1 : Number(value.page);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new ReferenceError("PAGE", "Select a page from 1 to 10000.");
  return { q, from, to, categoryId: optionalId("categoryId"), projectId, personId: optionalId("personId"), vehicleId: optionalId("vehicleId"), status: status as "recorded" | "cancelled" | "all", page };
}
