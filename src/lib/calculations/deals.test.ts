import { describe, expect, it } from 'vitest';
import { calculateDeal, compareDeals, type DealInput } from './deals';

const deal = (over: Partial<DealInput>): DealInput => ({ price: 100, quantity: 1, discounts: [], stacking: 'sequential', delivery: 0, ...over });

describe('calculateDeal', () => {
  it('applies a percentage discount', () => {
    const r = calculateDeal(deal({ price: 999, discounts: [{ kind: 'percent', value: 20 }] }));
    expect(r).toMatchObject({ subtotal: 999, discountTotal: 199.8, checkout: 799.2, effective: 799.2 });
  });

  it('adds delivery after discounts', () => {
    const r = calculateDeal(deal({ price: 799, delivery: 50 }));
    expect(r).toMatchObject({ checkout: 849, effective: 849 });
  });

  it('stacks discounts one after another or on the original price', () => {
    const two = [
      { kind: 'percent' as const, value: 10 },
      { kind: 'percent' as const, value: 10 },
    ];
    expect(calculateDeal(deal({ price: 1000, discounts: two, stacking: 'sequential' })).checkout).toBe(810);
    expect(calculateDeal(deal({ price: 1000, discounts: two, stacking: 'original' })).checkout).toBe(800);
    // Percentage then a flat coupon.
    const mixed = calculateDeal(deal({ price: 1000, discounts: [{ kind: 'percent', value: 20 }, { kind: 'fixed', value: 150 }] }));
    expect(mixed.discountSteps.map((s) => s.amount)).toEqual([200, 150]);
    expect(mixed.checkout).toBe(650);
  });

  it('caps percentage discounts and never goes below zero', () => {
    expect(calculateDeal(deal({ price: 2000, discounts: [{ kind: 'percent', value: 20, cap: 100 }] })).checkout).toBe(1900);
    expect(calculateDeal(deal({ price: 100, discounts: [{ kind: 'fixed', value: 500 }] })).checkout).toBe(0);
    expect(calculateDeal(deal({ price: 100, discounts: [{ kind: 'fixed', value: 80 }, { kind: 'fixed', value: 80 }], stacking: 'original' })).checkout).toBe(0);
  });

  it('separates checkout from cashback received later', () => {
    const r = calculateDeal(deal({ price: 2000, delivery: 40, cashback: { kind: 'percent', value: 10, cap: 150 } }));
    expect(r).toMatchObject({ checkout: 2040, cashback: 150, effective: 1890 });
    const flat = calculateDeal(deal({ price: 500, cashback: { kind: 'fixed', value: 75 } }));
    expect(flat).toMatchObject({ checkout: 500, cashback: 75, effective: 425 });
    // Cashback is calculated on the order after discounts, not on delivery.
    const onOrder = calculateDeal(deal({ price: 1000, delivery: 100, discounts: [{ kind: 'percent', value: 50 }], cashback: { kind: 'percent', value: 10 } }));
    expect(onOrder.cashback).toBe(50);
  });

  it('handles buy X get Y', () => {
    const r = calculateDeal(deal({ price: 100, quantity: 2, buyGet: { buy: 1, get: 1 } }));
    expect(r).toMatchObject({ itemsPaid: 2, itemsReceived: 4, checkout: 200, effectivePerItem: 50, fullValue: 400, saving: 200 });
    expect(calculateDeal(deal({ price: 100, quantity: 2, buyGet: { buy: 3, get: 1 } })).itemsReceived).toBe(2);
  });

  it('rounds each step to whole cents', () => {
    const r = calculateDeal(deal({ price: 19.99, quantity: 3, discounts: [{ kind: 'percent', value: 15 }] }));
    expect(r.subtotal).toBe(59.97);
    expect(r.discountTotal).toBe(9); // 8.9955 rounds to 9.00
    expect(r.checkout).toBe(50.97);
  });
});

describe('compareDeals', () => {
  it('picks the lowest effective cost (example from the brief)', () => {
    const c = compareDeals([deal({ price: 999, discounts: [{ kind: 'percent', value: 20 }] }), deal({ price: 799, delivery: 50 })]);
    expect(c.best).toEqual([0]);
    expect(c.runnerUp).toBe(1);
    expect(c.difference).toBe(49.8);
    expect(c.perItem).toBe(false);
  });

  it('compares per item when deals give different quantities', () => {
    const c = compareDeals([deal({ price: 100, quantity: 1, buyGet: { buy: 1, get: 1 } }), deal({ price: 100, discounts: [{ kind: 'percent', value: 40 }] })]);
    expect(c.perItem).toBe(true);
    expect(c.best).toEqual([0]); // 50 per item vs 60
    expect(c.difference).toBeCloseTo(10, 10);
  });

  it('reports ties', () => {
    const c = compareDeals([deal({ price: 100, discounts: [{ kind: 'fixed', value: 20 }] }), deal({ price: 100, discounts: [{ kind: 'percent', value: 20 }] })]);
    expect(c.best).toEqual([0, 1]);
    expect(c.runnerUp).toBeUndefined();
  });
});
