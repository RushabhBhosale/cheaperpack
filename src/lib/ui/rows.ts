/**
 * Repeating groups of fields (deals, products, appliances…) cloned from a
 * <template>, with add/remove and letter labels.
 */

import { readForm, writeForm } from './fields';
import { letter } from './dom';

export interface RowListOptions {
  list: HTMLElement;
  template: HTMLTemplateElement;
  min: number;
  max: number;
  addButton?: HTMLButtonElement | null;
  /** Noun for labels, e.g. "Deal" gives "Deal A". */
  noun: string;
  onChange: () => void;
}

export class RowList {
  constructor(private o: RowListOptions) {
    o.addButton?.addEventListener('click', () => {
      const row = this.add();
      row?.querySelector<HTMLElement>('input, select')?.focus();
      o.onChange();
    });
    o.list.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest('[data-remove]');
      if (!btn) return;
      const row = btn.closest<HTMLElement>('[data-row]')!;
      const index = this.rows().indexOf(row);
      this.remove(row);
      o.onChange();
      const rows = this.rows();
      const next = rows[Math.min(index, rows.length - 1)]?.querySelector<HTMLButtonElement>('[data-remove]:not([hidden])');
      (next ?? o.addButton)?.focus();
    });
  }

  rows(): HTMLElement[] {
    return [...this.o.list.querySelectorAll<HTMLElement>(':scope > [data-row]')];
  }

  add(values?: Record<string, string>): HTMLElement | null {
    if (this.rows().length >= this.o.max) return null;
    const row = this.o.template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    this.o.list.append(row);
    if (values) writeForm(row, values);
    this.relabel();
    return row;
  }

  remove(row: HTMLElement) {
    if (this.rows().length <= this.o.min) return;
    row.remove();
    this.relabel();
  }

  read(): Record<string, string>[] {
    return this.rows().map((r) => readForm(r));
  }

  write(values: Record<string, string>[]) {
    for (const r of this.rows()) r.remove();
    const list = values.length ? values : [];
    for (const v of list.slice(0, this.o.max)) this.add(v);
    while (this.rows().length < this.o.min) this.add();
    this.relabel();
  }

  relabel() {
    const rows = this.rows();
    rows.forEach((row, i) => {
      const name = `${this.o.noun} ${letter(i)}`;
      row.querySelectorAll('[data-row-letter]').forEach((el) => (el.textContent = letter(i)));
      row.querySelectorAll('[data-row-name]').forEach((el) => (el.textContent = name));
      row.querySelectorAll<HTMLInputElement>('[data-row-placeholder]').forEach((el) => (el.placeholder = name));
      const rm = row.querySelector<HTMLButtonElement>('[data-remove]');
      if (rm) {
        rm.hidden = rows.length <= this.o.min;
        rm.setAttribute('aria-label', `Remove ${name}`);
      }
      // Radio groups in a row need a unique name.
      row.querySelectorAll<HTMLInputElement>('input[type=radio][data-k]').forEach((el) => (el.name = `${el.dataset.k}-${i}`));
    });
    if (this.o.addButton) this.o.addButton.disabled = rows.length >= this.o.max;
  }
}
