import { useEffect, useMemo, useState } from 'react';
import type { ActivityRow } from '@/lib/metrics/activity';
import { useTableSort, type SortColumns } from '@/hooks/useTableSort';
import { useSearch } from '@/lib/search';
import { FilterChips } from './ui/FilterChips';
import { SearchInput } from './ui/SearchInput';
import { SortSelect } from './ui/SortSelect';
import { Table, TableWrap, Td, Th } from './ui/Table';
import { NeutralBadge, WarningBadge } from './ui/Badge';
import { EmptyState } from './ui/states';
import { formatNumber, formatPercent } from '@/lib/format';

const SORT_COLUMNS: SortColumns<ActivityRow, ActivitySortKey> = {
  stamps: { label: 'Stamps issued', value: (r) => r.stamps },
  customers: { label: 'Customers', value: (r) => r.customers },
  transactions: { label: 'Transactions', value: (r) => r.transactions },
  // Null when an activity has no customers yet — those rows sort last.
  perCustomer: { label: 'Transactions / customer', value: (r) => r.transactionsPerCustomer },
  rewardStamp: { label: 'Stamps each', value: (r) => r.rewardStamp },
  name: { label: 'Name', value: (r) => r.name },
};

export type ActivitySortKey =
  | 'name'
  | 'rewardStamp'
  | 'customers'
  | 'transactions'
  | 'perCustomer'
  | 'stamps';

const perCustomer = (v: number | null) =>
  v === null ? '—' : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);

/** How the visible rows were narrowed, so a filename can say so. */
export interface ActivityScope {
  quest: string | null;
  query: string;
}

/**
 * Every activity, searchable by name, filterable by quest group and sortable
 * on any measure.
 *
 * Customers are drawn as a bar because the spread is the point — Daily Login
 * reaches ~315.000 people, most activities a few thousand — and a column of
 * bare numbers hides that. The bar is scaled to the largest row in view.
 *
 * Transactions per customer shows repeat behaviour: an activity people come
 * back to, rather than try once.
 */
