import { type Dataset, sum, boxOfReward } from './dataset';

export interface SpendTotals {
  /** Box reward spend from the latest cumulative snapshot. */
  boxSpend: number;
  cashbackSpend: number;
  couponSpend: number;
  /** Gacha cashback, which is absent from the spend files entirely. */
  gachaCashback: number;
  /** Box reward spend + gacha cashback. */
  totalSpend: number;
}

/**
 * Cumulative spend, per the spec: box reward spend comes from the latest
 * total_spent_reward snapshot, and gacha cashback is added on top because the
 * gacha draw is not represented in the spend files at all.
 *
 * Both halves are all-time totals so they stay comparable. The snapshot cannot
 * be sliced by date, so slicing only the gacha half would put the two halves on
 * different date bases. One consequence to keep in mind when reading the UI:
 * the gacha figure here (all time, ~Rp1.358.300) is larger than the one on the
 * Gacha page (launch day, Rp1.336.500), because a handful of pre-launch test
 * spins are included — as they are in the snapshot's box spend. Every surface
 * showing this total labels it "all time".
 */
export function spendTotals(ds: Dataset): SpendTotals {
  const rows = ds.spendSnapshot;
  const cashbackSpend = sum(rows.filter((r) => r.type === 'CASHBACK'), (r) => r.spend_amount);
  const couponSpend = sum(rows.filter((r) => r.type === 'COUPON'), (r) => r.spend_amount);
  const boxSpend = cashbackSpend + couponSpend;
  const gachaCashback = sum(ds.raw.dailyGacha, (r) => r.cashback_amount);
  return { boxSpend, cashbackSpend, couponSpend, gachaCashback, totalSpend: boxSpend + gachaCashback };
}

export interface BoxSpendRow {
  boxId: number;
  boxName: string;
  claimed: number;
  redeemed: number;
  spend: number;
}

/**
 * Spend and redemption per box.
 *
 * The join is the whole point here: spend rows are matched to a box through
 * `reward_id -> blindbox_reward.blind_box_id`. Their own `blind_box_id2` column
 * holds 1-12 and must never be used.
 */
export function spendByBox(ds: Dataset): BoxSpendRow[] {
  const acc = new Map<number, BoxSpendRow>();
  for (const box of ds.boxesByStamp) {
    acc.set(box.id, { boxId: box.id, boxName: box.name_en, claimed: 0, redeemed: 0, spend: 0 });
  }
  for (const row of ds.spendSnapshot) {
    const box = boxOfReward(ds, row.reward_id);
    if (!box) continue;
    const entry = acc.get(box.id);
    if (!entry) continue;
    entry.claimed += row.total_user_claimed;
    entry.redeemed += row.total_user_redeemed;
    entry.spend += row.spend_amount;
  }
  return [...acc.values()];
}

export interface DailySpendPoint {
  date: string;
  cashback: number;
  coupon: number;
  gacha: number;
  total: number;
  /** Daily spend claims are far below that day's box claims — see spec §2.4. */
  incomplete: boolean;
  /**
   * The cashback figure was reconstructed from claims rather than read from
   * the spend export. See derivedCashbackByDate.
   */
  cashbackDerived: boolean;
}

/**
 * Daily cashback spend, reconstructed from the claims file.
 *
 * `daily_spent_reward` is not populating box spend (spec §2.4), but cashback is
 * fully recoverable without it: `daily_claim_rewards` carries both the number of
 * claims and the configured payout per claim, and a cashback reward pays out
 * exactly its `cashback_value` every time it is claimed — there is no redemption
 * step to introduce uncertainty.
 *
 * Validated against the cumulative export: summed over all dates this gives
 * Rp588.100 against Rp603.000 in the 13:51 snapshot. The Rp14.900 gap is the 75
 * minutes of activity between the 12:36 claims export and the 13:51 spend one,
 * so the two reconcile.
 *
 * Coupons cannot be reconstructed this way. A claimed coupon only costs money
 * when it is redeemed, the claims file records no redemptions, and face value is
 * unknown for coupons nobody has redeemed yet.
 */
export function derivedCashbackByDate(ds: Dataset): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of ds.dailyRewards) {
    if (row.reward_type !== 'CASHBACK') continue;
    const value = row.cashback_value ?? 0;
    out.set(row.claim_date, (out.get(row.claim_date) ?? 0) + row.total_claim * value);
  }
  return out;
}

/**
 * Per-day spend split for the trend and stacked charts.
 *
 * `daily_spent_reward_result` is known to under-report (it shows 0 claimed and
 * 0 redeemed on launch day while the cumulative file shows ~2,000 claims), so
 * each point carries an `incomplete` flag rather than silently drawing a lie.
 */
export function dailySpendSeries(ds: Dataset): DailySpendPoint[] {
  const claimsByDate = new Map<string, number>();
  for (const r of ds.dailyRewards) {
    claimsByDate.set(r.claim_date, (claimsByDate.get(r.claim_date) ?? 0) + r.total_claim);
  }
  const gachaByDate = new Map(ds.dailyGacha.map((r) => [r.claim_date, r.cashback_amount]));
  const derived = derivedCashbackByDate(ds);

  return ds.dates.map((date) => {
    const rows = ds.dailySpend.filter((r) => r.date === date);
    const exported = sum(rows.filter((r) => r.type === 'CASHBACK'), (r) => r.spend_amount);
    // Prefer the export where it has data, so this self-corrects the day the
    // upstream query is fixed. Fall back to the reconstruction otherwise.
    const cashbackDerived = exported <= 0;
    const cashback = cashbackDerived ? (derived.get(date) ?? 0) : exported;
    const coupon = sum(rows.filter((r) => r.type === 'COUPON'), (r) => r.spend_amount);
    const gacha = gachaByDate.get(date) ?? 0;
    return {
      date,
      cashback,
      coupon,
      gacha,
      total: cashback + coupon + gacha,
      incomplete: isDailySpendIncomplete(rows, claimsByDate.get(date) ?? 0),
      cashbackDerived,
    };
  });
}

/**
 * A date is flagged incomplete when the daily spend file reports far fewer
 * claims than the daily claims file does for the same date. Half is a generous
 * bar — on the current export the gap is total (0 vs ~2,000).
 */
export function isDailySpendIncomplete(
  spendRows: Array<{ total_user_claimed: number }>,
  boxClaimsThatDay: number,
): boolean {
  if (boxClaimsThatDay <= 0) return false;
  const spendClaims = sum(spendRows, (r) => r.total_user_claimed);
  return spendClaims < boxClaimsThatDay * 0.5;
}

/** Dates where the daily spend data cannot be trusted. */
export function incompleteDates(ds: Dataset): string[] {
  return dailySpendSeries(ds).filter((p) => p.incomplete).map((p) => p.date);
}
