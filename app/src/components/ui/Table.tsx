import type { ReactNode } from 'react';

/** A table that scrolls horizontally rather than forcing the page to. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">{children}</div>;
}

export function Table({ children }: { children: ReactNode }) {
  return <table className="w-full border-collapse text-left">{children}</table>;
}

export function Th({
  children,
  align = 'left',
  className = '',
  sort,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  /** Present when the column is sortable. */
  sort?: { active: boolean; direction: 'asc' | 'desc'; onClick: () => void };
}) {
  const base = `border-b border-line-1 py-2 text-micro font-semibold uppercase tracking-wide whitespace-nowrap ${
    align === 'right' ? 'text-right' : 'text-left'
  } ${className}`;

  if (!sort) return <th className={`${base} text-ink-4`}>{children}</th>;

  return (
    <th className={`${base} p-0`} aria-sort={sort.active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={sort.onClick}
        className={`flex w-full items-center gap-1 py-2 text-micro font-semibold uppercase tracking-wide ${
          align === 'right' ? 'justify-end' : ''
        } ${sort.active ? 'text-ink-1' : 'text-ink-4 hover:text-ink-2'}`}
      >
        {children}
        <span aria-hidden className={sort.active ? '' : 'opacity-0'}>
          {sort.direction === 'asc' ? '↑' : '↓'}
        </span>
      </button>
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td
      className={`border-b border-line-2 py-2.5 ${align === 'right' ? 'text-right tnum' : ''} ${className}`}
    >
      {children}
    </td>
  );
}

/** Movement since the previous snapshot, or a dash when there is only one. */
export function ChangeCell({
  value,
  format = (v) => String(v),
}: {
  value: number | null | undefined;
  format?: (v: number) => string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-ink-5">—</span>;
  }
  if (value === 0) return <span className="text-ink-4">0</span>;
  return (
    <span className={value > 0 ? 'font-semibold text-success' : 'font-semibold text-danger'}>
      {value > 0 ? '+' : '−'}
      {format(Math.abs(value))}
    </span>
  );
}
