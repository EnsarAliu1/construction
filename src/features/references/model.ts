export const referenceKinds = ["categories", "persons", "vehicles"] as const;
export type ReferenceKind = typeof referenceKinds[number];
export type ReferenceField = "name" | "email" | "phone" | "identificationReference" | "address" | "identifier" | "description";
type FieldDefinition = { key: ReferenceField; label: string; max: number; required?: boolean; type?: "email" | "tel" };
export const referenceDefinitions: Record<ReferenceKind, { title: string; singular: string; entity: string; description: string; fields: FieldDefinition[] }> = {
  categories: { title: "Expense Categories", singular: "category", entity: "expense_category", description: "Predefined expense categories. Inactive categories retain their historical references.", fields: [{ key: "name", label: "Category name", max: 150, required: true }] },
  persons: { title: "Persons / Suppliers", singular: "person / supplier", entity: "person", description: "Registered suppliers or payment recipients. Contact and identification details are optional.", fields: [
    { key: "name", label: "Name", max: 200, required: true }, { key: "email", label: "Email", max: 254, type: "email" }, { key: "phone", label: "Phone", max: 64, type: "tel" }, { key: "identificationReference", label: "Identification reference", max: 150 }, { key: "address", label: "Address", max: 65535 },
  ] },
  vehicles: { title: "Vehicles", singular: "vehicle", entity: "vehicle", description: "Registered vehicle identifiers and descriptions for future expense associations.", fields: [{ key: "identifier", label: "Vehicle identifier / registration", max: 100, required: true }, { key: "description", label: "Description", max: 65535 }] },
};
export function isReferenceKind(value: string): value is ReferenceKind { return referenceKinds.includes(value as ReferenceKind); }
export type ReferenceInput = Record<ReferenceField, string | null>;
export type ReferenceRecord = Partial<ReferenceInput> & { id: string; label: string; isActive: boolean; version: number; createdBy: string | null; updatedBy: string | null; deactivatedBy: string | null; deactivatedAt: string | null; createdAt: string; updatedAt: string };
