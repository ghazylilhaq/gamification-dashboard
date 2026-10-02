import { LAUNCH_DATE } from '@/config/fileTypes';
import { QUEST_NAMES, questName } from '@/config/quests';
import {
  BASELINE_DAYS, BOX_TIERS, DAILY_LOGIN_ACTIVITY_ID, MIN_BASELINE_DAYS, TABLE_DAYS,
  UNUSUAL_CHANGE, UNUSUAL_MIN_BASELINE,
} from '@/config/trends';
import { exportDateOf } from '@/lib/csv/detect';
import { daysBetween, hoursBetween } from '@/lib/time';
import type { ActivitySnapshot, ReachHistoryRow, SpendHistoryRow } from '@/lib/types';
import { buildDataset, groupBy, sum, type DataFilter, type Dataset } from './dataset';
import { dailyClaimSeries } from './claims';
import { gachaSeries } from './gacha';
import { dailySpendSeries } from './spend';
import { BOX_COUNT, atLeast, countsOf } from './reach';
import type { Delta } from './overview';

/**
 * Daily trends: one figure per day for everything worth watching daily.
 *
 * Two kinds of source feed this, and they behave differently:
 *
 *   - **Daily files** (claims, gacha, daily spend) are full-history exports
 *     with a row per calendar day. A day's figure is read straight off them.
 *     The export's own day is still running, so it is marked partial.
 *
 *   - **Snapshot files** (reach, activity, total spend) are cumulative
 *     totals-to-date. A day's figure is the difference between that day's
 *     export and the previous day's — e.g. new users with a stamp = users with
 *     a stamp today − users with a stamp yesterday. Only the last export of
 *     each WIB day is used. The difference covers export-to-export, not
 *     midnight-to-midnight, so every value carries its window; a window
 *     spanning more than one day (a missed export) is kept but never used as
 *     a baseline or flagged as unusual.
 *
 * Snapshot differences are exact for anything that only grows: a user cannot
 * lose a stamp, so "reached box N or beyond" never falls. Exclusive reach
 * buckets do not have that property — users leave a bucket as they climb — so
 * the per-box increase is always measured on "reached or beyond".
 */

// ------------------------------------------------------------------ windows

export interface SnapshotDay<T> {
  /** WIB day, 'YYYY-MM-DD'. */
  date: string;
  /** The export used for that day: its last one. */
  at: string;
  rows: T[];
}

/** The last export of each WIB day, oldest first. Pre-launch days are test data. */
export function snapshotDays<T extends { snapshot_at: string }>(
  rows: T[],
  showTestData: boolean,
): SnapshotDay<T>[] {
  const byAt = groupBy(rows, (r) => r.snapshot_at);
  const latest = new Map<string, string>();
  for (const at of byAt.keys()) {
    const date = at.slice(0, 10);
    if (!showTestData && date < LAUNCH_DATE) continue;
    const current = latest.get(date);
    if (current === undefined || at > current) latest.set(date, at);
  }
  return [...latest.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, at]) => ({ date, at, rows: byAt.get(at) ?? [] }));
}

export interface SnapshotWindow {
  /** WIB day of the later export — the day this movement is reported on. */
  date: string;
  at: string;
  /** The earlier export it is compared with. */
  prevAt: string;
  hours: number;
  /** Calendar days between the two exports. More than 1 means a day was missed. */
  spanDays: number;
}

function windowsOf<T, M>(days: SnapshotDay<T>[], measure: (rows: T[]) => M) {
  const measured = days.map((day) => ({ day, value: measure(day.rows) }));
  return measured.slice(1).map((cur, i) => {
    const prev = measured[i]!;
    const window: SnapshotWindow = {
      date: cur.day.date,
      at: cur.day.at,
      prevAt: prev.day.at,
      hours: hoursBetween(prev.day.at, cur.day.at),
      spanDays: daysBetween(prev.day.date, cur.day.date),
    };
    return { window, current: cur.value, previous: prev.value };
  });
}

/** Whether a date falls inside the range picker's bounds. */
export function inRange(date: string, filter: DataFilter): boolean {
  if (filter.from && date < filter.from) return false;
  if (filter.to && date > filter.to) return false;
  return true;
}

/**
 * The same data without the date range. Baselines and "previous day" need the
 * days before the range starts, so they are computed on this and the range is
 * applied afterwards.
 */
