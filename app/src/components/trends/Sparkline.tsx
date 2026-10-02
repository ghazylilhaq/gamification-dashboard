import { formatDate, formatNumber, formatRupiah } from '@/lib/format';
import type { TrendPoint } from '@/lib/metrics/trends';

/**
 * A metric's recent days as a single thin line, the last day dotted. Shape
 * only — the exact figures sit in the row beside it, and the accessible name
 * states the range so the line is never the only way to read it.
 */
export function Sparkline({
  points,
  format = 'count',
  width = 104,
  height = 28,
}: {
  points: TrendPoint[];
  format?: 'count' | 'rupiah';
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return <span className="text-micro text-ink-5">Needs 2+ days</span>;
  }

  const fmt = format === 'rupiah' ? formatRupiah : formatNumber;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1]!;
  const first = points[0]!;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${formatDate(first.date)} to ${formatDate(last.date)}: low ${fmt(Math.min(...values))}, high ${fmt(max)}, latest ${fmt(last.value)}`}
      className="block overflow-visible"
    >
      <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke="var(--color-line-1)" strokeWidth={1} />
      <path d={path} fill="none" stroke="var(--color-ink-3)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r={2.5} fill="var(--color-ink-1)" />
    </svg>
  );
}
