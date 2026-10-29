export const clientFields = {
  name: { label: "Emri", max: 200 },
  nui: { label: "NUI (opsionale)", max: 100 },
  email: { label: "Emaili", max: 254 },
  phone: { label: "Telefoni", max: 64 },
  addressLine1: { label: "Adresa, rreshti 1", max: 255 },
  addressLine2: { label: "Adresa, rreshti 2", max: 255 },
  city: { label: "Qyteti", max: 150 },
  postalCode: { label: "Kodi postar", max: 32 },
  country: { label: "Shteti", max: 100 },
} as const;

export type ClientField = keyof typeof clientFields;
export type ClientType = "private_person" | "business";
export type ClientInput = { type: ClientType; name: string } & Record<Exclude<ClientField, "name">, string | null>;
export type ClientRecord = ClientInput & {
  id: string; version: number; createdAt: string; updatedAt: string; deletedAt: string | null;
  createdBy: string | null; updatedBy: string | null; deletedBy: string | null;
};
export const clientTypeLabel = (type: ClientType) => type === "business" ? "Biznes" : "Individ";
export type ClientErrors = Partial<Record<ClientField | "type" | "form" | "version", string>>;
