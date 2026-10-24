import { describe, expect, it } from 'vitest';
import { fixOcrDigits, parsePriceTag, parseShoppingText, type SmartProduct } from './smart-parse';

const brief = (products: SmartProduct[]) => products.map((p) => [p.name, p.price, p.quantity, p.unit]);
const read = (text: string) => brief(parseShoppingText(text).products);

describe('parseShoppingText: typed or pasted text', () => {
  it.each<[string, unknown[][]]>([
    ['2kg powder for 210 and 1.5kg for 189', [['powder', 210, 2, 'kg'], ['', 189, 1.5, 'kg']]],
    ['2kg for 210, 1.5kg for 189', [['', 210, 2, 'kg'], ['', 189, 1.5, 'kg']]],
    ['powder 2 kg 210 rs, 1.5 kg 189 rs', [['powder', 210, 2, 'kg'], ['', 189, 1.5, 'kg']]],
    ['210 for 2kg vs 189 for 1.5kg', [['', 210, 2, 'kg'], ['', 189, 1.5, 'kg']]],
    ['Rs 210 - 2kg | Rs 189 - 1.5kg', [['', 210, 2, 'kg'], ['', 189, 1.5, 'kg']]],
    ['2kg=210 1.5kg=189', [['', 210, 2, 'kg'], ['', 189, 1.5, 'kg']]],
    ['atta 5kg 245 10kg 470', [['atta', 245, 5, 'kg'], ['', 470, 10, 'kg']]],
    ['2 kg and 1.5 kg cost 210 and 189', [['', 210, 2, 'kg'], ['', 189, 1.5, 'kg']]],
    ['milk 500ml 28 / 1L 54', [['milk', 28, 500, 'ml'], ['', 54, 1, 'l']]],
    ['₹180 for 250 ml\n₹320 for 500 ml', [['', 180, 250, 'ml'], ['', 320, 500, 'ml']]],
    ['Surf Excel 1kg ₹120 vs 500g ₹65', [['Surf Excel', 120, 1, 'kg'], ['', 65, 500, 'g']]],
    ['1.5 kg for 189 and 2kg powder for 210', [['', 189, 1.5, 'kg'], ['powder', 210, 2, 'kg']]],
    ['Rs.210/- 2 kg', [['', 210, 2, 'kg']]],
    ['6 eggs for 42, 1 dozen for 80', [['', 42, 6, 'item'], ['', 80, 12, 'item']]],
    ['pack of 6 for 90 and 12 pcs for 170', [['', 90, 6, 'item'], ['', 170, 12, 'item']]],
    ['1/2 kg 60 and 1 kg 110', [['', 60, 0.5, 'kg'], ['', 110, 1, 'kg']]],
    ['salt and pepper 100g for 50', [['salt and pepper', 50, 100, 'g']]],
    ['Tata Salt 1 kg - ₹28, Tata Salt 5 kg - ₹120', [['Tata Salt', 28, 1, 'kg'], ['Tata Salt', 120, 5, 'kg']]],
    ['oil 1 litre 160 or 5 ltr 760', [['oil', 160, 1, 'l'], ['', 760, 5, 'l']]],
    ['250gm 60rs 1kg 220rs', [['', 60, 250, 'g'], ['', 220, 1, 'kg']]],
    ['1,5 kg for 189', [['', 189, 1.5, 'kg']]],
    ['Rs. 1,299 for 5 kg', [['', 1299, 5, 'kg']]],
    ['which is cheaper 2kg powder 210rs or 1.5 kg 189rs', [['powder', 210, 2, 'kg'], ['', 189, 1.5, 'kg']]],
    ['Detergent: 1kg-₹120; 2 kg - ₹230; 500g - ₹65', [['Detergent', 120, 1, 'kg'], ['', 230, 2, 'kg'], ['', 65, 500, 'g']]],
    ['4 rolls 120 / 10 rolls 280', [['', 120, 4, 'item'], ['', 280, 10, 'item']]],
    ['Rs210 2kg\nRs189 1.5kg', [['', 210, 2, 'kg'], ['', 189, 1.5, 'kg']]],
    ['i saw 2 kg pack at 210 and the 1.5 kg one at 189', [['', 210, 2, 'kg'], ['', 189, 1.5, 'kg']]],
    ['BIG PACK 5KG RS 450 SMALL PACK 1KG RS 99', [['BIG PACK', 450, 5, 'kg'], ['SMALL PACK', 99, 1, 'kg']]],
  ])('%j', (text, expected) => {
    expect(read(text)).toEqual(expected);
  });

  it('reads multipacks', () => {
    const [cans, bottle] = parseShoppingText('6 x 330ml for 240, 1.25L for 90').products;
    expect(cans).toMatchObject({ price: 240, quantity: 1980, unit: 'ml', factors: [6, 330] });
    expect(bottle).toMatchObject({ price: 90, quantity: 1.25, unit: 'l' });
    expect(parseShoppingText('2 packs of 500g for 99').products[0]).toMatchObject({ quantity: 1000, unit: 'g', factors: [2, 500] });
    expect(parseShoppingText('330 ml x 6 @ 240').products[0]).toMatchObject({ price: 240, quantity: 1980, factors: [6, 330] });
  });

  it('reads multi-buy offers', () => {
    expect(parseShoppingText('200g 2 for 100').products[0]).toMatchObject({ price: 100, quantity: 400, unit: 'g', factors: [2, 200] });
    expect(parseShoppingText('3 for 99').products[0]).toMatchObject({ price: 99, quantity: 3, unit: 'item' });
  });

  it('prefers the offer price over the MRP', () => {
    const r = parseShoppingText('1kg MRP 250 offer 199, 500g MRP 140 offer 110');
    expect(brief(r.products)).toEqual([['', 199, 1, 'kg'], ['', 110, 500, 'g']]);
    expect(r.products[0]!.otherPrices).toEqual([{ value: 250, kind: 'mrp' }]);
  });

  it('ignores unit prices, discounts and percentages', () => {
    expect(read('500 g ₹64 (₹12.80/100 g)')).toEqual([['', 64, 500, 'g']]);
    expect(read('5 kg atta ₹245 save ₹30')).toEqual([['atta', 245, 5, 'kg']]);
    expect(read('1 kg ₹110 20% off')).toEqual([['', 110, 1, 'kg']]);
    expect(read('2 kg ₹180 (₹90 per kg)')).toEqual([['', 180, 2, 'kg']]);
  });

  it('detects the currency from symbols', () => {
    expect(parseShoppingText('₹180 for 250 ml').currency).toBe('INR');
    expect(parseShoppingText('Rs 50 for 1 kg').currency).toBe('INR');
    expect(parseShoppingText('$3.49 for 500 g').currency).toBe('USD');
    expect(parseShoppingText('2,49 € for 1 l').currency).toBe('EUR');
    expect(parseShoppingText('£1.20 for 4 pcs').currency).toBe('GBP');
    expect(parseShoppingText('2kg 210').currency).toBeUndefined();
  });

  it('keeps sizes without prices so the shopper can fill them in', () => {
    expect(read('2 kg and 1.5 kg')).toEqual([['', undefined, 2, 'kg'], ['', undefined, 1.5, 'kg']]);
  });

  it('reads US units, keeping weight ounces and fluid ounces apart', () => {
    expect(read('1 lb for 4')).toEqual([['', 4, 1, 'lb']]);
    expect(read('$3.49 for 16 oz, $5.99 for 2 lbs')).toEqual([['', 3.49, 16, 'oz'], ['', 5.99, 2, 'lb']]);
    expect(read('12 fl oz 1.99 vs 64 fl. oz 6.49')).toEqual([['', 1.99, 12, 'floz_us'], ['', 6.49, 64, 'floz_us']]);
    expect(read('1 gallon 3.49, 33 cl 1.10')).toEqual([['', 3.49, 1, 'gal_us'], ['', 1.1, 33, 'cl']]);
  });

  it('returns nothing for text without prices or sizes', () => {
    expect(read('')).toEqual([]);
    expect(read('which one is cheaper?')).toEqual([]);
    expect(read('in 2025')).toEqual([]);
  });
});

