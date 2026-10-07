/**
 * Test harness for rendering pages against the real CSV data.
 *
 * `fetch` is stubbed with the fixture bootstrap so a page renders exactly the
 * figures the spec's launch-day section describes — the same check the phase-1
 * verification page did, now against the real UI.
 */
import { afterEach, vi } from 'vitest';
import { cleanup, render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DashboardProvider } from '@/hooks/useDashboard';
import { loadFixtureBootstrap } from './fixtures';
import type { Bootstrap } from '@/lib/types';

export interface HarnessOptions {
  /** Simulate a deployment where no blindbox_reach export has been uploaded. */
  withoutReach?: boolean;
  /** Simulate no activity_level / activity_list upload. */
  withoutActivity?: boolean;
  /** Put reach and claims on the same export date, so conversion is shown. */
  sameDayReach?: boolean;
  uploads?: unknown[];
  /** Deployment gates the admin area behind a shared password. */
  needsPassword?: boolean;
  /**
   * Replay launch day onto this many following dates. The fixture is a single
   * partial day, which is too little history for anything that needs a recent
   * window — the budget projection above all.
   */
  extraDays?: number;
}

export function stubApi(options: HarnessOptions = {}): Bootstrap {
  const boot = loadFixtureBootstrap();
  if (options.withoutReach) {
    boot.reachSnapshot = [];
    boot.freshness.reach_snapshot = null;
  }
  if (options.withoutActivity) {
    boot.activitySnapshot = [];
    boot.activities = [];
    boot.freshness.activity_snapshot = null;
  }
  if (options.sameDayReach && boot.freshness.daily_rewards) {
    boot.freshness.reach_snapshot = boot.freshness.daily_rewards;
  }

  if (options.extraDays) {
    const shift = (date: string, days: number) =>
      new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + days))
        .toISOString().slice(0, 10);
    const days = [...Array(options.extraDays).keys()].map((i) => i + 1);
    boot.dailyRewards = boot.dailyRewards.concat(
      days.flatMap((d) => boot.dailyRewards.map((r) => ({ ...r, claim_date: shift(r.claim_date, d) }))),
    );
    boot.dailyGacha = boot.dailyGacha.concat(
      days.flatMap((d) => boot.dailyGacha.map((r) => ({ ...r, claim_date: shift(r.claim_date, d) }))),
    );
    boot.dailySpend = boot.dailySpend.concat(
      days.flatMap((d) => boot.dailySpend.map((r) => ({ ...r, date: shift(r.date, d) }))),
    );
  }

  const payload = {
    ...boot,
    viewer: {
      email: options.needsPassword ? 'anonymous' : 'test@allobank.com',
      canUpload: true,
      needsPassword: options.needsPassword ?? false,
    },
  };

  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = String(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
    if (url.includes('/api/bootstrap')) return jsonResponse(payload);
    if (url.includes('/api/uploads')) return jsonResponse({ uploads: options.uploads ?? [] });
    return jsonResponse({ error: `Unstubbed request: ${url}` }, 404);
  }));

  return boot;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function renderWithProviders(ui: ReactNode, route = '/'): RenderResult {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <DashboardProvider>{ui}</DashboardProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
