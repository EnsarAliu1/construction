import { eurDecimal } from "@/server/db/money";

export function cents(value: string): bigint {
  if (!/^(0|[1-9]\d*)\.\d{2}$/.test(value)) throw new Error("Kërkohet vlerë dhjetore jonegative e saktë në formë teksti.");
  const [whole, fraction] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction);
}
export function decimal(value: bigint): string {
  const sign = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  return `${sign}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}
/** Editing convenience only: no Number/parseFloat conversion. */
export function inputMoney(value: string): string {
  const text = value.trim();
  if (!/^\d{1,17}(?:\.\d{0,2})?$/.test(text)) throw new Error("Shkruani shumë jonegative në EUR me deri në dy shifra dhjetore.");
  const [whole, fraction = ""] = text.split(".");
  return eurDecimal(`${whole.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(2, "0")}`);
}
