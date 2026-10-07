// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Overview } from '@/pages/Overview';
import { Rewards } from '@/pages/Rewards';
import { Redemption } from '@/pages/Redemption';
import { Gacha } from '@/pages/Gacha';
import { Catalog } from '@/pages/Catalog';
import { Budget } from '@/pages/Budget';
import { Activity } from '@/pages/Activity';
import { AdminUpload } from '@/pages/AdminUpload';
import { renderWithProviders, stubApi } from './setup';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

async function renderPage(ui: React.ReactNode, waitForText: string) {
  stubApi();
  const result = renderWithProviders(ui);
  await waitFor(() => expect(screen.getByText(waitForText)).toBeTruthy());
  return result;
}

/**
 * jsdom does not lay out, so these assert the structural promises the mobile
 * design rests on rather than measuring pixels: that a phone-only card list
 * exists alongside every desktop table, that nothing but an explicitly
 * scrollable container is allowed to be wider than the screen, and that the
 * ladder has a vertical form.
 */
function mobileOnly(root: HTMLElement): Element[] {
  return [...root.querySelectorAll('[class*="md:hidden"], [class*="lg:hidden"]')];
}

/**
 * True when the element, or an ancestor, is hidden below a breakpoint.
 * Checks the class list rather than an attribute substring, because Tailwind
 * class order is arbitrary — "hidden overflow-x-auto md:block" would defeat a
 * `[class*="hidden md:block"]` selector.
 */
function isDesktopOnly(el: Element | null): boolean {
  for (let node = el; node; node = node.parentElement) {
    const classes = node.className?.toString().split(/\s+/) ?? [];
    const hidden = classes.includes('hidden');
    const shownAtBreakpoint = classes.some((c) => /^(sm|md|lg|xl):(block|flex|table|grid)$/.test(c));
    if (hidden && shownAtBreakpoint) return true;
  }
  return false;
}

/** Every table must either be desktop-only or sit in a scrollable container. */
function tableIsSafeOnMobile(table: Element): boolean {
  return isDesktopOnly(table) || table.closest('[class*="overflow-x-auto"]') !== null;
}

describe('tables collapse into cards on mobile', () => {
  it('Activity has a phone card list beside its table', async () => {
    const { container } = await renderPage(<Activity />, 'Activity');
    expect(isDesktopOnly(container.querySelector('table'))).toBe(true);
    expect(mobileOnly(container).length).toBeGreaterThan(0);
  });

  it('Budget has a phone card list beside its breakdown table', async () => {
    const { container } = await renderPage(<Budget />, 'Budget');
    expect(isDesktopOnly(container.querySelector('table'))).toBe(true);
    expect(mobileOnly(container).length).toBeGreaterThan(0);
  });

  it('Rewards has a phone card list beside its table', async () => {
    const { container } = await renderPage(<Rewards />, 'Rewards');
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    // The table and its header are hidden together, so no stray thead shows.
    expect(isDesktopOnly(table)).toBe(true);
    expect(mobileOnly(container).length).toBeGreaterThan(0);
  });

  it('Redemption has a phone card list beside its coupon table', async () => {
    const { container } = await renderPage(<Redemption />, 'Redemption');
    expect(isDesktopOnly(container.querySelector('table'))).toBe(true);
    expect(mobileOnly(container).length).toBeGreaterThan(0);
  });

  it('Gacha has a phone list beside its by-day table', async () => {
    const { container } = await renderPage(<Gacha />, 'Gacha');
    expect(isDesktopOnly(container.querySelector('table'))).toBe(true);
    expect(mobileOnly(container).length).toBeGreaterThan(0);
  });

  it('Admin upload history has a phone card list', async () => {
    stubApi({
      uploads: [
        {
          id: 1, uploaded_at: '2026-09-15 14:00:00', uploaded_by: 'team@allobank.com',
          file_name: 'daily_claim_gatcha_2026-09-15T12_19_52.csv', file_type: 'daily_gacha',
          export_at: '2026-09-15 12:19:52', row_count: 12, status: 'published',
          error: null, batch_id: 'b1',
        },
      ],
    });
    const { container } = renderWithProviders(<AdminUpload />);
    // The loading card carries the same label, so wait for real content.
    await waitFor(() => expect(screen.getAllByText(/Daily gacha claims/).length).toBeGreaterThan(0));
    const history = screen.getByRole('region', { name: 'Upload history' });
    expect(isDesktopOnly(container.querySelector('table'))).toBe(true);
    expect(mobileOnly(history).length).toBeGreaterThan(0);
  });
});

