/**
 * Price-tag scanner sheet. Loaded only when the shopper taps "Scan"; the OCR
 * engine itself runs in a Web Worker so the page stays responsive.
 */

import type { CurrencyCode } from '../lib/formatting/currency';
import { parsePriceTag, type TagParseResult } from '../lib/parsing/smart-parse';
import { TOOL_UNIT_LABELS, isToolUnit, type ToolProduct, type ToolUnit } from '../lib/storage/tool-state';
import { engineReady, ocrSupported, recognize, slowConnection, warmUp, type EngineLine, type OcrError } from '../lib/ocr/client';

interface ScannerOptions {
  dialog: HTMLDialogElement;
  /** Symbol and formatting for a currency; the page's currency when none is given. */
  currencySymbol: (currency?: CurrencyCode) => string;
  formatMoney: (value: number, currency?: CurrencyCode) => string;
  onAdd: (product: ToolProduct, currency?: CurrencyCode) => void;
  /** A photo picked before this module finished loading. */
  photo?: File;
}

const SLOW_SCAN_MS = 25_000;

let opts: ScannerOptions;
let wired = false;
let scanToken = 0;
let thumbUrl: string | null = null;
let slowTimer = 0;
let lastResult: TagParseResult | null = null;
let waitingForScan = false;

const $ = <T extends Element = HTMLElement>(sel: string) => opts.dialog.querySelector<T>(sel)!;

function show(part: 'pick' | 'status' | 'form', visible: boolean) {
  const sel = { pick: '[data-scan-pick]', status: '[data-scan-status]', form: '[data-scan-form]' }[part];
  $(sel).hidden = !visible;
}

function message(text: string, tone: 'info' | 'warn' | 'error' = 'info') {
  const el = $('[data-scan-message]');
  el.hidden = !text;
  el.textContent = text;
  el.className = `mt-4 rounded-[14px] p-3.5 text-[14px] leading-relaxed ${
    tone === 'error' ? 'bg-bad-soft text-bad' : tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-field text-ink-2'
  }`;
}

function progress(step: string, fraction: number | null) {
  $('[data-scan-step]').textContent = step;
  const bar = $('[data-scan-bar]');
  const track = $('[data-scan-progress]');
  if (fraction === null) {
    bar.style.width = '35%';
    bar.classList.add('animate-pulse');
    track.removeAttribute('aria-valuenow');
  } else {
    bar.classList.remove('animate-pulse');
    bar.style.width = `${Math.round(fraction * 100)}%`;
    track.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
  }
}

function resetView() {
  window.clearTimeout(slowTimer);
  show('pick', true);
  show('status', false);
  show('form', false);
  message('');
  if (!ocrSupported()) {
    message('Scanning isn’t supported in this browser. Enter the details below instead.', 'warn');
    show('pick', false);
    openForm(null);
  } else if (!engineReady() && slowConnection()) {
    message('The scanner needs a one-time download of about 13 MB. It starts when you pick a photo.', 'warn');
  } else if (!engineReady()) {
    $('[data-scan-intro]').textContent =
      'Photograph the price label or pack. The photo is read on this device and never uploaded. First use downloads about 13 MB.';
  }
  for (const input of opts.dialog.querySelectorAll<HTMLInputElement>('input[type=file]')) input.value = '';
}

function cleanupImage() {
  if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  thumbUrl = null;
  const thumb = $<HTMLImageElement>('[data-scan-thumb]');
  thumb.removeAttribute('src');
  thumb.hidden = true;
}

// ---------------------------------------------------------------- scanning

function failScan(text: string) {
  waitingForScan = false;
  window.clearTimeout(slowTimer);
  show('status', false);
  message(text, 'error');
  openForm(null);
}

const FAILURES: Record<OcrError['code'], string> = {
  unsupported: 'Scanning isn’t supported in this browser. Enter the details below instead.',
  image: 'This image couldn’t be opened. Try a JPG or PNG photo, or enter the details below.',
  engine: 'The scanner couldn’t load on this device. Enter the details below instead.',
  offline: 'You’re offline, so the scanner couldn’t download. Enter the details below instead.',
  scan: 'Something went wrong while reading the photo. Try another photo, or enter the details below.',
};

async function onFile(file: File | undefined) {
  if (!file) return;
  cleanupImage();
  message('');
  show('pick', false);
  show('form', false);
  show('status', true);
  thumbUrl = URL.createObjectURL(file);
  const thumb = $<HTMLImageElement>('[data-scan-thumb]');
  thumb.src = thumbUrl;
  thumb.hidden = false;
  progress('Preparing the photo…', null);

  const token = ++scanToken;
  waitingForScan = true;
  slowTimer = window.setTimeout(() => {
    if (waitingForScan) message('This is taking a while on this device. You can wait, or enter the details below.', 'warn');
    openForm(null, true);
  }, SLOW_SCAN_MS);
  try {
    const lines = await recognize(file, {
      maxSide: 1600,
      onProgress: (step) => {
        if (token !== scanToken || !waitingForScan) return;
        if (step.phase === 'engine') progress('Loading the scanner…', null);
        else if (step.phase === 'models') progress(`Downloading the scanner… ${Math.round((step.fraction ?? 0) * 100)}%`, step.fraction);
        else progress('Reading the text…', null);
      },
    });
    if (token !== scanToken || !waitingForScan) return;
    waitingForScan = false;
    window.clearTimeout(slowTimer);
    handleLines(lines);
  } catch (err) {
    if (token !== scanToken) return;
    failScan(FAILURES[(err as OcrError).code ?? 'scan'] ?? FAILURES.scan);
  }
}

