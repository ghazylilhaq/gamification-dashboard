import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Papa from 'papaparse';
import { detect } from '../src/lib/csv/detect';
import { validateColumns, describeValidationError } from '../src/lib/csv/validate';
import type { RawRow } from '../src/lib/csv/parse';
import type { FileTypeDef } from '../src/config/fileTypes';

/** Where the real exports live. Shared by the seed script and the tests. */
export const CSV_DIR = resolve(import.meta.dirname, '../../docs');

export interface LoadedFile {
  def: FileTypeDef;
  fileName: string;
  exportAt: string;
  rows: RawRow[];
}

/**
 * Read every CSV in a directory, identifying each by filename and checking its
 * columns. Runs the exact same detection and validation path as a browser
 * upload, so seeding cannot drift from what the app accepts.
 */
export function loadCsvDir(dir = CSV_DIR): LoadedFile[] {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv'));
  const out: LoadedFile[] = [];

  for (const fileName of files) {
    const detected = detect(fileName);
    if (!detected) {
      console.warn(`  skipped (unrecognised name): ${fileName}`);
      continue;
    }
    if (!detected.exportAt) {
      console.warn(`  skipped (no export timestamp in name): ${fileName}`);
      continue;
    }

    const text = readFileSync(join(dir, fileName), 'utf8');
    const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
    const headers = parsed.meta.fields ?? [];
    const validation = validateColumns(detected.def, headers);
    if (!validation.ok) {
      throw new Error(describeValidationError(detected.def, validation) ?? `Invalid file: ${fileName}`);
    }

    out.push({ def: detected.def, fileName, exportAt: detected.exportAt, rows: parsed.data });
  }

  return out;
}
