import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { DailyClaimPoint } from '@/lib/metrics/claims';
import { formatDate, formatNumber, formatRupiah, formatRupiahCompact } from '@/lib/format';
import { AXIS_PROPS, CHART, TOOLTIP_STYLE } from './chartTheme';
import { EmptyState } from '../ui/states';

/** Box and gacha claims as bars, total spend as a line on its own axis. */
export function DailyTrendChart({ data }: { data: DailyClaimPoint[] }) {
  if (data.length === 0) {
    return <EmptyState title="No daily data in this range" description="Widen the date range, or turn on test data to see pre-launch activity." />;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="date"
            {...AXIS_PROPS}
            tickFormatter={(d: string) => formatDate(d)}
            interval="preserveStartEnd"
          />
          <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => formatNumber(v)} width={48} />
          <YAxis
            yAxisId="spend"
            orientation="right"
            {...AXIS_PROPS}
            tickFormatter={(v: number) => formatRupiahCompact(v)}
            width={60}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(label) => {
              const date = String(label);
              const point = data.find((p) => p.date === date);
              return `${formatDate(date)}${point?.isPartial ? ' · partial day' : ''}`;
            }}
            formatter={(value, name) =>
              name === 'Total spend'
                ? [formatRupiah(Number(value)), String(name)]
                : [formatNumber(Number(value)), String(name)]
            }
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="boxClaims" name="Box claims" fill={CHART.boxClaims} radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar dataKey="gachaClaims" name="Gacha claims" fill={CHART.gachaClaims} radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Line
            yAxisId="spend"
            type="monotone"
            dataKey="totalSpend"
            name="Total spend"
            stroke={CHART.spend}
            strokeWidth={2}
            dot={{ r: 2.5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
