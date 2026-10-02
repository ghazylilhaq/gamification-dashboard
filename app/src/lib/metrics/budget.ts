import { CAMPAIGN_END_DATE, LAUNCH_DATE } from '@/config/fileTypes';
import { type Dataset, sum, boxOfReward } from './dataset';
import { spendTotals, isDailySpendIncomplete, derivedCashbackByDate } from './spend';

/**
 * What the campaign has cost.
 *
 * Budget is the sum of three things that arrive from two different places:
 *   - box cashback   — spend snapshot, type CASHBACK
 *   - coupon redemptions — spend snapshot, type COUPON
 *   - gacha cashback — daily_gacha, absent from the spend files entirely
 *
 * Every total here is all-time. The spend snapshot is a cumulative figure that
 * cannot be sliced by date, so date-filtering only the gacha half would put the
 * three components on different bases. The daily series below is the
 * date-aware view.
 */

export type BudgetTypeId = 'CASHBACK' | 'COUPON' | 'GACHA';

export interface BudgetTotals {
  total: number;
  boxCashback: number;
  coupon: number;
  gachaCashback: number;
  /** Days of data since launch. 1 on launch day. */
  daysCounted: number;
  /** Total ÷ days. Null until there is at least one day of data. */
  dailyBurnRate: number | null;
  /** The most recent day is still in progress, so the rate understates. */
  latestDayPartial: boolean;
}

export function budgetTotals(ds: Dataset, exportDate?: string | null): BudgetTotals {
  const spend = spendTotals(ds);
  const dates = budgetDates(ds);
  const daysCounted = dates.length;

  return {
    total: spend.totalSpend,
    boxCashback: spend.cashbackSpend,
    coupon: spend.couponSpend,
    gachaCashback: spend.gachaCashback,
    daysCounted,
    dailyBurnRate: daysCounted > 0 ? spend.totalSpend / daysCounted : null,
    latestDayPartial: Boolean(exportDate && dates.includes(exportDate)),
  };
}

/** Every date carrying activity since launch, ignoring the range picker. */
function budgetDates(ds: Dataset): string[] {
  return [...new Set([
    ...ds.sinceLaunch.dailyRewards.map((r) => r.claim_date),
    ...ds.sinceLaunch.dailyGacha.map((r) => r.claim_date),
  ])].sort();
}

export interface BudgetTypeRow {
  type: BudgetTypeId;
  label: string;
  /** What the money was actually spent on: credits issued or coupons redeemed. */
  units: number;
  unitLabel: string;
  /** Units claimed. Equal to `units` for cashback, which is auto-credited. */
  claimed: number;
  spend: number;
  /** Spend per unit. Null when nothing has been spent yet. */
  averagePerUnit: number | null;
  /** Share of the total budget, 0–1. */
  share: number;
  /** Coupons only. Null where a rate has no meaning. */
  redemptionRate: number | null;
  /** Money already committed but not yet spent — see unredeemedExposure. */
  note?: string;
}

/**
 * The budget split three ways, with the unit each type is measured in.
 *
 * The three are not directly comparable per unit: a cashback credit is one
 * payout, a redeemed coupon is one face value, and a gacha claim is one spin
 * that may or may not pay out. The unit label says which.
 */
export function budgetByType(ds: Dataset): BudgetTypeRow[] {
  const totals = budgetTotals(ds);
  const snapshot = ds.spendSnapshot;

  const cashbackRows = snapshot.filter((r) => r.type === 'CASHBACK');
  const couponRows = snapshot.filter((r) => r.type === 'COUPON');

  const cashbackCredited = sum(cashbackRows, (r) => r.total_user_claimed);
  const couponClaimed = sum(couponRows, (r) => r.total_user_claimed);
  const couponRedeemed = sum(couponRows, (r) => r.total_user_redeemed);
  const gachaClaims = sum(ds.sinceLaunch.dailyGacha, (r) => r.total_claim);

  const share = (value: number) => (totals.total > 0 ? value / totals.total : 0);

  return [
    {
      type: 'CASHBACK',
      label: 'Box cashback',
      units: cashbackCredited,
      unitLabel: 'credits',
      claimed: cashbackCredited,
      spend: totals.boxCashback,
      averagePerUnit: cashbackCredited > 0 ? totals.boxCashback / cashbackCredited : null,
      share: share(totals.boxCashback),
      // Credited automatically, so redeemed always equals claimed.
      redemptionRate: null,
    },
    {
      type: 'COUPON',
      label: 'Coupon redemptions',
      units: couponRedeemed,
      unitLabel: 'redeemed',
      claimed: couponClaimed,
      spend: totals.coupon,
      averagePerUnit: couponRedeemed > 0 ? totals.coupon / couponRedeemed : null,
      share: share(totals.coupon),
      redemptionRate: couponClaimed > 0 ? couponRedeemed / couponClaimed : null,
    },
    {
      type: 'GACHA',
      label: 'Gacha cashback',
      units: gachaClaims,
      unitLabel: 'spins',
      claimed: gachaClaims,
      spend: totals.gachaCashback,
      averagePerUnit: gachaClaims > 0 ? totals.gachaCashback / gachaClaims : null,
      share: share(totals.gachaCashback),
      redemptionRate: null,
      note: 'Not in the spend files — added from daily_claim_gatcha',
    },
  ];
}

