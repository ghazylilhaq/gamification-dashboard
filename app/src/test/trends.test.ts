import { describe, it, expect, beforeAll } from 'vitest';
import { buildDataset, type Dataset } from '@/lib/metrics/dataset';
import {
  activityChanges, claimTierSeries, claimsByBoxTable, closingDay, dailyTrendRows, historyDepth,
  hoursFromMidnight, irregularWindows, questSeries, reachByBoxTable, reachChanges, scorecard,
  snapshotDays, spendChanges, stampsByActivityTable, stampsByQuestSeries, tierDefs, trendMetrics,
  type TrendMetric, type TrendPoint,
} from '@/lib/metrics/trends';
import { hoursBetween } from '@/lib/time';
import { loadFixtureBootstrap } from './fixtures';
import type { ActivitySnapshot, Bootstrap, ReachHistoryRow } from '@/lib/types';

let boot: Bootstrap;
let ds: Dataset;

beforeAll(() => {
  boot = loadFixtureBootstrap();
  ds = buildDataset(boot);
});

/** A reach export from bucket → [onboarded, not onboarded] users. */
function reachExport(at: string, buckets: Record<number, [number, number]>): ReachHistoryRow[] {
  return Object.entries(buckets).flatMap(([bucket, [y, n]]) => [
    { snapshot_at: at, is_onboard: 'Y' as const, box_bucket: Number(bucket), users: y },
    { snapshot_at: at, is_onboard: 'N' as const, box_bucket: Number(bucket), users: n },
  ]);
}

function activityExport(at: string, rows: Record<string, [number, number, number]>): ActivitySnapshot[] {
  return Object.entries(rows).map(([ref_id, [customers, transactions, stamps_distributed]]) =>
    ({ snapshot_at: at, ref_id, customers, transactions, stamps_distributed }));
}

/** A dataset over the real reference data with the given history swapped in. */
function withHistory(history: Partial<Pick<Bootstrap, 'reachHistory' | 'activityHistory' | 'spendHistory'>>, filter = {}) {
  return buildDataset({ ...boot, reachHistory: [], activityHistory: [], spendHistory: [], ...history }, {
    showTestData: false,
    ...filter,
  });
}

/** The fixture as if its daily files had been pulled just after midnight on 16 Sep. */
function exportedAfterLaunchDay(): Dataset {
  return buildDataset({
    ...boot,
    freshness: { ...boot.freshness, daily_rewards: '2026-09-16 00:30:00', daily_gacha: '2026-09-16 00:30:00' },
  });
}

function metric(points: Array<[string, number]>): TrendMetric {
  return {
    id: 'm', label: 'M', group: 'Claims', format: 'count', source: 'claims', hint: '', csv: 'm',
    points: points.map(([date, value]): TrendPoint => ({ date, value, window: null })),
  };
}

describe('which day a snapshot export closes', () => {
  it('reads an export as the end of the day whose midnight is nearest', () => {
    expect(closingDay('2026-10-02 00:30:00')).toBe('2026-10-01');
    expect(closingDay('2026-10-02 11:04:14')).toBe('2026-10-01');
    expect(closingDay('2026-10-01 23:50:00')).toBe('2026-10-01');
    expect(closingDay('2026-10-02 15:10:00')).toBe('2026-10-02');
    expect(hoursFromMidnight('2026-10-02 00:30:00')).toBe(0.5);
    expect(hoursFromMidnight('2026-10-01 23:30:00')).toBe(-0.5);
  });

  it('keeps the export nearest midnight when several close the same day', () => {
    const days = snapshotDays([
      { snapshot_at: '2026-09-20 09:00:00' },
      { snapshot_at: '2026-09-20 00:30:00' },
      { snapshot_at: '2026-09-19 23:50:00' },
      { snapshot_at: '2026-09-19 00:20:00' },
    ]);
    expect(days.map((d) => [d.date, d.at])).toEqual([
      ['2026-09-18', '2026-09-19 00:20:00'],
      ['2026-09-19', '2026-09-19 23:50:00'],
    ]);
  });

  it('reports an after-midnight export as the full day before — H-1', () => {
    const [change] = reachChanges(withHistory({
      reachHistory: [
        ...reachExport('2026-09-19 00:30:00', { 0: [10, 10] }),
        ...reachExport('2026-09-20 00:30:00', { 0: [12, 15] }),
      ],
    }));
    expect(change).toMatchObject({ date: '2026-09-19', newUsers: 7, spanDays: 1, hours: 24 });
  });

  it('may use a pre-launch export as launch day\'s baseline, but drops pre-launch days', () => {
    const reachHistory = [
      ...reachExport('2026-09-14 00:30:00', { 0: [0, 5] }),
      ...reachExport('2026-09-15 00:30:00', { 0: [0, 9] }),
      ...reachExport('2026-09-16 00:30:00', { 0: [0, 30] }),
    ];
    expect(reachChanges(withHistory({ reachHistory })).map((c) => [c.date, c.newUsers])).toEqual([['2026-09-15', 21]]);
    const withTest = buildDataset({ ...boot, reachHistory }, { showTestData: true });
    expect(reachChanges(withTest).map((c) => c.date)).toEqual(['2026-09-14', '2026-09-15']);
  });

  it('measures each window in hours and calendar days, and flags a missed day', () => {
    expect(hoursBetween('2026-09-18 11:00:00', '2026-09-19 14:30:00')).toBe(27.5);
    const changes = reachChanges(withHistory({
      reachHistory: [
        ...reachExport('2026-09-18 00:30:00', { 0: [10, 10] }),
        ...reachExport('2026-09-20 00:30:00', { 0: [12, 10] }),
      ],
    }));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ date: '2026-09-19', spanDays: 2, hours: 48 });
    expect(irregularWindows(changes)).toHaveLength(1);
  });

  it('counts the days stored per source — the fixture has one of each', () => {
    expect(historyDepth(ds)).toEqual({ reach: 1, activity: 1, spend: 1 });
    // One export is a level, not yet a change.
    expect(reachChanges(ds)).toEqual([]);
    expect(activityChanges(ds)).toEqual([]);
    expect(spendChanges(ds)).toEqual([]);
  });
});

