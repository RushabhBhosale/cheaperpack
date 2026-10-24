import { describe, expect, it } from 'vitest';
import { compareProducts, validateProduct, type ProductInput } from './compare';
import { currencyForLocale } from '../formatting/currency';
import { distinguishingDigits, explainSteps, formatMoney, formatPercent } from '../formatting/format';
import { parseDecimal, parseQuantity } from '../parsing/parse';
import { PER_UNITS, UNITS, convert } from './units';

const row = (price: string, quantity: string, unit: string, name = ''): ProductInput => ({ name, price, quantity, unit });

function ok(inputs: ProductInput[], perUnitId?: string) {
  const r = compareProducts(inputs, { perUnitId });
  if (r.status !== 'ok') throw new Error(`expected ok, got ${r.status}: ${'message' in r ? r.message : ''}`);
  return r;
}

describe('parseDecimal', () => {
  it.each([
    ['3.49', 3.49],
    ['3,49', 3.49],
    [' 12 ', 12],
    ['0.5', 0.5],
    ['.5', 0.5],
    [',5', 0.5],
    ['0,500', 0.5],
    ['1,299.00', 1299],
    ['1.299,00', 1299],
    ['1 299,50', 1299.5],
    ['1 299', 1299],
    ["1'299.95", 1299.95],
    ['1,000,000', 1000000],
    ['1.000.000', 1000000],
    ['12,50,000', 1250000],
    ['$3.49', 3.49],
    ['3,49 €', 3.49],
    ['+2', 2],
    ['5.', 5],
  ])('parses %j as %d', (input, expected) => {
    expect(parseDecimal(input)).toEqual({ ok: true, value: expected });
  });

  it('reads a single separator before three digits using the locale', () => {
    expect(parseDecimal('1,500', '.')).toEqual({ ok: true, value: 1500 });
    expect(parseDecimal('1,500', ',')).toEqual({ ok: true, value: 1.5 });
    expect(parseDecimal('1.500', '.')).toEqual({ ok: true, value: 1.5 });
    expect(parseDecimal('1.500', ',')).toEqual({ ok: true, value: 1500 });
    // Two decimals can't be grouping, whatever the locale.
    expect(parseDecimal('2,49', '.')).toEqual({ ok: true, value: 2.49 });
  });

  it.each(['', '   '])('reports %j as empty', (input) => {
    expect(parseDecimal(input)).toEqual({ ok: false, error: 'empty' });
  });

  it.each(['abc', '3.4.5,6', '1,2.3', '1e5', 'Infinity', 'NaN', '0x10', '3..4', '.', '$', '12,34,5', '--3', '3-'])(
    'rejects %j',
    (input) => {
      expect(parseDecimal(input)).toEqual({ ok: false, error: 'invalid' });
    },
  );

  it.each(['-1', '−2.50', '- 3'])('flags %j as negative', (input) => {
    expect(parseDecimal(input)).toEqual({ ok: false, error: 'negative' });
  });
});

describe('parseQuantity', () => {
  it('multiplies multipacks', () => {
    expect(parseQuantity('6 x 330')).toEqual({ ok: true, value: 1980, factors: [6, 330] });
    expect(parseQuantity('4×125')).toEqual({ ok: true, value: 500, factors: [4, 125] });
    expect(parseQuantity('2*6*0,5')).toEqual({ ok: true, value: 6, factors: [2, 6, 0.5] });
  });
  it('rejects malformed multipacks', () => {
    expect(parseQuantity('6 x')).toEqual({ ok: false, error: 'invalid' });
    expect(parseQuantity('x 6')).toEqual({ ok: false, error: 'invalid' });
    expect(parseQuantity('1x2x3x4')).toEqual({ ok: false, error: 'invalid' });
    expect(parseQuantity('-6 x 330')).toEqual({ ok: false, error: 'negative' });
  });
});

