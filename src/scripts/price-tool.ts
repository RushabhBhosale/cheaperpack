/**
 * Smart price comparison tool (browser). Everything runs locally; the OCR
 * scanner is a separate module loaded only when the shopper opens it.
 */

import { compareProducts, isTied, type Comparison, type RankedProduct } from '../lib/calculations/compare';
import { isToolCurrency, type CurrencyCode } from '../lib/formatting/currency';
import { currencyChosen, getCurrency, initCurrency, onCurrency, setCurrency } from '../lib/ui/currency';
import { currencySymbol, formatNumber } from '../lib/formatting/format';
import { decimalSeparatorFor } from '../lib/parsing/parse';
import { parseShoppingText, type SmartProduct } from '../lib/parsing/smart-parse';
import {
  MAX_TOOL_PRODUCTS,
  TOOL_UNIT_LABELS,
  addRecent,
  decodeShare,
  emptyProduct,
  encodeShare,
  isBlank,
  isToolUnit,
  parseRecents,
  signature,
  type RecentComparison,
  type ToolProduct,
  type ToolSnapshot,
  type ToolUnit,
} from '../lib/storage/tool-state';
import type { Dimension } from '../lib/calculations/units';

type Field = keyof ToolProduct;
type Ok = Extract<Comparison, { status: 'ok' }>;

const KEYS = { recents: 'cheaperpack:recents', draft: 'cheaperpack:draft' };
const DRAFT_MAX_AGE = 12 * 60 * 60 * 1000;
const MIN_ROWS = 2;

const locale = navigator.language || 'en-IN';
const localeDecimal = decimalSeparatorFor(locale);

const root = document.querySelector<HTMLElement>('[data-tool]')!;
const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

const els = {
  quick: q<HTMLTextAreaElement>('[data-quick]'),
  quickHint: q('[data-quick-hint]'),
  rows: q<HTMLOListElement>('[data-rows]'),
  template: q<HTMLTemplateElement>('[data-row-template]'),
  add: q<HTMLButtonElement>('[data-add]'),
  reset: q<HTMLButtonElement>('[data-reset]'),
  currency: q<HTMLSelectElement>('[data-currency]'),
  result: q('[data-result]'),
  resultSection: q('[data-result-section]'),
  resultTitle: q('[data-result-title]'),
  per: q<HTMLButtonElement>('[data-per]'),
  actions: q('[data-actions]'),
  share: q<HTMLButtonElement>('[data-share]'),
  recentsWrap: q('[data-recents-wrap]'),
  recents: q<HTMLUListElement>('[data-recents]'),
  recentsClear: q<HTMLButtonElement>('[data-recents-clear]'),
  sticky: q<HTMLButtonElement>('[data-sticky]'),
  stickyText: q('[data-sticky-text]'),
  live: q('[data-live]'),
  toast: q('[data-toast]'),
  scan: q<HTMLButtonElement>('[data-scan]'),
  scanner: q<HTMLDialogElement>('[data-scanner]'),
};

// ---------------------------------------------------------------- storage

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the tool still works, it just won't remember.
  }
}

// ---------------------------------------------------------------- state

interface RowMeta {
  touched: Set<Field>;
}

const state = {
  products: [emptyProduct(), emptyProduct()] as ToolProduct[],
  meta: [newMeta(), newMeta()] as RowMeta[],
  currency: getCurrency() as CurrencyCode,
  per: {} as Partial<Record<Dimension, string>>,
  result: null as Comparison | null,
  extraDigits: 0,
  /**
   * While the quick-entry box has text, it controls the list. These are the
   * rows from before typing started, restored if the box is cleared.
   */
  beforeQuick: null as { products: ToolProduct[]; meta: RowMeta[] } | null,
};

function newMeta(): RowMeta {
  return { touched: new Set() };
}

function snapshot(): ToolSnapshot {
  return { products: state.products.map((p) => ({ ...p })), currency: state.currency };
}

function setProducts(products: ToolProduct[]) {
  const list = products.slice(0, MAX_TOOL_PRODUCTS).map((p) => ({ ...p }));
  while (list.length < MIN_ROWS) list.push(emptyProduct(list.at(-1)?.unit));
  state.products = list;
  state.meta = list.map(() => newMeta());
}

// ---------------------------------------------------------------- formatting

const letter = (i: number) => String.fromCharCode(65 + i);
const labelOf = (i: number) => state.products[i]?.name.trim() || `Product ${letter(i)}`;

