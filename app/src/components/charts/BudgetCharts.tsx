import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts';
import type { DailyBudgetPoint } from '@/lib/metrics/budget';
import type { BudgetProjection } from '@/lib/metrics/projection';
import { formatDate, formatRupiah, formatRupiahCompact } from '@/lib/format';
import { AXIS_PROPS, CHART, TOOLTIP_STYLE } from './chartTheme';
import { EmptyState } from '../ui/states';

type Row = Partial<DailyBudgetPoint> & { date: string; projected?: number };

/**
 * Daily budget stacked by reward type, with the running total over it and —
 * when a projection is supplied — a dashed continuation to the campaign close.
 *
 * The projected rows carry no bar values, so the bars and the solid line simply
 * stop at the last day of real data and the dashed line takes over from there.
 */
export function BudgetDailyChart({
  data,
  projection,
}: {
  data: DailyBudgetPoint[];
  projection?: BudgetProjection;
}) {
  if (data.length === 0) return <EmptyState title="No budget data in this range" />;

  const forecast = projection?.points ?? [];
  const lastActual = forecast[0]?.date ?? null;
  const rows: Row[] = [
    // The anchor day gets both values so the two lines meet rather than jump.
    ...data.map((p) => (p.date === lastActual ? { ...p, projected: p.cumulative } : p)),
    ...forecast.slice(1),
  ];

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="date"
            {...AXIS_PROPS}
            tickFormatter={(d: string) => formatDate(d)}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => formatRupiahCompact(v)} width={62} />
          <YAxis
            yAxisId="cumulative"
            orientation="right"
            {...AXIS_PROPS}
            tickFormatter={(v: number) => formatRupiahCompact(v)}
            width={62}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(label) => {
              const date = String(label);
              const point = rows.find((p) => p.date === date);
              if (lastActual && date > lastActual) return `${formatDate(date)} · projected`;
              return `${formatDate(date)}${point?.incomplete ? ' · box spend incomplete' : ''}`;
            }}
            formatter={(value, name) => [formatRupiah(Number(value)), String(name)]}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="cashback" stackId="b" name="Box cashback" fill={CHART.cashback} maxBarSize={30} />
          <Bar dataKey="coupon" stackId="b" name="Coupon redemptions" fill={CHART.coupon} maxBarSize={30} />
          <Bar dataKey="gacha" stackId="b" name="Gacha cashback" fill={CHART.gacha} radius={[3, 3, 0, 0]} maxBarSize={30} />
          {lastActual && forecast.length > 1 && (
            <ReferenceLine
              yAxisId="cumulative"
              x={lastActual}
              stroke={CHART.axis}
              strokeDasharray="3 3"
              label={{ value: 'latest data', position: 'insideTopRight', fill: 'var(--color-ink-4)', fontSize: 11 }}
            />
          )}
          <Line
            yAxisId="cumulative"
            type="monotone"
            dataKey="cumulative"
            name="Running total"
            stroke={CHART.spend}
            strokeWidth={2}
            dot={{ r: 2.5 }}
          />
          {forecast.length > 1 && (
            <Line
              yAxisId="cumulative"
              type="monotone"
              dataKey="projected"
              name="Projected"
              stroke={CHART.spend}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * A single stacked bar showing how the budget divides.
 *
 * A bar rather than a donut: the three shares differ by an order of magnitude,
 * and lengths along one axis are easier to compare than arcs at that ratio.
 */
export function BudgetShareBar({
  parts,
}: {
  parts: Array<{ label: string; value: number; color: string }>;
}) {
  const total = parts.reduce((t, p) => t + p.value, 0);
  if (total <= 0) return <EmptyState title="Nothing spent yet" />;

  return (
    <div>
      <div
        className="flex h-7 w-full overflow-hidden rounded-control"
        role="img"
        aria-label="Budget split by reward type"
      >
        {parts.map(
          (p) =>
            p.value > 0 && (
              <div
                key={p.label}
                style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
                title={`${p.label}: ${formatRupiah(p.value)}`}
              />
            ),
        )}
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
