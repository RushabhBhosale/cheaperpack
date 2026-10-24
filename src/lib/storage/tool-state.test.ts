import { describe, expect, it } from 'vitest';
import { addRecent, decodeShare, encodeShare, parseRecents, type ToolSnapshot } from './tool-state';

const snap: ToolSnapshot = {
  currency: 'INR',
  products: [
    { name: 'Powder ~ 50% & more', price: '210', quantity: '2', unit: 'kg' },
    { name: '', price: '189', quantity: '1.5', unit: 'kg' },
    { name: '', price: '', quantity: '', unit: 'g' },
  ],
};

describe('share links', () => {
  it('round-trips products, skipping blank rows', () => {
    const decoded = decodeShare(`#${encodeShare(snap)}`);
    expect(decoded).toEqual({ currency: 'INR', products: snap.products.slice(0, 2) });
  });

  it('rejects malformed or tampered fragments', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('#v=2&c=INR&p=1~1~kg~')).toBeNull();
    expect(decodeShare('#v=1&c=INR&p=1~1~stone~')).toBeNull();
    expect(decodeShare('#v=1&c=INR&p=1~1~kg')).toBeNull();
    expect(decodeShare('#v=1&c=INR&p=%E0%A4%A~1~kg~')).toBeNull();
  });

  it('falls back to INR for an unknown currency', () => {
    expect(decodeShare('#v=1&c=XXX&p=10~1~kg~')?.currency).toBe('INR');
  });
});

describe('recent comparisons', () => {
  it('keeps the newest first, without duplicates, up to five', () => {
    let list = addRecent([], snap, 1);
    list = addRecent(list, { ...snap, currency: 'USD' }, 2);
    list = addRecent(list, snap, 3);
    expect(list.map((r) => [r.currency, r.savedAt])).toEqual([
      ['INR', 3],
      ['USD', 2],
    ]);
    expect(list[0]!.products).toHaveLength(2);
    for (let i = 0; i < 10; i++) list = addRecent(list, { ...snap, products: [{ name: '', price: String(i + 1), quantity: '1', unit: 'g' }] }, 10 + i);
    expect(list).toHaveLength(5);
  });

  it('ignores corrupt storage', () => {
    expect(parseRecents(null)).toEqual([]);
    expect(parseRecents('not json')).toEqual([]);
    expect(parseRecents('{"a":1}')).toEqual([]);
    expect(parseRecents('[{"savedAt":1,"currency":"INR","products":[{"name":"","price":"1","quantity":"1","unit":"stone"}]}]')).toEqual([]);
    const good = JSON.stringify(addRecent([], snap, 5));
    expect(parseRecents(good)).toHaveLength(1);
  });
});
