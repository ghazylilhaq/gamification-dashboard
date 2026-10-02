import { Link } from 'react-router-dom';
import { useDashboard } from '@/hooks/useDashboard';
import { FirstRun } from '@/components/FirstRun';
import { Card, SectionHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/KpiCard';
import { DailyTrendChart } from '@/components/charts/DailyTrendChart';
import { CumulativeSplit, SpendSplitChart } from '@/components/charts/SpendSplitChart';
import { StampLadder } from '@/components/StampLadder';
import { StockAlerts } from '@/components/StockAlerts';
import { DataNote, EmptyState, ErrorState, LoadingKpis, Skeleton } from '@/components/ui/states';
import { freshnessText } from '@/components/Freshness';
import { overviewKpis } from '@/lib/metrics/overview';
import { dailyClaimSeries, stampLadder } from '@/lib/metrics/claims';
import { dailySpendSeries, spendTotals } from '@/lib/metrics/spend';
import { stockSummary } from '@/lib/metrics/stock';
import { formatDate, formatDateTimeWib, formatNumber, formatPercent, formatRupiah } from '@/lib/format';
import { exportDateOf } from '@/lib/csv/detect';
import { DownloadButton } from '@/components/DownloadButton';
import { dailyClaimColumns } from '@/lib/csv/columns';
import { exportName } from '@/lib/csv/exportContext';

export function Overview() {
  const { dataset, loading, error, reload, raw, filter, hasAnyData } = useDashboard();

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingKpis />
        <Card><Skeleton className="h-72" /></Card>
        <Card><Skeleton className="h-40" /></Card>
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!dataset || !raw) return null;
  if (!hasAnyData) return <FirstRun page="Overview" />;

  const kpis = overviewKpis(dataset);
  const ladder = stampLadder(dataset);
  const stock = stockSummary(dataset);
  const spend = spendTotals(dataset);
  // A date matching a file's export date is only a partial day so far.
  const partialDate = exportDateOf(raw.freshness.daily_rewards);
  const claimSeries = dailyClaimSeries(dataset, partialDate);
  const spendSeries = dailySpendSeries(dataset);
  const incompleteDays = spendSeries.filter((p) => p.incomplete);
  const usesDerivedCashback = spendSeries.some((p) => p.cashbackDerived && p.cashback > 0);

  const hasData = dataset.dates.length > 0;

  return (
    <div className="space-y-4">
      {partialDate && dataset.dates.includes(partialDate) && (
        <DataNote tone="info">
          <strong>{formatDate(partialDate)} is a partial day.</strong> Claims are as of{' '}
          {formatDateTimeWib(raw.freshness.daily_rewards)} and spend as of{' '}
          {formatDateTimeWib(raw.freshness.spend_snapshot)}, so today's figures are still rising.
        </DataNote>
      )}

      {/* KPI row. Two-up on phones, six across on a wide screen. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.userOnboard ? (
          <KpiCard
            label="User onboard"
            value={formatNumber(kpis.userOnboard.value)}
            sub={
              <>
                opened the blindbox page
                {kpis.userOnboard.rate !== null && (
                  <> · {formatPercent(kpis.userOnboard.rate)} of active users</>
                )}
              </>
            }
            change={kpis.userOnboard.change ?? undefined}
            footnote={`From blindbox reach · as of ${formatDateTimeWib(kpis.userOnboard.asOf)}`}
          />
        ) : (
          <KpiCard
            label="User onboard"
            value={<span className="text-ink-5">Not available</span>}
            sub="No blindbox reach export uploaded yet"
            footnote={
              raw.viewer.canUpload ? (
                <Link to="/admin/upload" className="font-semibold text-info hover:underline">
                  Upload blindbox_reach in Admin
                </Link>
              ) : (
                'Appears once the team uploads a reach export'
              )
            }
          />
        )}

        <KpiCard
          label="Total box claims"
          value={formatNumber(kpis.boxClaims.total)}
          sub={
            <>
              {formatNumber(kpis.boxClaims.cashback)} cashback ·{' '}
              {formatNumber(kpis.boxClaims.coupon)} coupon
            </>
          }
          change={kpis.boxClaims.change}
          footnote="Since launch · ignores the date range"
        />

        <KpiCard
          label="Total gacha claims"
          value={formatNumber(kpis.gachaClaims.total)}
          sub={`${formatRupiah(kpis.gachaClaims.cashback)} cashback`}
          change={kpis.gachaClaims.change}
          footnote="Since launch · ignores the date range"
        />

        <KpiCard
          label="Total spend"
          value={formatRupiah(kpis.totalSpend.total)}
          sub={
            <>
              {formatRupiah(kpis.totalSpend.cashbackSpend)} cashback ·{' '}
              {formatRupiah(kpis.totalSpend.couponSpend)} coupons ·{' '}
              {formatRupiah(kpis.totalSpend.gachaCashback)} gacha
            </>
          }
          change={kpis.totalSpend.change}
          changeFormat="rupiah"
          footnote="All time · includes pre-launch tests · ignores the date range"
        />

        <KpiCard
          label="Coupon redemption"
          value={formatPercent(kpis.couponRedemption.rate)}
          sub={`${formatNumber(kpis.couponRedemption.redeemed)} of ${formatNumber(kpis.couponRedemption.claimed)} claimed`}
          footnote="Cashback is auto-credited and excluded"
        />

        <KpiCard
          label="Stock warnings"
          value={formatNumber(kpis.stock.warningCount + kpis.stock.outCount)}
          tone={kpis.stock.warningCount + kpis.stock.outCount > 0 ? 'danger' : 'good'}
          sub={
            kpis.stock.outCount > 0
              ? `${formatNumber(kpis.stock.outCount)} out of stock`
              : 'Nothing below 10% left'
          }
          footnote={
            kpis.stock.noStockCount > 0
              ? `${kpis.stock.noStockCount} reward with no stock set`
              : undefined
          }
        />
      </div>

      {/* Stamp ladder */}
      <Card label="Stamp ladder">
        <SectionHeader
          title="Stamp ladder"
          description={
            ladder.basis === 'reach'
              ? 'From opening the page to the 300-stamp box'
              : 'Claims per box since launch, ordered by stamps required'
          }
          freshness={freshnessText(raw.freshness, ['claims', 'reach'])}
        />
        {ladder.basis === 'claims' && (
          <div className="mb-4">
            <DataNote>
              No blindbox reach export has been uploaded, so the ladder shows claims only and starts
              at the Welcome Box. Upload <span className="font-mono">blindbox_reach</span> to see how
              many users reach each box.
            </DataNote>
          </div>
        )}
        {hasData || ladder.basis === 'reach' ? (
          <StampLadder ladder={ladder} />
        ) : (
          <EmptyState title="No claims in this date range" />
        )}
      </Card>

      {/* Daily trend */}
      <Card label="Daily activity">
        <SectionHeader
          title="Daily activity"
          description="Box and gacha claims per day, with total spend"
          freshness={freshnessText(raw.freshness, ['claims', 'gacha', 'dailySpend'])}
          action={
            <DownloadButton
              fileName={exportName('daily-activity', filter)}
              columns={dailyClaimColumns}
              rows={claimSeries}
            />
          }
        />
        <DailyTrendChart data={claimSeries} />
      </Card>

      {/* Spend split */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card label="Spend per day">
          <SectionHeader
            title="Spend per day"
            description="Box cashback, coupon redemptions and gacha cashback"
            freshness={freshnessText(raw.freshness, ['claims', 'dailySpend', 'gacha'])}
          />
          {incompleteDays.length > 0 && (
            <div className="mb-4">
              <DataNote>
                <strong>Coupon redemptions are missing from this chart.</strong> The daily spend
                export is not populating box spend on{' '}
                {incompleteDays.length === 1
                  ? formatDate(incompleteDays[0]!.date)
                  : `${incompleteDays.length} of ${spendSeries.length} dates`}
                .{' '}
                {usesDerivedCashback ? (
                  <>
                    Box cashback here is <strong>reconstructed from claims × the configured
                    payout</strong>, which is exact — cashback pays out its set value on every
                    claim. Coupons cannot be reconstructed, because a coupon only costs money once
                    a user redeems it.
                  </>
                ) : (
                  <>The cashback and coupon bars therefore understate reality.</>
                )}{' '}
                Gacha comes from a different export and is correct, and the cumulative totals above
                are unaffected.
              </DataNote>
            </div>
          )}
          <SpendSplitChart data={spendSeries} />
        </Card>

        <Card label="Cumulative split">
          <SectionHeader
            title="Cumulative split"
            description="All time, including a few pre-launch test claims"
            freshness={freshnessText(raw.freshness, ['spend', 'gacha'])}
          />
          <CumulativeSplit
            cashback={spend.cashbackSpend}
            coupon={spend.couponSpend}
            gacha={spend.gachaCashback}
          />
        </Card>
      </div>

      {/* Stock alerts */}
      <Card label="Stock alerts">
        <SectionHeader
          title="Stock alerts"
          description="Rewards at or below 10% stock left"
          freshness={freshnessText(raw.freshness, ['claims'])}
          action={
            <Link to="/rewards" className="font-semibold text-info hover:underline">
              All rewards →
            </Link>
          }
        />
        <StockAlerts summary={stock} />
      </Card>

      {filter.showTestData && (
        <DataNote tone="info">
          Pre-launch test data is included. The campaign launched {formatDate('2026-09-15')}; turn
          off the test-data toggle to see launch figures only.
        </DataNote>
      )}
    </div>
  );
}
