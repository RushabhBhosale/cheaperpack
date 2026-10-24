/**
 * Wires a calculator page together: live results as you type, validation
 * after leaving a field, currency changes, Reset, Share links and local
 * history of recent calculations.
 *
 * Page markup (see components/shared/ResultPanel.astro):
 *   [data-tool] root with inputs, [data-result], [data-actions], [data-share],
 *   [data-reset], [data-history] with [data-history-list] and [data-history-clear],
 *   [data-live] polite live region.
 */

import { createHistory, type HistoryEntry } from '../storage/history';
import { initCurrency, locale, onCurrency } from './currency';
import { debounce, h } from './dom';
import { decodeState, encodeState, shareLink, toast } from './share';

export type Outcome = { ok: true; title: string; detail: string; announce: string; nodes: Node[] } | { ok: false; nodes: Node[] };

export interface ToolSpec<S> {
  id: string;
  root: HTMLElement;
  /** Reads the current inputs as plain, serialisable data. */
  read(): S;
  /** Puts saved or shared data back into the inputs. */
  write(state: S): void;
  /** Validates, calculates and returns what to show. `force` shows every validation error. */
  evaluate(state: S, force: boolean): Outcome;
  /** Fresh inputs for Reset. */
  defaults(): S;
  /** Share links: false for private data. */
  shareable?: boolean;
  /** Keep recent calculations. */
  history?: boolean;
  /** Called after each update, e.g. to refresh row labels. */
  afterUpdate?: (outcome: Outcome) => void;
}

