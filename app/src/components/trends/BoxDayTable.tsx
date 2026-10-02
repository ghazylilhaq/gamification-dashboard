import { useEffect, useRef } from 'react';
import type { BoxDayTable as BoxDayTableData } from '@/lib/metrics/trends';
import { formatDate, formatNumber } from '@/lib/format';
import { EmptyState } from '../ui/states';
import { HEAT_COLORS as HEAT } from '../charts/chartTheme';

/** Shade step for a value relative to its row's busiest day. */
function heat(value: number, rowMax: number): string | undefined {
  if (value <= 0 || rowMax <= 0) return undefined;
  const step = Math.min(HEAT.length - 1, Math.floor((value / rowMax) * HEAT.length - 1e-9));
  return HEAT[Math.max(0, step)];
}

/**
 * Boxes down the side, days across, one figure per cell — so a box that
 * suddenly speeds up or stalls stands out without reading every number.
 *
 * Shading compares days within a row, not across rows: the Welcome Box would
 * otherwise outshine everything and the high boxes, where movement matters
 * most late in the campaign, would never colour at all. A column covering a
 * missed export holds more than one day, so it is left unshaded and kept out
 * of the comparison. The table scrolls on small screens and opens on the most
 * recent day.
 */
export function BoxDayTable({
  table,
  label,
  totalLabel,
  emptyTitle,
  emptyDescription,
}: {
  table: BoxDayTableData;
  /** Accessible name for the table. */
  label: string;
  totalLabel: string;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [table]);

  if (table.columns.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const hasPartial = table.columns.some((c) => c.partial);
  const hasMultiDay = table.columns.some((c) => c.spanDays > 1);

  return (
    <>
      {/* No edge bleed here, unlike TableWrap: scrolled cells would show
          through the gutter beside the sticky box column. */}
      <div ref={scroller} className="overflow-x-auto">
        <table aria-label={label} className="w-full border-separate border-spacing-0.5 text-left">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface-1 py-1.5 pr-3 text-micro font-semibold uppercase tracking-wide text-ink-4">
                Box
              </th>
              {table.columns.map((c) => (
                <th
                  key={c.date}
                  scope="col"
                  className="px-1.5 py-1.5 text-right text-micro font-semibold whitespace-nowrap text-ink-4"
                >
                  {formatDate(c.date)}
                  {c.partial && <span title="Day still in progress"> *</span>}
                  {c.spanDays > 1 && <span title={`Covers ${c.spanDays} days`}> ({c.spanDays}d)</span>}
                </th>
              ))}
              <th scope="col" className="py-1.5 pl-3 text-right text-micro font-semibold uppercase tracking-wide whitespace-nowrap text-ink-4">
                {totalLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => {
              const comparable = row.values.filter((_, i) => table.columns[i]!.spanDays === 1);
              // A flat row has nothing to compare, so it stays unshaded
              // rather than reading as uniformly busy.
              const flat = comparable.every((v) => v === comparable[0]);
              const rowMax = flat ? 0 : Math.max(0, ...comparable);
              return (
                <tr key={row.box}>
                  <th scope="row" className="sticky left-0 z-10 bg-surface-1 py-1 pr-3 text-left font-normal whitespace-nowrap">
                    <span className="font-semibold text-ink-1">{row.name}</span>
                    {row.stampRequired !== null && (
                      <span className="ml-1.5 text-micro text-ink-4 tnum">{row.stampRequired}</span>
                    )}
                  </th>
                  {row.values.map((v, i) => (
                    <td
                      key={table.columns[i]!.date}
                      className={`rounded-[4px] px-1.5 py-1 text-right tnum ${v === 0 ? 'text-ink-5' : 'text-ink-1'}`}
                      style={{ background: table.columns[i]!.spanDays === 1 ? heat(v, rowMax) : undefined }}
                    >
                      {v < 0 ? `−${formatNumber(-v)}` : formatNumber(v)}
                    </td>
                  ))}
                  <td className="py-1 pl-3 text-right font-semibold tnum text-ink-1">{formatNumber(row.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-ink-4">
        <span className="flex items-center gap-1">
          fewer
          {HEAT.map((c) => (
            <span key={c} aria-hidden className="inline-block h-3 w-4 rounded-[3px]" style={{ background: c }} />
          ))}
          more, within each row
        </span>
        <span>Numbers beside box names are stamps required.</span>
        {hasPartial && <span>* day still in progress</span>}
        {hasMultiDay && <span>(2d) an export was missed: the figure covers more than one day and is not shaded</span>}
      </div>
    </>
  );
}
