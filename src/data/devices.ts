export type Port = 'Lightning' | 'USB-C';
export type Tier = 'base' | 'plus' | 'mini' | 'pro' | 'pro-max' | 'air' | 'se';

export interface Device {
  slug: string;
  name: string;
  brand: 'Apple';
  /** Generation hub the model belongs to, e.g. `iphone-15`. */
  series: string;
  tier: Tier;
  year: number;
  screen: string;
  port: Port;
  chip: string;
  wirelessCharging: string;
  specsUrl: string;
  repairUrl: string;
  notes: string[];
}

export interface Series {
  slug: string;
  name: string;
  year: number;
  blurb: string;
}

const APPLE_REPAIR = 'https://support.apple.com/repair';
const KB = (id: string) => `https://support.apple.com/kb/${id}`;

/**
 * Model facts come from Apple's technical-specification pages (`specsUrl`),
 * reached from Apple's "Identify your iPhone model" list.
 */
type Row = [slug: string, name: string, series: string, tier: Tier, year: number, screen: string, port: Port, chip: string, wireless: string, specs: string];

const MS = 'MagSafe and Qi';
const MS2 = 'MagSafe and Qi2';

const ROWS: Row[] = [
  ['iphone-11', 'iPhone 11', 'iphone-11', 'base', 2019, '6.1-inch LCD', 'Lightning', 'A13 Bionic', 'Qi', KB('SP804')],
  ['iphone-11-pro', 'iPhone 11 Pro', 'iphone-11', 'pro', 2019, '5.8-inch OLED', 'Lightning', 'A13 Bionic', 'Qi', KB('SP805')],
  ['iphone-11-pro-max', 'iPhone 11 Pro Max', 'iphone-11', 'pro-max', 2019, '6.5-inch OLED', 'Lightning', 'A13 Bionic', 'Qi', KB('SP806')],
  ['iphone-se-2nd-generation', 'iPhone SE (2nd generation)', 'iphone-se', 'se', 2020, '4.7-inch LCD', 'Lightning', 'A13 Bionic', 'Qi', KB('SP820')],
  ['iphone-12-mini', 'iPhone 12 mini', 'iphone-12', 'mini', 2020, '5.4-inch OLED', 'Lightning', 'A14 Bionic', MS, KB('SP829')],
  ['iphone-12', 'iPhone 12', 'iphone-12', 'base', 2020, '6.1-inch OLED', 'Lightning', 'A14 Bionic', MS, KB('SP830')],
  ['iphone-12-pro', 'iPhone 12 Pro', 'iphone-12', 'pro', 2020, '6.1-inch OLED', 'Lightning', 'A14 Bionic', MS, KB('SP831')],
  ['iphone-12-pro-max', 'iPhone 12 Pro Max', 'iphone-12', 'pro-max', 2020, '6.7-inch OLED', 'Lightning', 'A14 Bionic', MS, KB('SP832')],
  ['iphone-13-mini', 'iPhone 13 mini', 'iphone-13', 'mini', 2021, '5.4-inch OLED', 'Lightning', 'A15 Bionic', MS, KB('SP847')],
  ['iphone-13', 'iPhone 13', 'iphone-13', 'base', 2021, '6.1-inch OLED', 'Lightning', 'A15 Bionic', MS, 'https://support.apple.com/en-us/111872'],
  ['iphone-13-pro', 'iPhone 13 Pro', 'iphone-13', 'pro', 2021, '6.1-inch OLED', 'Lightning', 'A15 Bionic', MS, KB('SP852')],
  ['iphone-13-pro-max', 'iPhone 13 Pro Max', 'iphone-13', 'pro-max', 2021, '6.7-inch OLED', 'Lightning', 'A15 Bionic', MS, KB('SP848')],
  ['iphone-se-3rd-generation', 'iPhone SE (3rd generation)', 'iphone-se', 'se', 2022, '4.7-inch LCD', 'Lightning', 'A15 Bionic', 'Qi', KB('SP867')],
  ['iphone-14', 'iPhone 14', 'iphone-14', 'base', 2022, '6.1-inch OLED', 'Lightning', 'A15 Bionic', MS, 'https://support.apple.com/en-us/111850'],
  ['iphone-14-plus', 'iPhone 14 Plus', 'iphone-14', 'plus', 2022, '6.7-inch OLED', 'Lightning', 'A15 Bionic', MS, KB('SP874')],
  ['iphone-14-pro', 'iPhone 14 Pro', 'iphone-14', 'pro', 2022, '6.1-inch OLED', 'Lightning', 'A16 Bionic', MS, KB('SP875')],
  ['iphone-14-pro-max', 'iPhone 14 Pro Max', 'iphone-14', 'pro-max', 2022, '6.7-inch OLED', 'Lightning', 'A16 Bionic', MS, KB('SP876')],
  ['iphone-15', 'iPhone 15', 'iphone-15', 'base', 2023, '6.1-inch OLED', 'USB-C', 'A16 Bionic', MS, 'https://support.apple.com/en-gb/111831'],
  ['iphone-15-plus', 'iPhone 15 Plus', 'iphone-15', 'plus', 2023, '6.7-inch OLED', 'USB-C', 'A16 Bionic', MS, KB('SP902')],
  ['iphone-15-pro', 'iPhone 15 Pro', 'iphone-15', 'pro', 2023, '6.1-inch OLED', 'USB-C', 'A17 Pro', MS, KB('SP903')],
  ['iphone-15-pro-max', 'iPhone 15 Pro Max', 'iphone-15', 'pro-max', 2023, '6.7-inch OLED', 'USB-C', 'A17 Pro', MS, KB('SP904')],
  ['iphone-16', 'iPhone 16', 'iphone-16', 'base', 2024, '6.1-inch OLED', 'USB-C', 'A18', MS2, 'https://support.apple.com/121029'],
  ['iphone-16-plus', 'iPhone 16 Plus', 'iphone-16', 'plus', 2024, '6.7-inch OLED', 'USB-C', 'A18', MS2, 'https://support.apple.com/121030'],
  ['iphone-16-pro', 'iPhone 16 Pro', 'iphone-16', 'pro', 2024, '6.3-inch OLED', 'USB-C', 'A18 Pro', MS2, 'https://support.apple.com/121031'],
  ['iphone-16-pro-max', 'iPhone 16 Pro Max', 'iphone-16', 'pro-max', 2024, '6.9-inch OLED', 'USB-C', 'A18 Pro', MS2, 'https://support.apple.com/121032'],
  ['iphone-17', 'iPhone 17', 'iphone-17', 'base', 2025, '6.3-inch OLED', 'USB-C', 'A19', MS2, 'https://support.apple.com/125089'],
  ['iphone-air', 'iPhone Air', 'iphone-17', 'air', 2025, '6.5-inch OLED', 'USB-C', 'A19 Pro', MS2, 'https://support.apple.com/125092'],
  ['iphone-17-pro', 'iPhone 17 Pro', 'iphone-17', 'pro', 2025, '6.3-inch OLED', 'USB-C', 'A19 Pro', MS2, 'https://support.apple.com/125090'],
  ['iphone-17-pro-max', 'iPhone 17 Pro Max', 'iphone-17', 'pro-max', 2025, '6.9-inch OLED', 'USB-C', 'A19 Pro', MS2, 'https://support.apple.com/125091'],
];

