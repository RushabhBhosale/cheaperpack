import { describe, expect, it } from 'vitest';
import { calculateBulk, type BulkResult } from './bulk';

const ok = (r: ReturnType<typeof calculateBulk>) => {
  if ('error' in r) throw new Error(r.error);
  return r as BulkResult;
};

describe('calculateBulk', () => {
  it('compares 500 g for 120 with 2 kg for 400 (example from the brief)', () => {
    const r = ok(calculateBulk({ regular: { price: 120, quantity: 500, unit: 'g' }, bulk: { price: 400, quantity: 2, unit: 'kg' } }));
    expect(r.cheaper).toBe('bulk');
    expect(r.regularPerBase).toBeCloseTo(0.24, 10);
    expect(r.bulkPerBase).toBeCloseTo(0.2, 10);
    expect(r.savingFraction).toBeCloseTo(1 / 6, 10); // 16.7%
    expect(r.regularCostForBulkAmount).toBe(480);
    expect(r.bulkSaving).toBe(80);
    expect(r.regularPacksEquivalent).toBe(4);
    expect(r.breakEvenBase).toBeCloseTo(1666.667, 2);
    expect(r.breakEvenFraction).toBeCloseTo(0.8333, 3);
  });

  it('warns about waste when usage before expiry is too low', () => {
    const r = ok(
      calculateBulk({
        regular: { price: 120, quantity: 500, unit: 'g' },
        bulk: { price: 400, quantity: 2, unit: 'kg' },
        usage: { amount: 200, unit: 'g', per: 'week' },
        shelfLife: { value: 6, per: 'week' },
      }),
    );
    expect(r.usage!.usedBeforeExpiryBase).toBeCloseTo(1200, 6);
    expect(r.usage!.wastedBase).toBeCloseTo(800, 6);
    expect(r.usage!.worthIt).toBe(false); // 1.2 kg used < 1.67 kg break-even
    expect(r.usage!.wastedValue).toBe(160);
  });

  it('finds it worth it when enough is used', () => {
    const r = ok(
      calculateBulk({
        regular: { price: 120, quantity: 500, unit: 'g' },
        bulk: { price: 400, quantity: 2, unit: 'kg' },
        usage: { amount: 1, unit: 'kg', per: 'month' },
        shelfLife: { value: 3, per: 'month' },
      }),
    );
    expect(r.usage!.wastedBase).toBe(0);
    expect(r.usage!.worthIt).toBe(true);
  });

  it('says when the regular pack is cheaper or equal', () => {
    expect(ok(calculateBulk({ regular: { price: 50, quantity: 1, unit: 'l' }, bulk: { price: 260, quantity: 5, unit: 'l' } })).cheaper).toBe('regular');
    const same = ok(calculateBulk({ regular: { price: 10, quantity: 1, unit: 'item' }, bulk: { price: 60, quantity: 6, unit: 'item' } }));
    expect(same.cheaper).toBe('same');
    expect(same.breakEvenBase).toBeUndefined();
  });

  it('refuses incompatible units', () => {
    expect(calculateBulk({ regular: { price: 1, quantity: 1, unit: 'kg' }, bulk: { price: 1, quantity: 1, unit: 'l' } })).toEqual({ error: 'mismatch' });
    expect(
      calculateBulk({
        regular: { price: 1, quantity: 1, unit: 'kg' },
        bulk: { price: 3, quantity: 5, unit: 'kg' },
        usage: { amount: 1, unit: 'ml', per: 'day' },
        shelfLife: { value: 1, per: 'month' },
      }),
    ).toEqual({ error: 'usage-mismatch' });
  });
});
