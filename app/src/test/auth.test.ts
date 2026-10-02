import { describe, it, expect } from 'vitest';
import {
  ADMIN_PASSWORD_HEADER, canUpload, hasAdminPassword, hasValidAdminPassword, isLocalRequest,
  requireUpload, viewerEmail,
} from '../../functions/api/_shared/auth';
import type { Env } from '../../functions/api/_shared/env';

const env = (allowlist?: string) => ({ UPLOAD_ALLOWLIST: allowlist } as Env);
const req = (url: string, email?: string) =>
  new Request(url, { headers: email ? { 'Cf-Access-Authenticated-User-Email': email } : {} });

const LOCAL = 'http://localhost:8788/api/publish';
const DEPLOYED = 'https://blindbox-dashboard.pages.dev/api/publish';

describe('write access', () => {
  it('refuses a deployed request with no Access header', () => {
    // Without this the local-dev fallback makes every write endpoint public
    // whenever Access is not in front of the site.
    expect(canUpload(req(DEPLOYED), env())).toBe(false);
    expect(viewerEmail(req(DEPLOYED))).toBe('anonymous');
    expect(requireUpload(req(DEPLOYED), env())?.status).toBe(403);
  });

  it('still refuses when an allowlist is configured', () => {
    expect(canUpload(req(DEPLOYED), env('team@allobank.com'))).toBe(false);
  });

  it('allows a local request, which cannot come from the internet', () => {
    expect(isLocalRequest(req(LOCAL))).toBe(true);
    expect(canUpload(req(LOCAL), env())).toBe(true);
    expect(viewerEmail(req(LOCAL))).toBe('local-dev');
    expect(requireUpload(req(LOCAL), env())).toBeNull();
  });

  it('does not treat a deployed host as local, however it is spelled', () => {
    for (const url of [
      'https://blindbox-dashboard.pages.dev/api/publish',
      'https://localhost.evil.com/api/publish',
      'https://blindbox.allobank.com/api/publish',
      'https://127.0.0.1.evil.com/api/publish',
    ]) {
      expect(isLocalRequest(req(url)), url).toBe(false);
    }
  });

  it('accepts an Access-authenticated request when no allowlist is set', () => {
    expect(canUpload(req(DEPLOYED, 'anyone@allobank.com'), env())).toBe(true);
  });

  it('narrows to the allowlist when one is set', () => {
    const e = env('team@allobank.com, lead@allobank.com');
    expect(canUpload(req(DEPLOYED, 'team@allobank.com'), e)).toBe(true);
    expect(canUpload(req(DEPLOYED, 'TEAM@allobank.com'), e)).toBe(true);
    expect(canUpload(req(DEPLOYED, 'viewer@allobank.com'), e)).toBe(false);
  });

  it('records the Access email as the actor', () => {
    expect(viewerEmail(req(DEPLOYED, 'ghazy@allobank.com'))).toBe('ghazy@allobank.com');
  });

  it('explains which of the two refusals happened', () => {
    const anon = requireUpload(req(DEPLOYED), env());
    const known = requireUpload(req(DEPLOYED, 'viewer@allobank.com'), env('team@allobank.com'));
    expect(anon?.status).toBe(403);
    expect(known?.status).toBe(403);
    return Promise.all([anon!.json(), known!.json()]).then(([a, k]) => {
      expect((a as { error: string }).error).toContain('did not come through Cloudflare Access');
      expect((k as { error: string }).error).toContain('not allowed to upload');
    });
  });
});

describe('the shared admin password', () => {
  const guarded = { ADMIN_PASSWORD: '1111' } as Env;
  const withPassword = (url: string, password: string) =>
    new Request(url, { headers: { [ADMIN_PASSWORD_HEADER]: password } });

  it('accepts the configured password on a deployed request', () => {
    expect(hasAdminPassword(guarded)).toBe(true);
    expect(hasValidAdminPassword(withPassword(DEPLOYED, '1111'), guarded)).toBe(true);
    expect(canUpload(withPassword(DEPLOYED, '1111'), guarded)).toBe(true);
    expect(requireUpload(withPassword(DEPLOYED, '1111'), guarded)).toBeNull();
  });

  it('refuses a wrong password, including near misses', () => {
    for (const attempt of ['1112', '111', '11111', '', '0000', '1 1 1 1']) {
      expect(hasValidAdminPassword(withPassword(DEPLOYED, attempt), guarded), attempt).toBe(false);
    }
  });

  it('tolerates the whitespace HTTP strips from header values', () => {
    // Surrounding whitespace is not part of a header's value per the HTTP
    // spec, so " 1111" arrives as "1111". Worth pinning so nobody later
    // "fixes" this into a trim() that changes behaviour.
    for (const padded of [' 1111', '1111 ', '  1111  ']) {
      expect(hasValidAdminPassword(withPassword(DEPLOYED, padded), guarded), padded).toBe(true);
    }
  });

  it('refuses a deployed request that sends no password at all', () => {
    expect(canUpload(req(DEPLOYED), guarded)).toBe(false);
  });

  it('is inert when no password is configured', () => {
    expect(hasAdminPassword(env())).toBe(false);
    expect(hasValidAdminPassword(withPassword(DEPLOYED, '1111'), env())).toBe(false);
    expect(canUpload(withPassword(DEPLOYED, '1111'), env())).toBe(false);
  });

  it('does not attribute the upload to a person', () => {
    // A shared password identifies nobody, so the audit trail says so rather
    // than inventing a user.
    expect(viewerEmail(withPassword(DEPLOYED, '1111'))).toBe('anonymous');
  });

  it('still honours Cloudflare Access when both are in play', () => {
    const both = { ADMIN_PASSWORD: '1111', UPLOAD_ALLOWLIST: 'team@allobank.com' } as Env;
    expect(canUpload(req(DEPLOYED, 'team@allobank.com'), both)).toBe(true);
    expect(canUpload(req(DEPLOYED, 'viewer@allobank.com'), both)).toBe(false);
    // The password remains a valid way in regardless of the allowlist.
    expect(canUpload(withPassword(DEPLOYED, '1111'), both)).toBe(true);
  });

  it('tells the user which of the refusals happened', async () => {
    const noPassword = requireUpload(req(DEPLOYED), guarded)!;
    const wrongPassword = requireUpload(withPassword(DEPLOYED, '9999'), guarded)!;
    expect((await noPassword.json() as { error: string }).error).toContain('needs the admin password');
    expect((await wrongPassword.json() as { error: string }).error).toContain('not correct');
  });
});
