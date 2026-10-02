import { json, badRequest, serverError, type Env } from './_shared/env';
import { requireUpload, viewerEmail } from './_shared/auth';
import { buildPublishPlan, type SubmittedFile } from './_shared/publishPlan';
import { DAILY_FILE_TYPES, FILE_TYPES, type FileTypeId } from '../../src/config/fileTypes';
import { nowWib } from '../../src/lib/time';

interface PublishBody {
  files: SubmittedFile[];
}

/**
 * Publish a daily upload.
 *
 * A partial publish is deliberately allowed: the five exports are produced at
 * different times and one being late should not block the other four. Any file
 * type not in the request is simply left as it was.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = requireUpload(request, env);
  if (denied) return denied;

  let body: PublishBody;
  try {
    body = await request.json();
  } catch {
    return badRequest('Request body was not valid JSON.');
  }
  if (!Array.isArray(body.files) || body.files.length === 0) {
    return badRequest('No files were submitted.');
  }

  const allowedTypes = DAILY_FILE_TYPES.map((f) => f.id);
  const existingSnapshots = await loadSnapshotTimestamps(env.DB);
  const plan = buildPublishPlan(body.files, existingSnapshots, { allowedTypes });

  const uploadedBy = viewerEmail(request);
  const uploadedAt = nowWib();
  const batchId = crypto.randomUUID();

  if (plan.accepted.length === 0) {
    await recordUploads(env.DB, plan.rejected.map((f) => ({
      uploadedAt, uploadedBy, batchId, fileName: f.fileName, fileType: f.type,
      exportAt: f.exportAt, rowCount: 0, status: 'rejected', error: f.reason,
    })));
    return json({ published: [], rejected: plan.rejected, untouched: plan.untouched }, 409);
  }

  try {
    // One batch, so a failure part-way cannot leave a table emptied by its
    // DELETE but not refilled by the INSERTs that follow.
    const statements = plan.accepted.flatMap((file) =>
      file.statements.map((s) => env.DB.prepare(s.sql)),
    );
    await env.DB.batch(statements);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordUploads(env.DB, plan.accepted.map((f) => ({
      uploadedAt, uploadedBy, batchId, fileName: f.fileName, fileType: f.type,
      exportAt: f.exportAt, rowCount: f.rowCount, status: 'failed', error: message,
    })));
    return serverError(`Publish failed and nothing was changed: ${message}`);
  }

  await recordUploads(env.DB, [
    ...plan.accepted.map((f) => ({
      uploadedAt, uploadedBy, batchId, fileName: f.fileName, fileType: f.type,
      exportAt: f.exportAt, rowCount: f.rowCount, status: 'published', error: null,
    })),
    ...plan.rejected.map((f) => ({
      uploadedAt, uploadedBy, batchId, fileName: f.fileName, fileType: f.type,
      exportAt: f.exportAt, rowCount: 0, status: 'rejected', error: f.reason,
    })),
  ]);

  return json({
    published: plan.accepted.map((f) => ({
      type: f.type, fileName: f.fileName, exportAt: f.exportAt, rowCount: f.rowCount, mode: f.mode,
    })),
    rejected: plan.rejected,
    untouched: plan.untouched,
    batchId,
  });
};

/**
 * Every stored export timestamp, for every snapshot type.
 *
 * Derived from FILE_TYPES rather than listed by hand: a snapshot type missing
 * from this map would skip the duplicate check, and re-uploading the same
 * export would then double every count it holds.
 */
async function loadSnapshotTimestamps(db: D1Database): Promise<Partial<Record<FileTypeId, string[]>>> {
  const snapshotTypes = FILE_TYPES.filter((f) => f.mode === 'snapshot');
  const results = await Promise.all(
    snapshotTypes.map((f) => db.prepare(`SELECT DISTINCT snapshot_at FROM ${f.table}`).all()),
  );
  const out: Partial<Record<FileTypeId, string[]>> = {};
  snapshotTypes.forEach((f, i) => {
    out[f.id] = (results[i]!.results as Array<{ snapshot_at: string }>).map((r) => r.snapshot_at);
  });
  return out;
}

interface UploadLogRow {
  uploadedAt: string; uploadedBy: string; batchId: string; fileName: string;
  fileType: string; exportAt: string | null; rowCount: number; status: string; error: string | null;
}

async function recordUploads(db: D1Database, rows: UploadLogRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.batch(rows.map((r) =>
    db.prepare(
      `INSERT INTO uploads (uploaded_at, uploaded_by, file_name, file_type, export_at, row_count, status, error, batch_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).bind(r.uploadedAt, r.uploadedBy, r.fileName, r.fileType, r.exportAt, r.rowCount, r.status, r.error, r.batchId),
  ));
}
