import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Icon, IconButton, type IconName } from './icons';

export type MenuEntry =
  | {
      label: string;
      icon?: IconName;
      onSelect: () => void;
      danger?: boolean;
      disabled?: boolean;
      /** For av/på-valg (aria-pressed). */
      pressed?: boolean;
    }
  | 'separator'
  | false
  | null;

/**
 * «Flere valg»-meny som disclosure-mønster: en knapp som viser/skjuler en liste med vanlige knapper.
 * Enklere og mer robust for skjermlesere enn role="menu". Piltaster flytter mellom valgene,
 * Escape lukker og setter fokus tilbake på knappen.
 */
export function MoreMenu({
  label,
  entries,
  className = '',
  buttonRef,
}: {
  label: string;
  entries: MenuEntry[];
  className?: string;
  /** Gir forelderen mulighet til å sette fokus tilbake på knappen. */
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const ownRef = useRef<HTMLButtonElement>(null);
  const triggerRef = buttonRef ?? ownRef;
  const listRef = useRef<HTMLUListElement>(null);
  const items = entries.filter((e): e is Exclude<MenuEntry, false | null> => !!e);

  const buttons = () => [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];

  useEffect(() => {
    if (!open) return;
    buttons()[0]?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const list = buttons();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div
      className={`menu-wrap ${className}`}
      ref={wrapRef}
      onBlur={(e) => {
        if (open && !wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <IconButton
        ref={triggerRef}
        icon="more"
        label={label}
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <ul id={`${id}-menu`} className="menu" ref={listRef} onKeyDown={onKeyDown}>
          {items.map((entry, i) =>
            entry === 'separator' ? (
              <li key={`sep-${i}`} className="menu-sep" aria-hidden="true" />
            ) : (
              <li key={entry.label}>
                <button
                  type="button"
                  className={entry.danger ? 'danger' : undefined}
                  disabled={entry.disabled}
                  aria-pressed={entry.pressed}
                  onClick={() => {
                    close();
                    entry.onSelect();
                  }}
                >
                  {entry.icon && <Icon name={entry.icon} />}
                  <span>{entry.label}</span>
                  {entry.pressed !== undefined && <span className="menu-state">{entry.pressed ? 'På' : 'Av'}</span>}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
