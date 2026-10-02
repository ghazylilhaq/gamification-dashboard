import { json, badRequest, serverError, type Env } from './_shared/env';
import { requireUpload, viewerEmail } from './_shared/auth';
import { buildPublishPlan, type SubmittedFile } from './_shared/publishPlan';
import { REFERENCE_FILE_TYPES } from '../../src/config/fileTypes';
import { nowWib } from '../../src/lib/time';

/**
 * Replace the reference data (boxes and rewards).
 *
 * Kept separate from the daily publish because it changes the campaign's
 * configuration — names, odds, artwork — rather than its numbers, and is only
 * uploaded when that config actually changes.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = requireUpload(request, env);
  if (denied) return denied;

  let body: { files: SubmittedFile[] };
  try {
    body = await request.json();
  } catch {
    return badRequest('Request body was not valid JSON.');
  }
  if (!Array.isArray(body.files) || body.files.length === 0) {
    return badRequest('No files were submitted.');
  }

  const allowedTypes = REFERENCE_FILE_TYPES.map((f) => f.id);
  const plan = buildPublishPlan(body.files, {}, { allowedTypes });
  if (plan.accepted.length === 0) {
    return json({ published: [], rejected: plan.rejected, untouched: plan.untouched }, 409);
  }

  const uploadedBy = viewerEmail(request);
  const uploadedAt = nowWib();
  const batchId = crypto.randomUUID();

  try {
    await env.DB.batch(
      plan.accepted.flatMap((f) => f.statements.map((s) => env.DB.prepare(s.sql))),
    );
    await env.DB.batch(plan.accepted.map((f) =>
      env.DB.prepare(
        `INSERT INTO uploads (uploaded_at, uploaded_by, file_name, file_type, export_at, row_count, status, error, batch_id)
         VALUES (?,?,?,?,?,?,'published',NULL,?)`,
      ).bind(uploadedAt, uploadedBy, f.fileName, f.type, f.exportAt, f.rowCount, batchId),
    ));
  } catch (err) {
    return serverError(
      `Reference upload failed and nothing was changed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return json({
    published: plan.accepted.map((f) => ({ type: f.type, fileName: f.fileName, rowCount: f.rowCount })),
    rejected: plan.rejected,
    untouched: plan.untouched,
  });
};