function unbounded(ds: Dataset): Dataset {
  return ds.filter.from || ds.filter.to
    ? buildDataset(ds.raw, { ...ds.filter, from: null, to: null })
    : ds;
}

// -------------------------------------------------------------------- reach

/** Which users: everyone, those who opened the blindbox page (Y), or not (N). */
export type ReachSegment = 'all' | 'Y' | 'N';

export interface ReachMeasure {
  activeUsers: number;
  onboardY: number;
  /** At least the Welcome Box's stamps. */
  eligible: number;
  /** Eligible but never opened the page. */
  untapped: number;
  /** Users who reached box N or beyond. Index 0 is box 1. */
  reached: Record<ReachSegment, number[]>;
  /** Users whose highest box falls in each tier. Aligned with BOX_TIERS. */
  tiers: Record<ReachSegment, number[]>;
  /** Users still under 10 stamps. */
  belowFirst: Record<ReachSegment, number>;
}

function measureReach(rows: ReachHistoryRow[]): ReachMeasure {
  const { y, n } = countsOf(rows);
  const both = new Map<number, number>();
  for (const counts of [y, n]) {
    for (const [bucket, users] of counts) both.set(bucket, (both.get(bucket) ?? 0) + users);
  }
  const per = <V,>(f: (counts: Map<number, number>) => V): Record<ReachSegment, V> =>
    ({ all: f(both), Y: f(y), N: f(n) });
  const boxes = Array.from({ length: BOX_COUNT }, (_, i) => i + 1);

  return {
    activeUsers: atLeast(both, 0),
    onboardY: atLeast(y, 0),
    eligible: atLeast(both, 1),
    untapped: atLeast(n, 1),
    reached: per((c) => boxes.map((box) => atLeast(c, box))),
    tiers: per((c) => BOX_TIERS.map((t) => atLeast(c, t.from) - atLeast(c, t.to + 1))),
    belowFirst: per((c) => c.get(0) ?? 0),
  };
}

export interface ReachDay {
  date: string;
  at: string;
  measure: ReachMeasure;
}

/** Where users stood at the end of each day — levels, not changes. */
export function reachDays(ds: Dataset): ReachDay[] {
  return snapshotDays(ds.raw.reachHistory ?? [], ds.filter.showTestData)
    .map((d) => ({ date: d.date, at: d.at, measure: measureReach(d.rows) }));
}

export interface ReachChange extends SnapshotWindow {
  newUsers: number;
  newOnboard: number;
  newEligible: number;
  /** Change in eligible-but-never-opened. Falls as those users discover the page. */
  untappedChange: number;
  /** New users reaching box N or beyond, per segment. Index 0 is box 1. */
  reached: Record<ReachSegment, number[]>;
}

export function reachChanges(ds: Dataset): ReachChange[] {
  const days = snapshotDays(ds.raw.reachHistory ?? [], ds.filter.showTestData);
  return windowsOf(days, measureReach).map(({ window, current, previous }) => {
    const diff = (seg: ReachSegment) =>
      current.reached[seg].map((v, i) => v - (previous.reached[seg][i] ?? 0));
    return {
      ...window,
      newUsers: current.activeUsers - previous.activeUsers,
      newOnboard: current.onboardY - previous.onboardY,
      newEligible: current.eligible - previous.eligible,
      untappedChange: current.untapped - previous.untapped,
      reached: { all: diff('all'), Y: diff('Y'), N: diff('N') },
    };
  });
}

// ----------------------------------------------------------------- activity

export interface QuestSeries {
  /** Stable chart key, by quest id, so a quest keeps its colour. */
  key: string;
  label: string;
}

const OTHER_QUEST: QuestSeries = { key: 'other', label: 'Other' };

function questKey(questId: number | null | undefined): string {
  return questId !== null && questId !== undefined && questId in QUEST_NAMES && questId <= 5
    ? `q${questId}`
    : OTHER_QUEST.key;
}

/** Quests in id order, then "Other" for any activity without a known quest. */
export function questSeries(ds: Dataset): QuestSeries[] {
  const known = Object.keys(QUEST_NAMES).map(Number).filter((id) => id <= 5).sort((a, b) => a - b)
    .map((id) => ({ key: `q${id}`, label: QUEST_NAMES[id]! }));
  const questOf = new Map(ds.raw.activities.map((a) => [a.id, a.quest_id]));
  const hasOther = (ds.raw.activityHistory ?? []).some((r) => questKey(questOf.get(r.ref_id)) === 'other');
  return hasOther ? [...known, OTHER_QUEST] : known;
}