function baseDigits(currency: string = state.currency): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** ₹64, ₹0.72, ₹10.50 — whole amounts without decimals, small ones with enough digits. */
function money(value: number, extra = 0, currency: string = state.currency): string {
  const base = baseDigits(currency);
  const abs = Math.abs(value);
  let max = base + extra;
  if (abs > 0 && abs < 10 ** (1 - base)) max = Math.max(max, Math.min(6, 2 - Math.floor(Math.log10(abs))));
  const rounded = Number(value.toFixed(max));
  const whole = Math.abs(rounded - Math.round(rounded)) < 1e-9;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : base,
    maximumFractionDigits: whole ? 0 : max,
  }).format(value);
}

function pct(fraction: number): string {
  if (fraction > 0 && fraction < 0.001) return '<0.1%';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(fraction);
}

function qty(p: Pick<RankedProduct, 'quantity' | 'factors' | 'unit'>): string {
  const unit = TOOL_UNIT_LABELS[p.unit.id as ToolUnit] ?? p.unit.symbol;
  const n = (v: number) => formatNumber(v, locale);
  return p.factors.length > 1 ? `${p.factors.map(n).join(' × ')} ${unit}` : `${n(p.quantity)} ${unit}`;
}

const perLabel = (r: Ok) => (r.perUnit.id === 'item' ? 'piece' : r.perUnit.label);

// ---------------------------------------------------------------- DOM helpers

type Child = Node | string | null | undefined | false;

function h(tag: string, attrs: Record<string, string | undefined> | null, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) if (v !== undefined) el.setAttribute(k, v);
  for (const c of children) if (c) el.append(c);
  return el;
}

function rowEls(): HTMLLIElement[] {
  return [...els.rows.querySelectorAll<HTMLLIElement>(':scope > [data-row]')];
}

