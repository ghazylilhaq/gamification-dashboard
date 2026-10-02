export interface Env {
  DB: D1Database;
  /**
   * Comma-separated emails allowed to upload. Optional: the /admin/* Access
   * policy is the real gate, this is a second belt for the write APIs.
   */
  UPLOAD_ALLOWLIST?: string;
  /**
   * Shared password for the admin upload area, checked on every write.
   *
   * Compared here rather than in the browser: anything the React bundle
   * compares against is readable by anyone who opens devtools, so a
   * client-side check would be decoration rather than a control.
   *
   * A short shared password keeps out a passer-by, not an attacker. It is not
   * a substitute for Cloudflare Access on data that matters.
   */
  ADMIN_PASSWORD?: string;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function badRequest(message: string, extra: Record<string, unknown> = {}): Response {
  return json({ error: message, ...extra }, 400);
}

export function serverError(message: string): Response {
  return json({ error: message }, 500);
}