export interface ActivityDelta {
  customers: number;
  transactions: number;
  stamps: number;
}

export interface ActivityChange extends SnapshotWindow {
  stamps: number;
  /** Every activity except Daily Login, which would swamp the rest. */
  transactions: number;
  /** Users who logged in, ≈ daily active users. Null if login is missing from either export. */
  dailyLogins: number | null;
  /** Stamps per quest, keyed as questSeries. */
  stampsByQuest: Record<string, number>;
  byActivity: Map<string, ActivityDelta>;
}

export function activityChanges(ds: Dataset): ActivityChange[] {
  const questOf = new Map(ds.raw.activities.map((a) => [a.id, a.quest_id]));
  const days = snapshotDays(ds.raw.activityHistory ?? [], ds.filter.showTestData);
  const index = (rows: ActivitySnapshot[]) => new Map(rows.map((r) => [r.ref_id, r]));

  return windowsOf(days, index).map(({ window, current, previous }) => {
    const byActivity = new Map<string, ActivityDelta>();
    const stampsByQuest: Record<string, number> = {};
    // An activity new in this export counts from zero; one that vanished is
    // left out rather than read as a negative day.
    for (const [id, row] of current) {
      const before = previous.get(id);
      const delta = {
        customers: row.customers - (before?.customers ?? 0),
        transactions: row.transactions - (before?.transactions ?? 0),
        stamps: row.stamps_distributed - (before?.stamps_distributed ?? 0),
      };
      byActivity.set(id, delta);
      const key = questKey(questOf.get(id));
      stampsByQuest[key] = (stampsByQuest[key] ?? 0) + delta.stamps;
    }
    const all = [...byActivity.entries()];
    const login = current.has(DAILY_LOGIN_ACTIVITY_ID) && previous.has(DAILY_LOGIN_ACTIVITY_ID)
      ? byActivity.get(DAILY_LOGIN_ACTIVITY_ID)!.transactions
      : null;
    return {
      ...window,
      stamps: sum(all, ([, d]) => d.stamps),
      transactions: sum(all.filter(([id]) => id !== DAILY_LOGIN_ACTIVITY_ID), ([, d]) => d.transactions),
      dailyLogins: login,
      stampsByQuest,
      byActivity,
    };
  });
}

// -------------------------------------------------------------------- spend

export interface SpendChange extends SnapshotWindow {
  couponsRedeemed: number;
  couponSpend: number;
}

/**
 * Coupon redemptions per day, from the cumulative spend export.
 *
 * The daily spend export has never populated coupons (spec §2.4), but the
 * cumulative one is right — so with one export a day, the day-over-day
 * difference recovers exactly what the daily file is missing.
 */
export function spendChanges(ds: Dataset): SpendChange[] {
  const days = snapshotDays(ds.raw.spendHistory ?? [], ds.filter.showTestData);
  const totals = (rows: SpendHistoryRow[]) => {
    const coupons = rows.filter((r) => r.type === 'COUPON');
    return {
      couponsRedeemed: sum(coupons, (r) => r.redeemed),
      couponSpend: sum(coupons, (r) => r.spend),
    };
  };
  return windowsOf(days, totals).map(({ window, current, previous }) => ({
    ...window,
    couponsRedeemed: current.couponsRedeemed - previous.couponsRedeemed,
    couponSpend: current.couponSpend - previous.couponSpend,
  }));
}

// ------------------------------------------------------------------ metrics

export type TrendGroup = 'Users' | 'Activity' | 'Claims' | 'Cost';
export type TrendSource = 'reach' | 'activity' | 'claims' | 'gacha' | 'spend';

export interface TrendPoint {
  date: string;
  value: number;
  /** The export's own day, still running. Daily files only. */
  partial: boolean;
  /** For snapshot metrics, the export-to-export window the value covers. */
  window: SnapshotWindow | null;
}

export interface TrendMetricDef {
  id: string;
  label: string;
  group: TrendGroup;
  format: 'count' | 'rupiah';
  source: TrendSource;
  /** What exactly is counted. */
  hint: string;
  /** Column header in the CSV download. */
  csv: string;
}

