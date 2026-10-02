import { type Dataset, boxOfReward } from './dataset';
import { stockStatusOf, type StockStatus } from './stock';
import { faceValue, rewardRedemptionRate } from './redemption';

export interface RewardRow {
  rewardId: number;
  name: string;
  boxId: number | null;
  boxName: string;
  stampRequired: number | null;
  imageUrl: string | null;
  rarity: string;
  type: string;
  weight: number;
  status: string | null;
  stockTotal: number;
  stockDistributed: number;
  stockLeftPct: number | null;
  stockStatus: StockStatus;
  /** Claims over the selected period, from the daily claims file. */
  claimed: number;
  /** All-time claims, from the latest cumulative claims snapshot. */
  cumulativeClaimed: number;
  /** Claims as the spend file counts them — the denominator for the rate. */
  couponClaimed: number;
  redeemed: number;
  /** Null for cashback, which is auto-credited and has no rate. */
  redemptionRate: number | null;
  spend: number;
  faceValue: number | null;
  /** Movement since the previous pair of snapshots. */
  change: { claimed: number; redeemed: number; spend: number } | null;
}

/**
 * One row per reward, stitched from four sources:
 *   - blindbox_reward  : rarity, weight, image, type
 *   - daily_rewards    : claims over the selected period
 *   - reward_snapshots : stock and all-time claims
 *   - spend_snapshots  : redemptions and spend
 *
 * The claimed and redeemed columns come from different exports taken at
 * different times of day, which is exactly why every section of the UI carries
 * its own "as of" label. The redemption rate divides two figures from the same
 * export so it stays internally consistent.
 *
 * Spend rows are matched by reward id only. Their blind_box_id2 is 1-12 and
 * would silently attribute every reward to the wrong box.
 */
export function rewardRows(ds: Dataset): RewardRow[] {
  const claimSnap = new Map(ds.rewardSnapshot.map((r) => [r.reward_id, r]));
  const prevClaimSnap = new Map(ds.prevRewardSnapshot.map((r) => [r.reward_id, r]));
  const spendSnap = new Map(ds.spendSnapshot.map((r) => [r.reward_id, r]));
  const prevSpendSnap = new Map(ds.prevSpendSnapshot.map((r) => [r.reward_id, r]));
  const hasPrevious = ds.prevRewardSnapshot.length > 0 || ds.prevSpendSnapshot.length > 0;

  const periodClaims = new Map<number, number>();
  for (const r of ds.dailyRewards) {
    periodClaims.set(r.reward_id, (periodClaims.get(r.reward_id) ?? 0) + r.total_claim);
  }

  return ds.rewards.map((reward) => {
    const claim = claimSnap.get(reward.id);
    const spend = spendSnap.get(reward.id);
    const box = boxOfReward(ds, reward.id);

    const stockTotal = claim?.stock_total ?? reward.stock_total;
    const stockDistributed = claim?.stock_distributed ?? reward.stock_distributed;
    const { pct, status } = stockStatusOf(stockTotal, stockDistributed);

    const couponClaimed = spend?.total_user_claimed ?? 0;
    const redeemed = spend?.total_user_redeemed ?? 0;
    const spendAmount = spend?.spend_amount ?? 0;
    const cumulativeClaimed = claim?.total_claim ?? 0;

    const prevClaim = prevClaimSnap.get(reward.id);
    const prevSpend = prevSpendSnap.get(reward.id);

    return {
      rewardId: reward.id,
      name: reward.name_en,
      boxId: box?.id ?? null,
      boxName: box?.name_en ?? '—',
      stampRequired: claim?.stamp_required ?? null,
      imageUrl: reward.image_url,
      rarity: reward.rarity,
      type: reward.type,
      weight: reward.weight,
      status: reward.status,
      stockTotal,
      stockDistributed,
      stockLeftPct: pct,
      stockStatus: status,
      claimed: periodClaims.get(reward.id) ?? 0,
      cumulativeClaimed,
      couponClaimed,
      redeemed,
      // Null for cashback — the UI shows "auto-credited" instead.
      redemptionRate: rewardRedemptionRate(reward.type, couponClaimed, redeemed),
      spend: spendAmount,
      faceValue: spend ? faceValue(spend) : null,
      change: hasPrevious
        ? {
            claimed: cumulativeClaimed - (prevClaim?.total_claim ?? 0),
            redeemed: redeemed - (prevSpend?.total_user_redeemed ?? 0),
            spend: spendAmount - (prevSpend?.spend_amount ?? 0),
          }
        : null,
    };
  });
}

/** Default ordering for the Rewards table: closest to running out first. */
export function sortByStockLeft(rows: RewardRow[]): RewardRow[] {
  return [...rows].sort((a, b) => {
    // "No stock set" has no position on a scale, so it sinks to the bottom.
    if (a.stockLeftPct === null && b.stockLeftPct === null) return a.name.localeCompare(b.name);
    if (a.stockLeftPct === null) return 1;
    if (b.stockLeftPct === null) return -1;
    return a.stockLeftPct - b.stockLeftPct;
  });
}

export function topByClaims(rows: RewardRow[], limit = 10): RewardRow[] {
  return [...rows].sort((a, b) => b.claimed - a.claimed || a.name.localeCompare(b.name)).slice(0, limit);
}

export function topBySpend(rows: RewardRow[], limit = 10): RewardRow[] {
  return [...rows].sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name)).slice(0, limit);
}
