import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { MerchantRow, BoxRedemptionRow } from '@/lib/metrics/redemption';
import { formatNumber, formatPercent } from '@/lib/format';
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
