/**
 * Locale-aware formatting and the plain-language explanation of each result.
 */

import { isTied, type RankedProduct } from '../calculations/compare';
import { convert, type PerUnit } from '../calculations/units';

const MAX_FRACTION_DIGITS = 6;

function currencyFractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * Fraction digits for a precise amount: the currency's usual digits, or three
 * significant digits for amounts smaller than a tenth of the main unit
 * (e.g. $0.0349 per item instead of $0.03).
 */
function preciseDigits(value: number, base: number): number {
  const abs = Math.abs(value);
  if (abs === 0 || !Number.isFinite(abs) || abs >= 10 ** (1 - base)) return base;
  return Math.min(MAX_FRACTION_DIGITS, Math.max(base, 2 - Math.floor(Math.log10(abs))));
}

/**
 * Formats a money amount. With `precise`, small amounts keep three significant
 * digits; `extraDigits` allows more decimals still (trailing zeros are trimmed).
 */
export function formatMoney(value: number, currency: string, locale: string | undefined, precise = false, extraDigits = 0): string {
  const base = currencyFractionDigits(currency);
  const max = Math.min(MAX_FRACTION_DIGITS, (precise ? preciseDigits(value, base) : base) + extraDigits);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: base,
    maximumFractionDigits: Math.max(base, max),
  }).format(value);
}

/**
 * Extra decimals needed so that unit prices which aren't tied never display
 * identically (e.g. $2.191 and $2.189 instead of $2.19 twice).
 */
export function distinguishingDigits(values: number[], currency: string, locale: string | undefined): number {
  for (let extra = 0; extra < 4; extra++) {
    const shown = values.map((v) => formatMoney(v, currency, locale, true, extra));
    const clash = values.some((a, i) => values.some((b, j) => j > i && !isTied(a, b) && shown[i] === shown[j]));
    if (!clash) return extra;
  }
  return 4;
}

/** The symbol a locale shows for a currency, e.g. "$", "€", "CHF". */
export function currencySymbol(currency: string, locale: string | undefined): string {
  try {
    return (
      new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/** Plain number: up to 3 decimals, or 4 significant digits below 1. */
export function formatNumber(value: number, locale: string | undefined): string {
  const opts: Intl.NumberFormatOptions =
    Math.abs(value) >= 1 || value === 0 ? { maximumFractionDigits: 3 } : { maximumSignificantDigits: 4 };
  return new Intl.NumberFormat(locale, opts).format(value);
}

export function formatPercent(fraction: number, locale: string | undefined): string {
  if (fraction > 0 && fraction < 0.001) {
    return `<${new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(0.001)}`;
  }
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: fraction < 0.1 ? 1 : 0,
  }).format(fraction);
}

export function formatQuantity(product: Pick<RankedProduct, 'quantity' | 'unit' | 'factors'>, locale: string | undefined): string {
  const unit = product.unit.id === 'item' && product.quantity === 1 ? 'item' : product.unit.symbol;
  if (product.factors.length > 1) {
    return `${product.factors.map((f) => formatNumber(f, locale)).join(' × ')} ${unit}`;
  }
  return `${formatNumber(product.quantity, locale)} ${unit}`;
}

/**
 * Step-by-step arithmetic for one product, e.g.
 *   ["1.5 lb = 0.6804 kg", "$5.99 ÷ 0.6804 kg = $8.80 per kg"]
 * Numbers in the steps are rounded for display; the result is calculated
 * at full precision.
 */
export function explainSteps(
  p: RankedProduct,
  perUnit: PerUnit,
  currency: string,
  locale: string | undefined,
  extraDigits = 0,
): string[] {
  const steps: string[] = [];
  const num = (v: number) => formatNumber(v, locale);
  const unitWord = (u: { id: string; symbol: string }, n: number) => (u.id === 'item' && n === 1 ? 'item' : u.symbol);

  if (p.factors.length > 1) {
    steps.push(`${p.factors.map(num).join(' × ')} ${p.unit.symbol} = ${num(p.quantity)} ${unitWord(p.unit, p.quantity)}`);
  }

  const target = perUnit.unit;
  const size = convert(p.quantity, p.unit, target);
  if (target.id !== p.unit.id) {
    const factor = convert(1, p.unit, target);
    steps.push(
      `${num(p.quantity)} ${unitWord(p.unit, p.quantity)} = ${num(size)} ${target.symbol} (1 ${p.unit.symbol} = ${num(factor)} ${target.symbol})`,
    );
  }

  const price = formatMoney(p.price, currency, locale);
  const result = `${formatMoney(p.unitPrice, currency, locale, true, extraDigits)} per ${perUnit.label}`;
  if (perUnit.multiple === 1) {
    steps.push(`${price} ÷ ${num(size)} ${unitWord(target, size)} = ${result}`);
  } else {
    steps.push(`${price} ÷ ${num(size)} ${target.symbol} × ${num(perUnit.multiple)} = ${result}`);
  }
  return steps;
}
