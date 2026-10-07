import { merchantFromName } from '@/config/merchants';
import { type Dataset, sum, boxOfReward } from './dataset';

export interface RedemptionTotals {
  claimed: number;
  redeemed: number;
  /** redeemed / claimed, or null when nothing has been claimed yet. */
  rate: number | null;
  spend: number;
  /** Mean spend per redeemed coupon, or null when nothing is redeemed. */
  averageFaceValue: number | null;
}

/** Coupon rows only — cashback is auto-credited and has no meaningful rate. */
export function couponRows(ds: Dataset) {
  return ds.spendSnapshot.filter((r) => r.type === 'COUPON');
}

export function redemptionTotals(ds: Dataset): RedemptionTotals {
  return redemptionOf(couponRows(ds));
}

export function redemptionOf(
  rows: Array<{ total_user_claimed: number; total_user_redeemed: number; spend_amount: number }>,
): RedemptionTotals {
  const claimed = sum(rows, (r) => r.total_user_claimed);
  const redeemed = sum(rows, (r) => r.total_user_redeemed);
  const spend = sum(rows, (r) => r.spend_amount);
  return {
    claimed,
    redeemed,
    rate: claimed > 0 ? redeemed / claimed : null,
    spend,
    averageFaceValue: redeemed > 0 ? spend / redeemed : null,
  };
}

/**
 * Face value of a single coupon = spend / redeemed.
 * Only defined once at least one coupon has actually been redeemed; an
 * unredeemed coupon's face value is simply unknown from this data.
 */
export function faceValue(row: { total_user_redeemed: number; spend_amount: number }): number | null {
  return row.total_user_redeemed > 0 ? row.spend_amount / row.total_user_redeemed : null;
}

/**
 * Redemption rate for a single reward: redeemed over claimed, both as the
 * cumulative spend export counts them, so the two sides stay consistent.
 *
 * Null for cashback, which is credited automatically — a rate there would
 * always read 100% and tell nobody anything.
 */
export function rewardRedemptionRate(type: string, claimed: number, redeemed: number): number | null {
  return type === 'COUPON' && claimed > 0 ? redeemed / claimed : null;
}

export interface MerchantRow extends RedemptionTotals {
  merchant: string;
  couponCount: number;
}

export function redemptionByMerchant(ds: Dataset): MerchantRow[] {
  const groups = new Map<string, ReturnType<typeof couponRows>>();
  for (const row of couponRows(ds)) {
    const merchant = merchantFromName(row.name_en);
    const bucket = groups.get(merchant);
    if (bucket) bucket.push(row);
    else groups.set(merchant, [row]);
  }
  return [...groups.entries()]
    .map(([merchant, rows]) => ({ merchant, couponCount: rows.length, ...redemptionOf(rows) }))
    .sort((a, b) => b.claimed - a.claimed || a.merchant.localeCompare(b.merchant));
}

export interface BoxRedemptionRow extends RedemptionTotals {
  boxId: number;
  boxName: string;
  stampRequired: number;
}

export function redemptionByBox(ds: Dataset): BoxRedemptionRow[] {
  const groups = new Map<number, ReturnType<typeof couponRows>>();
  for (const row of couponRows(ds)) {
    const box = boxOfReward(ds, row.reward_id);
    if (!box) continue;
    const bucket = groups.get(box.id);
    if (bucket) bucket.push(row);
    else groups.set(box.id, [row]);
  }
  return ds.boxesByStamp
    .map((box) => ({
      boxId: box.id,
      boxName: box.name_en,
      stampRequired: box.stamp_required,
      ...redemptionOf(groups.get(box.id) ?? []),
    }))
    .filter((r) => r.claimed > 0 || r.spend > 0);
}

export interface CouponRow extends RedemptionTotals {
  rewardId: number;
  name: string;
  boxName: string;
  merchant: string;
  couponRefId: string | null;
}

export function couponTable(ds: Dataset): CouponRow[] {
  return couponRows(ds)
    .map((row) => ({
      rewardId: row.reward_id,
      name: row.name_en,
      boxName: boxOfReward(ds, row.reward_id)?.name_en ?? '—',
      merchant: merchantFromName(row.name_en),
      couponRefId: row.coupon_ref_id,
      ...redemptionOf([row]),
    }))
    .sort((a, b) => b.redeemed - a.redeemed || b.claimed - a.claimed);
}

/**
 * Whether the daily spend export can be trusted for coupon redemption.
 *
 *   'ok'      — daily figures broadly agree with the cumulative file
 *   'empty'   — the daily file reports no coupon activity at all, while the
 *               cumulative file does. Nothing to plot; a chart of zeros would
 *               read as "nothing happened" rather than "data missing".
 *   'partial' — some dates are well below the claims file.
 */
export type DailyRedemptionAvailability = 'ok' | 'empty' | 'partial';

export function dailyRedemptionAvailability(
  ds: Dataset,
  boxId: number | null = null,
): DailyRedemptionAvailability {
  const cumulative = redemptionOf(couponRowsOfBox(ds, boxId));
  const daily = dailyRedemptionSeries(ds, boxId);
  const dailyTotal = sum(daily, (p) => p.claimed + p.redeemed + p.spend);

  // The current export is in exactly this state: every coupon row reads
  // 0 claimed / 0 redeemed / no spend on every date, while the cumulative
  // file reports 742 claimed and 32 redeemed.
  if (dailyTotal === 0 && cumulative.claimed > 0) return 'empty';
  if (daily.some((p) => p.incomplete)) return 'partial';
  return 'ok';
}

/** Coupon rows for one box, or every box when `boxId` is null. */
export function couponRowsOfBox(ds: Dataset, boxId: number | null) {
  const rows = couponRows(ds);
  if (boxId === null) return rows;
  return rows.filter((r) => ds.boxIdByRewardId.get(r.reward_id) === boxId);
}

export interface DailyRedemptionPoint {
  date: string;
  claimed: number;
  redeemed: number;
  spend: number;
  incomplete: boolean;
}

/**
 * Coupons claimed, redeemed and spent per day — for one box, or for every box
 * combined when `boxId` is null.
 */
export function dailyRedemptionSeries(
  ds: Dataset,
  boxId: number | null = null,
): DailyRedemptionPoint[] {
  const inBox = (rewardId: number) =>
    boxId === null || ds.boxIdByRewardId.get(rewardId) === boxId;

  const claimsByDate = new Map<string, number>();
  for (const r of ds.dailyRewards) {
    if (boxId !== null && r.blind_box_id2 !== boxId) continue;
    claimsByDate.set(r.claim_date, (claimsByDate.get(r.claim_date) ?? 0) + r.total_claim);
  }

  const daily = ds.dailySpend.filter((r) => inBox(r.reward_id));
  return ds.dates.map((date) => {
    const rows = daily.filter((r) => r.date === date && r.type === 'COUPON');
    const allRows = daily.filter((r) => r.date === date);
    const boxClaims = claimsByDate.get(date) ?? 0;
    const spendClaims = sum(allRows, (r) => r.total_user_claimed);
    return {
      date,
      claimed: sum(rows, (r) => r.total_user_claimed),
      redeemed: sum(rows, (r) => r.total_user_redeemed),
      spend: sum(rows, (r) => r.spend_amount),
      incomplete: boxClaims > 0 && spendClaims < boxClaims * 0.5,
    };
  });
}
