import { useEffect, useId, useMemo, useRef, useState, type Dispatch, type RefObject } from 'react';
import type { AppData, Gift, Item, Person } from './types';
import { newId, parseData, useAppData, type Action } from './store';
import {
  BUDGET_TOLERANCE,
  allReceived,
  availableYears,
  compareToBudget,
  currentYear,
  formatKr,
  isGiftDone,
  plannedSum,
  purchasedSum,
  summarize,
} from './logic';

/**
 * Id på et felt som skal få fokus når det monteres (nytt item / ny gave).
 * Gir tastatur- og skjermleserbrukere en naturlig flyt etter «Legg til».
 */
let pendingFocusId: string | null = null;
function useFocusOnCreate<T extends HTMLElement>(id: string): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (pendingFocusId === id) {
      pendingFocusId = null;
      ref.current?.focus();
    }
  }, [id]);
  return ref;
}

export default function App() {
  const [data, dispatch] = useAppData();
  const [year, setYear] = useState(currentYear());
  const [showArchived, setShowArchived] = useState(false);

  const years = useMemo(() => availableYears(data.gifts), [data.gifts]);
  const giftsThisYear = useMemo(() => data.gifts.filter((g) => g.year === year), [data.gifts, year]);
  const summary = summarize(giftsThisYear);
  const persons = data.persons
    .filter((p) => showArchived || !p.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));

  return (
    <>
      <a className="skip-link" href="#mottakere">
        Hopp til mottakere
      </a>
      <header className="topbar">
        <h1>
          <span aria-hidden="true">🎄 </span>Julegavelisten
        </h1>
        <label className="year">
          År
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
                {y === currentYear() ? ' (i år)' : ''}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="app">
        <section aria-labelledby="oversikt-tittel">
          <h2 id="oversikt-tittel" className="visually-hidden">
            Oversikt {year}
          </h2>
          <dl className="summary">
            <Stat label="Gaver alt kjøpt" value={`${summary.done} av ${summary.gifts}`} />
            <Stat label="Pakket inn" value={`${summary.wrapped} av ${summary.gifts}`} />
            <Stat label="Budsjett totalt" value={formatKr(summary.budget)} />
            <Stat label="Kjøpt / bestilt" value={formatKr(summary.purchased)} />
            <Stat label="Planlagt totalt" value={formatKr(summary.planned)} />
          </dl>

          {summary.budget > 0 && (
            <div className="year-budget">
              <BudgetBar spent={summary.purchasedWithBudget} budget={summary.budget} name={`Totalt ${year}`} />
              {summary.purchased !== summary.purchasedWithBudget && (
                <p className="muted small">
                  + {formatKr(summary.purchased - summary.purchasedWithBudget)} kjøpt på gaver uten budsjett
                </p>
              )}
            </div>
          )}
        </section>

        <AddPerson onAdd={(name) => dispatch({ type: 'person/add', name })} />

        <div className="toolbar">
          <label className="check">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Vis arkiverte personer
          </label>
          <DataTools data={data} dispatch={dispatch} />
        </div>

        <section id="mottakere" aria-labelledby="mottakere-tittel" tabIndex={-1}>
          <h2 id="mottakere-tittel" className="visually-hidden">
            Mottakere
          </h2>
          {persons.length === 0 && <p className="empty">Ingen personer ennå. Legg til den første mottakeren over.</p>}
          {persons.map((p) => (
            <PersonCard
              key={p.id}
              person={p}
              gifts={giftsThisYear.filter((g) => g.personId === p.id)}
              year={year}
              dispatch={dispatch}
            />
          ))}
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dt className="stat-label">{label}</dt>
      <dd className="stat-value">{value}</dd>
    </div>
  );
}

function AddPerson({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState(false);
  const id = useId();
  return (
    <form
      className="add-person"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError(true);
          return;
        }
        onAdd(name);
        setName('');
        setError(false);
      }}
    >
      <label htmlFor={`${id}-name`}>Ny mottaker</label>
      <div className="add-person-row">
        <input
          id={`${id}-name`}
          value={name}
          autoComplete="off"
          aria-invalid={error || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim()) setError(false);
          }}
        />
        <button type="submit">Legg til person</button>
      </div>
      {error && (
        <p id={`${id}-err`} className="field-error" role="alert">
          Skriv inn et navn.
        </p>
      )}
    </form>
  );
}