function field(row: HTMLElement, f: Field) {
  return row.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-f="${f}"]`)!;
}

let rowUid = 0;

function syncRows() {
  const rows = rowEls();
  while (rows.length < state.products.length) {
    const li = (els.template.content.firstElementChild as HTMLLIElement).cloneNode(true) as HTMLLIElement;
    els.rows.append(li);
    rows.push(li);
  }
  while (rows.length > state.products.length) rows.pop()!.remove();

  rows.forEach((row, i) => {
    if (!row.dataset.uid) row.dataset.uid = String(++rowUid);
    const p = state.products[i]!;
    const l = letter(i);
    row.querySelector('[data-letter]')!.textContent = l;
    const name = field(row, 'name') as HTMLInputElement;
    name.placeholder = `Product ${l}`;
    row.querySelector('[data-name-label]')!.textContent = `Product ${l} name (optional)`;
    const remove = row.querySelector<HTMLButtonElement>('[data-remove]')!;
    remove.hidden = state.products.length <= MIN_ROWS;
    remove.setAttribute('aria-label', `Remove ${labelOf(i)}`);
    for (const f of ['name', 'price', 'quantity', 'unit'] as Field[]) {
      const input = field(row, f);
      if (input.value !== p[f]) input.value = p[f];
    }
  });
  els.add.disabled = state.products.length >= MAX_TOOL_PRODUCTS;
}

/** Switches currency without recording it as the visitor's own choice. */
function useCurrency(c: CurrencyCode) {
  if (!isToolCurrency(c)) return;
  state.currency = c;
  setCurrency(c, false);
  updateCurrencySymbols();
}

function updateCurrencySymbols() {
  const symbol = currencySymbol(state.currency, locale);
  document.querySelectorAll('[data-tool] [data-cur]').forEach((el) => (el.textContent = symbol));
  els.template.content.querySelectorAll('[data-cur]').forEach((el) => (el.textContent = symbol));
  els.currency.value = state.currency;
}

// ---------------------------------------------------------------- comparison

function autoPer(dimension: Dimension, r: Ok): string {
  if (dimension === 'count') return 'item';
  const small = r.products.every((p) => p.baseQuantity < 1000);
  if (dimension === 'mass') return small ? '100g' : 'kg';
  return small ? '100ml' : 'l';
}

const PER_TOGGLE: Record<string, string> = { '100g': 'kg', kg: '100g', '100ml': 'l', l: '100ml' };

function compute(): Comparison {
  const inputs = state.products.map((p) => ({ ...p }));
  let r = compareProducts(inputs, { localeDecimal });
  if (r.status === 'ok') {
    const want = state.per[r.dimension] ?? autoPer(r.dimension, r);
    if (want !== r.perUnit.id) r = compareProducts(inputs, { localeDecimal, perUnitId: want });
  }
  return r;
}

/** Extra decimals so that different unit prices never display the same. */
function distinguishing(values: number[]): number {
  for (let extra = 0; extra < 4; extra++) {
    const shown = values.map((v) => money(v, extra));
    if (!values.some((a, i) => values.some((b, j) => j > i && !isTied(a, b) && shown[i] === shown[j]))) return extra;
  }
  return 4;
}

const FIELD_ORDER: Field[] = ['price', 'quantity', 'unit', 'name'];
const MESSAGES: Record<string, string> = {
  'Enter the package size.': 'Enter the quantity.',
  'Enter the size as a number, like 500, or 6 x 330 for a multipack.': 'Enter the quantity as a number, like 500 or 6 x 330.',
  'The size must be more than zero.': 'The quantity must be more than zero.',
  'The size can’t be negative.': 'The quantity can’t be negative.',
  'That size is too large to compare.': 'That quantity is too large to compare.',
  'Item counts must be whole numbers.': 'Pieces must be a whole number.',
};
const friendly = (m: string) => MESSAGES[m] ?? m;

function renderErrors(r: Comparison) {
  rowEls().forEach((row, i) => {
    const v = r.validations[i];
    const meta = state.meta[i]!;
    const err = row.querySelector<HTMLElement>('[data-err]')!;
    err.id = `pt-err-${row.dataset.uid}`;
    let shown: string | undefined;
    for (const f of FIELD_ORDER) {
      const input = field(row, f);
      const message = v?.errors[f];
      const show = !!message && meta.touched.has(f);
      if (show) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', err.id);
        shown ??= friendly(message);
      } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    }
    err.hidden = !shown;
    err.textContent = shown ?? '';
  });
}

function renderOk(r: Ok): { nodes: HTMLElement[]; summary: string; sticky: string } {
  const per = perLabel(r);
  const best = r.best;
  const bestP = best[0]!;
  const unitStr = (p: RankedProduct) => `${money(p.unitPrice, state.extraDigits)}`;
  const nodes: HTMLElement[] = [];

  if (r.allTied) {
    nodes.push(
      h('p', { class: 'mt-3 inline-flex rounded-full bg-field px-2.5 py-1 text-[12px] font-semibold tracking-[0.06em] text-ink-2 uppercase' }, 'Same value'),
      h('p', { class: 'mt-3 text-[28px] leading-tight font-bold tracking-tight num' }, unitStr(bestP), h('span', { class: 'text-[17px] font-medium text-muted' }, ` / ${per}`)),
      h('p', { class: 'mt-2 text-[15px] leading-relaxed text-ink-2' }, `${listNames(best)} cost exactly the same per ${per}. Pick the pack size that suits you.`),
    );
  } else {
    const runner = r.runnerUp!;
    const saving = (runner.unitPrice - bestP.unitPrice) / runner.unitPrice;
    const atBest = runner.price - runner.extraForThisAmount;
    nodes.push(
      h('p', { class: 'mt-3 inline-flex items-center gap-1.5 rounded-full bg-good-soft px-2.5 py-1 text-[12px] font-semibold tracking-[0.06em] text-good uppercase' }, best.length > 1 ? 'Joint best value' : 'Best value'),
      h('p', { class: 'mt-2.5 text-[22px] leading-tight font-semibold tracking-tight break-words' }, listNames(best)),
      h(
        'p',
        { class: 'mt-1 text-[40px] leading-none font-bold tracking-tight tabular-nums' },
        unitStr(bestP),
        h('span', { class: 'ml-1 text-[18px] font-medium tracking-normal text-muted' }, `/ ${per}`),
      ),
      h('p', { class: 'mt-3 text-[17px] font-semibold text-good' }, `${pct(saving)} cheaper than ${runner.label}`),
      h(
        'p',
        { class: 'mt-1.5 text-[15px] leading-relaxed text-ink-2' },
        `Buying ${qty(runner)} at this price costs ${money(atBest)} instead of ${money(runner.price)}, so you save ${money(runner.extraForThisAmount)} for the same amount.`,
      ),
    );
    const priciest = r.priciest!;
    if (!isTied(priciest.pricePerBase, runner.pricePerBase)) {
      const most = (priciest.unitPrice - bestP.unitPrice) / priciest.unitPrice;
      nodes.push(h('p', { class: 'mt-1 text-[15px] leading-relaxed text-ink-2' }, `It’s ${pct(most)} cheaper than ${priciest.label}, the most expensive.`));
    }
  }

  // All products, cheapest first, with a bar for the price per unit.
  const max = Math.max(...r.ranked.map((p) => p.unitPrice));
  const list = h(
    'ol',
    { class: 'mt-5 grid gap-3 border-t border-hairline pt-4', 'aria-label': `All products, cheapest per ${per} first` },
    ...r.ranked.map((p) =>
      h(
        'li',
        { class: 'ui-fade' },
        h(
          'div',
          { class: 'flex items-baseline justify-between gap-3' },
          h(
            'span',
            { class: 'min-w-0' },
            h('span', { class: 'block truncate text-[15px] font-semibold' }, `${letter(p.index)} · ${p.label}`),
            h('span', { class: 'block text-[13px] text-muted tabular-nums' }, `${money(p.price)} for ${qty(p)}`),
          ),
          h(
            'span',
            { class: 'shrink-0 text-right' },
            h('span', { class: 'block text-[15px] font-semibold tabular-nums' }, `${unitStr(p)} / ${per}`),
            h('span', { class: `block text-[13px] tabular-nums ${p.isBest ? 'font-semibold text-good' : 'text-muted'}` }, p.isBest ? (r.allTied ? 'Same' : 'Best') : `+${pct(p.diffFraction)}`),
          ),
        ),
        h(
          'div',
          { class: 'mt-1.5 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-line', 'aria-hidden': 'true' },
          h('div', { class: `ui-bar h-full rounded-full ${p.isBest ? 'bg-good-fill' : 'bg-ink/25'}`, style: `width:${Math.max(4, (p.unitPrice / max) * 100)}%` }),
        ),
      ),
    ),
  );
  nodes.push(list);

  // Lowest price tag, which isn't always the best value.
  const cheapestTag = [...r.products].sort((a, b) => a.price - b.price || a.index - b.index)[0]!;
  if (!r.allTied && !cheapestTag.isBest) {
    nodes.push(
      h(
        'p',
        { class: 'mt-4 rounded-xl bg-white px-3.5 py-3 text-[14px] leading-relaxed text-ink-2 ring-1 ring-line' },
        `Cheapest to buy now: ${cheapestTag.label} at ${money(cheapestTag.price)}. But it costs more for the same amount (${unitStr(cheapestTag)} per ${per}).`,
      ),
    );
  }

  // Show me why: the arithmetic in plain language.
  const target = r.perUnit.unit.symbol === 'items' ? 'pieces' : r.dimension === 'mass' ? 'the same weight unit' : 'the same volume unit';
  const why = h(
    'details',
    { class: 'why' },
    h('summary', null, 'Show me why'),
    h(
      'p',
      { class: 'mt-2 leading-relaxed' },
      r.dimension === 'count'
        ? 'Each price is divided by the number of pieces, so every product is compared at the price of one piece.'
        : `Each quantity is converted to ${target}, then the price is divided by it and shown per ${per}. That compares every product at the price of the same amount.`,
    ),
    h(
      'ul',
      null,
      ...r.products.map((p) => h('li', null, `${p.label}: ${money(p.price)} ÷ ${qty(p)} = ${unitStr(p)} per ${per}`)),
      ...(!r.allTied && r.runnerUp
        ? [h('li', { class: 'font-medium text-ink' }, `Difference: ${money(r.runnerUp.unitPrice - bestP.unitPrice, state.extraDigits)} per ${per}`)]
        : []),
    ),
  );
  nodes.push(why);

  const skipped = r.skipped.length ? `${r.skipped.map((i) => `Product ${letter(i)}`).join(' and ')} is empty and left out.` : '';
  if (skipped) nodes.push(h('p', { class: 'mt-3 text-[13px] text-muted' }, skipped));

  const summary = r.allTied
    ? `Same value: ${listNames(best)} cost ${unitStr(bestP)} per ${per}.`
    : `Best value: ${listNames(best)}, ${unitStr(bestP)} per ${per}, ${pct((r.runnerUp!.unitPrice - bestP.unitPrice) / r.runnerUp!.unitPrice)} cheaper than ${r.runnerUp!.label}.`;
  const sticky = r.allTied
    ? `Same value · ${unitStr(bestP)}/${per}`
    : `${listNames(best)} · ${unitStr(bestP)}/${per} · ${pct((r.runnerUp!.unitPrice - bestP.unitPrice) / r.runnerUp!.unitPrice)} cheaper`;
  return { nodes, summary, sticky };
}

function listNames(products: RankedProduct[]): string {
  const names = products.map((p) => p.label);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function renderNotOk(r: Exclude<Comparison, Ok>): HTMLElement[] {
  if (r.status === 'mismatch') {
    const parts = r.groups.map((g) => `${g.labels.join(', ')} ${g.labels.length > 1 ? 'are' : 'is'} measured by ${g.dimension === 'mass' ? 'weight' : g.dimension === 'volume' ? 'volume' : 'pieces'}`);
    return [
      h(
        'div',
        { class: 'ui-fade mt-3 rounded-[14px] bg-warn-soft p-4 text-[15px] leading-relaxed text-warn' },
        h('p', { class: 'font-semibold' }, 'These can’t be compared'),
        h('p', { class: 'mt-1' }, `${parts.join(', but ')}. Weight, volume and pieces can’t be converted into each other, so use the same kind of unit for every product.`),
      ),
    ];
  }
  // Point at the first thing that's missing, even before the shopper leaves the field.
  const filled = r.validations.filter((v) => !v.empty);
  const firstError = filled.find((v) => Object.keys(v.errors).length > 0);
  let text: string;
  if (firstError) {
    const f = FIELD_ORDER.find((x) => firstError.errors[x])!;
    text = `${firstError.label}: ${friendly(firstError.errors[f]!).replace(/^Enter/, 'enter').replace(/^The/, 'the')}`;
  } else if (filled.length === 1) {
    text = 'Add a price and quantity for one more product to compare.';
  } else {
    text = 'Add a price and quantity for two products. The better buy shows up here as you type.';
  }
  return [h('p', { class: 'mt-3 text-[15px] leading-relaxed text-muted' }, text)];
}

let lastResultKey = '';
function render() {
  syncRows();
  const r = compute();
  state.result = r;
  renderErrors(r);

  let summary = '';
  let sticky = '';
  let nodes: HTMLElement[];
  if (r.status === 'ok') {
    state.extraDigits = distinguishing(r.products.map((p) => p.unitPrice));
    ({ nodes, summary, sticky } = renderOk(r));
    els.per.hidden = r.dimension === 'count';
    els.per.textContent = `per ${perLabel(r)} ⇄`;
    const other = PER_TOGGLE[r.perUnit.id];
    els.per.setAttribute('aria-label', `Showing price per ${perLabel(r)}. Switch to per ${other === 'l' ? 'litre' : other === 'kg' ? 'kilogram' : other === '100g' ? '100 grams' : '100 millilitres'}`);
  } else {
    nodes = renderNotOk(r);
    els.per.hidden = true;
  }
  // Only rebuild when something visible changed, so the page doesn't flicker while typing.
  const key = JSON.stringify([r.status, summary, nodes.map((n) => n.textContent)]);
  if (key !== lastResultKey) {
    els.result.replaceChildren(...nodes);
    lastResultKey = key;
  }
  els.actions.hidden = r.status !== 'ok';
  els.stickyText.textContent = sticky;
  stickyWanted = r.status === 'ok';
  updateSticky();
  announce(summary);
  scheduleSave(r.status === 'ok');
}

// ---------------------------------------------------------------- announcements & toast

let announceTimer = 0;
let lastAnnounced = '';
function announce(text: string) {
  window.clearTimeout(announceTimer);
  announceTimer = window.setTimeout(() => {
    if (text && text !== lastAnnounced) els.live.textContent = text;
    lastAnnounced = text;
  }, 1000);
}

let toastTimer = 0;
export function toast(text: string) {
  els.toast.textContent = text;
  els.toast.hidden = false;
  els.live.textContent = text;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (els.toast.hidden = true), 2200);
}

// ---------------------------------------------------------------- sticky summary (phones)

let stickyWanted = false;
let resultVisible = true;
function updateSticky() {
  const show = stickyWanted && !resultVisible;
  els.sticky.dataset.show = String(show);
  els.sticky.setAttribute('aria-hidden', String(!show));
  els.sticky.tabIndex = show ? 0 : -1;
}
new IntersectionObserver(
  ([entry]) => {
    resultVisible = !!entry?.isIntersecting;
    updateSticky();
  },
  { threshold: 0.15 },
).observe(els.resultSection);

els.sticky.addEventListener('click', () => {
  els.resultSection.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  els.resultTitle.focus({ preventScroll: true });
});

// ---------------------------------------------------------------- saving: draft + recents

let saveTimer = 0;
let recentTimer = 0;
function scheduleSave(ok: boolean) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const snap = snapshot();
    write(KEYS.draft, snap.products.every(isBlank) ? null : JSON.stringify({ ...snap, savedAt: Date.now() }));
  }, 400);
  window.clearTimeout(recentTimer);
  if (ok) {
    // Only keep comparisons the shopper has paused on, not every keystroke.
    recentTimer = window.setTimeout(() => {
      const list = addRecent(parseRecents(read(KEYS.recents)), snapshot());
      write(KEYS.recents, JSON.stringify(list));
      renderRecents();
    }, 2500);
  }
}

function recentTitle(r: RecentComparison): string {
  const named = r.products.map((p) => p.name.trim()).filter(Boolean);
  if (named.length) return [...new Set(named)].join(' vs ');
  return r.products.map((p) => `${p.quantity} ${TOOL_UNIT_LABELS[p.unit]}`).join(' vs ');
}

function renderRecents() {
  const list = parseRecents(read(KEYS.recents));
  const current = signature(snapshot());
  const items = list.filter((r) => signature(r) !== current);
  els.recentsWrap.hidden = items.length === 0;
  els.recents.replaceChildren(
    ...items.map((r) => {
      const when = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(r.savedAt);
      const button = h(
        'button',
        { type: 'button', class: 'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-subtle' },
        h('span', { class: 'min-w-0 flex-1' }, h('span', { class: 'block truncate text-[15px] font-medium' }, recentTitle(r)), h('span', { class: 'block text-[13px] text-muted' }, `${r.products.length} products · ${when}`)),
              );
      button.addEventListener('click', () => {
        loadSnapshot(r);
        toast('Comparison restored');
        els.resultSection.scrollIntoView({ block: 'nearest' });
      });
      const del = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete “${recentTitle(r)}” from history` }, '×');
      del.addEventListener('click', () => {
        write(KEYS.recents, JSON.stringify(list.filter((x) => x !== r)));
        renderRecents();
        toast('Removed from history');
      });
      return h('li', { class: 'flex items-center pr-1' }, button, del);
    }),
  );
}

