import { LAUNCH_DATE } from '@/config/fileTypes';
import { QUEST_NAMES, questName } from '@/config/quests';
import {
  BASELINE_DAYS, BOX_TIERS, DAILY_LOGIN_ACTIVITY_ID, MIN_BASELINE_DAYS, SPARK_DAYS,
  UNUSUAL_CHANGE, UNUSUAL_MIN_BASELINE,
} from '@/config/trends';
import { exportDateOf } from '@/lib/csv/detect';
import { addDays, addHours, dateRange, daysBetween, hoursBetween } from '@/lib/time';
import type { ActivitySnapshot, ReachHistoryRow, SpendHistoryRow } from '@/lib/types';
import { buildDataset, groupBy, sum, type DataFilter, type Dataset } from './dataset';
import { dailyClaimSeries } from './claims';
import { gachaSeries } from './gacha';
import { dailySpendSeries } from './spend';
import { BOX_COUNT, atLeast, countsOf } from './reach';
import type { Delta } from './overview';

/**
 * Daily trends: one figure per **full day** for everything worth watching
 * daily. The latest day is the last complete one (H-1); a day still in
 * progress is never shown.
 *
 * Two kinds of source feed this, and they behave differently:
 *
 *   - **Daily files** (claims, gacha, daily spend) are full-history exports
 *     with a row per calendar day. A day's figure is read straight off them.
 *     The export's own day is still running when the file is pulled, so it is
 *     dropped.
 *
 *   - **Snapshot files** (reach, activity, total spend) are cumulative
 *     totals-to-date. Each export is read as the closing figure of the day
 *     whose midnight is nearest to it — an export at 00:30 on 2 Oct closes
 *     1 Oct — and a day's figure is its closing total minus the day before's.
 *     Exported just after midnight, that is exactly one calendar day. Exported
 *     at, say, 11:04, a day runs 11:04 to 11:04, which every value records in
 *     its window so the page can say so. A window spanning more than one day
 *     (a missed export) is kept but never used as a baseline or flagged.
 *
 * Snapshot differences are exact for anything that only grows: a user cannot
 * lose a stamp, so "reached box N or beyond" never falls. Exclusive reach
 * buckets do not have that property — users leave a bucket as they climb — so
 * the per-box increase is always measured on "reached or beyond".
 */

// ------------------------------------------------------------------ windows

/**
 * The day an export closes: the one ending at the midnight nearest to it.
 * 00:30 on 2 Oct and 11:04 on 2 Oct both close 1 Oct; 15:10 on 2 Oct closes
 * 2 Oct.
 */
export function closingDay(at: string): string {
  return addHours(at, -12).slice(0, 10);
}

/** Hours from the midnight an export closes: + after it, − before it. */
export function hoursFromMidnight(at: string): number {
  return hoursBetween(`${addDays(closingDay(at), 1)} 00:00:00`, at);
}

export interface SnapshotDay<T> {
  /** The day this export closes, 'YYYY-MM-DD'. */
  date: string;
  /** The export used for that day: the one nearest its closing midnight. */
  at: string;
  rows: T[];
}

/**
 * One export per day it closes, oldest first. When several exports close the
 * same day, the one nearest that midnight wins — it is the truest end-of-day
 * figure. /api/bootstrap applies the same rule, so this is a no-op on its data.
 */
export function snapshotDays<T extends { snapshot_at: string }>(rows: T[]): SnapshotDay<T>[] {
  const byAt = groupBy(rows, (r) => r.snapshot_at);
  const best = new Map<string, string>();
  for (const at of byAt.keys()) {
    const day = closingDay(at);
    const current = best.get(day);
    const closer = current === undefined ||
      Math.abs(hoursFromMidnight(at)) < Math.abs(hoursFromMidnight(current)) ||
      (Math.abs(hoursFromMidnight(at)) === Math.abs(hoursFromMidnight(current)) && at > current);
    if (closer) best.set(day, at);
  }
  return [...best.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, at]) => ({ date, at, rows: byAt.get(at) ?? [] }));
}

export interface SnapshotWindow {
  /** The day this movement belongs to: the day the later export closes. */
  date: string;
  at: string;
  /** The earlier export it is compared with. */
  prevAt: string;
  hours: number;
  /** Days between the two closing days. More than 1 means a day was missed. */
  spanDays: number;
}

/**
 * Day-over-day windows between consecutive closing days. A pre-launch export
 * may serve as the baseline for launch day, but windows dated before launch
 * are test data and are dropped unless asked for.
 */
