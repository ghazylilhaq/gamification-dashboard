import type { ReactNode } from 'react';
import { Card } from './ui/Card';
import type { Delta } from '@/lib/metrics/overview';
import { formatDelta, formatPercent } from '@/lib/format';

export function KpiCard({
  label,
  value,
  sub,
  change,
  changeFormat = 'count',
  tone = 'neutral',
  footnote,
  children,
}: {
  label: string;
  value: ReactNode;
  /** A small split or qualifier under the number. */
  sub?: ReactNode;
  change?: Delta | null;
  changeFormat?: 'count' | 'rupiah';
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
  footnote?: ReactNode;
  children?: ReactNode;
}) {
  const valueTone = {
    neutral: 'text-ink-1',
    good: 'text-success',
    warn: 'text-warn',
    danger: 'text-danger',
  }[tone];

  return (
    <Card label={label} className="flex flex-col">
      <p className="text-micro font-semibold uppercase tracking-wide text-ink-4">{label}</p>
      <p className={`mt-1.5 font-display text-kpi font-bold tnum ${valueTone}`}>{value}</p>
      {sub && <div className="mt-1 text-micro leading-relaxed text-ink-3">{sub}</div>}
      {children}
      <div className="mt-auto pt-2">
        {change !== undefined && <ChangeLine change={change} format={changeFormat} />}
        {footnote && <p className="mt-1 text-micro text-ink-4">{footnote}</p>}
      </div>
    </Card>
  );
}

/**
 * Day-over-day movement. Direction is never conveyed by colour alone — the
 * arrow and the sign carry it too.
 */
function ChangeLine({ change, format }: { change: Delta | null; format: 'count' | 'rupiah' }) {
  if (!change) {
    return <p className="text-micro text-ink-5">No previous day to compare</p>;
  }

  const { delta, pct } = change;
  const flat = delta === 0;
  const tone = flat ? 'text-ink-4' : delta > 0 ? 'text-success' : 'text-danger';
  const arrow = flat ? '→' : delta > 0 ? '↑' : '↓';
  const amount =
    format === 'rupiah'
      ? `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${compactRupiah(Math.abs(delta))}`
      : formatDelta(delta);

  return (
    <p className={`text-micro font-semibold tnum ${tone}`}>
      <span aria-hidden>{arrow}</span> {amount}
      {pct !== null && !flat && <span className="font-normal"> ({formatPercent(Math.abs(pct), 0)})</span>}
      <span className="font-normal text-ink-4"> vs. prev. day</span>
    </p>
  );
}

function compactRupiah(v: number): string {
  if (v >= 1_000_000) return `Rp${(v / 1_000_000).toFixed(1).replace('.', ',')}jt`;
  if (v >= 1_000) return `Rp${Math.round(v / 1_000)}rb`;
  return `Rp${v}`;
}