export interface BudgetBoxRow {
  boxId: number;
  boxName: string;
  stampRequired: number;
  cashback: number;
  coupon: number;
  total: number;
  share: number;
}

/**
 * Budget per box. Gacha is excluded because it is not attributable to a box —
 * it is a separate draw, so the rows here sum to box reward spend, not to the
 * full budget.
 */
export function budgetByBox(ds: Dataset): BudgetBoxRow[] {
  const acc = new Map<number, BudgetBoxRow>();
  for (const box of ds.boxesByStamp) {
    acc.set(box.id, {
      boxId: box.id,
      boxName: box.name_en,
      stampRequired: box.stamp_required,
      cashback: 0,
      coupon: 0,
      total: 0,
      share: 0,
    });
  }

  // Resolved through the reward id, never the spend file's blind_box_id2.
  for (const row of ds.spendSnapshot) {
    const box = boxOfReward(ds, row.reward_id);
    if (!box) continue;
    const entry = acc.get(box.id);
    if (!entry) continue;
    if (row.type === 'CASHBACK') entry.cashback += row.spend_amount;
    else if (row.type === 'COUPON') entry.coupon += row.spend_amount;
    entry.total += row.spend_amount;
  }

  const boxSpend = sum([...acc.values()], (r) => r.total);
  for (const row of acc.values()) row.share = boxSpend > 0 ? row.total / boxSpend : 0;
  return [...acc.values()];
}

export interface DailyBudgetPoint {
  date: string;
  cashback: number;
  coupon: number;
  gacha: number;
  total: number;
  /** Running total across the series. */
  cumulative: number;
  /** The box half of this day is under-reported — see spec §2.4. */
  incomplete: boolean;
  /** Cashback was reconstructed from claims, not read from the spend export. */
  cashbackDerived: boolean;
}

/**
 * Budget per day, with a running total.
 *
 * This respects the date range, unlike the totals above. It is also the view
 * most damaged by the daily spend export: box cashback and coupon spend are
 * near-zero on every date, so today the line is carried almost entirely by
 * gacha. Each point carries `incomplete` so the UI can say so.
 */
export function dailyBudgetSeries(ds: Dataset): DailyBudgetPoint[] {
  const claimsByDate = new Map<string, number>();
  for (const r of ds.dailyRewards) {
    claimsByDate.set(r.claim_date, (claimsByDate.get(r.claim_date) ?? 0) + r.total_claim);
  }
  const gachaByDate = new Map(ds.dailyGacha.map((r) => [r.claim_date, r.cashback_amount]));
  const derived = derivedCashbackByDate(ds);

  let running = 0;
  return ds.dates.map((date) => {
    const rows = ds.dailySpend.filter((r) => r.date === date);
    const exported = sum(rows.filter((r) => r.type === 'CASHBACK'), (r) => r.spend_amount);
    const cashbackDerived = exported <= 0;
    const cashback = cashbackDerived ? (derived.get(date) ?? 0) : exported;
    const coupon = sum(rows.filter((r) => r.type === 'COUPON'), (r) => r.spend_amount);
    const gacha = gachaByDate.get(date) ?? 0;
    const total = cashback + coupon + gacha;
    running += total;
    return {
      date,
      cashback,
      coupon,
      gacha,
      total,
      cumulative: running,
      incomplete: isDailySpendIncomplete(rows, claimsByDate.get(date) ?? 0),
      cashbackDerived,
    };
  });
}

/**
 * How far the daily series falls short of the cumulative totals.
 *
 * Worth surfacing rather than hiding: if the daily chart adds up to a fraction
 * of the real budget, nobody should be reading trends off it. With cashback
 * reconstructed from claims, coupon redemptions are the only component the
 * daily view still cannot see.
 */
