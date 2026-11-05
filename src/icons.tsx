import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

const paths = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  archive: 'M3 3h18v5H3zM4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4',
  restore: 'M3 3h18v5H3zM4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M12 18v-6M9 15l3-3 3 3',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  move: 'M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16',
  link: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/**
 * Knapp med bare ikon. `label` blir knappens tilgjengelige navn (skjermleser, talestyring)
 * og vises som tooltip via title (styrt av nettleseren, så WCAG 1.4.13 gjelder ikke).
 */
export function IconButton({
  icon,
  label,
  danger,
  ref,
  ...rest
}: {
  icon: IconName;
  label: ReactNode;
  danger?: boolean;
  ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      ref={ref}
      type="button"
      className={`icon-btn ghost${danger ? ' danger' : ''}`}
      title={typeof label === 'string' ? label : undefined}
      {...rest}
    >
      <Icon name={icon} />
      <span className="visually-hidden">{label}</span>
    </button>
  );
}
