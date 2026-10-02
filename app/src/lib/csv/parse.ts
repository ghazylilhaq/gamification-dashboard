import type { FileTypeId } from '../../config/fileTypes';

export type RawRow = Record<string, string | undefined>;

/** Empty strings are common in these exports and must read as 0, not NaN. */
export function num(v: string | undefined | null): number {
  if (v === undefined || v === null) return 0;
  const t = String(v).trim();
  if (t === '') return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

export function int(v: string | undefined | null): number {
  return Math.trunc(num(v));
}

export function str(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

/** Dates arrive as 'YYYY-MM-DD' or a full ISO timestamp; keep the date part. */
export function dateOnly(v: string | undefined | null): string {
  const t = str(v) ?? '';
  return t.slice(0, 10);
}

/**
 * Parse a reach bucket label into the box number it represents.
 *
 *   '<10 stamp'    -> 0   (not yet reached the first box)
 *   'Reach box 3'  -> 3
 *
 * Returns null for anything else. A null must reject the file: silently
 * mapping an unfamiliar label to 0 would move those users into the wrong
 * bucket and skew every figure built on the funnel.
 */
export function reachBucket(label: string | undefined | null): number | null {
  const text = (label ?? '').trim();
  if (/^<\s*10\s*stamps?$/i.test(text)) return 0;
  const match = text.match(/^reach\s+box\s+(\d{1,2})$/i);
  if (!match) return null;
  const box = Number(match[1]);
  return box >= 1 && box <= 12 ? box : null;
}

/** 'Y' / 'N', or null for anything the export should never contain. */
export function onboardFlag(value: string | undefined | null): 'Y' | 'N' | null {
  const text = (value ?? '').trim().toUpperCase();
  return text === 'Y' || text === 'N' ? text : null;
}

/**
 * Row-level problems that column validation cannot see. Used by the browser
 * before upload and by the server before publish, so a bad file is rejected
 * the same way on both sides.
 */
export function rowErrors(type: FileTypeId, rows: RawRow[]): string[] {
  if (type !== 'reach_snapshot') return [];

  const errors: string[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const bucket = reachBucket(r['box_stamp']);
    const flag = onboardFlag(r['is_onboard_yn']);
    if (bucket === null) errors.push(`Line ${line}: unrecognised box_stamp "${r['box_stamp'] ?? ''}"`);
    if (flag === null) errors.push(`Line ${line}: is_onboard_yn must be Y or N, got "${r['is_onboard_yn'] ?? ''}"`);
    if (bucket !== null && flag !== null) {
      const key = `${flag}:${bucket}`;
      if (seen.has(key)) errors.push(`Line ${line}: duplicate bucket ${r['box_stamp']} for onboard ${flag}`);
      seen.add(key);
    }
  });
  return errors;
}

/**
 * Normalise one CSV row into the column order its D1 table expects.
 *
 * This is where the spec's two renames happen, both on the spend files:
 *   date_temp -> date, id -> reward_id.
 * Note also that `blind_box_id2` is read for the claim files (where it is
 * 13-24) and deliberately dropped for the spend files (where it is 1-12 and
 * joining on it would attribute every reward to the wrong box).
 */
export function normaliseRow(
  type: FileTypeId,
  r: RawRow,
  exportAt: string,
): (string | number | null)[] {
  switch (type) {
    case 'daily_gacha':
      return [dateOnly(r['claim_date']), int(r['total_claim']), int(r['total_claim_user']), num(r['cashback_amount']), exportAt];

    case 'daily_rewards':
      return [
        dateOnly(r['claim_date']), int(r['reward_id']), int(r['blind_box_id2']), str(r['program_id']),
        int(r['stamp_required']), str(r['reward_name']), str(r['reward_type']), num(r['cashback_value']),
        int(r['stock_total']), int(r['stock_distributed']), int(r['total_claim']), int(r['total_claim_user']), exportAt,
      ];

    case 'reward_snapshot':
      return [
        exportAt, int(r['reward_id']), int(r['blind_box_id2']), str(r['program_id']), int(r['stamp_required']),
        str(r['reward_name']), str(r['reward_type']), num(r['cashback_value']), int(r['stock_total']),
        int(r['stock_distributed']), int(r['total_claim']), int(r['total_claim_user']),
      ];

    case 'daily_spend':
      // date_temp -> date, id -> reward_id. blind_box_id2 intentionally dropped.
      return [
        dateOnly(r['date_temp']), int(r['id']), str(r['program_id']), str(r['name_en']), str(r['type']),
        str(r['coupon_ref_id']), int(r['total_user_claimed']), int(r['total_user_redeemed']),
        num(r['spend_amount']), exportAt,
      ];

    case 'spend_snapshot':
      // id -> reward_id. blind_box_id2 intentionally dropped.
      return [
        exportAt, int(r['id']), str(r['program_id']), str(r['name_en']), str(r['type']), str(r['coupon_ref_id']),
        int(r['stock_total']), int(r['stock_distributed']), int(r['total_user_claimed']),
        int(r['total_user_redeemed']), num(r['spend_amount']),
      ];

    case 'activity_snapshot':
      // customer_id / transaction_id / stamp_ditributed are counts in the
      // source despite their names; stored as customers / transactions /
      // stamps_distributed.
      return [
        exportAt, str(r['ref_id']), str(r['program_id']), int(r['customer_id']),
        int(r['transaction_id']), int(r['stamp_ditributed']),
      ];

    case 'reach_snapshot':
      // rowErrors has already rejected any row whose label does not parse.
      return [
        exportAt, onboardFlag(r['is_onboard_yn']), reachBucket(r['box_stamp']),
        str(r['box_stamp']), str(r['program_id']), int(r['mdc_id']),
      ];

    case 'activity_list':
      return [
        str(r['id']), int(r['quest_id']), str(r['name_en']?.replace(/\s+/g, ' ')),
        str(r['name_bs']?.replace(/\s+/g, ' ')), str(r['description_en']),
        str(r['description_bs']), int(r['reward_stamp']), num(r['min_amount_transaction']),
        str(r['is_same_merchant_limit_yn']), int(r['daily_merchant_limit']),
        str(r['saver_user_type']), str(r['tnc_tag']), str(r['source_of_fund']),
        str(r['nominal_type']), str(r['created_time']), str(r['updated_time']), exportAt,
      ];

    case 'blindbox':
      return [
        int(r['id']), str(r['name_en']), str(r['name_bs']), str(r['description_en']), str(r['description_bs']),
        str(r['image_url']), str(r['claimed_image_url']), str(r['open_image_url']), str(r['locked_image_url']),
        str(r['not_eligible_image_url']), str(r['created_time']), str(r['updated_time']), exportAt,
      ];

    case 'blindbox_reward':
      return [
        int(r['id']), int(r['blind_box_id']), str(r['name_en']), str(r['name_bs']), str(r['description_en']),
        str(r['rarity']), str(r['type']), num(r['weight']), str(r['image_url']), int(r['stock_total']),
        int(r['stock_distributed']), int(r['stock_bound']), str(r['coupon_ref_id']), num(r['cashback_value']),
        str(r['status']), str(r['is_active_yn']), int(r['fallback_sort']), str(r['order_id']),
        str(r['created_time']), str(r['updated_time']), exportAt,
      ];
  }
}

/** Column list per table, matching normaliseRow's output order exactly. */
export const TABLE_COLUMNS: Record<FileTypeId, string[]> = {
  daily_gacha: ['claim_date', 'total_claim', 'total_claim_user', 'cashback_amount', 'source_export_at'],
  daily_rewards: [
    'claim_date', 'reward_id', 'blind_box_id2', 'program_id', 'stamp_required', 'reward_name',
    'reward_type', 'cashback_value', 'stock_total', 'stock_distributed', 'total_claim',
    'total_claim_user', 'source_export_at',
  ],
  reward_snapshot: [
    'snapshot_at', 'reward_id', 'blind_box_id2', 'program_id', 'stamp_required', 'reward_name',
    'reward_type', 'cashback_value', 'stock_total', 'stock_distributed', 'total_claim', 'total_claim_user',
  ],
  daily_spend: [
    'date', 'reward_id', 'program_id', 'name_en', 'type', 'coupon_ref_id', 'total_user_claimed',
    'total_user_redeemed', 'spend_amount', 'source_export_at',
  ],
  spend_snapshot: [
    'snapshot_at', 'reward_id', 'program_id', 'name_en', 'type', 'coupon_ref_id', 'stock_total',
    'stock_distributed', 'total_user_claimed', 'total_user_redeemed', 'spend_amount',
  ],
  activity_snapshot: [
    'snapshot_at', 'ref_id', 'program_id', 'customers', 'transactions', 'stamps_distributed',
  ],
  reach_snapshot: ['snapshot_at', 'is_onboard', 'box_bucket', 'box_label', 'program_id', 'users'],
  activity_list: [
    'id', 'quest_id', 'name_en', 'name_bs', 'description_en', 'description_bs', 'reward_stamp',
    'min_amount_transaction', 'is_same_merchant_limit_yn', 'daily_merchant_limit',
    'saver_user_type', 'tnc_tag', 'source_of_fund', 'nominal_type', 'created_time',
    'updated_time', 'source_export_at',
  ],
  blindbox: [
    'id', 'name_en', 'name_bs', 'description_en', 'description_bs', 'image_url', 'claimed_image_url',
    'open_image_url', 'locked_image_url', 'not_eligible_image_url', 'created_time', 'updated_time',
    'source_export_at',
  ],
  blindbox_reward: [
    'id', 'blind_box_id', 'name_en', 'name_bs', 'description_en', 'rarity', 'type', 'weight', 'image_url',
    'stock_total', 'stock_distributed', 'stock_bound', 'coupon_ref_id', 'cashback_value', 'status',
    'is_active_yn', 'fallback_sort', 'order_id', 'created_time', 'updated_time', 'source_export_at',
  ],
};

/** Date range covered by a parsed file, for the upload preview. */
export function dateRangeOf(type: FileTypeId, rows: RawRow[]): { from: string; to: string } | null {
  const col = type === 'daily_spend' ? 'date_temp' : type === 'daily_gacha' || type === 'daily_rewards' ? 'claim_date' : null;
  if (!col) return null;
  const dates = rows.map((r) => dateOnly(r[col])).filter(Boolean).sort();
  if (dates.length === 0) return null;
  return { from: dates[0]!, to: dates[dates.length - 1]! };
}
