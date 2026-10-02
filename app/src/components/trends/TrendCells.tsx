import type { Delta } from '@/lib/metrics/overview';
import type { ScorecardRow, SnapshotWindow, TrendPoint } from '@/lib/metrics/trends';
import { formatDate, formatDelta, formatDeltaRupiah, formatNumber, formatPercent, formatRupiah } from '@/lib/format';

/**
 * The cells every daily-trend row shares. Direction is never colour alone —
 * each change carries an arrow and a sign — and it is not judged either: more
 * claims is good, more spend may not be, so movement is drawn in ink and only
 * an unusual day gets a coloured badge.
 */

export type ValueFormat = 'count' | 'rupiah';

export function formatValue(value: number | null | undefined, format: ValueFormat): string {
  return format === 'rupiah' ? formatRupiah(value) : formatNumber(value);
}

/** The day a figure belongs to, with a note when its window is not a plain day. */
export function DayCell({ point }: { point: TrendPoint | null }) {
  if (!point) return <span className="text-ink-5">—</span>;
  const note = windowNote(point.window);
  return (
    <>
      <span className="whitespace-nowrap text-ink-2">{formatDate(point.date)}</span>
      {note && <span className="block text-micro text-warn">{note}</span>}
    </>
  );
}

/** "2-day window" or "31h window" — null for an ordinary ~24-hour day. */
export function windowNote(w: SnapshotWindow | null): string | null {
  if (!w) return null;
  if (w.spanDays > 1) return `${w.spanDays}-day window`;
  if (Math.abs(w.hours - 24) > 4) return `${Math.round(w.hours)}h window`;
  return null;
}

export function ChangeCell({ change, format }: { change: Delta | null; format: ValueFormat }) {
  if (!change) return <span className="text-micro text-ink-5">No previous day</span>;
  const { delta, pct } = change;
  const arrow = delta === 0 ? '→' : delta > 0 ? '↑' : '↓';
  const amount = format === 'rupiah' ? formatDeltaRupiah(delta) : formatDelta(delta);
  return (
    <span className="whitespace-nowrap tnum text-ink-2">
      <span aria-hidden>{arrow}</span> {amount}
      {pct !== null && delta !== 0 && (
        <span className="text-micro text-ink-4"> ({formatPercent(Math.abs(pct), 0)})</span>
      )}
    </span>
  );
}

export function BaselineCell({ row, format }: { row: ScorecardRow; format: ValueFormat }) {
  if (!row.baseline || row.vsBaseline === null) {
    return (
      <span className="text-micro text-ink-5" title="Needs at least 3 earlier full days">
        Not enough days yet
      </span>
    );
  }
  // Round first, so a change too small to show reads "0%", never "−0%".
  const pct = Math.round(row.vsBaseline * 100) / 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return (
    <span className="whitespace-nowrap">
      <span className="tnum text-ink-2">
        {sign}
        {formatPercent(Math.abs(pct), 0)}
      </span>
      <span className="block text-micro text-ink-4 tnum">
        avg {formatValue(Math.round(row.baseline.value), format)} · {row.baseline.days}d
      </span>
      {row.unusual && <UnusualBadge direction={row.unusual} />}
    </span>
  );
}

export function UnusualBadge({ direction }: { direction: 'high' | 'low' }) {
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 rounded-pill bg-warn-bg px-2 py-0.5 text-micro font-semibold text-warn">
      <span aria-hidden>{direction === 'high' ? '▲' : '▼'}</span>
      Unusually {direction}
    </span>
  );
}
