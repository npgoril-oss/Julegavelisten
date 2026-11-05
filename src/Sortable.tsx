import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type Modifier,
  type Over,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './icons';

/**
 * Én felles dra-og-slipp-sone for hele listen. Hvert element har en type:
 *  - person: kan sorteres blant personer
 *  - gift:   kan sorteres blant gavene til samme person
 *  - item:   kan sorteres i gaven og flyttes til en annen (åpen) gave
 * Mål av feil type er slått av mens noe dras, slik at både mus og tastatur bare treffer gyldige plasser.
 *
 * Dra skjer kun via håndtaket, så scrolling på mobil ikke påvirkes. Alternativ uten dra
 * (WCAG 2.5.7) finnes i ⋯-menyene: «Flytt opp/ned» og «Flytt til annen gave».
 */
export type DragKind = 'person' | 'gift' | 'item';

export interface DragData {
  kind: DragKind | 'giftDrop';
  /** Id-en i datamodellen (uten prefiks). */
  id: string;
  /** Person (for gaver) eller gave (for ting) elementet hører til. */
  parentId: string;
  label: string;
  /** Satt av dnd-kit for sorterbare elementer. */
  sortable?: { containerId: string; index: number; items: string[] };
}

export const dragId = (kind: DragKind, id: string) => `${kind}:${id}`;

const dataOf = (x: Active | Over | null | undefined) => x?.data.current as DragData | undefined;

/** Bare vertikal flytting. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/**
 * Nærmeste mål målt kun loddrett. Siden alt flyttes opp/ned, skal ikke ulik bredde
 * (f.eks. «Legg til ting»-knappen mot en hel rad) påvirke hvor elementet havner.
 */
const closestCenterY: CollisionDetection = ({ collisionRect, droppableRects, droppableContainers }) => {
  const cy = collisionRect.top + collisionRect.height / 2;
  return droppableContainers
    .flatMap((container) => {
      const rect = droppableRects.get(container.id);
      if (!rect) return [];
      return [{ id: container.id, data: { droppableContainer: container, value: Math.abs(rect.top + rect.height / 2 - cy) } }];
    })
    .sort((a, b) => a.data.value - b.data.value);
};

export interface DropResult {
  active: DragData;
  over: DragData;
}

export function DragRoot({ onDrop, children }: { onDrop: (r: DropResult) => void; children: ReactNode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const place = (d?: DragData) => (d?.sortable ? `plass ${d.sortable.index + 1} av ${d.sortable.items.length}` : '');

  const describeOver = (a?: DragData, o?: DragData) => {
    if (!o) return 'utenfor listen';
    if (o.kind === 'giftDrop') return `sist i ${o.label}`;
    if (a?.kind === 'item' && o.parentId !== a.parentId) return `ved ${o.label} i en annen gave`;
    return place(o);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Plukket opp ${dataOf(active)?.label}. ${place(dataOf(active))}.`,
    onDragOver: ({ active, over }) => `${dataOf(active)?.label} er ${describeOver(dataOf(active), dataOf(over))}.`,
    onDragEnd: ({ active, over }) =>
      over ? `${dataOf(active)?.label} sluppet ${describeOver(dataOf(active), dataOf(over))}.` : `${dataOf(active)?.label} sluppet.`,
    onDragCancel: ({ active }) => `Flytting avbrutt. ${dataOf(active)?.label} er tilbake der den var.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const a = dataOf(active);
    const o = dataOf(over);
    if (!a || !o || active.id === over?.id) return;
    onDrop({ active: a, over: o });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenterY}
      modifiers={[verticalOnly]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Trykk mellomrom eller Enter for å plukke opp. Bruk piltast opp og ned for å flytte, mellomrom for å slippe og Escape for å avbryte.',
        },
      }}
    >
      {children}
    </DndContext>
  );
}

/** En liste med sorterbare elementer (personer, gavene til én person, eller tingene i én gave). */
export function SortableGroup({ ids, children }: { ids: string[]; children: ReactNode }) {
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

/** Kan et element av typen `kind` med forelder `parentId` ta imot det som dras nå? */
function useAccepts(kind: DragKind, parentId: string): boolean {
  const { active } = useDndContext();
  const a = dataOf(active);
  if (!a) return true;
  if (a.kind === 'item') return kind === 'item';
  if (a.kind === 'gift') return kind === 'gift' && parentId === a.parentId;
  return kind === a.kind;
}

const HandleContext = createContext<ReturnType<typeof useSortable> | null>(null);

/** Ett sorterbart element. Rendrer et <li> og gir håndtaket tilgang til dra-logikken. */
export function SortableItem({
  kind,
  id,
  parentId = '',
  label,
  className,
  children,
}: {
  kind: DragKind;
  id: string;
  parentId?: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const accepts = useAccepts(kind, parentId);
  const sortable = useSortable({
    id: dragId(kind, id),
    data: { kind, id, parentId, label } satisfies DragData,
    disabled: { droppable: !accepts },
  });
  const a = dataOf(sortable.active);
  // Viser hvor en ting fra en annen gave havner.
  const foreignTarget = sortable.isOver && a?.kind === 'item' && kind === 'item' && a.parentId !== parentId;
  const style: CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className={`${className ?? ''}${sortable.isDragging ? ' dragging' : ''}${foreignTarget ? ' drop-before' : ''}`}
    >
      <HandleContext.Provider value={sortable}>{children}</HandleContext.Provider>
    </li>
  );
}

/**
 * Gjør «Legg til ting»-området i en gave til slippmål mens en ting dras (legg tingen sist i gaven).
 * Området finnes allerede, så ingenting hopper når man begynner å dra. Egen gave er ikke et mål.
 */
export function GiftDropTarget({
  giftId,
  personId,
  label,
  children,
}: {
  giftId: string;
  personId: string;
  label: string;
  children: ReactNode;
}) {
  const { active } = useDndContext();
  const a = dataOf(active);
  const enabled = a?.kind === 'item' && a.parentId !== giftId;
  const { setNodeRef, isOver } = useDroppable({
    id: `giftDrop:${giftId}`,
    data: { kind: 'giftDrop', id: giftId, parentId: personId, label } satisfies DragData,
    disabled: !enabled,
  });
  return (
    <div ref={setNodeRef} className={`gift-drop-target${enabled ? ' active' : ''}${isOver ? ' over' : ''}`}>
      {children}
    </div>
  );
}

export function DragHandle({ label }: { label: string }) {
  const sortable = useContext(HandleContext);
  if (!sortable) return null;
  return (
    <button
      type="button"
      className="drag-handle icon-btn ghost"
      ref={sortable.setActivatorNodeRef}
      title="Dra for å flytte"
      {...sortable.attributes}
      {...sortable.listeners}
      aria-roledescription="flyttbar"
    >
      <Icon name="grip" />
      <span className="visually-hidden">{label}</span>
    </button>
  );
}