els.recentsClear.addEventListener('click', () => {
  write(KEYS.recents, null);
  renderRecents();
  toast('History cleared');
});

function loadSnapshot(snap: ToolSnapshot) {
  state.beforeQuick = null;
  setProducts(snap.products);
  if (isToolCurrency(snap.currency)) useCurrency(snap.currency);
  els.quick.value = '';
  autoGrow();
  setQuickHint('');
  updateCurrencySymbols();
  render();
}

// ---------------------------------------------------------------- quick entry

const DEFAULT_HINT = els.quickHint.textContent ?? '';
function setQuickHint(text: string, tone: 'muted' | 'good' = 'muted') {
  els.quickHint.textContent = text || DEFAULT_HINT;
  els.quickHint.classList.toggle('text-good', tone === 'good' && !!text);
  els.quickHint.classList.toggle('text-muted', !(tone === 'good' && text));
}

function autoGrow() {
  els.quick.style.height = 'auto';
  els.quick.style.height = `${Math.min(els.quick.scrollHeight, 160)}px`;
}

function fromSmart(p: SmartProduct, fallbackUnit: ToolUnit): ToolProduct {
  const n = (v: number) => String(Number(v.toPrecision(12)));
  const quantity = p.quantity === undefined ? '' : p.factors.length > 1 ? p.factors.map(n).join(' x ') : n(p.quantity);
  return { name: p.name, price: p.price === undefined ? '' : n(p.price), quantity, unit: p.unit && isToolUnit(p.unit) ? p.unit : fallbackUnit };
}

