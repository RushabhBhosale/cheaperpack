/**
 * Buy X get Y offers (free or at a discount), optionally for a specific number
 * of items and a per-order limit, compared with a plain percentage discount.
 */

import { cheaperBy, roundMoney } from './money';

export interface BogoInput {
  price: number;
  buy: number;
  get: number;
  /** Discount on the "get" items: 100 means free. */
  getDiscountPct: number;
  /** Items the shopper actually wants. */
  wanted?: number;
  /** Most times the offer can be used in one order. */
  maxSets?: number;
  /** A regular discount to compare against, in percent. */
  comparePct?: number;
}

export interface BogoBreakdown {
  items: number;
  paid: number;
  perItem: number;
  /** Saving as a fraction of full price for the same items. */
  saving: number;
  savingFraction: number;
  sets: number;
  fullPriceItems: number;
}

export interface BogoResult {
  /** One round of the offer: buy X, get Y. */
  set: BogoBreakdown;
  /** For the number of items wanted, when given. */
  wanted?: BogoBreakdown & {
    /** Items paid at full price beyond complete offer sets. */
    leftover: number;
    /** Extra items that would come free (or discounted) by adding them, when the leftover already covers a "buy". */
    missedFree: number;
    limitedBySets: boolean;
  };
  compare?: {
    pct: number;
    perItem: number;
    better: 'offer' | 'discount' | 'same';
    /** Difference per item between the two. */
    difference: number;
  };
}

function breakdown(price: number, items: number, paid: number, sets: number, fullPriceItems: number): BogoBreakdown {
  const full = roundMoney(price * items);
  const saving = roundMoney(full - paid);
  return { items, paid, perItem: items > 0 ? paid / items : 0, saving, savingFraction: full > 0 ? saving / full : 0, sets, fullPriceItems };
}

export function calculateBogo(input: BogoInput): BogoResult {
  const { price, buy, get } = input;
  const getPrice = roundMoney(price * (1 - input.getDiscountPct / 100));
  const setItems = buy + get;
  const setPaid = roundMoney(buy * price + get * getPrice);
  const result: BogoResult = { set: breakdown(price, setItems, setPaid, 1, 0) };

  if (input.wanted !== undefined) {
    let sets = Math.floor(input.wanted / setItems);
    const limitedBySets = input.maxSets !== undefined && sets > input.maxSets;
    if (limitedBySets) sets = input.maxSets!;
    const leftover = input.wanted - sets * setItems;
    const paid = roundMoney(sets * setPaid + leftover * price);
    // Paying full price for at least X leftover items already qualifies for another round.
    const canStillUse = input.maxSets === undefined || sets < input.maxSets;
    const missedFree = canStillUse && leftover >= buy ? get : 0;
    result.wanted = { ...breakdown(price, input.wanted, paid, sets, leftover), leftover, missedFree, limitedBySets };
  }

  if (input.comparePct !== undefined) {
    const perItem = roundMoney(price * (1 - input.comparePct / 100));
    const offer = result.wanted?.perItem ?? result.set.perItem;
    const diff = Math.abs(offer - perItem);
    result.compare = {
      pct: input.comparePct,
      perItem,
      better: diff < 0.005 ? 'same' : offer < perItem ? 'offer' : 'discount',
      difference: diff,
    };
  }
  return result;
}

/** The plain percentage discount that a buy X get Y offer is equivalent to. */
export function equivalentDiscount(buy: number, get: number, getDiscountPct = 100): number {
  return cheaperBy(buy + get * (1 - getDiscountPct / 100), buy + get);
}
