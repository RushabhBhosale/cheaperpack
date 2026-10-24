/**
 * Units of measurement and the reference units prices are expressed "per".
 *
 * Every unit belongs to exactly one dimension (weight, volume or count) and
 * is defined by its size in that dimension's base unit (grams, millilitres
 * or items). Conversions only ever happen inside a dimension: there is no
 * code path that turns a weight into a volume, because that would require
 * knowing the product's density.
 */

export type Dimension = 'mass' | 'volume' | 'count';

export type UnitId =
  | 'g'
  | 'kg'
  | 'oz'
  | 'lb'
  | 'ml'
  | 'cl'
  | 'l'
  | 'floz_us'
  | 'floz_uk'
  | 'gal_us'
  | 'item';

export interface Unit {
  id: UnitId;
  dimension: Dimension;
  /** Size of one of this unit in the dimension's base unit (g, ml or item). */
  toBase: number;
  /** Short label shown next to numbers, e.g. "kg" or "US fl oz". */
  symbol: string;
  /** Longer label for the unit menu. */
  label: string;
  /** Units customarily used in the United States. */
  us: boolean;
}

// Exact definitions: international avoirdupois pound (1959) = 453.59237 g,
// ounce = 1/16 lb; US gallon = 231 cubic inches; US fl oz = 1/128 US gal;
// imperial fl oz = 28.4130625 ml.
export const UNITS: Record<UnitId, Unit> = {
  g: { id: 'g', dimension: 'mass', toBase: 1, symbol: 'g', label: 'g (grams)', us: false },
  kg: { id: 'kg', dimension: 'mass', toBase: 1000, symbol: 'kg', label: 'kg (kilograms)', us: false },
  oz: { id: 'oz', dimension: 'mass', toBase: 28.349523125, symbol: 'oz', label: 'oz (ounces, weight)', us: true },
  lb: { id: 'lb', dimension: 'mass', toBase: 453.59237, symbol: 'lb', label: 'lb (pounds)', us: true },
  ml: { id: 'ml', dimension: 'volume', toBase: 1, symbol: 'ml', label: 'ml (millilitres)', us: false },
  cl: { id: 'cl', dimension: 'volume', toBase: 10, symbol: 'cl', label: 'cl (centilitres)', us: false },
  l: { id: 'l', dimension: 'volume', toBase: 1000, symbol: 'L', label: 'L (litres)', us: false },
  floz_us: { id: 'floz_us', dimension: 'volume', toBase: 29.5735295625, symbol: 'US fl oz', label: 'fl oz (US fluid ounces)', us: true },
  floz_uk: { id: 'floz_uk', dimension: 'volume', toBase: 28.4130625, symbol: 'UK fl oz', label: 'fl oz (UK fluid ounces)', us: false },
  gal_us: { id: 'gal_us', dimension: 'volume', toBase: 3785.411784, symbol: 'US gal', label: 'gal (US gallons)', us: true },
  item: { id: 'item', dimension: 'count', toBase: 1, symbol: 'items', label: 'items (count)', us: false },
};

export const DIMENSION_LABELS: Record<Dimension, string> = {
  mass: 'Weight',
  volume: 'Volume',
  count: 'Count',
};

/** Units grouped by dimension, in menu order. */
export const UNIT_GROUPS: { dimension: Dimension; units: Unit[] }[] = (
  ['mass', 'volume', 'count'] as const
).map((dimension) => ({
  dimension,
  units: Object.values(UNITS).filter((u) => u.dimension === dimension),
}));

export function getUnit(id: string): Unit | undefined {
  return Object.hasOwn(UNITS, id) ? UNITS[id as UnitId] : undefined;
}

/** Converts an amount between two units of the same dimension. */
export function convert(amount: number, from: Unit, to: Unit): number {
  if (from.dimension !== to.dimension) {
    throw new Error(`Cannot convert ${from.dimension} (${from.id}) to ${to.dimension} (${to.id})`);
  }
  if (from.id === to.id) return amount;
  return (amount * from.toBase) / to.toBase;
}

/**
 * A reference amount that unit prices are shown "per", such as 1 kg or
 * 100 ml. `multiple` is how many of `unit` the reference amount contains.
 */
export interface PerUnit {
  id: string;
  unit: Unit;
  multiple: number;
  /** e.g. "kg", "100 g", "US fl oz" */
  label: string;
}

function per(unitId: UnitId, multiple = 1, label?: string): PerUnit {
  const unit = UNITS[unitId];
  const id = multiple === 1 ? unitId : `${multiple}${unitId}`;
  return { id, unit, multiple, label: label ?? (multiple === 1 ? unit.symbol : `${multiple} ${unit.symbol}`) };
}

export const PER_UNITS: Record<Dimension, PerUnit[]> = {
  mass: [per('kg'), per('g', 100), per('lb'), per('oz')],
  volume: [per('l'), per('ml', 100), per('floz_us'), per('gal_us'), per('floz_uk')],
  count: [per('item', 1, 'item')],
};

export function findPerUnit(dimension: Dimension, id: string | undefined): PerUnit | undefined {
  return PER_UNITS[dimension].find((p) => p.id === id);
}

/** Size of a reference amount in the dimension's base unit. */
export function perUnitBase(p: PerUnit): number {
  return p.unit.toBase * p.multiple;
}

/**
 * Picks a sensible reference amount: per ounce / US fl oz when every product
 * uses US customary units (as US shelf labels do), otherwise per kg / per L.
 */
export function defaultPerUnit(dimension: Dimension, unitsUsed: Unit[]): PerUnit {
  const allUs = unitsUsed.length > 0 && unitsUsed.every((u) => u.us);
  if (dimension === 'mass') return allUs ? per('oz') : per('kg');
  if (dimension === 'volume') return allUs ? per('floz_us') : per('l');
  return per('item', 1, 'item');
}
