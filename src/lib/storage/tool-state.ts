/**
 * State of the smart price comparison tool: products as typed, share links
 * and recent comparisons. Pure functions so they can be tested.
 */

import { isCurrency, type CurrencyCode } from '../formatting/currency';

export const TOOL_UNITS = ['g', 'kg', 'ml', 'cl', 'l', 'item', 'oz', 'lb', 'floz_us', 'gal_us', 'floz_uk'] as const;
export type ToolUnit = (typeof TOOL_UNITS)[number];
export const TOOL_UNIT_LABELS: Record<ToolUnit, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  cl: 'cl',
  l: 'L',
  item: 'pcs',
  oz: 'oz',
  lb: 'lb',
  floz_us: 'fl oz',
  gal_us: 'gal',
  floz_uk: 'UK fl oz',
};
/** Unit menu groups: everyday units first. */
export const TOOL_UNIT_GROUPS: { label: string; units: ToolUnit[] }[] = [
  { label: 'Common', units: ['g', 'kg', 'ml', 'l', 'item'] },
  { label: 'US', units: ['oz', 'lb', 'floz_us', 'gal_us'] },
  { label: 'Other', units: ['cl', 'floz_uk'] },
];
export const MAX_TOOL_PRODUCTS = 8;
export const MAX_RECENTS = 5;

export interface ToolProduct {
  name: string;
  price: string;
  quantity: string;
  unit: ToolUnit;
}

export interface ToolSnapshot {
  products: ToolProduct[];
  currency: CurrencyCode;
}

export interface RecentComparison extends ToolSnapshot {
  savedAt: number;
}

export const isToolUnit = (u: unknown): u is ToolUnit => typeof u === 'string' && (TOOL_UNITS as readonly string[]).includes(u);

export const emptyProduct = (unit: ToolUnit = 'g'): ToolProduct => ({ name: '', price: '', quantity: '', unit });

export const isBlank = (p: ToolProduct) => !p.name.trim() && !p.price.trim() && !p.quantity.trim();

// ---------------------------------------------------------------- share links

const enc = (s: string) => encodeURIComponent(s).replace(/~/g, '%7E');

/** Encodes a comparison for the URL fragment (never sent to a server). */
export function encodeShare(snapshot: ToolSnapshot): string {
  const params = new URLSearchParams();
  params.set('v', '1');
  params.set('c', snapshot.currency);
  const parts = snapshot.products
    .filter((p) => !isBlank(p))
    .slice(0, MAX_TOOL_PRODUCTS)
    .map((p) => [p.price.trim(), p.quantity.trim(), p.unit, p.name.trim().slice(0, 60)].map(enc).join('~'));
  // URLSearchParams would re-encode our '%', so build the product list by hand.
  return `${params.toString()}&p=${parts.join('_')}`;
}

export function decodeShare(fragment: string): ToolSnapshot | null {
  const hash = fragment.replace(/^#/, '');
  if (!hash) return null;
  const pMatch = hash.match(/(?:^|&)p=([^&]*)/);
  const params = new URLSearchParams(hash.replace(/(?:^|&)p=[^&]*/, ''));
  if (params.get('v') !== '1' || !pMatch) return null;
  const currency = params.get('c');
  const products: ToolProduct[] = [];
  for (const part of (pMatch[1] ?? '').split('_').slice(0, MAX_TOOL_PRODUCTS)) {
    const fields = part.split('~');
    if (fields.length !== 4) return null;
    let price: string, quantity: string, unit: string, name: string;
    try {
      [price, quantity, unit, name] = fields.map((f) => decodeURIComponent(f)) as [string, string, string, string];
    } catch {
      return null;
    }
    if (!isToolUnit(unit)) return null;
    products.push({ price: price.slice(0, 20), quantity: quantity.slice(0, 20), unit, name: name.slice(0, 60) });
  }
  if (products.length === 0) return null;
  return { products, currency: isCurrency(currency) ? currency : 'INR' };
}

// ---------------------------------------------------------------- recents

/** Identity of a comparison, ignoring blank rows and whitespace. */
export function signature(snapshot: ToolSnapshot): string {
  return JSON.stringify([
    snapshot.currency,
    snapshot.products.filter((p) => !isBlank(p)).map((p) => [p.name.trim(), p.price.trim(), p.quantity.trim(), p.unit]),
  ]);
}

/** Adds a comparison to the front of the list, replacing an identical one. */
export function addRecent(list: RecentComparison[], snapshot: ToolSnapshot, now = Date.now()): RecentComparison[] {
  const sig = signature(snapshot);
  const entry: RecentComparison = {
    currency: snapshot.currency,
    products: snapshot.products.filter((p) => !isBlank(p)).map((p) => ({ ...p })),
    savedAt: now,
  };
  return [entry, ...list.filter((r) => signature(r) !== sig)].slice(0, MAX_RECENTS);
}

/** Validates whatever was in storage; drops anything malformed. */
export function parseRecents(raw: string | null): RecentComparison[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (r): r is RecentComparison =>
          !!r &&
          typeof r === 'object' &&
          typeof r.savedAt === 'number' &&
          isCurrency(r.currency) &&
          Array.isArray(r.products) &&
          r.products.length > 0 &&
          r.products.every(
            (p: unknown) =>
              !!p &&
              typeof p === 'object' &&
              typeof (p as ToolProduct).name === 'string' &&
              typeof (p as ToolProduct).price === 'string' &&
              typeof (p as ToolProduct).quantity === 'string' &&
              isToolUnit((p as ToolProduct).unit),
          ),
      )
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}
