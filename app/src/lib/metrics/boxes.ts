import { type Dataset, sum } from './dataset';
import { stockStatusOf, type StockStatus } from './stock';
import { faceValue, rewardRedemptionRate } from './redemption';
import { isDailySpendIncomplete } from './spend';

/**
 * Per-box monitoring: what is in each box, how much of it is left, and whether
 * the drop odds are behaving as configured.
 *
 * The reward-level views answer "which reward is running out". This answers
 * "which box is in trouble", which is the unit the campaign is actually run in.
 */

/** Below this many claims, any observed share is mostly noise. */
export const MIN_CLAIMS_FOR_ODDS = 30;

/**
 * How far an observed share may sit from its configured weight before it is
 * worth a second look, in standard errors.
 *
 * At 2 SE roughly 1 in 20 rewards drifts out by chance alone, so that is a
 * "slight" signal, not a fault — with 42 rewards in play you would expect two
 * of them out there on any given day. Past 3 SE is under 1 in 300 and worth
 * investigating.
 */
const Z_SLIGHT = 2;
const Z_OFF = 3;

export type OddsVerdict =
  /** Observed share is where the configured weight says it should be. */
  | 'on-target'
  /** Outside 2 SE. Expected occasionally from chance; watch, do not act. */
  | 'slight'
  /** Outside 3 SE. Unlikely to be chance. */
  | 'off-target'
  /** Too few claims to say anything. */
  | 'insufficient';

export interface BoxRewardOdds {
  rewardId: number;
  name: string;
  imageUrl: string | null;
  rarity: string;
  type: string;
  status: string | null;
  /** Configured drop odds, as a percentage out of 100. */
  weight: number;
  /** Observed share of this box's claims, as a percentage. Null with no claims. */
  actualPct: number | null;
  /** Claims for this reward over the selected period. */
  claims: number;
  /** All-time claims, from the latest cumulative claims snapshot. */
  cumulativeClaimed: number;
  /** Claims as the cumulative spend export counts them — the rate's denominator. */
  couponClaimed: number;
  /** Redemptions to date, cumulative. */
  redeemed: number;
  /** redeemed / couponClaimed. Null for cashback, which is auto-credited. */
  redemptionRate: number | null;
  /** Mean spend per redeemed coupon. Null until one is redeemed. */
  faceValue: number | null;
  /** actual − weight, in percentage points. */
  deviation: number | null;
  /** Deviation in standard errors. */
  z: number | null;
  verdict: OddsVerdict;
  stockTotal: number;
  stockDistributed: number;
  stockLeftPct: number | null;
  stockStatus: StockStatus;
  spend: number;
  value: number | null;
}

export interface BoxSummary {
  boxId: number;
  name: string;
  imageUrl: string | null;
  stampRequired: number;
  rewardCount: number;
  /** Claims for this box over the selected period. */
  claims: number;
  /** How many of its rewards have been claimed at least once. */
  rewardsClaimed: number;
  /** Units of stock across every reward in the box. */
  stockTotal: number;
  stockDistributed: number;
  /** Share of the box's combined stock still available. */
  stockLeftPct: number | null;
  /**
   * The scarcest single reward in the box.
   *
   * More useful than the box total: a box can be 99% stocked overall and still
   * have one reward nearly gone, because stock pools differ by orders of
   * magnitude between rewards.
   */
  worstReward: { name: string; leftPct: number; status: StockStatus } | null;
  /** Rewards at or below the warning threshold. */
  stockAlertCount: number;
  spend: number;
  weightSum: number;
  weightWarning: boolean;
  /** The most serious odds verdict across the box's rewards. */
  oddsVerdict: OddsVerdict;
  offTargetCount: number;
  slightCount: number;
  rewards: BoxRewardOdds[];
}

/**
 * Compare an observed share against its configured weight.
 *
 * Uses the standard error of a proportion, so the same absolute gap counts as
 * noise in a box with 50 claims and as a real signal in one with 5,000.
 */
