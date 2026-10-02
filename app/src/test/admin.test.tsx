// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AdminUpload } from '@/pages/AdminUpload';
import { renderWithProviders, stubApi } from './setup';
import { CSV_DIR } from '../../scripts/loadCsvs';
import { describeChanges, duplicateSnapshotWarning } from '@/lib/upload';
import { loadFixtureBootstrap, fixtureFiles } from './fixtures';

/** A real export, as a File the drop zone can accept. */
function csvFile(prefix: string): File {
  const name = fixtureFiles().find((f) => f.fileName.startsWith(prefix))!.fileName;
  const content = readFileSync(join(CSV_DIR, name), 'utf8');
  return new File([content], name, { type: 'text/csv' });
}

async function renderAdmin() {
  stubApi();
  renderWithProviders(<AdminUpload />, '/admin/upload');
  await waitFor(() => expect(screen.getByRole('region', { name: 'Daily upload' })).toBeTruthy());
}

function section(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

describe('Admin upload page', () => {
  it('starts empty, with the five expected file names named', async () => {
    await renderAdmin();
    const daily = section('Daily upload');
    expect(within(daily).getByText('Add the exported CSV files')).toBeTruthy();
    expect(within(daily).getByText(/total_spent_reward/)).toBeTruthy();
    expect(within(daily).getByText(/Publishing a partial set is fine/)).toBeTruthy();
  });

  it('separates the reference upload from the daily one', async () => {
    await renderAdmin();
    expect(within(section('Reference data')).getByText(/blindbox_reward/)).toBeTruthy();
  });

  it('detects a dropped file, checks its columns and previews what changes', async () => {
    await renderAdmin();
    const user = userEvent.setup();
    const input = section('Daily upload').querySelector('input[type=file]') as HTMLInputElement;

    await user.upload(input, csvFile('daily_claim_rewards_'));

    await waitFor(() => expect(screen.getByText('Daily box reward claims')).toBeTruthy());
    expect(screen.getByText('Columns OK')).toBeTruthy();
    expect(screen.getByText('Replaces table')).toBeTruthy();
    // Row count, export time and date range.
    expect(screen.getByText('69')).toBeTruthy();
    expect(screen.getByText('15 Sep, 12:36 WIB')).toBeTruthy();
    expect(screen.getByText('29 Agu – 15 Sep')).toBeTruthy();
    expect(screen.getByText('What changes')).toBeTruthy();
  });

  it('offers a partial publish when only some regular files are added', async () => {
    await renderAdmin();
    const user = userEvent.setup();
    const input = section('Daily upload').querySelector('input[type=file]') as HTMLInputElement;

    await user.upload(input, csvFile('daily_claim_gatcha_'));
    await waitFor(() => expect(screen.getByText('Publish 1 file')).toBeTruthy());
    expect(screen.getByText(/the other 6 files keep their current data/)).toBeTruthy();
  });

  it('reports a column error and refuses to publish the file', async () => {
    await renderAdmin();
    const user = userEvent.setup();
    const input = section('Daily upload').querySelector('input[type=file]') as HTMLInputElement;

    const broken = new File(
      ['claim_date,total_claim\n2026-09-15,5\n'],
      'daily_claim_gatcha_2026-09-15T12_19_52.csv',
      { type: 'text/csv' },
    );
    await user.upload(input, broken);

    await waitFor(() => expect(screen.getByText('Error')).toBeTruthy());
    expect(screen.getByText(/missing 2 required columns: total_claim_user, cashback_amount/)).toBeTruthy();
    expect(screen.getByText('Nothing to publish')).toBeTruthy();
    expect(screen.getByText('1 file cannot be published')).toBeTruthy();
  });

  it('rejects a file whose name carries no export timestamp', async () => {
    await renderAdmin();
    const user = userEvent.setup();
    const input = section('Daily upload').querySelector('input[type=file]') as HTMLInputElement;

    await user.upload(input, new File(['claim_date\n'], 'daily_claim_gatcha_final.csv', { type: 'text/csv' }));
    await waitFor(() => expect(screen.getByText(/No export timestamp in the file name/)).toBeTruthy());
  });

  it('rejects an unrecognised file name', async () => {
    await renderAdmin();
    const user = userEvent.setup();
    const input = section('Daily upload').querySelector('input[type=file]') as HTMLInputElement;

    await user.upload(input, new File(['a,b\n1,2\n'], 'quarterly_summary.csv', { type: 'text/csv' }));
    await waitFor(() => expect(screen.getByText('Unrecognised file')).toBeTruthy());
  });

  it('sends reference data to the right section', async () => {
    await renderAdmin();
    const user = userEvent.setup();
    const input = section('Daily upload').querySelector('input[type=file]') as HTMLInputElement;

    await user.upload(input, csvFile('blindbox_reward_'));
    await waitFor(() =>
      expect(screen.getByText(/Reward reference data belongs in the Reference data section/)).toBeTruthy(),
    );
  });

  it('warns before publishing a snapshot timestamp that is already stored', async () => {
    await renderAdmin();
    const user = userEvent.setup();
    const input = section('Daily upload').querySelector('input[type=file]') as HTMLInputElement;

    await user.upload(input, csvFile('total_spent_reward_'));
    await waitFor(() =>
      expect(screen.getByText(/A snapshot for 2026-09-15 13:51:34 WIB is already stored/)).toBeTruthy(),
    );
  });

  it('publishes and reports what landed and what was left alone', async () => {
    await renderAdmin();
    const user = userEvent.setup();
    const input = section('Daily upload').querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(input, csvFile('daily_claim_gatcha_'));
    await waitFor(() => expect(screen.getByText('Publish 1 file')).toBeTruthy());

    // Take over fetch for the publish call only.
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/publish')) {
        return new Response(
          JSON.stringify({
            published: [{ type: 'daily_gacha', fileName: 'daily_claim_gatcha_x.csv', rowCount: 12 }],
            rejected: [],
            untouched: ['daily_rewards', 'reward_snapshot', 'daily_spend', 'spend_snapshot'],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return original(input as never, init);
    }));

    await user.click(screen.getByText('Publish 1 file'));
    await waitFor(() => expect(screen.getByText('Published 1 file')).toBeTruthy());
    expect(screen.getByText(/4 file types not included kept their previous data/)).toBeTruthy();
  });

  it('surfaces a publish failure without clearing the queue', async () => {
    await renderAdmin();
    const user = userEvent.setup();
    const input = section('Daily upload').querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(input, csvFile('daily_claim_gatcha_'));
    await waitFor(() => expect(screen.getByText('Publish 1 file')).toBeTruthy());

    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'D1 write failed and nothing was changed' }), { status: 500 }),
    ));

    await user.click(screen.getByText('Publish 1 file'));
    await waitFor(() => expect(screen.getByText('Publish failed')).toBeTruthy());
    expect(screen.getByText('D1 write failed and nothing was changed')).toBeTruthy();
    // The file is still queued for a retry.
    expect(screen.getByText('Publish 1 file')).toBeTruthy();
  });
});

