import { useMemo } from 'react';
import { Card, SectionHeader } from '../ui/Card';
import { SortSelect } from '../ui/SortSelect';
import { Table, TableWrap, Td, Th } from '../ui/Table';
import { EmptyState } from '../ui/states';
import { useTableSort, type SortColumns } from '@/hooks/useTableSort';
import { formatDateTimeWib, formatNumber } from '@/lib/format';
import { fileTypeById, type FileTypeId } from '@/config/fileTypes';
import type { UploadRecord } from '@/lib/types';

const BATCH_COLUMNS: SortColumns<Batch, 'time' | 'files' | 'uploadedBy' | 'status'> = {
  // Newest publish first, the order this list is normally read in.
  time: { label: 'Time', value: (b) => b.uploadedAt, defaultDir: 'desc', order: 'date' },
  files: { label: 'Files in publish', value: (b) => b.rows.length },
  uploadedBy: { label: 'Uploaded by', value: (b) => b.uploadedBy },
  // Rejected first on the second click — a failed publish is what someone
  // scanning this table is usually looking for.
  status: { label: 'Status', value: (b) => b.rows.filter((r) => r.status === 'published').length / b.rows.length },
};

/** Who uploaded what, when, and whether it landed. */
export function UploadHistory({ uploads }: { uploads: UploadRecord[] }) {
  // One row per publish, with its files listed together.
  const grouped = useMemo(() => groupByBatch(uploads), [uploads]);
  const sort = useTableSort(grouped, BATCH_COLUMNS, { key: 'time' }, (b) => b.key);
  const batches = sort.rows;

  return (
    <Card label="Upload history">
      <SectionHeader title="Upload history" description={`Every publish · sorted by ${sort.summary}`} />

      {batches.length === 0 ? (
        <EmptyState title="Nothing uploaded yet" description="Published files will be listed here." />
      ) : (
        <>
          {/* The card list below md has no headers to click. */}
          <SortSelect sort={sort} className="mb-3" />

          {/* Desktop table */}
          <div className="hidden md:block">
            <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th sort={sort.th('time')}>Time</Th>
                  <Th sort={sort.th('files')}>Files</Th>
                  <Th sort={sort.th('uploadedBy')}>Uploaded by</Th>
                  <Th sort={sort.th('status')}>Status</Th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.key} className="align-top">
                    <Td className="pr-4 whitespace-nowrap text-ink-2">
                      {formatDateTimeWib(batch.uploadedAt)}
                    </Td>
                    <Td className="pr-4">
                      <ul className="space-y-0.5">
                        {batch.rows.map((r) => (
                          <li key={r.id} className="text-ink-2">
                            {labelOf(r.file_type)}
                            <span className="text-ink-4">
                              {' '}· {formatNumber(r.row_count)} rows
                            </span>
                            {r.status !== 'published' && r.error && (
                              <span className="block text-micro text-danger">{r.error}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </Td>
                    <Td className="pr-4 whitespace-nowrap text-ink-3">{batch.uploadedBy}</Td>
                    <Td><StatusPill rows={batch.rows} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            </TableWrap>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2.5 md:hidden">
            {batches.map((batch) => (
              <li key={batch.key} className="rounded-control border border-line-1 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink-1">{formatDateTimeWib(batch.uploadedAt)}</p>
                  <StatusPill rows={batch.rows} />
                </div>
                <p className="mt-0.5 text-micro text-ink-4">{batch.uploadedBy}</p>
                <ul className="mt-2 space-y-0.5">
                  {batch.rows.map((r) => (
                    <li key={r.id} className="text-micro text-ink-2">
                      {labelOf(r.file_type)} · {formatNumber(r.row_count)} rows
                      {r.status !== 'published' && r.error && (
                        <span className="block text-danger">{r.error}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function StatusPill({ rows }: { rows: UploadRecord[] }) {
  const published = rows.filter((r) => r.status === 'published').length;
  const failed = rows.length - published;

  if (failed === 0) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-pill bg-success-bg px-2 py-0.5 text-micro font-semibold text-success">
        Published
      </span>
    );
  }
  if (published === 0) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-pill bg-danger-bg px-2 py-0.5 text-micro font-semibold text-danger">
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-pill bg-warn-bg px-2 py-0.5 text-micro font-semibold text-warn">
      {published} of {rows.length} published
    </span>
  );
}

function labelOf(type: string): string {
  try {
    return fileTypeById(type as FileTypeId).label;
  } catch {
    return type;
  }
}

interface Batch {
  key: string;
  uploadedAt: string;
  uploadedBy: string;
  rows: UploadRecord[];
}

function groupByBatch(uploads: UploadRecord[]): Batch[] {
  const map = new Map<string, Batch>();
  for (const row of uploads) {
    // Pre-batch rows and seed rows share a batch id, so fall back to the
    // timestamp to keep them from collapsing into one giant group.
    const key = `${row.batch_id ?? 'none'}:${row.uploaded_at}`;
    const existing = map.get(key);
    if (existing) existing.rows.push(row);
    else map.set(key, { key, uploadedAt: row.uploaded_at, uploadedBy: row.uploaded_by, rows: [row] });
  }
  return [...map.values()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}
