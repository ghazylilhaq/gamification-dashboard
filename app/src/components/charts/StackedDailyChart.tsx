import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatDate, formatNumber, formatRupiah, formatRupiahCompact } from '@/lib/format';
import { AXIS_PROPS, CHART, TOOLTIP_STYLE } from './chartTheme';
import { EmptyState } from '../ui/states';

export interface StackSeries {
  key: string;
  label: string;
  color: string;
}

export interface StackPoint {
  date: string;
  /** One value per series, in series order. */
  values: number[];
  /** Replaces the plain date in the tooltip, e.g. to name a partial day. */
  caption?: string | null;
}

/**
 * One bar per day, stacked by series. The colour follows the series key, so a
 * tier or quest keeps its colour whatever else is on the chart.
 *
 * Segments are split by a hairline of the card's own colour rather than a
 * border, and the tooltip lists them top of the stack first, with the total.
 */
export function StackedDailyChart({
  series,
  data,
  format = 'count',
  emptyTitle = 'No data in this range',
  emptyDescription,
}: {
  series: StackSeries[];
  data: StackPoint[];
  format?: 'count' | 'rupiah';
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const rows = data.map((p) => ({
    date: p.date,
    caption: p.caption ?? null,
    ...Object.fromEntries(series.map((s, i) => [s.key, p.values[i] ?? 0])),
  }));
  const full = format === 'rupiah' ? formatRupiah : formatNumber;
  const compact = format === 'rupiah' ? formatRupiahCompact : formatNumber;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="date"
            {...AXIS_PROPS}
            tickFormatter={(d: string) => formatDate(d)}
            interval="preserveStartEnd"
          />
          <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => compact(v)} width={56} />
          <Tooltip
            cursor={{ fill: 'var(--color-line-2)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const row = payload[0]?.payload as { caption: string | null } | undefined;
              const total = payload.reduce((acc, item) => acc + Number(item.value ?? 0), 0);
              return (
                <div style={TOOLTIP_STYLE.contentStyle} className="bg-surface-1 px-3 py-2">
                  <p style={TOOLTIP_STYLE.labelStyle}>{row?.caption ?? formatDate(String(label))}</p>
                  <ul className="space-y-0.5">
                    {[...payload].reverse().map((item) => (
                      <li key={String(item.dataKey)} className="flex items-center gap-2">
                        <span aria-hidden className="size-2 shrink-0 rounded-pill" style={{ background: item.color }} />
                        <span className="flex-1 text-ink-3">{item.name}</span>
                        <span className="tnum font-semibold text-ink-1">{full(Number(item.value ?? 0))}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 flex justify-between gap-4 border-t border-line-2 pt-1 font-semibold text-ink-1">
                    <span>Total</span>
                    <span className="tnum">{full(total)}</span>
                  </p>
                </div>
              );
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            // Series order, not alphabetical: "Box 10–12" must not lead "Box 1–2".
            itemSorter={(item) => series.findIndex((s) => s.key === item.dataKey)}
            // The swatch carries the colour; the label stays in ink, because
            // the light tiers would be unreadable as text.
            formatter={(value) => <span style={{ color: 'var(--color-ink-3)' }}>{value}</span>}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="stack"
              name={s.label}
              fill={s.color}
              stroke="var(--color-surface-1)"
              strokeWidth={1}
              radius={i === series.length - 1 ? [3, 3, 0, 0] : 0}
              maxBarSize={32}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
