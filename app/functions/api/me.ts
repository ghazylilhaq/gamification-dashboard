import { json, type Env } from './_shared/env';
import { canUpload, hasAdminPassword, isLocalDev, viewerEmail } from './_shared/auth';

/** Who Cloudflare Access says is viewing, and whether they may upload. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  json({
    email: viewerEmail(request),
    canUpload: canUpload(request, env),
    isLocalDev: isLocalDev(request),
    // Lets the admin page know to ask for a password rather than guessing.
    needsPassword: hasAdminPassword(env) && !isLocalDev(request),
  });
