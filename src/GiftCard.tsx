import { useEffect, useId, useRef, useState, type Dispatch } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { Gift, Person } from './types';
import { newId, type Action } from './store';
import { allReceived, formatKr, isGiftDone, plannedSum, purchasedSum } from './logic';
import { Icon } from './icons';
import { MoreMenu } from './Menu';
import { DragHandle, GiftDropTarget, SortableGroup, SortableItem, dragId } from './Sortable';
import { ItemRow } from './ItemRow';
import { MoneyInput, ProgressBar, announce, budgetInfo, focusRequest, giftLabel, type MoveTarget } from './ui';

export function GiftCard({
  gift,
  index,
  count,
  person,
  year,
  dispatch,
  moveTargets,
  onMovedTo,
  onMove,
}: {
  gift: Gift;
  index: number;
  count: number;
  person: Person;
  year: number;
  dispatch: Dispatch<Action>;
  moveTargets: MoveTarget[];
  onMovedTo: (personId: string) => void;
  /** Flytt opp (-1) eller ned (+1) i listen. */
  onMove: (delta: -1 | 1) => void;
}) {
  const id = useId();
  const focusKey = `gift-${gift.id}`;
  // En nyopprettet gave åpnes direkte i redigering.
  const [editing, setEditing] = useState(() => focusRequest.id === focusKey);
  // Ny gave: når den lagres første gang uten ting, åpnes første ting med en gang.
  const firstSave = useRef(editing);
  const focusField = useRef<'title' | 'budget'>('title');
  const [draftTitle, setDraftTitle] = useState(gift.title);
  const [draftBudget, setDraftBudget] = useState<number | null>(gift.budget);
  const [budgetValid, setBudgetValid] = useState(true);
  const titleRef = useRef<HTMLInputElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const addItemRef = useRef<HTMLButtonElement>(null);
  const refocusMenu = useRef(false);

  const bought = purchasedSum(gift);
  const planned = plannedSum(gift);
  const done = isGiftDone(gift);
  const giftName = giftLabel(gift, index);
  const info = budgetInfo(bought, gift.budget);

  useEffect(() => {
    if (editing) {
      if (focusField.current === 'budget') document.getElementById(`${id}-budget`)?.focus();
      else titleRef.current?.focus();
      if (focusRequest.id === focusKey) focusRequest.id = null;
    } else if (refocusMenu.current) {
      refocusMenu.current = false;
      menuBtn.current?.focus();
    }
  }, [editing, focusKey, id]);

  const startEdit = (field: 'title' | 'budget' = 'title') => {
    setDraftTitle(gift.title);
    setDraftBudget(gift.budget);
    setBudgetValid(true);
    focusField.current = field;
    setEditing(true);
  };

  const addItem = () => {
    const itemId = newId();
    focusRequest.id = `item-${itemId}`;
    dispatch({ type: 'item/add', giftId: gift.id, id: itemId });
  };

  // Elementet flyttes i DOM-en; sett fokus tilbake på menyknappen etterpå.
  const moveAndRefocus = (delta: -1 | 1) => {
    onMove(delta);
    requestAnimationFrame(() => menuBtn.current?.focus());
  };

  const stopEdit = () => {
    refocusMenu.current = true;
    setEditing(false);
  };

  return (
    <SortableItem kind="gift" id={gift.id} parentId={person.id} label={giftName} className={`gift ${done ? (info.state === 'under' ? 'is-done is-under' : 'is-done') : ''}`}>
      <div className="gift-head">
        {count > 1 && <DragHandle label={`Endre rekkefølge: ${giftName}`} />}
        <h4 className="gift-name">
          {giftName}
          <span className="visually-hidden"> til {person.name}</span>
        </h4>
        <label className="check gift-wrapped">
          <input
            type="checkbox"
            checked={gift.wrapped}
            onChange={(e) => dispatch({ type: 'gift/update', id: gift.id, patch: { wrapped: e.target.checked } })}
          />
          Pakket inn<span className="visually-hidden"> {giftName}</span>
        </label>
        <MoreMenu
          label={`Flere valg for ${giftName}`}
          buttonRef={menuBtn}
          entries={[
            {
              label: 'Rediger navn og budsjett',
              icon: 'edit',
              onSelect: () => startEdit(),
            },
            count > 1 && { label: 'Flytt opp', icon: 'up', disabled: index === 1, onSelect: () => moveAndRefocus(-1) },
            count > 1 && { label: 'Flytt ned', icon: 'down', disabled: index === count, onSelect: () => moveAndRefocus(1) },
            'separator',
            {
              label: 'Slett gave',
              icon: 'trash',
              danger: true,
              onSelect: () => {
                if (confirm(`Slette «${giftName}» og alle ting i den?`)) {
                  dispatch({ type: 'gift/delete', id: gift.id });
                  announce(`${giftName} slettet.`);
                }
              },
            },
          ]}
        />
      </div>

      <p className={`gift-meta state-${info.state}`}>
        <span>
          <strong>{formatKr(bought)}</strong>
          {gift.budget != null ? <> av {formatKr(gift.budget)}</> : ' kjøpt'}
        </span>
        {gift.budget != null ? (
          <span className="budget-label">{info.label}</span>
        ) : (
          !editing && (
            <button type="button" className="link-btn" onClick={() => startEdit('budget')}>
              + Budsjett<span className="visually-hidden"> for {giftName}</span>
            </button>
          )
        )}
        {planned > 0 && <span className="muted">planlagt {formatKr(planned)}</span>}
        {done && (
          <span className="badge done">
            <span aria-hidden="true">🎁 </span>Alt kjøpt
          </span>
        )}
        {allReceived(gift) && <span className="badge received">Alt mottatt</span>}
      </p>
      {gift.budget != null && (
        <div className={`state-${info.state}`}>
          <ProgressBar spent={bought} budget={gift.budget} name={giftName} />
        </div>
      )}

      {editing && (
        <form
          className="gift-edit"
          noValidate
          aria-label={`Rediger ${giftName}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (!budgetValid) return;
            dispatch({ type: 'gift/update', id: gift.id, patch: { title: draftTitle.trim(), budget: draftBudget } });
            if (firstSave.current && gift.items.length === 0) {
              firstSave.current = false;
              setEditing(false);
              addItem();
            } else {
              firstSave.current = false;
              stopEdit();
            }
          }}
          onKeyDown={(e) => e.key === 'Escape' && stopEdit()}
        >
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
          <div className="form-actions">
            <button type="submit">Lagre</button>
            <button type="button" className="ghost" onClick={stopEdit}>
              Avbryt
            </button>
          </div>
        </form>
      )}

      {gift.items.length > 0 && (
        <>
          <div className="item-legend" aria-hidden="true">
            <span />
            <span>Kjøpt</span>
            <span />
            <span className="num">Pris</span>
            <span>Mottatt</span>
            <span />
          </div>
          <SortableGroup ids={gift.items.map((i) => dragId('item', i.id))}>
          <ul className="items" aria-label={`Ting i ${giftName}`}>
            {gift.items.map((i, n) => (
              <ItemRow
                key={i.id}
                item={i}
                index={n + 1}
                count={gift.items.length}
                onMove={(delta) => {
                  const ids = gift.items.map((x) => x.id);
                  const to = n + delta;
                  if (to < 0 || to >= ids.length) return;
                  dispatch({ type: 'item/reorder', giftId: gift.id, ids: arrayMove(ids, n, to) });
                  announce(`${i.name.trim() || `Ting ${n + 1}`} flyttet til plass ${to + 1} av ${ids.length}.`);
                }}
                gift={gift}
                person={person}
                year={year}
                dispatch={dispatch}
                moveTargets={moveTargets}
                onMovedTo={onMovedTo}
                onRemoved={() => addItemRef.current?.focus()}
                onAddNext={addItem}
              />
            ))}
          </ul>
          </SortableGroup>
        </>
      )}
      <GiftDropTarget giftId={gift.id} personId={person.id} label={giftName}>
      <button
        ref={addItemRef}
        className="add-item ghost with-icon"
        onClick={addItem}
      >
        <Icon name="plus" />
        Legg til ting<span className="visually-hidden"> i {giftName}</span>
      </button>
      </GiftDropTarget>
    </SortableItem>
  );
}
