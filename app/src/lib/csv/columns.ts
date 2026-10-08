import type { CsvColumn } from './export';
import type { RewardRow } from '@/lib/metrics/rewards';
import type { CouponRow } from '@/lib/metrics/redemption';
import type { CashbackRow, BudgetTypeRow, BudgetBoxRow, DailyBudgetPoint } from '@/lib/metrics/budget';
import type { BoxSummary, BoxRewardOdds, DailyBoxPoint } from '@/lib/metrics/boxes';
import type { GachaPoint } from '@/lib/metrics/gacha';
import type { DailyClaimPoint } from '@/lib/metrics/claims';
import type { ActivityRow } from '@/lib/metrics/activity';
import type { ReachFunnelStep } from '@/lib/metrics/reach';

/**
 * Column definitions for every export.
 *
 * Kept together so the same concept is named the same way in every file: ids
 * are `reward_id` / `box_id` exactly as the source exports spell them, money is
 * `(IDR)`, shares are `(%)`, and every percentage is a number out of 100 rather
 * than a fraction.
 */

/** Percentages leave here as 4.31, not 0.0431 — spreadsheets format, not parse. */
const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? null : value * 100;

export const rewardColumns: CsvColumn<RewardRow>[] = [
  { header: 'reward_id', value: (r) => r.rewardId },
  { header: 'reward_name', value: (r) => r.name },
  { header: 'box_id', value: (r) => r.boxId },
  { header: 'box_name', value: (r) => r.boxName },
  { header: 'stamp_required', value: (r) => r.stampRequired },
  { header: 'rarity', value: (r) => r.rarity },
  { header: 'type', value: (r) => r.type },
  { header: 'status', value: (r) => r.status },
  { header: 'weight (%)', value: (r) => r.weight },
  { header: 'stock_total', value: (r) => r.stockTotal },
  { header: 'stock_distributed', value: (r) => r.stockDistributed },
  { header: 'stock_left (%)', value: (r) => pct(r.stockLeftPct) },
  { header: 'stock_status', value: (r) => r.stockStatus },
  { header: 'claims_in_range', value: (r) => r.claimed },
  { header: 'claims_cumulative', value: (r) => r.cumulativeClaimed },
  { header: 'coupons_claimed_cumulative', value: (r) => r.couponClaimed },
  { header: 'redeemed_cumulative', value: (r) => r.redeemed },
  // Cashback is auto-credited, so it has no rate rather than a rate of 100.
  { header: 'redemption_rate (%)', value: (r) => pct(r.redemptionRate) },
  { header: 'spend (IDR)', value: (r) => r.spend },
  { header: 'face_value (IDR)', value: (r) => r.faceValue },
  { header: 'change_spend_since_last_snapshot (IDR)', value: (r) => r.change?.spend ?? null },
];

export const couponColumns: CsvColumn<CouponRow>[] = [
  { header: 'reward_id', value: (r) => r.rewardId },
  { header: 'coupon_name', value: (r) => r.name },
  { header: 'box_name', value: (r) => r.boxName },
  { header: 'merchant', value: (r) => r.merchant },
  { header: 'coupon_ref_id', value: (r) => r.couponRefId },
  { header: 'claimed', value: (r) => r.claimed },
  { header: 'redeemed', value: (r) => r.redeemed },
  { header: 'redemption_rate (%)', value: (r) => pct(r.rate) },
  { header: 'spend (IDR)', value: (r) => r.spend },
  { header: 'face_value (IDR)', value: (r) => r.averageFaceValue },
];

export const cashbackColumns: CsvColumn<CashbackRow>[] = [
  { header: 'reward_id', value: (r) => r.rewardId },
  { header: 'reward_name', value: (r) => r.name },
  { header: 'box_name', value: (r) => r.boxName },
  { header: 'credited', value: (r) => r.credited },
  { header: 'spend (IDR)', value: (r) => r.spend },
  { header: 'average_per_credit (IDR)', value: (r) => r.averagePerCredit },
  { header: 'configured_value (IDR)', value: (r) => r.configuredValue },
];

export const budgetTypeColumns: CsvColumn<BudgetTypeRow>[] = [
  { header: 'type', value: (r) => r.type },
  { header: 'label', value: (r) => r.label },
  { header: 'claimed', value: (r) => r.claimed },
  { header: 'paid_out', value: (r) => r.units },
  { header: 'unit', value: (r) => r.unitLabel },
  { header: 'redemption_rate (%)', value: (r) => pct(r.redemptionRate) },
  { header: 'spend (IDR)', value: (r) => r.spend },
  { header: 'average_per_unit (IDR)', value: (r) => r.averagePerUnit },
  { header: 'share_of_budget (%)', value: (r) => pct(r.share) },
];

