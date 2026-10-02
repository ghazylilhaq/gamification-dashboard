import type { Dataset } from './dataset';
import { cumulativeClaimTotals, dailyClaimSeries } from './claims';
import { cumulativeGachaTotals } from './gacha';
import { spendTotals, dailySpendSeries } from './spend';
import { redemptionTotals } from './redemption';
import { stockSummary } from './stock';
import { hasReachData, reachTotals } from './reach';

export interface Delta {
  current: number;
  previous: number;
  delta: number;
  /** Relative change, or null when the previous value was zero. */
  pct: number | null;
}

function deltaOf(current: number, previous: number): Delta {
  return { current, previous, delta: current - previous, pct: previous !== 0 ? (current - previous) / previous : null };
}

function lastTwo<T>(items: T[]): [T | null, T | null] {
  return [items[items.length - 1] ?? null, items[items.length - 2] ?? null];
}

export interface OverviewKpis {
  /**
   * Users who have opened the blindbox page — onboard Y in the latest
   * blindbox_reach export. A cumulative snapshot: it moves between exports,
   * not with the date range.
   */
  userOnboard: {
    value: number;
    asOf: string;
    /** Share of every user with a stamp. */
    rate: number | null;
    /** Change since the previous reach export, if there is one. */
    change: Delta | null;
  } | null;
  /** Box claims since launch, ignoring the date range. */
  boxClaims: { total: number; cashback: number; coupon: number; change: Delta | null };
  /**
   * Gacha claims since launch, ignoring the date range. Claims, not users —
   * one person can spin many times, so a user count here would mislead.
   */
  gachaClaims: { total: number; cashback: number; change: Delta | null };
  totalSpend: {
    total: number; boxSpend: number; cashbackSpend: number; couponSpend: number;
    gachaCashback: number; change: Delta | null;
  };
  couponRedemption: { rate: number | null; claimed: number; redeemed: number };
  stock: { warningCount: number; outCount: number; noStockCount: number; total: number };
}

export function overviewKpis(ds: Dataset): OverviewKpis {
  const claims = cumulativeClaimTotals(ds);
  const gacha = cumulativeGachaTotals(ds);
  const spend = spendTotals(ds);
  const redemption = redemptionTotals(ds);
  const stock = stockSummary(ds);

  const claimSeries = dailyClaimSeries(ds);
  const [lastClaim, prevClaim] = lastTwo(claimSeries);
  const spendSeries = dailySpendSeries(ds);
  const [lastSpend, prevSpend] = lastTwo(spendSeries);
  const gachaDays = [...ds.dailyGacha].sort((a, b) => a.claim_date.localeCompare(b.claim_date));
  const [lastGacha, prevGacha] = lastTwo(gachaDays);

  const reach = hasReachData(ds) ? reachTotals(ds) : null;

  return {
    userOnboard: reach && reach.asOf
      ? {
          value: reach.onboardY,
          asOf: reach.asOf,
          rate: reach.onboardRate,
          change: reach.change
            ? deltaOf(reach.onboardY, reach.onboardY - reach.change.onboardY)
            : null,
        }
      : null,
    boxClaims: {
      ...claims,
      change: lastClaim && prevClaim ? deltaOf(lastClaim.boxClaims, prevClaim.boxClaims) : null,
    },
    gachaClaims: {
      total: gacha.claims,
      cashback: gacha.cashback,
      change: lastGacha && prevGacha ? deltaOf(lastGacha.total_claim, prevGacha.total_claim) : null,
    },
    totalSpend: {
      total: spend.totalSpend,
      boxSpend: spend.boxSpend,
      cashbackSpend: spend.cashbackSpend,
      couponSpend: spend.couponSpend,
      gachaCashback: spend.gachaCashback,
      change: lastSpend && prevSpend ? deltaOf(lastSpend.total, prevSpend.total) : null,
    },
    couponRedemption: {
      rate: redemption.rate,
      claimed: redemption.claimed,
      redeemed: redemption.redeemed,
    },
    stock: {
      warningCount: stock.warningCount,
      outCount: stock.outCount,
      noStockCount: stock.noStockCount,
      total: stock.rows.length,
    },
  };
}

/** Most recent export timestamp across every uploaded source. */
export function latestExport(ds: Dataset): string | null {
  const stamps = Object.values(ds.raw.freshness).filter((v): v is string => typeof v === 'string');
  if (stamps.length === 0) return null;
  return stamps.sort()[stamps.length - 1] ?? null;
}