export interface TrendMetric extends TrendMetricDef {
  points: TrendPoint[];
}

/** Everything on the daily scorecard, in reading order. */
export const TREND_METRICS: TrendMetricDef[] = [
  { id: 'newUsers', label: 'New users with a stamp', group: 'Users', format: 'count', source: 'reach', hint: 'Earned their first stamp', csv: 'new_users_with_stamp' },
  { id: 'newOnboard', label: 'Newly onboarded', group: 'Users', format: 'count', source: 'reach', hint: 'Opened the blindbox page for the first time', csv: 'newly_onboarded' },
  { id: 'newEligible', label: 'Newly eligible', group: 'Users', format: 'count', source: 'reach', hint: 'Reached 10 stamps, enough for the Welcome Box', csv: 'newly_eligible' },
  { id: 'dailyLogins', label: 'Daily logins', group: 'Activity', format: 'count', source: 'activity', hint: '≈ daily active users — the login stamp is once per user per day', csv: 'daily_logins' },
  { id: 'transactions', label: 'Stamp transactions', group: 'Activity', format: 'count', source: 'activity', hint: 'Every activity except Daily Login', csv: 'transactions_excl_login' },
  { id: 'stamps', label: 'Stamps issued', group: 'Activity', format: 'count', source: 'activity', hint: 'All activities, Daily Login included', csv: 'stamps_issued' },
  { id: 'boxClaims', label: 'Box claims', group: 'Claims', format: 'count', source: 'claims', hint: 'All 12 boxes', csv: 'box_claims' },
  { id: 'gachaClaims', label: 'Gacha claims', group: 'Claims', format: 'count', source: 'gacha', hint: 'Spins that paid out', csv: 'gacha_claims' },
  { id: 'gachaUsers', label: 'Gacha users', group: 'Claims', format: 'count', source: 'gacha', hint: 'Users who spun that day — not addable across days', csv: 'gacha_users_that_day' },
  { id: 'boxCashback', label: 'Box cashback', group: 'Cost', format: 'rupiah', source: 'claims', hint: 'Claims × payout, exact for cashback', csv: 'box_cashback (IDR)' },
  { id: 'couponsRedeemed', label: 'Coupons redeemed', group: 'Cost', format: 'count', source: 'spend', hint: 'From the day-over-day change in total spend', csv: 'coupons_redeemed' },
  { id: 'couponSpend', label: 'Coupon spend', group: 'Cost', format: 'rupiah', source: 'spend', hint: 'Face value of the coupons redeemed', csv: 'coupon_spend (IDR)' },
  { id: 'gachaCashback', label: 'Gacha cashback', group: 'Cost', format: 'rupiah', source: 'gacha', hint: 'Paid out by gacha spins', csv: 'gacha_cashback (IDR)' },
];

/** Every metric with all its points since launch. The date range is not applied here. */
export function trendMetrics(ds: Dataset): TrendMetric[] {
  const all = unbounded(ds);
  const claimsDay = exportDateOf(ds.raw.freshness.daily_rewards);
  const gachaDay = exportDateOf(ds.raw.freshness.daily_gacha);

  const fromWindows = <W extends SnapshotWindow>(rows: W[], pick: (w: W) => number | null): TrendPoint[] =>
    rows.flatMap((w) => {
      const value = pick(w);
      return value === null ? [] : [{ date: w.date, value, partial: false, window: w }];
    });
  const fromDays = <P extends { date: string }>(rows: P[], pick: (p: P) => number, partialDay: string | null) =>
    rows.map((p) => ({ date: p.date, value: pick(p), partial: p.date === partialDay, window: null }));

  const reach = reachChanges(ds);
  const activity = activityChanges(ds);
  const spend = spendChanges(ds);
  const claims = dailyClaimSeries(all);
  const gacha = gachaSeries(all);
  const cost = dailySpendSeries(all);

  const points: Record<string, TrendPoint[]> = {
    newUsers: fromWindows(reach, (w) => w.newUsers),
    newOnboard: fromWindows(reach, (w) => w.newOnboard),
    newEligible: fromWindows(reach, (w) => w.newEligible),
    dailyLogins: fromWindows(activity, (w) => w.dailyLogins),
    transactions: fromWindows(activity, (w) => w.transactions),
    stamps: fromWindows(activity, (w) => w.stamps),
    boxClaims: fromDays(claims, (p) => p.boxClaims, claimsDay),
    gachaClaims: fromDays(gacha, (p) => p.claims, gachaDay),
    gachaUsers: fromDays(gacha, (p) => p.users, gachaDay),
    boxCashback: fromDays(cost, (p) => p.cashback, claimsDay),
    couponsRedeemed: fromWindows(spend, (w) => w.couponsRedeemed),
    couponSpend: fromWindows(spend, (w) => w.couponSpend),
    gachaCashback: fromDays(gacha, (p) => p.cashback, gachaDay),
  };

  return TREND_METRICS.map((def) => ({ ...def, points: points[def.id] ?? [] }));
}

