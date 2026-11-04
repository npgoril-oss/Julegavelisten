import type { Gift } from './types';

/** Hvor nær budsjettet (i kr) summen må være for at budsjettet regnes som nådd. */
export const BUDGET_TOLERANCE = 100;

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
 * - under:  mer enn 100 kr under budsjett
 * - within: innenfor budsjett ± 100 kr
 * - over:   mer enn 100 kr over budsjett
 */
export function budgetState(gift: Gift): BudgetState {
  if (gift.budget == null) return 'none';
  const diff = purchasedSum(gift) - gift.budget;
  if (diff < -BUDGET_TOLERANCE) return 'under';
  if (diff > BUDGET_TOLERANCE) return 'over';
  return 'within';
}

export function allPurchased(gift: Gift): boolean {
  return gift.items.length > 0 && gift.items.every((i) => i.purchased);
}

export function allReceived(gift: Gift): boolean {
  return gift.items.length > 0 && gift.items.every((i) => i.received);
}

/**
 * En gave er ferdig når alle items er kjøpt og budsjettet er nådd (minst budsjett − 100 kr).
 * Overskridelse hindrer ikke "ferdig", men vises som varsel.
 * Uten budsjett er gaven ferdig når alle items er kjøpt.
 */
export function isGiftDone(gift: Gift): boolean {
  if (!allPurchased(gift)) return false;
  const state = budgetState(gift);
  return state === 'none' || state === 'within' || state === 'over';
}

export interface YearSummary {
  gifts: number;
  done: number;
  wrapped: number;
  budget: number;
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
      purchased: s.purchased + purchasedSum(g),
      planned: s.planned + plannedSum(g),
    }),
    { gifts: 0, done: 0, wrapped: 0, budget: 0, purchased: 0, planned: 0 },
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
