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

describe('ferdig-regel (budsjett ± 100 kr og alt kjøpt)', () => {
  it('er ferdig når alt er kjøpt og sum er innenfor -100 kr', () => {
    expect(isGiftDone(gift(500, [item(400, true)]))).toBe(true);
  });
  it('er ikke ferdig når sum er mer enn 100 kr under budsjett', () => {
    expect(isGiftDone(gift(500, [item(399, true)]))).toBe(false);
  });
  it('er ikke ferdig når ikke alt er kjøpt', () => {
    expect(isGiftDone(gift(500, [item(500, true), item(10, false)]))).toBe(false);
  });
  it('er ferdig men markert over budsjett ved overskridelse', () => {
    const g = gift(500, [item(700, true)]);
    expect(isGiftDone(g)).toBe(true);
    expect(budgetState(g)).toBe('over');
  });
  it('grensen +100 regnes som innenfor', () => {
    expect(budgetState(gift(500, [item(600, true)]))).toBe('within');
  });
  it('uten budsjett er gaven ferdig når alt er kjøpt', () => {
    expect(isGiftDone(gift(null, [item(100, true)]))).toBe(true);
  });
  it('tom gave er aldri ferdig', () => {
    expect(isGiftDone(gift(0, []))).toBe(false);
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
