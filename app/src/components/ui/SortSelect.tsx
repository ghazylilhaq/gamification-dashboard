import type { TableSort } from '@/hooks/useTableSort';

/**
 * Sorting for the card lists that replace tables on a phone, where there are
 * no column headers to click. Hidden on the widths that show the real table.
 */
export function SortSelect<T, K extends string>({
  sort,
  className = '',
  hideFrom = 'md',
}: {
  sort: TableSort<T, K>;
  className?: string;
  /** The breakpoint at which the desktop table takes over. */
  hideFrom?: 'md' | 'lg';
}) {
  const hidden = hideFrom === 'lg' ? 'lg:hidden' : 'md:hidden';

  return (
    <label className={`flex items-center gap-2 text-micro text-ink-3 ${hidden} ${className}`}>
      Sort by
      <select
        value={`${sort.sort.key}:${sort.sort.dir}`}
        onChange={(e) => {
          const [key, dir] = e.target.value.split(':') as [K, 'asc' | 'desc'];
          sort.setSort({ key, dir });
        }}
        className="rounded-control border border-line-1 bg-surface-1 px-2 py-1.5 text-ink-2"
      >
        {sort.keys.map((key) => {
          const dir = sort.sort.key === key ? sort.sort.dir : sort.defaultDir(key);
          return (
            <option key={key} value={`${key}:${dir}`}>
              {sort.columns[key].label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
