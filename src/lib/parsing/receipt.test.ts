import { describe, expect, it } from 'vitest';
import { findDate, groupRows, guessCategory, parseReceipt } from './receipt';

describe('groupRows', () => {
  it('joins boxes on the same line, left to right', () => {
    const rows = groupRows([
      { text: '62.00', x: 300, y: 101, w: 50, h: 18 },
      { text: 'Milk 1L', x: 10, y: 100, w: 80, h: 20 },
      { text: 'Bread', x: 10, y: 130, w: 60, h: 20 },
      { text: '45.00', x: 300, y: 132, w: 50, h: 18 },
    ]);
    expect(rows).toEqual(['Milk 1L  62.00', 'Bread  45.00']);
  });
});

describe('parseReceipt', () => {
  const receipt = [
    'FRESH MART SUPERMARKET',
    'GSTIN 27ABCDE1234F1Z5',
    'Bill No: 4521   Date: 18/10/2026',
    'Item  Qty  Rate  Amount',
    'AMUL MILK 1L  2  31.00  62.00',
    'BROWN BREAD  45.00',
    'Tata Salt 1kg  28.00',
    'Surf Excel 1.5kg  189.00',
    'Bananas 2 x 30.00  60.00',
    'Sub Total  384.00',
    'Discount  -20.00',
    'CGST 2.5%  4.55',
    'SGST 2.5%  4.55',
    'Grand Total  373.10',
    'Cash  400.00',
    'Change  26.90',
    'Thank you! Visit again',
  ];

  it('reads items, quantities, totals, tax and discount', () => {
    const r = parseReceipt(receipt);
    expect(r.store).toBe('Fresh Mart Supermarket');
    expect(r.date).toBe('2026-10-18');
    expect(r.items.map((i) => [i.name, i.amount, i.qty ?? null])).toEqual([
      ['Amul Milk 1l', 62, 2],
      ['Brown Bread', 45, null],
      ['Tata Salt 1kg', 28, null],
      ['Surf Excel 1.5kg', 189, null],
      ['Bananas', 60, 2],
    ]);
    expect(r.itemsSum).toBe(384);
    expect(r).toMatchObject({ subtotal: 384, total: 373.1, tax: 9.1, discount: 20 });
    expect(r.warnings).toEqual([]);
  });

  it('suggests categories', () => {
    const r = parseReceipt(receipt);
    expect(r.items.map((i) => i.category)).toEqual(['Dairy & eggs', 'Groceries', 'Groceries', 'Household', 'Fruit & veg']);
    expect(guessCategory('Unknown gadget')).toBe('Other');
  });

  it('warns when items don’t add up to the total', () => {
    const r = parseReceipt(['Shop', 'Apples  50.00', 'Total  150.00']);
    expect(r.warnings[0]).toMatch(/add up to 50\.00.*150\.00/);
  });

  it('accepts prices that already include tax', () => {
    const r = parseReceipt(['Cafe', 'Latte  180.00', 'Muffin  120.00', 'incl. GST  14.29', 'Total  300.00']);
    expect(r.total).toBe(300);
    expect(r.warnings).toEqual([]);
  });

  it('falls back to whole-number prices', () => {
    const r = parseReceipt(['Kirana Store', 'Rice  450', 'Oil  160', 'Total  610']);
    expect(r.items.map((i) => i.amount)).toEqual([450, 160]);
    expect(r.total).toBe(610);
  });

  it('returns a clear warning when nothing is readable', () => {
    const r = parseReceipt(['blurry', 'text']);
    expect(r.items).toEqual([]);
    expect(r.warnings[0]).toMatch(/No line items/);
  });

  it('reads common date formats', () => {
    expect(findDate('Date: 2026-03-05')).toBe('2026-03-05');
    expect(findDate('05/03/26 14:32')).toBe('2026-03-05');
    expect(findDate('5 Mar 2026')).toBe('2026-03-05');
    expect(findDate('Bill 31/31/2026')).toBeUndefined();
  });
});
