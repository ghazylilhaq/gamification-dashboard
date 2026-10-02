import { Fragment } from 'react';
import type { ScorecardRow, TrendGroup } from '@/lib/metrics/trends';
import { Table, TableWrap, Td, Th } from '../ui/Table';
import { Sparkline } from './Sparkline';
import { BaselineCell, ChangeCell, DayCell, formatValue } from './TrendCells';

const GROUPS: TrendGroup[] = ['Users', 'Activity', 'Claims', 'Cost'];

/**
 * Every daily metric on one screen: its latest full day (H-1), the change from
 * the day before, how that day compares with the week before it, and the
 * shape of the last two weeks. Grouped as the campaign funnel reads — users,
 * what they do, what they claim, what it costs.
 */
export function Scorecard({ rows }: { rows: ScorecardRow[] }) {
  return (
    <>
      <div className="hidden md:block">
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Metric</Th>
                <Th>Day</Th>
                <Th align="right">Value</Th>
                <Th align="right">vs prev. day</Th>
                <Th align="right">vs 7-day avg</Th>
                <Th className="pl-6">Last 14 days</Th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => {
                const groupRows = rows.filter((r) => r.metric.group === group);
                if (groupRows.length === 0) return null;
                return (
                  <Fragment key={group}>
                    <tr>
                      <th
                        colSpan={6}
                        scope="colgroup"
                        className="bg-surface-2 px-2 py-1.5 text-left text-micro font-semibold uppercase tracking-wide text-ink-4"
                      >
                        {group}
                      </th>
                    </tr>
                    {groupRows.map((row) => (
                      <tr key={row.metric.id} className="align-top">
                        <Td className="pr-4">
                          <span className="font-semibold text-ink-1">{row.metric.label}</span>
                          <span className="block text-micro text-ink-4">{row.metric.hint}</span>
                        </Td>
                        <Td><DayCell point={row.latest} /></Td>
                        <Td align="right">
                          <span className="font-semibold text-ink-1">
                            {row.latest ? formatValue(row.latest.value, row.metric.format) : '—'}
                          </span>
                        </Td>
                        <Td align="right"><ChangeCell change={row.vsPrevious} format={row.metric.format} /></Td>
                        <Td align="right"><BaselineCell row={row} format={row.metric.format} /></Td>
                        <Td className="pl-6"><Sparkline points={row.spark} format={row.metric.format} /></Td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </div>

      <div className="space-y-4 md:hidden">
        {GROUPS.map((group) => {
          const groupRows = rows.filter((r) => r.metric.group === group);
          if (groupRows.length === 0) return null;
          return (
            <section key={group} aria-label={group}>
              <h3 className="mb-1.5 text-micro font-semibold uppercase tracking-wide text-ink-4">{group}</h3>
              <ul className="space-y-2">
                {groupRows.map((row) => (
                  <li key={row.metric.id} className="rounded-control border border-line-1 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-1">{row.metric.label}</p>
                        <p className="text-micro text-ink-4"><DayCell point={row.latest} /></p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-lg font-bold text-ink-1">
                          {row.latest ? formatValue(row.latest.value, row.metric.format) : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3 text-micro">
                      <div className="space-y-0.5">
                        <p><span className="text-ink-4">vs prev. day </span><ChangeCell change={row.vsPrevious} format={row.metric.format} /></p>
                        <p><span className="text-ink-4">vs 7-day avg </span><BaselineCell row={row} format={row.metric.format} /></p>
                      </div>
                      <Sparkline points={row.spark} format={row.metric.format} width={88} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