let quickTimer = 0;
function applyQuick() {
  const text = els.quick.value;
  if (!text.trim()) {
    setQuickHint('');
    // Clearing the box brings back whatever was in the list before.
    if (state.beforeQuick) {
      state.products = state.beforeQuick.products;
      state.meta = state.beforeQuick.meta;
      state.beforeQuick = null;
      render();
    }
    return;
  }
  state.beforeQuick ??= { products: state.products.map((p) => ({ ...p })), meta: state.meta };
  const parsed = parseShoppingText(text);
  if (parsed.products.length === 0) {
    setQuickHint('Keep typing: add a price and a quantity, like “2kg for 210”.');
    return;
  }
  const rows = parsed.products.slice(0, MAX_TOOL_PRODUCTS).map((p, i, all) => fromSmart(p, all.find((x) => x.unit)?.unit === 'item' ? 'item' : 'g'));
  setProducts(rows);

  if (parsed.currency && !currencyChosen() && parsed.currency !== state.currency) {
    useCurrency(parsed.currency);
  }
  const missing = rows.map((r, i) => (!r.price ? `the price for ${letter(i)}` : !r.quantity ? `the quantity for ${letter(i)}` : '')).filter(Boolean);
  const found = `Found ${rows.length} ${rows.length === 1 ? 'product' : 'products'}`;
  setQuickHint(missing.length ? `${found}. Add ${missing.join(' and ')} below.` : `${found} ✓ Edit any detail below.`, missing.length ? 'muted' : 'good');
  render();
}

