/**
 * Validates products and compares them by price per reference unit.
 *
 * Pure functions with no DOM access, shared by the browser calculator, the
 * pre-rendered worked example and the unit tests.
 */

import { parseDecimal, parseQuantity, type ParseError } from '../parsing/parse';
import {
  DIMENSION_LABELS,
  defaultPerUnit,
  findPerUnit,
  getUnit,
  perUnitBase,
  type Dimension,
  type PerUnit,
  type Unit,
} from './units';

export const MIN_PRODUCTS = 2;
export const MAX_PRODUCTS = 4;
export const MAX_NAME_LENGTH = 60;
const MAX_PRICE = 1e12;
const MAX_QUANTITY = 1e9;
/** Unit prices this close (relative) are treated as equal, to absorb floating-point noise. */
const TIE_TOLERANCE = 1e-9;

export interface ProductInput {
  name: string;
  price: string;
  quantity: string;
  unit: string;
}

export interface Product {
  /** Position in the form, 0-based. */
  index: number;
  /** The name the shopper typed, or "Product A", "Product B", ... */
  label: string;
  price: number;
  quantity: number;
  /** Multipack factors when the size was entered as e.g. "6 x 330". */
  factors: number[];
  unit: Unit;
  /** Size in the dimension's base unit (g, ml or items). */
  baseQuantity: number;
}

export type Field = 'name' | 'price' | 'quantity' | 'unit';
export type FieldErrors = Partial<Record<Field, string>>;

export interface ProductValidation {
  index: number;
  label: string;
  /** No price and no size entered: the row is ignored. */
  empty: boolean;
  errors: FieldErrors;
  product?: Product;
}

export function productLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function defaultLabel(index: number): string {
  return `Product ${productLetter(index)}`;
}

const PRICE_MESSAGES: Record<ParseError, string> = {
  empty: 'Enter the price.',
  invalid: 'Enter the price as a number, like 3.49.',
  negative: 'The price can’t be negative.',
};

const QUANTITY_MESSAGES: Record<ParseError, string> = {
  empty: 'Enter the package size.',
  invalid: 'Enter the size as a number, like 500, or 6 x 330 for a multipack.',
  negative: 'The size can’t be negative.',
};

export function validateProduct(input: ProductInput, index: number, localeDecimal: '.' | ',' = '.'): ProductValidation {
  const name = input.name.trim();
  const label = name || defaultLabel(index);
  const errors: FieldErrors = {};

  if (input.price.trim() === '' && input.quantity.trim() === '') {
    return { index, label, empty: true, errors };
  }

  if (name.length > MAX_NAME_LENGTH) errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;

  let price: number | undefined;
  const p = parseDecimal(input.price, localeDecimal);
  if (!p.ok) errors.price = PRICE_MESSAGES[p.error];
  else if (p.value === 0) errors.price = 'The price must be more than zero.';
  else if (p.value > MAX_PRICE) errors.price = 'That price is too large to compare.';
  else price = p.value;

  const unit = getUnit(input.unit);
  if (!unit) errors.unit = 'Choose a unit.';

  let quantity: number | undefined;
  let factors: number[] = [];
  const q = parseQuantity(input.quantity, localeDecimal);
  if (!q.ok) errors.quantity = QUANTITY_MESSAGES[q.error];
  else if (q.factors.some((f) => f === 0)) errors.quantity = 'The size must be more than zero.';
  else if (q.value > MAX_QUANTITY) errors.quantity = 'That size is too large to compare.';
  else if (unit?.dimension === 'count' && !q.factors.every(Number.isInteger)) {
    errors.quantity = 'Item counts must be whole numbers.';
  } else {
    quantity = q.value;
    factors = q.factors.length > 1 ? q.factors : [];
  }

  if (price === undefined || quantity === undefined || !unit || errors.name) {
    return { index, label, empty: false, errors };
  }

  return {
    index,
    label,
    empty: false,
    errors,
    product: { index, label, price, quantity, factors, unit, baseQuantity: quantity * unit.toBase },
  };
}

export interface RankedProduct extends Product {
  /** Price per base unit (per g, ml or item). */
  pricePerBase: number;
  /** Price per the chosen reference amount (e.g. per kg). */
  unitPrice: number;
  isBest: boolean;
  /** How much more this costs per reference amount than the best value. 0 for the best. */
  diffPerUnit: number;
  /** diffPerUnit as a fraction of the best unit price (0.25 = 25% more). */
  diffFraction: number;
  /** Extra paid for this package's amount compared with buying it at the best unit price. */
  extraForThisAmount: number;
}

