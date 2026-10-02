import {
  Area, AreaChart, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts';
import type { GachaPoint } from '@/lib/metrics/gacha';
import { formatDate, formatNumber, formatRupiah, formatRupiahCompact } from '@/lib/format';
import { AXIS_PROPS, CHART, TOOLTIP_STYLE } from './chartTheme';
import { EmptyState } from '../ui/states';

/**
 * Claims as bars with claiming users as a line over them.
 *
 * The gap between the two lines is the point: it shows how many times the
 * average participant span, which is what makes "users" and "claims" different
 * measures rather than interchangeable ones.
 */
export function GachaTrendChart({ data }: { data: GachaPoint[] }) {
  if (data.length === 0) return <EmptyState title="No gacha data in this range" />;

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
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value, name) => [formatNumber(Number(value)), String(name)]}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="claims" name="Claims" fill={CHART.gachaClaims} radius={[3, 3, 0, 0]} maxBarSize={32} />
          <Line
            type="monotone"
            dataKey="users"
            name="Users claiming"
            stroke={CHART.spend}
            strokeWidth={2}
            dot={{ r: 2.5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Cashback accumulating over the campaign. A budget line lands in next scope. */
export function CumulativeCashbackChart({ data }: { data: GachaPoint[] }) {
  if (data.length === 0) return <EmptyState title="No gacha cashback in this range" />;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gachaCashback" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.gacha} stopOpacity={0.25} />
              <stop offset="100%" stopColor={CHART.gacha} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="date"
            {...AXIS_PROPS}
            tickFormatter={(d: string) => formatDate(d)}
            interval="preserveStartEnd"
          />
          <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => formatRupiahCompact(v)} width={62} />
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value) => [formatRupiah(Number(value)), 'Cumulative cashback']}
          />
          <Area
            type="monotone"
            dataKey="cumulativeCashback"
            stroke={CHART.gacha}
            strokeWidth={2}
            fill="url(#gachaCashback)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
