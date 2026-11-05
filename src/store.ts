import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  emptyMeta,
  loadAll,
  requestPersistence,
  saveData,
  saveMeta,
  type BackupMeta,
  type PersistState,
} from './persistence';
import type { AppData, Gift, Id, Item, Person } from './types';

export const emptyData = (): AppData => ({ version: 1, persons: [], gifts: [] });

export const newId = (): Id =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export type Action =
  | { type: 'person/add'; name: string }
  | { type: 'person/rename'; id: Id; name: string }
  | { type: 'person/archive'; id: Id; archived: boolean }
  | { type: 'person/delete'; id: Id }
  | { type: 'gift/add'; personId: Id; year: number; id?: Id }
  | { type: 'gift/update'; id: Id; patch: Partial<Pick<Gift, 'title' | 'budget' | 'wrapped'>> }
  | { type: 'gift/delete'; id: Id }
  | { type: 'item/add'; giftId: Id; id?: Id }
  | { type: 'item/update'; giftId: Id; id: Id; patch: Partial<Omit<Item, 'id'>> }
  | { type: 'item/delete'; giftId: Id; id: Id }
  | { type: 'item/move'; fromGiftId: Id; id: Id; toGiftId: Id }
  | { type: 'data/replace'; data: AppData };

const mapGift = (data: AppData, id: Id, fn: (g: Gift) => Gift): AppData => ({
  ...data,
  gifts: data.gifts.map((g) => (g.id === id ? fn(g) : g)),
});

const mapPerson = (data: AppData, id: Id, fn: (p: Person) => Person): AppData => ({
  ...data,
  persons: data.persons.map((p) => (p.id === id ? fn(p) : p)),
});

export function reducer(data: AppData, action: Action): AppData {
  switch (action.type) {
    case 'person/add': {
      const name = action.name.trim();
      if (!name) return data;
      return { ...data, persons: [...data.persons, { id: newId(), name, archived: false }] };
    }
    case 'person/rename':
      return mapPerson(data, action.id, (p) => ({ ...p, name: action.name }));
    case 'person/archive':
      return mapPerson(data, action.id, (p) => ({ ...p, archived: action.archived }));
    case 'person/delete':
      return {
        ...data,
        persons: data.persons.filter((p) => p.id !== action.id),
        gifts: data.gifts.filter((g) => g.personId !== action.id),
      };
    case 'gift/add':
      return {
        ...data,
        gifts: [
          ...data.gifts,
          {
            id: action.id ?? newId(),
            personId: action.personId,
            year: action.year,
            title: '',
            budget: null,
            wrapped: false,
            items: [],
          },
        ],
      };
    case 'gift/update':
      return mapGift(data, action.id, (g) => ({ ...g, ...action.patch }));
    case 'gift/delete':
      return { ...data, gifts: data.gifts.filter((g) => g.id !== action.id) };
    case 'item/add':
      return mapGift(data, action.giftId, (g) => ({
        ...g,
        items: [
          ...g.items,
          { id: action.id ?? newId(), name: '', price: 0, note: '', link: '', purchased: false, received: false },
        ],
      }));
    case 'item/update':
      return mapGift(data, action.giftId, (g) => ({
        ...g,
        items: g.items.map((i) => {
          if (i.id !== action.id) return i;
          const next = { ...i, ...action.patch };
          // Mottatt forutsetter kjøpt; fjernes kjøpt, fjernes også mottatt.
          if (action.patch.received) next.purchased = true;
          if (action.patch.purchased === false) next.received = false;
          return next;
        }),
      }));
    case 'item/delete':
      return mapGift(data, action.giftId, (g) => ({
        ...g,
        items: g.items.filter((i) => i.id !== action.id),
      }));
    case 'item/move': {
      if (action.fromGiftId === action.toGiftId) return data;
      const from = data.gifts.find((g) => g.id === action.fromGiftId);
      const item = from?.items.find((i) => i.id === action.id);
      if (!item || !data.gifts.some((g) => g.id === action.toGiftId)) return data;
      return {
        ...data,
        gifts: data.gifts.map((g) =>
          g.id === action.fromGiftId
            ? { ...g, items: g.items.filter((i) => i.id !== action.id) }
            : g.id === action.toGiftId
              ? { ...g, items: [...g.items, item] }
              : g,
        ),
      };
    }
    case 'data/replace':
      return action.data;
  }
}

