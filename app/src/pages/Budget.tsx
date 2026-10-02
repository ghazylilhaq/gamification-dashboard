import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '@/hooks/useDashboard';
import { FirstRun } from '@/components/FirstRun';
import { Card, SectionHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { SortSelect } from '@/components/ui/SortSelect';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { TypeBadge } from '@/components/ui/Badge';
import { BudgetDailyChart, BudgetShareBar } from '@/components/charts/BudgetCharts';
import { DataNote, EmptyState, ErrorState, LoadingKpis, Skeleton } from '@/components/ui/states';
import { freshnessText } from '@/components/Freshness';
import {
  budgetByBox, budgetByType, budgetTotals, dailyBudgetCoverage, dailyBudgetSeries,
  unredeemedExposure, type BudgetTypeRow,
} from '@/lib/metrics/budget';
import { budgetProjection, remainingRewardValue, type ProjectionBasis } from '@/lib/metrics/projection';
import { useTableSort, type SortColumns } from '@/hooks/useTableSort';
import { rewardRows, topBySpend } from '@/lib/metrics/rewards';
import { exportDateOf } from '@/lib/csv/detect';
import { formatDate, formatNumber, formatPercent, formatRupiah } from '@/lib/format';
import { DownloadButton } from '@/components/DownloadButton';
import { budgetBoxColumns, budgetTypeColumns, dailyBudgetColumns } from '@/lib/csv/columns';
import { exportName } from '@/lib/csv/exportContext';

const TYPE_COLOURS: Record<string, string> = {
  CASHBACK: 'var(--color-type-cashback)',
  COUPON: 'var(--color-type-coupon)',
  GACHA: 'var(--color-type-gacha)',
};

const TYPE_COLUMNS: SortColumns<BudgetTypeRow, 'label' | 'claimed' | 'units' | 'rate' | 'spend' | 'average' | 'share'> = {
  label: { label: 'Type', value: (r) => r.label },
  claimed: { label: 'Claimed', value: (r) => r.claimed },
  units: { label: 'Paid out', value: (r) => r.units },
  // Null for cashback (auto-credited) and gacha, which have no rate.
  rate: { label: 'Redemption rate', value: (r) => r.redemptionRate },
  spend: { label: 'Spend', value: (r) => r.spend },
  average: { label: 'Average per unit', value: (r) => r.averagePerUnit },
  share: { label: 'Share of budget', value: (r) => r.share },
};

export function Budget() {
  const { dataset, loading, error, reload, raw, hasAnyData, filter } = useDashboard();
  const [basis, setBasis] = useState<ProjectionBasis>('recent');

  const data = useMemo(() => {
    if (!dataset || !raw) return null;
    const partialDate = exportDateOf(raw.freshness.daily_rewards);
    return {
      totals: budgetTotals(dataset, partialDate),
      byType: budgetByType(dataset),
      byBox: budgetByBox(dataset),
      daily: dailyBudgetSeries(dataset),
      coverage: dailyBudgetCoverage(dataset),
      exposure: unredeemedExposure(dataset),
      // Both bases, so switching between them is a re-render and not a recompute.
      projections: {
        recent: budgetProjection(dataset, partialDate, { basis: 'recent' }),
        allTime: budgetProjection(dataset, partialDate, { basis: 'allTime' }),
      },
      remaining: remainingRewardValue(dataset),
      topSpend: topBySpend(rewardRows(dataset), 10),
    };
  }, [dataset, raw]);

  const typeSort = useTableSort(data?.byType ?? [], TYPE_COLUMNS, { key: 'spend' }, (r) => r.label);

  if (loading) {
    return (
      <>
        <PageHeader title="Budget" description="What the campaign has cost" />
        <LoadingKpis count={5} />
        <Card className="mt-4"><Skeleton className="h-72" /></Card>
      </>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!dataset || !raw || !data) return null;
  if (!hasAnyData) return <FirstRun page="Budget" />;

  const { totals, byBox, daily, coverage, exposure, projections, remaining, topSpend } = data;
  const projection = projections[basis];
  const other = projections[basis === 'recent' ? 'allTime' : 'recent'];
  const byType = typeSort.rows;
  const boxSpend = totals.boxCashback + totals.coupon;
  const spentBoxes = byBox.filter((b) => b.total > 0);

  return (
    <>
      <PageHeader
        title="Budget"
        description="What the campaign has cost: coupon redemptions plus cashback, box and gacha."
        freshness={freshnessText(raw.freshness, ['spend', 'gacha'])}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Total budget"
          value={formatRupiah(totals.total)}
          sub="Box rewards + gacha"
          footnote="All time · includes pre-launch tests"
        />
        <KpiCard
          label="Box cashback"
          value={formatRupiah(totals.boxCashback)}
          sub={`${formatPercent(share(totals.boxCashback, totals.total), 0)} of budget`}
        />
        <KpiCard
          label="Coupon redemptions"
          value={formatRupiah(totals.coupon)}
          sub={`${formatPercent(share(totals.coupon, totals.total), 0)} of budget`}
        />
        <KpiCard
          label="Gacha cashback"
          value={formatRupiah(totals.gachaCashback)}
          sub={`${formatPercent(share(totals.gachaCashback, totals.total), 0)} of budget`}
          footnote="Not in the spend files"
        />
        <KpiCard
          label="Daily burn rate"
          value={formatRupiah(totals.dailyBurnRate)}
          sub={`over ${formatNumber(totals.daysCounted)} day${totals.daysCounted === 1 ? '' : 's'} of data`}
          footnote={
            totals.latestDayPartial
              ? 'The latest day is partial, so this understates'
              : undefined
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Committed-but-unspent money. The biggest hole in the budget picture. */}
        <Card label="Unredeemed coupon exposure">
          <SectionHeader
            title="Committed but not yet spent"
            description="What it would cost if users redeemed the coupons they are already holding"
            freshness={freshnessText(raw.freshness, ['spend'])}
          />
          <div className="space-y-4">
            <div>
              <p className="font-display text-kpi font-bold tnum text-warn">
                ≥ {formatRupiah(exposure.knownExposure)}
              </p>
              <p className="mt-1 text-ink-3">
                {formatNumber(exposure.unredeemedCoupons)} coupons claimed and not yet redeemed
              </p>
              <p className="mt-2 text-micro text-ink-4">
                That is {formatPercent(share(exposure.knownExposure, totals.total), 0)} of everything
                spent so far, and it is a floor rather than a total.
              </p>
            </div>
            <DataNote>
              <strong>This figure is incomplete, and only in one direction.</strong> A coupon's face
              value is derived as spend ÷ redeemed, so it is only known for the{' '}
              {formatNumber(exposure.pricedCoupons)} coupons someone has actually redeemed. Another{' '}
              <strong>
                {formatNumber(exposure.unpricedCoupons)} coupons with{' '}
                {formatNumber(exposure.unpricedUnredeemed)} outstanding claims have no face value at
                all
              </strong>{' '}
              and are not counted above. Real exposure is higher — how much higher needs a face value
              per coupon from upstream.
            </DataNote>
          </div>
        </Card>

        <Card label="Budget split">
          <SectionHeader
            title="Split by reward type"
            description="All time"
            freshness={freshnessText(raw.freshness, ['spend', 'gacha'])}
          />
          <BudgetShareBar
            parts={byType.map((r) => ({
              label: r.label,
              value: r.spend,
              color: TYPE_COLOURS[r.type] ?? 'var(--color-ink-4)',
            }))}
          />
        </Card>
      </div>

      <Card label="Budget per day" className="mt-4">
        <SectionHeader
          title="Budget per day"
          description="Stacked by reward type, with the running total projected to the close on 1 Des"
          freshness={freshnessText(raw.freshness, ['claims', 'dailySpend', 'gacha'])}
          action={
            <div className="flex items-center gap-3">
              {projection.runRate !== null && (
                <SegmentedControl
                  legend="Projection basis"
                  selected={basis}
                  onChange={setBasis}
                  options={[
                    { value: 'recent', label: 'Last 7 days' },
                    { value: 'allTime', label: 'All time' },
                  ]}
                />
              )}
              <DownloadButton
                fileName={exportName('budget-daily', filter)}
                columns={dailyBudgetColumns}
                rows={daily}
              />
            </div>
          }
        />
        {projection.runRate !== null && (
          <dl className="mb-4 grid grid-cols-2 gap-3 rounded-control border border-line-1 px-3 py-2.5 sm:grid-cols-4">
            <div>
              <dt className="text-micro text-ink-4">Projected by 1 Des</dt>
              <dd className="tnum font-bold text-ink-1">{formatRupiah(projection.projectedTotal)}</dd>
            </div>
            <div>
              <dt className="text-micro text-ink-4">
                Rate over {formatNumber(projection.windowDays)} day
                {projection.windowDays === 1 ? '' : 's'}
              </dt>
              <dd className="tnum font-semibold text-ink-1">{formatRupiah(projection.runRate)}/day</dd>
              {other.runRate !== null && (
                <dd className="text-micro text-ink-4">
                  {basis === 'recent' ? 'all time' : 'last 7 days'}{' '}
                  {formatRupiah(other.runRate)}/day
                </dd>
              )}
            </div>
            <div>
              <dt className="text-micro text-ink-4">Prize pool left</dt>
              <dd className="tnum font-semibold text-ink-1">{formatRupiah(projection.headroom)}</dd>
            </div>
            <div>
              <dt className="text-micro text-ink-4">Pool runs out</dt>
              <dd className="tnum font-semibold text-ink-1">
                {projection.capped ? formatDate(projection.cappedOnDate) : 'not by 1 Des'}
              </dd>
            </div>
          </dl>
        )}
        {!coverage.trustworthy && (
          <div className="mb-4">
            <DataNote>
              <strong>
                These bars account for {formatPercent(coverage.ratio, 0)} of the budget —{' '}
                {formatRupiah(coverage.dailyTotal)} of {formatRupiah(coverage.cumulativeTotal)}.
              </strong>{' '}
              {coverage.usesDerivedCashback && (
                <>
                  Box cashback is <strong>reconstructed from claims × the configured payout</strong>,
                  because the daily spend export is not populating it. That is exact for cashback:
                  a cashback reward pays out its set value every time it is claimed, with no
                  redemption step.{' '}
                </>
              )}
              The gap is <strong>coupon redemptions</strong>, currently{' '}
              {formatRupiah(coverage.missingCouponSpend)} — those cannot be reconstructed, because
              a coupon only costs money when a user redeems it and the claims file records no
              redemptions. Cumulative totals above are unaffected.
            </DataNote>
          </div>
        )}
        <BudgetDailyChart data={daily} projection={projection} />
        {projection.truncated && (
          <p className="mt-3 text-micro text-ink-4">
            The projection is hidden while the date range stops short of the latest data — a
            forecast from a truncated history says nothing about where the campaign lands.
          </p>
        )}
      </Card>

      <Card label="Breakdown by reward type" className="mt-4">
        <SectionHeader
          title="Breakdown by reward type"
          description="The three components are measured in different units — a cashback credit is one payout, a redeemed coupon is one face value, a gacha spin may not pay out at all"
          freshness={freshnessText(raw.freshness, ['spend', 'gacha'])}
          action={
            <DownloadButton
              fileName={exportName('budget-by-type', filter)}
              columns={budgetTypeColumns}
              rows={byType}
            />
          }
        />
        {/* The card list below md has no headers to click. */}
        <SortSelect sort={typeSort} className="mb-3" />

        <div className="hidden md:block">
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th sort={typeSort.th('label')}>Type</Th>
                  <Th align="right" sort={typeSort.th('claimed')}>Claimed</Th>
                  <Th align="right" sort={typeSort.th('units')}>Paid out</Th>
                  <Th align="right" sort={typeSort.th('rate')}>Rate</Th>
                  <Th align="right" sort={typeSort.th('spend')}>Spend</Th>
                  <Th align="right" sort={typeSort.th('average')}>Avg. per unit</Th>
                  <Th align="right" sort={typeSort.th('share')}>Share</Th>
                </tr>
              </thead>
              <tbody>
                {byType.map((row) => (
                  <tr key={row.type}>
                    <Td className="pr-3">
                      <div className="flex items-center gap-2">
                        <TypeBadge type={row.type} />
                        <span className="font-semibold text-ink-1">{row.label}</span>
                      </div>
                      {row.note && <p className="mt-0.5 text-micro text-ink-4">{row.note}</p>}
                    </Td>
                    <Td align="right" className="pr-3 text-ink-2">{formatNumber(row.claimed)}</Td>
                    <Td align="right" className="pr-3 text-ink-2">
                      {formatNumber(row.units)}{' '}
                      <span className="text-micro text-ink-4">{row.unitLabel}</span>
                    </Td>
                    <Td align="right" className="pr-3 text-ink-2">
                      {row.redemptionRate === null ? (
                        <span className="text-micro text-ink-4">
                          {row.type === 'CASHBACK' ? 'auto-credited' : 'n/a'}
                        </span>
                      ) : (
                        formatPercent(row.redemptionRate)
                      )}
                    </Td>
                    <Td align="right" className="pr-3 font-semibold text-ink-1">
                      {formatRupiah(row.spend)}
                    </Td>
                    <Td align="right" className="pr-3 text-ink-2">
                      {formatRupiah(row.averagePerUnit)}
                    </Td>
                    <Td align="right" className="font-semibold text-ink-1">
                      {formatPercent(row.share, 1)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>

        <ul className="space-y-2.5 md:hidden">
          {byType.map((row) => (
            <li key={row.type} className="rounded-control border border-line-1 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TypeBadge type={row.type} />
                  <span className="font-semibold text-ink-1">{row.label}</span>
                </div>
                <span className="tnum font-bold text-ink-1">{formatRupiah(row.spend)}</span>
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-line-2 pt-2">
                <div>
                  <dt className="text-micro text-ink-4">Paid out</dt>
                  <dd className="tnum font-semibold text-ink-1">{formatNumber(row.units)}</dd>
                  <dd className="text-micro text-ink-4">{row.unitLabel}</dd>
                </div>
                <div>
                  <dt className="text-micro text-ink-4">Avg. each</dt>
                  <dd className="tnum font-semibold text-ink-1">{formatRupiah(row.averagePerUnit)}</dd>
                </div>
                <div>
                  <dt className="text-micro text-ink-4">Share</dt>
                  <dd className="tnum font-semibold text-ink-1">{formatPercent(row.share, 0)}</dd>
                </div>
              </dl>
              {row.note && <p className="mt-2 text-micro text-ink-4">{row.note}</p>}
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card label="Budget by box">
          <SectionHeader
            title="By box"
            description="Box reward spend only — gacha is a separate draw and not attributable to a box"
            freshness={freshnessText(raw.freshness, ['spend'])}
            action={
              <DownloadButton
                fileName={exportName('budget-by-box', filter)}
                columns={budgetBoxColumns}
                rows={byBox}
              />
            }
          />
          {spentBoxes.length === 0 ? (
            <EmptyState title="No box spend yet" />
          ) : (
            <>
              <ul className="space-y-2.5">
                {spentBoxes.map((row) => (
                  <li key={row.boxId}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold text-ink-1">{row.boxName}</p>
                      <p className="shrink-0 tnum font-semibold text-ink-1">
                        {formatRupiah(row.total)}
                      </p>
                    </div>
                    <div className="mt-1 flex h-2 w-full overflow-hidden rounded-pill bg-line-2">
                      <div
                        style={{
                          width: `${(row.cashback / (boxSpend || 1)) * 100}%`,
                          background: 'var(--color-type-cashback)',
                        }}
                      />
                      <div
                        style={{
                          width: `${(row.coupon / (boxSpend || 1)) * 100}%`,
                          background: 'var(--color-type-coupon)',
                        }}
                      />
                    </div>
                    <p className="mt-0.5 text-micro text-ink-4">
                      {formatRupiah(row.cashback)} cashback · {formatRupiah(row.coupon)} coupons ·{' '}
                      {formatPercent(row.share, 0)} of box spend
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-line-2 pt-2 text-micro text-ink-3">
                Box reward spend totals{' '}
                <span className="font-semibold tnum text-ink-1">{formatRupiah(boxSpend)}</span>.
                Gacha adds {formatRupiah(totals.gachaCashback)} on top.
              </p>
            </>
          )}
        </Card>

        <Card label="Biggest cost items">
          <SectionHeader
            title="Biggest cost items"
            description="The ten rewards that have cost the most"
            freshness={freshnessText(raw.freshness, ['spend'])}
            action={
              <Link to="/rewards" className="font-semibold text-info hover:underline">
                All rewards →
              </Link>
            }
          />
          {topSpend.filter((r) => r.spend > 0).length === 0 ? (
            <EmptyState title="Nothing spent yet" />
          ) : (
            <ol className="space-y-2">
              {topSpend
                .filter((r) => r.spend > 0)
                .map((row, i) => (
                  <li key={row.rewardId} className="flex items-center gap-2.5">
                    <span className="w-4 shrink-0 tnum text-micro text-ink-4">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-semibold text-ink-1" title={row.name}>
                          {row.name}
                        </p>
                        <p className="shrink-0 tnum font-semibold text-ink-1">
                          {formatRupiah(row.spend)}
                        </p>
                      </div>
                      <p className="truncate text-micro text-ink-4">
                        {row.boxName} · {row.type === 'CASHBACK' ? 'cashback' : 'coupon'}
                      </p>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-pill bg-line-2">
                        <div
                          className="h-full rounded-pill"
                          style={{
                            width: `${(row.spend / (topSpend[0]?.spend || 1)) * 100}%`,
                            background: TYPE_COLOURS[row.type] ?? 'var(--color-chart-1)',
                          }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <DataNote tone="info">
          {projection.runRate === null ? (
            <>
              <strong>No projection to 1 Des yet.</strong> The slope needs at least one complete day
              of spend, and every day of data so far is still being exported. The daily burn rate
              above is the closest available meanwhile.{' '}
            </>
          ) : (
            <>
              <strong>How the projection to 1 Des is built, and where it is weak.</strong> The
              dashed line continues the running total at a flat daily rate, taken from the daily
              bars — either the last {formatNumber(projections.recent.windowDays)} days
              ({formatRupiah(projections.recent.runRate)}/day) or the whole campaign
              ({formatRupiah(projections.allTime.runRate)}/day), whichever the toggle above
              selects. Neither is a forecast of behaviour: spend is not flat day to day, and the
              two bases differ by{' '}
              {formatPercent(
                projections.allTime.runRate
                  ? Math.abs(projections.recent.runRate! / projections.allTime.runRate - 1)
                  : null,
                0,
              )}
              , which is the honest width of the uncertainty.{' '}
              <strong>Box spend is capped</strong> at {formatRupiah(remaining.total)} of remaining
              claimable value — stock left × unit value, plus{' '}
              {formatRupiah(remaining.outstanding)} of coupons already claimed but not yet
              redeemed.{' '}
              {projection.capped && (
                <>
                  On the selected rate the prize pool is exhausted around{' '}
                  <strong>{formatDate(projection.cappedOnDate)}</strong>, which is where the dashed
                  line flattens — the campaign cannot spend inventory it no longer has.{' '}
                </>
              )}
              That ceiling is a floor rather than a guarantee:{' '}
              {formatNumber(remaining.unpricedRewards)} reward
              {remaining.unpricedRewards === 1 ? '' : 's'} with{' '}
              {formatNumber(remaining.unpricedUnits)} units left have no knowable unit value (a
              coupon's face value is derived from redemptions, so an unredeemed one has no price),
              and gacha has no stock to cap against at all, so it is projected uncapped.{' '}
            </>
          )}
          <strong>No budget cap is configured yet</strong> — pacing against a target still needs a
          number from the business. See spec §7.
          {totals.daysCounted === 1 && (
            <>
              {' '}
              With {formatDate(daily[0]?.date ?? '')} the only day of data so far, and partial at
              that, treat all of this as indicative.
            </>
          )}
        </DataNote>
      </div>
    </>
  );
}

function share(value: number, total: number): number | null {
  return total > 0 ? value / total : null;
}
