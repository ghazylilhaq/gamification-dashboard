import { fileTypeById, type FileTypeId } from '../../../src/config/fileTypes';
import { TABLE_COLUMNS, normaliseRow, rowErrors, type RawRow } from '../../../src/lib/csv/parse';
import { buildInserts } from '../../../src/lib/sql';

/** One parsed file as submitted by the browser. */
export interface SubmittedFile {
  type: FileTypeId;
  fileName: string;
  exportAt: string | null;
  rows: RawRow[];
}

export interface PlannedStatement {
  sql: string;
}

export interface PlannedFile {
  type: FileTypeId;
  fileName: string;
  exportAt: string | null;
  rowCount: number;
  mode: 'replace' | 'snapshot';
  statements: PlannedStatement[];
}

export interface RejectedFile {
  type: FileTypeId;
  fileName: string;
  exportAt: string | null;
  reason: string;
}

export interface PublishPlan {
  accepted: PlannedFile[];
  rejected: RejectedFile[];
  /** Types not submitted at all — their existing data is left untouched. */
  untouched: FileTypeId[];
}

function insertStatements(type: FileTypeId, rows: RawRow[], exportAt: string): PlannedStatement[] {
  const def = fileTypeById(type);
  const values = rows.map((r) => normaliseRow(type, r, exportAt));
  return buildInserts(def.table, TABLE_COLUMNS[type], values).map((sql) => ({ sql }));
}

/**
 * Turn a set of submitted files into the exact statements to run.
 *
 * Kept free of any D1 dependency so the publish rules — full replace for daily
 * files, append-per-timestamp for totals, duplicate rejection, partial publish
 * — can be tested directly.
 *
 * @param existingSnapshots timestamps already stored, per snapshot file type.
 */
export function buildPublishPlan(
  files: SubmittedFile[],
  existingSnapshots: Partial<Record<FileTypeId, string[]>>,
  options: { allowedTypes?: FileTypeId[] } = {},
): PublishPlan {
  const allowed = options.allowedTypes ?? (Object.keys(TABLE_COLUMNS) as FileTypeId[]);
  const accepted: PlannedFile[] = [];
  const rejected: RejectedFile[] = [];
  const seenThisBatch = new Map<FileTypeId, string>();

  for (const file of files) {
    const def = fileTypeById(file.type);

    if (!allowed.includes(file.type)) {
      rejected.push({ ...pick(file), reason: `${def.label} is not accepted by this endpoint.` });
      continue;
    }
    if (!file.exportAt) {
      rejected.push({ ...pick(file), reason: 'Could not read an export timestamp from the filename.' });
      continue;
    }
    if (file.rows.length === 0) {
      rejected.push({ ...pick(file), reason: 'File contains no data rows.' });
      continue;
    }
    // Re-checked here even though the browser checks first: the API can be
    // called directly, and a bad bucket label would corrupt every reach figure.
    const problems = rowErrors(file.type, file.rows);
    if (problems.length > 0) {
      const shown = problems.slice(0, 3).join('; ');
      const more = problems.length > 3 ? ` (and ${problems.length - 3} more)` : '';
      rejected.push({ ...pick(file), reason: `${def.label} has invalid rows: ${shown}${more}` });
      continue;
    }
    if (seenThisBatch.has(file.type)) {
      rejected.push({ ...pick(file), reason: `Two ${def.label} files in one publish. Upload one at a time.` });
      continue;
    }
    if (def.mode === 'snapshot') {
      const existing = existingSnapshots[file.type] ?? [];
      if (existing.includes(file.exportAt)) {
        rejected.push({
          ...pick(file),
          reason: `A ${def.label} snapshot for ${file.exportAt} WIB is already stored. Upload a newer export.`,
        });
        continue;
      }
    }

    seenThisBatch.set(file.type, file.exportAt);
    const statements: PlannedStatement[] = [];
    // A replace file is a full-history export, so the table is emptied first
    // and rebuilt in the same batch — either both happen or neither does.
    if (def.mode === 'replace') statements.push({ sql: `DELETE FROM ${def.table}` });
    statements.push(...insertStatements(file.type, file.rows, file.exportAt));

    accepted.push({
      type: file.type,
      fileName: file.fileName,
      exportAt: file.exportAt,
      rowCount: file.rows.length,
      mode: def.mode,
      statements,
    });
  }

  const submitted = new Set(accepted.map((f) => f.type));
  const untouched = allowed.filter((t) => !submitted.has(t));

  return { accepted, rejected, untouched };
}

function pick(f: SubmittedFile) {
  return { type: f.type, fileName: f.fileName, exportAt: f.exportAt };
}
