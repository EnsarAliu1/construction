/** Validate serialization only; this does not apply financial business rules. */
export function eurDecimal(value: string): string {
  if (!/^(0|[1-9]\d{0,16})\.\d{2}$/.test(value)) {
    throw new Error("EUR values must be nonnegative DECIMAL(19,2) strings with exactly two fractional digits");
  }
  return value;
}
