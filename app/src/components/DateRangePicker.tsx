import { useDashboard } from '@/hooks/useDashboard';
import { formatDate } from '@/lib/format';

/**
 * Date range for the daily series. Cumulative snapshot figures cannot be
 * sliced by date, so they ignore this — which is why the spend KPI carries its
 * own "cumulative" label.
 */
export function DateRangePicker() {
  const { filter, bounds, setRange } = useDashboard();
  if (!bounds) return null;

  const from = filter.from ?? bounds.min;
  const to = filter.to ?? bounds.max;
  const isFullRange = !filter.from && !filter.to;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-micro text-ink-3">
        <span className="sr-only sm:not-sr-only">From</span>
        <input
          type="date"
          value={from}
          min={bounds.min}
          max={to}
          onChange={(e) => setRange(e.target.value || null, filter.to ?? null)}
          className="rounded-control border border-line-1 bg-surface-1 px-2 py-1.5 text-ink-2"
        />
      </label>
      <span aria-hidden className="text-ink-5">–</span>
      <label className="flex items-center gap-1.5 text-micro text-ink-3">
        <span className="sr-only sm:not-sr-only">To</span>
        <input
          type="date"
          value={to}
          min={from}
          max={bounds.max}
          onChange={(e) => setRange(filter.from ?? null, e.target.value || null)}
          className="rounded-control border border-line-1 bg-surface-1 px-2 py-1.5 text-ink-2"
        />
      </label>
      {!isFullRange && (
        <button
          onClick={() => setRange(null, null)}
          className="rounded-control px-2 py-1.5 text-micro font-semibold text-ink-3 hover:bg-surface-3 hover:text-ink-1"
        >
          Reset
          <span className="sr-only">
            {' '}date range to {formatDate(bounds.min)} – {formatDate(bounds.max)}
          </span>
        </button>
      )}
    </div>
  );
}