describe('new users reaching each box, day over day', () => {
  // Closing 17 Sep → closing 18 Sep: 5 new users under 10 stamps, 2 new
  // never-onboarded users straight to box 1, and 3 onboarded users climb from
  // box 1 to box 3.
  const day1 = reachExport('2026-09-18 00:30:00', { 0: [100, 1000], 1: [20, 30], 3: [5, 0] });
  const day2 = reachExport('2026-09-19 00:30:00', { 0: [100, 1005], 1: [17, 32], 3: [8, 0] });

  it('reports new users, newly onboarded and newly eligible', () => {
    const [change] = reachChanges(withHistory({ reachHistory: [...day1, ...day2] }));
    expect(change).toMatchObject({ date: '2026-09-18', newUsers: 7, newOnboard: 0, newEligible: 2 });
  });

  it('measures per-box increase on "reached or beyond", so climbing never reads as a loss', () => {
    const [change] = reachChanges(withHistory({ reachHistory: [...day1, ...day2] }));
    // Box 1 exactly lost 3 onboarded users, but nobody un-reached it: reached ≥ 1 rose by 2.
    expect(change!.reached.all.slice(0, 4)).toEqual([2, 3, 3, 0]);
    expect(change!.reached.Y.slice(0, 4)).toEqual([0, 3, 3, 0]);
    expect(change!.reached.N.slice(0, 4)).toEqual([2, 0, 0, 0]);
  });

  it('shows every date from launch, with a gap where no export closes the day', () => {
    const table = reachByBoxTable(withHistory({ reachHistory: [...day1, ...day2] }), 'all');
    expect(table.columns.map((c) => [c.date, c.missing])).toEqual([
      ['2026-09-15', true], ['2026-09-16', true], ['2026-09-17', true], ['2026-09-18', false],
    ]);
    expect(table.rows).toHaveLength(12);
    expect(table.rows[0]).toMatchObject({ label: 'Welcome Box', detail: '10', values: [null, null, null, 2], total: 57 });
    expect(table.rows[2]).toMatchObject({ values: [null, null, null, 3], total: 8 });
  });

  it('has no columns until there are two days', () => {
    expect(reachByBoxTable(ds, 'all').columns).toEqual([]);
  });

  it('labels the claim tiers with their stamp ranges from the box data', () => {
    expect(tierDefs(ds).map((t) => `${t.label} · ${t.stamps}`)).toEqual([
      'Box 1–2 · 10–34 stamps',
      'Box 3–4 · 35–74 stamps',
      'Box 5–6 · 75–119 stamps',
      'Box 7–9 · 120–209 stamps',
      'Box 10–12 · 210+ stamps',
    ]);
  });
});

