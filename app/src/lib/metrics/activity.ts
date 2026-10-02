import { questName } from '@/config/quests';
import { type Dataset, sum } from './dataset';

/**
 * Stamp-earning activity, from activity_level joined to activity_list.
 *
 * `customers` is a distinct count per activity. One person does many
 * activities, so adding customers up across activities counts them repeatedly
 * — on the first export that sum is 568.304 against ~318.463 real people.
 * Nothing here returns that sum; the unique figure comes from reach.
 */

export interface ActivityRow {
  id: string;
  name: string;
  questId: number | null;
  quest: string;
  rewardStamp: number;
  customers: number;
  transactions: number;
  stamps: number;
  /** Share of every stamp issued, 0–1. */
  stampShare: number;
  stampsPerCustomer: number | null;
  transactionsPerCustomer: number | null;
  /** transactions × reward_stamp; what stamps should be. */
  expectedStamps: number | null;
  /** Whether the export's stamp count equals transactions × reward_stamp. */
  reconciles: boolean | null;
  /** In the list but no activity recorded yet. */
  inactive: boolean;
  change: { customers: number; transactions: number; stamps: number } | null;
}

export function activityRows(ds: Dataset): ActivityRow[] {
  const latest = new Map(ds.raw.activitySnapshot.map((r) => [r.ref_id, r]));
  const previous = new Map(ds.raw.prevActivitySnapshot.map((r) => [r.ref_id, r]));
  const hasPrevious = ds.raw.prevActivitySnapshot.length > 0;
  const list = new Map(ds.raw.activities.map((a) => [a.id, a]));
  const totalStamps = sum(ds.raw.activitySnapshot, (r) => r.stamps_distributed);

  // Every activity in either file — an activity with data but no list entry
  // still shows, under its raw id, rather than silently vanishing.
  const ids = [...new Set([...list.keys(), ...latest.keys()])];

  return ids
    .map((id) => {
      const meta = list.get(id);
      const snap = latest.get(id);
      const prev = previous.get(id);
      const customers = snap?.customers ?? 0;
      const transactions = snap?.transactions ?? 0;
      const stamps = snap?.stamps_distributed ?? 0;
      const rewardStamp = meta?.reward_stamp ?? 0;
      const expectedStamps = meta ? transactions * rewardStamp : null;

      return {
        id,
        name: meta?.name_en ?? id,
        questId: meta?.quest_id ?? null,
        quest: questName(meta?.quest_id),
        rewardStamp,
        customers,
        transactions,
        stamps,
        stampShare: totalStamps > 0 ? stamps / totalStamps : 0,
        stampsPerCustomer: customers > 0 ? stamps / customers : null,
        transactionsPerCustomer: customers > 0 ? transactions / customers : null,
        expectedStamps,
        reconciles: snap && expectedStamps !== null ? expectedStamps === stamps : null,
        inactive: !snap || transactions === 0,
        change: hasPrevious
          ? {
              customers: customers - (prev?.customers ?? 0),
              transactions: transactions - (prev?.transactions ?? 0),
              stamps: stamps - (prev?.stamps_distributed ?? 0),
            }
          : null,
      };
    })
    .sort((a, b) => b.stamps - a.stamps || a.name.localeCompare(b.name));
}

export interface QuestRow {
  questId: number | null;
  quest: string;
  activities: number;
  activeActivities: number;
  transactions: number;
  stamps: number;
  stampShare: number;
}

/** Stamps and transactions per quest. Customers are deliberately absent. */
export function activityByQuest(ds: Dataset): QuestRow[] {
  const rows = activityRows(ds);
  const totalStamps = sum(rows, (r) => r.stamps);
  const groups = new Map<number | null, ActivityRow[]>();
  for (const row of rows) {
    const bucket = groups.get(row.questId);
    if (bucket) bucket.push(row);
    else groups.set(row.questId, [row]);
  }
  return [...groups.entries()]
    .map(([questId, items]) => {
      const stamps = sum(items, (r) => r.stamps);
      return {
        questId,
        quest: items[0]!.quest,
        activities: items.length,
        activeActivities: items.filter((r) => !r.inactive).length,
        transactions: sum(items, (r) => r.transactions),
        stamps,
        stampShare: totalStamps > 0 ? stamps / totalStamps : 0,
      };
    })
    .sort((a, b) => (a.questId ?? 99) - (b.questId ?? 99));
}

export interface ActivityTotals {
  transactions: number;
  stamps: number;
  activities: number;
  activeActivities: number;
  /** Rows whose stamps differ from transactions × reward_stamp. */
  mismatches: Array<{ id: string; name: string; expected: number; actual: number }>;
  asOf: string | null;
  change: { transactions: number; stamps: number } | null;
}

export function activityTotals(ds: Dataset): ActivityTotals {
  const rows = activityRows(ds);
  const hasPrevious = ds.raw.prevActivitySnapshot.length > 0;
  return {
    transactions: sum(rows, (r) => r.transactions),
    stamps: sum(rows, (r) => r.stamps),
    activities: rows.length,
    activeActivities: rows.filter((r) => !r.inactive).length,
    mismatches: rows
      .filter((r) => r.reconciles === false)
      .map((r) => ({ id: r.id, name: r.name, expected: r.expectedStamps ?? 0, actual: r.stamps })),
    asOf: ds.raw.freshness.activity_snapshot,
    change: hasPrevious
      ? {
          transactions: sum(rows, (r) => r.change?.transactions ?? 0),
          stamps: sum(rows, (r) => r.change?.stamps ?? 0),
        }
      : null,
  };
}

export function hasActivityData(ds: Dataset): boolean {
  return ds.raw.activitySnapshot.length > 0;
}
