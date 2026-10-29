export const referenceKinds = ["categories", "persons", "vehicles"] as const;
export type ReferenceKind = typeof referenceKinds[number];
export type ReferenceField = "name" | "email" | "phone" | "identificationReference" | "address" | "identifier" | "description";
type FieldDefinition = { key: ReferenceField; label: string; max: number; required?: boolean; type?: "email" | "tel" };
export const referenceDefinitions: Record<ReferenceKind, { title: string; singular: string; entity: string; description: string; fields: FieldDefinition[] }> = {
  categories: { title: "Kategoritë e shpenzimeve", singular: "kategori", entity: "expense_category", description: "Kategoritë e përcaktuara të shpenzimeve. Kategoritë joaktive ruajnë lidhjet e tyre historike.", fields: [{ key: "name", label: "Emri i kategorisë", max: 150, required: true }] },
  persons: { title: "Personat / Furnitorët", singular: "person / furnitor", entity: "person", description: "Furnitorët ose përfituesit e regjistruar të pagesave. Kontakti dhe të dhënat identifikuese janë opsionale.", fields: [
    { key: "name", label: "Emri", max: 200, required: true }, { key: "email", label: "Emaili", max: 254, type: "email" }, { key: "phone", label: "Telefoni", max: 64, type: "tel" }, { key: "identificationReference", label: "Referenca identifikuese", max: 150 }, { key: "address", label: "Adresa", max: 65535 },
  ] },
  vehicles: { title: "Automjetet", singular: "automjet", entity: "vehicle", description: "Identifikuesit dhe përshkrimet e automjeteve për lidhjen me shpenzimet e ardhshme.", fields: [{ key: "identifier", label: "Identifikuesi / Regjistrimi i automjetit", max: 100, required: true }, { key: "description", label: "Përshkrimi", max: 65535 }] },
};
export function isReferenceKind(value: string): value is ReferenceKind { return referenceKinds.includes(value as ReferenceKind); }
export type ReferenceInput = Record<ReferenceField, string | null>;
export type ReferenceRecord = Partial<ReferenceInput> & { id: string; label: string; isActive: boolean; version: number; createdBy: string | null; updatedBy: string | null; deactivatedBy: string | null; deactivatedAt: string | null; createdAt: string; updatedAt: string };
