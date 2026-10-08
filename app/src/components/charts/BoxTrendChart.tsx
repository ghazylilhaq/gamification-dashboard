import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { DailyBoxPoint } from '@/lib/metrics/boxes';
import { formatDate, formatNumber, formatRupiah, formatRupiahCompact } from '@/lib/format';
import { AXIS_PROPS, CHART, TOOLTIP_STYLE } from './chartTheme';
import { EmptyState } from '../ui/states';

/** The three things the Blind boxes daily trend can show. */
export type TrendMetric = 'claims' | 'redeemed' | 'spend';

export const TREND_METRICS: Array<{ value: TrendMetric; label: string }> = [
  { value: 'claims', label: 'Box claims' },
  { value: 'redeemed', label: 'Coupons redeemed' },
  { value: 'spend', label: 'Spend' },
];

/**
 * Box claims and coupon redemptions as bars, spend as a line on its own axis.
 *
 * `metrics` narrows which series are drawn; an empty set is the combined view
 * and shows all three, so "no filter" and "everything" read the same way.
 * With spend alone the rupiah scale moves to the left, where a single-series
 * chart reads better.
 */
export function BoxTrendChart({
  data,
  metrics = [],
}: {
  data: DailyBoxPoint[];
  metrics?: TrendMetric[];
}) {
  if (data.length === 0) return <EmptyState title="No daily data in this range" />;

  const show = (m: TrendMetric) => metrics.length === 0 || metrics.includes(m);
  const spendOnly = metrics.length === 1 && metrics[0] === 'spend';

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="date"
            {...AXIS_PROPS}
            tickFormatter={(d: string) => formatDate(d)}
            interval="preserveStartEnd"
          />
          <YAxis
            {...AXIS_PROPS}
            tickFormatter={(v: number) => (spendOnly ? formatRupiahCompact(v) : formatNumber(v))}
            width={spendOnly ? 60 : 48}
          />
          {show('spend') && !spendOnly && (
            <YAxis
              yAxisId="spend"
              orientation="right"
              {...AXIS_PROPS}
              tickFormatter={(v: number) => formatRupiahCompact(v)}
              width={60}
            />
          )}
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(label) => {
              const date = String(label);
              const point = data.find((p) => p.date === date);
              const notes = [
                point?.incomplete ? 'spend data incomplete' : null,
                point?.cashbackDerived && point.cashback > 0 ? 'cashback reconstructed' : null,
              ].filter(Boolean);
              return `${formatDate(date)}${notes.length > 0 ? ` · ${notes.join(' · ')}` : ''}`;
            }}
            formatter={(value, name) =>
              name === 'Spend'
                ? [formatRupiah(Number(value)), String(name)]
                : [formatNumber(Number(value)), String(name)]
            }
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {show('claims') && (
            <Bar dataKey="claims" name="Box claims" fill={CHART.boxClaims} radius={[3, 3, 0, 0]} maxBarSize={24} />
          )}
          {show('redeemed') && (
            <Bar dataKey="redeemed" name="Coupons redeemed" fill={CHART.coupon} radius={[3, 3, 0, 0]} maxBarSize={24} />
          )}
          {show('spend') && (
            <Line
              {...(spendOnly ? {} : { yAxisId: 'spend' })}
              type="monotone"
              dataKey="spend"
              name="Spend"
              stroke={CHART.spend}
              strokeWidth={2}
              dot={{ r: 2.5 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
