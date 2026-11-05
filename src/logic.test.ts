import { describe, expect, it } from 'vitest';
import { availableYears, christmasCountdown, budgetState, isGiftDone, plannedSum, purchasedSum, summarize } from './logic';
import { reducer, emptyData, byOrder, parseData } from './store';
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
  order: 0,
  items,
  ...extra,
});

describe('summer', () => {
  it('kjøpt og planlagt (ikke kjøpt) summeres hver for seg', () => {
    const g = gift(500, [item(200, true), item(150, false)]);
    expect(purchasedSum(g)).toBe(200);
    expect(plannedSum(g)).toBe(150);
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

describe('budsjettindikator (± 10 %)', () => {
  it('under, innenfor og over ved budsjett 500 (grense ± 50 kr)', () => {
    expect(budgetState(gift(500, [item(449, true)]))).toBe('under');
    expect(budgetState(gift(500, [item(450, true)]))).toBe('within');
    expect(budgetState(gift(500, [item(550, true)]))).toBe('within');
    expect(budgetState(gift(500, [item(551, true)]))).toBe('over');
    expect(budgetState(gift(null, [item(601, true)]))).toBe('none');
  });
  it('skalerer med budsjettet: 150 kr-budsjett tåler bare ± 15 kr', () => {
    expect(budgetState(gift(150, [item(165, true)]))).toBe('within');
    expect(budgetState(gift(150, [item(219, true)]))).toBe('over');
  });
  it('store budsjett får større slingringsmonn: 3000 kr tåler ± 300 kr', () => {
    expect(budgetState(gift(3000, [item(2700, true)]))).toBe('within');
    expect(budgetState(gift(3000, [item(2699, true)]))).toBe('under');
  });
  it('budsjett 0: alt kjøpt er over', () => {
    expect(budgetState(gift(0, [item(1, true)]))).toBe('over');
    expect(budgetState(gift(0, []))).toBe('within');
  });
  it('teller bare kjøpte items', () => {
    expect(budgetState(gift(500, [item(480, true), item(900, false)]))).toBe('within');
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
  it('kan sette inn på en bestemt plass i målgaven', () => {
    let d = setup();
    d = reducer(d, { type: 'item/add', giftId: 'g2', id: 'a' });
    d = reducer(d, { type: 'item/add', giftId: 'g2', id: 'b' });
    d = reducer(d, { type: 'item/move', fromGiftId: 'g1', id: 'i1', toGiftId: 'g2', index: 1 });
    expect(d.gifts.find((g) => g.id === 'g2')!.items.map((i) => i.id)).toEqual(['a', 'i1', 'b']);
  });
  it('endrer rekkefølge på ting i en gave', () => {
    let d = setup();
    d = reducer(d, { type: 'item/add', giftId: 'g1', id: 'i2' });
    d = reducer(d, { type: 'item/add', giftId: 'g1', id: 'i3' });
    d = reducer(d, { type: 'item/reorder', giftId: 'g1', ids: ['i3', 'i1', 'i2'] });
    expect(d.gifts.find((g) => g.id === 'g1')!.items.map((i) => i.id)).toEqual(['i3', 'i1', 'i2']);
    // ugyldig liste ignoreres
    expect(reducer(d, { type: 'item/reorder', giftId: 'g1', ids: ['i3'] })).toEqual(d);
  });
  it('gjør ingenting ved ukjent mål eller samme gave', () => {
    const d = setup();
    expect(reducer(d, { type: 'item/move', fromGiftId: 'g1', id: 'i1', toGiftId: 'finnes-ikke' })).toBe(d);
    expect(reducer(d, { type: 'item/move', fromGiftId: 'g1', id: 'i1', toGiftId: 'g1' })).toBe(d);
  });
});

describe('sortering', () => {
  const ordered = (d: ReturnType<typeof emptyData>) => [...d.persons].sort(byOrder).map((p) => p.name);
  const setup = () => ['Cecilie', 'Anna', 'Bjørn', 'Dag'].reduce((d, name) => reducer(d, { type: 'person/add', name }), emptyData());

  it('nye personer legges sist', () => {
    expect(ordered(setup())).toEqual(['Cecilie', 'Anna', 'Bjørn', 'Dag']);
  });
  it('reorder setter ny rekkefølge', () => {
    const d = setup();
    const id = (n: string) => d.persons.find((p) => p.name === n)!.id;
    const r = reducer(d, { type: 'person/reorder', ids: ['Dag', 'Anna', 'Bjørn', 'Cecilie'].map(id) });
    expect(ordered(r)).toEqual(['Dag', 'Anna', 'Bjørn', 'Cecilie']);
  });
  it('reorder av en delmengde lar de andre stå på plass', () => {
    const d = setup();
    const id = (n: string) => d.persons.find((p) => p.name === n)!.id;
    // Bjørn er "skjult" (f.eks. arkivert) og er ikke med i listen som sorteres
    const r = reducer(d, { type: 'person/reorder', ids: ['Dag', 'Anna', 'Cecilie'].map(id) });
    expect(ordered(r)).toEqual(['Dag', 'Anna', 'Bjørn', 'Cecilie']);
  });
  it('gaver sorteres per person og år', () => {
    let d = reducer(emptyData(), { type: 'person/add', name: 'A' });
    const pid = d.persons[0].id;
    for (const id of ['g1', 'g2', 'g3']) d = reducer(d, { type: 'gift/add', personId: pid, year: 2026, id });
    d = reducer(d, { type: 'gift/reorder', ids: ['g3', 'g1', 'g2'] });
    expect([...d.gifts].sort(byOrder).map((g) => g.id)).toEqual(['g3', 'g1', 'g2']);
  });
  it('eldre data uten rekkefølge får alfabetisk personrekkefølge', () => {
    const d = parseData({
      persons: [{ id: '1', name: 'Øyvind' }, { id: '2', name: 'Anne' }, { id: '3', name: 'Åse' }],
      gifts: [],
    });
    expect(ordered(d)).toEqual(['Anne', 'Øyvind', 'Åse']);
  });
});

describe('nedtelling til julaften', () => {
  const at = (iso: string) => christmasCountdown(new Date(`${iso}T12:00:00`));
  it('teller hele dager', () => {
    expect(at('2026-11-05')).toEqual({ days: 49, label: '49 dager til julaften' });
    expect(at('2026-12-01').days).toBe(23);
  });
  it('dagen før og selve julen', () => {
    expect(at('2026-12-23').label).toBe('I morgen er det julaften!');
    expect(at('2026-12-24').label).toBe('God jul!');
    expect(at('2026-12-26').label).toBe('God jul!');
  });
  it('etter romjul telles det mot neste år', () => {
    expect(at('2026-12-27').days).toBe(362);
    expect(at('2027-01-01').label).toBe('357 dager til julaften');
  });
});