// Repair pages that were already linked on the original three device pages.
const REPAIR_OVERRIDES: Record<string, string> = {
  'iphone-13': 'https://support.apple.com/en-gb/100402',
  'iphone-15': 'https://support.apple.com/en-us/104900',
};

export const DEVICES: Device[] = ROWS.map(([slug, name, series, tier, year, screen, port, chip, wirelessCharging, specsUrl]) => ({
  slug, name, brand: 'Apple', series, tier, year, screen, port, chip, wirelessCharging, specsUrl,
  repairUrl: REPAIR_OVERRIDES[slug] ?? APPLE_REPAIR,
  notes: [
    port === 'USB-C' ? 'USB-C charging connector' : 'Lightning charging connector',
    `${wirelessCharging} wireless charging`,
  ],
}));

export const SERIES: Series[] = [
  { slug: 'iphone-17', name: 'iPhone 17 series', year: 2025, blurb: 'iPhone 17, iPhone Air, iPhone 17 Pro and iPhone 17 Pro Max.' },
  { slug: 'iphone-16', name: 'iPhone 16 series', year: 2024, blurb: 'iPhone 16, 16 Plus, 16 Pro and 16 Pro Max.' },
  { slug: 'iphone-15', name: 'iPhone 15 series', year: 2023, blurb: 'The first iPhones with a USB-C port.' },
  { slug: 'iphone-14', name: 'iPhone 14 series', year: 2022, blurb: 'iPhone 14, 14 Plus, 14 Pro and 14 Pro Max.' },
  { slug: 'iphone-13', name: 'iPhone 13 series', year: 2021, blurb: 'iPhone 13 mini, 13, 13 Pro and 13 Pro Max.' },
  { slug: 'iphone-12', name: 'iPhone 12 series', year: 2020, blurb: 'iPhone 12 mini, 12, 12 Pro and 12 Pro Max, the first with MagSafe.' },
  { slug: 'iphone-11', name: 'iPhone 11 series', year: 2019, blurb: 'iPhone 11, 11 Pro and 11 Pro Max.' },
  { slug: 'iphone-se', name: 'iPhone SE', year: 2022, blurb: 'The 2nd and 3rd generation iPhone SE, with a 4.7-inch display.' },
];

