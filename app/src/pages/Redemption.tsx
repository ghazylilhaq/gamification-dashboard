import { useMemo } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { FirstRun } from '@/components/FirstRun';
import { Card, SectionHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { SortSelect } from '@/components/ui/SortSelect';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { BoxRateChart, MerchantChart, RedemptionTrendChart } from '@/components/charts/RedemptionCharts';
import { DataNote, EmptyState, ErrorState, LoadingKpis, Skeleton } from '@/components/ui/states';
import { freshnessText } from '@/components/Freshness';
import {
  couponTable, dailyRedemptionAvailability, dailyRedemptionSeries, redemptionByBox,
  redemptionByMerchant, redemptionTotals,
} from '@/lib/metrics/redemption';
import { cashbackByBox, cashbackTable, cashbackTotals } from '@/lib/metrics/budget';
import { useTableSort, type SortColumns } from '@/hooks/useTableSort';
import type { CouponRow } from '@/lib/metrics/redemption';
import type { CashbackRow } from '@/lib/metrics/budget';
import { formatDate, formatNumber, formatPercent, formatRupiah } from '@/lib/format';
import { DownloadButton } from '@/components/DownloadButton';
import { cashbackColumns, couponColumns } from '@/lib/csv/columns';
import { exportName } from '@/lib/csv/exportContext';

const COUPON_COLUMNS: SortColumns<CouponRow, 'name' | 'box' | 'merchant' | 'ref' | 'claimed' | 'redeemed' | 'rate' | 'spend'> = {
  name: { label: 'Coupon', value: (c) => c.name },
  box: { label: 'Box', value: (c) => c.boxName },
  merchant: { label: 'Merchant', value: (c) => c.merchant },
  ref: { label: 'Coupon reference', value: (c) => c.couponRefId },
  claimed: { label: 'Claimed', value: (c) => c.claimed },
  redeemed: { label: 'Redeemed', value: (c) => c.redeemed },
  // Null until a coupon has been claimed — no denominator, no rate.
  rate: { label: 'Redemption rate', value: (c) => c.rate },
  spend: { label: 'Spend', value: (c) => c.spend },
};

const CASHBACK_COLUMNS: SortColumns<CashbackRow, 'name' | 'box' | 'credited' | 'spend' | 'average'> = {
  name: { label: 'Reward', value: (r) => r.name },
  box: { label: 'Box', value: (r) => r.boxName },
  credited: { label: 'Credited', value: (r) => r.credited },
  spend: { label: 'Spend', value: (r) => r.spend },
  average: { label: 'Average each', value: (r) => r.averagePerCredit },
};

export function Redemption() {
  const { dataset, loading, error, reload, raw, hasAnyData, filter } = useDashboard();

  const data = useMemo(() => {
    if (!dataset) return null;
    return {
      totals: redemptionTotals(dataset),
      merchants: redemptionByMerchant(dataset),
      boxes: redemptionByBox(dataset),
      coupons: couponTable(dataset),
      daily: dailyRedemptionSeries(dataset),
      dailyAvailability: dailyRedemptionAvailability(dataset),
      cashback: cashbackTotals(dataset),
      cashbackRows: cashbackTable(dataset),
      cashbackBoxes: cashbackByBox(dataset),
    };
  }, [dataset]);

  // Sorting lives above the early returns, as hooks must.
  const couponSort = useTableSort(data?.coupons ?? [], COUPON_COLUMNS, { key: 'redeemed' }, (c) => c.name);
  const cashbackSort = useTableSort(data?.cashbackRows ?? [], CASHBACK_COLUMNS, { key: 'spend' }, (r) => r.name);

  if (loading) {
    return (
      <>
        <PageHeader title="Redemption" description="What happened to the coupons users claimed" />
        <LoadingKpis count={5} />
        <Card className="mt-4"><Skeleton className="h-64" /></Card>
      </>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!dataset || !raw || !data) return null;
  if (!hasAnyData) return <FirstRun page="Redemption" />;

  const {
    totals, merchants, boxes, coupons, daily, dailyAvailability,
    cashback, cashbackBoxes,
  } = data;
  const sortedCoupons = couponSort.rows;
  const cashbackRows = cashbackSort.rows;
  const incomplete = daily.filter((p) => p.incomplete);
  const redeemedCoupons = coupons.filter((c) => c.redeemed > 0);

  if (totals.claimed === 0) {
    return (
      <>
        <PageHeader
          title="Redemption"
          description="What happened to the coupons users claimed"
          freshness={freshnessText(raw.freshness, ['spend'])}
        />
        <Card label="Redemption">
          <EmptyState
            title="No coupons claimed yet"
            description="Once users start claiming coupon rewards, redemption by merchant, box and coupon appears here."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Redemption"
        description="Both ways a reward costs money: coupons users have to redeem, and cashback credited automatically."
        freshness={freshnessText(raw.freshness, ['spend'])}
      />

      <h2 className="mb-3 font-display text-base font-bold text-ink-1">
        Coupons
        <span className="ml-2 text-micro font-normal text-ink-4">
          users have to redeem these themselves
        </span>
      </h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Coupons claimed" value={formatNumber(totals.claimed)} footnote="Cumulative" />
        <KpiCard label="Coupons redeemed" value={formatNumber(totals.redeemed)} footnote="Cumulative" />
        <KpiCard
          label="Redemption rate"
          value={formatPercent(totals.rate)}
          sub={`${formatNumber(totals.redeemed)} of ${formatNumber(totals.claimed)}`}
        />
        <KpiCard label="Coupon spend" value={formatRupiah(totals.spend)} footnote="Face value × redeemed" />
        <KpiCard
          label="Avg. face value"
          value={formatRupiah(totals.averageFaceValue)}
          footnote="Of redeemed coupons only"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card label="By merchant">
          <SectionHeader
            title="Claimed vs. redeemed by merchant"
            description="Merchant derived from the coupon name"
            freshness={freshnessText(raw.freshness, ['spend'])}
          />
          <MerchantChart rows={merchants} />
        </Card>

        <Card label="By box">
          <SectionHeader
            title="Redemption rate by box"
            description="Coupon rows only, ordered by stamps required"
            freshness={freshnessText(raw.freshness, ['spend'])}
          />
          <BoxRateChart rows={boxes} />
          <p className="mt-2 text-micro text-ink-4">
            Boxes higher up the ladder have very few claims so far, so their rates swing on single
            redemptions. Hover a bar for the raw counts.
          </p>
        </Card>
      </div>

      <Card label="All coupons" className="mt-4">
        <SectionHeader
          title="All coupons"
          description={`${formatNumber(redeemedCoupons.length)} of ${formatNumber(coupons.length)} have been redeemed at least once · sorted by ${couponSort.summary}`}
          freshness={freshnessText(raw.freshness, ['spend'])}
          action={
            <DownloadButton
              fileName={exportName('coupons', filter)}
              columns={couponColumns}
              rows={sortedCoupons}
            />
          }
        />

        {/* The phone list below has no headers to click. */}
        <SortSelect sort={couponSort} className="mb-3" />

        {/* Desktop table */}
        <div className="hidden md:block">
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th sort={couponSort.th('name')}>Coupon</Th>
                  <Th sort={couponSort.th('box')}>Box</Th>
                  <Th sort={couponSort.th('merchant')}>Merchant</Th>
                  <Th sort={couponSort.th('ref')}>Coupon ref.</Th>
                  <Th align="right" sort={couponSort.th('claimed')}>Claimed</Th>
                  <Th align="right" sort={couponSort.th('redeemed')}>Redeemed</Th>
                  <Th align="right" sort={couponSort.th('rate')}>Rate</Th>
                  <Th align="right" sort={couponSort.th('spend')}>Spend</Th>
                </tr>
              </thead>
              <tbody>
                {sortedCoupons.map((c) => (
                  <tr key={c.rewardId} className={c.redeemed === 0 ? 'text-ink-4' : ''}>
                    <Td className="max-w-[18rem] pr-3">
                      <span className="block truncate font-semibold text-ink-1" title={c.name}>
                        {c.name}
                      </span>
                    </Td>
                    <Td className="pr-3 whitespace-nowrap text-ink-3">{c.boxName}</Td>
                    <Td className="pr-3 whitespace-nowrap text-ink-3">{c.merchant}</Td>
                    <Td className="pr-3 font-mono text-micro text-ink-4">{c.couponRefId ?? '—'}</Td>
                    <Td align="right" className="pr-3 text-ink-2">{formatNumber(c.claimed)}</Td>
                    <Td align="right" className="pr-3 font-semibold text-ink-1">
                      {formatNumber(c.redeemed)}
                    </Td>
                    <Td align="right" className="pr-3 text-ink-2">
                      {c.rate === null ? <span className="text-ink-5">—</span> : formatPercent(c.rate)}
                    </Td>
                    <Td align="right" className="font-semibold text-ink-1">{formatRupiah(c.spend)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>

        {/* Mobile cards. Redeemed coupons first — the unredeemed tail is long. */}
        <ul className="space-y-2.5 md:hidden">
          {sortedCoupons.map((c) => (
            <li key={c.rewardId} className="rounded-control border border-line-1 px-3 py-2.5">
              <p className="font-semibold text-ink-1">{c.name}</p>
              <p className="text-micro text-ink-4">
                {c.boxName} · {c.merchant}
              </p>
              <p className="mt-0.5 font-mono text-micro text-ink-5">{c.couponRefId ?? '—'}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-line-2 pt-2">
                <div>
                  <dt className="text-micro text-ink-4">Claimed</dt>
                  <dd className="tnum font-semibold text-ink-1">{formatNumber(c.claimed)}</dd>
                </div>
                <div>
                  <dt className="text-micro text-ink-4">Redeemed</dt>
                  <dd className="tnum font-semibold text-ink-1">
                    {formatNumber(c.redeemed)}
                    {c.rate !== null && (
                      <span className="ml-1 text-micro font-normal text-ink-4">
                        {formatPercent(c.rate)}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-micro text-ink-4">Spend</dt>
                  <dd className="tnum font-semibold text-ink-1">{formatRupiah(c.spend)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </Card>

      {/* Cashback: the other half of the cost, with no redemption step. */}
      <h2 className="mb-3 mt-6 font-display text-base font-bold text-ink-1">
        Cashback
        <span className="ml-2 text-micro font-normal text-ink-4">
          credited automatically · no redemption step
        </span>
      </h2>

      {/* No redemption-rate card here. It would always read 100%, and a second
          card labelled "Redemption rate" on this page would be ambiguous — the
          section heading above carries the fact instead. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard
          label="Cashback credited"
          value={formatNumber(cashback.credited)}
          sub="credits issued automatically"
          footnote="Cumulative"
        />
        <KpiCard label="Cashback spend" value={formatRupiah(cashback.spend)} footnote="Cumulative" />
        <KpiCard
          label="Avg. per credit"
          value={formatRupiah(cashback.averagePerCredit)}
          footnote="Spend ÷ credits"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card label="Cashback by box">
          <SectionHeader
            title="Cashback by box"
            description="Where the cashback budget went"
            freshness={freshnessText(raw.freshness, ['spend'])}
          />
          {cashbackBoxes.length === 0 ? (
            <EmptyState title="No cashback credited yet" />
          ) : (
            <ul className="space-y-2.5">
              {cashbackBoxes.map((row) => (
                <li key={row.boxId}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-semibold text-ink-1">{row.boxName}</p>
                    <p className="shrink-0 tnum font-semibold text-ink-1">{formatRupiah(row.spend)}</p>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-pill bg-line-2">
                    <div
                      className="h-full rounded-pill"
                      style={{
                        width: `${(row.spend / (cashback.spend || 1)) * 100}%`,
                        background: 'var(--color-type-cashback)',
                      }}
                    />
                  </div>
                  <p className="mt-0.5 text-micro text-ink-4">
                    {formatNumber(row.credited)} credits
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card label="Cashback rewards">
          <SectionHeader
            title="Cashback rewards"
            description={`All ${formatNumber(cashbackRows.length)} cashback rewards · sorted by ${cashbackSort.summary}`}
            freshness={freshnessText(raw.freshness, ['spend'])}
            action={
              <DownloadButton
                fileName={exportName('cashback-rewards', filter)}
                columns={cashbackColumns}
                rows={cashbackRows}
              />
            }
          />

          <SortSelect sort={cashbackSort} className="mb-3" />
          <div className="hidden md:block">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th sort={cashbackSort.th('name')}>Reward</Th>
                    <Th sort={cashbackSort.th('box')}>Box</Th>
                    <Th align="right" sort={cashbackSort.th('credited')}>Credited</Th>
                    <Th align="right" sort={cashbackSort.th('spend')}>Spend</Th>
                    <Th align="right" sort={cashbackSort.th('average')}>Avg. each</Th>
                  </tr>
                </thead>
                <tbody>
                  {cashbackRows.map((row) => (
                    <tr key={row.rewardId} className={row.credited === 0 ? 'text-ink-4' : ''}>
                      <Td className="max-w-[14rem] pr-3">
                        <span className="block truncate font-semibold text-ink-1" title={row.name}>
                          {row.name}
                        </span>
                      </Td>
                      <Td className="pr-3 whitespace-nowrap text-ink-3">{row.boxName}</Td>
                      <Td align="right" className="pr-3 text-ink-2">{formatNumber(row.credited)}</Td>
                      <Td align="right" className="pr-3 font-semibold text-ink-1">
                        {formatRupiah(row.spend)}
                      </Td>
                      <Td align="right" className="text-ink-2">{formatRupiah(row.averagePerCredit)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>
          <ul className="space-y-2 md:hidden">
            {cashbackRows.map((row) => (
              <li
                key={row.rewardId}
                className="flex items-baseline justify-between gap-2 border-b border-line-2 pb-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-1">{row.name}</p>
                  <p className="text-micro text-ink-4">
                    {row.boxName} · {formatNumber(row.credited)} credits
                  </p>
                </div>
                <p className="shrink-0 tnum font-semibold text-ink-1">{formatRupiah(row.spend)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <h2 className="mb-3 mt-6 font-display text-base font-bold text-ink-1">Daily trend</h2>

      <Card label="Daily redemption">
        <SectionHeader
          title="Daily redemption and spend"
          description="Coupons claimed and redeemed per day"
          freshness={freshnessText(raw.freshness, ['dailySpend'])}
        />
        {dailyAvailability === 'empty' ? (
          <>
            <DataNote>
              <strong>The daily export has no coupon data to plot.</strong> Every coupon row in{' '}
              <span className="font-mono">daily_spent_reward</span> reads 0 claimed and 0 redeemed
              on all {daily.length} date{daily.length === 1 ? '' : 's'}, while the cumulative
              export reports {formatNumber(totals.claimed)} claimed and{' '}
              {formatNumber(totals.redeemed)} redeemed. The column exists but is not being
              populated — this needs fixing upstream.
            </DataNote>
            <div className="mt-4">
              <EmptyState
                title="No daily breakdown available"
                description="Drawing a chart of zeros here would read as “nothing happened” rather than “data missing”, so it is left out until the export is fixed. Every cumulative figure on this page is unaffected."
              />
            </div>
          </>
        ) : (
          <>
            {incomplete.length > 0 && (
              <div className="mb-4">
                <DataNote>
                  <strong>Daily data incomplete.</strong> The daily spend export reports far fewer
                  claims than the claims file on{' '}
                  {incomplete.length === 1
                    ? formatDate(incomplete[0]!.date)
                    : `${incomplete.length} of ${daily.length} dates`}
                  , so these bars understate what actually happened. The cumulative figures above
                  come from the cumulative export and are unaffected.
                </DataNote>
              </div>
            )}
            <RedemptionTrendChart data={daily} />
          </>
        )}
      </Card>
    </>
  );
}
