/**
 * Reading numbers from form fields with clear, consistent messages.
 */

import { parseDecimal } from '../parsing/parse';

export interface NumberRules {
  /** Field may be left empty (returns undefined). */
  optional?: boolean;
  /** Smallest allowed value; zero is allowed when min is 0. */
  min?: number;
  /** Values must be strictly greater than this (e.g. 0 for prices). */
  above?: number;
  max?: number;
  integer?: boolean;
  /** Used in messages, e.g. "price". */
  label?: string;
}

export type NumberCheck = { ok: true; value: number | undefined } | { ok: false; error: string };

export function checkNumber(raw: string, rules: NumberRules = {}, localeDecimal: '.' | ',' = '.'): NumberCheck {
  const label = rules.label ?? 'a number';
  if (raw.trim() === '') {
    return rules.optional ? { ok: true, value: undefined } : { ok: false, error: `Enter ${label}.` };
  }
  const parsed = parseDecimal(raw, localeDecimal);
  if (!parsed.ok) {
    if (parsed.error === 'negative') return { ok: false, error: 'This can’t be negative.' };
    return { ok: false, error: 'Enter a number, like 120 or 2.5.' };
  }
  const v = parsed.value;
  if (rules.above !== undefined && !(v > rules.above)) {
    return { ok: false, error: rules.above === 0 ? 'Must be more than 0.' : `Must be more than ${rules.above}.` };
  }
  if (rules.min !== undefined && v < rules.min) return { ok: false, error: `Must be at least ${rules.min}.` };
  if (rules.max !== undefined && v > rules.max) return { ok: false, error: `Must be ${rules.max} or less.` };
  if (rules.integer && !Number.isInteger(v)) return { ok: false, error: 'Use a whole number.' };
  if (v > 1e12) return { ok: false, error: 'That number is too large.' };
  return { ok: true, value: v };
}
