import { useCallback, useEffect, useState } from 'react';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { DropZone } from '@/components/admin/DropZone';
import { FileCard } from '@/components/admin/FileCard';
import { UploadHistory } from '@/components/admin/UploadHistory';
import { useDashboard } from '@/hooks/useDashboard';
import { api } from '@/lib/api';
import {
  describeChanges, duplicateSnapshotWarning, parseUploadFile, type ParsedFile,
} from '@/lib/upload';
import { DAILY_FILE_TYPES, REFERENCE_FILE_TYPES, type FileTypeId } from '@/config/fileTypes';
import type { UploadRecord } from '@/lib/types';
import { formatNumber } from '@/lib/format';
import { PasswordGate } from '@/components/admin/PasswordGate';
import { adminHeaders, useAdminPassword } from '@/hooks/useAdminPassword';

interface PublishResult {
  published: Array<{ type: FileTypeId; fileName: string; rowCount: number; mode?: string }>;
  rejected: Array<{ type: FileTypeId; fileName: string; reason: string }>;
  untouched: FileTypeId[];
}

export function AdminUpload() {
  const { raw, reload } = useDashboard();
  const [uploads, setUploads] = useState<UploadRecord[] | null>(null);
  const { password, remember, forget } = useAdminPassword();
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    api
      .uploads()
      .then((r) => setUploads(r.uploads as UploadRecord[]))
      .catch(() => setUploads([]));
  }, []);

  useEffect(loadHistory, [loadHistory]);

  // A shared password gates the UI; every write is re-checked server-side, so
  // skipping this screen and calling the API directly gets refused anyway.
  if (raw?.viewer.needsPassword && !password) {
    return <PasswordGate onSubmit={remember} error={passwordError} />;
  }

  if (raw && !raw.viewer.canUpload && !raw.viewer.needsPassword) {
    return (
      <ErrorState
        title="Upload access required"
        message="Your account can view the dashboard but not upload data. Ask the campaign team to add you to the admin Access policy."
      />
    );
  }

  /** A rejected password sends the gate back up with the reason. */
  function onRejected(message: string) {
    forget();
    setPasswordError(message);
  }

  return (
    <div className="space-y-4">
      <UploadSection
        title="Daily upload"
        description="The regular exports. Publishing a partial set is fine — files you leave out keep their current data."
        hint="daily_claim_gatcha · daily_claim_rewards · total_claim_rewards · daily_spent_reward · total_spent_reward · activity_level · blindbox_reach"
        allowed={DAILY_FILE_TYPES.map((f) => f.id)}
        endpoint="publish"
        password={password}
        onRejected={onRejected}
        onPublished={() => {
          reload();
          loadHistory();
        }}
      />


      <UploadSection
        title="Reference data"
        description="Box, reward and activity configuration — names, artwork, rarity, drop odds, stock and stamps per activity. Upload only when the campaign config changes."
        hint="blindbox · blindbox_reward · activity_list"
        allowed={REFERENCE_FILE_TYPES.map((f) => f.id)}
        endpoint="reference"
        password={password}
        onRejected={onRejected}
        onPublished={() => {
          reload();
          loadHistory();
        }}
      />

      {uploads === null ? (
        <Card label="Upload history"><p className="text-ink-4">Loading upload history…</p></Card>
      ) : (
        <UploadHistory uploads={uploads} />
      )}
    </div>
  );
}

