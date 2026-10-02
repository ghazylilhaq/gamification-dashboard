import type { BoxRewardOdds, OddsVerdict } from '@/lib/metrics/boxes';
import { formatNumber } from '@/lib/format';

const VERDICT: Record<OddsVerdict, { label: string; className: string; dot: string }> = {
  'on-target': { label: 'On target', className: 'bg-success-bg text-success', dot: 'var(--color-success)' },
  slight: { label: 'Slightly off', className: 'bg-warn-bg text-warn', dot: 'var(--color-warn)' },
  'off-target': { label: 'Off target', className: 'bg-danger-bg text-danger', dot: 'var(--color-danger)' },
  insufficient: { label: 'Too few claims', className: 'bg-line-2 text-ink-4', dot: 'var(--color-ink-5)' },
};

export function OddsVerdictBadge({ verdict }: { verdict: OddsVerdict }) {
  const meta = VERDICT[verdict];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-micro font-semibold whitespace-nowrap ${meta.className}`}
    >
      <span aria-hidden className="size-1.5 rounded-pill" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

/** "+3,3 pts over 271 claims" — the deviation with the sample behind it. */
export function OddsDeviation({ row }: { row: BoxRewardOdds }) {
  if (row.deviation === null) {
    return (
      <span className="text-micro text-ink-4">
        {formatNumber(row.claims)} claim{row.claims === 1 ? '' : 's'}
      </span>
    );
  }

  const tone =
    row.verdict === 'off-target'
      ? 'text-danger'
      : row.verdict === 'slight'
        ? 'text-warn'
        : 'text-ink-4';
  const sign = row.deviation > 0 ? '+' : row.deviation < 0 ? '−' : '';

  return (
    <span className={`text-micro tnum ${tone}`}>
      {sign}
      {Math.abs(row.deviation).toFixed(1)} pts
      <span className="text-ink-4"> over {formatNumber(row.claims)} claims</span>
    </span>
  );
}
