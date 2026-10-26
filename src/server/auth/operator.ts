import { createHash, timingSafeEqual } from "node:crypto";
import { OperatorRequired } from "./security";

export type OperatorContext = { readonly kind: "adore_operator" };
const issued = new WeakSet<object>();

/** Only the local CLI uses this capability. No HTTP route exposes it. */
export function authenticateOperator(provided: string): OperatorContext {
  const expected = process.env.ADORE_OPERATOR_KEY;
  if (!expected || expected.length < 32 || !provided || !timingSafeEqual(createHash("sha256").update(provided).digest(), createHash("sha256").update(expected).digest())) {
    throw new OperatorRequired();
  }
  const context = Object.freeze({ kind: "adore_operator" as const });
  issued.add(context);
  return context;
}

export function requireOperator(context: OperatorContext) {
  if (!context || typeof context !== "object" || !issued.has(context)) throw new OperatorRequired();
}
