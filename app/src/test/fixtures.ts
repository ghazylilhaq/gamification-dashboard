import { loadCsvDir } from '../../scripts/loadCsvs';
import type { Bootstrap } from '@/lib/types';
import { normaliseRow, TABLE_COLUMNS } from '@/lib/csv/parse';
import type { FileTypeId } from '@/config/fileTypes';
import type { LoadedFile } from '../../scripts/loadCsvs';

/**
 * Build a Bootstrap payload straight from the real CSV exports in ../docs,
 * by running them through the same normalisation the upload path uses.
 *
 * Testing against the real files rather than hand-written fixtures is the whole
 * point: the numbers asserted below are the ones in the spec's launch-day
 * section, so a regression in parsing, joining or aggregating shows up as a
 * figure leadership would have seen on the dashboard.
 */
export function loadFixtureBootstrap(): Bootstrap {
  const files = loadCsvDir();
  const rowsOf = <T,>(type: FileTypeId): T[] => {
    const file = files.find((f) => f.def.id === type);
    if (!file) throw new Error(`Fixture CSV missing for ${type}`);
    return toObjects(type, file) as T[];
  };

  const exportAtOf = (type: FileTypeId) =>
    files.find((f) => f.def.id === type)?.exportAt ?? null;

  const reachSnapshot = rowsOf<Bootstrap['reachSnapshot'][number]>('reach_snapshot');
  const activitySnapshot = rowsOf<Bootstrap['activitySnapshot'][number]>('activity_snapshot');
  const spendSnapshot = rowsOf<Bootstrap['spendSnapshot'][number]>('spend_snapshot');

  return {
    boxes: rowsOf<Bootstrap['boxes'][number]>('blindbox'),
    rewards: rowsOf<Bootstrap['rewards'][number]>('blindbox_reward'),
    dailyGacha: rowsOf<Bootstrap['dailyGacha'][number]>('daily_gacha'),
    dailyRewards: rowsOf<Bootstrap['dailyRewards'][number]>('daily_rewards'),
    dailySpend: rowsOf<Bootstrap['dailySpend'][number]>('daily_spend'),
    rewardSnapshot: rowsOf<Bootstrap['rewardSnapshot'][number]>('reward_snapshot'),
    prevRewardSnapshot: [],
    spendSnapshot,
    prevSpendSnapshot: [],
    activities: rowsOf<Bootstrap['activities'][number]>('activity_list'),
    activitySnapshot,
    prevActivitySnapshot: [],
    reachSnapshot,
    prevReachSnapshot: [],
    // One export of each, so one day of history: enough to render the Trends
    // page's levels, not yet any day-over-day change.
    reachHistory: reachSnapshot.map(({ snapshot_at, is_onboard, box_bucket, users }) =>
      ({ snapshot_at, is_onboard, box_bucket, users })),
    activityHistory: activitySnapshot,
    spendHistory: summariseSpend(spendSnapshot),
    freshness: {
      daily_gacha: exportAtOf('daily_gacha'),
      daily_rewards: exportAtOf('daily_rewards'),
      daily_spend: exportAtOf('daily_spend'),
      reward_snapshot: exportAtOf('reward_snapshot'),
      spend_snapshot: exportAtOf('spend_snapshot'),
      prev_reward_snapshot: null,
      prev_spend_snapshot: null,
      activity_snapshot: exportAtOf('activity_snapshot'),
      prev_activity_snapshot: null,
      reach_snapshot: exportAtOf('reach_snapshot'),
      prev_reach_snapshot: null,
    },
  };
}

/** What /api/bootstrap's spend history query returns: one export summed per type. */
export function summariseSpend(rows: Bootstrap['spendSnapshot']): Bootstrap['spendHistory'] {
  const out = new Map<string, Bootstrap['spendHistory'][number]>();
  for (const r of rows) {
    const key = `${r.snapshot_at}|${r.type}`;
    const entry = out.get(key) ?? { snapshot_at: r.snapshot_at, type: r.type, claimed: 0, redeemed: 0, spend: 0 };
    entry.claimed += r.total_user_claimed;
    entry.redeemed += r.total_user_redeemed;
    entry.spend += r.spend_amount;
    out.set(key, entry);
  }
  return [...out.values()];
}

/** Turn normalised value arrays back into objects keyed by column name. */
function toObjects(type: FileTypeId, file: LoadedFile): Record<string, unknown>[] {
  const cols = TABLE_COLUMNS[type];
  return file.rows.map((r) => {
    const values = normaliseRow(type, r, file.exportAt);
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => { obj[c] = values[i] ?? null; });
    return obj;
  });
}

export function fixtureFiles() {
  return loadCsvDir();
}