export function dailyBudgetCoverage(ds: Dataset): {
  dailyTotal: number;
  cumulativeTotal: number;
  ratio: number | null;
  trustworthy: boolean;
  /** Any point on the chart is using reconstructed cashback. */
  usesDerivedCashback: boolean;
  /** Coupon spend is missing from the daily view entirely. */
  missingCouponSpend: number;
} {
  const series = dailyBudgetSeries(ds);
  const dailyTotal = sum(series, (p) => p.total);
  const totals = budgetTotals(ds);
  const cumulativeTotal = totals.total;
  const ratio = cumulativeTotal > 0 ? dailyTotal / cumulativeTotal : null;
  const dailyCoupon = sum(series, (p) => p.coupon);
  return {
    dailyTotal,
    cumulativeTotal,
    ratio,
    trustworthy: ratio !== null && ratio >= 0.9,
    usesDerivedCashback: series.some((p) => p.cashbackDerived && p.cashback > 0),
    missingCouponSpend: Math.max(0, totals.coupon - dailyCoupon),
  };
}

/**
 * The maximum additional cost if every claimed-but-unredeemed coupon were used.
 *
 * Only partly computable: face value is derived as spend ÷ redeemed, so it is
 * unknown for coupons nobody has redeemed yet. `knownExposure` covers the
 * coupons we can price; `unpricedCoupons` is the blind spot. Full exposure is
 * parked in spec §7 pending a face value per coupon.
 */
export function unredeemedExposure(ds: Dataset): {
  unredeemedCoupons: number;
  knownExposure: number;
  pricedCoupons: number;
  unpricedCoupons: number;
  unpricedUnredeemed: number;
} {
  const coupons = ds.spendSnapshot.filter((r) => r.type === 'COUPON');
  let knownExposure = 0;
  let pricedCoupons = 0;
  let unpricedCoupons = 0;
  let unpricedUnredeemed = 0;

  for (const row of coupons) {
    const outstanding = Math.max(0, row.total_user_claimed - row.total_user_redeemed);
    if (row.total_user_redeemed > 0) {
      pricedCoupons += 1;
      knownExposure += (row.spend_amount / row.total_user_redeemed) * outstanding;
    } else if (outstanding > 0) {
      unpricedCoupons += 1;
      unpricedUnredeemed += outstanding;
    }
  }

  return {
    unredeemedCoupons: sum(coupons, (r) => Math.max(0, r.total_user_claimed - r.total_user_redeemed)),
    knownExposure,
    pricedCoupons,
    unpricedCoupons,
    unpricedUnredeemed,
  };
}

/* ------------------------------------------------------------------ cashback */

export interface CashbackTotals {
  /** Credits issued. Cashback is automatic, so this is also "claimed". */
  credited: number;
  spend: number;
  /** Mean payout per credit. */
  averagePerCredit: number | null;
}

export function cashbackTotals(ds: Dataset): CashbackTotals {
  const rows = ds.spendSnapshot.filter((r) => r.type === 'CASHBACK');
  const credited = sum(rows, (r) => r.total_user_claimed);
  const spend = sum(rows, (r) => r.spend_amount);
  return { credited, spend, averagePerCredit: credited > 0 ? spend / credited : null };
}

export interface CashbackRow {
  rewardId: number;
  name: string;
  boxName: string;
  credited: number;
  spend: number;
  averagePerCredit: number | null;
  /** Configured payout from the reference data, for comparison. */
  configuredValue: number | null;
}

export function cashbackTable(ds: Dataset): CashbackRow[] {
  return ds.spendSnapshot
    .filter((r) => r.type === 'CASHBACK')
    .map((row) => {
      const reward = ds.rewardById.get(row.reward_id);
      return {
        rewardId: row.reward_id,
        name: reward?.name_en ?? row.name_en,
        boxName: boxOfReward(ds, row.reward_id)?.name_en ?? '—',
        credited: row.total_user_claimed,
        spend: row.spend_amount,
        averagePerCredit: row.total_user_claimed > 0 ? row.spend_amount / row.total_user_claimed : null,
        configuredValue: reward?.cashback_value ?? null,
      };
    })
    .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name));
}

export interface CashbackBoxRow {
  boxId: number;
  boxName: string;
  credited: number;
  spend: number;
}

export function cashbackByBox(ds: Dataset): CashbackBoxRow[] {
  const acc = new Map<number, CashbackBoxRow>();
  for (const box of ds.boxesByStamp) {
    acc.set(box.id, { boxId: box.id, boxName: box.name_en, credited: 0, spend: 0 });
  }
  for (const row of ds.spendSnapshot.filter((r) => r.type === 'CASHBACK')) {
    const box = boxOfReward(ds, row.reward_id);
    const entry = box ? acc.get(box.id) : undefined;
    if (!entry) continue;
    entry.credited += row.total_user_claimed;
    entry.spend += row.spend_amount;
  }
  return [...acc.values()].filter((r) => r.credited > 0 || r.spend > 0);
}

export { LAUNCH_DATE, CAMPAIGN_END_DATE };
