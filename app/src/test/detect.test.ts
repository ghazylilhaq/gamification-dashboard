import { describe, it, expect } from 'vitest';
import { detectFileType, parseExportTimestamp, detect } from '@/lib/csv/detect';
import { validateColumns, describeValidationError } from '@/lib/csv/validate';
import { fileTypeById } from '@/config/fileTypes';
import { fixtureFiles } from './fixtures';
import { onboardFlag, reachBucket, rowErrors } from '@/lib/csv/parse';

describe('file type detection', () => {
  it('identifies each of the seven exports from its filename', () => {
    const cases: Array<[string, string]> = [
      ['daily_claim_gatcha_2026-09-15T12_19_52.018039+07_00.csv', 'daily_gacha'],
      ['daily_claim_rewards_2026-09-15T12_36_42.093034+07_00.csv', 'daily_rewards'],
      ['total_claim_rewards_2026-09-15T12_36_49.343206+07_00.csv', 'reward_snapshot'],
      ['daily_spent_reward_result_2026-09-15T13_40_36.991229+07_00.csv', 'daily_spend'],
      ['total_spent_reward_result_2026-09-15T13_51_34.335429+07_00.csv', 'spend_snapshot'],
      ['blindbox_reward_2026-09-15T12_18_09.747092+07_00.csv', 'blindbox_reward'],
      ['blindbox_2026-09-15T12_18_48.171643+07_00.csv', 'blindbox'],
      ['activity_level_2026-09-18T11_06_26.336875+07_00.csv', 'activity_snapshot'],
      ['activity_list_2026-09-18T10_38_57.372138+07_00.csv', 'activity_list'],
      ['blindbox_reach_2026-09-18T11_04_14.773487+07_00.csv', 'reach_snapshot'],
    ];
    for (const [fileName, expected] of cases) {
      expect(detectFileType(fileName)?.id, fileName).toBe(expected);
    }
  });

  it('keeps the two "total" exports apart', () => {
    // Both start with "total_" and both are cumulative snapshots, so a
    // careless substring match would collapse them into one.
    expect(detectFileType('total_spent_reward_result_2026-09-15T13_51_34.csv')?.id).toBe('spend_snapshot');
    expect(detectFileType('total_claim_rewards_2026-09-15T12_36_49.csv')?.id).toBe('reward_snapshot');
  });

  it('matches the spend exports with or without the "_result_" part', () => {
    // The prefixes are deliberately short, so both the exporter's current
    // naming and a shortened future one resolve to the same type.
    for (const name of [
      'daily_spent_reward_result_2026-09-15T13_40_36.csv',
      'daily_spent_reward_2026-09-15T13_40_36.csv',
    ]) {
      expect(detectFileType(name)?.id, name).toBe('daily_spend');
    }
    for (const name of [
      'total_spent_reward_result_2026-09-15T13_51_34.csv',
      'total_spent_reward_2026-09-15T13_51_34.csv',
    ]) {
      expect(detectFileType(name)?.id, name).toBe('spend_snapshot');
    }
  });

  it('still accepts the old hyphenated spend export name', () => {
    // Kept as a legacy alias so archived files can be re-uploaded.
    expect(detectFileType('total-spend-reward_result_2026-09-15T13_51_34.csv')?.id)
      .toBe('spend_snapshot');
  });

  it('matches blindbox_reach_ before the shorter blindbox_ prefix', () => {
    // Read as blindbox_, a reach file would be treated as box reference data.
    expect(detectFileType('blindbox_reach_2026-09-18T11_04_14.csv')?.id).toBe('reach_snapshot');
  });

  it('keeps the two activity files apart', () => {
    expect(detectFileType('activity_level_2026-09-18T11_06_26.csv')?.id).toBe('activity_snapshot');
    expect(detectFileType('activity_list_2026-09-18T10_38_57.csv')?.id).toBe('activity_list');
  });

  it('matches blindbox_reward_ before the shorter blindbox_ prefix', () => {
    expect(detectFileType('blindbox_reward_2026-09-15T12_18_09.csv')?.id).toBe('blindbox_reward');
  });

  it('ignores any directory part of the path', () => {
    expect(detectFileType('/Users/x/docs/total_spent_reward_result_2026-09-15T13_51_34.csv')?.id)
      .toBe('spend_snapshot');
  });

  it('returns null for an unrecognised name', () => {
    expect(detectFileType('quarterly_report.csv')).toBeNull();
    expect(detectFileType('spent_reward_result_2026-09-15T13_51_34.csv')).toBeNull();
  });
});

