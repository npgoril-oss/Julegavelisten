import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { byOrder, useAppData } from './store';
import { StoragePanel } from './StoragePanel';
import { UpdatePrompt } from './UpdatePrompt';
import { Icon } from './icons';
import { MoreMenu } from './Menu';
import { applyTheme, getThemePref, setThemePref, type ThemePref } from './theme';
import { DragRoot, SortableGroup, dragId, type DropResult } from './Sortable';
import { PersonCard } from './PersonCard';
import { ProgressBar, announce, announcer, budgetInfo, focusRequest, giftLabel, type MoveTarget } from './ui';
import { availableYears, christmasCountdown, currentYear, formatKr, summarize } from './logic';

const COLLAPSED_KEY = 'julegavelisten:collapsed';
function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

export default function App() {
  const store = useAppData();
  const { data, dispatch } = store;
  const [year, setYear] = useState(currentYear());
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  useEffect(() => applyTheme(theme), [theme]);
  const chooseTheme = (pref: ThemePref) => {
    setThemePref(pref);
    setTheme(pref);
    announce(pref === 'system' ? 'Tema følger telefonen.' : pref === 'dark' ? 'Mørkt tema valgt.' : 'Lyst tema valgt.');
  };
  announcer.fn = (msg) => {
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
  const archivedCount = data.persons.filter((p) => p.archived).length;
  const persons = data.persons.filter((p) => showArchived || !p.archived).sort(byOrder);
  const personIds = persons.map((p) => p.id);
  const giftsFor = (personId: string) => giftsThisYear.filter((g) => g.personId === personId).sort(byOrder);
  const moveTargets: MoveTarget[] = persons
    .filter((p) => !p.archived)
    .map((p) => ({
      personId: p.id,
      personName: p.name,
      gifts: giftsFor(p.id).map((g, i) => ({ id: g.id, name: giftLabel(g, i + 1) })),
    }));
  const allCollapsed = persons.length > 0 && persons.every((p) => collapsed.has(p.id));

  const reorderPersons = (ids: string[]) => dispatch({ type: 'person/reorder', ids });
  const movePerson = (id: string, delta: -1 | 1) => {
    const from = personIds.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= personIds.length) return;
    reorderPersons(arrayMove(personIds, from, to));
    announce(`${persons[from].name} flyttet til plass ${to + 1} av ${personIds.length}.`);
  };
  /** Resultat av dra-og-slipp (mus, berøring eller tastatur). */
  const onDrop = ({ active: a, over: o }: DropResult) => {
    if (a.kind === 'person' && o.kind === 'person') {
      reorderPersons(arrayMove(personIds, personIds.indexOf(a.id), personIds.indexOf(o.id)));
      return;
    }
    if (a.kind === 'gift' && o.kind === 'gift' && a.parentId === o.parentId) {
      const ids = giftsFor(a.parentId).map((g) => g.id);
      dispatch({ type: 'gift/reorder', ids: arrayMove(ids, ids.indexOf(a.id), ids.indexOf(o.id)) });
      return;
    }
    if (a.kind !== 'item') return;
    const from = data.gifts.find((g) => g.id === a.parentId);
    if (!from) return;
    const ids = from.items.map((i) => i.id);
    const toGiftId = o.kind === 'item' ? o.parentId : o.kind === 'giftDrop' ? o.id : null;
    if (!toGiftId) return;
    if (toGiftId === from.id) {
      const to = o.kind === 'item' ? ids.indexOf(o.id) : ids.length - 1;
      dispatch({ type: 'item/reorder', giftId: from.id, ids: arrayMove(ids, ids.indexOf(a.id), to) });
      return;
    }
    const target = data.gifts.find((g) => g.id === toGiftId);
    const index = o.kind === 'item' ? target?.items.findIndex((i) => i.id === o.id) : undefined;
    // Elementet monteres på nytt i målgaven; gi fokus til menyknappen der (viktig ved tastaturbruk).
    focusRequest.id = `item-${a.id}`;
    dispatch({ type: 'item/move', fromGiftId: from.id, id: a.id, toGiftId, index });
  };

  const sortAlphabetically = () => {
    const ids = [...data.persons].sort((a, b) => a.name.localeCompare(b.name, 'nb')).map((p) => p.id);
    dispatch({ type: 'person/reorder', ids });
    announce('Personene er sortert alfabetisk.');
  };

  const countdown = christmasCountdown();
  const yearBudget = budgetInfo(summary.purchasedWithBudget, summary.budget || null);

  return (
    <>
      <a className="skip-link" href="#mottakere">
        Hopp til mottakere
      </a>
      <header className="topbar">
        <div className="topbar-inner">
        <h1>
          <span aria-hidden="true">🎄 </span>Julegavelisten
        </h1>
        <label className="year">
          <span className="visually-hidden">Velg år</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
                {y === currentYear() ? ' (i år)' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="countdown">
          <span aria-hidden="true">✨ </span>
          {countdown.label}
        </p>
        </div>
      </header>

      <main className="app">
        <section className="overview" aria-labelledby="oversikt-tittel">
          <h2 id="oversikt-tittel" className="visually-hidden">
            Oversikt {year}
          </h2>
          <p className={`overview-line state-${yearBudget.state}`}>
            <span>
              Kjøpt <strong>{formatKr(summary.purchasedWithBudget)}</strong>
              {summary.budget > 0 && <> av {formatKr(summary.budget)}</>}
            </span>
            {summary.budget > 0 && <span className="budget-label">{yearBudget.label}</span>}
          </p>
          {summary.budget > 0 && (
            <div className={`state-${yearBudget.state}`}>
              <ProgressBar spent={summary.purchasedWithBudget} budget={summary.budget} name={`totalt ${year}`} />
            </div>
          )}
          <p className="overview-stats muted">
            <span>
              Alt kjøpt {summary.done} av {summary.gifts}
            </span>
            <span>
              Pakket inn {summary.wrapped} av {summary.gifts}
            </span>
            {summary.planned !== summary.purchased && <span>Planlagt {formatKr(summary.planned)}</span>}
            {summary.purchased !== summary.purchasedWithBudget && (
              <span>+ {formatKr(summary.purchased - summary.purchasedWithBudget)} uten budsjett</span>
            )}
          </p>
        </section>

        <StoragePanel
          data={data}
          restore={store.restore}
          meta={store.meta}
          persist={store.persist}
          idbAvailable={store.idbAvailable}
          saveError={store.saveError}
          markBackedUp={store.markBackedUp}
          recheckPersistence={store.recheckPersistence}
          announce={announce}
        />

        <div className="toolbar">
          <button className="with-icon" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
            <Icon name="plus" />
            Ny person
          </button>
          <div className="toolbar-right">
            {persons.length > 0 && (
              <button
                className="ghost with-icon"
                onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(persons.map((p) => p.id)))}
              >
                <Icon name={allCollapsed ? 'expand' : 'collapse'} />
                {allCollapsed ? 'Åpne alle' : 'Fold alle'}
              </button>
            )}
            <MoreMenu
              label="Flere valg"
              entries={[
                { label: 'Sorter A–Å', icon: 'sort', disabled: data.persons.length < 2, onSelect: sortAlphabetically },
                {
                  label: `Vis arkiverte (${archivedCount})`,
                  icon: 'eye',
                  pressed: showArchived,
                  onSelect: () => setShowArchived((v) => !v),
                },
                'separator',
                { label: 'Lyst tema', icon: 'sun', pressed: theme === 'light', choice: true, onSelect: () => chooseTheme('light') },
                { label: 'Mørkt tema', icon: 'moon', pressed: theme === 'dark', choice: true, onSelect: () => chooseTheme('dark') },
                {
                  label: 'Følg telefonen',
                  icon: 'phone',
                  pressed: theme === 'system',
                  choice: true,
                  onSelect: () => chooseTheme('system'),
                },
              ]}
            />
          </div>
        </div>

        {adding && (
          <AddPerson
            onAdd={(name) => {
              dispatch({ type: 'person/add', name });
              announce(`${name} lagt til.`);
            }}
            onClose={() => setAdding(false)}
          />
        )}

        <section id="mottakere" aria-labelledby="mottakere-tittel" tabIndex={-1}>
          <h2 id="mottakere-tittel" className="visually-hidden">
            Mottakere
          </h2>
          {!store.ready && <p className="empty">Laster …</p>}
          {store.ready && persons.length === 0 && (
            <div className="empty">
              <p className="empty-art" aria-hidden="true">
                🎁🎄🎁
              </p>
              <p>Ingen personer ennå. Trykk «Ny person» for å legge til den første mottakeren.</p>
            </div>
          )}
          {persons.length > 0 && (
            <DragRoot onDrop={onDrop}>
              <SortableGroup ids={personIds.map((id) => dragId('person', id))}>
              <ul className="persons">
                {persons.map((p, i) => (
                  <PersonCard
                    key={p.id}
                    person={p}
                    position={i + 1}
                    count={persons.length}
                    gifts={giftsFor(p.id)}
                    year={year}
                    dispatch={dispatch}
                    collapsed={collapsed.has(p.id)}
                    setCollapsed={setPersonCollapsed}
                    moveTargets={moveTargets}
                    onMove={(delta) => movePerson(p.id, delta)}
                  />
                ))}
              </ul>
              </SortableGroup>
            </DragRoot>
          )}
        </section>
      </main>
      <UpdatePrompt />
      <div className="visually-hidden" role="status" aria-live="polite">
        {message}
      </div>
    </>
  );
}

function AddPerson({ onAdd, onClose }: { onAdd: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => inputRef.current?.focus(), []);
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
        onAdd(name.trim());
        setName('');
        setError(false);
      }}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <label htmlFor={`${id}-name`}>Navn på mottaker</label>
      <div className="add-person-row">
        <input
          id={`${id}-name`}
          ref={inputRef}
          value={name}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={error || undefined}
          aria-describedby={error ? `${id}-err` : `${id}-hint`}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim()) setError(false);
          }}
        />
        <button type="submit">Legg til</button>
        <button type="button" className="ghost" onClick={onClose}>
          Lukk
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} className="field-error" role="alert">
          Skriv inn et navn.
        </p>
      ) : (
        <p id={`${id}-hint`} className="muted small">
          Feltet blir stående åpent, så du kan legge til flere etter hverandre.
        </p>
      )}
    </form>
  );
}
