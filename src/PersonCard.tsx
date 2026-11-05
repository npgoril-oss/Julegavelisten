import { useEffect, useId, useRef, useState, type Dispatch } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { Gift, Person } from './types';
import { newId, type Action } from './store';
import { formatKr, isGiftDone, summarize } from './logic';
import { Icon } from './icons';
import { MoreMenu } from './Menu';
import { DragHandle, SortableItem, SortableList } from './Sortable';
import { GiftCard } from './GiftCard';
import { announce, focusRequest, giftLabel, type MoveTarget } from './ui';

export function PersonCard({
  person,
  position,
  count,
  gifts,
  year,
  dispatch,
  collapsed,
  setCollapsed,
  moveTargets,
  onMove,
}: {
  person: Person;
  position: number;
  count: number;
  gifts: Gift[];
  year: number;
  dispatch: Dispatch<Action>;
  collapsed: boolean;
  setCollapsed: (id: string, value: boolean) => void;
  moveTargets: MoveTarget[];
  onMove: (delta: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(person.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const refocusMenu = useRef(false);
  const id = useId();
  const done = gifts.length > 0 && gifts.every(isGiftDone);
  const total = summarize(gifts);
  const hasBudget = gifts.some((g) => g.budget != null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (refocusMenu.current) {
      refocusMenu.current = false;
      menuBtn.current?.focus();
    }
  }, [editing]);

  // Elementet flyttes i DOM-en; sett fokus tilbake på menyknappen etterpå.
  const moveAndRefocus = (delta: -1 | 1) => {
    onMove(delta);
    requestAnimationFrame(() => menuBtn.current?.focus());
  };

  const finishEdit = (save: boolean) => {
    if (save && draft.trim()) dispatch({ type: 'person/rename', id: person.id, name: draft.trim() });
    refocusMenu.current = true;
    setEditing(false);
  };

  const addGift = () => {
    const giftId = newId();
    focusRequest.id = `gift-${giftId}`;
    setCollapsed(person.id, false);
    dispatch({ type: 'gift/add', personId: person.id, year, id: giftId });
  };

  const giftIds = gifts.map((g) => g.id);
  const reorderGifts = (ids: string[]) => dispatch({ type: 'gift/reorder', ids });
  const moveGift = (giftId: string, delta: -1 | 1) => {
    const from = giftIds.indexOf(giftId);
    const to = from + delta;
    if (to < 0 || to >= giftIds.length) return;
    reorderGifts(arrayMove(giftIds, from, to));
    const g = gifts[from];
    announce(`${giftLabel(g, from + 1)} flyttet til plass ${to + 1} av ${giftIds.length}.`);
  };

  const summaryText =
    gifts.length === 0
      ? `Ingen gave i ${year}`
      : `${gifts.length} ${gifts.length === 1 ? 'gave' : 'gaver'} · ${formatKr(total.purchased)}` +
        (hasBudget ? ` av ${formatKr(total.budget)}` : ' kjøpt');

  return (
    <SortableItem id={person.id} className={`person ${person.archived ? 'archived' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div className="person-head">
        {count > 1 && <DragHandle label={`Endre rekkefølge: ${person.name}`} />}
        <h3 className="person-name">
          <button
            className="person-toggle"
            aria-expanded={!collapsed}
            aria-controls={`${id}-body`}
            onClick={() => setCollapsed(person.id, !collapsed)}
          >
            <span className="chevron" aria-hidden="true" />
            <span className="person-label">
              {person.name}
              {person.archived && <span className="muted"> (arkivert)</span>}
            </span>
          </button>
        </h3>
        <span className="person-total">
          {done && (
            <span className="badge done" title="Alt kjøpt">
              ✓<span className="visually-hidden"> Alt kjøpt.</span>
            </span>
          )}
          {summaryText}
        </span>
        <MoreMenu
          label={`Flere valg for ${person.name}`}
          buttonRef={menuBtn}
          entries={[
            { label: 'Ny gave', icon: 'plus', onSelect: addGift },
            {
              label: 'Endre navn',
              icon: 'edit',
              onSelect: () => {
                setDraft(person.name);
                setCollapsed(person.id, false);
                setEditing(true);
              },
            },
            count > 1 && { label: 'Flytt opp', icon: 'up', disabled: position === 1, onSelect: () => moveAndRefocus(-1) },
            count > 1 && { label: 'Flytt ned', icon: 'down', disabled: position === count, onSelect: () => moveAndRefocus(1) },
            {
              label: person.archived ? 'Gjenopprett' : 'Arkiver',
              icon: person.archived ? 'restore' : 'archive',
              onSelect: () => {
                dispatch({ type: 'person/archive', id: person.id, archived: !person.archived });
                announce(person.archived ? `${person.name} gjenopprettet.` : `${person.name} arkivert.`);
              },
            },
            'separator',
            {
              label: 'Slett person',
              icon: 'trash',
              danger: true,
              onSelect: () => {
                if (confirm(`Slette ${person.name} og alle gaver for alle år? Dette kan ikke angres.`)) {
                  dispatch({ type: 'person/delete', id: person.id });
                  announce(`${person.name} slettet.`);
                }
              },
            },
          ]}
        />
      </div>

      <div id={`${id}-body`} className="person-body" hidden={collapsed}>
        {editing && (
          <form
            className="rename"
            onSubmit={(e) => {
              e.preventDefault();
              finishEdit(true);
            }}
            onKeyDown={(e) => e.key === 'Escape' && finishEdit(false)}
          >
            <div className="field">
              <label htmlFor={`${id}-input`}>Navn</label>
              <input id={`${id}-input`} ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} />
            </div>
            <button type="submit">Lagre</button>
            <button type="button" className="ghost" onClick={() => finishEdit(false)}>
              Avbryt
            </button>
          </form>
        )}
        {gifts.length > 0 && (
          <SortableList
            ids={giftIds}
            labelOf={(gid) => {
              const i = giftIds.indexOf(String(gid));
              return i >= 0 ? giftLabel(gifts[i], i + 1) : 'gave';
            }}
            onReorder={reorderGifts}
          >
            <ul className="gifts" aria-label={`Gaver til ${person.name}`}>
              {gifts.map((g, idx) => (
                <GiftCard
                  key={g.id}
                  gift={g}
                  index={idx + 1}
                  count={gifts.length}
                  person={person}
                  year={year}
                  dispatch={dispatch}
                  moveTargets={moveTargets}
                  onMovedTo={(pid) => setCollapsed(pid, false)}
                  onMove={(delta) => moveGift(g.id, delta)}
                />
              ))}
            </ul>
          </SortableList>
        )}
        <button className="add-gift ghost with-icon" onClick={addGift}>
          <Icon name="plus" />
          Ny gave<span className="visually-hidden"> til {person.name}</span>
        </button>
      </div>
    </SortableItem>
  );
}
