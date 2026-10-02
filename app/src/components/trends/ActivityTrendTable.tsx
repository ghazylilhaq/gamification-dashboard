import { useState } from 'react';
import type { ActivityTrendRow } from '@/lib/metrics/trends';
import { formatNumber } from '@/lib/format';
import { Button } from '../ui/Button';
import { QUEST_COLORS } from '../charts/chartTheme';
import { Table, TableWrap, Td, Th } from '../ui/Table';
import { Sparkline } from './Sparkline';
import { BaselineCell, ChangeCell, DayCell } from './TrendCells';

const COLLAPSED = 10;

/**
 * Each activity's transactions on the latest day, against the day before and
 * its recent average — where a sudden drop in one activity shows up before it
 * moves the totals. Doubles as the table view of the stamps-by-quest chart.
 */
export function ActivityTrendTable({ rows }: { rows: ActivityTrendRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, COLLAPSED);

  const questLabel = (row: ActivityTrendRow) => (
    <span className="inline-flex items-center gap-1.5 text-micro text-ink-4">
      <span aria-hidden className="size-2 shrink-0 rounded-pill" style={{ background: QUEST_COLORS[row.questKey] }} />
      {row.quest}
    </span>
  );

  return (
    <>
      <div className="hidden md:block">
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Activity</Th>
                <Th>Day</Th>
                <Th align="right">Transactions</Th>
                <Th align="right">Stamps</Th>
                <Th align="right">vs prev. day</Th>
                <Th align="right">vs 7-day avg</Th>
                <Th className="pl-6">Last 14 days</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.metric.id} className="align-top">
                  <Td className="pr-4">
                    <span className="font-semibold text-ink-1">{row.metric.label}</span>
                    <span className="block">{questLabel(row)}</span>
                  </Td>
                  <Td><DayCell point={row.latest} /></Td>
                  <Td align="right" className="font-semibold text-ink-1">{formatNumber(row.latest?.value)}</Td>
                  <Td align="right">{formatNumber(row.stamps)}</Td>
                  <Td align="right"><ChangeCell change={row.vsPrevious} format="count" /></Td>
                  <Td align="right"><BaselineCell row={row} format="count" /></Td>
                  <Td className="pl-6"><Sparkline points={row.spark} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </div>

      <ul className="space-y-2 md:hidden">
        {shown.map((row) => (
          <li key={row.metric.id} className="rounded-control border border-line-1 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink-1">{row.metric.label}</p>
                {questLabel(row)}
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink-1 tnum">{formatNumber(row.latest?.value)}</p>
                <p className="text-micro text-ink-4">transactions</p>
              </div>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3 text-micro">
              <div className="space-y-0.5">
                <p><span className="text-ink-4">vs prev. day </span><ChangeCell change={row.vsPrevious} format="count" /></p>
                <p><span className="text-ink-4">vs 7-day avg </span><BaselineCell row={row} format="count" /></p>
              </div>
              <Sparkline points={row.spark} width={88} />
            </div>
          </li>
        ))}
      </ul>

      {rows.length > COLLAPSED && (
        <Button variant="secondary" className="mt-3" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show the busiest 10' : `Show all ${rows.length} activities`}
        </Button>
      )}
    </>
  );
}
