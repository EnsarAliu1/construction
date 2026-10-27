/** Flat allowlist: unknown fields (including nested credential objects) fail closed. */
export const historyFields = [
  "id", "name", "displayName", "email", "type", "status", "clientId", "projectId",
  "contractId", "phaseId", "paymentId", "receiptId", "categoryId", "personId", "vehicleId",
  "amount", "totalValue", "value", "version", "sortOrder", "transactionDate", "method",
  "description", "location", "startDate", "endDate", "deletedAt", "cancelledAt",
  "cancellationReason", "cancelledBy", "isActive", "identifier", "receiptNumber", "issuedAt",
  "clientName", "projectName", "issuerName", "storageReference", "fileChecksum",
  "resultId", "resultType",
  "nui", "phone", "addressLine1", "addressLine2", "city", "postalCode", "country",
  "createdAt", "updatedAt", "createdBy", "updatedBy", "deletedBy",
  "activatedAt",
  "address", "identificationReference", "deactivatedAt", "deactivatedBy",
] as const;

type Scalar = string | number | boolean | null;
export type HistorySnapshot = Partial<Record<typeof historyFields[number], Scalar>>;

export const historyJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(historyFields.map(key => [key, { type: ["string", "number", "boolean", "null"] }])),
};

export function safeHistorySnapshot(value: unknown): HistorySnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("History snapshot must be a plain, flat object");
  }
  const result: HistorySnapshot = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!historyFields.some(field => field === key)) throw new Error("History snapshot contains an unapproved field");
    if (entry !== null && typeof entry !== "string" && typeof entry !== "boolean" && !(typeof entry === "number" && Number.isSafeInteger(entry))) {
      throw new Error("History values must be scalar; use decimal strings for monetary values");
    }
    Object.assign(result, { [key]: entry });
  }
  return result;
}