els.quick.addEventListener('input', () => {
  autoGrow();
  window.clearTimeout(quickTimer);
  quickTimer = window.setTimeout(applyQuick, 120);
});
els.quick.addEventListener('keydown', (e) => {
  // Enter finishes entry on phones; Shift+Enter still adds a new line.
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    window.clearTimeout(quickTimer);
    applyQuick();
    els.quick.blur();
  }
});

// ---------------------------------------------------------------- row events

function rowIndex(target: Element): number {
  const row = target.closest<HTMLElement>('[data-row]');
  return row ? rowEls().indexOf(row as HTMLLIElement) : -1;
}

function onFieldEdit(e: Event) {
  const target = e.target as HTMLInputElement | HTMLSelectElement;
  const f = target.dataset.f as Field | undefined;
  const i = rowIndex(target);
  if (!f || i < 0) return;
  const value = f === 'unit' ? (isToolUnit(target.value) ? target.value : 'g') : target.value;
  state.products[i] = { ...state.products[i]!, [f]: value };
  handOff();
  render();
}

/**
 * Changing the list directly (editing, adding, removing, scanning) takes the
 * products over from the quick-entry box, so its text can't overwrite them.
 */
function handOff() {
  if (!state.beforeQuick) return;
  state.beforeQuick = null;
  window.clearTimeout(quickTimer);
  els.quick.value = '';
  autoGrow();
  setQuickHint('Products moved to the list. Edit them there.');
}

