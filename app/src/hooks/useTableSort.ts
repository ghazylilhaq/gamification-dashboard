import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export interface SortColumn<T> {
  /** Shown in the mobile sort picker. */
  label: string;
  /**
   * The value the column sorts on. Strings compare with localeCompare,
   * numbers numerically. Null means "no value" and always sorts last,
   * whichever direction is active — an empty cell is never the answer to
   * "which is biggest?".
   */
  value: (row: T) => number | string | null;
  /**
   * Which way the column reads first. Defaults to ascending for text
   * (A→Z) and descending for measures (biggest first), which is what a
   * reader expects from a first click.
   */
  defaultDir?: SortDir;
  /** Replaces `value` when a column needs its own ordering rules. */
  compare?: (a: T, b: T) => number;
  /**
   * How the direction is worded in the sort summary. Inferred from the
   * values otherwise — dates are the one kind that cannot be, since they
   * are stored as text but read as newest/oldest.
   */
  order?: 'text' | 'measure' | 'date';
}

export type SortColumns<T, K extends string> = Record<K, SortColumn<T>>;

export interface TableSort<T, K extends string> {
  /** The rows in their sorted order. */
  rows: T[];
  sort: { key: K; dir: SortDir };
  setSort: (sort: { key: K; dir: SortDir }) => void;
  /** Spread onto a `<Th sort={...}>` to make that header sortable. */
  th: (key: K) => { active: boolean; direction: SortDir; onClick: () => void };
  columns: SortColumns<T, K>;
  keys: K[];
  defaultDir: (key: K) => SortDir;
  /** Plain-English description of the order, for a section heading. */
  summary: string;
}

function naturalDir<T>(column: SortColumn<T>, rows: T[]): SortDir {
  if (column.defaultDir) return column.defaultDir;
  if (column.compare) return 'asc';
  const sample = rows.find((row) => column.value(row) !== null);
  return sample !== undefined && typeof column.value(sample) === 'string' ? 'asc' : 'desc';
}

function describe<T>(column: SortColumn<T>, rows: T[], dir: SortDir): string {
  const label = column.label.toLowerCase();
  const sample = column.compare ? undefined : rows.find((row) => column.value(row) !== null);
  const kind =
    column.order ??
    (sample !== undefined && typeof column.value(sample) === 'string' ? 'text' : 'measure');

  if (kind === 'date') return `${label}, ${dir === 'asc' ? 'oldest' : 'newest'} first`;
  if (kind === 'text') return `${label}, ${dir === 'asc' ? 'A→Z' : 'Z→A'}`;
  return `${label}, ${dir === 'asc' ? 'lowest' : 'highest'} first`;
}

function compareValues(a: number | string | null, b: number | string | null, dir: SortDir): number {
  // Nulls are parked at the bottom in both directions, so the sign is
  // applied before they are considered.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const cmp = typeof a === 'string' ? a.localeCompare(String(b)) : (a as number) - (b as number);
  return dir === 'asc' ? cmp : -cmp;
}

/**
 * Click-to-sort for a table, shared by every table in the dashboard so they
 * all behave the same: first click uses the column's natural direction, a
 * second click reverses it, empty values stay at the bottom, and ties fall
 * back to a stable key so rows never shuffle between renders.
 *
 * The hook sorts the rows it is given — filter first, then sort — and the
 * result feeds the desktop table, the mobile card list and the CSV export
 * alike, so all three agree on the order.
 */
export function useTableSort<T, K extends string>(
  rows: T[],
  columns: SortColumns<T, K>,
  // NoInfer keeps the key set coming from `columns`; without it a single
  // initial key like 'stamps' would narrow K to that one literal.
  initial: { key: NoInfer<K>; dir?: SortDir },
  /** Tiebreaker, so equal rows keep a fixed order. */
  tiebreak?: (row: T) => string,
): TableSort<T, K> {
  const keys = Object.keys(columns) as K[];

  const defaultDir = (key: K): SortDir => naturalDir(columns[key], rows);

  const [sort, setSort] = useState<{ key: K; dir: SortDir }>({
    key: initial.key,
    dir: initial.dir ?? naturalDir(columns[initial.key], rows),
  });

  // A column can disappear when a page swaps datasets; fall back rather
  // than sorting by a key that no longer exists.
  const active: { key: K; dir: SortDir } = columns[sort.key] ? sort : { key: initial.key, dir: initial.dir ?? 'desc' };

  const sorted = useMemo(() => {
    const column = columns[active.key];
    const sign = active.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const cmp = column.compare
        ? sign * column.compare(a, b)
        : compareValues(column.value(a), column.value(b), active.dir);
      if (cmp !== 0) return cmp;
      return tiebreak ? tiebreak(a).localeCompare(tiebreak(b)) : 0;
    });
    // `columns` and `tiebreak` are rebuilt every render by callers, so the
    // rows and the active sort are what the order actually depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, active.key, active.dir]);

  return {
    rows: sorted,
    sort: active,
    setSort,
    th: (key: K) => ({
      active: active.key === key,
      direction: active.key === key ? active.dir : defaultDir(key),
      onClick: () =>
        setSort(
          active.key === key
            ? { key, dir: active.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: defaultDir(key) },
        ),
    }),
    columns,
    keys,
    defaultDir,
    summary: describe(columns[active.key], rows, active.dir),
  };
}