export const budgetBoxColumns: CsvColumn<BudgetBoxRow>[] = [
  { header: 'box_id', value: (r) => r.boxId },
  { header: 'box_name', value: (r) => r.boxName },
  { header: 'stamp_required', value: (r) => r.stampRequired },
  { header: 'cashback_spend (IDR)', value: (r) => r.cashback },
  { header: 'coupon_spend (IDR)', value: (r) => r.coupon },
  { header: 'total_spend (IDR)', value: (r) => r.total },
  { header: 'share_of_box_spend (%)', value: (r) => pct(r.share) },
];

export const dailyBudgetColumns: CsvColumn<DailyBudgetPoint>[] = [
  { header: 'date', value: (r) => r.date },
  { header: 'box_cashback (IDR)', value: (r) => r.cashback },
  // Says so in the file, because the number changes meaning otherwise.
  { header: 'box_cashback_source', value: (r) => (r.cashbackDerived ? 'derived from claims' : 'spend export') },
  { header: 'coupon_spend (IDR)', value: (r) => r.coupon },
  { header: 'gacha_cashback (IDR)', value: (r) => r.gacha },
  { header: 'total (IDR)', value: (r) => r.total },
  { header: 'cumulative (IDR)', value: (r) => r.cumulative },
  { header: 'box_spend_incomplete', value: (r) => r.incomplete },
];

export const dailyClaimColumns: CsvColumn<DailyClaimPoint>[] = [
  { header: 'date', value: (r) => r.date },
  { header: 'box_claims', value: (r) => r.boxClaims },
  { header: 'gacha_claims', value: (r) => r.gachaClaims },
  { header: 'total_spend (IDR)', value: (r) => r.totalSpend },
  { header: 'partial_day', value: (r) => r.isPartial },
];

export const gachaColumns: CsvColumn<GachaPoint>[] = [
  { header: 'date', value: (r) => r.date },
  { header: 'claims', value: (r) => r.claims },
  // Named to prevent it being summed into a campaign total, which it is not.
  { header: 'users_claiming_that_day', value: (r) => r.users },
  { header: 'cashback (IDR)', value: (r) => r.cashback },
  { header: 'cumulative_cashback (IDR)', value: (r) => r.cumulativeCashback },
];

/**
 * The Blind boxes daily trend, one row per date.
 *
 * Takes the metric selection so the file matches the chart on screen rather
 * than silently widening: an empty selection is the combined view and writes
 * all three. Spend is always split into its cashback and coupon halves, since
 * the two are not equally trustworthy, and the two flag columns say which days
 * to treat with care — a reader summing the spend column in a spreadsheet
 * would otherwise have no way to know.
 */
export function dailyTrendColumns(
  metrics: Array<'claims' | 'redeemed' | 'spend'> = [],
): CsvColumn<DailyBoxPoint>[] {
  const show = (m: 'claims' | 'redeemed' | 'spend') =>
    metrics.length === 0 || metrics.includes(m);

  return [
    { header: 'date', value: (r) => r.date },
    ...(show('claims')
      ? [{ header: 'box_claims', value: (r: DailyBoxPoint) => r.claims }]
      : []),
    ...(show('redeemed')
      ? [{ header: 'coupons_redeemed', value: (r: DailyBoxPoint) => r.redeemed }]
      : []),
    ...(show('spend')
      ? [
          { header: 'spend (IDR)', value: (r: DailyBoxPoint) => r.spend },
          { header: 'cashback_spend (IDR)', value: (r: DailyBoxPoint) => r.cashback },
          { header: 'coupon_spend (IDR)', value: (r: DailyBoxPoint) => r.coupon },
          { header: 'cashback_reconstructed', value: (r: DailyBoxPoint) => r.cashbackDerived },
        ]
      : []),
    { header: 'spend_data_incomplete', value: (r) => r.incomplete },
  ];
}

