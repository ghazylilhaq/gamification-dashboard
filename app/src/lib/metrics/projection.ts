import { CAMPAIGN_END_DATE } from '@/config/fileTypes';
import { addDays, dateRange } from '@/lib/time';
import { type Dataset, sum } from './dataset';
import { budgetByType, dailyBudgetSeries, unredeemedExposure } from './budget';
import { rewardRows } from './rewards';

/**
 * Where the budget lands on 1 December, the day the campaign closes.
 *
 * Two corrections separate this from "burn rate × days left", and both exist
 * because the expensive rewards were drawn early:
 *
 *   - The slope comes from the last seven days, not the campaign mean. The
 *     grand prizes are largely out of stock, so recent days already price in
 *     the cheaper mix that is left. There is no reward tier or price field to
 *     classify against — `rarity` and `weight` are drop odds, not money — so
 *     the recent window is what carries that knowledge.
 *   - The box arm is capped at what is still physically claimable: remaining
 *     stock × unit value. However many days remain, an empty prize pool cannot
 *     cost anything more.
 *
 * Gacha is deliberately uncapped: daily_claim_gatcha is a daily aggregate with
 * no per-prize rows, so it has no stock dimension to cap against.
 */

/** Days of recent history the 'recent' basis takes its slope from. */
export const RUN_RATE_WINDOW_DAYS = 7;

/**
 * Which stretch of history the slope comes from.
 *
 * Both read the same daily series, so they differ only in window length and
 * are directly comparable. 'recent' follows the current pace, which can run
 * well above or below the campaign mean; 'allTime' smooths across the whole
 * campaign and is the steadier of the two.
 */
export type ProjectionBasis = 'recent' | 'allTime';

export interface RemainingRewardValue {
  /** Remaining CASHBACK stock × its configured value. Credited on claim, so full cost. */
  cashback: number;
  /** Remaining COUPON stock × face value, discounted by the observed redemption rate. */
  coupon: number;
  /** Coupons already claimed and not yet redeemed — not in stock, still owed. */
  outstanding: number;
  total: number;
  /** Rewards with stock left and no knowable unit value, so `total` is a floor. */
  unpricedRewards: number;
  unpricedUnits: number;
}

/**
 * What the remaining prize pool can still cost.
 *
 * A coupon's face value is only knowable once someone has redeemed one of them
 * (it is derived as spend ÷ redeemed), so rewards nobody has redeemed carry no
 * price at all. Those are counted separately rather than guessed at, which
 * makes `total` a floor — the same treatment `unredeemedExposure` uses.
 */
export function remainingRewardValue(ds: Dataset): RemainingRewardValue {
  const couponRate = budgetByType(ds).find((r) => r.type === 'COUPON')?.redemptionRate ?? 1;

  let cashback = 0;
  let coupon = 0;
  let unpricedRewards = 0;
  let unpricedUnits = 0;

  for (const row of rewardRows(ds)) {
    const unitsLeft = Math.max(0, row.stockTotal - row.stockDistributed);
    if (unitsLeft === 0) continue;

    if (row.type === 'CASHBACK') {
      // The configured payout is exact for cashback; face value is the fallback
      // for a reward the reference file has no value for.
      const value = ds.rewardById.get(row.rewardId)?.cashback_value ?? row.faceValue;
      if (value === null || value === undefined) {
        unpricedRewards += 1;
        unpricedUnits += unitsLeft;
        continue;
      }
      cashback += unitsLeft * value;
    } else {
      if (row.faceValue === null) {
        unpricedRewards += 1;
        unpricedUnits += unitsLeft;
        continue;
      }
      // A claimed coupon only costs money when it is redeemed.
      coupon += unitsLeft * row.faceValue * couponRate;
    }
  }

  const outstanding = unredeemedExposure(ds).knownExposure;

  return {
    cashback,
    coupon,
    outstanding,
    total: cashback + coupon + outstanding,
    unpricedRewards,
    unpricedUnits,
  };
}

