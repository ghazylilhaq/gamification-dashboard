import { STOCK_WARNING_THRESHOLD } from '@/config/fileTypes';
import { type Dataset, boxOfReward } from './dataset';

export type StockStatus = 'ok' | 'warning' | 'out' | 'no-stock';

export interface StockRow {
  rewardId: number;
  name: string;
  boxId: number | null;
  boxName: string;
  imageUrl: string | null;
  rarity: string | null;
  type: string | null;
  stockTotal: number;
  stockDistributed: number;
  /** Share of stock still available, or null when no stock is configured. */
  stockLeftPct: number | null;
  /** Share of stock handed out. The inverse of stockLeftPct. */
  usedPct: number | null;
  status: StockStatus;
}

/**
 * Stock left % = 1 - distributed / total, from the latest cumulative snapshot.
 * When stock_total is 0 the reward has no stock configured at all — show that
 * rather than dividing by zero.
 */
export function stockStatusOf(stockTotal: number, stockDistributed: number): { pct: number | null; status: StockStatus } {
  if (!stockTotal || stockTotal <= 0) return { pct: null, status: 'no-stock' };
  const pct = Math.max(0, 1 - stockDistributed / stockTotal);
  if (pct <= 0) return { pct: 0, status: 'out' };
  if (pct <= STOCK_WARNING_THRESHOLD) return { pct, status: 'warning' };
  return { pct, status: 'ok' };
}

export function stockRows(ds: Dataset): StockRow[] {
  return ds.rewardSnapshot.map((snap) => {
    const reward = ds.rewardById.get(snap.reward_id);
    const box = boxOfReward(ds, snap.reward_id) ?? ds.boxById.get(snap.blind_box_id2) ?? null;
    const { pct, status } = stockStatusOf(snap.stock_total, snap.stock_distributed);
    return {
      rewardId: snap.reward_id,
      name: reward?.name_en ?? snap.reward_name,
      boxId: box?.id ?? null,
      boxName: box?.name_en ?? '—',
      imageUrl: reward?.image_url ?? null,
      rarity: reward?.rarity ?? null,
      type: reward?.type ?? snap.reward_type,
      stockTotal: snap.stock_total,
      stockDistributed: snap.stock_distributed,
      stockLeftPct: pct,
      usedPct: pct === null ? null : 1 - pct,
      status,
    };
  });
}

export interface StockSummary {
  rows: StockRow[];
  /** Rewards at or below the warning threshold, worst first. */
  alerts: StockRow[];
  warningCount: number;
  outCount: number;
  noStockCount: number;
  /**
   * Fallback for when nothing has crossed the threshold yet: the rewards that
   * have burned through the most of their stock. This is what the spec's
   * "scarcest stock" sample table actually ranks by.
   */
  mostDepleted: StockRow[];
}

export function stockSummary(ds: Dataset, depletedLimit = 6): StockSummary {
  const rows = stockRows(ds);
  const alerts = rows
    .filter((r) => r.status === 'warning' || r.status === 'out')
    .sort((a, b) => (a.stockLeftPct ?? 0) - (b.stockLeftPct ?? 0));
  const mostDepleted = rows
    .filter((r) => r.usedPct !== null && r.usedPct > 0)
    .sort((a, b) => (b.usedPct ?? 0) - (a.usedPct ?? 0))
    .slice(0, depletedLimit);

  return {
    rows,
    alerts,
    warningCount: rows.filter((r) => r.status === 'warning').length,
    outCount: rows.filter((r) => r.status === 'out').length,
    noStockCount: rows.filter((r) => r.status === 'no-stock').length,
    mostDepleted,
  };
}

/** Count of rewards needing attention, for the Overview KPI. */
export function stockWarningCount(ds: Dataset): number {
  const s = stockSummary(ds);
  return s.warningCount + s.outCount;
}
