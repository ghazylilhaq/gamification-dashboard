import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DayRow, DayTable as DayTableData } from '@/lib/metrics/trends';
import { formatDate, formatNumber } from '@/lib/format';
import { EmptyState } from '../ui/states';
import { Button } from '../ui/Button';
import { HEAT_COLORS as HEAT } from '../charts/chartTheme';

/**
 * The first column stays put while the days scroll under it; a soft edge
 * shows that a half-hidden figure is scrolled, not cut short.
 */
const STICKY = 'sticky left-0 z-10 bg-surface-1 shadow-[6px_0_6px_-6px_rgb(26_26_26/0.25)]';

/** Shade step for a value relative to its row's busiest day. */
function heat(value: number, rowMax: number): string | undefined {
  if (value <= 0 || rowMax <= 0) return undefined;
  const step = Math.min(HEAT.length - 1, Math.floor((value / rowMax) * HEAT.length - 1e-9));
  return HEAT[Math.max(0, step)];
}

/**
 * Rows down the side (boxes, activities), every day across, one figure per
 * cell — so a row that suddenly speeds up or stalls stands out without reading
 * every number.
 *
 * Shading compares days within a row, not across rows: the Welcome Box or
 * Daily Login would otherwise outshine everything, and the small rows, where
 * movement often matters most, would never colour at all. A column covering a
 * missed export holds more than one day, so it is left unshaded and kept out
 * of the comparison; a day no export closes shows a dash. The table scrolls on
 * small screens and opens on the most recent day.
 */
export function DayTable({
  table,
  label,
  rowHeader,
  totalLabel,
  emptyTitle,
  emptyDescription,
  detailNote,
  marker,
  collapseAfter,
}: {
  table: DayTableData;
  /** Accessible name for the table. */
  label: string;
  rowHeader: string;
  totalLabel: string;
  emptyTitle: string;
  emptyDescription?: string;
  /** Explains the small text beside each row label. */
  detailNote?: string;
  /** A colour dot before the label, e.g. the activity's quest. */
  marker?: (row: DayRow) => string | undefined;
  /** Show this many rows until the reader asks for the rest. */
  collapseAfter?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [table]);

  if (table.columns.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const rows = collapseAfter && !expanded ? table.rows.slice(0, collapseAfter) : table.rows;
  const hasMissing = table.columns.some((c) => c.missing);
  const hasMultiDay = table.columns.some((c) => c.spanDays > 1);
  const comparable = (i: number) => !table.columns[i]!.missing && table.columns[i]!.spanDays === 1;

  return (
    <>
      {/* No edge bleed here, unlike TableWrap: scrolled cells would show
          through the gutter beside the sticky first column. */}
      <div ref={scroller} className="overflow-x-auto">
        <table aria-label={label} className="w-full border-separate border-spacing-0.5 text-left">
          <thead>
            <tr>
              <th className={`${STICKY} py-1.5 pr-3 text-micro font-semibold uppercase tracking-wide text-ink-4`}>
                {rowHeader}
              </th>
              {table.columns.map((c) => (
                <th
                  key={c.date}
                  scope="col"
                  className="px-1.5 py-1.5 text-right text-micro font-semibold whitespace-nowrap text-ink-4"
                >
                  {formatDate(c.date)}
                  {c.spanDays > 1 && !c.missing && <span title={`Covers ${c.spanDays} days`}> ({c.spanDays}d)</span>}
                </th>
              ))}
              <th scope="col" className="py-1.5 pl-3 text-right text-micro font-semibold uppercase tracking-wide whitespace-nowrap text-ink-4">
                {totalLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const values = row.values.filter((v, i): v is number => v !== null && comparable(i));
              // A flat row has nothing to compare, so it stays unshaded
              // rather than reading as uniformly busy.
              const flat = values.every((v) => v === values[0]);
              const rowMax = flat ? 0 : Math.max(0, ...values);
              const dot = marker?.(row);
              return (
                <tr key={row.key}>
                  <th scope="row" className={`${STICKY} py-1 pr-3 text-left font-normal whitespace-nowrap`}>
                    {dot && <span aria-hidden className="mr-1.5 inline-block size-2 rounded-pill" style={{ background: dot }} />}
                    <span className="font-semibold text-ink-1">{row.label}</span>
                    {row.detail !== null && <span className="ml-1.5 text-micro text-ink-4 tnum">{row.detail}</span>}
                  </th>
                  {row.values.map((v, i) => (
                    <Cell key={table.columns[i]!.date} shade={v !== null && comparable(i) ? heat(v, rowMax) : undefined} muted={v === 0}>
                      {v === null ? <span className="text-ink-5" title="No export closes this day">—</span>
                        : v < 0 ? `−${formatNumber(-v)}` : formatNumber(v)}
                    </Cell>
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
        {detailNote && <span>{detailNote}</span>}
        {hasMissing && <span>— no export closes that day</span>}
        {hasMultiDay && <span>(2d) an export was missed: the figure covers more than one day and is not shaded</span>}
      </div>
      {collapseAfter !== undefined && table.rows.length > collapseAfter && (
        <Button variant="secondary" className="mt-3" onClick={() => setExpanded((v) => !v)}>
          {expanded ? `Show the top ${collapseAfter}` : `Show all ${table.rows.length}`}
        </Button>
      )}
    </>
  );
}

function Cell({ shade, muted, children }: { shade: string | undefined; muted: boolean; children: ReactNode }) {
  return (
    <td className={`rounded-[4px] px-1.5 py-1 text-right tnum ${muted ? 'text-ink-5' : 'text-ink-1'}`} style={{ background: shade }}>
      {children}
    </td>
  );
}
