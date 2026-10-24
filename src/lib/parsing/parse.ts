/**
 * Lenient but careful parsing of numbers typed by shoppers around the world.
 *
 * Accepts "3.49", "3,49", "1,299.00", "1.299,00", "1 299", "1'299",
 * "12,50,000" (Indian grouping) and an optional currency symbol ("$3.49").
 * Rejects anything else rather than guessing.
 */

export type ParseError = 'empty' | 'invalid' | 'negative';
export type ParseResult = { ok: true; value: number } | { ok: false; error: ParseError };

const WHITESPACE_AND_APOSTROPHES = /[\s  '’]/g;
const CURRENCY_SYMBOLS = /\p{Sc}/gu;
const MINUS_SIGNS = /^[-−–]/;

function isGroupedInteger(s: string, sep: string): boolean {
  const g = sep === '.' ? '\\.' : sep;
  // Western grouping (1,234,567) or Indian grouping (12,34,567).
  return new RegExp(`^\\d{1,3}(${g}\\d{3})+$`).test(s) || new RegExp(`^\\d{1,2}(${g}\\d{2})*${g}\\d{3}$`).test(s);
}

/** The decimal separator used by a locale, e.g. "." for en-US, "," for de-DE. */
export function decimalSeparatorFor(locale: string | undefined): '.' | ',' {
  try {
    const part = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal');
    return part?.value === ',' ? ',' : '.';
  } catch {
    return '.';
  }
}

/**
 * Parses a decimal number. `localeDecimal` only matters for a single
 * separator followed by exactly three digits, e.g. "1,500": that is 1500 for
 * someone whose decimal separator is "." and 1.5 for someone who uses ",".
 */
export function parseDecimal(raw: string, localeDecimal: '.' | ',' = '.'): ParseResult {
  let s = raw.replace(WHITESPACE_AND_APOSTROPHES, '').replace(CURRENCY_SYMBOLS, '');
  if (s === '') return { ok: false, error: raw.trim() === '' ? 'empty' : 'invalid' };

  let negative = false;
  if (MINUS_SIGNS.test(s)) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return { ok: false, error: 'invalid' };

  const dots = s.split('.').length - 1;
  const commas = s.split(',').length - 1;
  let normalized: string;

  if (dots > 0 && commas > 0) {
    // Both used: whichever comes last is the decimal separator.
    const decimal = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const group = decimal === '.' ? ',' : '.';
    const [intPart, fracPart, ...rest] = s.split(decimal);
    if (rest.length > 0 || fracPart === undefined || !/^\d*$/.test(fracPart)) return { ok: false, error: 'invalid' };
    if (!isGroupedInteger(intPart ?? '', group)) return { ok: false, error: 'invalid' };
    normalized = `${(intPart ?? '').split(group).join('')}.${fracPart}`;
  } else if (dots + commas === 0) {
    normalized = s;
  } else {
    const sep = dots > 0 ? '.' : ',';
    const count = dots + commas;
    if (count > 1) {
      // "1,000,000" or "1.000.000": grouping only.
      if (!isGroupedInteger(s, sep)) return { ok: false, error: 'invalid' };
      normalized = s.split(sep).join('');
    } else {
      const [intPart = '', fracPart = ''] = s.split(sep);
      const looksGrouped = fracPart.length === 3 && /^[1-9]\d{0,2}$/.test(intPart);
      if (looksGrouped && sep !== localeDecimal) {
        normalized = intPart + fracPart;
      } else {
        normalized = `${intPart || '0'}.${fracPart}`;
      }
    }
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return { ok: false, error: 'invalid' };
  if (negative && value !== 0) return { ok: false, error: 'negative' };
  return { ok: true, value };
}

export type QuantityResult =
  | { ok: true; value: number; factors: number[] }
  | { ok: false; error: ParseError };

/**
 * Parses a package size. Multipacks can be written as "6 x 330" (also
 * "6×330" or "6*330"); the result is the product of the factors.
 */
export function parseQuantity(raw: string, localeDecimal: '.' | ',' = '.'): QuantityResult {
  if (raw.trim() === '') return { ok: false, error: 'empty' };
  const parts = raw.split(/[x×X*]/);
  if (parts.length > 3) return { ok: false, error: 'invalid' };
  const factors: number[] = [];
  for (const part of parts) {
    const r = parseDecimal(part, localeDecimal);
    if (!r.ok) return { ok: false, error: r.error === 'empty' ? 'invalid' : r.error };
    factors.push(r.value);
  }
  return { ok: true, value: factors.reduce((a, b) => a * b, 1), factors };
}
