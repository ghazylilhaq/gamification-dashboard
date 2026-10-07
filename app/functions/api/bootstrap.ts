import { json, serverError, type Env } from './_shared/env';
import { canUpload, hasAdminPassword, isLocalDev, viewerEmail } from './_shared/auth';

/**
 * Everything the dashboard reads, in one request.
 *
 * The whole campaign is a few thousand rows, so shipping them raw and doing the
 * maths in the browser is both cheaper than a dozen aggregate endpoints and
 * what lets the date-range picker and "show test data" toggle re-filter
 * instantly without a round trip.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB;
  try {
    const [
      boxes, rewards, activities, dailyGacha, dailyRewards, dailySpend,
      rewardStamps, spendStamps, activityStamps, reachStamps,
    ] = await Promise.all([
      db.prepare('SELECT * FROM blindbox ORDER BY id').all(),
      db.prepare('SELECT * FROM blindbox_reward ORDER BY blind_box_id, id').all(),
      db.prepare('SELECT * FROM activity ORDER BY quest_id, id').all(),
      db.prepare('SELECT * FROM daily_gacha ORDER BY claim_date').all(),
      db.prepare('SELECT * FROM daily_rewards ORDER BY claim_date, reward_id').all(),
      db.prepare('SELECT * FROM daily_spend ORDER BY date, reward_id').all(),
      latestTwo(db, 'reward_snapshots'),
      latestTwo(db, 'spend_snapshots'),
      latestTwo(db, 'activity_snapshots'),
      latestTwo(db, 'reach_snapshots'),
    ]);

    const [
      rewardSnapshot, prevRewardSnapshot, spendSnapshot, prevSpendSnapshot,
      activitySnapshot, prevActivitySnapshot, reachSnapshot, prevReachSnapshot,
    ] = await Promise.all([
      snapshotRows(db, 'reward_snapshots', rewardStamps[0]),
      snapshotRows(db, 'reward_snapshots', rewardStamps[1]),
      snapshotRows(db, 'spend_snapshots', spendStamps[0]),
      snapshotRows(db, 'spend_snapshots', spendStamps[1]),
      snapshotRows(db, 'activity_snapshots', activityStamps[0], 'ref_id'),
      snapshotRows(db, 'activity_snapshots', activityStamps[1], 'ref_id'),
      snapshotRows(db, 'reach_snapshots', reachStamps[0], 'is_onboard, box_bucket'),
      snapshotRows(db, 'reach_snapshots', reachStamps[1], 'is_onboard, box_bucket'),
    ]);

    return json({
      boxes: boxes.results,
      rewards: rewards.results,
      dailyGacha: dailyGacha.results,
      dailyRewards: dailyRewards.results,
      dailySpend: dailySpend.results,
      rewardSnapshot,
      prevRewardSnapshot,
      spendSnapshot,
      prevSpendSnapshot,
      activities: activities.results,
      activitySnapshot,
      prevActivitySnapshot,
      reachSnapshot,
      prevReachSnapshot,
      freshness: {
        daily_gacha: firstExportAt(dailyGacha.results),
        daily_rewards: firstExportAt(dailyRewards.results),
        daily_spend: firstExportAt(dailySpend.results),
        reward_snapshot: rewardStamps[0] ?? null,
        prev_reward_snapshot: rewardStamps[1] ?? null,
        spend_snapshot: spendStamps[0] ?? null,
        prev_spend_snapshot: spendStamps[1] ?? null,
        activity_snapshot: activityStamps[0] ?? null,
        prev_activity_snapshot: activityStamps[1] ?? null,
        reach_snapshot: reachStamps[0] ?? null,
        prev_reach_snapshot: reachStamps[1] ?? null,
      },
      viewer: {
        email: viewerEmail(request),
        canUpload: canUpload(request, env),
        needsPassword: hasAdminPassword(env) && !isLocalDev(request),
      },
    });
  } catch (err) {
    return serverError(
      `Could not read the dashboard data: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

/** The two most recent export timestamps in a snapshot table. */
async function latestTwo(db: D1Database, table: string): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT DISTINCT snapshot_at FROM ${table} ORDER BY snapshot_at DESC LIMIT 2`)
    .all();
  return (results as Array<{ snapshot_at: string }>).map((r) => r.snapshot_at);
}

/**
 * Every row of one snapshot. `orderBy` is a fixed column list from this file,
 * never user input — each snapshot table is keyed differently, which is why it
 * is a parameter at all.
 */
async function snapshotRows(
  db: D1Database,
  table: string,
  snapshotAt: string | undefined,
  orderBy = 'reward_id',
) {
  if (!snapshotAt) return [];
  const { results } = await db
    .prepare(`SELECT * FROM ${table} WHERE snapshot_at = ? ORDER BY ${orderBy}`)
    .bind(snapshotAt)
    .all();
  return results;
}

/** Every row of a replace-loaded table shares one export timestamp. */
function firstExportAt(rows: unknown[]): string | null {
  const first = rows[0] as { source_export_at?: string } | undefined;
  return first?.source_export_at ?? null;
}
