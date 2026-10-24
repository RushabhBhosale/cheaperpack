import { describe, expect, it } from 'vitest';
import { lineTotal, listToCsv, listToText, parseBudgetEntry, summariseBudget, type BudgetItem } from './budget';
import { compareCostPerUse, costPerUse } from './cost-per-use';
import { applianceUse, electricityTotals } from './electricity';
import { cheaperBy, roundMoney, sumMoney } from './money';
import { compareAnnualPlan, monthlyCost, nextRenewal, summarise, yearlyCost } from './subscriptions';
import { checkNumber } from './validate';

describe('money', () => {
  it('rounds half up without float artefacts', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(roundMoney(-1.005)).toBe(-1.01);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
  });
  it('computes percentages safely', () => {
    expect(cheaperBy(64, 72)).toBeCloseTo(0.1111, 4); // 11.1%
    expect(cheaperBy(5, 0)).toBe(0);
  });
});

describe('checkNumber', () => {
  it('validates required, zero, negative and invalid values', () => {
    expect(checkNumber('', { label: 'a price' })).toEqual({ ok: false, error: 'Enter a price.' });
    expect(checkNumber('', { optional: true })).toEqual({ ok: true, value: undefined });
    expect(checkNumber('0', { above: 0 })).toEqual({ ok: false, error: 'Must be more than 0.' });
    expect(checkNumber('0', { min: 0 })).toEqual({ ok: true, value: 0 });
    expect(checkNumber('-5', { min: 0 })).toEqual({ ok: false, error: 'This can’t be negative.' });
    expect(checkNumber('abc')).toEqual({ ok: false, error: 'Enter a number, like 120 or 2.5.' });
    expect(checkNumber('2.5', { integer: true })).toEqual({ ok: false, error: 'Use a whole number.' });
    expect(checkNumber('25', { max: 24 })).toEqual({ ok: false, error: 'Must be 24 or less.' });
    expect(checkNumber('1,299.50')).toEqual({ ok: true, value: 1299.5 });
    expect(checkNumber('12,5', {}, ',')).toEqual({ ok: true, value: 12.5 });
  });
});

describe('cost per use', () => {
  it('compares shoes (example from the brief)', () => {
    const c = compareCostPerUse([
      { price: 2000, uses: 100, maintenance: 0, resale: 0 },
      { price: 5000, uses: 400, maintenance: 0, resale: 0 },
    ]);
    expect(c.results.map((r) => r.perUse)).toEqual([20, 12.5]);
    expect(c.best).toEqual([1]);
    expect(c.cheaperBy).toBeCloseTo(0.375, 10);
  });
  it('includes upkeep and resale', () => {
    expect(costPerUse({ price: 50000, uses: 500, maintenance: 5000, resale: 15000 })).toEqual({ total: 40000, perUse: 80 });
    expect(costPerUse({ price: 100, uses: 0, maintenance: 0, resale: 0 }).perUse).toBe(Infinity);
  });
});

describe('electricity', () => {
  it('estimates monthly and yearly use and cost', () => {
    const r = applianceUse({ watts: 1000, hoursPerDay: 2, daysPerMonth: 30, standbyWatts: 0, quantity: 1 }, 8);
    expect(r.kwhPerMonth).toBe(60);
    expect(r.costPerMonth).toBe(480);
    expect(r.kwhPerYear).toBe(720);
    expect(r.costPerYear).toBe(5760);
    expect(r.kwhPerUseDay).toBe(2);
  });
  it('adds standby power for the hours not in use', () => {
    const r = applianceUse({ watts: 100, hoursPerDay: 2, daysPerMonth: 30, standbyWatts: 2, quantity: 1 }, 10);
    expect(r.standbyKwhPerMonth).toBeCloseTo(1.32, 10); // 2 W × 660 h
    expect(r.kwhPerMonth).toBeCloseTo(7.32, 10);
  });
  it('totals several appliances and multiplies by quantity', () => {
    const t = electricityTotals(
      [
        { watts: 75, hoursPerDay: 10, daysPerMonth: 30, standbyWatts: 0, quantity: 3 },
        { watts: 9, hoursPerDay: 6, daysPerMonth: 30, standbyWatts: 0, quantity: 5 },
      ],
      7.5,
    );
    expect(t.kwhPerMonth).toBeCloseTo(67.5 + 8.1, 10);
    expect(t.costPerMonth).toBe(567);
    expect(t.shares[0]).toBeCloseTo(67.5 / 75.6, 10);
  });
  it('handles zero use', () => {
    expect(electricityTotals([{ watts: 100, hoursPerDay: 0, daysPerMonth: 0, standbyWatts: 0, quantity: 1 }], 8).costPerMonth).toBe(0);
  });
});

