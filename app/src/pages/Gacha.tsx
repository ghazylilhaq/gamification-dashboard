import { useMemo } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { FirstRun } from '@/components/FirstRun';
import { Card, SectionHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { SortSelect } from '@/components/ui/SortSelect';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { CumulativeCashbackChart, GachaTrendChart } from '@/components/charts/GachaCharts';
import { DataNote, EmptyState, ErrorState, LoadingKpis, Skeleton } from '@/components/ui/states';
import { freshnessText } from '@/components/Freshness';
import { cumulativeGachaTotals, gachaSeries, gachaTotals, type GachaPoint } from '@/lib/metrics/gacha';
import { useTableSort, type SortColumns } from '@/hooks/useTableSort';
import { formatDate, formatNumber, formatRupiah } from '@/lib/format';
import { DownloadButton } from '@/components/DownloadButton';
import { gachaColumns } from '@/lib/csv/columns';
import { exportName } from '@/lib/csv/exportContext';

const DAY_COLUMNS: SortColumns<GachaPoint, 'date' | 'claims' | 'users' | 'cashback'> = {
  // Newest day first, which is how a daily table is read.
  date: { label: 'Date', value: (p) => p.date, defaultDir: 'desc', order: 'date' },
  claims: { label: 'Claims', value: (p) => p.claims },
  users: { label: 'Users', value: (p) => p.users },
  cashback: { label: 'Cashback', value: (p) => p.cashback },
};

export function Gacha() {
  const { dataset, loading, error, reload, raw, hasAnyData, filter } = useDashboard();

  const data = useMemo(() => {
    if (!dataset) return null;
    return {
      period: gachaTotals(dataset),
      cumulative: cumulativeGachaTotals(dataset),
      series: gachaSeries(dataset),
    };
  }, [dataset]);

  const daySort = useTableSort(data?.series ?? [], DAY_COLUMNS, { key: 'date' }, (p) => p.date);

  if (loading) {
    return (
      <>
        <PageHeader title="Gacha" description="The cashback-only draw unlocked every 20 spins" />
        <LoadingKpis count={4} />
        <Card className="mt-4"><Skeleton className="h-72" /></Card>
      </>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!dataset || !raw || !data) return null;
  if (!hasAnyData) return <FirstRun page="Gacha" />;

  const { period, cumulative, series } = data;
  const latest = series[series.length - 1] ?? null;
  const previous = series[series.length - 2] ?? null;

  if (series.length === 0) {
    return (
      <>
        <PageHeader
          title="Gacha"
          description="The cashback-only draw unlocked every 20 spins"
          freshness={freshnessText(raw.freshness, ['gacha'])}
        />
        <Card>
          <EmptyState
            title="No gacha activity in this date range"
            description="Widen the date range, or turn on test data to include pre-launch spins."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Gacha"
        description="The cashback-only draw unlocked every 20 spins. It is not in the spend files, so its cashback is added to total spend separately."
        freshness={freshnessText(raw.freshness, ['gacha'])}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total claims"
          value={formatNumber(cumulative.claims)}
          change={latest && previous ? delta(latest.claims, previous.claims) : null}
          footnote="Since launch · ignores the date range"
        />
        <KpiCard
          label="Users claiming"
          value={formatNumber(period.usersLatestDay)}
          sub={period.latestDate ? formatDate(period.latestDate) : undefined}
          change={latest && previous ? delta(latest.users, previous.users) : null}
          footnote="That day only · not a campaign total"
        />
        <KpiCard
          label="Total cashback"
          value={formatRupiah(cumulative.cashback)}
          change={latest && previous ? delta(latest.cashback, previous.cashback) : null}
          changeFormat="rupiah"
          footnote="Since launch · ignores the date range"
        />
        <KpiCard
          label="Cashback per user"
          value={formatRupiah(period.cashbackPerUser)}
          sub={period.latestDate ? `on ${formatDate(period.latestDate)}` : undefined}
          footnote="Latest day's cashback ÷ that day's users"
        />
      </div>

      <div className="mt-4">
        <DataNote tone="info">
          <strong>Users claiming is a daily figure, not a unique total.</strong> One person can spin
          many times, and the export counts users per day — so these numbers cannot be added across
          days to get campaign-wide participants. A cross-day unique count needs a new export and is
          parked in next scope.
        </DataNote>
      </div>

      <Card label="Daily gacha" className="mt-4">
        <SectionHeader
          title="Claims and users per day"
          description="Bars are claims; the line is how many users claimed that day"
          freshness={freshnessText(raw.freshness, ['gacha'])}
        />
        <GachaTrendChart data={series} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card label="Cumulative cashback">
          <SectionHeader
            title="Cumulative cashback"
            description="Gacha cost accumulating over the campaign"
            freshness={freshnessText(raw.freshness, ['gacha'])}
          />
          <CumulativeCashbackChart data={series} />
          <p className="mt-2 text-micro text-ink-4">
            A budget cap line will be added here once a target is set — see next scope.
          </p>
        </Card>

        <Card label="Gacha by day">
          <SectionHeader
            title="By day"
            description={`The underlying figures · sorted by ${daySort.summary}`}
            action={
              <DownloadButton
                fileName={exportName('gacha-daily', filter)}
                columns={gachaColumns}
                rows={daySort.rows}
              />
            }
          />

          {/* The list below the lg breakpoint has no headers to click. */}
          <SortSelect sort={daySort} hideFrom="lg" className="mb-3" />
          <div className="hidden lg:block">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th sort={daySort.th('date')}>Date</Th>
                    <Th align="right" sort={daySort.th('claims')}>Claims</Th>
                    <Th align="right" sort={daySort.th('users')}>Users</Th>
                    <Th align="right" sort={daySort.th('cashback')}>Cashback</Th>
                  </tr>
                </thead>
                <tbody>
                  {daySort.rows.map((p) => (
                    <tr key={p.date}>
                      <Td className="whitespace-nowrap font-semibold text-ink-1">{formatDate(p.date)}</Td>
                      <Td align="right" className="text-ink-2">{formatNumber(p.claims)}</Td>
                      <Td align="right" className="text-ink-2">{formatNumber(p.users)}</Td>
                      <Td align="right" className="font-semibold text-ink-1">{formatRupiah(p.cashback)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>
          <ul className="space-y-2 lg:hidden">
            {daySort.rows.map((p) => (
              <li key={p.date} className="flex items-baseline justify-between gap-3 border-b border-line-2 pb-2 last:border-b-0">
                <span className="font-semibold text-ink-1">{formatDate(p.date)}</span>
                <span className="tnum text-micro text-ink-3">
                  {formatNumber(p.claims)} claims · {formatNumber(p.users)} users
                </span>
                <span className="tnum font-semibold text-ink-1">{formatRupiah(p.cashback)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function delta(current: number, previous: number) {
  return {
    current,
    previous,
    delta: current - previous,
    pct: previous !== 0 ? (current - previous) / previous : null,
  };
}
