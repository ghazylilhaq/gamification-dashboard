import { describe, it, expect, beforeAll } from 'vitest';
import { csvCell, toCsv, csvFileName } from '@/lib/csv/export';
import { exportName } from '@/lib/csv/exportContext';
import {
  rewardColumns, couponColumns, cashbackColumns, budgetTypeColumns, boxColumns, gachaColumns,
  dailyBudgetColumns,
} from '@/lib/csv/columns';
import { buildDataset } from '@/lib/metrics/dataset';
import { rewardRows, sortByStockLeft } from '@/lib/metrics/rewards';
import { couponTable } from '@/lib/metrics/redemption';
import { cashbackTable, budgetByType, dailyBudgetSeries } from '@/lib/metrics/budget';
import { boxSummaries } from '@/lib/metrics/boxes';
import { gachaSeries } from '@/lib/metrics/gacha';
import { loadFixtureBootstrap } from './fixtures';
import type { Bootstrap } from '@/lib/types';

let boot: Bootstrap;
beforeAll(() => { boot = loadFixtureBootstrap(); });
const ds = () => buildDataset(boot, { showTestData: false });

/** Parse a CSV field-by-field, so quoting is actually checked. */
function parseRow(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out;
}

describe('CSV encoding', () => {
  it('quotes only the fields that need it', () => {
    expect(csvCell('Tokopedia')).toBe('Tokopedia');
    expect(csvCell('Fancam & Music')).toBe('Fancam & Music');
    expect(csvCell('Bag, large')).toBe('"Bag, large"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });

  it('writes raw numbers, not display strings', () => {
    // A spreadsheet can format a number; it cannot un-format "Rp1.336.500".
    expect(csvCell(1_336_500)).toBe('1336500');
    expect(csvCell(4.3125)).toBe('4.3125');
    expect(csvCell(0)).toBe('0');
  });

  it('writes nothing for absent values, rather than "null"', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(NaN)).toBe('');
    expect(csvCell(Infinity)).toBe('');
  });

  it('renders booleans as words a reader understands', () => {
    expect(csvCell(true)).toBe('yes');
    expect(csvCell(false)).toBe('no');
  });

  it('emits a header row and CRLF line endings', () => {
    const csv = toCsv([{ header: 'a', value: (r: { a: number }) => r.a }], [{ a: 1 }, { a: 2 }]);
    expect(csv).toBe('a\r\n1\r\n2');
  });
});

describe('file names', () => {
  it('describes the cut so a file is self-explanatory later', () => {
    expect(csvFileName('rewards', ['Welcome Box', 'CASHBACK'])).toBe('rewards_welcome-box_cashback.csv');
  });

  it('drops empty parts rather than leaving double separators', () => {
    expect(csvFileName('coupons', [null, undefined, '  '])).toBe('coupons.csv');
  });

  it('strips characters that do not belong in a filename', () => {
    expect(csvFileName('box-rewards', ['Fancam & Music Box', '24']))
      .toBe('box-rewards_fancam-music-box_24.csv');
  });

  it('records the active filters', () => {
    expect(exportName('rewards', { showTestData: false, from: null, to: null })).toBe('rewards.csv');
    expect(exportName('rewards', { showTestData: true, from: null, to: null }))
      .toBe('rewards_incl-test-data.csv');
    expect(exportName('rewards', { showTestData: false, from: '2026-09-15', to: '2026-09-16' }))
      .toBe('rewards_09-15-to-09-16.csv');
  });
});

describe('the exported tables', () => {
  it('exports one row per reward, with the ids to join on', () => {
    const rows = sortByStockLeft(rewardRows(ds()));
    const lines = toCsv(rewardColumns, rows).split('\r\n');
    expect(lines).toHaveLength(106); // header + 105 rewards

    const header = parseRow(lines[0]!);
    expect(header[0]).toBe('reward_id');
    expect(header).toContain('box_id');
    expect(header).toContain('spend (IDR)');

    // Scarcest reward sorts first, and its values are raw.
    const first = parseRow(lines[1]!);
    expect(first[header.indexOf('reward_name')]).toBe('Prime Bag by Zena');
    expect(first[header.indexOf('stock_total')]).toBe('6');
    expect(first[header.indexOf('stock_distributed')]).toBe('2');
  });

  it('writes percentages out of 100, not as fractions', () => {
    const rows = couponTable(ds()).filter((c) => c.redeemed > 0);
    const lines = toCsv(couponColumns, rows).split('\r\n');
    const header = parseRow(lines[0]!);
    const rateIdx = header.indexOf('redemption_rate (%)');
    // Tokopedia Rp5K in Welcome: 9 of 72 = 12,5%.
    const row = lines.slice(1).map(parseRow).find((r) => r[header.indexOf('claimed')] === '72')!;
    expect(row[rateIdx]).toBe('12.5');
  });

  it('carries the spec §6 totals through unchanged', () => {
    const lines = toCsv(budgetTypeColumns, budgetByType(ds())).split('\r\n');
    const header = parseRow(lines[0]!);
    const spend = header.indexOf('spend (IDR)');
    const rows = lines.slice(1).map(parseRow);
    expect(rows.map((r) => r[spend])).toEqual(['603000', '190000', '1358300']);
  });

  it('names the source of each daily cashback figure', () => {
    // The number means something different depending on where it came from.
    const lines = toCsv(dailyBudgetColumns, dailyBudgetSeries(ds())).split('\r\n');
    const header = parseRow(lines[0]!);
    const idx = header.indexOf('box_cashback_source');
    expect(parseRow(lines[1]!)[idx]).toBe('derived from claims');
  });

  it('labels the gacha user column so it cannot be summed by mistake', () => {
    const header = parseRow(toCsv(gachaColumns, gachaSeries(ds())).split('\r\n')[0]!);
    expect(header).toContain('users_claiming_that_day');
    expect(header).not.toContain('unique_users');
  });

  it('exports all 12 boxes with their stock and odds verdict', () => {
    const lines = toCsv(boxColumns, boxSummaries(ds())).split('\r\n');
    expect(lines).toHaveLength(13);
    const header = parseRow(lines[0]!);
    const welcome = parseRow(lines[1]!);
    expect(welcome[header.indexOf('box_id')]).toBe('13');
    expect(welcome[header.indexOf('stock_total')]).toBe('619221');
    expect(welcome[header.indexOf('scarcest_reward')]).toBeTruthy();
  });

  it('exports every cashback reward, summing to the known total', () => {
    const rows = cashbackTable(ds());
    const lines = toCsv(cashbackColumns, rows).split('\r\n');
    const header = parseRow(lines[0]!);
    const idx = header.indexOf('spend (IDR)');
    const total = lines.slice(1).map(parseRow).reduce((t, r) => t + Number(r[idx]), 0);
    expect(total).toBe(603_000);
  });

  it('round-trips a name containing a comma', () => {
    const rows = rewardRows(ds());
    const csv = toCsv(rewardColumns, rows);
    for (const line of csv.split('\r\n').slice(1)) {
      // Every row must parse back to the same column count as the header.
      expect(parseRow(line)).toHaveLength(rewardColumns.length);
    }
  });
});
