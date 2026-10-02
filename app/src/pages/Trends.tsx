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
import { DayTable } from '@/components/trends/DayTable';
import { windowNote } from '@/components/trends/TrendCells';
import { MIDNIGHT_TOLERANCE_HOURS } from '@/config/trends';
import {
  activityChanges, claimTierSeries, claimsByBoxTable, dailyTrendRows, historyDepth, hoursFromMidnight,
  inRange, irregularWindows, questSeries, reachByBoxTable, reachChanges, scorecard, spendChanges,
  stampsByActivityTable, stampsByQuestSeries, tierDefs, trendMetrics, type ReachSegment,
  type SnapshotWindow,
} from '@/lib/metrics/trends';
import { dailyTrendColumns, dayTableColumns } from '@/lib/csv/columns';
import { csvFileName } from '@/lib/csv/export';
import { exportName } from '@/lib/csv/exportContext';
import { formatDate, formatDateTimeWib, formatTimeWib } from '@/lib/format';

const DESCRIPTION =
  'What moved each full day: new users, how far up the stamp ladder they climb, what they do and claim, and what it costs.';

const BOX_HEADERS = { key: 'box_position', label: 'box_name', detail: 'stamp_required' };

export function Trends() {
  const { dataset, loading, error, reload, raw, filter, hasAnyData } = useDashboard();
  const [segment, setSegment] = useState<ReachSegment>('all');

  const data = useMemo(() => {
    if (!dataset) return null;
    const metrics = trendMetrics(dataset);
    const inView = <W extends { date: string }>(rows: W[]) => rows.filter((w) => inRange(w.date, dataset.filter));
    const reach = inView(reachChanges(dataset));
    const activity = inView(activityChanges(dataset));
    const spend = inView(spendChanges(dataset));
    return {
      rows: scorecard(dataset, metrics),
      csvRows: dailyTrendRows(dataset, metrics),
      depth: historyDepth(dataset),
      tiers: tierDefs(dataset),
      quests: questSeries(dataset),
      claimTiers: claimTierSeries(dataset),
      claimsTable: claimsByBoxTable(dataset),
      stampsByQuest: stampsByQuestSeries(dataset),
      stampsTable: stampsByActivityTable(dataset),
      irregular: groupIrregular([
        { source: 'reach', windows: irregularWindows(reach) },
        { source: 'activity', windows: irregularWindows(activity) },
        { source: 'total spend', windows: irregularWindows(spend) },
      ]),
      // The latest export of any snapshot source, if it is far from midnight.
      offMidnight: ([reach, activity, spend] as SnapshotWindow[][])
        .map((w) => w[w.length - 1])
        .find((w): w is SnapshotWindow =>
          w !== undefined && Math.abs(hoursFromMidnight(w.at)) > MIDNIGHT_TOLERANCE_HOURS) ?? null,
    };
  }, [dataset]);

  const reachTable = useMemo(() => (dataset ? reachByBoxTable(dataset, segment) : null), [dataset, segment]);

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
  if (!dataset || !raw || !data || !reachTable) return null;
  if (!hasAnyData) return <FirstRun page="Daily trends" />;

  const {
    rows, csvRows, depth, tiers, quests, claimTiers, claimsTable, stampsByQuest, stampsTable, irregular, offMidnight,
  } = data;
  const tierSeries = tiers.map((t, i) => ({
    key: `t${i}`,
    label: t.stamps ? `${t.label} · ${t.stamps}` : t.label,
    color: TIER_COLORS[i] ?? 'var(--color-tier-5)',
  }));
  const questColour = (key: string | undefined) => QUEST_COLORS[key ?? 'other'] ?? QUEST_COLORS.other!;
  const questChartSeries = quests.map((q) => ({ ...q, color: questColour(q.key) }));
  const shortHistory = [
    { label: 'blindbox_reach', days: depth.reach },
    { label: 'activity_level', days: depth.activity },
    { label: 'total_spent_reward', days: depth.spend },
  ].filter((s) => s.days < 2);
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
            Upload these with the daily files every day, just after midnight, and the user, activity
            and coupon rows fill in on their own. Claims and gacha come from daily exports and are
            already complete.
          </DataNote>
        )}
        {offMidnight && (
          <DataNote tone="info">
            <strong>
              Snapshot days run from {formatTimeWib(offMidnight.at)} to {formatTimeWib(offMidnight.at)}, not
              midnight to midnight.
            </strong>{' '}
            The cumulative exports were taken at {formatTimeWib(offMidnight.at)}, so each day&apos;s users,
            stamps and coupons are counted export to export. Export them just after midnight WIB and
            every figure here becomes a full calendar day.
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
          description="Each metric's latest full day (H-1), against the day before and the 7 days before that. A day 30% or more away from its average is flagged."
          freshness={freshnessText(raw.freshness, ['reach', 'activity', 'claims', 'gacha', 'spend'])}
          action={
            <DownloadButton
              fileName={exportName('daily-trends', filter)}
              columns={dailyTrendColumns}
              rows={csvRows}
            />
          }
        />
        <Scorecard rows={rows} />
        <p className="mt-3 text-micro text-ink-4">
          Full days only: the day an export is pulled is still running, so it is left out until the
          next export. Users, activity and coupons are the change in the cumulative exports from one
          day to the next; claims, gacha and cashback come straight from the daily exports.
        </p>
      </Card>

      <Card label="New users reaching each box" className="mt-4">
        <SectionHeader
          title="New users reaching each box, per day"
          description="Users whose stamps reached the box or beyond that day. Someone who jumps two boxes counts in both rows."
          freshness={freshnessText(raw.freshness, ['reach'])}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                legend="Which users"
                options={REACH_VIEWS.map((v) => ({ value: v.id, label: v.label }))}
                selected={segment}
                onChange={setSegment}
                className="flex-wrap"
              />
              <DownloadButton
                fileName={csvFileName('new-users-by-box', [segment === 'all' ? null : segmentLabel, filter.to])}
                columns={dayTableColumns(reachTable, { ...BOX_HEADERS, total: 'reached_total' })}
                rows={reachTable.columns.length > 0 ? reachTable.rows : []}
              />
            </div>
          }
        />
        {segment === 'N' && (
          <p className="mb-3 text-micro text-ink-4">
            Users leave this view when they open the blindbox page, so a box&apos;s figure can fall.
          </p>
        )}
        <DayTable
          table={reachTable}
          label="New users reaching each box, per day"
          rowHeader="Box"
          totalLabel="Reached"
          detailNote="Numbers beside box names are stamps required."
          emptyTitle="Needs two days of reach exports"
          emptyDescription="Each day's increase is the difference between two daily blindbox_reach exports."
        />
      </Card>

      <Card label="Box claims per day" className="mt-4">
        <SectionHeader
          title="Box claims per day"
          description="By stamp tier, then per box"
          freshness={freshnessText(raw.freshness, ['claims'])}
          action={
            <DownloadButton
              fileName={exportName('claims-by-box', filter)}
              columns={dayTableColumns(claimsTable, { ...BOX_HEADERS, total: 'claims_since_launch' })}
              rows={claimsTable.columns.length > 0 ? claimsTable.rows : []}
            />
          }
        />
        <StackedDailyChart
          series={tierSeries}
          data={claimTiers.map((d) => ({ date: d.date, values: d.tiers }))}
          emptyTitle="No full days of claims in this range"
        />
        <div className="mt-6">
          <DayTable
            table={claimsTable}
            label="Box claims per box, per day"
            rowHeader="Box"
            totalLabel="Since launch"
            detailNote="Numbers beside box names are stamps required."
            emptyTitle="No full days of claims in this range"
          />
        </div>
      </Card>

      <Card label="Stamps issued per day" className="mt-4">
        <SectionHeader
          title="Stamps issued per day"
          description="Every day, by quest, then per activity. Daily Login is part of the Starter Quest."
          freshness={freshnessText(raw.freshness, ['activity'])}
          action={
            <DownloadButton
              fileName={exportName('stamps-by-activity', filter)}
              columns={dayTableColumns(stampsTable, { key: 'activity_id', label: 'activity', detail: 'quest', total: 'stamps_to_date' })}
              rows={stampsTable.columns.length > 0 ? stampsTable.rows : []}
            />
          }
        />
        <StackedDailyChart
          series={questChartSeries}
          data={stampsByQuest.map((d) => ({
            date: d.date,
            values: d.values,
            caption: d.window ? `${formatDateTimeWib(d.window.prevAt)} → ${formatDateTimeWib(d.window.at)}` : null,
          }))}
          emptyTitle="Needs two days of activity exports"
          emptyDescription="Each day's stamps are the difference between two daily activity_level exports."
        />
        <div className="mt-6">
          <h3 className="mb-3 font-display font-bold text-ink-1">Stamps per activity, per day</h3>
          <DayTable
            table={stampsTable}
            label="Stamps per activity, per day"
            rowHeader="Activity"
            totalLabel="To date"
            detailNote="Beside each activity: its quest."
            marker={(row) => questColour(stampsTable.questOf.get(row.key))}
            collapseAfter={10}
            emptyTitle="Needs two days of activity exports"
            emptyDescription="Each day's stamps are the difference between two daily activity_level exports."
          />
        </div>
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
