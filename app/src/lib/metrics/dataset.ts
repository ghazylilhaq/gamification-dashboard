import { LAUNCH_DATE } from '@/config/fileTypes';
import type {
  BlindBox, BlindBoxReward, Bootstrap, DailyGacha, DailyReward, DailySpend,
  RewardSnapshot, SpendSnapshot,
} from '@/lib/types';

export interface DataFilter {
  /** Include pre-launch rows. Off by default; the campaign launched 15 Sep. */
  showTestData: boolean;
  /** Inclusive 'YYYY-MM-DD' bounds on the daily series. */
  from?: string | null;
  to?: string | null;
}

export const DEFAULT_FILTER: DataFilter = { showTestData: false, from: null, to: null };

/**
 * A filtered view of the bootstrap payload plus the lookups every metric needs.
 *
 * Only the *daily* series are filtered. Snapshot tables are cumulative
 * totals-to-date that cannot be sliced by date, so they are passed through
 * whole — which is also why the cumulative spend figures include the handful of
 * pre-launch test claims, exactly as the spec's sample numbers do.
 */
export interface Dataset {
  filter: DataFilter;
  boxes: BlindBox[];
  /** Boxes ordered by stamp requirement: Welcome (10) -> Fancam (300). */
  boxesByStamp: Array<BlindBox & { stamp_required: number }>;
  rewards: BlindBoxReward[];
  rewardById: Map<number, BlindBoxReward>;
  boxById: Map<number, BlindBox>;
  /** reward id -> box id (13-24). The only safe join for the spend files. */
  boxIdByRewardId: Map<number, number>;
  dailyGacha: DailyGacha[];
  dailyRewards: DailyReward[];
  dailySpend: DailySpend[];
  /**
   * The same daily series with the launch filter applied but the date range
   * ignored, for the cumulative-to-date KPIs. Those read "all time" and must
   * not move when someone narrows the range to inspect a chart.
   */
  sinceLaunch: {
    dailyGacha: DailyGacha[];
    dailyRewards: DailyReward[];
    dailySpend: DailySpend[];
  };
  rewardSnapshot: RewardSnapshot[];
  prevRewardSnapshot: RewardSnapshot[];
  spendSnapshot: SpendSnapshot[];
  prevSpendSnapshot: SpendSnapshot[];
  raw: Bootstrap;
  /** Every date present in the filtered daily series, ascending. */
  dates: string[];
}

/** The launch filter on its own: pre-launch rows are test data. */
function isLive(date: string, filter: DataFilter): boolean {
  return filter.showTestData || date >= LAUNCH_DATE;
}

function inRange(date: string, filter: DataFilter): boolean {
  if (!isLive(date, filter)) return false;
  if (filter.from && date < filter.from) return false;
  if (filter.to && date > filter.to) return false;
  return true;
}

export function buildDataset(boot: Bootstrap, filter: DataFilter = DEFAULT_FILTER): Dataset {
  const rewardById = new Map(boot.rewards.map((r) => [r.id, r]));
  const boxById = new Map(boot.boxes.map((b) => [b.id, b]));

  // Reward -> box comes from the reference data, never from a spend file's
  // blind_box_id2 (which is 1-12 there and would map to the wrong box).
  const boxIdByRewardId = new Map<number, number>();
  for (const r of boot.rewards) boxIdByRewardId.set(r.id, r.blind_box_id);

  // Stamp requirements only exist on the claim files, so read them from there.
  const stampByBox = new Map<number, number>();
  for (const s of boot.rewardSnapshot) {
    if (!stampByBox.has(s.blind_box_id2)) stampByBox.set(s.blind_box_id2, s.stamp_required);
  }
  for (const d of boot.dailyRewards) {
    if (!stampByBox.has(d.blind_box_id2)) stampByBox.set(d.blind_box_id2, d.stamp_required);
  }

  const boxesByStamp = boot.boxes
    .map((b) => ({ ...b, stamp_required: stampByBox.get(b.id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.stamp_required - b.stamp_required || a.id - b.id);

  const dailyGacha = boot.dailyGacha.filter((r) => inRange(r.claim_date, filter));
  const dailyRewards = boot.dailyRewards.filter((r) => inRange(r.claim_date, filter));
  const dailySpend = boot.dailySpend.filter((r) => inRange(r.date, filter));

  const sinceLaunch = {
    dailyGacha: boot.dailyGacha.filter((r) => isLive(r.claim_date, filter)),
    dailyRewards: boot.dailyRewards.filter((r) => isLive(r.claim_date, filter)),
    dailySpend: boot.dailySpend.filter((r) => isLive(r.date, filter)),
  };

  const dates = [...new Set([
    ...dailyGacha.map((r) => r.claim_date),
    ...dailyRewards.map((r) => r.claim_date),
    ...dailySpend.map((r) => r.date),
  ])].sort();

  return {
    filter,
    boxes: boot.boxes,
    boxesByStamp,
    rewards: boot.rewards,
    rewardById,
    boxById,
    boxIdByRewardId,
    dailyGacha,
    dailyRewards,
    dailySpend,
    sinceLaunch,
    rewardSnapshot: boot.rewardSnapshot,
    prevRewardSnapshot: boot.prevRewardSnapshot,
    spendSnapshot: boot.spendSnapshot,
    prevSpendSnapshot: boot.prevSpendSnapshot,
    raw: boot,
    dates,
  };
}

/** Box for a reward id, resolved through the reference data. */
export function boxOfReward(ds: Dataset, rewardId: number): BlindBox | null {
  const boxId = ds.boxIdByRewardId.get(rewardId);
  return boxId === undefined ? null : ds.boxById.get(boxId) ?? null;
}

export function sum<T>(items: T[], pick: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += pick(item);
  return total;
}

export function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}