function UploadSection({
  title,
  description,
  hint,
  allowed,
  endpoint,
  password,
  onRejected,
  onPublished,
}: {
  title: string;
  description: string;
  hint: string;
  allowed: FileTypeId[];
  endpoint: 'publish' | 'reference';
  password: string | null;
  onRejected: (message: string) => void;
  onPublished: () => void;
}) {
  const { raw } = useDashboard();
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(incoming: File[]) {
    setResult(null);
    setError(null);

    // Show each file as "checking" immediately, then fill in the parse result.
    const pending: ParsedFile[] = incoming.map((f) => ({
      id: `${f.name}:${f.size}:${f.lastModified}`,
      fileName: f.name,
      state: 'validating',
      def: null,
      exportAt: null,
      rows: [],
      rowCount: 0,
      dateRange: null,
      error: null,
      changes: [],
    }));
    setFiles((prev) => dedupe([...prev, ...pending]));

    for (const file of incoming) {
      const id = `${file.name}:${file.size}:${file.lastModified}`;
      const parsed = await parseUploadFile(file);

      const wrongSection =
        parsed.def && !allowed.includes(parsed.def.id)
          ? `${parsed.def.label} belongs in the ${endpoint === 'publish' ? 'Reference data' : 'Daily upload'} section.`
          : null;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...parsed,
                id,
                state: wrongSection ? 'error' : parsed.state,
                error: wrongSection ?? parsed.error,
                changes:
                  parsed.def && !wrongSection
                    ? describeChanges(parsed.def.id, parsed.rows, parsed.exportAt, raw)
                    : [],
              }
            : f,
        ),
      );
    }
  }

  const ready = files.filter((f) => f.state === 'ready' && f.def);
  const errored = files.filter((f) => f.state === 'error');
  const validating = files.some((f) => f.state === 'validating');
  const isPartial = ready.length > 0 && ready.length < allowed.length;

  async function publish() {
    setPublishing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...adminHeaders(password) },
        body: JSON.stringify({
          files: ready.map((f) => ({
            type: f.def!.id,
            fileName: f.fileName,
            exportAt: f.exportAt,
            rows: f.rows,
          })),
        }),
      });
      const body = (await res.json()) as PublishResult & { error?: string };
      // A rejected password sends the user back to the gate rather than
      // showing a publish error they cannot act on.
      if (res.status === 403) {
        onRejected(body.error ?? 'That password is not correct.');
        return;
      }
      if (!res.ok && body.error) throw new Error(body.error);
      setResult(body);
      // Keep only what was rejected, so a retry does not re-send what landed.
      const rejectedNames = new Set(body.rejected.map((r) => r.fileName));
      setFiles((prev) => prev.filter((f) => rejectedNames.has(f.fileName) || f.state === 'error'));
      if (body.published.length > 0) onPublished();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Card label={title}>
      <SectionHeader title={title} description={description} />

      {files.length === 0 && !result && (
        <DropZone
          onFiles={addFiles}
          label="Add the exported CSV files"
          hint={hint}
        />
      )}

      {files.length > 0 && (
        <>
          <ul className="space-y-2.5">
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                warning={
                  file.def ? duplicateSnapshotWarning(file.def.id, file.exportAt, raw) : null
                }
                onRemove={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))}
              />
            ))}
          </ul>

          <div className="mt-4">
            <DropZone onFiles={addFiles} label="Add more files" hint={hint} disabled={publishing} />
          </div>

          {error && <div className="mt-4"><ErrorState title="Publish failed" message={error} /></div>}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line-2 pt-4">
            <Button variant="primary" onClick={publish} disabled={ready.length === 0 || publishing || validating}>
              {publishing
                ? 'Publishing…'
                : ready.length === 0
                  ? 'Nothing to publish'
                  : `Publish ${ready.length} file${ready.length === 1 ? '' : 's'}`}
            </Button>
            <Button variant="ghost" onClick={() => { setFiles([]); setResult(null); setError(null); }} disabled={publishing}>
              Clear
            </Button>

            {validating && <p className="text-micro text-ink-4">Checking files…</p>}
            {!validating && isPartial && (
              <p className="text-micro text-ink-3">
                Partial publish · the other {allowed.length - ready.length} file
                {allowed.length - ready.length === 1 ? '' : 's'} keep their current data
              </p>
            )}
            {errored.length > 0 && (
              <p className="text-micro text-danger">
                {errored.length} file{errored.length === 1 ? '' : 's'} cannot be published
              </p>
            )}
          </div>
        </>
      )}

      {result && <PublishSummary result={result} />}
    </Card>
  );
}

function PublishSummary({ result }: { result: PublishResult }) {
  return (
    <div className="mt-4 space-y-3">
      {result.published.length > 0 && (
        <div className="rounded-control border border-success/25 bg-success-bg px-3 py-2.5">
          <p className="font-semibold text-success">
            Published {result.published.length} file{result.published.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-1 space-y-0.5">
            {result.published.map((f) => (
              <li key={f.fileName} className="text-micro text-ink-2">
                · {f.fileName} — {formatNumber(f.rowCount)} rows
              </li>
            ))}
          </ul>
          {result.untouched.length > 0 && (
            <p className="mt-2 text-micro text-ink-3">
              {result.untouched.length} file type
              {result.untouched.length === 1 ? '' : 's'} not included kept their previous data.
            </p>
          )}
        </div>
      )}

      {result.rejected.length > 0 && (
        <div className="rounded-control border border-danger/25 bg-danger-bg px-3 py-2.5">
          <p className="font-semibold text-danger">
            {result.rejected.length} file{result.rejected.length === 1 ? '' : 's'} rejected
          </p>
          <ul className="mt-1 space-y-0.5">
            {result.rejected.map((f) => (
              <li key={f.fileName} className="text-micro text-ink-2">
                · {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.published.length === 0 && result.rejected.length === 0 && (
        <EmptyState title="Nothing was published" />
      )}
    </div>
  );
}

/** The same file dropped twice replaces its earlier entry rather than doubling. */
function dedupe(files: ParsedFile[]): ParsedFile[] {
  const map = new Map<string, ParsedFile>();
  for (const f of files) map.set(f.id, f);
  return [...map.values()];
}
