import { FILE_TYPES, type FileTypeDef } from '../../config/fileTypes';

export interface DetectionResult {
  def: FileTypeDef;
  /** Export timestamp parsed from the filename, 'YYYY-MM-DD HH:MM:SS' WIB. */
  exportAt: string | null;
}

/**
 * Identify a file by its name prefix, walking FILE_TYPES in order so that
 * longer, more specific prefixes win (see the note on FILE_TYPES).
 */
export function detectFileType(fileName: string): FileTypeDef | null {
  const base = fileName.replace(/^.*[\\/]/, '');
  return (
    FILE_TYPES.find((def) =>
      [def.prefix, ...(def.legacyPrefixes ?? [])].some((p) => base.startsWith(p)),
    ) ?? null
  );
}

/**
 * Pull the export timestamp out of a filename.
 *
 * The exporter writes an ISO timestamp with every character that is illegal in
 * a filename replaced by an underscore, so
 *   `..._2026-09-15T13_51_34_335429_07_00.csv`
 * is really `2026-09-15T13:51:34.335429+07:00`. We only need to second
 * precision, and the offset is always +07:00 (WIB), so it is ignored rather
 * than applied — the wall-clock time in the name is already the time we show.
 */
export function parseExportTimestamp(fileName: string): string | null {
  const base = fileName.replace(/^.*[\\/]/, '');
  const m = base.match(/(\d{4}-\d{2}-\d{2})T(\d{2})_(\d{2})_(\d{2})/);
  if (!m) return null;
  const [, date, hh, mm, ss] = m;
  return `${date} ${hh}:${mm}:${ss}`;
}

/** Date half of the export timestamp, used to label a partial day. */
export function exportDateOf(exportAt: string | null): string | null {
  return exportAt ? (exportAt.split(' ')[0] ?? null) : null;
}

export function detect(fileName: string): DetectionResult | null {
  const def = detectFileType(fileName);
  if (!def) return null;
  return { def, exportAt: parseExportTimestamp(fileName) };
}
