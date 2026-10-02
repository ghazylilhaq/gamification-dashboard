import { describe, it, expect } from 'vitest';
import { buildPublishPlan, type SubmittedFile } from '../../functions/api/_shared/publishPlan';
import type { FileTypeId } from '@/config/fileTypes';
import { DAILY_FILE_TYPES } from '@/config/fileTypes';
import { sqlLiteral } from '@/lib/sql';

const DAILY_TYPES = DAILY_FILE_TYPES.map((f) => f.id);

function file(type: FileTypeId, exportAt: string | null, rows = 3): SubmittedFile {
  // Reach rows are validated row by row, so they need real bucket labels —
  // one per distinct bucket, since a repeated bucket is itself an error.
  const row = (i: number) =>
    type === 'reach_snapshot'
      ? { is_onboard_yn: 'Y', box_stamp: i === 0 ? '<10 stamp' : `Reach box ${i}`, mdc_id: '10' }
      : { claim_date: '2026-09-15', reward_id: String(i), id: String(i) };
  return {
    type,
    fileName: `${type}_${exportAt ?? 'unknown'}.csv`,
    exportAt,
    rows: Array.from({ length: rows }, (_, i) => row(i)),
  };
}

const opts = { allowedTypes: DAILY_TYPES };

describe('replace vs snapshot', () => {
  it('clears the table before reloading a full-history daily file', () => {
    const plan = buildPublishPlan([file('daily_rewards', '2026-09-15 12:36:42')], {}, opts);
    const [accepted] = plan.accepted;
    expect(accepted?.mode).toBe('replace');
    expect(accepted?.statements[0]?.sql).toBe('DELETE FROM daily_rewards');
    expect(accepted?.statements.slice(1).every((s) => s.sql.startsWith('INSERT'))).toBe(true);
  });

  it('appends a total file without touching the snapshots already stored', () => {
    const plan = buildPublishPlan(
      [file('spend_snapshot', '2026-09-15 13:51:34')],
      { spend_snapshot: ['2026-09-14 13:00:00'] },
      opts,
    );
    const [accepted] = plan.accepted;
    expect(accepted?.mode).toBe('snapshot');
    expect(accepted?.statements.some((s) => s.sql.startsWith('DELETE'))).toBe(false);
  });

  it('keys each snapshot row by the export timestamp from the filename', () => {
    const plan = buildPublishPlan([file('spend_snapshot', '2026-09-15 13:51:34', 1)], {}, opts);
    expect(plan.accepted[0]?.statements[0]?.sql).toContain("('2026-09-15 13:51:34'");
  });
});

describe('duplicate snapshots', () => {
  it('rejects a timestamp already stored for that file type', () => {
    const plan = buildPublishPlan(
      [file('reward_snapshot', '2026-09-15 12:36:49')],
      { reward_snapshot: ['2026-09-15 12:36:49'] },
      opts,
    );
    expect(plan.accepted).toEqual([]);
    expect(plan.rejected[0]?.reason).toContain('already stored');
  });

  it('allows the same timestamp under a different file type', () => {
    const plan = buildPublishPlan(
      [file('spend_snapshot', '2026-09-15 12:36:49')],
      { reward_snapshot: ['2026-09-15 12:36:49'] },
      opts,
    );
    expect(plan.accepted).toHaveLength(1);
  });

  it('re-publishing a daily file at the same timestamp is fine', () => {
    // Daily files replace wholesale, so there is nothing to duplicate.
    const plan = buildPublishPlan(
      [file('daily_gacha', '2026-09-15 12:19:52')],
      { reward_snapshot: ['2026-09-15 12:19:52'] },
      opts,
    );
    expect(plan.accepted).toHaveLength(1);
  });
});

describe('partial publish', () => {
  it('publishes the files present and lists the rest as untouched', () => {
    const plan = buildPublishPlan(
      [file('daily_gacha', '2026-09-15 12:19:52'), file('daily_rewards', '2026-09-15 12:36:42')],
      {},
      opts,
    );
    expect(plan.accepted.map((f) => f.type)).toEqual(['daily_gacha', 'daily_rewards']);
    // The three not uploaded keep whatever data they already hold.
    expect(plan.untouched.sort()).toEqual([
      'activity_snapshot', 'daily_spend', 'reach_snapshot', 'reward_snapshot', 'spend_snapshot',
    ]);
    expect(plan.accepted.flatMap((f) => f.statements).some((s) => s.sql.includes('daily_spend'))).toBe(false);
  });

  it('accepts the good files even when one alongside them is rejected', () => {
    const plan = buildPublishPlan(
      [
        file('daily_gacha', '2026-09-15 12:19:52'),
        file('spend_snapshot', '2026-09-15 13:51:34'),
      ],
      { spend_snapshot: ['2026-09-15 13:51:34'] },
      opts,
    );
    expect(plan.accepted.map((f) => f.type)).toEqual(['daily_gacha']);
    expect(plan.rejected.map((f) => f.type)).toEqual(['spend_snapshot']);
  });

  it('publishes all seven regular files at once', () => {
    const plan = buildPublishPlan(
      DAILY_TYPES.map((t) => file(t, '2026-09-15 12:00:00')),
      {},
      opts,
    );
    expect(plan.accepted).toHaveLength(7);
    expect(plan.untouched).toEqual([]);
  });
});