describe('parsePriceTag: OCR lines', () => {
  const tag = (...lines: string[]) => parsePriceTag(lines.map((text) => ({ text, score: 0.95 })));

  it('reads a typical Indian pack label', () => {
    const r = tag('TATA SALT', 'Vacuum Evaporated Iodised Salt', 'Net Qty: 1 kg', 'MRP ₹28.00', '(Incl. of all taxes)', 'Mfg: 08/2026  Batch No. B2241');
    expect(r.product).toMatchObject({ name: 'Tata Salt', price: 28, quantity: 1, unit: 'kg' });
    expect(r.currency).toBe('INR');
  });

  it('prefers the selling price to the MRP and lists the MRP as an option', () => {
    const r = tag('Aashirvaad Atta', '5 kg', 'MRP Rs. 289', 'Offer Price Rs. 245', 'You save Rs. 44');
    expect(r.product.price).toBe(245);
    expect(r.priceOptions.map((o) => o.value)).toEqual([245, 289]);
  });

  it('takes the lower of two unlabelled prices (the higher is usually struck out)', () => {
    expect(tag('Fortune Sunflower Oil 1 L', '₹185', '₹159').product.price).toBe(159);
  });

  it('ignores unit prices on shelf labels', () => {
    const r = tag('Amul Butter 500 g', '₹285', '₹57.00 / 100 g');
    expect(r.product).toMatchObject({ price: 285, quantity: 500, unit: 'g' });
  });

  it('does not take the first number as the price', () => {
    const r = tag('Dettol Soap', '125', '4 x 125 g', 'Pack of 4', 'Rs. 199');
    expect(r.product).toMatchObject({ price: 199, quantity: 500, unit: 'g', factors: [4, 125] });
  });

  it('accepts a decimal price without a symbol but not a bare integer', () => {
    expect(tag('Bread', '400 g', '45.00').product.price).toBe(45);
    const bare = tag('Bread', '400 g', '45');
    expect(bare.product.price).toBeUndefined();
    expect(bare.priceOptions).toEqual([{ value: 45, kind: 'plain' }]);
  });

  it('prefers the labelled net quantity over nutrition and serving sizes', () => {
    const r = tag('Corn Flakes', 'Nutrition per 100 g', 'Serving size 30 g', 'Net Wt. 475 g', 'MRP ₹199');
    expect(r.product).toMatchObject({ quantity: 475, unit: 'g', price: 199 });
  });

  it('reads a label split across lines', () => {
    expect(tag('Net Qty', '750 ml', 'M.R.P. ₹ 120').product).toMatchObject({ quantity: 750, unit: 'ml', price: 120 });
  });

  it('does not offer phone numbers, dates or shelf life as prices', () => {
    const r = tag('TATA SALT', 'Net Qty: 1 kg', 'M.R.P. ₹ 28.00', 'Mfd: 08/2026 Batch No. B2241', 'Best before 24 months', 'Customer care: 1800 123 4567');
    expect(r.priceOptions).toEqual([{ value: 28, kind: 'mrp' }]);
  });

  it('repairs common OCR digit mistakes', () => {
    expect(fixOcrDigits('₹l99')).toBe('₹199');
    expect(fixOcrDigits('5O0 g')).toBe('500 g');
    expect(fixOcrDigits('1O kg')).toBe('10 kg');
    expect(fixOcrDigits('Olive Oil')).toBe('Olive Oil');
    expect(tag('Sugar', 'Net Qty 1 kg', 'MRP ₹5O.00').product.price).toBe(50);
  });

  it('returns empty fields when nothing is recognisable', () => {
    const r = tag('', '   ');
    expect(r.product).toMatchObject({ name: '', price: undefined, quantity: undefined });
    expect(r.priceOptions).toEqual([]);
  });
});
