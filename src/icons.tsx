import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

const paths = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  archive: 'M3 3h18v5H3zM4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4',
  restore: 'M3 3h18v5H3zM4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M12 18v-6M9 15l3-3 3 3',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  move: 'M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16',
  link: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  sort: 'M3 6h11M3 12h8M3 18h5M17 4v16M14 17l3 3 3-3',
  collapse: 'M7 11l5-5 5 5M7 18l5-5 5 5',
  expand: 'M7 6l5 5 5-5M7 13l5 5 5-5',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM11 18h2',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
} as const;

const DOT_ICONS = new Set<IconName>(['more', 'grip']);

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
      strokeWidth={DOT_ICONS.has(name) ? 3.5 : 2}
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
  className,
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
      className={`icon-btn ghost${danger ? ' danger' : ''}${className ? ` ${className}` : ''}`}
      title={typeof label === 'string' ? label : undefined}
      {...rest}
    >
      <Icon name={icon} />
      <span className="visually-hidden">{label}</span>
    </button>
  );
}
