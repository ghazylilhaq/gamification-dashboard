// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/AppShell';
import { Rewards } from '@/pages/Rewards';
import { Activity } from '@/pages/Activity';
import { Catalog } from '@/pages/Catalog';
import { renderWithProviders, stubApi } from './setup';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

/**
 * The shell plus the three pages the global search hands off to, so a result
 * can be followed all the way to the row it names rather than only as far as
 * the route.
 */
async function renderShell() {
  stubApi();
  const result = renderWithProviders(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<p>Overview page</p>} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/budget" element={<p>Budget page</p>} />
      </Route>
    </Routes>,
  );
  // The field only appears once the dataset has landed.
  await waitFor(() => expect(searchBox()).toBeTruthy());
  return result;
}

/** The header renders one for desktop and one for the phone; either will do. */
function searchBox(): HTMLElement {
  return screen.getAllByRole('combobox', {
    name: 'Search rewards, boxes, activities and pages',
  })[0]!;
}

function results(): HTMLElement {
  return screen.getAllByRole('listbox', { name: 'Search results' })[0]!;
}

describe('Global search', () => {
  it('stays out of the way until something is typed', async () => {
    await renderShell();
    expect(screen.queryByRole('listbox', { name: 'Search results' })).toBeNull();
  });

  it('groups matches by what kind of thing they are', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.type(searchBox(), 'indomaret');

    await waitFor(() => expect(results()).toBeTruthy());
    const panel = results();
    expect(within(panel).getByRole('group', { name: 'Rewards' })).toBeTruthy();
    expect(within(panel).getAllByText(/Indomaret/).length).toBeGreaterThan(0);
    // Rarity and box, so two similarly named coupons can be told apart.
    expect(panel.textContent).toMatch(/COUPON/);
  });

  it('finds boxes, activities and the section names too', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.type(searchBox(), 'welcome');
    await waitFor(() =>
      expect(within(results()).getByRole('group', { name: 'Blind boxes' })).toBeTruthy(),
    );

    await user.clear(searchBox());
    await user.type(searchBox(), 'daily login');
    await waitFor(() =>
      expect(within(results()).getByRole('group', { name: 'Activities' })).toBeTruthy(),
    );

    await user.clear(searchBox());
    await user.type(searchBox(), 'budget');
    await waitFor(() => expect(within(results()).getByRole('group', { name: 'Pages' })).toBeTruthy());
  });

  it('navigates to a page result on Enter', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.type(searchBox(), 'budget');
    await waitFor(() => expect(within(results()).getByRole('group', { name: 'Pages' })).toBeTruthy());

    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('Budget page')).toBeTruthy());
    // Choosing a result clears the field, so the panel does not linger.
    expect(screen.queryByRole('listbox', { name: 'Search results' })).toBeNull();
  });

  it('hands a reward to the Rewards page, which finds the row', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.type(searchBox(), 'indomaret');
    await waitFor(() => expect(results()).toBeTruthy());

    await user.click(within(results()).getAllByRole('option')[0]!);

    await waitFor(() => expect(screen.getByText('2 rewards')).toBeTruthy());
    const table = screen.getByRole('region', { name: 'All rewards' });
    const rows = table.querySelector('tbody')!.querySelectorAll('tr');
    expect(rows).toHaveLength(2);
    // The term landed in the page's own search box, so it is visible and
    // clearable rather than an invisible filter.
    const pageSearch = within(
      screen.getByRole('region', { name: 'Reward filters' }),
    ).getByLabelText('Search') as HTMLInputElement;
    expect(pageSearch.value).toBe('Indomaret Discount of Rp5K');
  });

  it('hands a box to the catalog, which opens its drawer', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.type(searchBox(), 'welcome box');
    await waitFor(() =>
      expect(within(results()).getByRole('group', { name: 'Blind boxes' })).toBeTruthy(),
    );

    // Rewards are listed first and match on their box name too, so pick the
    // result from the Blind boxes group rather than whatever is on top.
    const boxes = within(results()).getByRole('group', { name: 'Blind boxes' });
    await user.click(within(boxes).getAllByRole('option')[0]!);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByRole('dialog').textContent).toContain('Welcome Box');
  });

  it('does not re-apply a handoff after the page has moved on', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.type(searchBox(), 'indomaret');
    await waitFor(() => expect(results()).toBeTruthy());
    await user.click(within(results()).getAllByRole('option')[0]!);
    await waitFor(() => expect(screen.getByText('2 rewards')).toBeTruthy());

    const filters = screen.getByRole('region', { name: 'Reward filters' });
    await user.click(within(filters).getByLabelText('Clear search'));
    await waitFor(() => expect(screen.getByText('All rewards', { selector: 'h2' })).toBeTruthy());
    // The handoff was consumed once; clearing stays cleared.
    expect((within(filters).getByLabelText('Search') as HTMLInputElement).value).toBe('');
  });

  it('moves through results with the arrow keys', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.type(searchBox(), 'balance');
    await waitFor(() => expect(results()).toBeTruthy());

    const first = within(results()).getAllByRole('option')[0]!;
    expect(first.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      const options = within(results()).getAllByRole('option');
      expect(options[0]!.getAttribute('aria-selected')).toBe('false');
      expect(options[1]!.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('dismisses on Escape without navigating', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.type(searchBox(), 'indomaret');
    await waitFor(() => expect(results()).toBeTruthy());

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Search results' })).toBeNull());
    expect(screen.getByText('Overview page')).toBeTruthy();
  });

  it('says so rather than showing an empty panel when nothing matches', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.type(searchBox(), 'zzzzzz');
    await waitFor(() => expect(screen.getByText(/No matches for/)).toBeTruthy());
  });

  it('caps each group so one common word cannot fill the screen', async () => {
    await renderShell();
    const user = userEvent.setup();
    // 29 rewards are named "Balance …".
    await user.type(searchBox(), 'balance');
    await waitFor(() => expect(results()).toBeTruthy());
    // The cap is per group, so it is the Rewards group that has to be short.
    const rewards = within(results()).getByRole('group', { name: 'Rewards' });
    expect(within(rewards).getAllByRole('option').length).toBeLessThanOrEqual(6);
    expect(rewards.textContent).toMatch(/\+\d+ more in rewards/);
  });
});