export const getDevice = (slug: string) => DEVICES.find((device) => device.slug === slug);
export const getSeries = (slug: string) => SERIES.find((series) => series.slug === slug);
export const devicesInSeries = (slug: string) => DEVICES.filter((device) => device.series === slug);
export const devicesWithPort = (port: Port) => DEVICES.filter((device) => device.port === port);
export const devicePath = (slug: string) => `/devices/${slug}/`;

const TIER_ORDER: Tier[] = ['mini', 'se', 'base', 'plus', 'air', 'pro', 'pro-max'];

/** Models in the same series, nearest tier first (for "also in this series" links). */
export function siblings(device: Device): Device[] {
  return devicesInSeries(device.series)
    .filter((d) => d.slug !== device.slug)
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
}

/** The same tier in the previous and next generation, when we cover them. */
export function neighbours(device: Device): { previous?: Device; next?: Device } {
  const same = DEVICES.filter((d) => d.tier === device.tier && d.slug !== 'iphone-air').sort((a, b) => a.year - b.year);
  const i = same.findIndex((d) => d.slug === device.slug);
  if (device.tier === 'se' || i < 0) return {};
  return { previous: same[i - 1], next: same[i + 1] };
}

/** Same-tier generation pairs that get a hand-checkable comparison page. */
export interface ComparePair { slug: string; older: Device; newer: Device }
export function comparePairs(): ComparePair[] {
  const pairs: ComparePair[] = [];
  for (const tier of ['base', 'pro'] as Tier[]) {
    const same = DEVICES.filter((d) => d.tier === tier).sort((a, b) => a.year - b.year);
    for (let i = 1; i < same.length; i++) {
      pairs.push({ slug: `${same[i - 1]!.slug}-vs-${same[i]!.slug}`, older: same[i - 1]!, newer: same[i]! });
    }
  }
  return pairs;
}
export const getComparePair = (slug: string) => comparePairs().find((p) => p.slug === slug);

/** Battery-cycle design target Apple publishes (iPhone battery and performance page). */
export function batteryCycleTarget(device: Device): number | undefined {
  if (device.year <= 2022) return 500;
  if (device.series === 'iphone-15') return 1000;
  return undefined;
}

export interface DeviceFaq { question: string; answer: string }

/** Questions people actually search, answered only from the facts above. */
export function deviceFaq(device: Device): DeviceFaq[] {
  const cableAnswer =
    device.port === 'USB-C'
      ? `Use a cable with a USB-C plug at the phone end, such as USB-C to USB-C. A Lightning cable will not fit the ${device.name}.`
      : `Use a cable with a Lightning plug at the phone end, such as USB-C to Lightning or USB-A to Lightning. A USB-C plug will not fit the ${device.name} directly.`;
  const faq: DeviceFaq[] = [
    {
      question: `Does the ${device.name} use USB-C or Lightning?`,
      answer: `The ${device.name} has a ${device.port} charging port, according to Apple’s technical specifications.`,
    },
    { question: `Which cable do I need for the ${device.name}?`, answer: cableAnswer },
    {
      question: `Does the ${device.name} support wireless charging?`,
      answer: `Yes. Apple lists ${device.wirelessCharging} wireless charging for the ${device.name}.`,
    },
    {
      question: `What chip does the ${device.name} have?`,
      answer: `The ${device.name}, introduced in ${device.year}, has the ${device.chip} chip and a ${device.screen} display.`,
    },
  ];
  const cycles = batteryCycleTarget(device);
  if (cycles) {
    faq.push({
      question: `How long does the ${device.name} battery last before it needs replacing?`,
      answer: `Apple designs ${device.year >= 2023 ? 'iPhone 15 models' : 'iPhone 14 models and earlier'} to retain up to 80% of original battery capacity at ${cycles.toLocaleString('en-US')} complete charge cycles under normal conditions. Check Settings → Battery → Battery Health for your own phone.`,
    });
  }
  return faq;
}
