import Papa from 'papaparse';
import { detect } from './csv/detect';
import { validateColumns, describeValidationError } from './csv/validate';
import { dateRangeOf, num, type RawRow } from './csv/parse';
import type { FileTypeDef, FileTypeId } from '@/config/fileTypes';
import type { Bootstrap } from './types';
import { formatNumber, formatRupiah } from './format';

export type FileState = 'validating' | 'ready' | 'error';

export interface ParsedFile {
  id: string;
  fileName: string;
  state: FileState;
  def: FileTypeDef | null;
  exportAt: string | null;
  rows: RawRow[];
  rowCount: number;
  dateRange: { from: string; to: string } | null;
  error: string | null;
  /** Plain-language lines describing what publishing this would change. */
  changes: string[];
}

/** Parse in the browser, per the spec's architecture — the API receives JSON. */
export async function parseUploadFile(file: File): Promise<Omit<ParsedFile, 'id' | 'changes'>> {
  const detected = detect(file.name);

  if (!detected) {
    return {
      fileName: file.name, state: 'error', def: null, exportAt: null, rows: [], rowCount: 0,
      dateRange: null,
      error: 'Unrecognised file name. Expected one of the five daily exports or a reference file.',
    };
  }
  if (!detected.exportAt) {
    return {
      fileName: file.name, state: 'error', def: detected.def, exportAt: null, rows: [], rowCount: 0,
      dateRange: null,
      error: 'No export timestamp in the file name. Upload the file as exported, without renaming it.',
    };
  }

  const text = await file.text();
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields ?? [];
  const validation = validateColumns(detected.def, headers);

  if (!validation.ok) {
    return {
      fileName: file.name, state: 'error', def: detected.def, exportAt: detected.exportAt,
      rows: [], rowCount: 0, dateRange: null,
      error: describeValidationError(detected.def, validation),
    };
  }
  if (parsed.data.length === 0) {
    return {
      fileName: file.name, state: 'error', def: detected.def, exportAt: detected.exportAt,
      rows: [], rowCount: 0, dateRange: null, error: 'The file has headers but no data rows.',
    };
  }

  return {
    fileName: file.name,
    state: 'ready',
    def: detected.def,
    exportAt: detected.exportAt,
    rows: parsed.data,
    rowCount: parsed.data.length,
    dateRange: dateRangeOf(detected.def.id, parsed.data),
    error: null,
  };
}

/**
 * Describe what publishing a file would change, so nobody has to publish to
 * find out. Compares the incoming rows against what is currently stored.
 */