// ---------------------------------------------------------------- scorecard

export interface ScorecardRow {
  metric: TrendMetric;
  /** The last finished day on or before the range's end. */
  latest: TrendPoint | null;
  previous: TrendPoint | null;
  /** A later day still in progress — shown as "today so far", never compared. */
  partial: TrendPoint | null;
  vsPrevious: Delta | null;
  /** Mean of up to BASELINE_DAYS finished single days before `latest`. */
  baseline: { value: number; days: number } | null;
  /** Latest against the baseline: 0.42 is 42% above. */
  vsBaseline: number | null;
  unusual: 'high' | 'low' | null;
  /** The last TABLE_DAYS finished days, for the sparkline. */
  spark: TrendPoint[];
}

const isSingleDay = (p: TrendPoint) => !p.window || p.window.spanDays === 1;

/**
 * Each metric's latest day against the day before and its recent average.
 *
 * "Latest" follows the range picker's end date, so moving it back reviews an
 * earlier day. The range's start does not apply: the comparisons need the
 * days before it.
 */
export function scorecard(ds: Dataset, metrics: TrendMetric[] = trendMetrics(ds)): ScorecardRow[] {
  const to = ds.filter.to ?? null;
  return metrics.map((metric) => {
    const visible = metric.points.filter((p) => !to || p.date <= to);
    const finished = visible.filter((p) => !p.partial);
    const latest = finished[finished.length - 1] ?? null;
    const previous = finished[finished.length - 2] ?? null;
    const last = visible[visible.length - 1] ?? null;
    const partial = last && last.partial && (!latest || last.date > latest.date) ? last : null;

    const before = finished.slice(0, -1).filter(isSingleDay).slice(-BASELINE_DAYS);
    const baseline = latest && before.length >= MIN_BASELINE_DAYS
      ? { value: sum(before, (p) => p.value) / before.length, days: before.length }
      : null;
    const vsBaseline = latest && baseline && baseline.value > 0 ? latest.value / baseline.value - 1 : null;
    const unusual =
      latest && baseline && vsBaseline !== null && isSingleDay(latest) &&
      baseline.value >= UNUSUAL_MIN_BASELINE && Math.abs(vsBaseline) >= UNUSUAL_CHANGE
        ? (vsBaseline > 0 ? 'high' : 'low')
        : null;

    return {
      metric,
      latest,
      previous,
      partial,
      vsPrevious: latest && previous
        ? {
            current: latest.value,
            previous: previous.value,
            delta: latest.value - previous.value,
            pct: previous.value !== 0 ? (latest.value - previous.value) / previous.value : null,
          }
        : null,
      baseline,
      vsBaseline,
      unusual,
      spark: finished.slice(-TABLE_DAYS),
    };
  });
}

export interface DailyTrendRow {
  date: string;
  /** By metric id; null where the metric has no figure for the day. */
  values: Record<string, number | null>;
  /** Any daily-file figure on this row is a day still in progress. */
  partial: boolean;
}

/** One row per day in the range, every metric a column — the CSV download. */
export function dailyTrendRows(ds: Dataset, metrics: TrendMetric[] = trendMetrics(ds)): DailyTrendRow[] {
  const dates = [...new Set(metrics.flatMap((m) => m.points.map((p) => p.date)))]
    .filter((d) => inRange(d, ds.filter))
    .sort();
  const lookup = metrics.map((m) => ({ id: m.id, byDate: new Map(m.points.map((p) => [p.date, p])) }));
  return dates.map((date) => {
    const values: Record<string, number | null> = {};
    let partial = false;
    for (const { id, byDate } of lookup) {
      const point = byDate.get(date);
      values[id] = point?.value ?? null;
      partial ||= point?.partial ?? false;
    }
    return { date, values, partial };
  });
}

