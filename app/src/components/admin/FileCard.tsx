import type { ParsedFile } from '@/lib/upload';
import { formatDate, formatDateTimeWib, formatNumber } from '@/lib/format';
import { Button } from '../ui/Button';
import { NeutralBadge } from '../ui/Badge';

/** Per-file status: detected type, column check, row count, dates, export time. */
export function FileCard({
  file,
  warning,
  onRemove,
}: {
  file: ParsedFile;
  warning?: string | null;
  onRemove: () => void;
}) {
  const isError = file.state === 'error';

  return (
    <li
      className={`rounded-card border px-3 py-3 sm:px-4 ${
        isError ? 'border-danger/30 bg-danger-bg' : 'border-line-1 bg-surface-1'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink-1">{file.def?.label ?? 'Unrecognised file'}</p>
            {file.state === 'validating' && <NeutralBadge>Checking…</NeutralBadge>}
            {file.state === 'ready' && (
              <span className="inline-flex items-center rounded-pill bg-success-bg px-2 py-0.5 text-micro font-semibold text-success">
                Columns OK
              </span>
            )}
            {isError && (
              <span className="inline-flex items-center rounded-pill bg-danger px-2 py-0.5 text-micro font-semibold text-white">
                Error
              </span>
            )}
            {file.def?.mode === 'snapshot' && <NeutralBadge>Snapshot</NeutralBadge>}
            {file.def?.mode === 'replace' && <NeutralBadge>Replaces table</NeutralBadge>}
          </div>

          <p className="mt-0.5 truncate font-mono text-micro text-ink-4" title={file.fileName}>
            {file.fileName}
          </p>

          {file.state === 'ready' && (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-micro text-ink-3">
              <Fact label="Rows" value={formatNumber(file.rowCount)} />
              <Fact label="Exported" value={formatDateTimeWib(file.exportAt)} />
              {file.dateRange && (
                <Fact
                  label="Dates"
                  value={
                    file.dateRange.from === file.dateRange.to
                      ? formatDate(file.dateRange.from)
                      : `${formatDate(file.dateRange.from)} – ${formatDate(file.dateRange.to)}`
                  }
                />
              )}
            </dl>
          )}

          {isError && <p className="mt-2 text-ink-2">{file.error}</p>}

          {warning && (
            <p className="mt-2 rounded-control bg-warn-bg px-2.5 py-1.5 text-micro text-ink-2">
              {warning}
            </p>
          )}

          {file.changes.length > 0 && (
            <div className="mt-3 border-t border-line-2 pt-2">
              <p className="text-micro font-semibold uppercase tracking-wide text-ink-4">
                What changes
              </p>
              <ul className="mt-1 space-y-0.5">
                {file.changes.map((c) => (
                  <li key={c} className="text-micro text-ink-2">
                    · {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Button variant="ghost" onClick={onRemove} className="shrink-0 px-2 py-1">
          Remove<span className="sr-only"> {file.fileName}</span>
        </Button>
      </div>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline text-ink-4">{label}: </dt>
      <dd className="inline font-semibold tnum text-ink-2">{value}</dd>
    </div>
  );
}
