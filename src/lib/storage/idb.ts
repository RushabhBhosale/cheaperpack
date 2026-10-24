/**
 * Minimal IndexedDB wrapper for saved receipts. Falls back to localStorage
 * when IndexedDB isn't available (some private browsing modes).
 */

import { readJSON, writeJSON } from './local';

const DB = 'cheaperpack';
const VERSION = 1;
export const RECEIPTS = 'receipts';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RECEIPTS)) db.createObjectStore(RECEIPTS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECEIPTS, mode);
    const req = fn(tx.objectStore(RECEIPTS));
    tx.oncomplete = () => {
      db.close();
      resolve(req ? (req.result as T) : undefined);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

const FALLBACK_KEY = 'receipts-fallback';

export async function getAll<T>(): Promise<T[]> {
  try {
    return ((await run<T[]>('readonly', (s) => s.getAll())) ?? []) as T[];
  } catch {
    return readJSON<T[]>(FALLBACK_KEY, []);
  }
}

export async function put<T extends { id: string }>(value: T): Promise<void> {
  try {
    await run('readwrite', (s) => s.put(value));
  } catch {
    const list = readJSON<T[]>(FALLBACK_KEY, []).filter((v) => v.id !== value.id);
    writeJSON(FALLBACK_KEY, [value, ...list]);
  }
}

export async function remove(id: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(id));
  } catch {
    writeJSON(
      FALLBACK_KEY,
      readJSON<{ id: string }[]>(FALLBACK_KEY, []).filter((v) => v.id !== id),
    );
  }
}

export async function clearAll(): Promise<void> {
  try {
    await run('readwrite', (s) => s.clear());
  } catch {
    writeJSON(FALLBACK_KEY, []);
  }
}

/** Deletes the whole database. Resolves false if another tab keeps it open. */
export function deleteDatabase(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(true);
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
    req.onblocked = () => resolve(false);
  });
}
