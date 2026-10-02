import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '@/hooks/useDashboard';
import { FirstRun } from '@/components/FirstRun';
import { Card, SectionHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DataNote, ErrorState, LoadingKpis, Skeleton } from '@/components/ui/states';
import { DownloadButton } from '@/components/DownloadButton';
import { REACH_VIEWS } from '@/components/ReachLadder';
import { freshnessText } from '@/components/Freshness';
import { StackedDailyChart } from '@/components/charts/StackedDailyChart';
import { QUEST_COLORS, TIER_COLORS } from '@/components/charts/chartTheme';
import { Scorecard } from '@/components/trends/Scorecard';
import { BoxDayTable } from '@/components/trends/BoxDayTable';
import { ActivityTrendTable } from '@/components/trends/ActivityTrendTable';
import { windowNote } from '@/components/trends/TrendCells';
import {
  activityChanges, activityTrends, claimTierSeries, claimsByBoxTable, dailyTrendRows, historyDepth,
  inRange, irregularWindows, questSeries, reachByBoxTable, reachChanges, reachTierSeries, scorecard,
  spendChanges, stampsByQuestSeries, tierDefs, trendMetrics, type ReachSegment,
} from '@/lib/metrics/trends';
import { boxDayColumns, dailyTrendColumns } from '@/lib/csv/columns';
import { csvFileName } from '@/lib/csv/export';
import { exportName } from '@/lib/csv/exportContext';
import type { SnapshotWindow } from '@/lib/metrics/trends';
import { formatDate, formatDateTimeWib, formatNumber, formatTimeWib } from '@/lib/format';

const DESCRIPTION =
  'What moved each day: new users, how far up the stamp ladder they climb, what they do and claim, and what it costs.';

