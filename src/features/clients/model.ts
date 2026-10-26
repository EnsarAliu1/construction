export const clientFields = {
  name: { label: "Name", max: 200 },
  nui: { label: "NUI (optional)", max: 100 },
  email: { label: "Email", max: 254 },
  phone: { label: "Phone", max: 64 },
  addressLine1: { label: "Address line 1", max: 255 },
  addressLine2: { label: "Address line 2", max: 255 },
  city: { label: "City", max: 150 },
  postalCode: { label: "Postal code", max: 32 },
  country: { label: "Country", max: 100 },
} as const;

export type ClientField = keyof typeof clientFields;
export type ClientType = "private_person" | "business";
export type ClientInput = { type: ClientType; name: string } & Record<Exclude<ClientField, "name">, string | null>;
export type ClientRecord = ClientInput & {
  id: string; version: number; createdAt: string; updatedAt: string; deletedAt: string | null;
  createdBy: string | null; updatedBy: string | null; deletedBy: string | null;
};
export const clientTypeLabel = (type: ClientType) => type === "business" ? "Business" : "Individual";
export type ClientErrors = Partial<Record<ClientField | "type" | "form" | "version", string>>;
