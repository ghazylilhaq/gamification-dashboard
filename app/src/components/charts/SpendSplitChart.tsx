import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { DailySpendPoint } from '@/lib/metrics/spend';
import { formatDate, formatRupiah, formatRupiahCompact } from '@/lib/format';
import { AXIS_PROPS, CHART, TOOLTIP_STYLE } from './chartTheme';
import { EmptyState } from '../ui/states';

/** Box cashback, coupon redemptions and gacha cashback, stacked per day. */
export function SpendSplitChart({ data }: { data: DailySpendPoint[] }) {
  if (data.length === 0) {
    return <EmptyState title="No spend data in this range" />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="date"
            {...AXIS_PROPS}
            tickFormatter={(d: string) => formatDate(d)}
            interval="preserveStartEnd"
          />
          <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => formatRupiahCompact(v)} width={60} />
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(label) => {
              const date = String(label);
              const point = data.find((p) => p.date === date);
              return `${formatDate(date)}${point?.incomplete ? ' · box spend incomplete' : ''}`;
            }}
            formatter={(value, name) => [formatRupiah(Number(value)), String(name)]}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="cashback" stackId="s" name="Box cashback" fill={CHART.cashback} maxBarSize={28} />
          <Bar dataKey="coupon" stackId="s" name="Coupon redemptions" fill={CHART.coupon} maxBarSize={28} />
          <Bar dataKey="gacha" stackId="s" name="Gacha cashback" fill={CHART.gacha} radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * The cumulative split as a single stacked bar.
 *
 * A bar rather than a donut: these three shares differ by an order of
 * magnitude, and comparing arc lengths at that ratio is harder than comparing
 * lengths along one axis.
 */
export function CumulativeSplit({
  cashback,
  coupon,
  gacha,
}: {
  cashback: number;
  coupon: number;
  gacha: number;
}) {
  const total = cashback + coupon + gacha;
  if (total <= 0) return <EmptyState title="No spend recorded yet" />;

  const parts = [
    { label: 'Box cashback', value: cashback, color: CHART.cashback },
    { label: 'Coupon redemptions', value: coupon, color: CHART.coupon },
    { label: 'Gacha cashback', value: gacha, color: CHART.gacha },
  ];

  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-control" role="img" aria-label="Cumulative spend split">
        {parts.map((p) => (
          p.value > 0 && (
            <div
              key={p.label}
              style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
              title={`${p.label}: ${formatRupiah(p.value)}`}
            />
          )
        ))}
      </div>
      <dl className="mt-3 space-y-1.5">
        {parts.map((p) => (
          <div key={p.label} className="flex items-baseline gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-pill" style={{ background: p.color }} />
            <dt className="min-w-0 flex-1 truncate text-ink-3">{p.label}</dt>
            <dd className="tnum font-semibold text-ink-1">{formatRupiah(p.value)}</dd>
            <dd className="w-12 text-right tnum text-micro text-ink-4">
              {((p.value / total) * 100).toFixed(0)}%
            </dd>
          </div>
        ))}
        <div className="flex items-baseline gap-2 border-t border-line-2 pt-1.5">
          <span aria-hidden className="size-2.5 shrink-0" />
          <dt className="min-w-0 flex-1 font-semibold text-ink-2">Total</dt>
          <dd className="tnum font-bold text-ink-1">{formatRupiah(total)}</dd>
          <dd className="w-12" />
        </div>
      </dl>
    </div>
  );
}
