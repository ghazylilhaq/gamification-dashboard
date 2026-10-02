/** Row shapes as stored in D1 and returned by /api/bootstrap. */

export interface BlindBox {
  id: number;
  name_en: string;
  name_bs: string | null;
  description_en: string | null;
  image_url: string | null;
  claimed_image_url: string | null;
  open_image_url: string | null;
  locked_image_url: string | null;
  not_eligible_image_url: string | null;
  source_export_at: string;
}

export type Rarity = 'COMMON' | 'RARE' | 'SUPER_RARE';
export type RewardType = 'CASHBACK' | 'COUPON';

export interface BlindBoxReward {
  id: number;
  blind_box_id: number;
  name_en: string;
  rarity: Rarity | string;
  type: RewardType | string;
  weight: number;
  image_url: string | null;
  stock_total: number;
  stock_distributed: number;
  coupon_ref_id: string | null;
  cashback_value: number | null;
  status: string | null;
  is_active_yn: string | null;
  source_export_at: string;
}

export interface DailyGacha {
  claim_date: string;
  total_claim: number;
  /** Genuine unique users for this day. Never sum across days. */
  total_claim_user: number;
  cashback_amount: number;
  source_export_at: string;
}

export interface DailyReward {
  claim_date: string;
  reward_id: number;
  blind_box_id2: number;
  stamp_required: number;
  reward_name: string;
  reward_type: string;
  cashback_value: number | null;
  total_claim: number;
  /** Per reward. Summing this across rewards double-counts people. */
  total_claim_user: number;
  source_export_at: string;
}

export interface RewardSnapshot {
  snapshot_at: string;
  reward_id: number;
  blind_box_id2: number;
  stamp_required: number;
  reward_name: string;
  reward_type: string;
  stock_total: number;
  stock_distributed: number;
  total_claim: number;
  total_claim_user: number;
}

export interface DailySpend {
  date: string;
  reward_id: number;
  name_en: string;
  type: string;
  coupon_ref_id: string | null;
  total_user_claimed: number;
  total_user_redeemed: number;
  spend_amount: number;
  source_export_at: string;
}

export interface SpendSnapshot {
  snapshot_at: string;
  reward_id: number;
  name_en: string;
  type: string;
  coupon_ref_id: string | null;
  stock_total: number;
  stock_distributed: number;
  total_user_claimed: number;
  total_user_redeemed: number;
  spend_amount: number;
}

/** One stamp-earning activity, from activity_list. */
export interface Activity {
  id: string;
  quest_id: number;
  name_en: string;
  name_bs: string | null;
  description_en: string | null;
  reward_stamp: number;
  min_amount_transaction: number | null;
  source_of_fund: string | null;
  nominal_type: string | null;
  source_export_at: string;
}

/** Cumulative totals for one activity, from one activity_level export. */
export interface ActivitySnapshot {
  snapshot_at: string;
  ref_id: string;
  /** Distinct customers for THIS activity. Summing across activities double-counts. */
  customers: number;
  transactions: number;
  stamps_distributed: number;
}

/**
 * Users whose highest reached box is `box_bucket`, from one blindbox_reach
 * export. Buckets are exclusive, so summing them gives a real unique count.
 */
export interface ReachSnapshot {
  snapshot_at: string;
  /** 'Y' has opened the blindbox page; 'N' has not. */
  is_onboard: 'Y' | 'N';
  /** 0 = under 10 stamps; 1..12 = highest box reached. */
  box_bucket: number;
  box_label: string;
  users: number;
}

export interface PageVisitors {
  id: number;
  value: number;
  as_of: string;
  note: string | null;
  updated_by: string;
  updated_at: string;
}

export interface UploadRecord {
  id: number;
  uploaded_at: string;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  export_at: string | null;
  row_count: number;
  status: string;
  error: string | null;
  batch_id: string | null;
}

/** Everything the UI needs, fetched in a single call. */
export interface Bootstrap {
  boxes: BlindBox[];
  rewards: BlindBoxReward[];
  dailyGacha: DailyGacha[];
  dailyRewards: DailyReward[];
  dailySpend: DailySpend[];
  /** Latest and previous export of total_claim_rewards. */
  rewardSnapshot: RewardSnapshot[];
  prevRewardSnapshot: RewardSnapshot[];
  /** Latest and previous export of total_spent_reward. */
  spendSnapshot: SpendSnapshot[];
  prevSpendSnapshot: SpendSnapshot[];
  activities: Activity[];
  activitySnapshot: ActivitySnapshot[];
  prevActivitySnapshot: ActivitySnapshot[];
  reachSnapshot: ReachSnapshot[];
  prevReachSnapshot: ReachSnapshot[];
  freshness: Freshness;
}

/** Latest export timestamp per source, so each section can date itself. */
export interface Freshness {
  daily_gacha: string | null;
  daily_rewards: string | null;
  reward_snapshot: string | null;
  daily_spend: string | null;
  spend_snapshot: string | null;
  prev_reward_snapshot: string | null;
  prev_spend_snapshot: string | null;
  activity_snapshot: string | null;
  prev_activity_snapshot: string | null;
  reach_snapshot: string | null;
  prev_reach_snapshot: string | null;
}
