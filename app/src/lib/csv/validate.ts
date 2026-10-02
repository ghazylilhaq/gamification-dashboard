import type { FileTypeDef } from '../../config/fileTypes';

export interface ValidationResult {
  ok: boolean;
  missingColumns: string[];
  /** Columns present in the file but not required — informational only. */
  extraColumns: string[];
}

/**
 * Check that every required column is present. Extra columns are fine: the
 * exports carry plenty of fields we do not use, and new ones appearing should
 * not break an upload.
 */
export function validateColumns(def: FileTypeDef, headers: string[]): ValidationResult {
  const present = new Set(headers.map((h) => h.trim()));
  const missingColumns = def.requiredColumns.filter((c) => !present.has(c));
  const required = new Set(def.requiredColumns);
  const extraColumns = [...present].filter((c) => !required.has(c));
  return { ok: missingColumns.length === 0, missingColumns, extraColumns };
}

export function describeValidationError(def: FileTypeDef, result: ValidationResult): string | null {
  if (result.ok) return null;
  const plural = result.missingColumns.length === 1 ? 'column' : 'columns';
  return `${def.label} is missing ${result.missingColumns.length} required ${plural}: ${result.missingColumns.join(', ')}`;
}