describe('activity, day over day', () => {
  const day1 = activityExport('2026-09-18 00:30:00', {
    IGAME_DAILY_LOGIN: [1000, 5000, 5000],
    IGAME_QRIS_PAYMENT: [200, 400, 400],
    IGAME_PAYLATER_ACT_H: [10, 10, 300],
  });
  const day2 = activityExport('2026-09-19 00:30:00', {
    IGAME_DAILY_LOGIN: [1100, 5800, 5800],
    IGAME_QRIS_PAYMENT: [230, 470, 470],
    IGAME_PAYLATER_ACT_H: [12, 12, 360],
    OPEN_GROW: [4, 5, 15],
  });

  it('reads daily logins off the login activity, and keeps it out of transactions', () => {
    const [change] = activityChanges(withHistory({ activityHistory: [...day1, ...day2] }));
    expect(change!.dailyLogins).toBe(800);
    // 70 QRIS + 2 Paylater + 5 for an activity new today, counted from zero.
    expect(change!.transactions).toBe(77);
    expect(change!.stamps).toBe(800 + 70 + 60 + 15);
  });

  it('splits stamps by quest, keyed so the colour follows the quest', () => {
    const [change] = activityChanges(withHistory({ activityHistory: [...day1, ...day2] }));
    const quests = questSeries(ds).map((q) => q.key);
    const total = quests.reduce((acc, key) => acc + (change!.stampsByQuest[key] ?? 0), 0);
    expect(total).toBe(change!.stamps);
    expect(change!.stampsByQuest.q1).toBeGreaterThanOrEqual(800);
  });

  it('has no login figure when the login activity is missing from an export', () => {
    const [change] = activityChanges(withHistory({
      activityHistory: [...day1.filter((r) => r.ref_id !== 'IGAME_DAILY_LOGIN'), ...day2],
    }));
    expect(change!.dailyLogins).toBeNull();
  });

  it('tabulates stamps per activity on every date, busiest first', () => {
    const table = stampsByActivityTable(withHistory({ activityHistory: [...day1, ...day2] }));
    expect(table.columns.map((c) => c.date)).toEqual(['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']);
    expect(table.rows[0]).toMatchObject({
      key: 'IGAME_DAILY_LOGIN', label: 'Daily Login', detail: 'Starter Quest', values: [null, null, null, 800], total: 5_800,
    });
    expect(table.rows.find((r) => r.key === 'IGAME_PAYLATER_ACT_H')?.values).toEqual([null, null, null, 60]);
    expect(table.questOf.get('IGAME_DAILY_LOGIN')).toBe('q1');
  });

  it('draws the quest chart over the same dates, leaving gaps empty rather than zero', () => {
    const series = stampsByQuestSeries(withHistory({ activityHistory: [...day1, ...day2] }));
    expect(series.map((d) => d.date)).toEqual(['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']);
    expect(series[0]!.values.every((v) => v === null)).toBe(true);
    expect(series[3]!.values.reduce<number>((a, v) => a + (v ?? 0), 0)).toBe(945);
  });
});

describe('coupon redemptions, day over day', () => {
  it('recovers daily redemptions the daily spend file is missing', () => {
    const next = boot.spendHistory.map((r) => ({
      ...r,
      snapshot_at: '2026-09-16 13:51:34',
      redeemed: r.type === 'COUPON' ? r.redeemed + 10 : r.redeemed,
      spend: r.type === 'COUPON' ? r.spend + 75_000 : r.spend,
    }));
    const [change] = spendChanges(withHistory({ spendHistory: [...boot.spendHistory, ...next] }));
    expect(change).toMatchObject({ couponsRedeemed: 10, couponSpend: 75_000 });
  });

  it('sums the fixture to the spec\'s 32 redeemed coupons and Rp190.000', () => {
    const coupon = boot.spendHistory.find((r) => r.type === 'COUPON');
    expect(coupon).toMatchObject({ redeemed: 32, spend: 190_000 });
  });
});

