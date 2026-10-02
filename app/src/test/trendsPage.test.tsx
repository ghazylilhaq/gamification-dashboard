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

  it('shows launch day as still running rather than comparing it', async () => {
    await renderTrends();
    const card = region('Daily scorecard');
    expect(within(card).getAllByText(/today so far 1\.991 · 12:36 WIB/).length).toBeGreaterThan(0);
    expect(within(card).getAllByText(/today so far 1\.279 · 12:19 WIB/).length).toBeGreaterThan(0);
  });

  it('still draws the levels and claims it has', async () => {
    await renderTrends();
    // Users under 10 stamps are stated rather than drawn.
    expect(screen.getByText('297.473')).toBeTruthy();
    const claims = screen.getByRole('table', { name: 'Box claims per box, per day' });
    expect(within(claims).getByText('Welcome Box')).toBeTruthy();
    expect(within(claims).getAllByText('814').length).toBe(2);
  });
});

describe('Trends page — with ten days of daily exports', () => {
  it('drops the missing-history note', async () => {
    await renderTrends(WITH_HISTORY);
    expect(screen.queryByText(/need two days of them/)).toBeNull();
    // Every export lands at the same time of day, so no window is irregular.
    expect(screen.queryByText(/cover more or less than 24 hours/)).toBeNull();
  });

  it('reports the latest day\'s new users, as computed from the history', async () => {
    const boot = await renderTrends(WITH_HISTORY);
    const expected = scorecard(buildDataset(boot)).find((r) => r.metric.id === 'newUsers')!.latest!;
    expect(expected.date).toBe('2026-09-28');
    const card = region('Daily scorecard');
    expect(within(card).getAllByText(formatNumber(expected.value)).length).toBeGreaterThan(0);
  });

  it('shows ten days of new users per box, twelve boxes deep', async () => {
    await renderTrends(WITH_HISTORY);
    const table = screen.getByRole('table', { name: 'New users reaching each box, per day' });
    const header = table.querySelectorAll('thead th');
    // Box name, ten days, then the total.
    expect(header.length).toBe(12);
    expect(table.querySelectorAll('tbody tr').length).toBe(12);
  });

  it('switches the user view, and says why the never-opened figures can fall', async () => {
    await renderTrends(WITH_HISTORY);
    const user = userEvent.setup();
    const card = region('Users with stamps');
    expect(within(card).queryByText(/Users leave this view/)).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Never opened' }));
    expect(within(card).getByRole('button', { name: 'Never opened' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(card).getByText(/Users leave this view when they open the blindbox page/)).toBeTruthy();
  });

  it('lists the busiest activities first and expands to all of them', async () => {
    await renderTrends(WITH_HISTORY);
    const user = userEvent.setup();
    const card = region('Stamps issued per day');
    const rowsBefore = card.querySelectorAll('tbody tr').length;
    expect(rowsBefore).toBe(10);
    expect(within(card.querySelector('tbody')!).getAllByText('Daily Login').length).toBe(1);
    await user.click(within(card).getByRole('button', { name: /Show all 31 activities/ }));
    expect(card.querySelectorAll('tbody tr').length).toBe(31);
  });

  it('offers the scorecard data as a CSV', async () => {
    await renderTrends(WITH_HISTORY);
    const button = within(region('Daily scorecard')).getByRole('button', { name: /CSV/ });
    expect(button.hasAttribute('disabled')).toBe(false);
  });
});
