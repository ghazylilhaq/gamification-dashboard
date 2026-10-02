// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { Overview } from '@/pages/Overview';
import { renderWithProviders, stubApi } from './setup';

/** ResizeObserver is absent in jsdom; Recharts needs it to exist. */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as never;

async function renderOverview(options: Parameters<typeof stubApi>[0] = {}) {
  stubApi(options);
  renderWithProviders(<Overview />);
  // The KPI row appears once /api/bootstrap resolves.
  await waitFor(() => expect(screen.getByRole('region', { name: 'Total box claims' })).toBeTruthy());
}

/** The KPI card with this accessible name. */
function kpi(label: string): HTMLElement {
  return screen.getByRole('region', { name: label });
}

/** Asserts on a card's full text, for values split across several nodes. */
function textOf(el: HTMLElement): string {
  return el.textContent ?? '';
}

describe('Overview page', () => {
  it('renders the launch-day KPI row from spec §6', async () => {
    await renderOverview();

    expect(within(kpi('Total box claims')).getByText('1.991')).toBeTruthy();
    expect(textOf(kpi('Total box claims'))).toContain('1.289 cashback');
    expect(textOf(kpi('Total box claims'))).toContain('702 coupon');

    expect(within(kpi('Total gacha claims')).getByText('1.279')).toBeTruthy();
    expect(textOf(kpi('Total gacha claims'))).toContain('Rp1.336.500 cashback');
    expect(within(kpi('Total spend')).getByText('Rp2.151.300')).toBeTruthy();
    expect(within(kpi('Coupon redemption')).getByText('4,3%')).toBeTruthy();
    expect(textOf(kpi('Coupon redemption'))).toContain('32 of 742 claimed');
  });

  it('splits total spend into cashback, coupons and gacha', async () => {
    await renderOverview();
    const text = textOf(kpi('Total spend'));
    expect(text).toContain('Rp603.000 cashback');
    expect(text).toContain('Rp190.000 coupons');
    // All-time gacha cashback, so slightly above launch day's Rp1.336.500 —
    // the same basis as the cumulative box spend it is added to.
    expect(text).toContain('Rp1.358.300 gacha');
    expect(text).toContain('All time');
  });

  it('shows the stock KPI as healthy when nothing is below 10% left', async () => {
    await renderOverview();
    const card = kpi('Stock warnings');
    expect(within(card).getByText('0')).toBeTruthy();
    expect(textOf(card)).toContain('Nothing below 10% left');
    // And flags the one reward with no stock configured at all.
    expect(textOf(card)).toContain('1 reward with no stock set');
  });

  it('falls back to the most depleted rewards in the stock panel', async () => {
    await renderOverview();
    expect(screen.getByText(/Showing the most depleted rewards instead/)).toBeTruthy();
    expect(screen.getByText('Prime Bag by Zena')).toBeTruthy();
    expect(screen.getByText(/2 of 6 used/)).toBeTruthy();
  });

  it('says coupons are the part the daily chart cannot show', async () => {
    await renderOverview();
    expect(screen.getByText(/Coupon redemptions are missing from this chart/)).toBeTruthy();
    expect(screen.getByText(/reconstructed from claims × the configured/)).toBeTruthy();
    expect(screen.getByText(/a coupon only costs money once\s+a user redeems it/)).toBeTruthy();
  });

  it('labels launch day as a partial day', async () => {
    await renderOverview();
    expect(screen.getByText(/15 Sep is a partial day/)).toBeTruthy();
  });

  describe('user onboard', () => {
    it('comes from the reach export, with its as-of time and source', async () => {
      await renderOverview();
      const card = kpi('User onboard');
      expect(within(card).getByText('44.916')).toBeTruthy();
      expect(textOf(card)).toContain('opened the blindbox page');
      expect(textOf(card)).toContain('14,1% of active users');
      expect(textOf(card)).toContain('From blindbox reach · as of 18 Sep, 11:04 WIB');
    });

    it('shows as unavailable, pointing at the upload, when there is no reach export', async () => {
      await renderOverview({ withoutReach: true });
      const card = kpi('User onboard');
      expect(within(card).getByText('Not available')).toBeTruthy();
      expect(textOf(card)).toContain('Upload blindbox_reach in Admin');
      // The ladder falls back to claims and says why.
      expect(screen.getByText(/the ladder shows claims only/)).toBeTruthy();
    });
  });

  describe('stamp ladder', () => {
    it('lists all twelve boxes in stamp order', async () => {
      await renderOverview();
      const ladder = screen.getByRole('region', { name: 'Stamp ladder' });
      expect(within(ladder).getAllByText('Welcome Box').length).toBeGreaterThan(0);
      expect(within(ladder).getAllByText('10 stamps').length).toBeGreaterThan(0);
      expect(within(ladder).getAllByText('300 stamps').length).toBeGreaterThan(0);
    });

    it('leads with onboarded users reached, and carries claims beneath', async () => {
      await renderOverview();
      const ladder = screen.getByRole('region', { name: 'Stamp ladder' });
      // 6.183 onboarded users have reached the Welcome Box; 814 claims.
      expect(within(ladder).getAllByText('6.183').length).toBeGreaterThan(0);
      expect(within(ladder).getAllByText(/814 claims/).length).toBeGreaterThan(0);
      expect(textOf(ladder)).toContain('onboarded users who have reached each box');
    });

    it('marks claim rates approximate when reach and claims are from different days', async () => {
      await renderOverview();
      const ladder = screen.getByRole('region', { name: 'Stamp ladder' });
      expect(textOf(ladder)).toContain('Claim rates are approximate (≈): claims are as of 15 Sep');
      expect(textOf(ladder)).toContain('reach as of 18 Sep');
      // Welcome: 814 claims from 6.183 onboarded users who reached it = 13%.
      expect(within(ladder).getAllByText(/814 claims · ≈13% claimed/).length).toBeGreaterThan(0);
    });

    it('shows an exact claim rate once reach and claims share a day', async () => {
      await renderOverview({ sameDayReach: true });
      const ladder = screen.getByRole('region', { name: 'Stamp ladder' });
      expect(textOf(ladder)).not.toContain('approximate');
      expect(within(ladder).getAllByText(/814 claims · 13% claimed/).length).toBeGreaterThan(0);
    });

    it('greys out boxes nobody has claimed from when only claims exist', async () => {
      await renderOverview({ withoutReach: true });
      const ladder = screen.getByRole('region', { name: 'Stamp ladder' });
      // Six unreached boxes, rendered in both the desktop and mobile ladders.
      expect(within(ladder).getAllByText('Not reached yet').length).toBe(12);
      expect(within(ladder).getAllByText('71% of prev.').length).toBeGreaterThan(0);
    });
  });

  it('reports gacha claims rather than users, since one person spins many times', async () => {
    await renderOverview();
    // No card presents a user count as a headline figure.
    expect(screen.queryByRole('region', { name: 'Gacha users' })).toBeNull();
    expect(textOf(kpi('Total gacha claims'))).toContain('Since launch');
  });

  it('labels both total cards as ignoring the date range', async () => {
    await renderOverview();
    expect(textOf(kpi('Total box claims'))).toContain('ignores the date range');
    expect(textOf(kpi('Total gacha claims'))).toContain('ignores the date range');
  });

  it('states the freshness of each panel separately', async () => {
    await renderOverview();
    // Claims at 12:36, spend at 13:51 — different exports, different times.
    expect(screen.getAllByText(/Claims as of 12:36 WIB/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Spend as of 13:51 WIB/).length).toBeGreaterThan(0);
  });

  it('shows the cumulative spend split with percentages', async () => {
    await renderOverview();
    const card = screen.getByRole('region', { name: 'Cumulative split' });
    expect(within(card).getByText('Box cashback')).toBeTruthy();
    expect(within(card).getByText('Coupon redemptions')).toBeTruthy();
    expect(within(card).getByText('Gacha cashback')).toBeTruthy();
    expect(within(card).getByText('Rp2.151.300')).toBeTruthy();
  });

  it('surfaces a load failure with a retry', async () => {
    stubApi();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'D1 is unreachable' }), { status: 500 })));
    renderWithProviders(<Overview />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('D1 is unreachable')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});

describe('section order', () => {
  it('puts the stamp ladder between the KPI row and the daily chart', async () => {
    await renderOverview();

    // Compare document position rather than asserting on markup structure, so
    // this survives any restyling of the sections themselves.
    const kpi = screen.getByRole('region', { name: 'Total box claims' });
    const ladder = screen.getByRole('region', { name: 'Stamp ladder' });
    const daily = screen.getByRole('region', { name: 'Daily activity' });
    const spend = screen.getByRole('region', { name: 'Spend per day' });

    const before = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(before(kpi, ladder)).toBe(true);
    expect(before(ladder, daily)).toBe(true);
    expect(before(daily, spend)).toBe(true);
  });
});
