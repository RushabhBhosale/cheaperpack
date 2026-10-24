import { describe, expect, it } from 'vitest';
import { calculateBogo, equivalentDiscount } from './bogo';

describe('calculateBogo', () => {
  it.each([
    [1, 1, 2, 100, 0.5],
    [2, 1, 3, 200, 1 / 3],
    [3, 2, 5, 300, 0.4],
  ])('buy %i get %i free', (buy, get, items, paid, saving) => {
    const r = calculateBogo({ price: 100, buy, get, getDiscountPct: 100 });
    expect(r.set.items).toBe(items);
    expect(r.set.paid).toBe(paid);
    expect(r.set.savingFraction).toBeCloseTo(saving, 10);
    expect(r.set.perItem).toBeCloseTo(paid / items, 10);
  });

  it('handles buy X get Y at a discount', () => {
    const r = calculateBogo({ price: 200, buy: 1, get: 1, getDiscountPct: 50 });
    expect(r.set).toMatchObject({ items: 2, paid: 300, perItem: 150 });
    expect(r.set.savingFraction).toBeCloseTo(0.25, 10);
  });

  it('works out a wanted quantity, with leftovers at full price', () => {
    const r = calculateBogo({ price: 100, buy: 2, get: 1, getDiscountPct: 100, wanted: 7 });
    // Two full sets (6 items for 400) + 1 at full price.
    expect(r.wanted).toMatchObject({ sets: 2, leftover: 1, paid: 500, items: 7, missedFree: 0 });
    const tip = calculateBogo({ price: 100, buy: 1, get: 1, getDiscountPct: 100, wanted: 3 });
    expect(tip.wanted).toMatchObject({ sets: 1, leftover: 1, paid: 200, missedFree: 1 });
  });

  it('respects a per-order limit', () => {
    const r = calculateBogo({ price: 100, buy: 1, get: 1, getDiscountPct: 100, wanted: 6, maxSets: 2 });
    expect(r.wanted).toMatchObject({ sets: 2, leftover: 2, paid: 400, limitedBySets: true, missedFree: 0 });
  });

  it('compares with a regular discount', () => {
    const r = calculateBogo({ price: 100, buy: 2, get: 1, getDiscountPct: 100, comparePct: 40 });
    expect(r.compare).toMatchObject({ perItem: 60, better: 'discount' });
    expect(calculateBogo({ price: 100, buy: 1, get: 1, getDiscountPct: 100, comparePct: 50 }).compare?.better).toBe('same');
  });

  it('converts an offer to an equivalent discount', () => {
    expect(equivalentDiscount(1, 1)).toBe(0.5);
    expect(equivalentDiscount(2, 1)).toBeCloseTo(1 / 3, 10);
    expect(equivalentDiscount(1, 1, 50)).toBe(0.25);
  });
});