describe('unit conversion', () => {
  it('uses exact international definitions', () => {
    expect(convert(1, UNITS.lb, UNITS.g)).toBeCloseTo(453.59237, 10);
    expect(convert(16, UNITS.oz, UNITS.lb)).toBeCloseTo(1, 12);
    expect(convert(1, UNITS.kg, UNITS.lb)).toBeCloseTo(2.2046226218, 9);
    expect(convert(1, UNITS.gal_us, UNITS.floz_us)).toBeCloseTo(128, 10);
    expect(convert(1, UNITS.gal_us, UNITS.l)).toBeCloseTo(3.785411784, 12);
    expect(convert(1, UNITS.l, UNITS.cl)).toBe(100);
    expect(convert(1, UNITS.floz_uk, UNITS.ml)).toBeCloseTo(28.4130625, 10);
    expect(convert(250, UNITS.g, UNITS.kg)).toBe(0.25);
  });

  it('refuses to convert between weight, volume and count', () => {
    expect(() => convert(1, UNITS.kg, UNITS.l)).toThrow();
    expect(() => convert(1, UNITS.oz, UNITS.floz_us)).toThrow();
    expect(() => convert(1, UNITS.item, UNITS.g)).toThrow();
  });
});

describe('validateProduct', () => {
  const errorsFor = (price: string, quantity: string, unit = 'g') => validateProduct(row(price, quantity, unit), 0).errors;

  it('requires price and size once a row is started', () => {
    expect(errorsFor('', '500')).toEqual({ price: 'Enter the price.' });
    expect(errorsFor('3', '')).toEqual({ quantity: 'Enter the package size.' });
  });

  it('rejects zero, negative and non-numeric values', () => {
    expect(errorsFor('0', '500').price).toMatch(/more than zero/);
    expect(errorsFor('0.00', '500').price).toMatch(/more than zero/);
    expect(errorsFor('-1', '500').price).toMatch(/can’t be negative/);
    expect(errorsFor('abc', '500').price).toMatch(/as a number/);
    expect(errorsFor('3', '0').quantity).toMatch(/more than zero/);
    expect(errorsFor('3', '6 x 0').quantity).toMatch(/more than zero/);
    expect(errorsFor('3', '-500').quantity).toMatch(/can’t be negative/);
    expect(errorsFor('3', 'lots').quantity).toMatch(/as a number/);
    expect(errorsFor('1e13', '1').price).toMatch(/as a number/);
    expect(errorsFor('99999999999999', '1').price).toMatch(/too large/);
  });

  it('requires whole numbers of items', () => {
    expect(errorsFor('3', '2.5', 'item').quantity).toMatch(/whole numbers/);
    expect(errorsFor('3', '12', 'item')).toEqual({});
  });

  it('rejects unknown units', () => {
    expect(errorsFor('3', '1', 'stone').unit).toBe('Choose a unit.');
    expect(errorsFor('3', '1', '__proto__').unit).toBe('Choose a unit.');
  });

  it('treats a row with no price and no size as empty', () => {
    expect(validateProduct(row('', '', 'g', 'Brand X'), 2)).toMatchObject({ empty: true, label: 'Brand X', errors: {} });
  });

  it('labels unnamed products by letter', () => {
    expect(validateProduct(row('1', '1', 'g'), 3).label).toBe('Product D');
  });
});