describe('the stamp ladder has a vertical form for phones', () => {
  it('renders both a horizontal and a vertical ladder', async () => {
    await renderPage(<Overview />, 'Stamp ladder');
    const ladder = screen.getByRole('region', { name: 'Stamp ladder' });
    const lists = ladder.querySelectorAll('ol');
    expect(lists.length).toBe(2);
    // One hidden below md, one hidden from md up.
    expect([...lists].some((l) => l.className.includes('hidden') && l.className.includes('md:flex'))).toBe(true);
    expect([...lists].some((l) => l.className.includes('md:hidden'))).toBe(true);
  });
});

describe('KPI cards sit in a two-column grid on phones', () => {
  it.each([
    ['Overview', <Overview />, 'Total box claims'],
    ['Budget', <Budget />, 'Total budget'],
    ['Activity', <Activity />, 'Active users'],
    ['Redemption', <Redemption />, 'Coupons claimed'],
    ['Gacha', <Gacha />, 'Total claims'],
  ])('%s starts at grid-cols-2', async (_name, ui, kpiLabel) => {
    await renderPage(ui, 'Total spend' in {} ? '' : kpiLabel);
    const grid = screen.getByRole('region', { name: kpiLabel }).parentElement!;
    expect(grid.className).toContain('grid-cols-2');
  });
});

describe('nothing forces the page to scroll sideways', () => {
  it.each([
    ['Overview', <Overview />, 'Stamp ladder'],
    ['Budget', <Budget />, 'Budget'],
    ['Activity', <Activity />, 'Activity'],
    ['Rewards', <Rewards />, 'Rewards'],
    ['Redemption', <Redemption />, 'Redemption'],
    ['Gacha', <Gacha />, 'Gacha'],
    ['Blind boxes', <Catalog />, 'Blind boxes'],
    ['Admin', <AdminUpload />, 'Daily upload'],
  ])('%s sets no fixed width wider than a phone', async (_name, ui, waitForText) => {
    const { container } = await renderPage(ui, waitForText);

    // A min-width in rem beyond ~24rem (384px) would push the page wider than
    // the narrowest phone we support.
    const offenders = [...container.querySelectorAll('[class*="min-w-["]')].filter((el) => {
      const match = el.className.match(/min-w-\[([\d.]+)rem\]/);
      return match && Number(match[1]) > 24;
    });
    expect(offenders.map((e) => e.className)).toEqual([]);

    // Overflow is allowed, but only where the element scrolls itself or is
    // replaced by a card list on phones.
    for (const table of container.querySelectorAll('table')) {
      expect(tableIsSafeOnMobile(table), `unguarded table on ${_name}`).toBe(true);
    }
  });
});

describe('the box detail panel is reachable on a phone', () => {
  it('opens as a bottom sheet with a close control', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Welcome Box, ID 13/ }));

    const panel = await waitFor(() => screen.getByRole('dialog', { name: 'Welcome Box' }));
    // Anchored to the bottom on small screens, to the right from sm up.
    expect(panel.className).toContain('bottom-0');
    expect(panel.className).toContain('sm:right-0');
    expect(within(panel).getByText('Close')).toBeTruthy();
  });
});

describe('upload works without drag and drop', () => {
  it('offers a file picker as the primary control', async () => {
    await renderPage(<AdminUpload />, 'Daily upload');
    const daily = screen.getByRole('region', { name: 'Daily upload' });
    expect(within(daily).getByText('Choose files')).toBeTruthy();
    expect(daily.querySelector('input[type=file]')).toBeTruthy();
    // The drag hint is desktop-only; the button is not.
    const hint = within(daily).getByText('or drag them here');
    expect(hint.className).toContain('hidden');
    expect(hint.className).toContain('sm:block');
  });
});