export interface ProjectionPoint {
  date: string;
  projected: number;
}

export interface BudgetProjection {
  /**
   * Starts on the last day of actual data, so the dashed line joins the solid
   * one with no gap. Empty when no projection can be drawn.
   */
  points: ProjectionPoint[];
  lastActualDate: string | null;
  /** Cumulative spend at `lastActualDate`. */
  anchor: number;
  projectedTotal: number | null;
  daysRemaining: number;
  /** Cashback + coupon per day over the window. */
  boxRate: number | null;
  gachaRate: number | null;
  runRate: number | null;
  basis: ProjectionBasis;
  /** Complete days the slope was averaged over. */
  windowDays: number;
  /** Remaining claimable value — the ceiling on the box arm. */
  headroom: number;
  capped: boolean;
  cappedOnDate: string | null;
  /** The visible range stops short of the latest data, so a forecast would mislead. */
  truncated: boolean;
}

/** A fresh object each time, so no caller shares the empty `points` array. */
function nothingToProject(): Omit<BudgetProjection, 'truncated' | 'basis' | 'headroom'> {
  return {
    points: [],
    lastActualDate: null,
    anchor: 0,
    projectedTotal: null,
    daysRemaining: 0,
    boxRate: null,
    gachaRate: null,
    runRate: null,
    windowDays: 0,
    capped: false,
    cappedOnDate: null,
  };
}

export function budgetProjection(
  ds: Dataset,
  exportDate?: string | null,
  options: { basis?: ProjectionBasis; endDate?: string } = {},
): BudgetProjection {
  const { basis = 'recent', endDate = CAMPAIGN_END_DATE } = options;
  const headroom = remainingRewardValue(ds).total;
  const series = dailyBudgetSeries(ds);
  const base = { ...nothingToProject(), basis, headroom, truncated: false };

  const last = series[series.length - 1];
  if (!last) return base;

  // A range that ends before the latest data would forecast from truncated
  // history, which says nothing useful about where the campaign lands.
  const latestDataDate = [...new Set([
    ...ds.raw.dailyRewards.map((r) => r.claim_date),
    ...ds.raw.dailyGacha.map((r) => r.claim_date),
  ])].sort().pop();
  if (latestDataDate && last.date < latestDataDate) return { ...base, truncated: true };

  const lastActualDate = last.date;
  const anchor = last.cumulative;
  if (lastActualDate >= endDate) return { ...base, lastActualDate, anchor };

  // The most recent day is still being exported, so it would drag the mean down.
  const complete = exportDate === lastActualDate ? series.slice(0, -1) : series;
  const window = basis === 'recent' ? complete.slice(-RUN_RATE_WINDOW_DAYS) : complete;
  const windowDays = window.length;
  if (windowDays === 0) return { ...base, lastActualDate, anchor };

  const boxRate = sum(window, (p) => p.cashback + p.coupon) / windowDays;
  const gachaRate = sum(window, (p) => p.gacha) / windowDays;

  const future = dateRange(addDays(lastActualDate, 1), endDate);
  let cappedOnDate: string | null = null;

  const points: ProjectionPoint[] = [{ date: lastActualDate, projected: anchor }];
  future.forEach((date, i) => {
    const k = i + 1;
    const uncappedBox = boxRate * k;
    const box = Math.min(uncappedBox, headroom);
    if (cappedOnDate === null && uncappedBox > headroom) cappedOnDate = date;
    points.push({ date, projected: anchor + box + gachaRate * k });
  });

  return {
    points,
    lastActualDate,
    anchor,
    projectedTotal: points[points.length - 1]?.projected ?? null,
    daysRemaining: future.length,
    boxRate,
    gachaRate,
    runRate: boxRate + gachaRate,
    basis,
    windowDays,
    headroom,
    capped: cappedOnDate !== null,
    cappedOnDate,
    truncated: false,
  };
}