export function describeChanges(
  type: FileTypeId,
  rows: RawRow[],
  exportAt: string | null,
  current: Bootstrap | null,
): string[] {
  if (!current) return [];
  const out: string[] = [];

  switch (type) {
    case 'daily_gacha': {
      const incoming = rows.reduce((t, r) => t + num(r['total_claim']), 0);
      const existing = current.dailyGacha.reduce((t, r) => t + r.total_claim, 0);
      out.push(`Replaces all ${formatNumber(current.dailyGacha.length)} stored gacha days with ${formatNumber(rows.length)}`);
      out.push(...deltaLine('Gacha claims', existing, incoming));
      break;
    }
    case 'daily_rewards': {
      const incoming = rows.reduce((t, r) => t + num(r['total_claim']), 0);
      const existing = current.dailyRewards.reduce((t, r) => t + r.total_claim, 0);
      const newDates = countNewDates(rows, 'claim_date', current.dailyRewards.map((r) => r.claim_date));
      out.push(`Replaces all ${formatNumber(current.dailyRewards.length)} stored rows with ${formatNumber(rows.length)}`);
      out.push(...deltaLine('Box claims', existing, incoming));
      if (newDates > 0) out.push(`${newDates} new date${newDates === 1 ? '' : 's'}`);
      break;
    }
    case 'daily_spend': {
      const incoming = rows.reduce((t, r) => t + num(r['spend_amount']), 0);
      const existing = current.dailySpend.reduce((t, r) => t + r.spend_amount, 0);
      out.push(`Replaces all ${formatNumber(current.dailySpend.length)} stored rows with ${formatNumber(rows.length)}`);
      out.push(...deltaLineRupiah('Daily spend', existing, incoming));
      break;
    }
    case 'reward_snapshot': {
      const incoming = rows.reduce((t, r) => t + num(r['total_claim']), 0);
      const existing = current.rewardSnapshot.reduce((t, r) => t + r.total_claim, 0);
      out.push(`Adds a new snapshot at ${exportAt} WIB, keeping ${current.freshness.reward_snapshot ? 'the previous one' : 'nothing (this is the first)'}`);
      if (current.rewardSnapshot.length > 0) {
        out.push(...deltaLine('Cumulative claims', existing, incoming));
      }
      break;
    }
    case 'spend_snapshot': {
      const incoming = rows.reduce((t, r) => t + num(r['spend_amount']), 0);
      const existing = current.spendSnapshot.reduce((t, r) => t + r.spend_amount, 0);
      const incomingRedeemed = rows
        .filter((r) => r['type'] === 'COUPON')
        .reduce((t, r) => t + num(r['total_user_redeemed']), 0);
      const existingRedeemed = current.spendSnapshot
        .filter((r) => r.type === 'COUPON')
        .reduce((t, r) => t + r.total_user_redeemed, 0);
      out.push(`Adds a new snapshot at ${exportAt} WIB, keeping ${current.freshness.spend_snapshot ? 'the previous one' : 'nothing (this is the first)'}`);
      if (current.spendSnapshot.length > 0) {
        out.push(...deltaLineRupiah('Cumulative spend', existing, incoming));
        out.push(...deltaLine('Coupons redeemed', existingRedeemed, incomingRedeemed));
      }
      break;
    }
    case 'blindbox': {
      out.push(`Replaces all ${formatNumber(current.boxes.length)} boxes with ${formatNumber(rows.length)}`);
      break;
    }
    case 'blindbox_reward': {
      out.push(`Replaces all ${formatNumber(current.rewards.length)} rewards with ${formatNumber(rows.length)}`);
      break;
    }
  }

  return out;
}

function deltaLine(label: string, from: number, to: number): string[] {
  if (from === to) return [`${label} unchanged at ${formatNumber(to)}`];
  const delta = to - from;
  return [`${label} ${formatNumber(from)} → ${formatNumber(to)} (${delta > 0 ? '+' : '−'}${formatNumber(Math.abs(delta))})`];
}

function deltaLineRupiah(label: string, from: number, to: number): string[] {
  if (from === to) return [`${label} unchanged at ${formatRupiah(to)}`];
  const delta = to - from;
  return [`${label} ${formatRupiah(from)} → ${formatRupiah(to)} (${delta > 0 ? '+' : '−'}${formatRupiah(Math.abs(delta))})`];
}

function countNewDates(rows: RawRow[], column: string, existing: string[]): number {
  const known = new Set(existing);
  const incoming = new Set(rows.map((r) => (r[column] ?? '').slice(0, 10)).filter(Boolean));
  return [...incoming].filter((d) => !known.has(d)).length;
}

/** A duplicate snapshot timestamp is rejected server-side; warn before sending. */
export function duplicateSnapshotWarning(
  type: FileTypeId,
  exportAt: string | null,
  current: Bootstrap | null,
): string | null {
  if (!current || !exportAt) return null;
  const stored =
    type === 'reward_snapshot'
      ? [current.freshness.reward_snapshot, current.freshness.prev_reward_snapshot]
      : type === 'spend_snapshot'
        ? [current.freshness.spend_snapshot, current.freshness.prev_spend_snapshot]
        : [];
  return stored.includes(exportAt)
    ? `A snapshot for ${exportAt} WIB is already stored. Publishing will reject this file — upload a newer export.`
    : null;
}
