import { useMemo, useRef, useState, type Dispatch } from 'react';
import type { Gift, Item, Person } from './types';
import { parseData, useAppData, type Action } from './store';
import {
  BUDGET_TOLERANCE,
  allPurchased,
  allReceived,
  availableYears,
  budgetState,
  currentYear,
  formatKr,
  isGiftDone,
  plannedSum,
  purchasedSum,
  summarize,
} from './logic';

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
    <div className="app">
      <header className="topbar">
        <h1>🎄 Julegavelisten</h1>
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

      <section className="summary">
        <Stat label="Gaver" value={`${summary.done} / ${summary.gifts} ferdig`} />
        <Stat label="Innpakket" value={`${summary.wrapped} / ${summary.gifts}`} />
        <Stat label="Budsjett totalt" value={formatKr(summary.budget)} />
        <Stat label="Kjøpt / bestilt" value={formatKr(summary.purchased)} />
        <Stat label="Planlagt totalt" value={formatKr(summary.planned)} />
      </section>

      <AddPerson onAdd={(name) => dispatch({ type: 'person/add', name })} />

      <div className="toolbar">
        <label>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Vis
          arkiverte personer
        </label>
        <DataTools data={data} dispatch={dispatch} />
      </div>

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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function AddPerson({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <form
      className="add-person"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name);
        setName('');
      }}
    >
      <input placeholder="Navn på mottaker" value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit">Legg til person</button>
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
  const done = gifts.length > 0 && gifts.every(isGiftDone);
  return (
    <section className={`person ${person.archived ? 'archived' : ''}`}>
      <div className="person-head">
        <input
          className="person-name"
          value={person.name}
          aria-label="Navn"
          onChange={(e) => dispatch({ type: 'person/rename', id: person.id, name: e.target.value })}
        />
        {done && <span className="badge done">Ferdig</span>}
        {gifts.length === 0 && <span className="badge muted">Ingen gave i {year}</span>}
        <div className="spacer" />
        <button onClick={() => dispatch({ type: 'gift/add', personId: person.id, year })}>+ Ny gave</button>
        <button
          className="ghost"
          onClick={() => dispatch({ type: 'person/archive', id: person.id, archived: !person.archived })}
        >
          {person.archived ? 'Gjenopprett' : 'Arkiver'}
        </button>
        <button
          className="ghost danger"
          onClick={() => {
            if (confirm(`Slette ${person.name} og alle gaver for alle år?`))
              dispatch({ type: 'person/delete', id: person.id });
          }}
        >
          Slett
        </button>
      </div>
      {gifts.map((g) => (
        <GiftCard key={g.id} gift={g} dispatch={dispatch} />
      ))}
    </section>
  );
}

function GiftCard({ gift, dispatch }: { gift: Gift; dispatch: Dispatch<Action> }) {
  const bought = purchasedSum(gift);
  const planned = plannedSum(gift);
  const state = budgetState(gift);
  const done = isGiftDone(gift);

  return (
    <div className={`gift ${done ? 'is-done' : ''}`}>
      <div className="gift-head">
        <input
          className="gift-title"
          placeholder="Gave (f.eks. «Hovedgave»)"
          value={gift.title}
          onChange={(e) => dispatch({ type: 'gift/update', id: gift.id, patch: { title: e.target.value } })}
        />
        <label className="budget">
          Budsjett
          <MoneyInput
            value={gift.budget}
            allowEmpty
            onChange={(v) => dispatch({ type: 'gift/update', id: gift.id, patch: { budget: v } })}
          />
        </label>
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
            if (confirm('Slette denne gaven?')) dispatch({ type: 'gift/delete', id: gift.id });
          }}
        >
          Slett gave
        </button>
      </div>

      <div className="gift-status">
        <span>
          Kjøpt/bestilt: <strong>{formatKr(bought)}</strong>
          {gift.budget != null && <> av {formatKr(gift.budget)}</>}
        </span>
        {planned !== bought && <span className="muted">Planlagt totalt: {formatKr(planned)}</span>}
        {done && <span className="badge done">Ferdig</span>}
        {gift.wrapped && <span className="badge wrapped">Pakket inn</span>}
        {allReceived(gift) && <span className="badge received">Alt mottatt</span>}
        {state === 'over' && (
          <span className="badge warn">Over budsjett med {formatKr(bought - (gift.budget ?? 0))}</span>
        )}
        {state === 'under' && allPurchased(gift) && (
          <span className="badge muted">
            Alt kjøpt, men {formatKr((gift.budget ?? 0) - bought)} igjen av budsjett (±{BUDGET_TOLERANCE} kr)
          </span>
        )}
      </div>

      <table className="items">
        <thead>
          <tr>
            <th>Navn / beskrivelse</th>
            <th className="num">Pris</th>
            <th>Lenke</th>
            <th>Notat</th>
            <th>Kjøpt</th>
            <th>Mottatt</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {gift.items.map((i) => (
            <ItemRow key={i.id} item={i} giftId={gift.id} dispatch={dispatch} />
          ))}
        </tbody>
      </table>
      <button className="add-item" onClick={() => dispatch({ type: 'item/add', giftId: gift.id })}>
        + Legg til item
      </button>
    </div>
  );
}

