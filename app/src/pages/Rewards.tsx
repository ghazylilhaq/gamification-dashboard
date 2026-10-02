import { useMemo, useState } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { FirstRun } from '@/components/FirstRun';
import { Card, SectionHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterChips } from '@/components/ui/FilterChips';
import { SortSelect } from '@/components/ui/SortSelect';
import { ChangeCell, Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { RarityBadge, TypeBadge, NeutralBadge } from '@/components/ui/Badge';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { StockBar } from '@/components/StockAlerts';
import { DataNote, EmptyState, ErrorState, LoadingKpis, Skeleton } from '@/components/ui/states';
import { freshnessText } from '@/components/Freshness';
import { rewardRows, topByClaims, topBySpend, type RewardRow } from '@/lib/metrics/rewards';
import { useTableSort, type SortColumns } from '@/hooks/useTableSort';
import { formatNumber, formatPercent, formatRupiah } from '@/lib/format';
import { DownloadButton } from '@/components/DownloadButton';
import { rewardColumns } from '@/lib/csv/columns';
import { exportName } from '@/lib/csv/exportContext';

type SortKey = 'stock' | 'claimed' | 'redeemed' | 'rate' | 'spend' | 'weight' | 'name' | 'box' | 'rarity' | 'type' | 'change';

/** Rarity reads by scarcity, not alphabetically. */
const RARITY_ORDER: Record<string, number> = { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3 };

const SORT_COLUMNS: SortColumns<RewardRow, SortKey> = {
  name: { label: 'Reward name', value: (r) => r.name },
  // Boxes read up the ladder, by the stamps they cost.
  box: { label: 'Box', value: (r) => r.stampRequired, defaultDir: 'asc' },
  rarity: { label: 'Rarity', value: (r) => RARITY_ORDER[r.rarity] ?? -1, defaultDir: 'desc' },
  type: { label: 'Type', value: (r) => r.type },
  weight: { label: 'Odds', value: (r) => r.weight },
  // Lowest stock first, the table's default: closest to running out at the
  // top. "No stock set" has no position on the scale, so null parks it at
  // the bottom either way.
  stock: { label: 'Stock left', value: (r) => r.stockLeftPct, defaultDir: 'asc' },
  claimed: { label: 'Claimed', value: (r) => r.claimed },
  redeemed: { label: 'Redeemed', value: (r) => (r.type === 'CASHBACK' ? null : r.redeemed) },
  rate: { label: 'Redemption rate', value: (r) => (r.type === 'CASHBACK' ? null : r.redemptionRate) },
  spend: { label: 'Spend', value: (r) => r.spend },
  change: { label: 'Spend change', value: (r) => r.change?.spend ?? null },
};

export function Rewards() {
  const { dataset, loading, error, reload, raw, hasAnyData, filter } = useDashboard();
  const [boxId, setBoxId] = useState<number | null>(null);
  const [type, setType] = useState<string | null>(null);

  const all = useMemo(() => (dataset ? rewardRows(dataset) : []), [dataset]);

  const matching = useMemo(
    () => all.filter((r) => (boxId === null || r.boxId === boxId) && (type === null || r.type === type)),
    [all, boxId, type],
  );

  const sort = useTableSort(matching, SORT_COLUMNS, { key: 'stock' }, (r) => r.name);
  const filtered = sort.rows;

  if (loading) {
    return (
      <>
        <PageHeader title="Rewards" description="All rewards with stock, claims, redemptions and spend" />
        <LoadingKpis count={2} />
        <Card className="mt-4"><Skeleton className="h-96" /></Card>
      </>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!dataset || !raw) return null;
  if (!hasAnyData) return <FirstRun page="Rewards" />;

  const boxOptions = dataset.boxesByStamp.map((b) => ({
    value: b.id,
    label: b.name_en.replace(/ Box$/, ''),
    count: all.filter((r) => r.boxId === b.id).length,
  }));
  const typeOptions = [
    { value: 'CASHBACK', label: 'Cashback', count: all.filter((r) => r.type === 'CASHBACK').length },
    { value: 'COUPON', label: 'Coupon', count: all.filter((r) => r.type === 'COUPON').length },
  ];

  const hasSecondSnapshot = dataset.prevRewardSnapshot.length > 0 || dataset.prevSpendSnapshot.length > 0;
  return (
    <>
      <PageHeader
        title="Rewards"
        description={`All ${formatNumber(all.length)} rewards with stock, claims, redemptions and spend`}
        freshness={freshnessText(raw.freshness, ['claims', 'spend'])}
      />

      <Card label="Reward filters" className="mb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
          <FilterChips legend="Box" options={boxOptions} selected={boxId} onChange={setBoxId} allLabel="All boxes" />
          <FilterChips legend="Type" options={typeOptions} selected={type} onChange={setType} allLabel="Both" />
          {/* The phone list has no headers to click. */}
          <SortSelect sort={sort} className="sm:ml-auto" />
        </div>
      </Card>

      <Card label="All rewards">
        <SectionHeader
          title={boxId === null && type === null ? 'All rewards' : `${formatNumber(filtered.length)} rewards`}
          description={`Sorted by ${sort.summary} · click a column header to change it`}
          freshness={freshnessText(raw.freshness, ['claims', 'spend'])}
          action={
            <DownloadButton
              fileName={exportName('rewards', filter, [
                boxId === null ? null : dataset.boxById.get(boxId)?.name_en,
                type?.toLowerCase(),
              ])}
              columns={rewardColumns}
              rows={filtered}
            />
          }
        />

        <div className="mb-4 space-y-2">
          <DataNote tone="info">
            <strong>Two different bases in one table.</strong> Claimed is the selected date range,
            from the daily claims export. Redeemed and Spend are cumulative, from the latest
            cumulative spend snapshot — the daily spend export carries the same columns but is not
            populating them, so it cannot be used per day yet. On a narrowed range a row can
            therefore show fewer claims than redemptions.
          </DataNote>
          {!hasSecondSnapshot && (
            <DataNote tone="info">
              Only one cumulative snapshot is stored, so the change column is empty. It fills in
              after the next upload, comparing the two most recent exports.
            </DataNote>
          )}
        </div>

        {all.length === 0 ? (
          <EmptyState
            title="No reward reference data loaded"
            description="Upload blindbox_reward in the Admin area to populate this table."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No rewards match these filters"
            description="Clear the box or type filter to see the full list."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th sort={sort.th('name')}>Reward</Th>
                    <Th sort={sort.th('box')}>Box</Th>
                    <Th sort={sort.th('rarity')}>Rarity</Th>
                    <Th sort={sort.th('type')}>Type</Th>
                    <Th align="right" sort={sort.th('weight')}>Odds</Th>
                    <Th sort={sort.th('stock')}>Stock left</Th>
                    <Th align="right" sort={sort.th('claimed')}>Claimed<Basis>range</Basis></Th>
                    <Th align="right" sort={sort.th('redeemed')}>Redeemed<Basis>total</Basis></Th>
                    <Th align="right" sort={sort.th('rate')}>Rate</Th>
                    <Th align="right" sort={sort.th('spend')}>Spend<Basis>total</Basis></Th>
                    <Th align="right" sort={sort.th('change')}>Change</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.rewardId}>
                      <Td className="max-w-[16rem] pr-3">
                        <div className="flex items-center gap-2">
                          <ImageWithFallback
                            src={row.imageUrl}
                            alt={row.name}
                            fallbackLabel={row.name}
                            className="size-8 shrink-0 rounded-control"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink-1" title={row.name}>
                              {row.name}
                            </span>
                            {/* blindbox_reward.id, for tracing a row back to
                                the raw exports. */}
                            <span className="font-mono text-micro text-ink-4">
                              ID {row.rewardId}
                            </span>
                            {row.status === 'PENDING' && (
                              <span className="ml-1.5">
                                <NeutralBadge>Pending</NeutralBadge>
                              </span>
                            )}
                          </span>
                        </div>
                      </Td>
                      <Td className="pr-3 text-ink-3 whitespace-nowrap">{row.boxName}</Td>
                      <Td className="pr-3"><RarityBadge rarity={row.rarity} /></Td>
                      <Td className="pr-3"><TypeBadge type={row.type} /></Td>
                      <Td align="right" className="pr-3 text-ink-2">{formatWeight(row.weight)}</Td>
                      <Td className="w-32 pr-3">
                        <StockCell row={row} />
                      </Td>
                      <Td align="right" className="pr-3 font-semibold text-ink-1">
                        {formatNumber(row.claimed)}
                      </Td>
                      <Td align="right" className="pr-3 text-ink-2">
                        {row.type === 'CASHBACK' ? <AutoCredited /> : formatNumber(row.redeemed)}
                      </Td>
                      <Td align="right" className="pr-3 text-ink-2">
                        {row.type === 'CASHBACK' ? (
                          <AutoCredited />
                        ) : row.redemptionRate === null ? (
                          <span className="text-ink-5">—</span>
                        ) : (
                          formatPercent(row.redemptionRate)
                        )}
                      </Td>
                      <Td align="right" className="pr-3 font-semibold text-ink-1">
                        {formatRupiah(row.spend)}
                      </Td>
                      <Td align="right">
                        <ChangeCell value={row.change?.spend ?? null} format={(v) => formatRupiah(v)} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-2.5 md:hidden">
              {filtered.map((row) => (
                <RewardCard key={row.rewardId} row={row} />
              ))}
            </ul>
          </>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card label="Top 10 by claims">
          <SectionHeader
            title="Top 10 by claims"
            description="Most-claimed rewards over the selected date range"
            freshness={freshnessText(raw.freshness, ['claims'])}
          />
          <TopList
            rows={topByClaims(filtered, 10)}
            value={(r) => r.claimed}
            render={(r) => formatNumber(r.claimed)}
          />
        </Card>
        <Card label="Top 10 by spend">
          <SectionHeader
            title="Top 10 by spend"
            description="Biggest cost items, cumulative"
            freshness={freshnessText(raw.freshness, ['spend'])}
          />
          <TopList
            rows={topBySpend(filtered, 10)}
            value={(r) => r.spend}
            render={(r) => formatRupiah(r.spend)}
          />
        </Card>
      </div>
    </>
  );
}

/** Marks which date basis a column is on, since the table mixes two. */
function Basis({ children }: { children: string }) {
  return <span className="ml-1 font-normal normal-case text-ink-5">({children})</span>;
}

/** Cashback is credited automatically, so a redemption rate is meaningless. */
function AutoCredited() {
  return <span className="text-micro text-ink-4">auto-credited</span>;
}

function StockCell({ row }: { row: RewardRow }) {
  if (row.stockLeftPct === null) {
    return <span className="text-micro text-ink-4">no stock set</span>;
  }
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="tnum text-micro font-semibold text-ink-2">
          {formatPercent(row.stockLeftPct, 0)}
        </span>
        <span className="tnum text-micro text-ink-4">
          {formatNumber(row.stockDistributed)}/{formatNumber(row.stockTotal)}
        </span>
      </div>
      <StockBar status={row.stockStatus} leftPct={row.stockLeftPct} className="mt-1" />
    </div>
  );
}

function RewardCard({ row }: { row: RewardRow }) {
  return (
    <li className="rounded-control border border-line-1 px-3 py-3">
      <div className="flex items-start gap-2.5">
        <ImageWithFallback
          src={row.imageUrl}
          alt={row.name}
          fallbackLabel={row.name}
          className="size-10 shrink-0 rounded-control"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-1">{row.name}</p>
          <p className="text-micro text-ink-4">
            {row.boxName} · <span className="font-mono">ID {row.rewardId}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <RarityBadge rarity={row.rarity} />
            <TypeBadge type={row.type} />
            <NeutralBadge>{formatWeight(row.weight)} odds</NeutralBadge>
            {row.status === 'PENDING' && <NeutralBadge>Pending</NeutralBadge>}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <StockCell row={row} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line-2 pt-2.5">
        <Stat label="Claimed" value={formatNumber(row.claimed)} hint="range" />
        <Stat
          label="Redeemed"
          value={row.type === 'CASHBACK' ? 'auto' : formatNumber(row.redeemed)}
          hint={
            row.type === 'CASHBACK'
              ? 'credited'
              : row.redemptionRate !== null
                ? formatPercent(row.redemptionRate)
                : undefined
          }
        />
        <Stat label="Spend" value={formatRupiah(row.spend)} hint="total" />
      </dl>
    </li>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-micro text-ink-4">{label}</dt>
      <dd className="tnum font-semibold text-ink-1">{value}</dd>
      {hint && <dd className="text-micro text-ink-4">{hint}</dd>}
    </div>
  );
}

function TopList({
  rows,
  value,
  render,
}: {
  rows: RewardRow[];
  /** The number the bar is scaled by. */
  value: (row: RewardRow) => number;
  /** The same number, formatted for display. */
  render: (row: RewardRow) => string;
}) {
  if (rows.length === 0) return <EmptyState title="Nothing to rank yet" />;
  const peak = Math.max(...rows.map(value), 1);

  return (
    <ol className="space-y-2">
      {rows.map((row, i) => (
        <li key={row.rewardId} className="flex items-center gap-2.5">
          <span className="w-4 shrink-0 tnum text-micro text-ink-4">{i + 1}</span>
          <ImageWithFallback
            src={row.imageUrl}
            alt={row.name}
            fallbackLabel={row.name}
            className="size-8 shrink-0 rounded-control"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-semibold text-ink-1" title={row.name}>{row.name}</p>
              <p className="shrink-0 tnum font-semibold text-ink-1">{render(row)}</p>
            </div>
            <p className="truncate text-micro text-ink-4">{row.boxName}</p>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-pill bg-line-2">
              <div
                className="h-full rounded-pill bg-chart-1"
                style={{ width: `${(value(row) / peak) * 100}%`, background: 'var(--color-chart-1)' }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Weights are stored to 3 decimals but read as percentages. */
function formatWeight(weight: number): string {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(weight)}%`;
}
