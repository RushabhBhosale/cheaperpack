/** Building blocks for result panels, so every tool reads the same way. */

import { h, type Child } from './dom';

/** "Show me why": the arithmetic behind a recommendation. */
export function showWhy(lines: Child[], intro?: string, summary = 'Show me why'): HTMLElement {
  return h(
    'details',
    { class: 'why' },
    h('summary', null, summary),
    intro ? h('p', { class: 'mt-2' }, intro) : null,
    h('ul', null, ...lines.map((l) => h('li', null, l))),
  );
}

export function verdict(opts: { badge?: string; title?: Child; value: Child; unit?: string; lines?: Child[]; tone?: 'good' | 'plain' }): HTMLElement {
  return h(
    'div',
    { class: 'ui-fade' },
    opts.badge ? h('p', { class: opts.tone === 'plain' ? 'eyebrow' : 'badge-good' }, opts.badge) : null,
    opts.title ? h('p', { class: 'mt-2.5 text-[20px] leading-tight font-semibold tracking-tight break-words' }, opts.title) : null,
    h(
      'p',
      { class: 'stat mt-1.5 text-[38px] leading-none font-bold' },
      opts.value,
      opts.unit ? h('span', { class: 'ml-1.5 text-[17px] font-medium tracking-normal text-muted' }, opts.unit) : null,
    ),
    ...(opts.lines ?? []).map((l, i) => h('p', { class: i === 0 ? 'mt-3 text-[16px] font-semibold text-good' : 'mt-1.5 text-[15px] leading-relaxed text-ink-2' }, l)),
  );
}

export function stats(items: { label: string; value: Child; note?: Child; strong?: boolean }[]): HTMLElement {
  return h(
    'dl',
    { class: 'mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4' },
    ...items.map((s) =>
      h(
        'div',
        { class: 'min-w-0' },
        h('dt', { class: 'text-[13px] text-muted' }, s.label),
        h('dd', { class: `stat mt-0.5 text-[18px] ${s.strong ? 'font-bold' : 'font-semibold'} break-words` }, s.value),
        s.note ? h('dd', { class: 'text-[13px] text-muted' }, s.note) : null,
      ),
    ),
  );
}

export function empty(text: string): HTMLElement {
  return h('p', { class: 'text-[15px] leading-relaxed text-muted' }, text);
}

export function notice(text: Child, tone: 'warn' | 'bad' | 'info' = 'info'): HTMLElement {
  return h('div', { class: `notice notice-${tone} mt-4` }, text);
}

/** Horizontal bars, e.g. share of spending. Values are already formatted. */
export function bars(items: { label: string; value: string; fraction: number; highlight?: boolean }[]): HTMLElement {
  return h(
    'ul',
    { class: 'mt-3 grid gap-3' },
    ...items.map((b) =>
      h(
        'li',
        null,
        h('div', { class: 'flex items-baseline justify-between gap-3 text-[14px]' }, h('span', { class: 'min-w-0 truncate font-medium' }, b.label), h('span', { class: 'stat shrink-0 text-ink-2' }, b.value)),
        h(
          'div',
          { class: 'mt-1 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-line', 'aria-hidden': 'true' },
          h('div', { class: `ui-bar h-full rounded-full ${b.highlight ? 'bg-good-fill' : 'bg-ink/25'}`, style: `width:${Math.max(2, Math.min(100, b.fraction * 100))}%` }),
        ),
      ),
    ),
  );
}
