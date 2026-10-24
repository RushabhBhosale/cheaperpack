/**
 * Currencies offered in the calculator. Amounts are only ever formatted in
 * the chosen currency; nothing is converted between currencies.
 */

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'NZD', 'CHF',
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'ILS', 'AED',
  'SAR', 'EGP', 'ZAR', 'NGN', 'KES', 'MXN', 'BRL', 'ARS', 'CLP', 'COP',
  'PEN', 'KRW', 'TWD', 'HKD', 'SGD', 'MYR', 'THB', 'IDR', 'PHP', 'VND',
  'PKR', 'BDT',
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

const EURO_REGIONS = [
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT',
  'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK',
];

const REGION_CURRENCY: Record<string, CurrencyCode> = {
  US: 'USD', GB: 'GBP', JP: 'JPY', CN: 'CNY', IN: 'INR', CA: 'CAD', AU: 'AUD',
  NZ: 'NZD', CH: 'CHF', LI: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN',
  CZ: 'CZK', HU: 'HUF', RO: 'RON', TR: 'TRY', IL: 'ILS', AE: 'AED', SA: 'SAR',
  EG: 'EGP', ZA: 'ZAR', NG: 'NGN', KE: 'KES', MX: 'MXN', BR: 'BRL', AR: 'ARS',
  CL: 'CLP', CO: 'COP', PE: 'PEN', KR: 'KRW', TW: 'TWD', HK: 'HKD', SG: 'SGD',
  MY: 'MYR', TH: 'THB', ID: 'IDR', PH: 'PHP', VN: 'VND', PK: 'PKR', BD: 'BDT',
  ...Object.fromEntries(EURO_REGIONS.map((r) => [r, 'EUR' as const])),
};

export function isCurrency(code: unknown): code is CurrencyCode {
  return typeof code === 'string' && (CURRENCIES as readonly string[]).includes(code);
}

/** Guesses a currency from a locale such as "en-GB" or "pt-BR". Falls back to USD. */
export function currencyForLocale(locale: string | undefined): CurrencyCode {
  if (!locale) return DEFAULT_CURRENCY;
  let region: string | undefined;
  try {
    region = new Intl.Locale(locale).maximize().region;
  } catch {
    return DEFAULT_CURRENCY;
  }
  return (region && REGION_CURRENCY[region]) || DEFAULT_CURRENCY;
}

/** Name of a currency in the given locale, e.g. "Euro", with a code fallback. */
export function currencyName(code: string, locale: string | undefined): string {
  try {
    return new Intl.DisplayNames(locale, { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The currencies offered in the tools. Amounts are never converted between them. */
export const TOOL_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export type ToolCurrency = (typeof TOOL_CURRENCIES)[number];

export function isToolCurrency(code: unknown): code is ToolCurrency {
  return typeof code === 'string' && (TOOL_CURRENCIES as readonly string[]).includes(code);
}

/** INR, USD, EUR or GBP from the visitor's locale; US dollars when none fits. */
export function toolCurrencyForLocale(locale: string | undefined): ToolCurrency {
  const guess = currencyForLocale(locale);
  return isToolCurrency(guess) ? guess : 'USD';
}
