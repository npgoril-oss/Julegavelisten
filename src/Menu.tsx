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
      /** Ett av flere gjensidig utelukkende valg: viser hake i stedet for «På/Av». */
      choice?: boolean;
    }
  | 'separator'
  | false
  | null;

/**
 * «Flere valg»-meny som disclosure-mønster: en knapp som viser/skjuler en liste med vanlige knapper.
 * Enklere og mer robust for skjermlesere enn role="menu". Piltaster flytter mellom valgene,
 * Escape lukker og setter fokus tilbake på knappen.
 *
 * Bevisst uavhengig av fokus- og pointerdown-hendelser, som Safari på iPhone behandler annerledes
 * (knapper får ikke fokus ved trykk). Menyen lukkes kun av: et valg, Escape, Tab, eller et klikk utenfor.
 * Fokus flyttes inn i menyen bare når den åpnes med tastatur.
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

  const openedByKeyboard = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (openedByKeyboard.current) buttons()[0]?.focus();
    // Lukk ved klikk utenfor. Klikket som åpnet menyen er allerede ferdig når denne registreres.
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab') {
      // La fokus flytte seg som vanlig, men lukk menyen.
      setOpen(false);
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
      onKeyDown={onKeyDown}
    >
      <IconButton
        ref={triggerRef}
        icon="more"
        label={label}
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={(e) => {
          // detail === 0: aktivert med tastatur (Enter/mellomrom), ikke med mus eller finger.
          openedByKeyboard.current = e.detail === 0;
          setOpen((o) => !o);
        }}
      />
      {open && (
        <ul id={`${id}-menu`} className="menu" ref={listRef}>
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
                  {entry.pressed !== undefined &&
                    (entry.choice ? (
                      <span className="menu-state" aria-hidden="true">
                        {entry.pressed ? '✓' : ''}
                      </span>
                    ) : (
                      <span className="menu-state">{entry.pressed ? 'På' : 'Av'}</span>
                    ))}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