describe('export timestamp parsing', () => {
  it('reads the underscored ISO timestamp the exporter writes', () => {
    expect(parseExportTimestamp('total_spent_reward_result_2026-09-15T13_51_34_335429_07_00.csv'))
      .toBe('2026-09-15 13:51:34');
  });

  it('reads the dotted variant the files actually arrive with', () => {
    expect(parseExportTimestamp('daily_claim_rewards_2026-09-15T12_36_42.093034+07_00.csv'))
      .toBe('2026-09-15 12:36:42');
  });

  it('returns null when the name carries no timestamp', () => {
    expect(parseExportTimestamp('daily_claim_rewards.csv')).toBeNull();
  });

  it('detect() returns the type and the timestamp together', () => {
    const result = detect('daily_spent_reward_result_2026-09-15T13_40_36.991229+07_00.csv');
    expect(result?.def.id).toBe('daily_spend');
    expect(result?.exportAt).toBe('2026-09-15 13:40:36');
  });
});

describe('column validation', () => {
  it('accepts every real export', () => {
    for (const file of fixtureFiles()) {
      const headers = Object.keys(file.rows[0] ?? {});
      const result = validateColumns(file.def, headers);
      expect(result.missingColumns, `${file.fileName} missing columns`).toEqual([]);
      expect(result.ok).toBe(true);
    }
  });

  it('names every missing column in the error', () => {
    const def = fileTypeById('spend_snapshot');
    const result = validateColumns(def, ['id', 'name_en', 'type']);
    expect(result.ok).toBe(false);
    expect(result.missingColumns).toEqual([
      'coupon_ref_id', 'total_user_claimed', 'total_user_redeemed', 'spend_amount',
    ]);
    expect(describeValidationError(def, result)).toContain('spend_amount');
  });

  it('tolerates extra columns the exporter adds', () => {
    const def = fileTypeById('daily_gacha');
    const result = validateColumns(def, [...def.requiredColumns, 'some_new_column']);
    expect(result.ok).toBe(true);
    expect(result.extraColumns).toEqual(['some_new_column']);
  });

  it('rejects a file uploaded under the wrong type', () => {
    // The daily gacha columns against the daily rewards definition.
    const def = fileTypeById('daily_rewards');
    const result = validateColumns(def, ['claim_date', 'total_claim', 'total_claim_user', 'cashback_amount']);
    expect(result.ok).toBe(false);
    expect(result.missingColumns).toContain('reward_id');
  });
});

describe('reach bucket parsing', () => {
  it('maps the export labels to box numbers', () => {
    expect(reachBucket('<10 stamp')).toBe(0);
    expect(reachBucket('Reach box 1')).toBe(1);
    expect(reachBucket('Reach box 12')).toBe(12);
  });

  it('returns null for anything else, so the file can be rejected', () => {
    for (const label of ['Reach box 13', 'Reach box 0', 'box 3', '', '10 stamp']) {
      expect(reachBucket(label), label).toBeNull();
    }
  });

  it('accepts only Y and N as onboard flags', () => {
    expect(onboardFlag('Y')).toBe('Y');
    expect(onboardFlag(' n ')).toBe('N');
    expect(onboardFlag('yes')).toBeNull();
  });

  it('finds no row errors in the real reach export', () => {
    const file = fixtureFiles().find((f) => f.def.id === 'reach_snapshot')!;
    expect(rowErrors('reach_snapshot', file.rows)).toEqual([]);
    expect(file.rows).toHaveLength(16);
  });
});