function PersonCard({
  person,
  gifts,
  year,
  dispatch,
}: {
  person: Person;
  gifts: Gift[];
  year: number;
  dispatch: Dispatch<Action>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(person.name);
  const editBtn = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const done = gifts.length > 0 && gifts.every(isGiftDone);
  const total = summarize(gifts);
  const hasBudget = gifts.some((g) => g.budget != null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const finishEdit = (save: boolean) => {
    if (save && draft.trim()) dispatch({ type: 'person/rename', id: person.id, name: draft.trim() });
    setEditing(false);
    requestAnimationFrame(() => editBtn.current?.focus());
  };

  return (
    <article className={`person ${person.archived ? 'archived' : ''}`} aria-labelledby={headingId}>
      <div className="person-head">
        {editing ? (
          <form
            className="rename"
            onSubmit={(e) => {
              e.preventDefault();
              finishEdit(true);
            }}
          >
            <label className="visually-hidden" htmlFor={`${headingId}-input`}>
              Navn
            </label>
            <input
              id={`${headingId}-input`}
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && finishEdit(false)}
            />
            <button type="submit">Lagre</button>
            <button type="button" className="ghost" onClick={() => finishEdit(false)}>
              Avbryt
            </button>
          </form>
        ) : (
          <h3 id={headingId} className="person-name">
            {person.name}
            {person.archived && <span className="muted"> (arkivert)</span>}
          </h3>
        )}
        <div className="person-meta">
          {done && <span className="badge done">Alt kjøpt</span>}
          {gifts.length > 1 && (
            <span className="person-total">
              {gifts.length} gaver · {formatKr(total.purchased)} kjøpt
              {hasBudget && <> · budsjett {formatKr(total.budget)}</>}
            </span>
          )}
          {gifts.length === 0 && <span className="badge muted">Ingen gave i {year}</span>}
        </div>
        <div className="person-actions">
          <button
            onClick={() => {
              const id = newId();
              pendingFocusId = `gift-${id}`;
              dispatch({ type: 'gift/add', personId: person.id, year, id });
            }}
          >
            <span aria-hidden="true">+ </span>Ny gave<span className="visually-hidden"> til {person.name}</span>
          </button>
          {!editing && (
            <button
              ref={editBtn}
              className="ghost"
              onClick={() => {
                setDraft(person.name);
                setEditing(true);
              }}
            >
              Endre navn<span className="visually-hidden"> på {person.name}</span>
            </button>
          )}
          <button
            className="ghost"
            onClick={() => dispatch({ type: 'person/archive', id: person.id, archived: !person.archived })}
          >
            {person.archived ? 'Gjenopprett' : 'Arkiver'}
            <span className="visually-hidden"> {person.name}</span>
          </button>
          <button
            className="ghost danger"
            onClick={() => {
              if (confirm(`Slette ${person.name} og alle gaver for alle år?`))
                dispatch({ type: 'person/delete', id: person.id });
            }}
          >
            Slett<span className="visually-hidden"> {person.name}</span>
          </button>
        </div>
      </div>
      {gifts.map((g, idx) => (
        <GiftCard key={g.id} gift={g} index={idx + 1} personName={person.name} dispatch={dispatch} />
      ))}
    </article>
  );
}

function GiftCard({
  gift,
  index,
  personName,
  dispatch,
}: {
  gift: Gift;
  index: number;
  personName: string;
  dispatch: Dispatch<Action>;
}) {
  const id = useId();
  const titleRef = useFocusOnCreate<HTMLInputElement>(`gift-${gift.id}`);
  const addItemRef = useRef<HTMLButtonElement>(null);
  const bought = purchasedSum(gift);
  const planned = plannedSum(gift);
  const done = isGiftDone(gift);
  const giftName = gift.title.trim() || `Gave ${index}`;

  return (
    <section className={`gift ${done ? 'is-done' : ''}`} aria-labelledby={`${id}-h`}>
      <h4 id={`${id}-h`} className="visually-hidden">
        {giftName} til {personName}
      </h4>
      <div className="gift-head">
        <div className="field gift-title">
          <label htmlFor={`${id}-title`}>Gave</label>
          <input
            id={`${id}-title`}
            ref={titleRef}
            value={gift.title}
            placeholder={`Gave ${index}`}
            onChange={(e) => dispatch({ type: 'gift/update', id: gift.id, patch: { title: e.target.value } })}
          />
        </div>
        <div className="field budget">
          <label htmlFor={`${id}-budget`}>Budsjett (kr)</label>
          <MoneyInput
            id={`${id}-budget`}
            value={gift.budget}
            allowEmpty
            onChange={(v) => dispatch({ type: 'gift/update', id: gift.id, patch: { budget: v } })}
          />
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={gift.wrapped}
            onChange={(e) => dispatch({ type: 'gift/update', id: gift.id, patch: { wrapped: e.target.checked } })}
          />
          Pakket inn
        </label>
        <button
          className="ghost danger"
          onClick={() => {
            if (confirm(`Slette «${giftName}»?`)) dispatch({ type: 'gift/delete', id: gift.id });
          }}
        >
          Slett gave<span className="visually-hidden"> {giftName}</span>
        </button>
      </div>

      <BudgetBar spent={bought} budget={gift.budget} name={giftName} />
      <div className="gift-status" role="status">
        {planned !== bought && <span className="muted">Planlagt totalt: {formatKr(planned)}</span>}
        {done && <span className="badge done">Alt kjøpt</span>}
        {gift.wrapped && <span className="badge wrapped">Pakket inn</span>}
        {allReceived(gift) && <span className="badge received">Alt mottatt</span>}
      </div>

      {gift.items.length > 0 && (
        <>
          <div className="item-header" aria-hidden="true">
            <span>Navn / beskrivelse</span>
            <span className="num">Pris (kr)</span>
            <span>Lenke</span>
            <span>Notat</span>
            <span className="center">Kjøpt</span>
            <span className="center">Mottatt</span>
            <span />
          </div>
          <ul className="items" aria-label={`Ting i ${giftName}`}>
            {gift.items.map((i, n) => (
              <ItemRow
                key={i.id}
                item={i}
                index={n + 1}
                giftId={gift.id}
                dispatch={dispatch}
                onDeleted={() => addItemRef.current?.focus()}
              />
            ))}
          </ul>
        </>
      )}
      <button
        ref={addItemRef}
        className="add-item"
        onClick={() => {
          const itemId = newId();
          pendingFocusId = `item-${itemId}`;
          dispatch({ type: 'item/add', giftId: gift.id, id: itemId });
        }}
      >
        <span aria-hidden="true">+ </span>Legg til ting<span className="visually-hidden"> i {giftName}</span>
      </button>
    </section>
  );
}

function ItemRow({
  item,
  index,
  giftId,
  dispatch,
  onDeleted,
}: {
  item: Item;
  index: number;
  giftId: string;
  dispatch: Dispatch<Action>;
  onDeleted: () => void;
}) {
  const id = useId();
  const nameRef = useFocusOnCreate<HTMLInputElement>(`item-${item.id}`);
  const update = (patch: Partial<Omit<Item, 'id'>>) => dispatch({ type: 'item/update', giftId, id: item.id, patch });
  const safeLink = /^https?:\/\//i.test(item.link) ? item.link : null;
  const itemName = item.name.trim() || `ting ${index}`;

  return (
    <li className={`item ${item.purchased ? 'purchased' : ''}`}>
      <div className="field f-name">
        <label htmlFor={`${id}-name`}>Navn / beskrivelse</label>
        <input id={`${id}-name`} ref={nameRef} value={item.name} onChange={(e) => update({ name: e.target.value })} />
      </div>
      <div className="field f-price">
        <label htmlFor={`${id}-price`}>Pris (kr)</label>
        <MoneyInput id={`${id}-price`} value={item.price} onChange={(v) => update({ price: v ?? 0 })} />
      </div>
      <div className="field f-link">
        <label htmlFor={`${id}-link`}>Lenke</label>
        <div className="link-row">
          <input
            id={`${id}-link`}
            type="url"
            inputMode="url"
            autoComplete="off"
            value={item.link}
            placeholder="https://"
            onChange={(e) => update({ link: e.target.value })}
          />
          {safeLink && (
            <a className="open-link" href={safeLink} target="_blank" rel="noopener noreferrer">
              <span aria-hidden="true">↗</span>
              <span className="visually-hidden">Åpne lenke til {itemName} (ny fane)</span>
            </a>
          )}
        </div>
      </div>
      <div className="field f-note">
        <label htmlFor={`${id}-note`}>Notat</label>
        <input id={`${id}-note`} value={item.note} onChange={(e) => update({ note: e.target.value })} />
      </div>
      <label className="check f-bought">
        <input type="checkbox" checked={item.purchased} onChange={(e) => update({ purchased: e.target.checked })} />
        <span>
          Kjøpt<span className="visually-hidden"> {itemName}</span>
        </span>
      </label>
      <label className="check f-received">
        <input type="checkbox" checked={item.received} onChange={(e) => update({ received: e.target.checked })} />
        <span>
          Mottatt<span className="visually-hidden"> {itemName}</span>
        </span>
      </label>
      <button
        className="ghost danger f-delete"
        onClick={() => {
          dispatch({ type: 'item/delete', giftId, id: item.id });
          onDeleted();
        }}
      >
        <span aria-hidden="true" className="icon-only">
          ✕
        </span>
        <span className="delete-text">Fjern</span>
        <span className="visually-hidden"> {itemName}</span>
      </button>
    </li>
  );
}

/** Beløpsfelt som tåler norsk komma, mellomrom og tomt felt mens man skriver, og sier fra ved ugyldig verdi. */
function MoneyInput({
  id,
  value,
  onChange,
  allowEmpty = false,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowEmpty?: boolean;
}) {
  const toText = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(toText(value));
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
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

/** Viser hvordan kjøpt sum ligger an mot budsjettet (± BUDGET_TOLERANCE regnes som «på budsjett»). */
export function BudgetBar({ spent, budget, name }: { spent: number; budget: number | null; name: string }) {
  if (budget == null) {
    return (
      <p className="budget-line">
        Kjøpt/bestilt: <strong>{formatKr(spent)}</strong> <span className="muted">(ingen budsjett satt)</span>
      </p>
    );
  }
  const state = compareToBudget(spent, budget);
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
  return (
    <div className={`budget-line state-${state}`}>
      <div className="budget-text">
        <span>
          Kjøpt/bestilt: <strong>{formatKr(spent)}</strong> av {formatKr(budget)}
        </span>
        <span className="budget-label">
          {state === 'over' && <span aria-hidden="true">⚠ </span>}
          {label}
        </span>
      </div>
      <div
        className="bar"
        role="progressbar"
        aria-label={`Budsjettforbruk ${name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={`${formatKr(spent)} av ${formatKr(budget)}. ${label}`}
      >
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="visually-hidden">«På budsjett» betyr innenfor ±{BUDGET_TOLERANCE} kr.</span>
    </div>
  );
}

function DataTools({ data, dispatch }: { data: AppData; dispatch: Dispatch<Action> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="data-tools">
      <button
        className="ghost"
        onClick={() => {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `julegavelisten-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(a.href);
        }}
      >
        Eksporter (backup)
      </button>
      <button className="ghost" onClick={() => fileRef.current?.click()}>
        Importer
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            const parsed = parseData(JSON.parse(await file.text()));
            if (confirm('Dette erstatter alle data i appen. Fortsette?'))
              dispatch({ type: 'data/replace', data: parsed });
          } catch (err) {
            alert(`Kunne ikke importere: ${(err as Error).message}`);
          }
        }}
      />
    </div>
  );
}