describe('compareProducts', () => {
  it('compares grams with kilograms', () => {
    // 500 g for 1.29 -> 2.58/kg; 1 kg for 2.19 -> 2.19/kg
    const r = ok([row('1.29', '500', 'g'), row('2.19', '1', 'kg')]);
    expect(r.perUnit.id).toBe('kg');
    expect(r.products[0]!.unitPrice).toBeCloseTo(2.58, 10);
    expect(r.products[1]!.unitPrice).toBeCloseTo(2.19, 10);
    expect(r.best.map((p) => p.index)).toEqual([1]);
    expect(r.runnerUp?.index).toBe(0);
    expect(r.products[0]!.diffPerUnit).toBeCloseTo(0.39, 10);
    expect(r.products[0]!.diffFraction).toBeCloseTo(0.39 / 2.19, 10);
    // 500 g at 2.19/kg would cost 1.095, so the small pack costs 0.195 more.
    expect(r.products[0]!.extraForThisAmount).toBeCloseTo(0.195, 10);
    expect(r.products[1]!.extraForThisAmount).toBe(0);
  });

  it('compares pounds and ounces with metric weights', () => {
    // 1 lb for 4.00 vs 500 g for 4.00: 500 g is more than 1 lb (453.6 g).
    const r = ok([row('4', '1', 'lb'), row('4', '500', 'g')]);
    expect(r.best.map((p) => p.index)).toEqual([1]);
    expect(r.products[0]!.unitPrice).toBeCloseTo(4 / 0.45359237, 9);
    // 16 oz and 1 lb at the same price are the same deal.
    const tie = ok([row('3.99', '16', 'oz'), row('3.99', '1', 'lb')]);
    expect(tie.allTied).toBe(true);
    expect(tie.perUnit.id).toBe('oz');
  });

  it('compares volumes across metric and US units', () => {
    const r = ok([row('3.49', '1', 'gal_us'), row('1.99', '2', 'l'), row('1.10', '33', 'cl')], 'l');
    expect(r.products[0]!.unitPrice).toBeCloseTo(3.49 / 3.785411784, 10);
    expect(r.products[1]!.unitPrice).toBeCloseTo(0.995, 10);
    expect(r.products[2]!.unitPrice).toBeCloseTo(1.1 / 0.33, 10);
    expect(r.best.map((p) => p.index)).toEqual([0]);
    expect(r.ranked.map((p) => p.index)).toEqual([0, 1, 2]);
    expect(r.priciest?.index).toBe(2);
  });

  it('distinguishes US and UK fluid ounces', () => {
    const r = ok([row('1', '10', 'floz_us'), row('1', '10', 'floz_uk')]);
    expect(r.best.map((p) => p.index)).toEqual([0]); // US fl oz is larger
  });

  it('compares item counts and multipacks', () => {
    const r = ok([row('4.99', '12', 'item'), row('2.59', '6', 'item')]);
    expect(r.perUnit.id).toBe('item');
    expect(r.products[0]!.unitPrice).toBeCloseTo(4.99 / 12, 10);
    expect(r.best.map((p) => p.index)).toEqual([0]);

    const cans = ok([row('5.49', '6 x 330', 'ml'), row('1.89', '1.5', 'l')]);
    expect(cans.products[0]!.baseQuantity).toBe(1980);
    expect(cans.products[0]!.unitPrice).toBeCloseTo(5.49 / 1.98, 10);
  });

  it('never compares weight with volume or count', () => {
    const r = compareProducts([row('2', '1', 'kg'), row('2', '1', 'l'), row('2', '3', 'item')]);
    expect(r.status).toBe('mismatch');
    if (r.status !== 'mismatch') return;
    expect(r.groups.map((g) => g.dimension)).toEqual(['mass', 'volume', 'count']);
    expect(r.message).toMatch(/density/);
    // Weight ounces vs fluid ounces is a mismatch too.
    expect(compareProducts([row('2', '8', 'oz'), row('2', '8', 'floz_us')]).status).toBe('mismatch');
  });

  it('reports incomplete or invalid rows instead of a result', () => {
    expect(compareProducts([row('', '', 'g'), row('', '', 'g')])).toMatchObject({ status: 'incomplete', message: expect.stringMatching(/at least two/) });
    expect(compareProducts([row('2', '1', 'kg'), row('', '', 'g')])).toMatchObject({ status: 'incomplete', message: expect.stringMatching(/one more/) });
    const r = compareProducts([row('2', '1', 'kg'), row('0', '500', 'g')]);
    expect(r.status).toBe('incomplete');
    expect(r.validations[1]!.errors.price).toMatch(/more than zero/);
  });

  it('skips completely empty extra rows', () => {
    const r = ok([row('2', '1', 'kg'), row('', '', 'g', 'Not filled'), row('1.5', '500', 'g')]);
    expect(r.skipped).toEqual([1]);
    expect(r.products.map((p) => p.index)).toEqual([0, 2]);
  });

  it('handles ties among the cheapest', () => {
    const r = ok([row('2', '1', 'kg'), row('1', '500', 'g'), row('3', '1', 'kg')]);
    expect(r.allTied).toBe(false);
    expect(r.best.map((p) => p.index)).toEqual([0, 1]);
    expect(r.runnerUp?.index).toBe(2);
    // 0.1 + 0.2 style float noise must not break a tie.
    const noisy = ok([row('0.3', '3', 'g'), row('0.1', '1', 'g')]);
    expect(noisy.allTied).toBe(true);
  });

  it('compares four products', () => {
    const r = ok([row('1', '100', 'g'), row('8', '1', 'kg'), row('5', '1', 'lb'), row('0.5', '1', 'oz')], '100g');
    expect(r.perUnit.label).toBe('100 g');
    expect(r.products[0]!.unitPrice).toBeCloseTo(1, 10);
    expect(r.products[1]!.unitPrice).toBeCloseTo(0.8, 10);
    expect(r.best.map((p) => p.index)).toEqual([1]);
    expect(r.ranked).toHaveLength(4);
  });

  it('falls back to a fitting reference unit', () => {
    expect(ok([row('1', '1', 'kg'), row('1', '1', 'kg')], 'l').perUnit.id).toBe('kg');
    expect(ok([row('1', '1', 'l'), row('1', '1', 'l')], 'nonsense').perUnit.id).toBe('l');
    expect(ok([row('1', '12', 'floz_us'), row('1', '1', 'gal_us')]).perUnit.id).toBe('floz_us');
    expect(ok([row('1', '12', 'floz_us'), row('1', '1', 'l')]).perUnit.id).toBe('l');
  });

  it('offers every reference unit for its own dimension only', () => {
    for (const [dimension, list] of Object.entries(PER_UNITS)) {
      for (const p of list) expect(p.unit.dimension).toBe(dimension);
    }
  });
});

