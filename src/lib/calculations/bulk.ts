/**
 * Is the bulk pack worth it? Unit prices, savings, break-even amount and
 * wastage based on how fast the shopper uses the product.
 */

import { cheaperBy, roundMoney } from './money';
import { UNITS, type Dimension, type UnitId } from './units';

export type Period = 'day' | 'week' | 'month';
export const PERIOD_DAYS: Record<Period, number> = { day: 1, week: 7, month: 365.25 / 12 };

export interface Pack {
  price: number;
  quantity: number;
  unit: UnitId;
}

export interface BulkInput {
  regular: Pack;
  bulk: Pack;
  /** How much the shopper uses per period. */
  usage?: { amount: number; unit: UnitId; per: Period };
  /** How long the bulk pack lasts once opened or before it expires. */
  shelfLife?: { value: number; per: Period };
}

export interface BulkResult {
  dimension: Dimension;
  /** Prices per base unit (g, ml or piece). */
  regularPerBase: number;
  bulkPerBase: number;
  regularBase: number;
  bulkBase: number;
  cheaper: 'bulk' | 'regular' | 'same';
  /** How much cheaper the cheaper pack is per unit (fraction of the dearer one). */
  savingFraction: number;
  /** Buying the bulk amount in regular packs vs the bulk pack. */
  regularCostForBulkAmount: number;
  bulkSaving: number;
  regularPacksEquivalent: number;
  /** Amount of the bulk pack you must actually use for it to beat regular packs. */
  breakEvenBase?: number;
  breakEvenFraction?: number;
  usage?: {
    daysToFinish: number;
    usedBeforeExpiryBase: number;
    wastedBase: number;
    wastedValue: number;
    worthIt: boolean;
    /** Effective cost per used unit of the bulk pack, counting waste. */
    effectivePerBase: number;
  };
}

export type BulkError = 'mismatch' | 'usage-mismatch';

export function calculateBulk(input: BulkInput): BulkResult | { error: BulkError } {
  const ru = UNITS[input.regular.unit];
  const bu = UNITS[input.bulk.unit];
  if (ru.dimension !== bu.dimension) return { error: 'mismatch' };
  const regularBase = input.regular.quantity * ru.toBase;
  const bulkBase = input.bulk.quantity * bu.toBase;
  const regularPerBase = input.regular.price / regularBase;
  const bulkPerBase = input.bulk.price / bulkBase;
  const same = Math.abs(regularPerBase - bulkPerBase) <= 1e-9 * Math.max(regularPerBase, bulkPerBase);
  const cheaper = same ? 'same' : bulkPerBase < regularPerBase ? 'bulk' : 'regular';
  const regularCostForBulkAmount = roundMoney(regularPerBase * bulkBase);

  const result: BulkResult = {
    dimension: ru.dimension,
    regularPerBase,
    bulkPerBase,
    regularBase,
    bulkBase,
    cheaper,
    savingFraction: cheaper === 'same' ? 0 : cheaper === 'bulk' ? cheaperBy(bulkPerBase, regularPerBase) : cheaperBy(regularPerBase, bulkPerBase),
    regularCostForBulkAmount,
    bulkSaving: roundMoney(regularCostForBulkAmount - input.bulk.price),
    regularPacksEquivalent: bulkBase / regularBase,
  };

  if (cheaper === 'bulk') {
    result.breakEvenBase = input.bulk.price / regularPerBase;
    result.breakEvenFraction = result.breakEvenBase / bulkBase;
  }

  if (input.usage && input.shelfLife) {
    const uu = UNITS[input.usage.unit];
    if (uu.dimension !== ru.dimension) return { error: 'usage-mismatch' };
    const perDay = (input.usage.amount * uu.toBase) / PERIOD_DAYS[input.usage.per];
    const lifeDays = input.shelfLife.value * PERIOD_DAYS[input.shelfLife.per];
    const used = Math.min(bulkBase, perDay * lifeDays);
    const wasted = Math.max(0, bulkBase - used);
    result.usage = {
      daysToFinish: perDay > 0 ? bulkBase / perDay : Infinity,
      usedBeforeExpiryBase: used,
      wastedBase: wasted,
      wastedValue: roundMoney(wasted * bulkPerBase),
      worthIt: used > 0 && input.bulk.price / used < regularPerBase,
      effectivePerBase: used > 0 ? input.bulk.price / used : Infinity,
    };
  }
  return result;
}