els.rows.addEventListener('input', onFieldEdit);
els.rows.addEventListener('change', (e) => {
  if ((e.target as Element).matches('select')) onFieldEdit(e);
});
els.rows.addEventListener('focusout', (e) => {
  const target = e.target as HTMLElement;
  const f = target.dataset.f as Field | undefined;
  const i = rowIndex(target);
  if (!f || i < 0) return;
  state.meta[i]!.touched.add(f);
  render();
});
els.rows.addEventListener('click', (e) => {
  const button = (e.target as Element).closest('[data-remove]');
  if (!button) return;
  const i = rowIndex(button);
  if (i < 0 || state.products.length <= MIN_ROWS) return;
  const label = labelOf(i);
  handOff();
  state.products.splice(i, 1);
  state.meta.splice(i, 1);
  render();
  toast(`${label} removed`);
  const rows = rowEls();
  const next = rows[Math.min(i, rows.length - 1)]!;
  const nextRemove = next.querySelector<HTMLButtonElement>('[data-remove]')!;
  (nextRemove.hidden ? els.add : nextRemove).focus();
});

function addRow(product?: ToolProduct): number {
  if (state.products.length >= MAX_TOOL_PRODUCTS) {
    toast(`You can compare up to ${MAX_TOOL_PRODUCTS} products`);
    return -1;
  }
  handOff();
  state.products.push(product ?? emptyProduct(state.products.at(-1)?.unit));
  state.meta.push(newMeta());
  render();
  return state.products.length - 1;
}

els.add.addEventListener('click', () => {
  const i = addRow();
  if (i >= 0) field(rowEls()[i]!, 'price').focus();
});