export interface ActivityTrendRow extends ScorecardRow {
  quest: string;
  questKey: string;
  /** Stamps issued by the activity on the latest day. */
  stamps: number | null;
}

/**
 * The scorecard, per activity: transactions each day, against the day before
 * and the recent average. Busiest first on the latest day.
 */
export function activityTrends(ds: Dataset): ActivityTrendRow[] {
  const changes = activityChanges(ds);
  const meta = new Map(ds.raw.activities.map((a) => [a.id, a]));
  const ids = [...new Set(changes.flatMap((c) => [...c.byActivity.keys()]))];

  const metrics: TrendMetric[] = ids.map((id) => ({
    id,
    label: meta.get(id)?.name_en ?? id,
    group: 'Activity',
    format: 'count',
    source: 'activity',
    hint: questName(meta.get(id)?.quest_id),
    csv: id,
    points: changes.flatMap((c) => {
      const delta = c.byActivity.get(id);
      if (!delta) return [];
      const { date, at, prevAt, hours, spanDays } = c;
      return [{ date, value: delta.transactions, partial: false, window: { date, at, prevAt, hours, spanDays } }];
    }),
  }));

  const byDate = new Map(changes.map((c) => [c.date, c]));
  return scorecard(ds, metrics)
    .map((row) => ({
      ...row,
      quest: row.metric.hint,
      questKey: questKey(meta.get(row.metric.id)?.quest_id),
      stamps: row.latest ? (byDate.get(row.latest.date)?.byActivity.get(row.metric.id)?.stamps ?? null) : null,
    }))
    .sort((a, b) => (b.latest?.value ?? -1) - (a.latest?.value ?? -1) || a.metric.label.localeCompare(b.metric.label));
}

// ------------------------------------------------------------------ tiers

export interface TierDef {
  /** Box positions in stamp order, inclusive. */
  from: number;
  to: number;
  label: string;
  /** Stamp range, e.g. '10–34 stamps'. Empty when stamp data is missing. */
  stamps: string;
}

export function tierDefs(ds: Dataset): TierDef[] {
  const stampOf = (box: number) => {
    const value = ds.boxesByStamp[box - 1]?.stamp_required;
    return value !== undefined && value < Number.MAX_SAFE_INTEGER ? value : null;
  };
  return BOX_TIERS.map((t) => {
    const low = stampOf(t.from);
    const next = t.to < BOX_COUNT ? stampOf(t.to + 1) : null;
    const stamps = low === null
      ? ''
      : t.to >= BOX_COUNT ? `${low}+ stamps` : next !== null ? `${low}–${next - 1} stamps` : `${low}+ stamps`;
    return {
      from: t.from,
      to: t.to,
      label: t.from === t.to ? `Box ${t.from}` : `Box ${t.from}–${t.to}`,
      stamps,
    };
  });
}

/** Users per tier at the end of each day in the range. */
export function reachTierSeries(ds: Dataset, segment: ReachSegment) {
  return reachDays(ds)
    .filter((d) => inRange(d.date, ds.filter))
    .map((d) => ({
      date: d.date,
      at: d.at,
      tiers: d.measure.tiers[segment],
      belowFirst: d.measure.belowFirst[segment],
    }));
}

/** Box claims per day in the range, summed per tier. */
export function claimTierSeries(ds: Dataset) {
  const partialDay = exportDateOf(ds.raw.freshness.daily_rewards);
  const positionOf = new Map(ds.boxesByStamp.map((b, i) => [b.id, i + 1]));
  const byDate = groupBy(ds.dailyRewards, (r) => r.claim_date);
  return [...byDate.keys()].sort().map((date) => {
    const rows = byDate.get(date) ?? [];
    return {
      date,
      partial: date === partialDay,
      tiers: BOX_TIERS.map((t) => sum(
        rows.filter((r) => {
          const pos = positionOf.get(r.blind_box_id2);
          return pos !== undefined && pos >= t.from && pos <= t.to;
        }),
        (r) => r.total_claim,
      )),
    };
  });
}