// ---------------------------------------------------------------- results

function handleLines(lines: EngineLine[]) {
  show('status', false);
  const usable = lines.filter((l) => l.text.trim() && l.score >= 0.5);
  if (usable.length === 0) {
    message('No text found. Try again closer to the label, in good light and holding steady, or enter the details below.', 'warn');
    openForm(null);
    return;
  }
  const result = parsePriceTag(usable);
  lastResult = result;
  const { product } = result;
  if (product.price === undefined && product.quantity === undefined) {
    message('Couldn’t spot a price or quantity. Pick one below if it was found, or type it in.', 'warn');
  } else if (product.price === undefined) {
    message('Found the quantity but not the price. Please add the price.', 'warn');
  } else if (product.quantity === undefined) {
    message('Found the price but not the quantity. Please add the quantity.', 'warn');
  } else {
    message('Check the details, then add them to your comparison.');
  }
  openForm(result);
  const raw = $<HTMLElement>('[data-scan-raw]');
  raw.textContent = usable.map((l) => l.text).join('\n');
  $('[data-scan-raw-wrap]').hidden = false;
}

const n = (v: number) => String(Number(v.toPrecision(12)));

function openForm(result: TagParseResult | null, keepValues = false) {
  const form = $<HTMLFormElement>('[data-scan-form]');
  const get = <T extends HTMLInputElement | HTMLSelectElement>(f: string) => form.querySelector<T>(`[data-sf="${f}"]`)!;
  // Show amounts in the currency printed on the tag, if one was recognised.
  const tagCurrency = result?.currency as CurrencyCode | undefined;
  form.querySelectorAll('[data-cur]').forEach((el) => (el.textContent = opts.currencySymbol(tagCurrency)));
  show('form', true);
  if (keepValues && !form.hidden && (get('price').value || get('quantity').value)) return;

  const p = result?.product;
  get('name').value = p?.name ?? '';
  get('price').value = p?.price !== undefined ? n(p.price) : '';
  get('quantity').value = p?.quantity !== undefined ? (p.factors.length > 1 ? p.factors.map(n).join(' x ') : n(p.quantity)) : '';
  get('unit').value = p?.unit && isToolUnit(p.unit) ? p.unit : 'g';
  if (!result) {
    $('[data-scan-raw-wrap]').hidden = true;
    lastResult = null;
  }

  // One-tap alternatives for anything else that was found.
  const options = $('[data-scan-options]');
  const chips: HTMLButtonElement[] = [];
  for (const o of result?.priceOptions ?? []) {
    if (o.value === p?.price) continue;
    const label = `${opts.formatMoney(o.value, tagCurrency)}${o.kind === 'mrp' ? ' MRP' : o.kind === 'offer' ? ' offer' : ''}`;
    chips.push(chip(`Use ${label}`, () => (get('price').value = n(o.value))));
  }
  for (const o of result?.quantityOptions ?? []) {
    if (o.quantity === p?.quantity && o.unit === p?.unit) continue;
    chips.push(
      chip(`Use ${n(o.quantity)} ${TOOL_UNIT_LABELS[o.unit as ToolUnit]}`, () => {
        get('quantity').value = n(o.quantity);
        get('unit').value = o.unit;
      }),
    );
  }
  options.replaceChildren(...chips.slice(0, 6));
  options.hidden = chips.length === 0;
  (p?.price === undefined ? get('price') : p.quantity === undefined ? get('quantity') : form.querySelector<HTMLButtonElement>('[type=submit]')!).focus({ preventScroll: true });
}

function chip(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'h-9 rounded-full bg-field px-3 text-[13px] font-medium text-ink-2 transition hover:bg-hairline';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

// ---------------------------------------------------------------- wiring

function wire() {
  wired = true;
  const form = $<HTMLFormElement>('[data-scan-form]');
  const get = (f: string) => form.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-sf="${f}"]`)!;

  $<HTMLInputElement>('[data-scan-camera]').addEventListener('change', (e) => onFile((e.target as HTMLInputElement).files?.[0]));
  $<HTMLInputElement>('[data-scan-file]').addEventListener('change', (e) => onFile((e.target as HTMLInputElement).files?.[0]));
  $('[data-scan-close]').addEventListener('click', () => opts.dialog.close());
  $('[data-scan-again]').addEventListener('click', () => {
    cleanupImage();
    resetView();
  });
  // Tap outside the sheet to close it.
  opts.dialog.addEventListener('click', (e) => {
    if (e.target === opts.dialog) opts.dialog.close();
  });
  opts.dialog.addEventListener('close', () => {
    waitingForScan = false;
    window.clearTimeout(slowTimer);
    cleanupImage();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const price = get('price').value.trim();
    const quantity = get('quantity').value.trim();
    if (!price && !quantity) {
      message('Enter at least a price or a quantity.', 'error');
      get('price').focus();
      return;
    }
    const unit = get('unit').value;
    const currency = lastResult?.currency;
    opts.onAdd(
      { name: get('name').value.trim(), price, quantity, unit: isToolUnit(unit) ? unit : 'g' },
      currency === 'INR' || currency === 'USD' || currency === 'EUR' || currency === 'GBP' ? currency : undefined,
    );
    opts.dialog.close();
  });
}

export function startScanner(options: ScannerOptions) {
  opts = options;
  if (!wired) wire();
  cleanupImage();
  resetView();
  if (options.photo) {
    void onFile(options.photo);
    return;
  }
  // Start downloading the engine as soon as the sheet opens (unless data saving is on),
  // so it's often ready by the time a photo is taken.
  if (!slowConnection()) warmUp();
}
