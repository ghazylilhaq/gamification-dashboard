import { type Dataset, sum } from './dataset';
import { hasReachData, reachFunnel, reachTotals } from './reach';

export interface ClaimTotals {
  total: number;
  cashback: number;
  coupon: number;
}

/** Box claims over the selected date range, split by reward type. */
export function claimTotals(ds: Dataset): ClaimTotals {
  return totalsOf(ds.dailyRewards);
}

/**
 * Box claims since launch, ignoring the date range.
 *
 * This is the headline "total box claims to date" figure. It deliberately does
 * not respond to the range picker: a card labelled as a running total should
 * not change when someone narrows the range to look at a chart.
 */
export function cumulativeClaimTotals(ds: Dataset): ClaimTotals {
  return totalsOf(ds.sinceLaunch.dailyRewards);
}

function totalsOf(rows: Dataset['dailyRewards']): ClaimTotals {
  return {
    total: sum(rows, (r) => r.total_claim),
    cashback: sum(rows.filter((r) => r.reward_type === 'CASHBACK'), (r) => r.total_claim),
    coupon: sum(rows.filter((r) => r.reward_type === 'COUPON'), (r) => r.total_claim),
  };
}

export interface DailyClaimPoint {
  date: string;
  boxClaims: number;
  gachaClaims: number;
  totalSpend: number;
  isPartial: boolean;
}

/**
 * The Overview trend: box and gacha claims per day with total spend over them.
 * A date matching a file's export date is only a partial day and is labelled
 * as such rather than being read as a finished day.
 */
export function dailyClaimSeries(ds: Dataset, partialDate?: string | null): DailyClaimPoint[] {
  const boxByDate = new Map<string, number>();
  for (const r of ds.dailyRewards) {
    boxByDate.set(r.claim_date, (boxByDate.get(r.claim_date) ?? 0) + r.total_claim);
  }
  const gachaByDate = new Map(ds.dailyGacha.map((r) => [r.claim_date, r]));
  const spendByDate = new Map<string, number>();
  for (const r of ds.dailySpend) {
    spendByDate.set(r.date, (spendByDate.get(r.date) ?? 0) + r.spend_amount);
  }

  return ds.dates.map((date) => ({
    date,
    boxClaims: boxByDate.get(date) ?? 0,
    gachaClaims: gachaByDate.get(date)?.total_claim ?? 0,
    totalSpend: (spendByDate.get(date) ?? 0) + (gachaByDate.get(date)?.cashback_amount ?? 0),
    isPartial: partialDate === date,
  }));
}

export interface LadderStep {
  boxId: number;
  boxName: string;
  imageUrl: string | null;
  stampRequired: number;
  /** Box claims over the selected date range. */
  claims: number;
  /** Box claims since launch — the claim rate's numerator, shown beside it. */
  claimsSinceLaunch: number;
  /** Onboarded users whose stamps reach this box or beyond. Null without reach data. */
  reachedY: number | null;
  /** Users who reach it but have never opened the blindbox page. */
  reachedN: number | null;
  /**
   * Box claim rate: since-launch claims ÷ onboarded users whose stamps reach
   * the box. Only onboarded users can claim, so they are the denominator.
   *
   * Assumes one claim per user per box (spec §3, to confirm); above 100% would
   * mean users claim a box more than once. Null without reach data.
   */
  claimRate: number | null;
  /**
   * The claims and reach exports are from different days, so the rate compares
   * two different moments and should be read as approximate.
   */
  claimRateApproximate: boolean;
  /**
   * Share of the previous step. With reach data this is the funnel of
   * onboarded users getting this far; without it, box claims over the
   * previous box's claims. Null for the first step when there is nothing
   * before it.
   */
  stepDownPct: number | null;
  /** Nobody has got this far — by reach when available, otherwise by claims. */
  notReached: boolean;
}