export function mountTool<S>(spec: ToolSpec<S>) {
  const page = document;
  const result = page.querySelector<HTMLElement>('[data-result]')!;
  const actions = page.querySelector<HTMLElement>('[data-actions]');
  const live = page.querySelector<HTMLElement>('[data-live]');
  const historyBox = page.querySelector<HTMLElement>('[data-history]');
  const historyList = page.querySelector<HTMLElement>('[data-history-list]');
  const history = spec.history === false ? null : createHistory<S>(spec.id);
  let last: Outcome = { ok: false, nodes: [] };
  let lastKey = '';

  const announce = debounce((text: string) => {
    if (live && text && live.textContent !== text) live.textContent = text;
  }, 900);

  const saveHistory = debounce(() => {
    if (!history || !last.ok) return;
    history.add({ title: last.title, detail: last.detail, state: spec.read() });
    renderHistory();
  }, 2500);

  function update(force = false) {
    const state = spec.read();
    const outcome = spec.evaluate(state, force);
    last = outcome;
    const key = outcome.nodes.map((n) => (n instanceof Element ? n.outerHTML : n.textContent)).join('');
    if (key !== lastKey) {
      result.replaceChildren(...outcome.nodes);
      lastKey = key;
    }
    if (actions) actions.hidden = !outcome.ok;
    if (outcome.ok) {
      announce(outcome.announce);
      saveHistory();
    }
    spec.afterUpdate?.(outcome);
    updateBar();
  }

  function renderHistory() {
    if (!history || !historyBox || !historyList) return;
    const current = JSON.stringify(spec.read());
    const entries = history.list().filter((e) => JSON.stringify(e.state) !== current);
    historyBox.hidden = entries.length === 0;
    historyList.replaceChildren(...entries.map(historyItem));
  }

  function historyItem(e: HistoryEntry<S>): HTMLElement {
    const when = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(e.savedAt);
    const open = h(
      'button',
      { type: 'button', class: 'min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left transition hover:bg-subtle' },
      h('span', { class: 'block truncate text-[15px] font-medium' }, e.title),
      h('span', { class: 'block truncate text-[13px] text-muted' }, `${e.detail} · ${when}`),
    );
    open.addEventListener('click', () => {
      spec.write(e.state);
      update();
      renderHistory();
      toast('Calculation restored');
      spec.root.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    const del = h(
      'button',
      { type: 'button', class: 'icon-btn', 'aria-label': `Delete “${e.title}” from history` },
      h('span', { 'aria-hidden': 'true', class: 'text-[18px] leading-none' }, '×'),
    );
    del.addEventListener('click', () => {
      history!.remove(e.id);
      renderHistory();
      toast('Removed from history');
    });
    return h('li', { class: 'flex items-center gap-1 pr-1' }, open, del);
  }

  // Events
  // Phones: a compact result bar while the result panel is scrolled out of view.
  const panel = result.closest<HTMLElement>('.result-panel');
  const bar = h(
    'button',
    {
      type: 'button',
      class: 'ui-sticky fixed inset-x-3 bottom-3 z-20 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-white lg:hidden',
      'data-show': 'false',
      'aria-hidden': 'true',
      tabindex: '-1',
      style: 'padding-bottom: max(0.75rem, env(safe-area-inset-bottom))',
    },
    h('span', { class: 'min-w-0 flex-1 truncate text-[15px] font-medium' }),
    h('span', { class: 'text-[13px] text-white/70' }, 'View'),
  );
  document.body.append(bar);
  let panelVisible = true;
  function updateBar() {
    const show = last.ok && !panelVisible;
    bar.dataset.show = String(show);
    bar.setAttribute('aria-hidden', String(!show));
    bar.tabIndex = show ? 0 : -1;
    if (last.ok) bar.firstElementChild!.textContent = last.announce;
  }
  if (panel) {
    new IntersectionObserver(
      ([e]) => {
        panelVisible = !!e?.isIntersecting;
        updateBar();
      },
      { threshold: 0.1 },
    ).observe(panel);
    bar.addEventListener('click', () => {
      panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  }

  const hideExampleNote = () => page.querySelector<HTMLElement>('[data-example-note]')?.setAttribute('hidden', '');
  spec.root.addEventListener('input', () => {
    hideExampleNote();
    update();
  });
  spec.root.addEventListener('change', () => update());
  spec.root.addEventListener('focusout', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches('input, select, textarea')) {
      t.dataset.touched = '1';
      update();
    }
  });
  initCurrency();
  onCurrency(() => update());

  page.querySelector('[data-reset]')?.addEventListener('click', () => {
    hideExampleNote();
    spec.write(spec.defaults());
    for (const el of spec.root.querySelectorAll<HTMLElement>('[data-touched]')) delete el.dataset.touched;
    update();
    toast('Cleared');
    spec.root.querySelector<HTMLElement>('input:not([type=radio]):not([type=checkbox])')?.focus();
  });

  page.querySelector('[data-history-clear]')?.addEventListener('click', () => {
    history?.clear();
    renderHistory();
    toast('History cleared');
  });

  const share = page.querySelector<HTMLButtonElement>('[data-share]');
  if (share) {
    if (spec.shareable === false) share.hidden = true;
    share.addEventListener('click', () => {
      update(true);
      if (!last.ok) return;
      const url = `${location.origin}${location.pathname}#${encodeState(spec.read())}`;
      void shareLink(url, `CheaperPack: ${document.title.split('|')[0]!.trim()}`, last.announce);
    });
  }

  // Start: a shared link wins, otherwise defaults already in the markup.
  const shared = spec.shareable === false ? null : decodeState<S>(location.hash);
  if (shared) {
    hideExampleNote();
    try {
      spec.write(shared);
    } catch {
      spec.write(spec.defaults());
    }
    window.history.replaceState(null, '', location.pathname + location.search);
  }
  window.addEventListener('hashchange', () => {
    const s = decodeState<S>(location.hash);
    if (!s) return;
    spec.write(s);
    window.history.replaceState(null, '', location.pathname + location.search);
    update();
    toast('Example loaded');
    spec.root.scrollIntoView({ block: 'start' });
  });

  update();
  renderHistory();
  return { update };
}
