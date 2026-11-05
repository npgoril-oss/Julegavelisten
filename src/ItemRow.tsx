import { useEffect, useId, useRef, useState, type Dispatch } from 'react';
import type { Gift, Item, Person } from './types';
import { newId, type Action } from './store';
import { formatKr } from './logic';
import { Icon } from './icons';
import { MoreMenu } from './Menu';
import { DragHandle, SortableItem } from './Sortable';
import { MoneyInput, announce, focusRequest, type MoveTarget } from './ui';

const NEW_GIFT = '__ny__';

/** Én ting i en gave: kompakt linje, med redigering og flytting i eget panel. */
export function ItemRow({
  item,
  index,
  count,
  onMove,
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
  count: number;
  /** Flytt opp (-1) eller ned (+1) i gaven. */
  onMove: (delta: -1 | 1) => void;
  gift: Gift;
  person: Person;
  year: number;
  dispatch: Dispatch<Action>;
  moveTargets: MoveTarget[];
  onMovedTo: (personId: string) => void;
  onRemoved: () => void;
}) {
  const id = useId();
  const focusKey = `item-${item.id}`;
  // Ny (tom) ting åpnes i redigering. En flyttet ting har samme fokusnøkkel, men er ikke tom.
  const [isNew] = useState(() => focusRequest.id === focusKey && !item.name && !item.price);
  const [mode, setMode] = useState<'view' | 'edit' | 'move'>(isNew ? 'edit' : 'view');
  const [draft, setDraft] = useState({ name: item.name, price: item.price, link: item.link, note: item.note });
  const [priceValid, setPriceValid] = useState(true);
  const [target, setTarget] = useState('');
  const menuBtn = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const refocusMenu = useRef(false);

  const update = (patch: Partial<Omit<Item, 'id'>>) =>
    dispatch({ type: 'item/update', giftId: gift.id, id: item.id, patch });
  const safeLink = /^https?:\/\//i.test(item.link) ? item.link : null;
  const itemName = item.name.trim() || `Ting ${index}`;

  // Fokus etter at en ting er flyttet hit.
  useEffect(() => {
    if (!isNew && focusRequest.id === focusKey) {
      focusRequest.id = null;
      menuBtn.current?.focus();
    }
  }, [isNew, focusKey]);

  useEffect(() => {
    if (mode === 'edit') nameInputRef.current?.focus();
    if (mode === 'move') selectRef.current?.focus();
    if (mode === 'view' && refocusMenu.current) {
      refocusMenu.current = false;
      menuBtn.current?.focus();
    }
    if (isNew && focusRequest.id === focusKey) focusRequest.id = null;
  }, [mode, isNew, focusKey]);

  const backToView = () => {
    refocusMenu.current = true;
    setMode('view');
  };

  const remove = () => {
    dispatch({ type: 'item/delete', giftId: gift.id, id: item.id });
    onRemoved();
  };

  const cancelEdit = () => {
    // Avbryt på en helt ny, tom ting fjerner den igjen.
    if (isNew && !item.name && !item.price && !item.link && !item.note) remove();
    else backToView();
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
    focusRequest.id = focusKey;
    onMovedTo(toPersonId);
    dispatch({ type: 'item/move', fromGiftId: gift.id, id: item.id, toGiftId });
    announce(`«${itemName}» flyttet til ${toLabel}.`);
  };

  if (mode === 'edit') {
    return (
      <SortableItem kind="item" id={item.id} parentId={gift.id} label={itemName} className="item editing">
        <form
          className="item-edit"
          noValidate
          aria-label={`Rediger ${itemName}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (!priceValid) return;
            update({ ...draft, name: draft.name.trim(), link: draft.link.trim() });
            backToView();
          }}
          onKeyDown={(e) => e.key === 'Escape' && cancelEdit()}
        >
          <div className="field f-name">
            <label htmlFor={`${id}-name`}>Navn / beskrivelse</label>
            <input
              id={`${id}-name`}
              ref={nameInputRef}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="field f-price">
            <label htmlFor={`${id}-price`}>Pris (kr)</label>
            <MoneyInput
              id={`${id}-price`}
              value={draft.price}
              onChange={(v) => setDraft((d) => ({ ...d, price: v ?? 0 }))}
              onValidChange={setPriceValid}
            />
          </div>
          <div className="field f-link">
            <label htmlFor={`${id}-link`}>Lenke</label>
            <input
              id={`${id}-link`}
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              value={draft.link}
              onChange={(e) => setDraft({ ...draft, link: e.target.value })}
            />
          </div>
          <div className="field f-note">
            <label htmlFor={`${id}-note`}>Notat</label>
            <input id={`${id}-note`} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </div>
          <div className="form-actions">
            <button type="submit">Lagre</button>
            <button type="button" className="ghost" onClick={cancelEdit}>
              Avbryt
            </button>
          </div>
        </form>
      </SortableItem>
    );
  }

  return (
    <SortableItem kind="item" id={item.id} parentId={gift.id} label={itemName} className={`item ${item.purchased ? 'purchased' : ''}`}>
      <DragHandle label={`Flytt ${itemName}`} />
      <label className="item-bought">
        <input type="checkbox" checked={item.purchased} onChange={(e) => update({ purchased: e.target.checked })} />
        <span className="item-text">
          <span className="visually-hidden">Kjøpt: </span>
          <span className="item-name">{itemName}</span>
          {item.note && <span className="item-note">{item.note}</span>}
        </span>
      </label>
      {safeLink ? (
        <a className="item-link" href={safeLink} target="_blank" rel="noopener noreferrer" title="Åpne lenke (ny fane)">
          <Icon name="link" />
          <span className="visually-hidden">Åpne lenke til {itemName} (ny fane)</span>
        </a>
      ) : (
        <span className="item-link" aria-hidden="true" />
      )}
      <span className="item-price">{formatKr(item.price)}</span>
      <label className="item-received" title="Mottatt">
        <input type="checkbox" checked={item.received} onChange={(e) => update({ received: e.target.checked })} />
        <span className="visually-hidden">Mottatt: {itemName}</span>
      </label>
      <MoreMenu
        label={`Flere valg for ${itemName}`}
        buttonRef={menuBtn}
        entries={[
          {
            label: 'Rediger',
            icon: 'edit',
            onSelect: () => {
              setDraft({ name: item.name, price: item.price, link: item.link, note: item.note });
              setPriceValid(true);
              setMode('edit');
            },
          },
          count > 1 && {
            label: 'Flytt opp',
            icon: 'up',
            disabled: index === 1,
            onSelect: () => {
              onMove(-1);
              requestAnimationFrame(() => menuBtn.current?.focus());
            },
          },
          count > 1 && {
            label: 'Flytt ned',
            icon: 'down',
            disabled: index === count,
            onSelect: () => {
              onMove(1);
              requestAnimationFrame(() => menuBtn.current?.focus());
            },
          },
          {
            label: 'Flytt til annen gave',
            icon: 'move',
            onSelect: () => {
              setTarget('');
              setMode('move');
            },
          },
          'separator',
          {
            label: 'Slett',
            icon: 'trash',
            danger: true,
            onSelect: () => {
              if (confirm(`Slette «${itemName}»?`)) {
                remove();
                announce(`«${itemName}» slettet.`);
              }
            },
          },
        ]}
      />

      {mode === 'move' && (
        <form
          className="move-panel"
          onSubmit={(e) => {
            e.preventDefault();
            doMove();
          }}
          onKeyDown={(e) => e.key === 'Escape' && backToView()}
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
          <button type="button" className="ghost" onClick={backToView}>
            Avbryt
          </button>
        </form>
      )}
    </SortableItem>
  );
}