export function ActivityTable({
  rows,
  query,
  onQueryChange,
  onVisibleRowsChange,
}: {
  rows: ActivityRow[];
  /** The search term, owned by the page so the global search can set it. */
  query: string;
  onQueryChange: (query: string) => void;
  /** Reports the filtered, sorted rows, so an export can match the screen. */
  onVisibleRowsChange?: (rows: ActivityRow[], scope: ActivityScope) => void;
}) {
  const [questId, setQuestId] = useState<number | null>(null);

  const quests = useMemo(() => {
    const seen = new Map<number, { label: string; count: number }>();
    for (const row of rows) {
      if (row.questId === null) continue;
      const entry = seen.get(row.questId);
      if (entry) entry.count += 1;
      else seen.set(row.questId, { label: row.quest, count: 1 });
    }
    return [...seen.entries()]
      .sort(([a], [b]) => a - b)
      .map(([value, { label, count }]) => ({ value, label: label.replace(/ Quest$/, ''), count }));
  }, [rows]);

  const chipped = useMemo(
    () => (questId === null ? rows : rows.filter((r) => r.questId === questId)),
    [rows, questId],
  );

  const filtered = useSearch(chipped, query, (r) => [r.name, r.id, r.quest]);

  const sort = useTableSort(filtered, SORT_COLUMNS, { key: 'stamps' }, (r) => r.name);
  const visible = sort.rows;

  // Keep the parent's export in step with what is on screen.
  const questName = questId === null ? null : rows.find((r) => r.questId === questId)?.quest ?? null;
  useEffect(() => {
    onVisibleRowsChange?.(visible, { quest: questName, query });
  }, [visible, questName, query, onVisibleRowsChange]);

  const maxCustomers = Math.max(...visible.map((r) => r.customers), 1);
  const visibleStamps = visible.reduce((t, r) => t + r.stamps, 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder="Activity name or ID…"
          className="w-full sm:w-56"
        />

        <FilterChips legend="Group" options={quests} selected={questId} onChange={setQuestId} allLabel="All groups" />

        {/* Phones have no column headers to click, so sorting gets a control. */}
        <SortSelect sort={sort} />
      </div>

      {(questId !== null || query !== '') && visible.length > 0 && (
        <p className="mb-3 text-micro text-ink-3">
          {formatNumber(visible.length)} activities · {formatNumber(visibleStamps)} stamps issued
          {questId !== null && query === '' ? ' in this group' : ' in this view'}
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={query === '' ? 'No activities in this group' : `Nothing matches “${query}”`}
          description={query === '' ? undefined : 'Clear the search or the group filter to see every activity.'}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th sort={sort.th('name')}>Activity</Th>
                    <Th>Group</Th>
                    <Th align="right" sort={sort.th('rewardStamp')}>Stamps each</Th>
                    <Th sort={sort.th('customers')}>Customers</Th>
                    <Th align="right" sort={sort.th('transactions')}>Transactions</Th>
                    <Th align="right" sort={sort.th('perCustomer')}>Txn / customer</Th>
                    <Th align="right" sort={sort.th('stamps')}>Stamps issued</Th>
                    <Th align="right">Share</Th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id} className={row.inactive ? 'text-ink-4' : ''}>
                      <Td className="max-w-[16rem] pr-3">
                        <span className="block truncate font-semibold text-ink-1" title={row.name}>
                          {row.name}
                        </span>
                        <span className="font-mono text-micro text-ink-4">{row.id}</span>
                        {row.reconciles === false && (
                          <span className="ml-1.5"><WarningBadge>stamps differ</WarningBadge></span>
                        )}
                        {row.inactive && (
                          <span className="ml-1.5"><NeutralBadge>No activity yet</NeutralBadge></span>
                        )}
                      </Td>
                      <Td className="pr-3 whitespace-nowrap text-ink-3">{row.quest}</Td>
                      <Td align="right" className="pr-3 text-ink-2">{formatNumber(row.rewardStamp)}</Td>
                      <Td className="w-44 pr-4">
                        <CustomerBar value={row.customers} max={maxCustomers} />
                      </Td>
                      <Td align="right" className="pr-3 text-ink-2">{formatNumber(row.transactions)}</Td>
                      <Td align="right" className="pr-3 text-ink-2">{perCustomer(row.transactionsPerCustomer)}</Td>
                      <Td align="right" className="pr-3 font-semibold text-ink-1">{formatNumber(row.stamps)}</Td>
                      <Td align="right" className="text-ink-2">{formatPercent(row.stampShare, 1)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>

          <ul className="space-y-2.5 md:hidden">
            {visible.map((row) => (
              <li key={row.id} className="rounded-control border border-line-1 px-3 py-2.5">
                <p className="font-semibold text-ink-1">{row.name}</p>
                <p className="text-micro text-ink-4">
                  {row.quest} · {formatNumber(row.rewardStamp)} stamp{row.rewardStamp === 1 ? '' : 's'} each
                </p>
                <div className="mt-2">
                  <p className="text-micro text-ink-4">Customers</p>
                  <CustomerBar value={row.customers} max={maxCustomers} />
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-line-2 pt-2">
                  <div>
                    <dt className="text-micro text-ink-4">Transactions</dt>
                    <dd className="tnum font-semibold text-ink-1">{formatNumber(row.transactions)}</dd>
                  </div>
                  <div>
                    <dt className="text-micro text-ink-4">Txn / customer</dt>
                    <dd className="tnum font-semibold text-ink-1">{perCustomer(row.transactionsPerCustomer)}</dd>
                  </div>
                  <div>
                    <dt className="text-micro text-ink-4">Stamps</dt>
                    <dd className="tnum font-semibold text-ink-1">{formatNumber(row.stamps)}</dd>
                    <dd className="text-micro text-ink-4">{formatPercent(row.stampShare, 1)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function CustomerBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 flex-1 overflow-hidden rounded-pill bg-line-2"
        role="img"
        aria-label={`${formatNumber(value)} customers`}
      >
        <div
          className="h-full rounded-pill"
          style={{ width: `${Math.max((value / max) * 100, value > 0 ? 1.5 : 0)}%`, background: 'var(--color-chart-1)' }}
        />
      </div>
      <span className="w-16 shrink-0 text-right tnum text-micro font-semibold text-ink-2">{formatNumber(value)}</span>
    </div>
  );
}