export type Comparison =
  | {
      status: 'incomplete';
      validations: ProductValidation[];
      /** Explains what's missing when no field-level errors exist (e.g. only one product filled in). */
      message: string;
    }
  | {
      status: 'mismatch';
      validations: ProductValidation[];
      message: string;
      groups: { dimension: Dimension; labels: string[] }[];
    }
  | {
      status: 'ok';
      validations: ProductValidation[];
      dimension: Dimension;
      perUnit: PerUnit;
      /** Products in form order. */
      products: RankedProduct[];
      /** Products sorted cheapest first (ties keep form order). */
      ranked: RankedProduct[];
      best: RankedProduct[];
      /** Every product has the same unit price. */
      allTied: boolean;
      /** Cheapest product that is not a best value; absent when everything ties. */
      runnerUp?: RankedProduct;
      /** Most expensive product per unit; absent when everything ties. */
      priciest?: RankedProduct;
      /** Indices of rows left out because they were completely empty. */
      skipped: number[];
    };

export interface CompareOptions {
  /** Requested reference unit id, e.g. "kg" or "100g". Ignored if it doesn't fit the products' dimension. */
  perUnitId?: string;
  localeDecimal?: '.' | ',';
}

function listLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

export function isTied(a: number, b: number): boolean {
  return Math.abs(a - b) <= TIE_TOLERANCE * Math.max(Math.abs(a), Math.abs(b));
}

export function compareProducts(inputs: ProductInput[], options: CompareOptions = {}): Comparison {
  const validations = inputs.map((input, i) => validateProduct(input, i, options.localeDecimal));
  const filled = validations.filter((v) => !v.empty);

  if (filled.some((v) => !v.product)) {
    return { status: 'incomplete', validations, message: 'Fix the highlighted fields to see the comparison.' };
  }
  if (filled.length < MIN_PRODUCTS) {
    const needed = MIN_PRODUCTS - filled.length;
    return {
      status: 'incomplete',
      validations,
      message:
        needed === 2
          ? 'Enter a price and size for at least two products to compare them.'
          : 'Enter a price and size for one more product to compare.',
    };
  }

  const products = filled.map((v) => v.product as Product);

  const byDimension = new Map<Dimension, string[]>();
  for (const p of products) {
    byDimension.set(p.unit.dimension, [...(byDimension.get(p.unit.dimension) ?? []), p.label]);
  }
  if (byDimension.size > 1) {
    const groups = [...byDimension].map(([dimension, labels]) => ({ dimension, labels }));
    const described = groups
      .map((g) => `${listLabels(g.labels)} ${g.labels.length === 1 ? 'is' : 'are'} measured by ${DIMENSION_LABELS[g.dimension].toLowerCase()}`)
      .join('; ');
    return {
      status: 'mismatch',
      validations,
      groups,
      message: `These can’t be compared fairly: ${described}. Use the same kind of unit for every product. Weight and volume can’t be converted into each other without knowing the product’s density, so CheaperPack won’t guess.`,
    };
  }

  const dimension = products[0]!.unit.dimension;
  const perUnit = findPerUnit(dimension, options.perUnitId) ?? defaultPerUnit(dimension, products.map((p) => p.unit));
  const refBase = perUnitBase(perUnit);

  const priced = products.map((p) => ({ ...p, pricePerBase: p.price / p.baseQuantity }));
  const bestPerBase = Math.min(...priced.map((p) => p.pricePerBase));

  const ranked0: RankedProduct[] = priced.map((p) => {
    const isBest = isTied(p.pricePerBase, bestPerBase);
    const diffPerBase = isBest ? 0 : p.pricePerBase - bestPerBase;
    return {
      ...p,
      unitPrice: p.pricePerBase * refBase,
      isBest,
      diffPerUnit: diffPerBase * refBase,
      diffFraction: isBest ? 0 : diffPerBase / bestPerBase,
      extraForThisAmount: diffPerBase * p.baseQuantity,
    };
  });

  const ranked = [...ranked0].sort((a, b) => {
    if (a.isBest !== b.isBest) return a.isBest ? -1 : 1;
    if (a.isBest || isTied(a.pricePerBase, b.pricePerBase)) return a.index - b.index;
    return a.pricePerBase - b.pricePerBase;
  });
  const best = ranked.filter((p) => p.isBest);
  const others = ranked.filter((p) => !p.isBest);

  return {
    status: 'ok',
    validations,
    dimension,
    perUnit,
    products: ranked0,
    ranked,
    best,
    allTied: others.length === 0,
    runnerUp: others[0],
    priciest: others.at(-1),
    skipped: validations.filter((v) => v.empty).map((v) => v.index),
  };
}
