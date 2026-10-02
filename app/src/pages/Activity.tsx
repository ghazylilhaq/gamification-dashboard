import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '@/hooks/useDashboard';
import { FirstRun } from '@/components/FirstRun';
import { Card, SectionHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { DownloadButton } from '@/components/DownloadButton';
import { REACH_VIEWS, ReachLadder, type ReachView } from '@/components/ReachLadder';
import { ActivityTable } from '@/components/ActivityTable';
import type { ActivityRow } from '@/lib/metrics/activity';
import { stampLadder } from '@/lib/metrics/claims';
import { DataNote, EmptyState, ErrorState, LoadingKpis, Skeleton } from '@/components/ui/states';
import { freshnessText } from '@/components/Freshness';
import { hasReachData, reachFunnel, reachTotals } from '@/lib/metrics/reach';
import { activityRows, activityTotals, hasActivityData } from '@/lib/metrics/activity';
import { activityColumns, reachColumns } from '@/lib/csv/columns';
import { csvFileName } from '@/lib/csv/export';
import { formatNumber, formatPercent } from '@/lib/format';

export function Activity() {
  const { dataset, loading, error, reload, raw, hasAnyData } = useDashboard();
  const [view, setView] = useState<ReachView>('all');
  // What the activity table currently shows, so its CSV matches the screen.
  const [tableRows, setTableRows] = useState<ActivityRow[] | null>(null);
  const [tableQuest, setTableQuest] = useState<string | null>(null);
  const onTableChange = useCallback((visible: ActivityRow[], quest: string | null) => {
    setTableRows(visible);
    setTableQuest(quest);
  }, []);

  const data = useMemo(() => {
    if (!dataset) return null;
    return {
      withReach: hasReachData(dataset),
      withActivity: hasActivityData(dataset),
      reach: reachTotals(dataset),
      funnel: reachFunnel(dataset),
      ladder: stampLadder(dataset),
      rows: activityRows(dataset),
      totals: activityTotals(dataset),
    };
  }, [dataset]);

  if (loading) {
    return (
      <>
        <PageHeader title="Activity" description="What users do to earn stamps, and how far it gets them" />
        <LoadingKpis count={5} />
        <Card className="mt-4"><Skeleton className="h-80" /></Card>
      </>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!dataset || !raw || !data) return null;
  if (!hasAnyData && !data.withReach && !data.withActivity) return <FirstRun page="Activity" />;

  const { withReach, withActivity, reach, funnel, ladder, rows, totals } = data;

  if (!withReach && !withActivity) {
    return (
      <>
        <PageHeader title="Activity" description="What users do to earn stamps, and how far it gets them" />
        <Card label="Activity">
          <EmptyState
            title="No activity or reach export uploaded yet"
            description="Upload activity_level and blindbox_reach with the daily files, and activity_list with the reference data."
            action={
              raw.viewer.canUpload ? (
                <Link to="/admin/upload" className="font-semibold text-info hover:underline">
                  Go to Admin upload
                </Link>
              ) : undefined
            }
          />
        </Card>
      </>
    );
  }

  const inactive = rows.filter((r) => r.inactive);
  const topShare = rows[0];

  return (
    <>
      <PageHeader
        title="Activity"
        description="What users do to earn stamps, and how far up the ladder it gets them. Cumulative snapshots — the date range does not apply."
        freshness={freshnessText(raw.freshness, ['activity', 'reach'])}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Active users"
          value={withReach ? formatNumber(reach.activeUsers) : '—'}
          sub="unique · have any stamp"
          change={reach.change ? delta(reach.activeUsers, reach.change.activeUsers) : undefined}
          footnote="From blindbox reach"
        />
        <KpiCard
          label="Onboarded"
          value={withReach ? formatNumber(reach.onboardY) : '—'}
          sub={reach.onboardRate !== null ? `${formatPercent(reach.onboardRate)} opened the page` : undefined}
          change={reach.change ? delta(reach.onboardY, reach.change.onboardY) : undefined}
          footnote="The User onboard figure"
        />
        <KpiCard
          label="Eligible, never opened"
          value={withReach ? formatNumber(reach.untappedEligible) : '—'}
          tone={reach.untappedEligible > 0 ? 'warn' : 'neutral'}
          sub="have ≥10 stamps, never opened the page"
          change={reach.change ? delta(reach.untappedEligible, reach.change.untappedEligible) : undefined}
          footnote="Rewards earned and not yet discovered"
        />
        <KpiCard
          label="Transactions"
          value={withActivity ? formatNumber(totals.transactions) : '—'}
          sub={`${formatNumber(totals.activeActivities)} of ${formatNumber(totals.activities)} activities in use`}
          change={totals.change ? delta(totals.transactions, totals.change.transactions) : undefined}
        />
        <KpiCard
          label="Stamps issued"
          value={withActivity ? formatNumber(totals.stamps) : '—'}
          sub={
            topShare && topShare.stamps > 0
              ? `${formatPercent(topShare.stampShare, 0)} from ${topShare.name}`
              : undefined
          }
          change={totals.change ? delta(totals.stamps, totals.change.stamps) : undefined}
        />
      </div>

      {withReach && (
        <Card label="Reach" className="mt-4">
          <SectionHeader
            title="How far users have got"
            description="Users with stamps enough for each box, whether they have opened the blindbox page, and how many of them claimed"
            freshness={freshnessText(raw.freshness, ['reach', 'claims'])}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div role="group" aria-label="Which users" className="flex rounded-control border border-line-1 p-0.5">
                  {REACH_VIEWS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={view === v.id}
                      onClick={() => setView(v.id)}
                      className={`rounded-[0.45rem] px-2.5 py-1 text-micro font-semibold whitespace-nowrap transition-colors ${
                        view === v.id ? 'bg-allo-yellow-tint text-ink-1' : 'text-ink-3 hover:text-ink-1'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              <DownloadButton
                fileName={csvFileName('blindbox-reach', [reach.asOf?.slice(0, 10)])}
                columns={reachColumns}
                rows={funnel.map((f, i) => {
                  const step = ladder.steps[i];
                  return {
                    ...f,
                    boxName: step?.boxName ?? `Box ${f.box}`,
                    // Since-launch claims, matching the rate's numerator.
                    claims: step?.claimsSinceLaunch ?? 0,
                    claimRate: step?.claimRate ?? null,
                    claimRateApproximate: step?.claimRateApproximate ?? false,
                  };
                })}
              />
              </div>
            }
          />

          {reach.untappedEligible > 0 && view !== 'Y' && (
            <div className="mb-4">
              <DataNote>
                <strong>
                  {formatNumber(reach.untappedEligible)} users have already earned at least the Welcome
                  Box but have never opened the blindbox page
                </strong>{' '}
                — {reach.eligibleY > 0 && reach.untappedEligible > reach.eligibleY ? 'more than' : 'against'}{' '}
                the {formatNumber(reach.eligibleY)} onboarded users who are eligible. They are the orange
                part of each bar below: rewards earned and not yet discovered.
              </DataNote>
            </div>
          )}

          <ReachLadder totals={reach} funnel={funnel} ladder={ladder} view={view} />

          <p className="mt-3 text-micro text-ink-4">
            Claim rate is a box's claims divided by the onboarded users who reached it — only users who
            have opened the page can claim. It assumes one claim per user per box.
          </p>
        </Card>
      )}

      {withActivity && (
        <Card label="All activities" className="mt-4">
          <SectionHeader
            title="All activities"
            description="Filter by group, sort by any column. Customers are drawn as bars; transactions per customer shows which activities people repeat."
            freshness={freshnessText(raw.freshness, ['activity'])}
            action={
              <DownloadButton
                fileName={csvFileName('activity', [tableQuest, totals.asOf?.slice(0, 10)])}
                columns={activityColumns}
                rows={tableRows ?? rows}
              />
            }
          />

          <div className="mb-4 space-y-2">
            <DataNote tone="info">
              <strong>Customers are per activity and cannot be added up.</strong> One person does
              several activities, so the column counts people repeatedly across rows. The unique figure
              is Active users above, from the reach export.
            </DataNote>
            {totals.mismatches.length > 0 && (
              <DataNote>
                <strong>
                  {totals.mismatches.length} activit{totals.mismatches.length === 1 ? 'y issues' : 'ies issue'} a
                  few more stamps than transactions × reward stamp:
                </strong>{' '}
                {totals.mismatches.map((m) => `${m.name} (+${formatNumber(m.actual - m.expected)})`).join(', ')}
                . Small enough to be adjustments or a mid-campaign change to the stamp value; worth
                confirming with the data owner.
              </DataNote>
            )}
            {inactive.length > 0 && (
              <DataNote tone="info">No activity yet: {inactive.map((r) => r.name).join(', ')}.</DataNote>
            )}
          </div>

          <ActivityTable rows={rows} onVisibleRowsChange={onTableChange} />
        </Card>
      )}
    </>
  );
}

/** A Delta from the current value and its change since the previous export. */
function delta(current: number, change: number) {
  const previous = current - change;
  return { current, previous, delta: change, pct: previous !== 0 ? change / previous : null };
}
