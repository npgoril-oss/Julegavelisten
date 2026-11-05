import { describe, expect, it } from 'vitest';
import { availableYears, budgetState, isGiftDone, plannedSum, purchasedSum, summarize } from './logic';
import { reducer, emptyData } from './store';
import type { Gift, Item } from './types';

const item = (price: number, purchased = false, received = false): Item => ({
  id: Math.random().toString(),
  name: 'x',
  price,
  note: '',
  link: '',
  purchased,
  received,
});
const gift = (budget: number | null, items: Item[], extra: Partial<Gift> = {}): Gift => ({
  id: 'g',
  personId: 'p',
  year: 2026,
  title: '',
  budget,
  wrapped: false,
  items,
  ...extra,
});

describe('summer', () => {
  it('summerer bare kjøpte items i kjøpt sum', () => {
    const g = gift(500, [item(200, true), item(150, false)]);
    expect(purchasedSum(g)).toBe(200);
    expect(plannedSum(g)).toBe(350);
  });
});

describe('ferdig-status (alt kjøpt, uavhengig av budsjett)', () => {
  it('er ferdig når alt er kjøpt, selv godt under budsjett', () => {
    expect(isGiftDone(gift(500, [item(100, true)]))).toBe(true);
  });
  it('er ikke ferdig når ikke alt er kjøpt', () => {
    expect(isGiftDone(gift(500, [item(500, true), item(10, false)]))).toBe(false);
  });
  it('tom gave er aldri ferdig', () => {
    expect(isGiftDone(gift(0, []))).toBe(false);
  });
});

describe('budsjettindikator (± 100 kr)', () => {
  it('under, innenfor og over', () => {
    expect(budgetState(gift(500, [item(399, true)]))).toBe('under');
    expect(budgetState(gift(500, [item(400, true)]))).toBe('within');
    expect(budgetState(gift(500, [item(600, true)]))).toBe('within');
    expect(budgetState(gift(500, [item(601, true)]))).toBe('over');
    expect(budgetState(gift(null, [item(601, true)]))).toBe('none');
  });
  it('teller bare kjøpte items', () => {
    expect(budgetState(gift(500, [item(450, true), item(900, false)]))).toBe('within');
  });
});

describe('årsoppsummering', () => {
  it('skiller kjøpt sum for gaver med og uten budsjett', () => {
    const s = summarize([gift(500, [item(300, true)]), gift(null, [item(200, true)])]);
    expect(s).toMatchObject({ budget: 500, purchasedWithBudget: 300, purchased: 500 });
  });
});

describe('år', () => {
  it('inkluderer inneværende og neste år, pluss år med gaver', () => {
    expect(availableYears([gift(1, [], { year: 2024 })], new Date('2026-11-04'))).toEqual([2027, 2026, 2024]);
  });
  it('personer følger med til nytt år (er ikke knyttet til år)', () => {
    let d = reducer(emptyData(), { type: 'person/add', name: 'Mormor' });
    const pid = d.persons[0].id;
    d = reducer(d, { type: 'gift/add', personId: pid, year: 2026 });
    d = reducer(d, { type: 'gift/add', personId: pid, year: 2027 });
    expect(d.persons).toHaveLength(1);
    expect(summarize(d.gifts.filter((g) => g.year === 2027)).gifts).toBe(1);
  });
});

describe('item-avkrysning', () => {
  it('mottatt setter også kjøpt, og fjernet kjøpt fjerner mottatt', () => {
    let d = reducer(emptyData(), { type: 'person/add', name: 'A' });
    d = reducer(d, { type: 'gift/add', personId: d.persons[0].id, year: 2026 });
    const gid = d.gifts[0].id;
    d = reducer(d, { type: 'item/add', giftId: gid });
    const iid = d.gifts[0].items[0].id;
    d = reducer(d, { type: 'item/update', giftId: gid, id: iid, patch: { received: true } });
    expect(d.gifts[0].items[0]).toMatchObject({ purchased: true, received: true });
    d = reducer(d, { type: 'item/update', giftId: gid, id: iid, patch: { purchased: false } });
    expect(d.gifts[0].items[0]).toMatchObject({ purchased: false, received: false });
  });
});

describe('flytte ting mellom gaver', () => {
  const setup = () => {
    let d = reducer(emptyData(), { type: 'person/add', name: 'A' });
    d = reducer(d, { type: 'person/add', name: 'B' });
    d = reducer(d, { type: 'gift/add', personId: d.persons[0].id, year: 2026, id: 'g1' });
    d = reducer(d, { type: 'gift/add', personId: d.persons[1].id, year: 2026, id: 'g2' });
    d = reducer(d, { type: 'item/add', giftId: 'g1', id: 'i1' });
    d = reducer(d, { type: 'item/update', giftId: 'g1', id: 'i1', patch: { name: 'Skjerf', price: 250, purchased: true } });
    return d;
  };
  it('flytter item med alle felter til en annen persons gave', () => {
    const d = reducer(setup(), { type: 'item/move', fromGiftId: 'g1', id: 'i1', toGiftId: 'g2' });
    expect(d.gifts.find((g) => g.id === 'g1')!.items).toHaveLength(0);
    expect(d.gifts.find((g) => g.id === 'g2')!.items[0]).toMatchObject({ id: 'i1', name: 'Skjerf', price: 250, purchased: true });
  });
  it('gjør ingenting ved ukjent mål eller samme gave', () => {
    const d = setup();
    expect(reducer(d, { type: 'item/move', fromGiftId: 'g1', id: 'i1', toGiftId: 'finnes-ikke' })).toBe(d);
    expect(reducer(d, { type: 'item/move', fromGiftId: 'g1', id: 'i1', toGiftId: 'g1' })).toBe(d);
  });
});
