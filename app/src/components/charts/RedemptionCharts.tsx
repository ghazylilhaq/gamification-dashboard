import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts';
import type { MerchantRow, BoxRedemptionRow, DailyRedemptionPoint } from '@/lib/metrics/redemption';
import { formatDate, formatNumber, formatPercent, formatRupiah, formatRupiahCompact } from '@/lib/format';
import { AXIS_PROPS, CHART, TOOLTIP_STYLE } from './chartTheme';
import { EmptyState } from '../ui/states';

/** Claimed against redeemed, per merchant. */
export function MerchantChart({ rows, limit = 12 }: { rows: MerchantRow[]; limit?: number }) {
  const data = rows.slice(0, limit);
  if (data.length === 0) return <EmptyState title="No coupons claimed yet" />;

  return (
    <div style={{ height: Math.max(data.length * 34 + 48, 200) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" {...AXIS_PROPS} tickFormatter={(v: number) => formatNumber(v)} />
          <YAxis
            type="category"
            dataKey="merchant"
            {...AXIS_PROPS}
            width={104}
            interval={0}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value, name) => [formatNumber(Number(value)), String(name)]}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
          <Bar dataKey="claimed" name="Claimed" fill={CHART.coupon} radius={[0, 3, 3, 0]} maxBarSize={11} />
          <Bar dataKey="redeemed" name="Redeemed" fill={CHART.boxClaims} radius={[0, 3, 3, 0]} maxBarSize={11} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Redemption rate per box.
 *
 * Boxes higher up the ladder have tiny claim counts, so a bare percentage
 * there is noise — the tooltip carries the raw counts to keep it honest.
 */
export function BoxRateChart({ rows }: { rows: BoxRedemptionRow[] }) {
  if (rows.length === 0) return <EmptyState title="No coupon claims per box yet" />;

  const data = rows.map((r) => ({
    name: r.boxName.replace(/ Box$/, ''),
    rate: r.rate === null ? 0 : r.rate * 100,
    claimed: r.claimed,
    redeemed: r.redeemed,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" {...AXIS_PROPS} interval={0} angle={-20} textAnchor="end" height={54} />
          <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${v}%`} width={40} />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value, _name, item) => {
              const p = item?.payload as { claimed: number; redeemed: number } | undefined;
              return [
                `${formatPercent(Number(value) / 100)} · ${formatNumber(p?.redeemed ?? 0)} of ${formatNumber(p?.claimed ?? 0)}`,
                'Redemption rate',
              ];
            }}
          />
          <Bar dataKey="rate" fill={CHART.boxClaims} radius={[3, 3, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Coupons claimed and redeemed per day, with coupon spend as a line. */
export function RedemptionTrendChart({ data }: { data: DailyRedemptionPoint[] }) {
  if (data.length === 0) return <EmptyState title="No daily redemption data in this range" />;

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
          <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => formatNumber(v)} width={44} />
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
              return `${formatDate(date)}${point?.incomplete ? ' · data incomplete' : ''}`;
            }}
            formatter={(value, name) =>
              name === 'Coupon spend'
                ? [formatRupiah(Number(value)), String(name)]
                : [formatNumber(Number(value)), String(name)]
            }
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="claimed" name="Claimed" fill={CHART.coupon} radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Bar dataKey="redeemed" name="Redeemed" fill={CHART.boxClaims} radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Line
            yAxisId="spend"
            type="monotone"
            dataKey="spend"
            name="Coupon spend"
            stroke={CHART.spend}
            strokeWidth={2}
            dot={{ r: 2.5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
