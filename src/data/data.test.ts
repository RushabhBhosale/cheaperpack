import { describe, expect, it } from 'vitest';
import { DEVICES, SERIES, comparePairs, deviceFaq, getSeries } from './devices';
import { GUIDES, getGuide } from './guides';
import { TOOLS } from './tools';

describe('device data', () => {
  it('has unique slugs, known series and https source links', () => {
    expect(new Set(DEVICES.map((d) => d.slug)).size).toBe(DEVICES.length);
    for (const d of DEVICES) {
      expect(getSeries(d.series), d.slug).toBeDefined();
      expect(d.specsUrl, d.slug).toMatch(/^https:\/\/support\.apple\.com\//);
    }
  });

  it('uses USB-C from the iPhone 15 series onwards and Lightning before it', () => {
    for (const d of DEVICES) expect(d.port, d.slug).toBe(d.year >= 2023 ? 'USB-C' : 'Lightning');
  });

  it('gives every series at least one model and builds comparison pairs', () => {
    for (const s of SERIES) expect(DEVICES.some((d) => d.series === s.slug), s.slug).toBe(true);
    const pairs = comparePairs();
    expect(pairs.length).toBeGreaterThan(5);
    for (const p of pairs) expect(p.newer.year).toBeGreaterThan(p.older.year);
  });

  it('answers port questions from the data', () => {
    const faq = deviceFaq(DEVICES.find((d) => d.slug === 'iphone-14')!);
    expect(faq[0]!.answer).toContain('Lightning');
  });
});

describe('guide data', () => {
  it('links only to guides and tools that exist, with sources and FAQs', () => {
    for (const g of GUIDES) {
      expect(g.sources.length, g.slug).toBeGreaterThan(0);
      expect(g.faq.length, g.slug).toBeGreaterThan(0);
      for (const r of g.related) expect(getGuide(r), `${g.slug} -> ${r}`).toBeDefined();
      for (const t of g.tools ?? []) expect(TOOLS.some((x) => x.slug === t), `${g.slug} -> ${t}`).toBe(true);
    }
  });
});
