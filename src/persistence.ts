/**
 * Lokal lagring uten server.
 *
 * - IndexedDB er hovedlager (robust, stor kapasitet, omfattes av «varig lagring»).
 * - localStorage er speilkopi: hvis det ene lageret svikter, kan appen hente fra det andre.
 * - navigator.storage.persist() ber nettleseren om ikke å rydde bort data ved lite plass.
 *   På Android/Chrome innvilges dette normalt når appen er installert på hjemskjermen.
 *
 * Ingen data forlater enheten, bortsett fra når brukeren selv tar en sikkerhetskopi.
 */
import type { AppData } from './types';
import { emptyData, parseData } from './store';

export const LEGACY_KEY = 'julegavelisten:v1';
const DB_NAME = 'julegavelisten';
const STORE = 'kv';

export interface BackupMeta {
  lastBackupAt: string | null;
  changesSinceBackup: number;
}
export const emptyMeta = (): BackupMeta => ({ lastBackupAt: null, changesSinceBackup: 0 });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB ikke tilgjengelig'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
const db = () => (dbPromise ??= openDb());

async function idbGet<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function readLegacy(): AppData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? parseData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

const hasContent = (d: AppData | null | undefined): d is AppData => !!d && (d.persons.length > 0 || d.gifts.length > 0);

export interface Loaded {
  data: AppData;
  meta: BackupMeta;
  idbAvailable: boolean;
  /** Hvor dataene kom fra. 'legacy' betyr at de bør skrives til IndexedDB med en gang. */
  source: 'idb' | 'legacy' | 'empty';
}

/** Leser fra IndexedDB, faller tilbake på localStorage (også migrering fra tidligere versjon). */
export async function loadAll(): Promise<Loaded> {
  const legacy = readLegacy();
  try {
    const [stored, meta] = await Promise.all([idbGet<unknown>('data'), idbGet<BackupMeta>('meta')]);
    const fromIdb = stored ? parseData(stored) : null;
    if (hasContent(fromIdb)) return { data: fromIdb, meta: meta ?? emptyMeta(), idbAvailable: true, source: 'idb' };
    if (hasContent(legacy)) return { data: legacy, meta: meta ?? emptyMeta(), idbAvailable: true, source: 'legacy' };
    return { data: fromIdb ?? emptyData(), meta: meta ?? emptyMeta(), idbAvailable: true, source: 'empty' };
  } catch {
    return { data: legacy ?? emptyData(), meta: emptyMeta(), idbAvailable: false, source: 'legacy' };
  }
}

/** Lagrer til begge lagre. Kaster bare hvis begge feiler. */
export async function saveData(data: AppData): Promise<void> {
  let localOk = true;
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
  } catch {
    localOk = false;
  }
  try {
    await idbSet('data', data);
  } catch (err) {
    if (!localOk) throw err;
  }
}

export async function saveMeta(meta: BackupMeta): Promise<void> {
  try {
    await idbSet('meta', meta);
  } catch {
    /* metadata er ikke kritisk */
  }
}

/** Ekstra kopi av nåværende data før gjenoppretting fra fil, i tilfelle feil fil velges. */
export async function saveSafetyCopy(data: AppData): Promise<void> {
  try {
    await idbSet('beforeRestore', { savedAt: new Date().toISOString(), data });
  } catch {
    /* ikke kritisk */
  }
}

export type PersistState = 'granted' | 'denied' | 'unsupported';

export async function requestPersistence(): Promise<PersistState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported';
  try {
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** Skal appen minne om sikkerhetskopi? */
export function needsBackup(meta: BackupMeta, now: Date = new Date()): boolean {
  if (meta.changesSinceBackup === 0) return false;
  if (!meta.lastBackupAt) return meta.changesSinceBackup >= 10;
  const days = (now.getTime() - new Date(meta.lastBackupAt).getTime()) / 86_400_000;
  return days >= 7;
}