els.reset.addEventListener('click', () => {
  state.beforeQuick = null;
  setProducts([]);
  state.per = {};
  els.quick.value = '';
  autoGrow();
  setQuickHint('');
  write(KEYS.draft, null);
  render();
  toast('Cleared');
  els.quick.focus();
});

// The shared picker stores the visitor's choice; follow it here.
initCurrency();
onCurrency((c) => {
  state.currency = c;
  updateCurrencySymbols();
  render();
});

els.per.addEventListener('click', () => {
  const r = state.result;
  if (r?.status !== 'ok') return;
  const next = PER_TOGGLE[r.perUnit.id];
  if (!next) return;
  state.per[r.dimension] = next;
  render();
});

// ---------------------------------------------------------------- share

els.share.addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#${encodeShare(snapshot())}`;
  const r = state.result;
  const text = r?.status === 'ok' && !r.allTied ? `${listNames(r.best)} is the better buy` : 'Price comparison';
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: 'CheaperPack comparison', text, url });
      return;
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    window.prompt('Copy this link', url);
  }
});

// ---------------------------------------------------------------- scanner (lazy)

let scannerModule: Promise<typeof import('./scanner')> | null = null;
let scannerReady = false;
let pendingPhoto: File | undefined;

// On a slow connection a photo can be picked before the scanner script has
// loaded; keep it and hand it over once it's ready.
els.scanner.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (!scannerReady && input.type === 'file') pendingPhoto = input.files?.[0];
});

els.scan.addEventListener('click', async () => {
  els.scanner.showModal();
  scannerModule ??= import('./scanner');
  try {
    const mod = await scannerModule;
    scannerReady = true;
    const photo = pendingPhoto;
    pendingPhoto = undefined;
    mod.startScanner({
      dialog: els.scanner,
      currencySymbol: (currency) => currencySymbol(currency ?? state.currency, locale),
      formatMoney: (v, currency) => money(v, 0, currency ?? state.currency),
      onAdd: addScanned,
      photo,
    });
  } catch {
    scannerModule = null;
    toast('The scanner couldn’t load. Check your connection, or enter the details by hand.');
    els.scanner.close();
  }
});

function addScanned(product: ToolProduct, currencyHint?: CurrencyCode) {
  handOff();
  if (currencyHint && !currencyChosen() && currencyHint !== state.currency && isToolCurrency(currencyHint)) {
    useCurrency(currencyHint);
  }
  const blank = state.products.findIndex(isBlank);
  let i: number;
  if (blank >= 0) {
    state.products[blank] = product;
    state.meta[blank] = newMeta();
    i = blank;
    render();
  } else {
    i = addRow(product);
  }
  if (i < 0) return;
  toast(`Added as Product ${letter(i)}`);
  const row = rowEls()[i];
  row?.classList.remove('ui-enter');
  void row?.offsetWidth;
  row?.classList.add('ui-enter');
  row?.scrollIntoView({ block: 'nearest' });
}

// ---------------------------------------------------------------- start

/** Loads a comparison from a share link (#v=1&...), if the address has one. */
function loadFromHash(): boolean {
  const shared = decodeShare(location.hash);
  if (!shared) return false;
  state.beforeQuick = null;
  setProducts(shared.products);
  if (isToolCurrency(shared.currency)) useCurrency(shared.currency);
  els.quick.value = '';
  setQuickHint('');
  // The products now live on the page; keep the address clean for further edits.
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}

// Example links on this page change only the hash.
window.addEventListener('hashchange', () => {
  if (!loadFromHash()) return;
  updateCurrencySymbols();
  autoGrow();
  render();
  root.scrollIntoView({ block: 'start' });
  toast('Example loaded');
});

function start() {
  if (!loadFromHash()) {
    try {
      const draft = JSON.parse(read(KEYS.draft) ?? 'null') as (ToolSnapshot & { savedAt: number }) | null;
      if (draft && Date.now() - draft.savedAt < DRAFT_MAX_AGE && Array.isArray(draft.products)) {
        const products = draft.products.filter((p) => p && isToolUnit(p.unit) && typeof p.price === 'string');
        if (products.length) setProducts(products);
        if (isToolCurrency(draft.currency)) useCurrency(draft.currency);
      }
    } catch {
      // Ignore a damaged draft.
    }
  }
  updateCurrencySymbols();
  autoGrow();
  render();
  renderRecents();
}

start();