describe('formatting', () => {
  it('formats money for the currency', () => {
    expect(formatMoney(2.5, 'USD', 'en-US')).toBe('$2.50');
    expect(formatMoney(2.5, 'EUR', 'de-DE')).toBe('2,50 €');
    expect(formatMoney(329, 'JPY', 'ja-JP')).toBe('￥329');
  });

  it('keeps enough digits for small unit prices', () => {
    expect(formatMoney(0.0349, 'USD', 'en-US', true)).toBe('$0.0349');
    expect(formatMoney(4.6533, 'USD', 'en-US', true)).toBe('$4.65');
    expect(formatMoney(465.3, 'JPY', 'en-US', true)).toBe('¥465');
    expect(formatMoney(0.53, 'JPY', 'en-US', true)).toBe('¥0.53');
    expect(formatMoney(0.39, 'GBP', 'en-GB', true)).toBe('£0.39');
    expect(formatMoney(0.0004, 'USD', 'en-US', true)).toBe('$0.0004');
  });

  it('adds decimals only when different prices would look the same', () => {
    expect(distinguishingDigits([2.19, 2.58], 'USD', 'en-US')).toBe(0);
    expect(distinguishingDigits([2.191, 2.189], 'USD', 'en-US')).toBe(1);
    expect(formatMoney(2.191, 'USD', 'en-US', true, 1)).toBe('$2.191');
    expect(formatMoney(2.19, 'USD', 'en-US', true, 1)).toBe('$2.19');
    // Exact ties never need extra digits.
    expect(distinguishingDigits([0.3 / 3, 0.1], 'USD', 'en-US')).toBe(0);
  });

  it('formats percentages', () => {
    expect(formatPercent(0.25, 'en')).toBe('25%');
    expect(formatPercent(0.0512, 'en')).toBe('5.1%');
    expect(formatPercent(0.00001, 'en')).toBe('<0.1%');
  });

  it('explains the arithmetic step by step', () => {
    const r = ok([row('5.99', '1.5', 'lb'), row('3.49', '750', 'g')]);
    expect(explainSteps(r.products[0]!, r.perUnit, 'USD', 'en-US')).toEqual([
      '1.5 lb = 0.6804 kg (1 lb = 0.4536 kg)',
      '$5.99 ÷ 0.6804 kg = $8.80 per kg',
    ]);
    const per100 = ok([row('3.49', '750', 'g'), row('1', '100', 'g')], '100g');
    expect(explainSteps(per100.products[0]!, per100.perUnit, 'USD', 'en-US')).toEqual(['$3.49 ÷ 750 g × 100 = $0.47 per 100 g']);
    const cans = ok([row('5.49', '6 x 330', 'ml'), row('1.89', '1.5', 'l')]);
    expect(explainSteps(cans.products[0]!, cans.perUnit, 'USD', 'en-US')).toEqual([
      '6 × 330 ml = 1,980 ml',
      '1,980 ml = 1.98 L (1 ml = 0.001 L)',
      '$5.49 ÷ 1.98 L = $2.77 per L',
    ]);
  });
});

describe('currencyForLocale', () => {
  it.each([
    ['en-US', 'USD'],
    ['en-GB', 'GBP'],
    ['de-DE', 'EUR'],
    ['de', 'EUR'],
    ['ja', 'JPY'],
    ['pt-BR', 'BRL'],
    ['hi-IN', 'INR'],
    ['xx-QQ', 'USD'],
    [undefined, 'USD'],
  ])('%s -> %s', (locale, currency) => {
    expect(currencyForLocale(locale)).toBe(currency);
  });
});
