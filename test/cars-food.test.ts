import { describe, expect, it } from 'vitest';
import { campaignTitle, campaignYear, fromApiRows, isUsable, isoDate, prettyComponent, prettyManufacturer, prettyModel, toVehicle } from '../src/cars/derive.ts';
import { CLASS_INFO, classifyFoodCategory, classifyFoodHazards, groupRows, isoFdaDate, normalizeFirm, toFoodEvent, type FdaRow } from '../src/food/derive.ts';

describe('car recalls', () => {
  it('prettifies names and dates', () => {
    expect(prettyModel('ACCORD HYBRID')).toBe('Accord Hybrid');
    expect(prettyModel('F-150')).toBe('F-150');
    expect(prettyModel('CR-V')).toBe('CR-V');
    expect(prettyComponent('ELECTRICAL SYSTEM:BODY CONTROL MODULE:SOFTWARE')).toBe('Electrical system: body control module, software');
    expect(prettyManufacturer('Honda (American Honda Motor Co.)')).toBe('Honda');
    expect(isoDate('10/12/2020')).toBe('2020-12-10');
    expect(isoDate('20100628')).toBe('2010-06-28');
    expect(campaignYear('20V771000')).toBe(2020);
  });

  it('keeps only passenger-vehicle makes and sane years', () => {
    expect(toVehicle('HONDA', 'ACCORD', '2018')?.makeSlug).toBe('honda');
    expect(toVehicle('FREIGHTLINER', 'CASCADIA', '2018')).toBeNull();
    expect(toVehicle('HONDA', 'ACCORD', '9999')).toBeNull();
  });

  it('turns API rows into one campaign with a readable title', () => {
    const base = { NHTSACampaignNumber: '20V771000', Manufacturer: 'Honda (American Honda Motor Co.)', ReportReceivedDate: '10/12/2020', Component: 'ELECTRICAL SYSTEM:BODY CONTROL MODULE:SOFTWARE', Summary: 'Honda is recalling certain 2018-2020 Accord Sedan vehicles. A software error may cause intermittent communication loss between modules.', Consequence: 'Systems may malfunction.', Remedy: 'Dealers will update the software, free of charge.', Notes: '', PotentialNumberofUnitsAffected: 737233, parkIt: false, parkOutSide: false, overTheAirUpdate: false, Make: 'HONDA' };
    const c = fromApiRows([{ ...base, Model: 'ACCORD', ModelYear: '2018' }, { ...base, Model: 'ACCORD', ModelYear: '2019' }, { ...base, Model: 'ACCORD', ModelYear: '2019' }, { ...base, Model: 'INSIGHT', ModelYear: '2020' }])!;
    expect(c.vehicles).toHaveLength(3);
    expect(c.units).toBe(737233);
    expect(campaignTitle(c)).toBe('2018–2020 Honda Accord, Insight recall: Electrical system: body control module, software');
    expect(isUsable(c)).toBe(true);
    expect(isUsable({ ...c, summary: 'Too short' })).toBe(false);
  });
});

describe('food recalls', () => {
  it('normalizes firms and dates', () => {
    expect(normalizeFirm('FRESH IDEATION FOOD GROUP, LLC dba Fresh Creative Cuisine')).toBe('Fresh Creative Cuisine');
    expect(normalizeFirm('ACME SNACKS INC.')).toBe('Acme Snacks');
    expect(isoFdaDate('20260318')).toBe('2026-03-18');
  });

  it('classifies reasons and categories', () => {
    expect(classifyFoodHazards('Undeclared milk and wheat. Potential Listeria monocytogenes.')).toEqual(expect.arrayContaining(['undeclared-allergens', 'listeria']));
    expect(classifyFoodHazards('Salmonella')).toEqual(['salmonella']);
    expect(classifyFoodHazards('Something unusual')).toEqual(['labeling-quality']);
    expect(classifyFoodCategory(['Organic baby spinach 5 oz'])).toBe('fresh-produce');
    expect(classifyFoodCategory(['Strawberry yogurt cups'])).toBe('dairy');
    expect(classifyFoodCategory(['Dietary supplement capsules'])).toBe('supplements-infant');
  });

  const row = (over: Partial<FdaRow> = {}): FdaRow => ({
    recall_number: 'F-0001-2026', event_id: '12345', classification: 'Class I', status: 'Ongoing', recalling_firm: 'Sunny Farms, LLC', city: 'Fresno', state: 'CA', country: 'United States',
    distribution_pattern: 'Nationwide distribution through retail grocery stores in all 50 states and Puerto Rico.', product_description: 'Sunny Farms organic baby spinach, 5 oz clamshell, UPC 0 12345 67890 1',
    product_quantity: '12,000 cases', reason_for_recall: 'Potential contamination with Listeria monocytogenes found during routine testing by the state department of agriculture.',
    recall_initiation_date: '20260301', report_date: '20260318', code_info: 'Best by 03/20/2026, 03/22/2026 and 03/25/2026. Lot codes 4421A through 4427C.', voluntary_mandated: 'Voluntary: Firm initiated', ...over,
  });

  it('groups product rows into events and decides eligibility', () => {
    const events = groupRows([row(), row({ recall_number: 'F-0002-2026', product_description: 'Sunny Farms spring mix, 10 oz' }), row({ event_id: '999', report_date: '20150101' })]);
    expect(events).toHaveLength(2);
    const e = events.find((x) => x.eventId === '12345')!;
    expect(e.products).toHaveLength(2);
    expect(e.hazards).toContain('listeria');
    expect(e.classification).toBe('I');
    expect(e.eligible).toBe(true);
    expect(e.title).toContain('Sunny Farms recalls');
    expect(events.find((x) => x.eventId === '999')!.eligible).toBe(false); // before 2019
  });

  it('rejects thin or unclassified events', () => {
    expect(toFoodEvent([row({ reason_for_recall: 'Short', product_description: 'X', distribution_pattern: 'NC', code_info: '', product_quantity: '' })])!.eligible).toBe(false);
    expect(toFoodEvent([row({ classification: 'Not Yet Classified' })])!.eligible).toBe(false);
    expect(CLASS_INFO.I!.meaning).toContain('serious adverse health consequences');
  });
});