function ItemRow({ item, giftId, dispatch }: { item: Item; giftId: string; dispatch: Dispatch<Action> }) {
  const update = (patch: Partial<Omit<Item, 'id'>>) => dispatch({ type: 'item/update', giftId, id: item.id, patch });
  const safeLink = /^https?:\/\//i.test(item.link) ? item.link : null;
  return (
    <tr className={item.purchased ? 'purchased' : ''}>
      <td data-label="Navn">
        <input value={item.name} placeholder="Hva?" onChange={(e) => update({ name: e.target.value })} />
      </td>
      <td data-label="Pris" className="num">
        <MoneyInput value={item.price} onChange={(v) => update({ price: v ?? 0 })} />
      </td>
      <td data-label="Lenke" className="link-cell">
        <input value={item.link} placeholder="https://…" onChange={(e) => update({ link: e.target.value })} />
        {safeLink && (
          <a href={safeLink} target="_blank" rel="noopener noreferrer" title="Åpne lenke">
            ↗
          </a>
        )}
      </td>
      <td data-label="Notat">
        <input value={item.note} placeholder="Størrelse, farge…" onChange={(e) => update({ note: e.target.value })} />
      </td>
      <td data-label="Kjøpt" className="center">
        <input
          type="checkbox"
          checked={item.purchased}
          aria-label="Kjøpt"
          onChange={(e) => update({ purchased: e.target.checked })}
        />
      </td>
      <td data-label="Mottatt" className="center">
        <input
          type="checkbox"
          checked={item.received}
          aria-label="Mottatt"
          onChange={(e) => update({ received: e.target.checked })}
        />
      </td>
      <td>
        <button className="ghost danger" title="Fjern" onClick={() => dispatch({ type: 'item/delete', giftId, id: item.id })}>
          ✕
        </button>
      </td>
    </tr>
  );
}

/** Tallfelt som tåler norsk komma og tomt felt mens man skriver. */
function MoneyInput({
  value,
  onChange,
  allowEmpty = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : value == null ? '' : String(value).replace('.', ',');
  return (
    <input
      inputMode="decimal"
      className="money"
      value={shown}
      placeholder={allowEmpty ? '–' : '0'}
      onFocus={() => {
        setText(value == null ? '' : String(value).replace('.', ','));
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const cleaned = t.replace(/\s/g, '').replace(',', '.');
        if (cleaned === '') onChange(allowEmpty ? null : 0);
        else if (!Number.isNaN(Number(cleaned))) onChange(Number(cleaned));
      }}
    />
  );
}

function DataTools({ data, dispatch }: { data: unknown; dispatch: Dispatch<Action> }) {
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
            if (confirm('Dette erstatter alle data i appen. Fortsette?')) dispatch({ type: 'data/replace', data: parsed });
          } catch (err) {
            alert(`Kunne ikke importere: ${(err as Error).message}`);
          }
        }}
      />
    </div>
  );
}