export interface StampLadder {
  /** Onboarded users, from the latest blindbox_reach export. */
  onboard: { value: number; asOf: string } | null;
  /** Whether the ladder is built on reach data or on claims alone. */
  basis: 'reach' | 'claims';
  /** Set when reach and claims come from different days; claim rates are then approximate. */
  dateMismatch: { claimsAsOf: string | null; reachAsOf: string | null } | null;
  steps: LadderStep[];
}

/**
 * The stamp ladder: users onboarded, then the 12 boxes in stamp order.
 *
 * With a reach export this is the real funnel — how many onboarded users have
 * stamps enough for each box — with claims and conversion alongside. Without
 * one it falls back to claims per box, and the first step is dropped rather
 * than shown as zero: an unknown denominator is not the same as nobody
 * arriving.
 */
export function stampLadder(ds: Dataset): StampLadder {
  const claimsByBox = new Map<number, number>();
  for (const r of ds.dailyRewards) {
    claimsByBox.set(r.blind_box_id2, (claimsByBox.get(r.blind_box_id2) ?? 0) + r.total_claim);
  }
  // Reach is cumulative, so conversion compares it with cumulative claims —
  // not with whatever the range picker happens to be set to.
  const launchClaimsByBox = new Map<number, number>();
  for (const r of ds.sinceLaunch.dailyRewards) {
    launchClaimsByBox.set(r.blind_box_id2, (launchClaimsByBox.get(r.blind_box_id2) ?? 0) + r.total_claim);
  }

  const withReach = hasReachData(ds);
  const totals = withReach ? reachTotals(ds) : null;
  const funnel = withReach ? reachFunnel(ds) : [];
  const onboard = totals && totals.asOf ? { value: totals.onboardY, asOf: totals.asOf } : null;

  const claimsAsOf = ds.raw.freshness.daily_rewards;
  const reachAsOf = ds.raw.freshness.reach_snapshot;
  const sameDay =
    withReach && claimsAsOf !== null && reachAsOf !== null && claimsAsOf.slice(0, 10) === reachAsOf.slice(0, 10);

  let previous: number | null = withReach ? (onboard?.value ?? null) : null;
  const steps: LadderStep[] = ds.boxesByStamp.map((box, i) => {
    const claims = claimsByBox.get(box.id) ?? 0;
    // Reach numbers its boxes 1..12 in stamp order, which is the order here.
    const step = withReach ? funnel[i] : undefined;
    const reachedY = step ? step.reachedY : null;
    const reachedN = step ? step.reachedN : null;

    const current = withReach ? (reachedY ?? 0) : claims;
    const stepDownPct = previous !== null && previous > 0 ? current / previous : null;
    previous = current;

    return {
      boxId: box.id,
      boxName: box.name_en,
      imageUrl: box.image_url,
      stampRequired: box.stamp_required,
      claims,
      claimsSinceLaunch: launchClaimsByBox.get(box.id) ?? 0,
      reachedY,
      reachedN,
      claimRate:
        reachedY !== null && reachedY > 0 ? (launchClaimsByBox.get(box.id) ?? 0) / reachedY : null,
      claimRateApproximate: withReach && !sameDay,
      stepDownPct,
      notReached: withReach ? (reachedY ?? 0) + (reachedN ?? 0) === 0 : claims === 0,
    };
  });

  return {
    onboard,
    basis: withReach ? 'reach' : 'claims',
    dateMismatch: withReach && !sameDay ? { claimsAsOf, reachAsOf } : null,
    steps,
  };
}

/** Day-over-day change between the last two dates in a series. */
export function dayOverDay(series: Array<{ date: string }>, pick: (p: never) => number): {
  current: number; previous: number; delta: number; pct: number | null;
} | null {
  if (series.length < 2) return null;
  const current = pick(series[series.length - 1] as never);
  const previous = pick(series[series.length - 2] as never);
  return {
    current,
    previous,
    delta: current - previous,
    pct: previous !== 0 ? (current - previous) / previous : null,
  };
}
