import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './icons';

/** Bare vertikal flytting. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/**
 * Sorterbar liste med dra-og-slipp (mus, berøring og tastatur).
 * Dra skjer kun via håndtaket, så vanlig scrolling på mobil ikke påvirkes.
 * Merk: dra krever et alternativ med ett trykk (WCAG 2.5.7) – det er «Flytt opp/ned» i ⋯-menyene.
 */
export function SortableList({
  ids,
  labelOf,
  onReorder,
  children,
}: {
  ids: string[];
  labelOf: (id: UniqueIdentifier) => string;
  onReorder: (ids: string[]) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const pos = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Plukket opp ${labelOf(active.id)}. Plass ${pos(active.id)} av ${ids.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${labelOf(active.id)} er over plass ${pos(over.id)} av ${ids.length}.` : `${labelOf(active.id)} er utenfor listen.`,
    onDragEnd: ({ active, over }) =>
      over ? `${labelOf(active.id)} sluppet på plass ${pos(over.id)} av ${ids.length}.` : `${labelOf(active.id)} sluppet.`,
    onDragCancel: ({ active }) => `Flytting avbrutt. ${labelOf(active.id)} er tilbake på plass ${pos(active.id)}.`,
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
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
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

const HandleContext = createContext<ReturnType<typeof useSortable> | null>(null);

/** Ett sorterbart element. Rendrer et <li> og gir håndtaket tilgang til dra-logikken. */
export function SortableItem({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const sortable = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className={`${className ?? ''}${sortable.isDragging ? ' dragging' : ''}`}
    >
      <HandleContext.Provider value={sortable}>{children}</HandleContext.Provider>
    </li>
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
      title="Dra for å endre rekkefølge"
      {...sortable.attributes}
      {...sortable.listeners}
      aria-describedby={sortable.attributes['aria-describedby']}
      aria-roledescription="sorterbar"
    >
      <Icon name="grip" />
      <span className="visually-hidden">{label}</span>
    </button>
  );
}