export function Trends() {
  const { dataset, loading, error, reload, raw, filter, hasAnyData } = useDashboard();
  const [segment, setSegment] = useState<ReachSegment>('all');

  const data = useMemo(() => {
    if (!dataset) return null;
    const metrics = trendMetrics(dataset);
    const inView = <W extends { date: string }>(rows: W[]) => rows.filter((w) => inRange(w.date, dataset.filter));
    return {
      rows: scorecard(dataset, metrics),
      csvRows: dailyTrendRows(dataset, metrics),
      depth: historyDepth(dataset),
      tiers: tierDefs(dataset),
      quests: questSeries(dataset),
      claimTiers: claimTierSeries(dataset),
      claimsTable: claimsByBoxTable(dataset),
      stampsByQuest: stampsByQuestSeries(dataset),
      activity: activityTrends(dataset),
      irregular: groupIrregular([
        { source: 'reach', windows: irregularWindows(inView(reachChanges(dataset))) },
        { source: 'activity', windows: irregularWindows(inView(activityChanges(dataset))) },
        { source: 'total spend', windows: irregularWindows(inView(spendChanges(dataset))) },
      ]),
    };
  }, [dataset]);

  const reach = useMemo(
    () => (dataset
      ? { levels: reachTierSeries(dataset, segment), table: reachByBoxTable(dataset, segment) }
      : null),
    [dataset, segment],
  );

  if (loading) {
    return (
      <>
        <PageHeader title="Daily trends" description={DESCRIPTION} />
        <LoadingKpis count={4} />
        <Card className="mt-4"><Skeleton className="h-80" /></Card>
      </>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!dataset || !raw || !data || !reach) return null;
  if (!hasAnyData) return <FirstRun page="Daily trends" />;

  const { rows, csvRows, depth, tiers, quests, claimTiers, claimsTable, stampsByQuest, activity, irregular } = data;
  const tierSeries = tiers.map((t, i) => ({
    key: `t${i}`,
    label: t.stamps ? `${t.label} · ${t.stamps}` : t.label,
    color: TIER_COLORS[i] ?? 'var(--color-tier-5)',
  }));
  const questChartSeries = quests.map((q) => ({ ...q, color: QUEST_COLORS[q.key] ?? QUEST_COLORS.other! }));
  const shortHistory = [
    { label: 'blindbox_reach', days: depth.reach },
    { label: 'activity_level', days: depth.activity },
    { label: 'total_spent_reward', days: depth.spend },
  ].filter((s) => s.days < 2);
  const latestLevel = reach.levels[reach.levels.length - 1];
  const segmentLabel = REACH_VIEWS.find((v) => v.id === segment)?.label ?? 'Both';

  return (
    <>
      <PageHeader
        title="Daily trends"
        description={DESCRIPTION}
        freshness={freshnessText(raw.freshness, ['reach', 'activity', 'claims', 'gacha', 'spend'])}
      />

      <div className="mb-4 space-y-2">
        {shortHistory.length > 0 && (
          <DataNote tone="info">
            <strong>Day-over-day figures from the cumulative exports need two days of them.</strong>{' '}
            So far: {shortHistory.map((s) => `${s.label} ${s.days} day${s.days === 1 ? '' : 's'}`).join(', ')}.
            Upload these with the daily files every day, at about the same time, and the user, activity
            and coupon rows fill in on their own. Claims and gacha come from daily exports and are
            already complete.
          </DataNote>
        )}
        {irregular.length > 0 && (
          <DataNote>
            <strong>Some days cover more or less than 24 hours</strong> — an export was missed or taken
            at an unusual time, so the figure is real but not one day&apos;s worth:{' '}
            {irregular.map((g) => `${formatDate(g.date)}, ${g.note} (${g.sources.join(', ')})`).join('; ')}
            . These days are never used as a baseline or flagged as unusual.
          </DataNote>
        )}
        {filter.to && (
          <DataNote tone="info">
            The scorecard reports <strong>{formatDate(filter.to)}</strong>, the end of the date range.
            Clear the range to see the latest day.
          </DataNote>
        )}
      </div>

      <Card label="Daily scorecard">
        <SectionHeader
          title="Daily scorecard"
          description="Each metric's latest full day, against the day before and the 7 days before that. A day 30% or more away from its average is flagged."
          freshness={freshnessText(raw.freshness, ['reach', 'activity', 'claims', 'gacha', 'spend'])}
          action={
            <DownloadButton
              fileName={exportName('daily-trends', filter)}
              columns={dailyTrendColumns}
              rows={csvRows}
            />
          }
        />
        <Scorecard rows={rows} freshness={raw.freshness} />
        <p className="mt-3 text-micro text-ink-4">
          Users, activity and coupons are the change between one day&apos;s export and the next, so a
          day runs export to export rather than midnight to midnight. Claims, gacha and cashback come
          straight from the daily exports; their latest day is still running and is shown as
          &ldquo;today so far&rdquo; without being compared.
        </p>
      </Card>

      <Card label="Users with stamps" className="mt-4">
        <SectionHeader
          title="Users with stamps, by how far they have climbed"
          description="Users at the end of each day, grouped by the highest box their stamps reach"
          freshness={freshnessText(raw.freshness, ['reach'])}
          action={
            <SegmentedControl
              legend="Which users"
              options={REACH_VIEWS.map((v) => ({ value: v.id, label: v.label }))}
              selected={segment}
              onChange={setSegment}
              className="flex-wrap"
            />
          }
        />
        {latestLevel && (
          <p className="mb-3 text-micro text-ink-4">
            Not drawn: <span className="font-semibold text-ink-2 tnum">{formatNumber(latestLevel.belowFirst)}</span>{' '}
            users under 10 stamps on {formatDate(latestLevel.date)} — at that size they would flatten every
            tier above them.
          </p>
        )}
        <StackedDailyChart
          series={tierSeries}
          data={reach.levels.map((d) => ({
            date: d.date,
            values: d.tiers,
            caption: `End of ${formatDate(d.date)} · export ${formatTimeWib(d.at)}`,
          }))}
          emptyTitle="No reach export in this range"
          emptyDescription="Upload blindbox_reach daily to see users move up the ladder."
        />

        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-ink-1">New users reaching each box, per day</h3>
            <p className="mt-0.5 text-ink-3">
              Users whose stamps reached the box or beyond that day. Someone who jumps two boxes counts
              in both rows.
            </p>
          </div>
          <DownloadButton
            fileName={csvFileName('new-users-by-box', [segment === 'all' ? null : segmentLabel, filter.to])}
            columns={boxDayColumns(reach.table, 'reached_total')}
            rows={reach.table.columns.length > 0 ? reach.table.rows : []}
          />
        </div>
        {segment === 'N' && (
          <p className="mt-2 text-micro text-ink-4">
            Users leave this view when they open the blindbox page, so a box&apos;s figure can fall.
          </p>
        )}
        <div className="mt-3">
          <BoxDayTable
            table={reach.table}
            label="New users reaching each box, per day"
            totalLabel="Reached"
            emptyTitle="Needs two days of reach exports"
            emptyDescription="Each day's increase is the difference between two daily blindbox_reach exports."
          />
        </div>
      </Card>

      <Card label="Box claims per day" className="mt-4">
        <SectionHeader
          title="Box claims per day"
          description="Grouped by the same tiers as above, then per box"
          freshness={freshnessText(raw.freshness, ['claims'])}
          action={
            <DownloadButton
              fileName={exportName('claims-by-box', filter)}
              columns={boxDayColumns(claimsTable, 'claims_since_launch')}
              rows={claimsTable.columns.length > 0 ? claimsTable.rows : []}
            />
          }
        />
        <StackedDailyChart
          series={tierSeries}
          data={claimTiers.map((d) => ({
            date: d.date,
            values: d.tiers,
            caption: `${formatDate(d.date)}${d.partial ? ` · partial day, as of ${formatTimeWib(raw.freshness.daily_rewards)}` : ''}`,
          }))}
          emptyTitle="No claims in this range"
        />
        <div className="mt-6">
          <BoxDayTable
            table={claimsTable}
            label="Box claims per box, per day"
            totalLabel="Since launch"
            emptyTitle="No claims in this range"
          />
        </div>
      </Card>

      <Card label="Stamps issued per day" className="mt-4">
        <SectionHeader
          title="Stamps issued per day"
          description="By quest, then per activity. Daily Login is part of the Starter Quest."
          freshness={freshnessText(raw.freshness, ['activity'])}
        />
        <StackedDailyChart
          series={questChartSeries}
          data={stampsByQuest.map((d) => ({
            date: d.window.date,
            values: d.values,
            caption: `${formatDateTimeWib(d.window.prevAt)} → ${formatDateTimeWib(d.window.at)}`,
          }))}
          emptyTitle="Needs two days of activity exports"
          emptyDescription="Each day's stamps are the difference between two daily activity_level exports."
        />
        {activity.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 font-display font-bold text-ink-1">Activities on their latest day</h3>
            <ActivityTrendTable rows={activity} />
          </div>
        )}
      </Card>

      <p className="mt-4 text-micro text-ink-4">
        Daily cost by type, with the running total and the projection to campaign close, is on the{' '}
        <Link to="/budget" className="font-semibold text-info hover:underline">Budget page</Link>.
      </p>
    </>
  );
}

/** Irregular windows by day, so a day missed by every export is named once. */
function groupIrregular(bySource: Array<{ source: string; windows: SnapshotWindow[] }>) {
  const groups = new Map<string, { date: string; note: string; sources: string[] }>();
  for (const { source, windows } of bySource) {
    for (const w of windows) {
      const note = windowNote(w) ?? '';
      const key = `${w.date}|${note}`;
      const group = groups.get(key) ?? { date: w.date, note, sources: [] };
      group.sources.push(source);
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
}