/** Validerer og normaliserer data (fra localStorage eller importert fil). */
export function parseData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('Ugyldig dataformat');
  const d = raw as Partial<AppData>;
  if (!Array.isArray(d.persons) || !Array.isArray(d.gifts)) {
    throw new Error('Filen mangler personer eller gaver');
  }
  return {
    version: 1,
    persons: d.persons.map((p) => ({
      id: String(p.id),
      name: String(p.name ?? ''),
      archived: Boolean(p.archived),
    })),
    gifts: d.gifts.map((g) => ({
      id: String(g.id),
      personId: String(g.personId),
      year: Number(g.year),
      title: String(g.title ?? ''),
      budget: g.budget == null ? null : Number(g.budget),
      wrapped: Boolean(g.wrapped),
      items: (Array.isArray(g.items) ? g.items : []).map((i) => ({
        id: String(i.id),
        name: String(i.name ?? ''),
        price: Number(i.price) || 0,
        note: String(i.note ?? ''),
        link: String(i.link ?? ''),
        purchased: Boolean(i.purchased),
        received: Boolean(i.received),
      })),
    })),
  };
}

/**
 * Tilstand + lagring. Data lastes asynkront fra IndexedDB; ingenting lagres før lasting er ferdig,
 * slik at en tom starttilstand aldri kan overskrive lagrede data.
 */
export function useAppData() {
  const [data, dispatch] = useReducer(reducer, undefined, emptyData);
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<BackupMeta>(emptyMeta);
  const [saveError, setSaveError] = useState(false);
  const [idbAvailable, setIdbAvailable] = useState(true);
  const [persist, setPersist] = useState<PersistState | 'pending'>('pending');
  // Data-objekter som ikke skal lagres / ikke telles som endring (identitet sammenlignes).
  const skipSaveRef = useRef<AppData | null>(null);
  const skipCountRef = useRef<AppData | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAll().then((loaded) => {
      if (cancelled) return;
      // Data fra IndexedDB er allerede lagret. Data fra eldre lager skrives over til IndexedDB med en gang.
      if (loaded.source !== 'legacy') skipSaveRef.current = loaded.data;
      skipCountRef.current = loaded.data;
      dispatch({ type: 'data/replace', data: loaded.data });
      setMeta(loaded.meta);
      setIdbAvailable(loaded.idbAvailable);
      setReady(true);
      requestPersistence().then(setPersist);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipSaveRef.current !== data) {
      saveData(data).then(
        () => setSaveError(false),
        () => setSaveError(true),
      );
    }
    if (skipCountRef.current !== data) {
      setMeta((m) => {
        const next = { ...m, changesSinceBackup: m.changesSinceBackup + 1 };
        saveMeta(next);
        return next;
      });
    }
    skipSaveRef.current = null;
    skipCountRef.current = null;
  }, [data, ready]);

  const markBackedUp = useCallback(() => {
    const next = { lastBackupAt: new Date().toISOString(), changesSinceBackup: 0 };
    setMeta(next);
    saveMeta(next);
  }, []);

  /** Gjenoppretter fra sikkerhetskopi. Dataene lagres, og tilsvarer da kopien fra `backedUpAt`. */
  const restore = useCallback((restored: AppData, backedUpAt: string | null) => {
    skipCountRef.current = restored;
    dispatch({ type: 'data/replace', data: restored });
    const next = { lastBackupAt: backedUpAt, changesSinceBackup: backedUpAt ? 0 : 1 };
    setMeta(next);
    saveMeta(next);
  }, []);

  const recheckPersistence = useCallback(() => requestPersistence().then(setPersist), []);

  return { data, dispatch, ready, meta, saveError, idbAvailable, persist, markBackedUp, restore, recheckPersistence };
}