/** Stamps issued per quest, per day in the range. */
export function stampsByQuestSeries(ds: Dataset) {
  const quests = questSeries(ds);
  return activityChanges(ds)
    .filter((w) => inRange(w.date, ds.filter))
    .map((w) => ({ window: w, values: quests.map((q) => w.stampsByQuest[q.key] ?? 0) }));
}

// ------------------------------------------------------------- per-box tables

export interface BoxDayColumn {
  date: string;
  partial: boolean;
  /** For snapshot tables: days the window spans. Always 1 for daily files. */
  spanDays: number;
}

export interface BoxDayRow {
  /** Position in stamp order, 1–12. */
  box: number;
  name: string;
  stampRequired: number | null;
  values: number[];
  /** The running total the daily values add up to. */
  total: number;
}

export interface BoxDayTable {
  columns: BoxDayColumn[];
  rows: BoxDayRow[];
}

function boxMeta(ds: Dataset, box: number) {
  const meta = ds.boxesByStamp[box - 1];
  const stamp = meta?.stamp_required;
  return {
    name: meta?.name_en ?? `Box ${box}`,
    stampRequired: stamp !== undefined && stamp < Number.MAX_SAFE_INTEGER ? stamp : null,
  };
}

/**
 * New users reaching each box (or beyond), per day — the per-box increase.
 * Total is everyone who has reached it as of the last day shown.
 */
export function reachByBoxTable(ds: Dataset, segment: ReachSegment): BoxDayTable {
  const changes = reachChanges(ds).filter((c) => inRange(c.date, ds.filter)).slice(-TABLE_DAYS);
  const levels = reachDays(ds).filter((d) => !ds.filter.to || d.date <= ds.filter.to);
  const latest = levels[levels.length - 1]?.measure.reached[segment] ?? [];
  return {
    columns: changes.map((c) => ({ date: c.date, partial: false, spanDays: c.spanDays })),
    rows: Array.from({ length: BOX_COUNT }, (_, i) => ({
      box: i + 1,
      ...boxMeta(ds, i + 1),
      values: changes.map((c) => c.reached[segment][i] ?? 0),
      total: latest[i] ?? 0,
    })),
  };
}

/** Box claims per box per day. Total is claims since launch, to the range's end. */
export function claimsByBoxTable(ds: Dataset): BoxDayTable {
  const partialDay = exportDateOf(ds.raw.freshness.daily_rewards);
  const dates = [...new Set(ds.dailyRewards.map((r) => r.claim_date))].sort().slice(-TABLE_DAYS);
  const claims = new Map<string, number>();
  for (const r of ds.dailyRewards) {
    const key = `${r.blind_box_id2}|${r.claim_date}`;
    claims.set(key, (claims.get(key) ?? 0) + r.total_claim);
  }
  const toDate = ds.filter.to;
  const totals = new Map<number, number>();
  for (const r of ds.sinceLaunch.dailyRewards) {
    if (toDate && r.claim_date > toDate) continue;
    totals.set(r.blind_box_id2, (totals.get(r.blind_box_id2) ?? 0) + r.total_claim);
  }
  return {
    columns: dates.map((date) => ({ date, partial: date === partialDay, spanDays: 1 })),
    rows: ds.boxesByStamp.map((box, i) => ({
      box: i + 1,
      ...boxMeta(ds, i + 1),
      values: dates.map((d) => claims.get(`${box.id}|${d}`) ?? 0),
      total: totals.get(box.id) ?? 0,
    })),
  };
}

// ------------------------------------------------------------------ caveats

/** Days of history stored per snapshot source — a daily figure needs two. */
export function historyDepth(ds: Dataset) {
  const days = (rows: Array<{ snapshot_at: string }>) =>
    snapshotDays(rows, ds.filter.showTestData).length;
  return {
    reach: days(ds.raw.reachHistory ?? []),
    activity: days(ds.raw.activityHistory ?? []),
    spend: days(ds.raw.spendHistory ?? []),
  };
}

/**
 * Snapshot windows that are not one day of roughly 24 hours: a missed day, or
 * exports taken at very different times. Their figures are real but cover more
 * or less than a day.
 */
export function irregularWindows(windows: SnapshotWindow[], toleranceHours = 4): SnapshotWindow[] {
  return windows.filter((w) => w.spanDays !== 1 || Math.abs(w.hours - 24) > toleranceHours);
}
