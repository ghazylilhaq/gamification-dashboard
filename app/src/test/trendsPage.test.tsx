// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Trends } from '@/pages/Trends';
import { buildDataset } from '@/lib/metrics/dataset';
import { scorecard } from '@/lib/metrics/trends';
import { formatNumber } from '@/lib/format';
import { renderWithProviders, stubApi, type HarnessOptions } from './setup';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

async function renderTrends(options: HarnessOptions = {}) {
  const boot = stubApi(options);
  renderWithProviders(<Trends />);
  await waitFor(() => expect(screen.getByText('Daily scorecard')).toBeTruthy());
  return boot;
}

const region = (name: string) => screen.getByRole('region', { name });
const WITH_HISTORY: HarnessOptions = { historyDays: 10, extraDays: 10 };

describe('Trends page — launch-day fixture only', () => {
  it('leads with a scorecard covering users, activity, claims and cost', async () => {
    await renderTrends();
    const card = region('Daily scorecard');
    for (const label of ['New users with a stamp', 'Daily logins', 'Box claims', 'Gacha users', 'Coupons redeemed']) {
      expect(within(card).getAllByText(label).length).toBeGreaterThan(0);
    }
    // Grouped as the funnel reads.
    expect(within(card).getAllByText('Users').length).toBeGreaterThan(0);
    expect(within(card).getAllByText('Cost').length).toBeGreaterThan(0);
  });

  it('says what is missing until two days of cumulative exports are stored', async () => {
    await renderTrends();
    expect(screen.getByText(/need two days of them/)).toBeTruthy();
    expect(screen.getByText(/blindbox_reach 1 day, activity_level 1 day, total_spent_reward 1 day/)).toBeTruthy();
    expect(screen.getByText('Needs two days of reach exports')).toBeTruthy();
  });

  it('shows full days only — launch day was still running when the files were pulled', async () => {
    await renderTrends();
    expect(screen.queryByText(/today so far/)).toBeNull();
    const claims = region('Box claims per day');
    expect(within(claims).getAllByText('No full days of claims in this range').length).toBe(2);
  });

  it('no longer charts users by tier', async () => {
    await renderTrends();
    expect(screen.queryByText(/by how far they have climbed/)).toBeNull();
    expect(screen.queryByText(/users under 10 stamps/)).toBeNull();
  });
});

describe('Trends page — with ten days of daily exports', () => {
  it('drops the missing-history note', async () => {
    await renderTrends(WITH_HISTORY);
    expect(screen.queryByText(/need two days of them/)).toBeNull();
    // Every export lands at the same time of day, so no window is irregular.
    expect(screen.queryByText(/cover more or less than 24 hours/)).toBeNull();
  });

  it('says a day runs export to export when exports are not taken at midnight', async () => {
    await renderTrends(WITH_HISTORY);
    // The fixture's reach export is from 11:04.
    expect(screen.getByText(/Snapshot days run from 11:04 WIB to 11:04 WIB/)).toBeTruthy();
  });

  it('reports the latest full day\'s new users, as computed from the history', async () => {
    const boot = await renderTrends(WITH_HISTORY);
    const expected = scorecard(buildDataset(boot)).find((r) => r.metric.id === 'newUsers')!.latest!;
    // The last export, 28 Sep 11:04, closes 27 Sep: H-1.
    expect(expected.date).toBe('2026-09-27');
    const card = region('Daily scorecard');
    expect(within(card).getAllByText(formatNumber(expected.value)).length).toBeGreaterThan(0);
  });

  it('shows new users per box on every date since launch, with gaps before the first export', async () => {
    await renderTrends(WITH_HISTORY);
    const table = screen.getByRole('table', { name: 'New users reaching each box, per day' });
    // Box name, 15–27 Sep, then the total.
    expect(table.querySelectorAll('thead th').length).toBe(15);
    expect(table.querySelectorAll('tbody tr').length).toBe(12);
    // 15–17 Sep: no export closes them yet.
    const welcome = table.querySelector('tbody tr')!;
    expect(within(welcome as HTMLElement).getAllByText('—').length).toBe(3);
  });

  it('switches the user view, and says why the never-opened figures can fall', async () => {
    await renderTrends(WITH_HISTORY);
    const user = userEvent.setup();
    const card = region('New users reaching each box');
    expect(within(card).queryByText(/Users leave this view/)).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Never opened' }));
    expect(within(card).getByRole('button', { name: 'Never opened' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(card).getByText(/Users leave this view when they open the blindbox page/)).toBeTruthy();
  });

  it('tabulates stamps per activity for every date, busiest first, and expands to all', async () => {
    await renderTrends(WITH_HISTORY);
    const user = userEvent.setup();
    const card = region('Stamps issued per day');
    const table = within(card).getByRole('table', { name: 'Stamps per activity, per day' });
    expect(table.querySelectorAll('thead th').length).toBe(15);
    expect(table.querySelectorAll('tbody tr').length).toBe(10);
    expect(within(table.querySelector('tbody tr') as HTMLElement).getByText('Daily Login')).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'Show all 31' }));
    expect(table.querySelectorAll('tbody tr').length).toBe(31);
  });

  it('offers the scorecard data as a CSV', async () => {
    await renderTrends(WITH_HISTORY);
    const button = within(region('Daily scorecard')).getByRole('button', { name: /CSV/ });
    expect(button.hasAttribute('disabled')).toBe(false);
  });
});