function windowsOf<T, M>(days: SnapshotDay<T>[], measure: (rows: T[]) => M, showTestData: boolean) {
  const measured = days.map((day) => ({ day, value: measure(day.rows) }));
  return measured.slice(1).flatMap((cur, i) => {
    if (!showTestData && cur.day.date < LAUNCH_DATE) return [];
    const prev = measured[i]!;
    const window: SnapshotWindow = {
      date: cur.day.date,
      at: cur.day.at,
      prevAt: prev.day.at,
      hours: hoursBetween(prev.day.at, cur.day.at),
      spanDays: daysBetween(prev.day.date, cur.day.date),
    };
    return [{ window, current: cur.value, previous: prev.value }];
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

/** The day a daily file was pulled on: still running then, so never shown. */
function inProgressDay(exportAt: string | null): string | null {
  return exportDateOf(exportAt);
}

// -------------------------------------------------------------------- reach

/** Which users: everyone, those who opened the blindbox page (Y), or not (N). */
export type ReachSegment = 'all' | 'Y' | 'N';

interface ReachMeasure {
  activeUsers: number;
  onboardY: number;
  /** At least the Welcome Box's stamps. */
  eligible: number;
  /** Users who reached box N or beyond, per segment. Index 0 is box 1. */
  reached: Record<ReachSegment, number[]>;
}

function measureReach(rows: ReachHistoryRow[]): ReachMeasure {
  const { y, n } = countsOf(rows);
  const both = new Map<number, number>();
  for (const counts of [y, n]) {
    for (const [bucket, users] of counts) both.set(bucket, (both.get(bucket) ?? 0) + users);
  }
  const boxes = Array.from({ length: BOX_COUNT }, (_, i) => i + 1);
  const reached = (c: Map<number, number>) => boxes.map((box) => atLeast(c, box));
  return {
    activeUsers: atLeast(both, 0),
    onboardY: atLeast(y, 0),
    eligible: atLeast(both, 1),
    reached: { all: reached(both), Y: reached(y), N: reached(n) },
  };
}

export interface ReachChange extends SnapshotWindow {
  newUsers: number;
  newOnboard: number;
  newEligible: number;
  /** New users reaching box N or beyond, per segment. Index 0 is box 1. */
  reached: Record<ReachSegment, number[]>;
}

export function reachChanges(ds: Dataset): ReachChange[] {
  const days = snapshotDays(ds.raw.reachHistory ?? []);
  return windowsOf(days, measureReach, ds.filter.showTestData).map(({ window, current, previous }) => {
    const diff = (seg: ReachSegment) =>
      current.reached[seg].map((v, i) => v - (previous.reached[seg][i] ?? 0));
    return {
      ...window,
      newUsers: current.activeUsers - previous.activeUsers,
      newOnboard: current.onboardY - previous.onboardY,
      newEligible: current.eligible - previous.eligible,
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

export function questKey(questId: number | null | undefined): string {
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
  const days = snapshotDays(ds.raw.activityHistory ?? []);
  const index = (rows: ActivitySnapshot[]) => new Map(rows.map((r) => [r.ref_id, r]));

  return windowsOf(days, index, ds.filter.showTestData).map(({ window, current, previous }) => {
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
  const days = snapshotDays(ds.raw.spendHistory ?? []);
  const totals = (rows: SpendHistoryRow[]) => {
    const coupons = rows.filter((r) => r.type === 'COUPON');
    return {
      couponsRedeemed: sum(coupons, (r) => r.redeemed),
      couponSpend: sum(coupons, (r) => r.spend),
    };
  };
  return windowsOf(days, totals, ds.filter.showTestData).map(({ window, current, previous }) => ({
    ...window,
    couponsRedeemed: current.couponsRedeemed - previous.couponsRedeemed,
    couponSpend: current.couponSpend - previous.couponSpend,
  }));
}

// ------------------------------------------------------------------ metrics

export type TrendGroup = 'Users' | 'Activity' | 'Claims' | 'Cost';
export type TrendSource = 'reach' | 'activity' | 'claims' | 'gacha' | 'spend';

export interface TrendPoint {
  /** A full day. Days still in progress never become points. */
  date: string;
  value: number;
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

/**
 * Every metric with all its full days since launch. The date range is not
 * applied here, and the day each daily file was pulled on is left out.
 */
export function trendMetrics(ds: Dataset): TrendMetric[] {
  const all = unbounded(ds);
  const claimsDay = inProgressDay(ds.raw.freshness.daily_rewards);
  const gachaDay = inProgressDay(ds.raw.freshness.daily_gacha);

  const fromWindows = <W extends SnapshotWindow>(rows: W[], pick: (w: W) => number | null): TrendPoint[] =>
    rows.flatMap((w) => {
      const value = pick(w);
      return value === null ? [] : [{ date: w.date, value, window: w }];
    });
  const fromDays = <P extends { date: string }>(rows: P[], pick: (p: P) => number, skip: string | null) =>
    rows.filter((p) => p.date !== skip).map((p) => ({ date: p.date, value: pick(p), window: null }));

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
  /** The last full day on or before the range's end. */
  latest: TrendPoint | null;
  previous: TrendPoint | null;
  vsPrevious: Delta | null;
  /** Mean of up to BASELINE_DAYS single days before `latest`. */
  baseline: { value: number; days: number } | null;
  /** Latest against the baseline: 0.42 is 42% above. */
  vsBaseline: number | null;
  unusual: 'high' | 'low' | null;
  /** The last SPARK_DAYS days, for the sparkline. */
  spark: TrendPoint[];
}

const isSingleDay = (p: TrendPoint) => !p.window || p.window.spanDays === 1;

/**
 * Each metric's latest full day against the day before and its recent
 * average.
 *
 * "Latest" follows the range picker's end date, so moving it back reviews an
 * earlier day. The range's start does not apply: the comparisons need the
 * days before it.
 */
export function scorecard(ds: Dataset, metrics: TrendMetric[] = trendMetrics(ds)): ScorecardRow[] {
  const to = ds.filter.to ?? null;
  return metrics.map((metric) => {
    const visible = metric.points.filter((p) => !to || p.date <= to);
    const latest = visible[visible.length - 1] ?? null;
    const previous = visible[visible.length - 2] ?? null;

    const before = visible.slice(0, -1).filter(isSingleDay).slice(-BASELINE_DAYS);
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
      spark: visible.slice(-SPARK_DAYS),
    };
  });
}

export interface DailyTrendRow {
  date: string;
  /** By metric id; null where the metric has no figure for the day. */
  values: Record<string, number | null>;
}

/** One row per full day in the range, every metric a column — the CSV download. */
export function dailyTrendRows(ds: Dataset, metrics: TrendMetric[] = trendMetrics(ds)): DailyTrendRow[] {
  const dates = [...new Set(metrics.flatMap((m) => m.points.map((p) => p.date)))]
    .filter((d) => inRange(d, ds.filter))
    .sort();
  const lookup = metrics.map((m) => ({ id: m.id, byDate: new Map(m.points.map((p) => [p.date, p.value])) }));
  return dates.map((date) => ({
    date,
    values: Object.fromEntries(lookup.map(({ id, byDate }) => [id, byDate.get(date) ?? null])),
  }));
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

/** Full days of box claims in the range, oldest first, with every gap filled. */
function claimDates(ds: Dataset): string[] {
  const skip = inProgressDay(ds.raw.freshness.daily_rewards);
  const days = [...new Set(ds.dailyRewards.map((r) => r.claim_date))].filter((d) => d !== skip).sort();
  return days.length ? dateRange(days[0]!, days[days.length - 1]!) : [];
}

/** Box claims per full day in the range, summed per tier. */
export function claimTierSeries(ds: Dataset) {
  const positionOf = new Map(ds.boxesByStamp.map((b, i) => [b.id, i + 1]));
  const byDate = groupBy(ds.dailyRewards, (r) => r.claim_date);
  return claimDates(ds).map((date) => {
    const rows = byDate.get(date) ?? [];
    return {
      date,
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

// --------------------------------------------------------- per-day tables

export interface DayColumn {
  date: string;
  /** Snapshot tables: days the window spans. Always 1 for daily files. */
  spanDays: number;
  /** No export closes this day, so there is nothing to show for it. */
  missing: boolean;
}

export interface DayRow {
  key: string;
  label: string;
  /** A short qualifier beside the label: stamps required, or the quest. */
  detail: string | null;
  /** Null where the column is missing. */
  values: Array<number | null>;
  /** The running total to the last day shown. */
  total: number;
}

export interface DayTable {
  columns: DayColumn[];
  rows: DayRow[];
}

/**
 * Every date for a snapshot table: launch (or the range's start) to the last
 * full day anything has data for, so a day with no export shows as a gap
 * rather than vanishing.
 */
function snapshotColumns(ds: Dataset, windows: SnapshotWindow[]): DayColumn[] {
  const inView = windows.filter((w) => inRange(w.date, ds.filter));
  const claims = claimDates(ds);
  const ends = [inView[inView.length - 1]?.date, claims[claims.length - 1]].filter((d): d is string => Boolean(d)).sort();
  const end = ends[ends.length - 1];
  if (!end || inView.length === 0) return [];
  const first = inView[0]!.date;
  const start = ds.filter.from ?? (ds.filter.showTestData && first < LAUNCH_DATE ? first : LAUNCH_DATE);
  const byDate = new Map(inView.map((w) => [w.date, w]));
  return dateRange(start, end).map((date) => {
    const w = byDate.get(date);
    return { date, spanDays: w?.spanDays ?? 1, missing: !w };
  });
}

function boxMeta(ds: Dataset, box: number) {
  const meta = ds.boxesByStamp[box - 1];
  const stamp = meta?.stamp_required;
  return {
    label: meta?.name_en ?? `Box ${box}`,
    detail: stamp !== undefined && stamp < Number.MAX_SAFE_INTEGER ? String(stamp) : null,
  };
}

/** The last closing day on or before the range's end. */
function lastLevel<T extends { snapshot_at: string }>(ds: Dataset, rows: T[]): T[] {
  const days = snapshotDays(rows).filter((d) => !ds.filter.to || d.date <= ds.filter.to);
  return days[days.length - 1]?.rows ?? [];
}

/**
 * New users reaching each box (or beyond), per day — the per-box increase.
 * Total is everyone who has reached it as of the last day shown.
 */
export function reachByBoxTable(ds: Dataset, segment: ReachSegment): DayTable {
  const changes = reachChanges(ds);
  const columns = snapshotColumns(ds, changes);
  const byDate = new Map(changes.map((c) => [c.date, c]));
  const latest = measureReach(lastLevel(ds, ds.raw.reachHistory ?? [])).reached[segment];
  return {
    columns,
    rows: Array.from({ length: BOX_COUNT }, (_, i) => ({
      key: String(i + 1),
      ...boxMeta(ds, i + 1),
      values: columns.map((c) => byDate.get(c.date)?.reached[segment][i] ?? null),
      total: latest[i] ?? 0,
    })),
  };
}

/** Box claims per box per full day. Total is claims since launch, to the range's end. */
export function claimsByBoxTable(ds: Dataset): DayTable {
  const dates = claimDates(ds);
  const claims = new Map<string, number>();
  for (const r of ds.dailyRewards) {
    const key = `${r.blind_box_id2}|${r.claim_date}`;
    claims.set(key, (claims.get(key) ?? 0) + r.total_claim);
  }
  const last = dates[dates.length - 1];
  const totals = new Map<number, number>();
  for (const r of ds.sinceLaunch.dailyRewards) {
    if (!last || r.claim_date > last) continue;
    totals.set(r.blind_box_id2, (totals.get(r.blind_box_id2) ?? 0) + r.total_claim);
  }
  return {
    columns: dates.map((date) => ({ date, spanDays: 1, missing: false })),
    rows: ds.boxesByStamp.map((box, i) => ({
      key: String(i + 1),
      ...boxMeta(ds, i + 1),
      values: dates.map((d) => claims.get(`${box.id}|${d}`) ?? 0),
      total: totals.get(box.id) ?? 0,
    })),
  };
}

/**
 * Stamps issued per activity, per day, over every date — the activity-level
 * view of the stamps chart. Total is each activity's stamps to date. Busiest
 * first.
 */
export function stampsByActivityTable(ds: Dataset): DayTable & { questOf: Map<string, string> } {
  const changes = activityChanges(ds);
  const columns = snapshotColumns(ds, changes);
  const byDate = new Map(changes.map((c) => [c.date, c]));
  const meta = new Map(ds.raw.activities.map((a) => [a.id, a]));
  const level = new Map(lastLevel(ds, ds.raw.activityHistory ?? []).map((r) => [r.ref_id, r.stamps_distributed]));
  const ids = [...new Set([...level.keys(), ...changes.flatMap((c) => [...c.byActivity.keys()])])];
  const rows = ids
    .map((id) => ({
      key: id,
      label: meta.get(id)?.name_en ?? id,
      detail: questName(meta.get(id)?.quest_id),
      values: columns.map((c) => {
        const change = byDate.get(c.date);
        return change ? (change.byActivity.get(id)?.stamps ?? 0) : null;
      }),
      total: level.get(id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  return {
    columns,
    rows,
    questOf: new Map(ids.map((id) => [id, questKey(meta.get(id)?.quest_id)])),
  };
}

/** Stamps issued per quest on every date of the table above; null where no export closes the day. */
export function stampsByQuestSeries(ds: Dataset) {
  const quests = questSeries(ds);
  const changes = activityChanges(ds);
  const byDate = new Map(changes.map((c) => [c.date, c]));
  return snapshotColumns(ds, changes).map((col) => {
    const w = byDate.get(col.date);
    return { date: col.date, window: w ?? null, values: quests.map((q) => (w ? (w.stampsByQuest[q.key] ?? 0) : null)) };
  });
}

// ------------------------------------------------------------------ caveats

/** Days of history stored per snapshot source — a daily figure needs two. */
export function historyDepth(ds: Dataset) {
  const days = (rows: Array<{ snapshot_at: string }>) => snapshotDays(rows).length;
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
