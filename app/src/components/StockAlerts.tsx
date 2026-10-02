import type { StockRow, StockSummary } from '@/lib/metrics/stock';
import { formatNumber, formatPercent } from '@/lib/format';
import { ImageWithFallback } from './ui/ImageWithFallback';
import { StockBadge } from './ui/Badge';
import { EmptyState } from './ui/states';

/**
 * Rewards at or below 10% stock left.
 *
 * Nothing has crossed that line yet on the current export, so rather than
 * showing an empty panel this falls back to the most depleted rewards — which
 * is the list worth watching to see what will cross it first.
 */
export function StockAlerts({ summary }: { summary: StockSummary }) {
  const hasAlerts = summary.alerts.length > 0;
  const rows = hasAlerts ? summary.alerts : summary.mostDepleted;

  if (rows.length === 0) {
    return <EmptyState title="No stock data yet" description="Upload a cumulative reward claims file to see stock levels." />;
  }

  return (
    <>
      {!hasAlerts && (
        <p className="mb-3 rounded-control bg-success-bg px-3 py-2 text-micro text-ink-2">
          <span className="font-semibold text-success">Nothing below 10% stock left.</span>{' '}
          Showing the most depleted rewards instead — these will cross the line first.
        </p>
      )}
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <StockRowItem key={row.rewardId} row={row} showLeft={hasAlerts} />
        ))}
      </ul>
    </>
  );
}

export function StockRowItem({ row, showLeft }: { row: StockRow; showLeft: boolean }) {
  const pct = row.stockLeftPct;
  const usedPct = row.usedPct;

  return (
    <li className="flex items-center gap-3">
      <ImageWithFallback
        src={row.imageUrl}
        alt={row.name}
        fallbackLabel={row.name}
        className="size-9 shrink-0 rounded-control"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-semibold text-ink-1" title={row.name}>
            {row.name}
          </p>
          <p className="shrink-0 tnum text-micro font-semibold text-ink-2">
            {pct === null
              ? '—'
              : showLeft
                ? `${formatPercent(pct, 0)} left`
                : `${formatPercent(usedPct ?? 0, 0)} used`}
          </p>
        </div>
        <p className="truncate text-micro text-ink-4">
          {row.boxName} · {formatNumber(row.stockDistributed)} of {formatNumber(row.stockTotal)} used
        </p>
        <StockBar status={row.status} leftPct={pct} className="mt-1.5" />
      </div>
      {row.status !== 'ok' && <StockBadge status={row.status} />}
    </li>
  );
}

export function StockBar({
  status,
  leftPct,
  className = '',
}: {
  status: StockRow['status'];
  leftPct: number | null;
  className?: string;
}) {
  if (leftPct === null) {
    return (
      <div className={`h-1.5 w-full rounded-pill bg-line-2 ${className}`} role="img" aria-label="No stock set" />
    );
  }

  const color = {
    ok: 'var(--color-stock-ok)',
    warning: 'var(--color-stock-warning)',
    out: 'var(--color-stock-out)',
    'no-stock': 'var(--color-stock-none)',
  }[status];

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-pill bg-line-2 ${className}`}
      role="img"
      aria-label={`${Math.round(leftPct * 100)}% of stock left`}
    >
      <div
        className="h-full rounded-pill transition-all"
        style={{ width: `${Math.max(leftPct * 100, leftPct > 0 ? 2 : 0)}%`, background: color }}
      />
    </div>
  );
}
