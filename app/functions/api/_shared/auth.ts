import type { Env } from './env';

/** Used when the Access header is absent on a genuinely local request. */
export const LOCAL_DEV_USER = 'local-dev';

/**
 * The signed-in user's email, injected by Cloudflare Access.
 *
 * Access sits in front of the whole site, so in production this header is
 * always present and always trustworthy — it cannot be spoofed from outside
 * because requests never reach the app without passing Access first.
 */
export function viewerEmail(request: Request): string {
  const header = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim();
  if (header) return header;
  return isLocalRequest(request) ? LOCAL_DEV_USER : 'anonymous';
}

/**
 * Whether this request came from `wrangler pages dev` on this machine.
 *
 * The check is the request's own hostname, not an environment variable:
 * CF_PAGES and CF_PAGES_BRANCH are both set by `wrangler pages dev` too, so
 * they cannot tell local from deployed. A request that actually arrives at
 * localhost cannot have come from the internet.
 */
export function isLocalRequest(request: Request): boolean {
  try {
    const { hostname } = new URL(request.url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

export function isLocalDev(request: Request): boolean {
  return viewerEmail(request) === LOCAL_DEV_USER;
}

/** Header the admin page sends the shared password in. */
export const ADMIN_PASSWORD_HEADER = 'X-Admin-Password';

/** Whether a shared admin password is configured for this deployment. */
export function hasAdminPassword(env: Env): boolean {
  return Boolean(env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length > 0);
}

/**
 * Whether the request carries the correct shared admin password.
 *
 * Compared with a fixed-time scan rather than `===` so the comparison does not
 * leak the password's length or its matching prefix through timing. That is
 * cheap here and costs nothing.
 */
export function hasValidAdminPassword(request: Request, env: Env): boolean {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return false;
  const supplied = request.headers.get(ADMIN_PASSWORD_HEADER);
  if (!supplied) return false;

  if (supplied.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Whether this viewer may write.
 *
 * Gates, in order:
 *
 * 1. A local request is trusted — that is a developer on their own machine.
 * 2. The shared admin password, when one is configured. This is the control on
 *    the current deployment: the dashboard is readable by anyone with the link,
 *    and only writes are gated.
 * 3. A deployed request with **no Access header is otherwise refused.** Without
 *    this the local-dev fallback would make every write endpoint public during
 *    any window where Access is not in front of the site, and a misapplied
 *    Access policy later would silently reopen them.
 * 4. With a header, UPLOAD_ALLOWLIST narrows further if it is set. Once Access
 *    is configured it becomes the primary control and this is defence in depth,
 *    so a viewer who can reach the read-only site cannot POST to the API
 *    directly and bypass it.
 */
export function canUpload(request: Request, env: Env): boolean {
  if (isLocalRequest(request)) return true;
  if (hasValidAdminPassword(request, env)) return true;

  const email = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim();
  if (!email) return false;

  const allowlist = env.UPLOAD_ALLOWLIST?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!allowlist || allowlist.length === 0) return true; // gate is Access itself
  return allowlist.includes(email.toLowerCase());
}

export function requireUpload(request: Request, env: Env): Response | null {
  if (canUpload(request, env)) return null;

  const suppliedPassword = request.headers.get(ADMIN_PASSWORD_HEADER);
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');

  const message = suppliedPassword
    ? 'That password is not correct.'
    : hasAdminPassword(env) && !email
      ? 'This area needs the admin password.'
      : email
        ? 'Your account is not allowed to upload data. Ask the campaign team for access.'
        : 'This request did not come through Cloudflare Access, so it cannot write to the dashboard.';

  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
