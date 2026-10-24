/**
 * Currency choice shared by every tool (INR, USD, EUR, GBP) and money
 * formatting. Nothing is ever converted between currencies.
 */

import { isToolCurrency, toolCurrencyForLocale, type ToolCurrency } from '../formatting/currency';
import { decimalSeparatorFor } from '../parsing/parse';
import { readJSON, writeJSON } from '../storage/local';

export const locale = (typeof navigator !== 'undefined' && navigator.language) || 'en-IN';
export const localeDecimal = decimalSeparatorFor(locale);

const KEY = 'currency';
let current: ToolCurrency = (() => {
  const saved = readJSON<unknown>(KEY, null) ?? readJSON<unknown>('tool-currency', null);
  return isToolCurrency(saved) ? saved : toolCurrencyForLocale(locale);
})();
let chosen = isToolCurrency(readJSON<unknown>(KEY, null));
const listeners = new Set<(c: ToolCurrency) => void>();

export const getCurrency = () => current;
/** True once the visitor has picked a currency themselves. */
export const currencyChosen = () => chosen;

export function symbol(currency: string = current): string {
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

function sync() {
  for (const sel of document.querySelectorAll<HTMLSelectElement>('[data-currency]')) sel.value = current;
  for (const el of document.querySelectorAll('[data-cur]')) el.textContent = symbol();
}

/** Changes the currency. `byUser` remembers it as the visitor's choice. */
export function setCurrency(c: ToolCurrency, byUser = true) {
  if (byUser) {
    chosen = true;
    writeJSON(KEY, c);
  }
  if (c === current) return;
  current = c;
  sync();
  for (const fn of listeners) fn(c);
}

export function onCurrency(fn: (c: ToolCurrency) => void) {
  listeners.add(fn);
}

/** Wires up every currency picker on the page. Call once per page. */
export function initCurrency() {
  sync();
  for (const sel of document.querySelectorAll<HTMLSelectElement>('[data-currency]')) {
    sel.addEventListener('change', () => {
      if (isToolCurrency(sel.value)) setCurrency(sel.value);
    });
  }
}

function digits(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * ₹64, ₹0.72, ₹10.50: whole amounts without decimals, small amounts with
 * enough digits to be meaningful. `extra` adds decimals when two different
 * values would otherwise look the same.
 */
export function money(value: number, opts: { extra?: number; currency?: string; exact?: boolean } = {}): string {
  const currency = opts.currency ?? current;
  if (!Number.isFinite(value)) return '—';
  const base = digits(currency);
  const abs = Math.abs(value);
  let max = base + (opts.extra ?? 0);
  if (abs > 0 && abs < 10 ** (1 - base)) max = Math.max(max, Math.min(6, 2 - Math.floor(Math.log10(abs))));
  const rounded = Number(value.toFixed(max));
  const whole = !opts.exact && Math.abs(rounded - Math.round(rounded)) < 1e-9;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : base,
    maximumFractionDigits: whole ? 0 : max,
  }).format(value);
}

export function pct(fraction: number, maxDigits = 1): string {
  if (!Number.isFinite(fraction)) return '—';
  if (fraction > 0 && fraction < 0.001) return '<0.1%';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: maxDigits }).format(fraction);
}

export function num(value: number, maxDigits = 2): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: maxDigits }).format(value);
}
