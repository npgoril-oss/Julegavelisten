import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Gift } from './types';
import { BUDGET_TOLERANCE_LABEL, compareToBudget, formatKr, type BudgetState } from './logic';

/**
 * Felt som skal få fokus når det monteres (ny ting, ny gave, flyttet ting).
 * Gir tastatur- og skjermleserbrukere en naturlig flyt etter «Legg til» og «Flytt».
 */
export const focusRequest: { id: string | null } = { id: null };

export function useFocusOnCreate<T extends HTMLElement>(id: string): RefObject<T | null> {
  // Tom id = aldri fokus.
  const ref = useRef<T>(null);
  useEffect(() => {
    if (id && focusRequest.id === id) {
      focusRequest.id = null;
      ref.current?.focus();
    }
  }, [id]);
  return ref;
}

/** Én global, høflig live-region for statusmeldinger (WCAG 4.1.3). Koblet til i App. */
export const announcer: { fn: (msg: string) => void } = { fn: () => {} };
export const announce = (msg: string) => announcer.fn(msg);

/** Sett fokus tilbake på en knapp når et skjema lukkes (etter at knappen er rendret på nytt). */
export function useReturnFocus(open: boolean) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (!open && pending.current) {
      pending.current = false;
      btnRef.current?.focus();
    }
  }, [open]);
  return { btnRef, returnFocus: () => (pending.current = true) };
}

/** Gaver man kan flytte en ting til, gruppert per person. */
export interface MoveTarget {
  personId: string;
  personName: string;
  gifts: { id: string; name: string }[];
}

export const giftLabel = (g: Gift, index: number) => g.title.trim() || `Gave ${index}`;

/** Tekst og fyllingsgrad for kjøpt sum mot budsjett. */
export function budgetInfo(spent: number, budget: number | null): { state: BudgetState; label: string; pct: number } {
  const state = compareToBudget(spent, budget);
  if (budget == null) return { state, label: 'Ingen budsjett', pct: 0 };
  const diff = budget - spent;
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : spent > 0 ? 100 : 0;
  const label =
    state === 'over'
      ? `${formatKr(-diff)} over budsjett`
      : state === 'within'
        ? diff >= 0
          ? `På budsjett (${formatKr(diff)} igjen)`
          : `På budsjett (${formatKr(-diff)} over)`
        : `${formatKr(diff)} igjen`;
  return { state, label, pct };
}

/** Tynn fremdriftsstolpe med tekstlig verdi for skjermleser. */
export function ProgressBar({ spent, budget, name }: { spent: number; budget: number; name: string }) {
  const { label, pct } = budgetInfo(spent, budget);
  return (
    <div
      className="bar"
      role="progressbar"
      aria-label={`Budsjettforbruk ${name}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={`${formatKr(spent)} av ${formatKr(budget)}. ${label}. «På budsjett» betyr innenfor ${BUDGET_TOLERANCE_LABEL}.`}
    >
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Beløpsfelt som tåler norsk komma, mellomrom og tomt felt mens man skriver, og sier fra ved ugyldig verdi. */
export function MoneyInput({
  id,
  value,
  onChange,
  allowEmpty = false,
  onValidChange,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowEmpty?: boolean;
  onValidChange?: (valid: boolean) => void;
}) {
  const toText = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(toText(value));
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalidState] = useState(false);
  const setInvalid = (v: boolean) => {
    setInvalidState(v);
    onValidChange?.(!v);
  };
  const shown = focused || invalid ? text : toText(value);
  return (
    <>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="money"
        value={shown}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-err` : undefined}
        onFocus={() => {
          if (!invalid) setText(toText(value));
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const cleaned = t.replace(/\s/g, '').replace(',', '.');
          if (cleaned === '') {
            setInvalid(false);
            onChange(allowEmpty ? null : 0);
          } else if (/^\d+(\.\d{0,2})?$/.test(cleaned)) {
            setInvalid(false);
            onChange(Number(cleaned));
          } else {
            setInvalid(true);
          }
        }}
      />
      {invalid && (
        <span id={`${id}-err`} className="field-error" role="alert">
          Skriv et beløp, f.eks. 249,90
        </span>
      )}
    </>
  );
}

