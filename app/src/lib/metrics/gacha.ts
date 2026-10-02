import { type Dataset, sum } from './dataset';

export interface GachaTotals {
  claims: number;
  /**
   * How many users claimed on the most recent day, from
   * `daily_claim_gatcha.total_claim_user`.
   *
   * NOT a campaign-wide unique-user count. A user can spin many times, the
   * column is computed per day, and adding it across days counts the same
   * person repeatedly. It is reported on the Gacha page as a per-day figure
   * and deliberately kept off the Overview KPI row, where a bare number next
   * to "users" would read as a unique total.
   */
  usersLatestDay: number;
  latestDate: string | null;
  cashback: number;
  /** Cashback per claiming user on the latest day. */
  cashbackPerUser: number | null;
}

export function gachaTotals(ds: Dataset): GachaTotals {
  return totalsOf(ds.dailyGacha);
}

/**
 * Gacha claims and cashback since launch, ignoring the date range — the
 * counterpart to cumulativeClaimTotals.
 */
export function cumulativeGachaTotals(ds: Dataset): GachaTotals {
  return totalsOf(ds.sinceLaunch.dailyGacha);
}

function totalsOf(source: Dataset['dailyGacha']): GachaTotals {
  const rows = [...source].sort((a, b) => a.claim_date.localeCompare(b.claim_date));
  const latest = rows[rows.length - 1] ?? null;
  const cashback = sum(rows, (r) => r.cashback_amount);
  return {
    claims: sum(rows, (r) => r.total_claim),
    usersLatestDay: latest?.total_claim_user ?? 0,
    latestDate: latest?.claim_date ?? null,
    cashback,
    cashbackPerUser: latest && latest.total_claim_user > 0
      ? latest.cashback_amount / latest.total_claim_user
      : null,
  };
}

export interface GachaPoint {
  date: string;
  claims: number;
  users: number;
  cashback: number;
  cumulativeCashback: number;
}

export function gachaSeries(ds: Dataset): GachaPoint[] {
  const rows = [...ds.dailyGacha].sort((a, b) => a.claim_date.localeCompare(b.claim_date));
  let running = 0;
  return rows.map((r) => {
    running += r.cashback_amount;
    return {
      date: r.claim_date,
      claims: r.total_claim,
      users: r.total_claim_user,
      cashback: r.cashback_amount,
      cumulativeCashback: running,
    };
  });
}
