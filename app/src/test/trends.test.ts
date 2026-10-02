import { describe, it, expect, beforeAll } from 'vitest';
import { buildDataset, type Dataset } from '@/lib/metrics/dataset';
import {
  activityChanges, activityTrends, claimTierSeries, claimsByBoxTable, dailyTrendRows, historyDepth,
  irregularWindows, questSeries, reachByBoxTable, reachChanges, reachDays, reachTierSeries, scorecard,
  snapshotDays, spendChanges, tierDefs, trendMetrics, type TrendMetric, type TrendPoint,
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

function metric(points: Array<[string, number, boolean?]>): TrendMetric {
  return {
    id: 'm', label: 'M', group: 'Claims', format: 'count', source: 'claims', hint: '', csv: 'm',
    points: points.map(([date, value, partial]): TrendPoint => ({ date, value, partial: partial ?? false, window: null })),
  };
}

describe('snapshot history', () => {
  it('uses the last export of each WIB day, oldest first', () => {
    const days = snapshotDays([
      { snapshot_at: '2026-09-19 18:00:00' },
      { snapshot_at: '2026-09-19 09:00:00' },
      { snapshot_at: '2026-09-18 11:04:14' },
    ], false);
    expect(days.map((d) => d.at)).toEqual(['2026-09-18 11:04:14', '2026-09-19 18:00:00']);
  });

  it('drops pre-launch exports unless test data is on', () => {
    const rows = [{ snapshot_at: '2026-09-14 10:00:00' }, { snapshot_at: '2026-09-16 10:00:00' }];
    expect(snapshotDays(rows, false).map((d) => d.date)).toEqual(['2026-09-16']);
    expect(snapshotDays(rows, true).map((d) => d.date)).toEqual(['2026-09-14', '2026-09-16']);
  });

  it('measures each window in hours and calendar days', () => {
    expect(hoursBetween('2026-09-18 11:00:00', '2026-09-19 14:30:00')).toBe(27.5);
    const changes = reachChanges(withHistory({
      reachHistory: [
        ...reachExport('2026-09-18 11:00:00', { 0: [10, 10] }),
        ...reachExport('2026-09-20 11:00:00', { 0: [12, 10] }),
      ],
    }));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ date: '2026-09-20', spanDays: 2, hours: 48 });
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

describe('users with stamps, day over day', () => {
  // Day 1 → day 2: 5 new users under 10 stamps, 2 new never-onboarded users
  // straight to box 1, and 3 onboarded users climb from box 1 to box 3.
  const day1 = reachExport('2026-09-18 11:00:00', { 0: [100, 1000], 1: [20, 30], 3: [5, 0] });
  const day2 = reachExport('2026-09-19 11:00:00', { 0: [100, 1005], 1: [17, 32], 3: [8, 0] });

  it('reports new users, newly onboarded and newly eligible', () => {
    const [change] = reachChanges(withHistory({ reachHistory: [...day1, ...day2] }));
    expect(change).toMatchObject({ newUsers: 7, newOnboard: 0, newEligible: 2, untappedChange: 2 });
  });

  it('measures per-box increase on "reached or beyond", so climbing never reads as a loss', () => {
    const [change] = reachChanges(withHistory({ reachHistory: [...day1, ...day2] }));
    // Box 1 exactly lost 3 onboarded users, but nobody un-reached it: reached ≥ 1 rose by 2.
    expect(change!.reached.all.slice(0, 4)).toEqual([2, 3, 3, 0]);
    expect(change!.reached.Y.slice(0, 4)).toEqual([0, 3, 3, 0]);
    expect(change!.reached.N.slice(0, 4)).toEqual([2, 0, 0, 0]);
  });

  it('splits users into tiers that add up to everyone eligible', () => {
    const [day] = reachDays(ds);
    expect(day!.measure.tiers.all).toEqual([18_136, 2_125, 452, 271, 6]);
    expect(day!.measure.tiers.all.reduce((a, b) => a + b, 0)).toBe(day!.measure.eligible);
    expect(day!.measure.eligible).toBe(20_990);
    expect(day!.measure.belowFirst.all).toBe(297_473);
  });

  it('labels tiers with their stamp ranges from the box data', () => {
    expect(tierDefs(ds).map((t) => `${t.label} · ${t.stamps}`)).toEqual([
      'Box 1–2 · 10–34 stamps',
      'Box 3–4 · 35–74 stamps',
      'Box 5–6 · 75–119 stamps',
      'Box 7–9 · 120–209 stamps',
      'Box 10–12 · 210+ stamps',
    ]);
  });

  it('follows the onboard view through the tier series', () => {
    const y = reachTierSeries(ds, 'Y')[0]!;
    expect(y.tiers).toEqual([4_368, 1_086, 452, 271, 6]);
    expect(y.belowFirst).toBe(38_733);
  });

  it('builds the per-box table from the changes, with reached-so-far as the total', () => {
    const table = reachByBoxTable(withHistory({ reachHistory: [...day1, ...day2] }), 'all');
    expect(table.columns.map((c) => c.date)).toEqual(['2026-09-19']);
    expect(table.rows).toHaveLength(12);
    expect(table.rows[0]).toMatchObject({ name: 'Welcome Box', stampRequired: 10, values: [2], total: 57 });
    expect(table.rows[2]).toMatchObject({ values: [3], total: 8 });
  });

  it('has no columns until there are two days', () => {
    expect(reachByBoxTable(ds, 'all').columns).toEqual([]);
  });
});

describe('activity, day over day', () => {
  const day1 = activityExport('2026-09-18 11:00:00', {
    IGAME_DAILY_LOGIN: [1000, 5000, 5000],
    IGAME_QRIS_PAYMENT: [200, 400, 400],
    IGAME_PAYLATER_ACT_H: [10, 10, 300],
  });
  const day2 = activityExport('2026-09-19 11:00:00', {
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

  it('ranks activities by transactions on the latest day', () => {
    const rows = activityTrends(withHistory({ activityHistory: [...day1, ...day2] }));
    expect(rows[0]!.metric.id).toBe('IGAME_DAILY_LOGIN');
    expect(rows[0]!.latest?.value).toBe(800);
    expect(rows.find((r) => r.metric.id === 'IGAME_PAYLATER_ACT_H')?.stamps).toBe(60);
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

describe('claims per box, per day', () => {
  it('puts the Welcome Box\'s 814 launch-day claims in a partial-day column', () => {
    const table = claimsByBoxTable(ds);
    expect(table.columns).toEqual([{ date: '2026-09-15', partial: true, spanDays: 1 }]);
    expect(table.rows[0]).toMatchObject({ name: 'Welcome Box', values: [814], total: 814 });
  });

  it('adds up to all box claims across the tiers', () => {
    const [day] = claimTierSeries(ds);
    expect(day!.tiers.reduce((a, b) => a + b, 0)).toBe(1_991);
    expect(day!.partial).toBe(true);
  });
});

describe('scorecard', () => {
  it('compares the last full day, never the day still running', () => {
    const [row] = scorecard(ds, [metric([['2026-09-20', 100], ['2026-09-21', 120], ['2026-09-22', 30, true]])]);
    expect(row!.latest?.date).toBe('2026-09-21');
    expect(row!.vsPrevious).toMatchObject({ delta: 20, pct: 0.2 });
    expect(row!.partial?.value).toBe(30);
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
      ...reachExport('2026-09-16 11:00:00', { 0: [0, 100] }),
      ...reachExport('2026-09-17 11:00:00', { 0: [0, 200] }),
      ...reachExport('2026-09-18 11:00:00', { 0: [0, 300] }),
      ...reachExport('2026-09-19 11:00:00', { 0: [0, 400] }),
      ...reachExport('2026-09-21 11:00:00', { 0: [0, 600] }),
    ];
    const rows = scorecard(withHistory({ reachHistory }));
    const newUsers = rows.find((r) => r.metric.id === 'newUsers')!;
    expect(newUsers.latest).toMatchObject({ date: '2026-09-21', value: 200 });
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

  it('covers every metric, with launch day as the claims figure still running', () => {
    const rows = scorecard(ds);
    expect(rows.map((r) => r.metric.id)).toEqual(trendMetrics(ds).map((m) => m.id));
    const claims = rows.find((r) => r.metric.id === 'boxClaims')!;
    expect(claims.partial?.value).toBe(1_991);
    expect(claims.latest).toBeNull();
    const gacha = rows.find((r) => r.metric.id === 'gachaClaims')!;
    expect(gacha.partial?.value).toBe(1_279);
  });
});

describe('daily trend CSV rows', () => {
  it('has one row per day in range, with every metric as a column', () => {
    const rows = dailyTrendRows(ds);
    expect(rows.map((r) => r.date)).toEqual(['2026-09-15']);
    expect(rows[0]!.values.boxClaims).toBe(1_991);
    expect(rows[0]!.values.gachaUsers).toBe(812);
    expect(rows[0]!.values.newUsers).toBeNull();
    expect(rows[0]!.partial).toBe(true);
  });
});