describe('rejections', () => {
  it('rejects a file whose name carries no export timestamp', () => {
    const plan = buildPublishPlan([file('daily_gacha', null)], {}, opts);
    expect(plan.rejected[0]?.reason).toContain('export timestamp');
  });

  it('rejects an empty file', () => {
    const plan = buildPublishPlan([file('daily_gacha', '2026-09-15 12:19:52', 0)], {}, opts);
    expect(plan.rejected[0]?.reason).toContain('no data rows');
  });

  it('rejects two files of the same type in one publish', () => {
    const plan = buildPublishPlan(
      [file('daily_gacha', '2026-09-15 12:19:52'), file('daily_gacha', '2026-09-15 13:00:00')],
      {},
      opts,
    );
    expect(plan.accepted).toHaveLength(1);
    expect(plan.rejected[0]?.reason).toContain('one at a time');
  });

  it('rejects reference data sent to the daily endpoint', () => {
    const plan = buildPublishPlan([file('blindbox', '2026-09-15 12:18:48')], {}, opts);
    expect(plan.accepted).toEqual([]);
    expect(plan.rejected[0]?.reason).toContain('not accepted by this endpoint');
  });
});

describe('statement batching', () => {
  it('keeps every statement under D1\'s 100 KB limit', () => {
    const plan = buildPublishPlan([file('daily_spend', '2026-09-15 13:40:36', 1575)], {}, opts);
    const inserts = plan.accepted[0]?.statements.filter((s) => s.sql.startsWith('INSERT')) ?? [];
    expect(inserts.length).toBeGreaterThan(0);
    for (const s of inserts) expect(s.sql.length).toBeLessThan(100_000);
  });

  it('packs the whole spend file into a handful of statements', () => {
    // D1 allows only 100 bound parameters per query, which would force ~160
    // statements for this file. Inline literals keep it to a few.
    const plan = buildPublishPlan([file('daily_spend', '2026-09-15 13:40:36', 1575)], {}, opts);
    expect(plan.accepted[0]?.statements.length).toBeLessThan(20);
  });

  it('writes one tuple per row', () => {
    const plan = buildPublishPlan([file('daily_gacha', '2026-09-15 12:19:52', 3)], {}, opts);
    const insert = plan.accepted[0]?.statements[1]?.sql ?? '';
    expect(insert.match(/\(/g)?.length).toBe(4); // column list + 3 value tuples
  });
});

describe('SQL literal encoding', () => {
  it('escapes quotes in reward names', () => {
    expect(sqlLiteral("Wendy's Discount of Rp5K")).toBe("'Wendy''s Discount of Rp5K'");
  });

  it('neutralises a value that tries to close the statement', () => {
    const encoded = sqlLiteral("x'); DROP TABLE daily_spend; --");
    expect(encoded).toBe("'x''); DROP TABLE daily_spend; --'");
    // The payload stays inside one string literal; no statement boundary opens.
    expect(encoded.slice(1, -1).split("''").join('')).not.toContain("'");
  });

  it('writes null as NULL and keeps numbers unquoted', () => {
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral(1336500)).toBe('1336500');
    expect(sqlLiteral(4.3)).toBe('4.3');
  });

  it('never emits NaN or Infinity into a numeric column', () => {
    expect(sqlLiteral(NaN)).toBe('0');
    expect(sqlLiteral(Infinity)).toBe('0');
  });

  it('passes unicode through untouched', () => {
    expect(sqlLiteral('Fancam & Music — Seoul')).toBe("'Fancam & Music — Seoul'");
  });
});

describe('reach file validation', () => {
  const reach = (rows: Array<Record<string, string>>): SubmittedFile => ({
    type: 'reach_snapshot',
    fileName: 'blindbox_reach_2026-09-18T11_04_14.csv',
    exportAt: '2026-09-18 11:04:14',
    rows,
  });

  it('accepts real bucket labels', () => {
    const plan = buildPublishPlan(
      [reach([
        { is_onboard_yn: 'N', box_stamp: '<10 stamp', mdc_id: '258740' },
        { is_onboard_yn: 'Y', box_stamp: 'Reach box 12', mdc_id: '6' },
      ])],
      {},
      opts,
    );
    expect(plan.accepted).toHaveLength(1);
  });

  it('rejects an unrecognised bucket instead of filing it under "under 10 stamps"', () => {
    const plan = buildPublishPlan(
      [reach([{ is_onboard_yn: 'Y', box_stamp: 'Reached box three', mdc_id: '5' }])],
      {},
      opts,
    );
    expect(plan.accepted).toEqual([]);
    expect(plan.rejected[0]?.reason).toContain('unrecognised box_stamp');
  });

  it('rejects an onboard flag other than Y or N', () => {
    const plan = buildPublishPlan(
      [reach([{ is_onboard_yn: 'yes', box_stamp: 'Reach box 1', mdc_id: '5' }])],
      {},
      opts,
    );
    expect(plan.rejected[0]?.reason).toContain('must be Y or N');
  });

  it('rejects a bucket that appears twice for the same flag', () => {
    // Two rows for one bucket would be double-counted on every total.
    const plan = buildPublishPlan(
      [reach([
        { is_onboard_yn: 'Y', box_stamp: 'Reach box 1', mdc_id: '5' },
        { is_onboard_yn: 'Y', box_stamp: 'Reach box 1', mdc_id: '7' },
      ])],
      {},
      opts,
    );
    expect(plan.rejected[0]?.reason).toContain('duplicate bucket');
  });

  it('rejects a reach snapshot already stored, like the other totals', () => {
    const plan = buildPublishPlan(
      [file('reach_snapshot', '2026-09-18 11:04:14')],
      { reach_snapshot: ['2026-09-18 11:04:14'] },
      opts,
    );
    expect(plan.rejected[0]?.reason).toContain('already stored');
  });

  it('rejects an activity snapshot already stored', () => {
    const plan = buildPublishPlan(
      [file('activity_snapshot', '2026-09-18 11:06:26')],
      { activity_snapshot: ['2026-09-18 11:06:26'] },
      opts,
    );
    expect(plan.rejected[0]?.reason).toContain('already stored');
  });
});
