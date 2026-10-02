/**
 * The single source of truth for CSV file handling: which filename prefix maps
 * to which file type, what columns that type must have, how it loads into D1,
 * and which table it targets.
 *
 * Nothing else in the codebase may hardcode a prefix or a column name.
 */

export type FileTypeId =
  | 'daily_gacha'
  | 'daily_rewards'
  | 'reward_snapshot'
  | 'daily_spend'
  | 'spend_snapshot'
  | 'activity_snapshot'
  | 'reach_snapshot'
  | 'blindbox_reward'
  | 'activity_list'
  | 'blindbox';

/** `replace` wipes the table and reloads it; `snapshot` appends one export. */
export type LoadMode = 'replace' | 'snapshot';

export interface FileTypeDef {
  id: FileTypeId;
  /** Canonical filename prefix. Shown in the UI and used for detection. */
  prefix: string;
  /**
   * Older prefixes still accepted for this type, so exports saved under a
   * previous naming convention can still be uploaded. Safe to delete once no
   * archived files use them.
   */
  legacyPrefixes?: string[];
  label: string;
  table: string;
  mode: LoadMode;
  /** Part of the regular upload, as opposed to occasional reference data. */
  group: 'daily' | 'reference';
  requiredColumns: string[];
  /** Column holding the date, for daily files. */
  dateColumn?: string;
}

/**
 * ORDER IS LOAD-BEARING. Detection walks this list top to bottom and takes the
 * first prefix match. `blindbox_` is the short prefix that matches everything
 * starting `blindbox_`, so every more specific name that shares it —
 * `blindbox_reach_` and `blindbox_reward_` — has to be tested before it. A reach
 * file read as `blindbox_` would fail column validation today, but would still
 * be a confusing error for a file that is perfectly valid.
 *
 * The two spend prefixes are deliberately shorter than the filenames they
 * match: the exporter currently writes `daily_spent_reward_result_...`, and
 * since matching is by prefix, `daily_spent_reward_` picks up both that and a
 * future `daily_spent_reward_...` without the `_result_` part.
 */
export const FILE_TYPES: readonly FileTypeDef[] = [
  {
    id: 'daily_gacha',
    prefix: 'daily_claim_gatcha_',
    label: 'Daily gacha claims',
    table: 'daily_gacha',
    mode: 'replace',
    group: 'daily',
    dateColumn: 'claim_date',
    requiredColumns: ['claim_date', 'total_claim', 'total_claim_user', 'cashback_amount'],
  },
  {
    id: 'daily_rewards',
    prefix: 'daily_claim_rewards_',
    label: 'Daily box reward claims',
    table: 'daily_rewards',
    mode: 'replace',
    group: 'daily',
    dateColumn: 'claim_date',
    requiredColumns: [
      'claim_date',
      'blind_box_id2',
      'stamp_required',
      'reward_id',
      'reward_name',
      'reward_type',
      'total_claim',
      'total_claim_user',
    ],
  },
  {
    id: 'reward_snapshot',
    prefix: 'total_claim_rewards_',
    label: 'Cumulative reward claims & stock',
    table: 'reward_snapshots',
    mode: 'snapshot',
    group: 'daily',
    requiredColumns: [
      'blind_box_id2',
      'stamp_required',
      'reward_id',
      'reward_name',
      'reward_type',
      'stock_total',
      'stock_distributed',
      'total_claim',
    ],
  },
  {
    id: 'daily_spend',
    prefix: 'daily_spent_reward_',
    label: 'Daily spend & redemption',
    table: 'daily_spend',
    mode: 'replace',
    group: 'daily',
    dateColumn: 'date_temp',
    requiredColumns: [
      'date_temp',
      'id',
      'name_en',
      'type',
      'total_user_claimed',
      'total_user_redeemed',
      'spend_amount',
    ],
  },
  {
    id: 'spend_snapshot',
    prefix: 'total_spent_reward_',
    // This export used to be written with hyphens. Still accepted so older
    // files can be re-uploaded.
    legacyPrefixes: ['total-spend-reward_result_', 'total-spend-reward_'],
    label: 'Cumulative spend & redemption',
    table: 'spend_snapshots',
    mode: 'snapshot',
    group: 'daily',
    requiredColumns: [
      'id',
      'name_en',
      'type',
      'coupon_ref_id',
      'total_user_claimed',
      'total_user_redeemed',
      'spend_amount',
    ],
  },
  {
    id: 'activity_snapshot',
    prefix: 'activity_level_',
    label: 'Activity level',
    table: 'activity_snapshots',
    mode: 'snapshot',
    group: 'daily',
    // `stamp_ditributed` is spelled that way in the source export.
    requiredColumns: ['ref_id', 'customer_id', 'transaction_id', 'stamp_ditributed'],
  },
  {
    id: 'reach_snapshot',
    // Must precede `blindbox_` — see the ordering note above.
    prefix: 'blindbox_reach_',
    label: 'Blind box reach',
    table: 'reach_snapshots',
    mode: 'snapshot',
    group: 'daily',
    requiredColumns: ['is_onboard_yn', 'box_stamp', 'mdc_id'],
  },
  {
    id: 'blindbox_reward',
    prefix: 'blindbox_reward_',
    label: 'Reward reference data',
    table: 'blindbox_reward',
    mode: 'replace',
    group: 'reference',
    requiredColumns: [
      'id',
      'blind_box_id',
      'name_en',
      'rarity',
      'type',
      'weight',
      'stock_total',
      'stock_distributed',
    ],
  },
  {
    id: 'activity_list',
    prefix: 'activity_list_',
    label: 'Activity reference data',
    table: 'activity',
    mode: 'replace',
    group: 'reference',
    requiredColumns: ['id', 'quest_id', 'name_en', 'reward_stamp'],
  },
  {
    id: 'blindbox',
    prefix: 'blindbox_',
    label: 'Box reference data',
    table: 'blindbox',
    mode: 'replace',
    group: 'reference',
    requiredColumns: ['id', 'name_en', 'image_url'],
  },
] as const;

export const DAILY_FILE_TYPES = FILE_TYPES.filter((f) => f.group === 'daily');
export const REFERENCE_FILE_TYPES = FILE_TYPES.filter((f) => f.group === 'reference');

export function fileTypeById(id: FileTypeId): FileTypeDef {
  const def = FILE_TYPES.find((f) => f.id === id);
  if (!def) throw new Error(`Unknown file type: ${id}`);
  return def;
}

/** Campaign launch. Earlier rows are pre-launch tests and hidden by default. */
export const LAUNCH_DATE = '2026-09-15';

/** Campaign close — the last day a reward can be claimed or redeemed. */
export const CAMPAIGN_END_DATE = '2026-12-01';

/** All source data is Jakarta time; nothing here is ever UTC. */
export const TIMEZONE_LABEL = 'WIB';
export const TIMEZONE_OFFSET_HOURS = 7;

/** Stock is "warning" at or below this share remaining, "out" at zero. */
export const STOCK_WARNING_THRESHOLD = 0.1;
