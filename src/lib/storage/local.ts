/**
 * localStorage that never throws (private mode, blocked storage, quota).
 * All keys are prefixed with "cheaperpack:".
 */

export const PREFIX = 'cheaperpack:';

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing stored, nothing to remove.
  }
}

/** Removes every CheaperPack entry from localStorage. */
export function clearAllLocal(): number {
  let removed = 0;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
        removed++;
      }
    }
  } catch {
    // Storage unavailable.
  }
  return removed;
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