describe('claims per day — full days only', () => {
  it('leaves out the day the claims file was pulled on', () => {
    // The fixture's claims export is from 12:36 on launch day itself.
    expect(claimsByBoxTable(ds).columns).toEqual([]);
    expect(claimTierSeries(ds)).toEqual([]);
  });

  it('shows launch day once a later export has closed it', () => {
    const closed = exportedAfterLaunchDay();
    const table = claimsByBoxTable(closed);
    expect(table.columns).toEqual([{ date: '2026-09-15', spanDays: 1, missing: false }]);
    expect(table.rows[0]).toMatchObject({ label: 'Welcome Box', values: [814], total: 814 });
    expect(claimTierSeries(closed)[0]!.tiers.reduce((a, b) => a + b, 0)).toBe(1_991);
  });

  it('fills every date between the first and last full day', () => {
    const withTest = buildDataset(boot, { showTestData: true });
    const series = claimTierSeries(withTest);
    expect(series[0]!.date).toBe('2026-08-29');
    expect(series[series.length - 1]!.date).toBe('2026-09-14');
    expect(series).toHaveLength(17);
    // 30 Aug had no claims: shown as a zero day, not skipped.
    expect(series.find((d) => d.date === '2026-08-30')!.tiers).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('scorecard', () => {
  it('compares the latest day with the one before', () => {
    const [row] = scorecard(ds, [metric([['2026-09-20', 100], ['2026-09-21', 120]])]);
    expect(row!.latest?.date).toBe('2026-09-21');
    expect(row!.vsPrevious).toMatchObject({ delta: 20, pct: 0.2 });
  });

  it('needs three earlier days for a baseline', () => {
    const [two] = scorecard(ds, [metric([['2026-09-20', 100], ['2026-09-21', 100], ['2026-09-22', 100]])]);
    expect(two!.baseline).toBeNull();
    const [three] = scorecard(ds, [metric([['2026-09-19', 90], ['2026-09-20', 100], ['2026-09-21', 110], ['2026-09-22', 100]])]);
    expect(three!.baseline).toEqual({ value: 100, days: 3 });
    expect(three!.vsBaseline).toBe(0);
  });

  it('averages at most the seven days before', () => {
    const points: Array<[string, number]> = Array.from({ length: 10 }, (_, i) => [`2026-09-${String(16 + i).padStart(2, '0')}`, i < 2 ? 1_000 : 100]);
    const [row] = scorecard(ds, [metric(points)]);
    expect(row!.baseline).toEqual({ value: 100, days: 7 });
  });

  it('flags a day 30% or more away from its average', () => {
    const base: Array<[string, number]> = [['2026-09-17', 100], ['2026-09-18', 100], ['2026-09-19', 100]];
    const [high] = scorecard(ds, [metric([...base, ['2026-09-20', 150]])]);
    expect(high!.unusual).toBe('high');
    const [low] = scorecard(ds, [metric([...base, ['2026-09-20', 60]])]);
    expect(low!.unusual).toBe('low');
    const [normal] = scorecard(ds, [metric([...base, ['2026-09-20', 120]])]);
    expect(normal!.unusual).toBeNull();
  });

  it('does not flag noise on tiny numbers', () => {
    const [row] = scorecard(ds, [metric([['2026-09-17', 2], ['2026-09-18', 2], ['2026-09-19', 2], ['2026-09-20', 6]])]);
    expect(row!.vsBaseline).toBe(2);
    expect(row!.unusual).toBeNull();
  });

  it('never flags or averages a window that covers a missed day', () => {
    const reachHistory = [
      ...reachExport('2026-09-16 00:30:00', { 0: [0, 100] }),
      ...reachExport('2026-09-17 00:30:00', { 0: [0, 200] }),
      ...reachExport('2026-09-18 00:30:00', { 0: [0, 300] }),
      ...reachExport('2026-09-19 00:30:00', { 0: [0, 400] }),
      ...reachExport('2026-09-21 00:30:00', { 0: [0, 600] }),
    ];
    const rows = scorecard(withHistory({ reachHistory }));
    const newUsers = rows.find((r) => r.metric.id === 'newUsers')!;
    expect(newUsers.latest).toMatchObject({ date: '2026-09-20', value: 200 });
    expect(newUsers.latest?.window?.spanDays).toBe(2);
    expect(newUsers.unusual).toBeNull();
  });

  it('reviews an earlier day when the range ends before today', () => {
    const points: Array<[string, number]> = [['2026-09-17', 100], ['2026-09-18', 110], ['2026-09-19', 120], ['2026-09-20', 130]];
    const ranged = buildDataset(boot, { showTestData: false, to: '2026-09-19' });
    const [row] = scorecard(ranged, [metric(points)]);
    expect(row!.latest?.date).toBe('2026-09-19');
    expect(row!.spark.map((p) => p.date)).toEqual(['2026-09-17', '2026-09-18', '2026-09-19']);
  });

  it('covers every metric, and never reports the day still running', () => {
    const rows = scorecard(ds);
    expect(rows.map((r) => r.metric.id)).toEqual(trendMetrics(ds).map((m) => m.id));
    // Launch day was still running when the fixture's daily files were pulled.
    expect(rows.find((r) => r.metric.id === 'boxClaims')!.latest).toBeNull();
    expect(rows.find((r) => r.metric.id === 'gachaClaims')!.latest).toBeNull();

    const closed = scorecard(exportedAfterLaunchDay());
    expect(closed.find((r) => r.metric.id === 'boxClaims')!.latest).toMatchObject({ date: '2026-09-15', value: 1_991 });
    expect(closed.find((r) => r.metric.id === 'gachaClaims')!.latest).toMatchObject({ date: '2026-09-15', value: 1_279 });
  });
});

describe('daily trend CSV rows', () => {
  it('has one row per full day in range, with every metric as a column', () => {
    expect(dailyTrendRows(ds)).toEqual([]);
    const rows = dailyTrendRows(exportedAfterLaunchDay());
    expect(rows.map((r) => r.date)).toEqual(['2026-09-15']);
    expect(rows[0]!.values.boxClaims).toBe(1_991);
    expect(rows[0]!.values.gachaUsers).toBe(812);
    expect(rows[0]!.values.newUsers).toBeNull();
  });
});
