/**
 * Recent calculations per tool, kept in this browser only.
 */

import { newId, readJSON, removeKey, writeJSON } from './local';

export interface HistoryEntry<S = unknown> {
  id: string;
  title: string;
  detail: string;
  state: S;
  savedAt: number;
}

export function createHistory<S>(toolId: string, max = 8) {
  const key = `history:${toolId}`;
  const list = (): HistoryEntry<S>[] => {
    const raw = readJSON<unknown>(key, []);
    return Array.isArray(raw) ? (raw.filter((e) => e && typeof e === 'object' && 'state' in e && 'id' in e) as HistoryEntry<S>[]) : [];
  };
  return {
    list,
    /** Adds an entry to the top, replacing one with the same state. */
    add(entry: Pick<HistoryEntry<S>, 'title' | 'detail' | 'state'>, now = Date.now()) {
      const sig = JSON.stringify(entry.state);
      const next = [{ ...entry, id: newId(), savedAt: now }, ...list().filter((e) => JSON.stringify(e.state) !== sig)].slice(0, max);
      writeJSON(key, next);
      return next;
    },
    remove(id: string) {
      writeJSON(
        key,
        list().filter((e) => e.id !== id),
      );
    },
    clear() {
      removeKey(key);
    },
  };
}