export function oddsVerdictOf(
  weightPct: number,
  claims: number,
  boxClaims: number,
): { actualPct: number | null; deviation: number | null; z: number | null; verdict: OddsVerdict } {
  if (boxClaims < MIN_CLAIMS_FOR_ODDS) {
    return { actualPct: null, deviation: null, z: null, verdict: 'insufficient' };
  }

  const p = weightPct / 100;
  const actual = claims / boxClaims;
  const standardError = Math.sqrt(Math.max(p * (1 - p), 1e-12) / boxClaims);
  const z = standardError > 0 ? (actual - p) / standardError : 0;
  const magnitude = Math.abs(z);

  return {
    actualPct: actual * 100,
    deviation: actual * 100 - weightPct,
    z,
    verdict: magnitude > Z_OFF ? 'off-target' : magnitude > Z_SLIGHT ? 'slight' : 'on-target',
  };
}

/** Weights are stored to 2–3 decimals, so compare with a small tolerance. */
const WEIGHT_TOLERANCE = 0.01;

export function boxSummaries(ds: Dataset): BoxSummary[] {
  const claimsByReward = new Map<number, number>();
  for (const row of ds.dailyRewards) {
    claimsByReward.set(row.reward_id, (claimsByReward.get(row.reward_id) ?? 0) + row.total_claim);
  }
  const claimSnap = new Map(ds.rewardSnapshot.map((r) => [r.reward_id, r]));
  const spendSnap = new Map(ds.spendSnapshot.map((r) => [r.reward_id, r]));

  const rewardsByBox = new Map<number, typeof ds.rewards>();
  for (const reward of ds.rewards) {
    const bucket = rewardsByBox.get(reward.blind_box_id);
    if (bucket) bucket.push(reward);
    else rewardsByBox.set(reward.blind_box_id, [reward]);
  }

  return ds.boxesByStamp.map((box) => {
    const rewards = (rewardsByBox.get(box.id) ?? []).slice();
    const boxClaims = sum(rewards, (r) => claimsByReward.get(r.id) ?? 0);

    const rows: BoxRewardOdds[] = rewards
      .map((reward) => {
        const snap = claimSnap.get(reward.id);
        const spend = spendSnap.get(reward.id);
        const stockTotal = snap?.stock_total ?? reward.stock_total;
        const stockDistributed = snap?.stock_distributed ?? reward.stock_distributed;
        const { pct, status } = stockStatusOf(stockTotal, stockDistributed);
        const claims = claimsByReward.get(reward.id) ?? 0;
        const odds = oddsVerdictOf(reward.weight, claims, boxClaims);

        // Claims are the selected range; redemptions and spend are cumulative,
        // exactly as the Rewards table reads them. Same sources, same rules.
        const couponClaimed = spend?.total_user_claimed ?? 0;
        const redeemed = spend?.total_user_redeemed ?? 0;

        return {
          rewardId: reward.id,
          name: reward.name_en,
          imageUrl: reward.image_url,
          rarity: reward.rarity,
          type: reward.type,
          status: reward.status,
          weight: reward.weight,
          claims,
          cumulativeClaimed: snap?.total_claim ?? 0,
          couponClaimed,
          redeemed,
          redemptionRate: rewardRedemptionRate(reward.type, couponClaimed, redeemed),
          faceValue: spend ? faceValue(spend) : null,
          ...odds,
          stockTotal,
          stockDistributed,
          stockLeftPct: pct,
          stockStatus: status,
          spend: spend?.spend_amount ?? 0,
          value: reward.cashback_value ?? null,
        };
      })
      .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));

    const stockTotal = sum(rows, (r) => r.stockTotal);
    const stockDistributed = sum(rows, (r) => r.stockDistributed);
    const priced = rows.filter((r) => r.stockLeftPct !== null);
    const worst = priced.length
      ? priced.reduce((a, b) => ((a.stockLeftPct ?? 1) <= (b.stockLeftPct ?? 1) ? a : b))
      : null;
    const weightSum = sum(rows, (r) => r.weight);

    const offTargetCount = rows.filter((r) => r.verdict === 'off-target').length;
    const slightCount = rows.filter((r) => r.verdict === 'slight').length;
    const oddsVerdict: OddsVerdict =
      boxClaims < MIN_CLAIMS_FOR_ODDS
        ? 'insufficient'
        : offTargetCount > 0
          ? 'off-target'
          : slightCount > 0
            ? 'slight'
            : 'on-target';

    return {
      boxId: box.id,
      name: box.name_en,
      imageUrl: box.image_url,
      stampRequired: box.stamp_required,
      rewardCount: rows.length,
      claims: boxClaims,
      rewardsClaimed: rows.filter((r) => r.claims > 0).length,
      stockTotal,
      stockDistributed,
      stockLeftPct: stockTotal > 0 ? Math.max(0, 1 - stockDistributed / stockTotal) : null,
      worstReward: worst
        ? { name: worst.name, leftPct: worst.stockLeftPct ?? 0, status: worst.stockStatus }
        : null,
      stockAlertCount: rows.filter((r) => r.stockStatus === 'warning' || r.stockStatus === 'out').length,
      spend: sum(rows, (r) => r.spend),
      weightSum,
      weightWarning: Math.abs(weightSum - 100) > WEIGHT_TOLERANCE,
      oddsVerdict,
      offTargetCount,
      slightCount,
      rewards: rows,
    };
  });
}

