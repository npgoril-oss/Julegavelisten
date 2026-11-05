import type { Gift } from './types';

/** Hvor nær budsjettet summen må være for å regnes som «på budsjett», som andel av budsjettet (10 %). */
export const BUDGET_TOLERANCE = 0.1;
export const BUDGET_TOLERANCE_LABEL = '±10 %';

/** Sum av alle items som er kjøpt/bestilt. */
export function purchasedSum(gift: Gift): number {
  return gift.items.reduce((sum, i) => (i.purchased ? sum + i.price : sum), 0);
}

/** Sum av alle items, uavhengig av om de er kjøpt. */
export function plannedSum(gift: Gift): number {
  return gift.items.reduce((sum, i) => sum + i.price, 0);
}

export type BudgetState = 'none' | 'under' | 'within' | 'over';

/**
 * Hvor står kjøpt sum i forhold til budsjettet?
 * - under:  mer enn 10 % under budsjett
 * - within: innenfor budsjett ± 10 %
 * - over:   mer enn 10 % over budsjett
 */
export function budgetState(gift: Gift): BudgetState {
  return compareToBudget(purchasedSum(gift), gift.budget);
}

export function compareToBudget(spent: number, budget: number | null): BudgetState {
  if (budget == null) return 'none';
  const diff = spent - budget;
  const tolerance = budget * BUDGET_TOLERANCE;
  if (diff < -tolerance) return 'under';
  if (diff > tolerance) return 'over';
  return 'within';
}

export function allPurchased(gift: Gift): boolean {
  return gift.items.length > 0 && gift.items.every((i) => i.purchased);
}

export function allReceived(gift: Gift): boolean {
  return gift.items.length > 0 && gift.items.every((i) => i.received);
}

/**
 * En gave er ferdig når alle items er kjøpt/bestilt.
 * Budsjettet påvirker ikke status – det vises kun som indikator (se budgetState).
 */
export function isGiftDone(gift: Gift): boolean {
  return allPurchased(gift);
}

export interface YearSummary {
  gifts: number;
  done: number;
  wrapped: number;
  budget: number;
  /** Kjøpt sum kun for gaver som har budsjett – det som kan sammenlignes med budsjettet. */
  purchasedWithBudget: number;
  purchased: number;
  planned: number;
}

export function summarize(gifts: Gift[]): YearSummary {
  return gifts.reduce<YearSummary>(
    (s, g) => ({
      gifts: s.gifts + 1,
      done: s.done + (isGiftDone(g) ? 1 : 0),
      wrapped: s.wrapped + (g.wrapped ? 1 : 0),
      budget: s.budget + (g.budget ?? 0),
      purchasedWithBudget: s.purchasedWithBudget + (g.budget != null ? purchasedSum(g) : 0),
      purchased: s.purchased + purchasedSum(g),
      planned: s.planned + plannedSum(g),
    }),
    { gifts: 0, done: 0, wrapped: 0, budget: 0, purchasedWithBudget: 0, purchased: 0, planned: 0 },
  );
}

export function currentYear(now: Date = new Date()): number {
  return now.getFullYear();
}

/** Årene som skal være valgbare: alle år med gaver, pluss inneværende og neste år. */
export function availableYears(gifts: Gift[], now: Date = new Date()): number[] {
  const cy = currentYear(now);
  const years = new Set<number>([cy, cy + 1, ...gifts.map((g) => g.year)]);
  return [...years].sort((a, b) => b - a);
}

const fmt = (decimals: number) =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const nokWhole = fmt(0);
const nokCents = fmt(2);

export function formatKr(amount: number): string {
  return (Number.isInteger(amount) ? nokWhole : nokCents).format(amount);
}

/**
 * Nedtelling til julaften (24. desember), regnet i hele kalenderdager i lokal tid.
 * 24.–26. desember gir «God jul!». Etter romjul telles det mot neste julaften.
 */
export function christmasCountdown(now: Date = new Date()): { days: number; label: string } {
  const y = now.getFullYear();
  const today = new Date(y, now.getMonth(), now.getDate());
  if (now.getMonth() === 11 && now.getDate() >= 24 && now.getDate() <= 26) return { days: 0, label: 'God jul!' };
  let eve = new Date(y, 11, 24);
  if (today > eve) eve = new Date(y + 1, 11, 24);
  const days = Math.round((eve.getTime() - today.getTime()) / 86_400_000);
  if (days === 1) return { days, label: 'I morgen er det julaften!' };
  return { days, label: `${days} dager til julaften` };
}