describe('user onboard', () => {
  it('is no longer entered by hand — there is no form for it', async () => {
    stubApi();
    renderWithProviders(<AdminUpload />, '/admin/upload');
    await waitFor(() => expect(screen.getByRole('region', { name: 'Daily upload' })).toBeTruthy());
    expect(screen.queryByRole('region', { name: 'User onboard' })).toBeNull();
    expect(screen.queryByLabelText(/Users onboarded/)).toBeNull();
  });

  it('lists blindbox_reach among the regular uploads, where it now comes from', async () => {
    stubApi();
    renderWithProviders(<AdminUpload />, '/admin/upload');
    await waitFor(() => expect(screen.getByRole('region', { name: 'Daily upload' })).toBeTruthy());
    const daily = screen.getByRole('region', { name: 'Daily upload' });
    expect(within(daily).getByText(/blindbox_reach/)).toBeTruthy();
    expect(within(daily).getByText(/activity_level/)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Reference data' })).getByText(/activity_list/)).toBeTruthy();
  });
});

describe('what-changes preview', () => {
  it('describes a daily replace against the stored data', () => {
    const boot = loadFixtureBootstrap();
    const file = fixtureFiles().find((f) => f.def.id === 'daily_rewards')!;
    const lines = describeChanges('daily_rewards', file.rows, file.exportAt, boot);
    expect(lines[0]).toContain('Replaces all 69 stored rows with 69');
    expect(lines.join(' ')).toContain('Box claims unchanged');
  });

  it('describes a snapshot as an addition that keeps the previous one', () => {
    const boot = loadFixtureBootstrap();
    const file = fixtureFiles().find((f) => f.def.id === 'spend_snapshot')!;
    const lines = describeChanges('spend_snapshot', file.rows, '2026-09-15 15:00:00', boot);
    expect(lines[0]).toContain('Adds a new snapshot at 2026-09-15 15:00:00 WIB');
    expect(lines[0]).toContain('keeping the previous one');
  });

  it('flags a duplicate snapshot timestamp before the server rejects it', () => {
    const boot = loadFixtureBootstrap();
    expect(duplicateSnapshotWarning('spend_snapshot', '2026-09-15 13:51:34', boot)).toContain('already stored');
    expect(duplicateSnapshotWarning('spend_snapshot', '2026-09-15 15:00:00', boot)).toBeNull();
    // Daily files replace wholesale, so there is nothing to duplicate.
    expect(duplicateSnapshotWarning('daily_gacha', '2026-09-15 12:19:52', boot)).toBeNull();
  });
});

describe('the shared admin password gate', () => {
  beforeEach(() => {
    try { sessionStorage.clear(); } catch { /* ignore */ }
  });

  it('asks for the password before showing the upload tools', async () => {
    stubApi({ needsPassword: true });
    renderWithProviders(<AdminUpload />, '/admin/upload');

    await waitFor(() => expect(screen.getByRole('region', { name: 'Admin password' })).toBeTruthy());
    expect(screen.getByText('Internal team area')).toBeTruthy();
    // The upload tools are not rendered at all until it is entered.
    expect(screen.queryByRole('region', { name: 'Daily upload' })).toBeNull();
  });

  it('says an upload under a shared password is not attributed to a person', async () => {
    stubApi({ needsPassword: true });
    renderWithProviders(<AdminUpload />, '/admin/upload');
    await waitFor(() => expect(screen.getByText('Internal team area')).toBeTruthy());
    expect(screen.getByText(/recorded as/)).toBeTruthy();
    expect(screen.getByText('anonymous')).toBeTruthy();
  });

  it('reveals the upload tools once a password is entered', async () => {
    stubApi({ needsPassword: true });
    renderWithProviders(<AdminUpload />, '/admin/upload');
    await waitFor(() => expect(screen.getByText('Internal team area')).toBeTruthy());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Password/), '1111');
    await user.click(screen.getByText('Continue'));

    await waitFor(() => expect(screen.getByRole('region', { name: 'Daily upload' })).toBeTruthy());
  });

  it('sends the password with a publish and returns to the gate when refused', async () => {
    stubApi({ needsPassword: true });
    renderWithProviders(<AdminUpload />, '/admin/upload');
    await waitFor(() => expect(screen.getByText('Internal team area')).toBeTruthy());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Password/), '9999');
    await user.click(screen.getByText('Continue'));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Daily upload' })).toBeTruthy());

    const input = screen.getByRole('region', { name: 'Daily upload' })
      .querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(input, csvFile('daily_claim_gatcha_'));
    await waitFor(() => expect(screen.getByText('Publish 1 file')).toBeTruthy());

    let sentPassword: string | null = null;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/publish')) {
        sentPassword = new Headers(init?.headers).get('X-Admin-Password');
        return new Response(JSON.stringify({ error: 'That password is not correct.' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }));

    await user.click(screen.getByText('Publish 1 file'));

    // The password travelled with the request, and the refusal sent the user
    // back to the gate rather than showing an unactionable publish error.
    await waitFor(() => expect(screen.getByText('Internal team area')).toBeTruthy());
    expect(sentPassword).toBe('9999');
    expect(screen.getByText('That password is not correct.')).toBeTruthy();
  });

  it('skips the gate entirely when no password is configured', async () => {
    stubApi();
    renderWithProviders(<AdminUpload />, '/admin/upload');
    await waitFor(() => expect(screen.getByRole('region', { name: 'Daily upload' })).toBeTruthy());
    expect(screen.queryByText('Internal team area')).toBeNull();
  });
});
