import { describe, expect, it } from 'vitest';
import { classifyCategory, classifyHazards, displayNumber, extractBrand, hazardClause, normalizeBrand, slugify, toRecall } from '../src/derive.ts';
import { esc, html, jsonScript, truncate } from '../src/html.ts';
import { indexBudget, isIndexable } from '../src/seo.ts';
import type { CpscRecall, Env } from '../src/types.ts';

const raw: CpscRecall = {
  RecallID: 1, RecallNumber: '27042', RecallDate: '2026-10-22T00:00:00', LastPublishDate: '2026-10-22T00:00:00',
  Title: 'Anker Recalls PowerCore Power Banks Due to Fire and Burn Hazards; Sold on Amazon',
  Description: 'This recall involves Anker PowerCore power banks. The lithium-ion battery can overheat and ignite, posing a fire and burn hazard to consumers. They were sold in black and white with model number A1257.',
  URL: 'https://www.cpsc.gov/Recalls/2027/Anker-Recalls-PowerCore',
  ConsumerContact: 'Anker toll-free at 800-988-7973',
  Products: [{ Name: 'Anker PowerCore 10000', Model: 'A1257', NumberOfUnits: 'About 1 million' }],
  Images: [{ URL: 'https://www.cpsc.gov/s3fs-public/a.jpg', Caption: 'Recalled power bank' }, { URL: 'javascript:alert(1)' }],
  Injuries: [{ Name: 'None reported.' }], Manufacturers: [], Retailers: [{ Name: 'Sold At:\nAmazon.com from 2022 through 2026 for about $30.' }, { Name: 'Anker Innovations Limited, of China' }],
  ManufacturerCountries: [{ Country: 'China' }], Hazards: [{ Name: 'Fire & Fire-Related Burn' }], Remedies: [{ Name: 'Consumers should stop using the power banks and contact Anker for a refund.' }], RemedyOptions: [{ Option: 'Refund' }],
};

describe('derivation', () => {
  it('slugifies and formats numbers', () => {
    expect(slugify("Children's Nightgowns & Robes")).toBe('childrens-nightgowns-and-robes');
    expect(displayNumber('27042')).toBe('27-042');
    expect(displayNumber('260123')).toBe('260123');
  });

  it('extracts and normalizes brands', () => {
    expect(extractBrand('Anker Innovations Limited Recalls Power Banks Due to Fire', [])).toBe('Anker Innovations');
    expect(extractBrand('Rechargeable Power Banks Recalled by Daniel M. Friedman & Associates', [])).toBe('Daniel M. Friedman & Associates');
    expect(extractBrand('Costco and Acme Recall Chairs', [])).toBe('Costco');
    expect(normalizeBrand('Polaris Industries Inc., of Medina, Minn.')).toBe('Polaris');
  });

  it('reads the hazard clause and classifies hazards', () => {
    expect(hazardClause('Acme Recalls Heaters Due to Fire Hazard; Sold at Walmart')).toBe('Fire Hazard; Sold at Walmart');
    expect(classifyHazards(['Choking'], '')).toEqual(['choking-ingestion']);
    expect(classifyHazards([], 'Risk of Serious Injury from Electrocution and Fire')).toEqual(expect.arrayContaining(['fire-burn', 'electric-shock']));
  });

  it('classifies categories from the title first', () => {
    expect(classifyCategory('Anker Recalls Power Banks')).toBe('power-banks-chargers');
    expect(classifyCategory('BAMAMON Recalls LED Projecting Finger Light Toys')).toBe('toys');
    expect(classifyCategory('Trek Recalls Electric Bicycles')).toBe('e-bikes-scooters');
    expect(classifyCategory('Acme Recalls Widgets', 'High Chair')).toBe('baby-products');
    expect(classifyCategory('Acme Recalls Widgets')).toBe('other-products');
  });

  it('builds a complete, indexable recall row', () => {
    const r = toRecall(raw);
    expect(r.brand).toBe('Anker');
    expect(r.category).toBe('power-banks-chargers');
    expect(r.hazards).toContain('fire-burn');
    expect(r.sold_at).toContain('Amazon.com');
    expect(r.images).toHaveLength(1); // the javascript: URL is dropped
    expect(r.injuries).toBe(''); // "None reported." is not shown as an injury
    expect(r.slug).toBe('27042-anker-recalls-powercore-power-banks');
    expect(r.quality).toBeGreaterThanOrEqual(70);
    expect(r.eligible).toBe(true);
  });

  it('does not make thin or old recalls eligible', () => {
    expect(toRecall({ ...raw, Description: 'Short.', Remedies: [], Products: [], Images: [], Retailers: [], Hazards: [] }).eligible).toBe(false);
    expect(toRecall({ ...raw, RecallDate: '2012-01-05T00:00:00' }).eligible).toBe(false);
  });
});

describe('indexing schedule', () => {
  const env = { LAUNCH_DATE: '2026-10-25' } as Env;
  it('grows 40 pages a day from 150', () => {
    expect(indexBudget(env, new Date('2026-10-24T00:00:00Z'))).toBe(150);
    expect(indexBudget(env, new Date('2026-10-25T12:00:00Z'))).toBe(150);
    expect(indexBudget(env, new Date('2026-11-04T00:00:00Z'))).toBe(550);
  });
  it('always allows new recalls and never un-indexes ranked ones', () => {
    const day0 = new Date('2026-10-25T00:00:00Z');
    expect(isIndexable({ eligible: true, idx_rank: 0 }, env, day0)).toBe(true);
    expect(isIndexable({ eligible: true, idx_rank: 150 }, env, day0)).toBe(true);
    expect(isIndexable({ eligible: true, idx_rank: 151 }, env, day0)).toBe(false);
    expect(isIndexable({ eligible: true, idx_rank: 151 }, env, new Date('2026-10-26T00:00:00Z'))).toBe(true);
    expect(isIndexable({ eligible: false, idx_rank: 5 }, env, day0)).toBe(false);
    expect(isIndexable({ eligible: true, idx_rank: null }, env, day0)).toBe(false);
  });
});

describe('html helpers', () => {
  it('escapes interpolated values but not nested html', () => {
    expect(html`<p>${'<script>alert(1)</script>'}</p>`.__html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(html`<ul>${['a', 'b'].map((x) => html`<li>${x}</li>`)}</ul>`.__html).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(esc(`"quoted" & 'single'`)).toBe('&quot;quoted&quot; &amp; &#39;single&#39;');
  });
  it('keeps JSON-LD from closing the script tag', () => {
    expect(jsonScript({ a: '</script><b>' })).not.toContain('</script>');
  });
  it('truncates on word boundaries', () => {
    expect(truncate('one two three four five', 14)).toBe('one two three…');
  });
});
