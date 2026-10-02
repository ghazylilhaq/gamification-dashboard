import type { Bootstrap } from './types';

export interface Viewer {
  email: string;
  canUpload: boolean;
  /** The admin area is gated by a shared password on this deployment. */
  needsPassword?: boolean;
}

export type BootstrapResponse = Bootstrap & { viewer: Viewer };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/**
 * The endpoints this UI calls.
 *
 * `GET /api/me` also exists server-side but is not used here — the viewer's
 * identity arrives with /api/bootstrap, so calling it would be a wasted round
 * trip.
 */
export const api = {
  bootstrap: () => request<BootstrapResponse>('/api/bootstrap'),
  uploads: () => request<{ uploads: unknown[] }>('/api/uploads'),
};
