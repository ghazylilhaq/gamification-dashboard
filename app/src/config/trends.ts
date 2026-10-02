/**
 * Settings for the Daily trends page — the one place to change how users are
 * segmented and what counts as an unusual day.
 */

/**
 * Stamp tiers: the 12 boxes grouped by how far up the ladder a user has got.
 * Numbers are box positions in stamp order (1 = Welcome Box, 12 = the 300-stamp
 * box), the same numbering blindbox_reach uses. Users under 10 stamps are not a
 * tier: at ~300.000 they would flatten every other band, so the page reports
 * them as a number instead.
 *
 * Changing the cut points is safe — labels and stamp ranges are derived from
 * the box data. Keep the tiers contiguous and covering 1–12, and keep it to
 * five: the colours are a validated five-step ramp (--color-tier-1..5).
 */
export const BOX_TIERS: ReadonlyArray<{ from: number; to: number }> = [
  { from: 1, to: 2 },
  { from: 3, to: 4 },
  { from: 5, to: 6 },
  { from: 7, to: 9 },
  { from: 10, to: 12 },
];

/**
 * The login activity is "available once per day", so the day-over-day rise in
 * its transaction count is the number of users who logged in that day — the
 * closest thing the exports have to daily active users.
 */
export const DAILY_LOGIN_ACTIVITY_ID = 'IGAME_DAILY_LOGIN';

/** How many earlier days the "vs 7-day average" baseline uses. */
export const BASELINE_DAYS = 7;

/** Fewer earlier days than this and there is no baseline to compare with. */
export const MIN_BASELINE_DAYS = 3;

/** A day this far above or below its baseline is flagged as unusual. */
export const UNUSUAL_CHANGE = 0.3;

/**
 * Baselines smaller than this are too noisy to flag: 2 against an average of 1
 * is +100% and means nothing.
 */
export const UNUSUAL_MIN_BASELINE = 20;

/** Days shown in the per-box tables and sparklines. */
export const TABLE_DAYS = 14;