export const boxColumns: CsvColumn<BoxSummary>[] = [
  { header: 'box_id', value: (r) => r.boxId },
  { header: 'box_name', value: (r) => r.name },
  { header: 'stamp_required', value: (r) => r.stampRequired },
  { header: 'reward_count', value: (r) => r.rewardCount },
  { header: 'claims_in_range', value: (r) => r.claims },
  { header: 'rewards_claimed', value: (r) => r.rewardsClaimed },
  { header: 'spend (IDR)', value: (r) => r.spend },
  { header: 'stock_total', value: (r) => r.stockTotal },
  { header: 'stock_distributed', value: (r) => r.stockDistributed },
  { header: 'stock_left (%)', value: (r) => pct(r.stockLeftPct) },
  { header: 'scarcest_reward', value: (r) => r.worstReward?.name ?? null },
  { header: 'scarcest_reward_stock_left (%)', value: (r) => pct(r.worstReward?.leftPct) },
  { header: 'stock_alerts', value: (r) => r.stockAlertCount },
  { header: 'weight_sum (%)', value: (r) => r.weightSum },
  { header: 'weight_ok', value: (r) => !r.weightWarning },
  { header: 'odds_verdict', value: (r) => r.oddsVerdict },
];

export const boxRewardColumns: CsvColumn<BoxRewardOdds>[] = [
  { header: 'reward_id', value: (r) => r.rewardId },
  { header: 'reward_name', value: (r) => r.name },
  { header: 'rarity', value: (r) => r.rarity },
  { header: 'type', value: (r) => r.type },
  { header: 'configured_weight (%)', value: (r) => r.weight },
  { header: 'actual_share (%)', value: (r) => r.actualPct },
  { header: 'deviation (pts)', value: (r) => r.deviation },
  // In standard errors, so the gap can be read against the sample size.
  { header: 'deviation (standard_errors)', value: (r) => r.z },
  { header: 'odds_verdict', value: (r) => r.verdict },
  { header: 'claims_in_range', value: (r) => r.claims },
  { header: 'claims_cumulative', value: (r) => r.cumulativeClaimed },
  { header: 'stock_total', value: (r) => r.stockTotal },
  { header: 'stock_distributed', value: (r) => r.stockDistributed },
  { header: 'stock_left (%)', value: (r) => pct(r.stockLeftPct) },
  { header: 'coupons_claimed_cumulative', value: (r) => r.couponClaimed },
  { header: 'redeemed_cumulative', value: (r) => r.redeemed },
  // Cashback is auto-credited, so it has no rate rather than a rate of 100.
  { header: 'redemption_rate (%)', value: (r) => pct(r.redemptionRate) },
  { header: 'spend (IDR)', value: (r) => r.spend },
  { header: 'face_value (IDR)', value: (r) => r.faceValue },
];

export const activityColumns: CsvColumn<ActivityRow>[] = [
  { header: 'activity_id', value: (r) => r.id },
  { header: 'activity_name', value: (r) => r.name },
  { header: 'quest_id', value: (r) => r.questId },
  { header: 'quest', value: (r) => r.quest },
  { header: 'reward_stamp', value: (r) => r.rewardStamp },
  // Distinct customers for this activity alone — summing the column across
  // activities counts the same person many times over.
  { header: 'customers_this_activity', value: (r) => r.customers },
  { header: 'transactions', value: (r) => r.transactions },
  { header: 'stamps_distributed', value: (r) => r.stamps },
  { header: 'expected_stamps', value: (r) => r.expectedStamps },
  { header: 'stamps_reconcile', value: (r) => r.reconciles },
  { header: 'share_of_stamps (%)', value: (r) => r.stampShare * 100 },
  { header: 'stamps_per_customer', value: (r) => r.stampsPerCustomer },
  { header: 'change_transactions_since_last_snapshot', value: (r) => r.change?.transactions ?? null },
];

/**
 * The reach export keeps both readings of the same data, named so the
 * difference survives into a spreadsheet: `highest_box` columns are exclusive
 * and can be summed; `reached_at_least` columns are cumulative and cannot.
 */
export type ReachExportRow = ReachFunnelStep & {
  boxName: string;
  claims: number;
  claimRate: number | null;
  claimRateApproximate: boolean;
};

export const reachColumns: CsvColumn<ReachExportRow>[] = [
  { header: 'box_number', value: (r) => r.box },
  { header: 'box_name', value: (r) => r.boxName },
  { header: 'users_highest_box_onboard_y', value: (r) => r.atY },
  { header: 'users_highest_box_onboard_n', value: (r) => r.atN },
  { header: 'users_reached_at_least_onboard_y', value: (r) => r.reachedY },
  { header: 'users_reached_at_least_onboard_n', value: (r) => r.reachedN },
  { header: 'users_reached_at_least_total', value: (r) => r.reached },
  { header: 'box_claims_since_launch', value: (r) => r.claims },
  // Claims ÷ onboarded users reached. Approximate when the claims and reach
  // exports are from different days — the next column says so.
  { header: 'claim_rate (%)', value: (r) => pct(r.claimRate) },
  { header: 'claim_rate_approximate', value: (r) => r.claimRateApproximate },
];
