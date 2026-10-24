/**
 * Money arithmetic. Amounts are rounded to whole cents/paise at each step a
 * real checkout would round (each discount, cashback, instalment), using
 * round-half-up, so results match what shoppers see on bills.
 */

/** Rounds to `digits` decimals, half away from zero, avoiding float artefacts like 1.005 → 1.00. */
export function roundMoney(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  const scaled = Math.abs(value) * factor;
  const rounded = Math.round(Number(scaled.toPrecision(15))) / factor;
  return value < 0 ? -rounded : rounded;
}

/** Sum with rounding at the end, so many small amounts don't drift. */
export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((a, b) => a + b, 0));
}

/** part ÷ whole, or 0 when whole is 0. */
export function fraction(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

/** How much cheaper `low` is than `high`, as a fraction of `high` (0.2 = 20% cheaper). */
export function cheaperBy(low: number, high: number): number {
  return high <= 0 ? 0 : (high - low) / high;
}
