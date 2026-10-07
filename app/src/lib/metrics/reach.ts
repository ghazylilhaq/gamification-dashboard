import type { Dataset } from './dataset';
import type { ReachSnapshot } from '@/lib/types';

/**
 * How far users are up the stamp ladder, from blindbox_reach.
 *
 * The export buckets users by the HIGHEST box their stamps reach, so the
 * buckets are exclusive — each user is in exactly one. That has two
 * consequences worth keeping straight:
 *
 *   - Summing the buckets gives a genuine unique count of users with any stamp.
 *     This is the first campaign-wide unique figure the exports provide.
 *   - "Reached at least box N" is the sum of buckets N and above, not the value
 *     of bucket N. The proof it is exclusive: onboarded users at box 12 (6)
 *     outnumber those at box 9 (2), which a cumulative count could never do.
 *
 * Both are cumulative snapshots, so they ignore the date range picker.
 */

export const BOX_COUNT = 12;

export interface ReachFunnelStep {
  /** 1..12, in stamp order. Box 1 is the Welcome Box. */
  box: number;
  /** Users whose highest box is exactly this one. */
  atY: number;
  atN: number;
  /** Users who have reached this box or beyond. */
  reachedY: number;
  reachedN: number;
  reached: number;
}

export interface ReachTotals {
  /** Unique users with any stamp at all. */
  activeUsers: number;
  /** Opened the blindbox page — the "User onboard" figure. */
  onboardY: number;
  onboardN: number;
  onboardRate: number | null;
  /** Have enough stamps for at least the Welcome Box. */
  eligibleY: number;
  eligibleN: number;
  /**
   * Eligible for at least one box but have never opened the page: rewards
   * earned and not yet discovered.
   */
  untappedEligible: number;
  asOf: string | null;
  /** Movement since the previous reach export, when there is one. */
  change: { activeUsers: number; onboardY: number; untappedEligible: number } | null;
}

function countsOf(rows: ReachSnapshot[]) {
  const y = new Map<number, number>();
  const n = new Map<number, number>();
  for (const row of rows) {
    const target = row.is_onboard === 'Y' ? y : n;
    target.set(row.box_bucket, (target.get(row.box_bucket) ?? 0) + row.users);
  }
  return { y, n };
}

function atLeast(counts: Map<number, number>, box: number): number {
  let total = 0;
  for (const [bucket, users] of counts) if (bucket >= box) total += users;
  return total;
}

function totalsOf(rows: ReachSnapshot[]) {
  const { y, n } = countsOf(rows);
  const onboardY = atLeast(y, 0);
  const onboardN = atLeast(n, 0);
  const eligibleY = atLeast(y, 1);
  const eligibleN = atLeast(n, 1);
  return {
    activeUsers: onboardY + onboardN,
    onboardY,
    onboardN,
    eligibleY,
    eligibleN,
    untappedEligible: eligibleN,
  };
}

export function reachTotals(ds: Dataset): ReachTotals {
  const latest = ds.raw.reachSnapshot;
  const previous = ds.raw.prevReachSnapshot;
  const now = totalsOf(latest);
  const before = previous.length > 0 ? totalsOf(previous) : null;

  return {
    ...now,
    onboardRate: now.activeUsers > 0 ? now.onboardY / now.activeUsers : null,
    asOf: ds.raw.freshness.reach_snapshot,
    change: before
      ? {
          activeUsers: now.activeUsers - before.activeUsers,
          onboardY: now.onboardY - before.onboardY,
          untappedEligible: now.untappedEligible - before.untappedEligible,
        }
      : null,
  };
}

export function hasReachData(ds: Dataset): boolean {
  return ds.raw.reachSnapshot.length > 0;
}

/** Per box: how many users sit there, and how many have got at least that far. */
export function reachFunnel(ds: Dataset): ReachFunnelStep[] {
  const { y, n } = countsOf(ds.raw.reachSnapshot);
  return Array.from({ length: BOX_COUNT }, (_, i) => {
    const box = i + 1;
    const reachedY = atLeast(y, box);
    const reachedN = atLeast(n, box);
    return {
      box,
      atY: y.get(box) ?? 0,
      atN: n.get(box) ?? 0,
      reachedY,
      reachedN,
      reached: reachedY + reachedN,
    };
  });
}

/** Users still under 10 stamps, per onboard flag. */
export function belowFirstBox(ds: Dataset): { y: number; n: number } {
  const { y, n } = countsOf(ds.raw.reachSnapshot);
  return { y: y.get(0) ?? 0, n: n.get(0) ?? 0 };
}
