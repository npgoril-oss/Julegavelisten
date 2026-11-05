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

/** Én global, høflig live-region for statusmeldinger (WCAG 4.1.3). */
let announceFn: (msg: string) => void = () => {};
function announce(msg: string) {
  announceFn(msg);
}

const COLLAPSED_KEY = 'julegavelisten:collapsed';
function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

/** Gaver man kan flytte en ting til, gruppert per person. */
export interface MoveTarget {
  personId: string;
  personName: string;
  gifts: { id: string; name: string }[];
}

export const giftLabel = (g: Gift, index: number) => g.title.trim() || `Gave ${index}`;

/** Sett fokus tilbake på en knapp når et redigeringsskjema lukkes (etter at knappen er rendret på nytt). */
function useReturnFocus(open: boolean) {
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

export default function App() {
  const [data, dispatch] = useAppData();
  const [year, setYear] = useState(currentYear());
  const [showArchived, setShowArchived] = useState(false);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [message, setMessage] = useState('');
  announceFn = (msg) => {
    // Tøm først så samme melding to ganger på rad også leses opp.
    setMessage('');
    requestAnimationFrame(() => setMessage(msg));
  };

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch {
      /* ikke kritisk */
    }
  }, [collapsed]);

  const setPersonCollapsed = (id: string, value: boolean) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  const years = useMemo(() => availableYears(data.gifts), [data.gifts]);
  const giftsThisYear = useMemo(() => data.gifts.filter((g) => g.year === year), [data.gifts, year]);
  const summary = summarize(giftsThisYear);
  const persons = data.persons
    .filter((p) => showArchived || !p.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  const giftsFor = (personId: string) => giftsThisYear.filter((g) => g.personId === personId);
  const moveTargets: MoveTarget[] = persons
    .filter((p) => !p.archived)
    .map((p) => ({
      personId: p.id,
      personName: p.name,
      gifts: giftsFor(p.id).map((g, i) => ({ id: g.id, name: giftLabel(g, i + 1) })),
    }));

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
          <div className="data-tools">
            <button className="ghost" onClick={() => setCollapsed(new Set(persons.map((p) => p.id)))}>
              Fold sammen alle
            </button>
            <button className="ghost" onClick={() => setCollapsed(new Set())}>
              Vis alle
            </button>
          </div>
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
              gifts={giftsFor(p.id)}
              year={year}
              dispatch={dispatch}
              collapsed={collapsed.has(p.id)}
              setCollapsed={setPersonCollapsed}
              moveTargets={moveTargets}
            />
          ))}
        </section>
      </main>
      <div className="visually-hidden" role="status" aria-live="polite">
        {message}
      </div>
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
  collapsed,
  setCollapsed,
  moveTargets,
}: {
  person: Person;
  gifts: Gift[];
  year: number;
  dispatch: Dispatch<Action>;
  collapsed: boolean;
  setCollapsed: (id: string, value: boolean) => void;
  moveTargets: MoveTarget[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(person.name);
  const { btnRef: editBtn, returnFocus } = useReturnFocus(editing);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const done = gifts.length > 0 && gifts.every(isGiftDone);
  const total = summarize(gifts);
  const hasBudget = gifts.some((g) => g.budget != null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const finishEdit = (save: boolean) => {
    if (save && draft.trim()) dispatch({ type: 'person/rename', id: person.id, name: draft.trim() });
    returnFocus();
    setEditing(false);
  };

  const summaryText =
    gifts.length === 0
      ? `Ingen gave i ${year}`
      : `${gifts.length} ${gifts.length === 1 ? 'gave' : 'gaver'} · ${formatKr(total.purchased)} kjøpt` +
        (hasBudget ? ` av ${formatKr(total.budget)}` : '');

  return (
    <article className={`person ${person.archived ? 'archived' : ''}`} aria-labelledby={`${id}-h`}>
      <div className="person-head">
        <h3 id={`${id}-h`} className="person-name">
          <button
            className="person-toggle"
            aria-expanded={!collapsed}
            aria-controls={`${id}-body`}
            onClick={() => setCollapsed(person.id, !collapsed)}
          >
            <span className="chevron" aria-hidden="true" />
            <span>
              {person.name}
              {person.archived && <span className="muted"> (arkivert)</span>}
            </span>
          </button>
        </h3>
        <div className="person-meta">
          {done && <span className="badge done">Alt kjøpt</span>}
          <span className="person-total">{summaryText}</span>
        </div>
      </div>

      <div id={`${id}-body`} hidden={collapsed}>
        {editing ? (
          <form
            className="rename"
            onSubmit={(e) => {
              e.preventDefault();
              finishEdit(true);
            }}
          >
            <div className="field">
              <label htmlFor={`${id}-input`}>Navn</label>
              <input
                id={`${id}-input`}
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && finishEdit(false)}
              />
            </div>
            <button type="submit">Lagre</button>
            <button type="button" className="ghost" onClick={() => finishEdit(false)}>
              Avbryt
            </button>
          </form>
        ) : (
          <div className="person-actions">
            <button
              onClick={() => {
                const giftId = newId();
                pendingFocusId = `gift-${giftId}`;
                dispatch({ type: 'gift/add', personId: person.id, year, id: giftId });
              }}
            >
              <span aria-hidden="true">+ </span>Ny gave<span className="visually-hidden"> til {person.name}</span>
            </button>
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
        )}
        {gifts.map((g, idx) => (
          <GiftCard
            key={g.id}
            gift={g}
            index={idx + 1}
            person={person}
            year={year}
            dispatch={dispatch}
            moveTargets={moveTargets}
            onMovedTo={(personId) => setCollapsed(personId, false)}
          />
        ))}
      </div>
    </article>
  );
}

function GiftCard({
  gift,
  index,
  person,
  year,
  dispatch,
  moveTargets,
  onMovedTo,
}: {
  gift: Gift;
  index: number;
  person: Person;
  year: number;
  dispatch: Dispatch<Action>;
  moveTargets: MoveTarget[];
  onMovedTo: (personId: string) => void;
}) {
  const id = useId();
  const focusKey = `gift-${gift.id}`;
  // En nyopprettet gave åpnes direkte i redigering.
  const [editing, setEditing] = useState(() => pendingFocusId === focusKey);
  const [draftTitle, setDraftTitle] = useState(gift.title);
  const [draftBudget, setDraftBudget] = useState<number | null>(gift.budget);
  const [budgetValid, setBudgetValid] = useState(true);
  const titleRef = useFocusOnCreate<HTMLInputElement>(focusKey);
  const { btnRef: editBtn, returnFocus } = useReturnFocus(editing);
  const addItemRef = useRef<HTMLButtonElement>(null);
  const bought = purchasedSum(gift);
  const planned = plannedSum(gift);
  const done = isGiftDone(gift);
  const giftName = giftLabel(gift, index);

  const startEdit = () => {
    setDraftTitle(gift.title);
    setDraftBudget(gift.budget);
    setBudgetValid(true);
    setEditing(true);
  };
  useEffect(() => {
    if (editing) titleRef.current?.focus();
  }, [editing, titleRef]);

  const stopEdit = () => {
    returnFocus();
    setEditing(false);
  };

  return (
    <section className={`gift ${done ? 'is-done' : ''}`} aria-labelledby={`${id}-h`}>
      {editing ? (
        <form
          className="gift-edit"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!budgetValid) return;
            dispatch({ type: 'gift/update', id: gift.id, patch: { title: draftTitle.trim(), budget: draftBudget } });
            stopEdit();
          }}
          onKeyDown={(e) => e.key === 'Escape' && stopEdit()}
        >
          <h4 id={`${id}-h`} className="visually-hidden">
            Rediger {giftName} til {person.name}
          </h4>
          <div className="field gift-title">
            <label htmlFor={`${id}-title`}>Navn på gave</label>
            <input
              id={`${id}-title`}
              ref={titleRef}
              value={draftTitle}
              placeholder={`Gave ${index}`}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
          </div>
          <div className="field budget">
            <label htmlFor={`${id}-budget`}>Budsjett (kr)</label>
            <MoneyInput
              id={`${id}-budget`}
              value={draftBudget}
              allowEmpty
              onChange={setDraftBudget}
              onValidChange={setBudgetValid}
            />
          </div>
          <div className="gift-edit-actions">
            <button type="submit">Lagre</button>
            <button type="button" className="ghost" onClick={stopEdit}>
              Avbryt
            </button>
            <button
              type="button"
              className="ghost danger"
              onClick={() => {
                if (confirm(`Slette «${giftName}» og alle ting i den?`)) dispatch({ type: 'gift/delete', id: gift.id });
              }}
            >
              Slett gave
            </button>
          </div>
        </form>
      ) : (
        <div className="gift-head">
          <h4 id={`${id}-h`} className="gift-name">
            {giftName}
            <span className="visually-hidden"> til {person.name}</span>
          </h4>
          <div className="gift-head-actions">
            <label className="check">
              <input
                type="checkbox"
                checked={gift.wrapped}
                onChange={(e) =>
                  dispatch({ type: 'gift/update', id: gift.id, patch: { wrapped: e.target.checked } })
                }
              />
              Pakket inn
            </label>
            <button ref={editBtn} className="ghost" onClick={startEdit}>
              Rediger<span className="visually-hidden"> {giftName}</span>
            </button>
          </div>
        </div>
      )}

      <BudgetBar spent={bought} budget={gift.budget} name={giftName} />
      <div className="gift-status">
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
            <span />
          </div>
          <ul className="items" aria-label={`Ting i ${giftName}`}>
            {gift.items.map((i, n) => (
              <ItemRow
                key={i.id}
                item={i}
                index={n + 1}
                gift={gift}
                person={person}
                year={year}
                dispatch={dispatch}
                moveTargets={moveTargets}
                onMovedTo={onMovedTo}
                onRemoved={() => addItemRef.current?.focus()}
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

const NEW_GIFT = '__ny__';

function ItemRow({
  item,
  index,
  gift,
  person,
  year,
  dispatch,
  moveTargets,
  onMovedTo,
  onRemoved,
}: {
  item: Item;
  index: number;
  gift: Gift;
  person: Person;
  year: number;
  dispatch: Dispatch<Action>;
  moveTargets: MoveTarget[];
  onMovedTo: (personId: string) => void;
  onRemoved: () => void;
}) {
  const id = useId();
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState('');
  const nameRef = useFocusOnCreate<HTMLInputElement>(`item-${item.id}`);
  const { btnRef: moveBtn, returnFocus } = useReturnFocus(moving);
  const selectRef = useRef<HTMLSelectElement>(null);
  const update = (patch: Partial<Omit<Item, 'id'>>) =>
    dispatch({ type: 'item/update', giftId: gift.id, id: item.id, patch });
  const safeLink = /^https?:\/\//i.test(item.link) ? item.link : null;
  const itemName = item.name.trim() || `ting ${index}`;

  useEffect(() => {
    if (moving) selectRef.current?.focus();
  }, [moving]);

  const cancelMove = () => {
    returnFocus();
    setMoving(false);
  };

  const doMove = () => {
    if (!target) return;
    let toGiftId = target;
    let toPersonId: string;
    let toLabel: string;
    if (target === NEW_GIFT) {
      toGiftId = newId();
      toPersonId = person.id;
      toLabel = `ny gave til ${person.name}`;
      dispatch({ type: 'gift/add', personId: person.id, year, id: toGiftId });
    } else {
      const group = moveTargets.find((t) => t.gifts.some((g) => g.id === target))!;
      toPersonId = group.personId;
      toLabel = `${group.gifts.find((g) => g.id === target)!.name} til ${group.personName}`;
    }
    pendingFocusId = `item-${item.id}`;
    onMovedTo(toPersonId);
    dispatch({ type: 'item/move', fromGiftId: gift.id, id: item.id, toGiftId });
    announce(`«${itemName}» flyttet til ${toLabel}.`);
  };

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
        ref={moveBtn}
        className="ghost f-move"
        aria-expanded={moving}
        aria-controls={`${id}-move`}
        onClick={() => (moving ? cancelMove() : (setTarget(''), setMoving(true)))}
      >
        Flytt<span className="visually-hidden"> {itemName}</span>
      </button>
      <button
        className="ghost danger f-delete"
        onClick={() => {
          dispatch({ type: 'item/delete', giftId: gift.id, id: item.id });
          announce(`«${itemName}» fjernet.`);
          onRemoved();
        }}
      >
        <span aria-hidden="true" className="icon-only">
          ✕
        </span>
        <span className="delete-text">Fjern</span>
        <span className="visually-hidden"> {itemName}</span>
      </button>

      {moving && (
        <form
          id={`${id}-move`}
          className="move-panel"
          onSubmit={(e) => {
            e.preventDefault();
            doMove();
          }}
          onKeyDown={(e) => e.key === 'Escape' && cancelMove()}
        >
          <div className="field">
            <label htmlFor={`${id}-target`}>Flytt «{itemName}» til</label>
            <select id={`${id}-target`} ref={selectRef} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="" disabled>
                Velg gave …
              </option>
              {moveTargets.map((t) => {
                const options = t.gifts.filter((g) => g.id !== gift.id);
                const isOwn = t.personId === person.id;
                if (options.length === 0 && !isOwn) return null;
                return (
                  <optgroup key={t.personId} label={t.personName}>
                    {options.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({t.personName})
                      </option>
                    ))}
                    {isOwn && <option value={NEW_GIFT}>Ny gave til {t.personName}</option>}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <button type="submit" disabled={!target}>
            Flytt
          </button>
          <button type="button" className="ghost" onClick={cancelMove}>
            Avbryt
          </button>
        </form>
      )}
    </li>
  );
}

/** Beløpsfelt som tåler norsk komma, mellomrom og tomt felt mens man skriver, og sier fra ved ugyldig verdi. */
function MoneyInput({
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
