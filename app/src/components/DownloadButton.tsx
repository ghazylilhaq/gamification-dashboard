import { exportCsv, type CsvColumn } from '@/lib/csv/export';

/**
 * Downloads exactly the rows it is handed, so an export matches whatever the
 * page is currently showing rather than silently widening to the full table.
 */
export function DownloadButton<T>({
  fileName,
  columns,
  rows,
  label = 'CSV',
  title,
}: {
  fileName: string;
  columns: CsvColumn<T>[];
  rows: T[];
  label?: string;
  /** Overrides the generated tooltip when the row count needs explaining. */
  title?: string;
}) {
  const disabled = rows.length === 0;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => exportCsv(fileName, columns, rows)}
      title={title ?? (disabled ? 'Nothing to export' : `Download ${rows.length} rows as ${fileName}`)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-line-1 bg-surface-1 px-2.5 py-1.5 text-micro font-semibold text-ink-3 transition-colors hover:border-ink-5 hover:text-ink-1 disabled:cursor-not-allowed disabled:border-line-2 disabled:text-ink-5"
    >
      <span aria-hidden>↓</span>
      {label}
      <span className="sr-only"> — download {rows.length} rows as CSV</span>
    </button>
  );
}