describe('subscriptions', () => {
  const subs = [
    { id: 'a', name: 'Video', amount: 649, cycle: 'monthly' as const, category: 'Entertainment' },
    { id: 'b', name: 'Music', amount: 1189, cycle: 'yearly' as const, category: 'Entertainment', cancel: true },
    { id: 'c', name: 'Cloud', amount: 390, cycle: 'quarterly' as const },
  ];
  it('converts cycles to monthly and yearly costs', () => {
    expect(monthlyCost(subs[0]!)).toBe(649);
    expect(monthlyCost(subs[1]!)).toBeCloseTo(99.083, 3);
    expect(monthlyCost(subs[2]!)).toBe(130);
    expect(yearlyCost({ amount: 100, cycle: 'weekly' })).toBeCloseTo(5200, 6);
  });
  it('summarises and ranks', () => {
    const s = summarise(subs);
    expect(s.monthly).toBe(878.08);
    expect(s.yearly).toBe(10537); // 649×12 + 1189 + 390×4
    expect(s.ranked.map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(s.cancelYearly).toBe(1189);
    expect(s.byCategory[0]).toMatchObject({ category: 'Entertainment' });
    expect(summarise([]).monthly).toBe(0);
  });
  it('rolls renewal dates forward', () => {
    const today = new Date(2026, 9, 18);
    expect(nextRenewal('2026-01-31', 'monthly', today)?.toDateString()).toBe(new Date(2026, 9, 31).toDateString());
    expect(nextRenewal('2025-03-01', 'yearly', today)?.toDateString()).toBe(new Date(2027, 2, 1).toDateString());
    expect(nextRenewal('2026-10-20', 'monthly', today)?.toDateString()).toBe(new Date(2026, 9, 20).toDateString());
    expect(nextRenewal('nonsense', 'monthly', today)).toBeNull();
  });
  it('compares annual with monthly plans', () => {
    const p = compareAnnualPlan(199, 1499);
    expect(p).toMatchObject({ monthlyForYear: 2388, saving: 889 });
    expect(p.savingFraction).toBeCloseTo(0.3723, 3);
    expect(p.breakEvenMonths).toBeCloseTo(7.53, 2);
  });
});

describe('budget', () => {
  const items: BudgetItem[] = [
    { id: '1', name: 'Rice 5 kg', qty: 1, price: 450, purchased: true },
    { id: '2', name: 'Milk', qty: 4, price: 32, purchased: false },
  ];
  it('totals and compares with the budget (example from the brief)', () => {
    const s = summariseBudget(3000, [...items, { id: '3', name: 'Other', qty: 1, price: 1872, purchased: false }]);
    expect(s).toMatchObject({ total: 2450, left: 550, over: false, purchasedTotal: 450, remainingToBuy: 2000 });
    expect(summariseBudget(500, items)).toMatchObject({ total: 578, left: -78, over: true });
    expect(lineTotal({ qty: 3, price: 33.33 })).toBe(99.99);
  });
  it('exports text and CSV', () => {
    const text = listToText('Weekly shop', items, (v) => `₹${v}`, 1000);
    expect(text).toContain('✓ Rice 5 kg — ₹450');
    expect(text).toContain('• Milk × 4 — ₹128');
    expect(text).toContain('Left: ₹422');
    expect(listToCsv(items).split('\n')[1]).toBe('"Rice 5 kg","1","450","450","yes"');
  });
});

describe('parseBudgetEntry', () => {
  it.each([
    ['Milk 2 x 32', { name: 'Milk', qty: 2, price: 32 }],
    ['Bread 45 x2', { name: 'Bread', qty: 2, price: 45 }],
    ['Rice 5kg 450', { name: 'Rice 5kg', qty: 1, price: 450 }],
    ['Apples ₹120', { name: 'Apples', qty: 1, price: 120 }],
    ['Butter 52.50', { name: 'Butter', qty: 1, price: 52.5 }],
    ['Oil', { name: 'Oil', qty: 1 }],
    ['Rice 5kg', { name: 'Rice 5kg', qty: 1 }],
  ])('%j', (text, expected) => {
    expect(parseBudgetEntry(text)).toEqual(expected);
  });
});