/** Boxes whose configured drop odds do not sum to 100. */
export function boxesWithBadWeights(ds: Dataset): BoxSummary[] {
  return boxSummaries(ds).filter((b) => b.weightWarning);
}

/** Boxes where a reward's observed share is unlikely to be chance. */
export function boxesWithOddsDrift(ds: Dataset): BoxSummary[] {
  return boxSummaries(ds).filter((b) => b.oddsVerdict === 'off-target');
}

/**
 * One day of a box's activity, for the Blind boxes daily trend.
 *
 * Claims come from the daily claims export, which is the authority on how many
 * rewards came out of a box — not from the spend export, whose claim columns
 * are only used to judge whether that file is keeping up.
 *
 * Spend is cashback plus coupon. Cashback is read from the spend export where
 * it has figures and reconstructed as `claims × cashback_value` where it does
 * not, exactly as the Budget page does it, so this self-corrects the day the
 * upstream query is fixed. Gacha cashback is deliberately absent: the gacha
 * draw belongs to no box, so including it would stop the per-box numbers
 * summing to the combined view. Campaign-wide spend lives on Budget.
 */
export interface DailyBoxPoint {
  date: string;
  /** Rewards claimed out of the box that day, every reward type. */
  claims: number;
  /** Coupons redeemed at a merchant that day. */
  redeemed: number;
  cashback: number;
  coupon: number;
  /** cashback + coupon. */
  spend: number;
  /** The cashback above is reconstructed, not exported. */
  cashbackDerived: boolean;
  /** The spend export reports far fewer claims than the claims file. */
  incomplete: boolean;
}

/** The daily series for one box, or every box combined when `boxId` is null. */
export function dailyBoxSeries(ds: Dataset, boxId: number | null = null): DailyBoxPoint[] {
  const claimRows = boxId === null
    ? ds.dailyRewards
    : ds.dailyRewards.filter((r) => r.blind_box_id2 === boxId);
  const spendRows = boxId === null
    ? ds.dailySpend
    : ds.dailySpend.filter((r) => ds.boxIdByRewardId.get(r.reward_id) === boxId);

  return ds.dates.map((date) => {
    const claims = claimRows.filter((r) => r.claim_date === date);
    const spend = spendRows.filter((r) => r.date === date);
    const coupons = spend.filter((r) => r.type === 'COUPON');

    const exported = sum(spend.filter((r) => r.type === 'CASHBACK'), (r) => r.spend_amount);
    const cashbackDerived = exported <= 0;
    const cashback = cashbackDerived
      ? sum(
          claims.filter((r) => r.reward_type === 'CASHBACK'),
          (r) => r.total_claim * (r.cashback_value ?? 0),
        )
      : exported;
    const coupon = sum(coupons, (r) => r.spend_amount);

    return {
      date,
      claims: sum(claims, (r) => r.total_claim),
      redeemed: sum(coupons, (r) => r.total_user_redeemed),
      cashback,
      coupon,
      spend: cashback + coupon,
      cashbackDerived,
      incomplete: isDailySpendIncomplete(spend, sum(claims, (r) => r.total_claim)),
    };
  });
}
