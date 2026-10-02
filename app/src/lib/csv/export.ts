/**
 * CSV export for the tables on screen.
 *
 * Exports carry **raw values, not display strings**: `1336500`, not
 * `Rp1.336.500`. A spreadsheet can format a number but cannot un-format one, so
 * writing the display string would make every column text and break every sum
 * downstream.
 */

/**
 * Comma, per RFC 4180 — what Google Sheets, Python, R and Excel's import
 * wizard all expect.
 *
 * Worth knowing: Excel running under an Indonesian locale expects `;` and will
 * drop a comma-delimited file into a single column until you run Text to
 * Columns. If that becomes a nuisance, switching this to ';' and DECIMAL to ','
 * is the whole change.
 */
const DELIMITER = ',';
const DECIMAL = '.';

/** Excel needs a BOM to read UTF-8; without it, "&" and "—" arrive mangled. */
const BOM = '﻿';

export type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  /** Header text. Name the unit here — "Spend (IDR)", "Weight (%)". */
  header: string;
  value: (row: T) => CsvValue;
}

/**
 * Encode one value.
 *
 * A field is quoted only when it has to be, which keeps files readable in a
 * plain text editor.
 */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    const text = Number.isInteger(value) ? String(value) : String(round(value, 4));
    return DECIMAL === '.' ? text : text.replace('.', DECIMAL);
  }

  const text = String(value);
  const needsQuoting =
    text.includes(DELIMITER) || text.includes('"') || text.includes('\n') || text.includes('\r');
  return needsQuoting ? `"${text.replace(/"/g, '""')}"` : text;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Build the file contents for a set of rows. */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => csvCell(c.header)).join(DELIMITER);
  const body = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(DELIMITER));
  // CRLF per RFC 4180; every tool accepts it, and Windows Notepad needs it.
  return [header, ...body].join('\r\n');
}

/**
 * Compose a filename that says what the file holds and how it was filtered.
 *
 * `rewards_welcome-box_cashback_2026-09-15.csv` beats `export (3).csv` once
 * three of these are sitting in a downloads folder.
 */
export function csvFileName(base: string, parts: Array<string | null | undefined> = []): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

  const suffix = parts.filter((p): p is string => Boolean(p && p.trim())).map(slug);
  return [slug(base), ...suffix].join('_') + '.csv';
}

/**
 * Hand the file to the browser.
 *
 * Kept apart from the encoding above so the interesting half stays testable in
 * Node, where there is no DOM.
 */
export function downloadCsv(fileName: string, contents: string): void {
  const blob = new Blob([BOM + contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Release the blob once the click has been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportCsv<T>(
  fileName: string,
  columns: CsvColumn<T>[],
  rows: T[],
): void {
  downloadCsv(fileName, toCsv(columns, rows));
}
