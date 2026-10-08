// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Rewards } from '@/pages/Rewards';
import { Redemption } from '@/pages/Redemption';
import { Gacha } from '@/pages/Gacha';
import { Catalog } from '@/pages/Catalog';
import { Budget } from '@/pages/Budget';
import { Activity } from '@/pages/Activity';
import { renderWithProviders, stubApi } from './setup';

/** Recharts needs these to exist; jsdom provides neither. */
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

function region(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

function textOf(el: HTMLElement): string {
  return el.textContent ?? '';
}

async function renderPage(ui: React.ReactNode, waitForText: string, options = {}) {
  stubApi(options);
  renderWithProviders(ui);
  await waitFor(() => expect(screen.getByText(waitForText)).toBeTruthy());
}

describe('Rewards page', () => {
  it('lists all 105 rewards', async () => {
    await renderPage(<Rewards />, 'Rewards');
    expect(screen.getByText(/All 105 rewards with stock/)).toBeTruthy();
  });

  it('sorts by stock left with the scarcest reward first', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const table = region('All rewards').querySelector('tbody')!;
    const firstRow = table.querySelectorAll('tr')[0]!;
    expect(textOf(firstRow as HTMLElement)).toContain('Prime Bag by Zena');
    expect(screen.getByText(/Sorted by stock left, lowest first/)).toBeTruthy();
  });

  it('names the date basis of each column, since the table mixes two', async () => {
    await renderPage(<Rewards />, 'Rewards');
    expect(screen.getByText(/Two different bases in one table/)).toBeTruthy();
    expect(screen.getByText(/the daily spend export carries the same columns but is not/)).toBeTruthy();
    const header = region('All rewards').querySelector('thead')!;
    expect(textOf(header as HTMLElement)).toContain('Claimed(range)');
    expect(textOf(header as HTMLElement)).toContain('Redeemed(total)');
  });

  it('shows the reward id on every row, for tracing back to the exports', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const body = region('All rewards').querySelector('tbody')!;
    const ids = within(body as HTMLElement).getAllByText(/^ID 3\d{4}$/);
    expect(ids).toHaveLength(105);
    // Prime Bag by Zena sorts first; its id is the one to check against.
    expect(textOf(body.querySelectorAll('tr')[0] as HTMLElement)).toMatch(/ID 3\d{4}/);
  });

  it('shows "auto-credited" for cashback instead of a redemption rate', async () => {
    await renderPage(<Rewards />, 'Rewards');
    // 35 cashback rewards, each showing it in both the redeemed and rate cells.
    expect(screen.getAllByText('auto-credited').length).toBeGreaterThan(0);
  });

  it('says why the change column is empty with only one snapshot', async () => {
    await renderPage(<Rewards />, 'Rewards');
    expect(screen.getByText(/Only one cumulative snapshot is stored/)).toBeTruthy();
  });

  it('filters by box', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const user = userEvent.setup();
    await user.click(within(region('Reward filters')).getByText('Welcome'));

    await waitFor(() => expect(screen.getByText('9 rewards')).toBeTruthy());
    const body = region('All rewards').querySelector('tbody')!;
    expect(body.querySelectorAll('tr').length).toBe(9);
  });

  it('filters by type', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const user = userEvent.setup();
    await user.click(within(region('Reward filters')).getByText('Cashback'));
    await waitFor(() => expect(screen.getByText('35 rewards')).toBeTruthy());
  });

  it('offers a way back to the unfiltered list', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const user = userEvent.setup();
    const filters = region('Reward filters');
    await user.click(within(filters).getByText('Welcome'));
    await waitFor(() => expect(screen.getByText('9 rewards')).toBeTruthy());
    await user.click(within(filters).getByText('All boxes'));
    await waitFor(() => expect(screen.getByText('All rewards', { selector: 'h2' })).toBeTruthy());
  });

  it('searches the table by name, narrowing it with the chips untouched', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const user = userEvent.setup();
    const filters = region('Reward filters');
    await user.type(within(filters).getByLabelText('Search'), 'indomaret');

    await waitFor(() => expect(screen.getByText('2 rewards')).toBeTruthy());
    const body = region('All rewards').querySelector('tbody')!;
    expect(body.querySelectorAll('tr')).toHaveLength(2);
    expect(textOf(body as HTMLElement)).toContain('Indomaret');
    // A chip count that moved as you typed would be unreadable, so the counts
    // stay on the unfiltered list: Welcome still reads 9.
    expect(textOf(filters)).toContain('Welcome9');
  });

  it('searches the reward id as well as the name', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const user = userEvent.setup();
    await user.type(within(region('Reward filters')).getByLabelText('Search'), '30034');
    await waitFor(() => expect(screen.getByText('1 rewards')).toBeTruthy());
  });

  it('clears the search back to the full list', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const user = userEvent.setup();
    const filters = region('Reward filters');
    await user.type(within(filters).getByLabelText('Search'), 'indomaret');
    await waitFor(() => expect(screen.getByText('2 rewards')).toBeTruthy());

    await user.click(within(filters).getByLabelText('Clear search'));
    await waitFor(() => expect(screen.getByText('All rewards', { selector: 'h2' })).toBeTruthy());
    expect(region('All rewards').querySelector('tbody')!.querySelectorAll('tr')).toHaveLength(105);
  });

  it('says so rather than showing an empty table when nothing matches', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const user = userEvent.setup();
    await user.type(within(region('Reward filters')).getByLabelText('Search'), 'zzzz');
    await waitFor(() => expect(screen.getByText('No rewards match these filters')).toBeTruthy());
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it('narrows the top-10 rankings with the table, so the page reads as one cut', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const user = userEvent.setup();
    await user.type(within(region('Reward filters')).getByLabelText('Search'), 'indomaret');
    await waitFor(() => expect(screen.getByText('2 rewards')).toBeTruthy());
    const top = region('Top 10 by claims');
    expect([...top.querySelectorAll('li')].length).toBeLessThanOrEqual(2);
    expect(textOf(top)).toContain('Indomaret');
  });

  it('ranks the top 10 by claims, matching spec §6', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const top = region('Top 10 by claims');
    const names = [...top.querySelectorAll('li')].map((li) => li.textContent ?? '');
    expect(names[0]).toContain('Balance Rp100');
    expect(names[0]).toContain('Welcome Box');
    expect(names[0]).toContain('271');
  });

  it('ranks the top 10 by spend in rupiah', async () => {
    await renderPage(<Rewards />, 'Rewards');
    expect(textOf(region('Top 10 by spend'))).toMatch(/Rp\d/);
  });

  it('shows "no stock set" rather than dividing by zero', async () => {
    await renderPage(<Rewards />, 'Rewards');
    expect(screen.getAllByText('no stock set').length).toBeGreaterThan(0);
  });
});

/** Every table sorts the same way: click a header, click it again to reverse. */
async function clickHeader(regionName: string, header: RegExp) {
  const user = userEvent.setup();
  await user.click(within(region(regionName)).getByRole('button', { name: header }));
}

const firstRowOf = (regionName: string) =>
  textOf(region(regionName).querySelectorAll('tbody tr')[0] as HTMLElement);

describe('Redemption page', () => {
  it('shows the coupon KPIs from spec §6', async () => {
    await renderPage(<Redemption />, 'Redemption');
    expect(within(region('Coupons claimed')).getByText('742')).toBeTruthy();
    expect(within(region('Coupons redeemed')).getByText('32')).toBeTruthy();
    expect(within(region('Redemption rate')).getByText('4,3%')).toBeTruthy();
    expect(within(region('Coupon spend')).getByText('Rp190.000')).toBeTruthy();
  });

  it('sorts the coupon table on any column, most-redeemed first by default', async () => {
    await renderPage(<Redemption />, 'Redemption');
    expect(textOf(region('All coupons'))).toContain('sorted by redeemed, highest first');

    await clickHeader('All coupons', /^Spend/);
    await waitFor(() => expect(textOf(region('All coupons'))).toContain('sorted by spend, highest first'));
    const top = firstRowOf('All coupons');

    // A second click reverses it, so the biggest spender leaves the top.
    await clickHeader('All coupons', /^Spend/);
    await waitFor(() => expect(firstRowOf('All coupons')).not.toBe(top));
  });

  it('sorts the cashback rewards table too', async () => {
    await renderPage(<Redemption />, 'Redemption');
    expect(textOf(region('Cashback rewards'))).toContain('sorted by spend, highest first');
    await clickHeader('Cashback rewards', /^Reward/);
    await waitFor(() =>
      expect(textOf(region('Cashback rewards'))).toContain('sorted by reward, A→Z'),
    );
  });

  it('searches the coupon table on name, merchant and reference', async () => {
    await renderPage(<Redemption />, 'Redemption');
    const user = userEvent.setup();
    const coupons = region('All coupons');
    await user.type(within(coupons).getByLabelText('Search'), 'indomaret');

    await waitFor(() => expect(textOf(region('All coupons'))).toContain('match “indomaret”'));
    const rows = [...region('All coupons').querySelector('tbody')!.querySelectorAll('tr')];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(textOf(row as HTMLElement)).toContain('Indomaret');
  });

  it('searches the cashback table independently of the coupon one', async () => {
    await renderPage(<Redemption />, 'Redemption');
    const user = userEvent.setup();
    await user.type(within(region('Cashback rewards')).getByLabelText('Search'), 'rp1.000');

    await waitFor(() => expect(textOf(region('Cashback rewards'))).toContain('match “rp1.000”'));
    // The coupon table above is untouched.
    expect(textOf(region('All coupons'))).toContain('have been redeemed at least once');
  });

  it('averages the face value of redeemed coupons only', async () => {
    await renderPage(<Redemption />, 'Redemption');
    // Rp190.000 over 32 redemptions.
    expect(within(region('Avg. face value')).getByText('Rp5.938')).toBeTruthy();
    expect(textOf(region('Avg. face value'))).toContain('Of redeemed coupons only');
  });

  it('covers both coupons and cashback, in labelled sections', async () => {
    await renderPage(<Redemption />, 'Redemption');
    expect(screen.getByText(/Both ways a reward costs money/)).toBeTruthy();
    expect(screen.getByText('Coupons', { selector: 'h2' })).toBeTruthy();
    expect(screen.getByText('Cashback', { selector: 'h2' })).toBeTruthy();
    expect(screen.getByText(/credited automatically · no redemption step/)).toBeTruthy();
  });

  it('reports cashback without inventing a redemption rate for it', async () => {
    await renderPage(<Redemption />, 'Redemption');
    expect(within(region('Cashback credited')).getByText('1.337')).toBeTruthy();
    expect(within(region('Cashback spend')).getByText('Rp603.000')).toBeTruthy();
    // Rp603.000 over 1.337 credits.
    expect(within(region('Avg. per credit')).getByText('Rp451')).toBeTruthy();
    // Exactly one "Redemption rate" card on the page, and it is the coupon one.
    expect(screen.getAllByRole('region', { name: 'Redemption rate' })).toHaveLength(1);
  });

  it('lists every cashback reward by cost', async () => {
    await renderPage(<Redemption />, 'Redemption');
    const card = region('Cashback rewards');
    expect(within(card).getByText(/All 35 cashback rewards/)).toBeTruthy();
  });

  it('breaks cashback down by box', async () => {
    await renderPage(<Redemption />, 'Redemption');
    const card = region('Cashback by box');
    expect(textOf(card)).toContain('Welcome Box');
    expect(textOf(card)).toContain('Rp251.600');
  });

  it('lists every coupon with its ref id, claimed, redeemed and spend', async () => {
    await renderPage(<Redemption />, 'Redemption');
    const table = region('All coupons').querySelector('tbody')!;
    expect(table.querySelectorAll('tr').length).toBe(70);
    expect(textOf(table as HTMLElement)).toContain('C20260907100004');
  });

  it('puts the most-redeemed coupons at the top of the table', async () => {
    await renderPage(<Redemption />, 'Redemption');
    const rows = region('All coupons').querySelectorAll('tbody tr');
    const first = textOf(rows[0] as HTMLElement);
    expect(first).toMatch(/Tokopedia|Blibli/);
    expect(first).toContain('Rp45.000');
  });

  it('leaves the daily trend to the Blind boxes page', async () => {
    await renderPage(<Redemption />, 'Redemption');
    expect(screen.queryByText('Daily trend', { selector: 'h2' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Daily trend' })).toBeNull();
  });

  it('cautions that per-box rates swing on tiny claim counts', async () => {
    await renderPage(<Redemption />, 'Redemption');
    expect(screen.getByText(/rates swing on single\s+redemptions/)).toBeTruthy();
  });
});

describe('Gacha page', () => {
  it('shows claims and cashback as running totals', async () => {
    await renderPage(<Gacha />, 'Gacha');
    expect(within(region('Total claims')).getByText('1.279')).toBeTruthy();
    expect(within(region('Total cashback')).getByText('Rp1.336.500')).toBeTruthy();
    expect(textOf(region('Total claims'))).toContain('ignores the date range');
  });

  it('sorts the daily table, newest day first by default', async () => {
    await renderPage(<Gacha />, 'Gacha');
    expect(textOf(region('Gacha by day'))).toContain('sorted by date, newest first');
    await clickHeader('Gacha by day', /^Cashback/);
    await waitFor(() =>
      expect(textOf(region('Gacha by day'))).toContain('sorted by cashback, highest first'),
    );
  });

  it('labels the user count as a daily figure, not a campaign total', async () => {
    await renderPage(<Gacha />, 'Gacha');
    const card = region('Users claiming');
    expect(within(card).getByText('812')).toBeTruthy();
    expect(textOf(card)).toContain('That day only · not a campaign total');
  });

  it('explains why users cannot be summed across days', async () => {
    await renderPage(<Gacha />, 'Gacha');
    expect(screen.getByText(/Users claiming is a daily figure, not a unique total/)).toBeTruthy();
    expect(screen.getByText(/One person can spin\s+many times/)).toBeTruthy();
  });

  it('derives cashback per user from the same day', async () => {
    await renderPage(<Gacha />, 'Gacha');
    // Rp1.336.500 over 812 users.
    expect(within(region('Cashback per user')).getByText('Rp1.646')).toBeTruthy();
  });

  it('tabulates each day behind the charts', async () => {
    await renderPage(<Gacha />, 'Gacha');
    expect(textOf(region('Gacha by day'))).toContain('15 Sep');
  });
});

describe('Blind boxes page', () => {
  it('shows all 12 boxes with stamps, rewards and claims', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    expect(
      screen.getByRole('button', { name: /Welcome Box, ID 13, 10 stamps, 9 rewards, 814 claims/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Fancam & Music Box, ID 24, 300 stamps, 5 rewards, 0 claims/ }),
    ).toBeTruthy();
  });

  it('shows each box id, for matching rows against the raw exports', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    // Boxes are 13-24 and ordered by stamps required.
    const ids = screen.getAllByText(/^ID \d+$/).map((el) => el.textContent);
    expect(ids).toEqual([
      'ID 13', 'ID 14', 'ID 15', 'ID 16', 'ID 17', 'ID 18',
      'ID 19', 'ID 20', 'ID 21', 'ID 22', 'ID 23', 'ID 24',
    ]);
  });

  it('repeats the box id in the detail panel, and shows each reward id', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Fit Check Box/ }));

    const panel = await waitFor(() => screen.getByRole('dialog', { name: 'Fit Check Box' }));
    expect(within(panel).getByText('ID 16')).toBeTruthy();
    // One blindbox_reward.id per reward in the box.
    const rewardIds = within(panel).getAllByText(/^ID 3\d{4}$/);
    expect(rewardIds).toHaveLength(14);
  });

  it('aggregates stock to the box, and names the scarcest reward in it', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const card = screen.getByRole('button', { name: /Fit Check Box/ });
    // The box as a whole is barely touched...
    expect(textOf(card)).toContain('192 of 104.653 used');
    // ...but one reward inside it is down to 67%, which the total would hide.
    expect(textOf(card)).toContain('lowest 67%');
  });

  it('puts the daily trend on the page in place of the stamp ladder', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    expect(screen.queryByRole('region', { name: 'Stamp ladder' })).toBeNull();
    const trend = screen.getByRole('region', { name: 'Daily trend' });
    // No filter applied is the combined view, and says so.
    expect(textOf(trend)).toContain('All boxes combined');
    expect(textOf(trend)).toContain('box claims, coupons redeemed and spend per day');
  });

  it('filters the daily trend by box', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    const trend = () => screen.getByRole('region', { name: 'Daily trend' });

    await user.click(within(trend()).getByRole('button', { name: 'Welcome' }));
    await waitFor(() => expect(textOf(trend())).toContain('Welcome Box ·'));

    // And back to the combined view.
    await user.click(within(trend()).getByRole('button', { name: 'All boxes' }));
    await waitFor(() => expect(textOf(trend())).toContain('All boxes combined'));
  });

  it('narrows the daily trend to any mix of claims, redemptions and spend', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    const trend = () => screen.getByRole('region', { name: 'Daily trend' });
    const chip = (name: string) => within(trend()).getByRole('button', { name });

    await user.click(chip('Box claims'));
    await waitFor(() => expect(textOf(trend())).toContain('box claims per day'));

    await user.click(chip('Spend'));
    await waitFor(() => expect(textOf(trend())).toContain('box claims and spend per day'));

    // Switching every chip off is the combined view again, not an empty one.
    await user.click(chip('Box claims'));
    await user.click(chip('Spend'));
    await waitFor(() =>
      expect(textOf(trend())).toContain('box claims, coupons redeemed and spend per day'),
    );
  });

  it('has real data to plot, unlike the coupon-only version it replaced', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const trend = screen.getByRole('region', { name: 'Daily trend' });
    // Box claims come from the claims export, so there are rows to show even
    // though the spend export's coupon columns are empty. The card no longer
    // withholds itself the way the coupon-only chart had to.
    expect(within(trend).queryByText('No daily data in this range')).toBeNull();
    expect(within(trend).queryByText('No daily breakdown available')).toBeNull();
    expect(within(trend).getByText('CSV').closest('button')!.disabled).toBe(false);
  });

  it('says so when the cashback behind the spend line is reconstructed', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const trend = screen.getByRole('region', { name: 'Daily trend' });
    expect(textOf(trend)).toContain('Cashback is reconstructed');
    expect(textOf(trend)).toContain('claims × the reward');
    // And the coupon half, which no reconstruction can recover.
    expect(textOf(trend)).toContain('Coupon spend is missing from the daily export');
  });

  it('offers the daily trend as a CSV that follows the filters', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    const trend = () => screen.getByRole('region', { name: 'Daily trend' });
    const button = () => within(trend()).getByText('CSV').closest('button')!;

    // There is real data to export now, so the button is live.
    expect(button().disabled).toBe(false);
    expect(button().title).toContain('daily-trend_all-boxes');

    // The filename records how the view was cut.
    await user.click(within(trend()).getByRole('button', { name: 'Welcome' }));
    await waitFor(() => expect(button().title).toContain('welcome-box'));
    await user.click(within(trend()).getByRole('button', { name: 'Box claims' }));
    await waitFor(() => expect(button().title).toContain('claims'));
  });

  it('reports the drop odds as healthy rather than flagging noise', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    // Three rewards sit just past 2 SE, which is what chance alone produces
    // across 42 rewards — so the page must not present that as a problem.
    expect(screen.getByText(/Drop odds look healthy/)).toBeTruthy();
    expect(screen.queryByText(/chance does not explain/)).toBeNull();
  });

  it('does not judge odds for boxes nobody has reached', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    // The six unreached boxes plus Weverse (11) and Cineplex (1).
    expect(screen.getAllByText('Too few claims').length).toBe(8);
  });

  it('flags the four boxes whose configured odds do not sum to 100', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    expect(screen.getByText(/4 boxes’ configured odds do not/)).toBeTruthy();
    expect(screen.getByText(/Sports Club Box \(96,1%\)/)).toBeTruthy();
    expect(screen.getAllByText(/Odds sum/).length).toBe(4);
  });

  it('compares configured weight against what users actually got', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Welcome Box, ID 13/ }));

    const panel = await waitFor(() => screen.getByRole('dialog', { name: 'Welcome Box' }));
    expect(textOf(panel)).toContain('Drop odds vs. actual');
    expect(within(panel).getByText('Balance Rp100')).toBeTruthy();
    // Configured 30%, actual 271/814 = 33,29%.
    expect(within(panel).getByText('30%')).toBeTruthy();
    expect(within(panel).getByText('33,29%')).toBeTruthy();
    expect(textOf(panel)).toContain('over 271 claims');
  });

  it('carries the redemption detail from the Rewards page into each reward', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Welcome Box, ID 13/ }));

    const panel = await waitFor(() => screen.getByRole('dialog', { name: 'Welcome Box' }));
    // Tokopedia Rp5K: 67 claims in range, 9 of 72 coupons redeemed, Rp45.000 spent.
    expect(within(panel).getByText('12,5% of 72')).toBeTruthy();
    expect(within(panel).getByText('Rp45.000')).toBeTruthy();
    // Cashback has no rate to show — it is credited on claim.
    expect(within(panel).getAllByText('credited').length).toBe(4);
  });

  it('draws one bar per reward, for stock alone', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Welcome Box, ID 13/ }));

    const panel = await waitFor(() => screen.getByRole('dialog', { name: 'Welcome Box' }));
    // Nine rewards, nine stock bars — the two odds bars now read as numbers.
    expect(within(panel).getAllByRole('img', { name: /stock left$/ })).toHaveLength(9);
  });

  it('summarises the box before listing its rewards', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Welcome Box, ID 13/ }));

    const panel = await waitFor(() => screen.getByRole('dialog', { name: 'Welcome Box' }));
    expect(textOf(panel)).toContain('814');
    expect(textOf(panel)).toContain('Rp296.600');
    expect(textOf(panel)).toContain('9 of 9');
  });

  it('explains why a box with too few claims gets no verdict', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Cineplex Box/ }));

    const panel = await waitFor(() => screen.getByRole('dialog', { name: 'Cineplex Box' }));
    expect(textOf(panel)).toContain('Only 1 claims so far');
    expect(textOf(panel)).toContain('mostly noise');
  });

  it('warns inside the panel when that box\'s odds are misconfigured', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Fit Check Box/ }));

    const panel = await waitFor(() => screen.getByRole('dialog', { name: 'Fit Check Box' }));
    expect(textOf(panel)).toContain('Configured odds sum to 102%, not 100');
  });

  it('closes the panel', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Welcome Box, ID 13/ }));
    await waitFor(() => screen.getByRole('dialog', { name: 'Welcome Box' }));
    await user.click(screen.getByText('Close'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Budget page', () => {
  it('leads with the total budget and its three components', async () => {
    await renderPage(<Budget />, 'Budget');
    expect(within(region('Total budget')).getByText('Rp2.151.300')).toBeTruthy();
    expect(within(region('Box cashback')).getByText('Rp603.000')).toBeTruthy();
    expect(within(region('Coupon redemptions')).getByText('Rp190.000')).toBeTruthy();
    expect(within(region('Gacha cashback')).getByText('Rp1.358.300')).toBeTruthy();
  });

  it('sorts the breakdown by any column', async () => {
    await renderPage(<Budget />, 'Budget');
    // Biggest spender first by default: gacha, at Rp1.358.300.
    expect(firstRowOf('Breakdown by reward type')).toContain('Gacha');
    await clickHeader('Breakdown by reward type', /^Type/);
    await waitFor(() => expect(firstRowOf('Breakdown by reward type')).toContain('Cashback'));
  });

  it('shows each component as a share of the budget', async () => {
    await renderPage(<Budget />, 'Budget');
    expect(textOf(region('Gacha cashback'))).toContain('63% of budget');
    expect(textOf(region('Box cashback'))).toContain('28% of budget');
  });

  it('reports a burn rate and warns that the latest day is partial', async () => {
    await renderPage(<Budget />, 'Budget');
    const card = region('Daily burn rate');
    expect(textOf(card)).toContain('over 1 day of data');
    expect(textOf(card)).toContain('The latest day is partial');
  });

  it('surfaces unredeemed coupon exposure as a floor, not a total', async () => {
    await renderPage(<Budget />, 'Budget');
    const card = region('Unredeemed coupon exposure');
    expect(within(card).getByText(/≥ Rp1\.720\.000/)).toBeTruthy();
    expect(textOf(card)).toContain('710 coupons claimed and not yet redeemed');
    expect(textOf(card)).toContain('This figure is incomplete, and only in one direction');
    expect(textOf(card)).toContain('19 coupons with 417 outstanding claims have no face value');
  });

  it('holds the projection back until there is a complete day to measure', async () => {
    await renderPage(<Budget />, 'Budget');
    // The fixture is launch day only, and still being exported.
    expect(textOf(region('Budget per day'))).not.toContain('Projected by 1 Des');
    expect(screen.getByText(/No projection to 1 Des yet/)).toBeTruthy();
  });

  it('projects to the campaign close off the recent run rate, capped by the prize pool', async () => {
    await renderPage(<Budget />, 'Budget', { extraDays: 6 });
    const card = region('Budget per day');
    expect(textOf(card)).toContain('Projected by 1 Des');
    expect(textOf(card)).toContain('Rate over 7 days');
    expect(textOf(card)).toContain('Prize pool left');
    expect(textOf(card)).toContain('Pool runs out');
    const note = screen.getByText(/How the projection to 1 Des is built/).parentElement!;
    expect(textOf(note)).toContain('remaining claimable value');
    expect(textOf(note)).toContain('no knowable unit value');
    expect(textOf(note)).toContain('gacha has no stock to cap against');
  });

  it('switches the projection between the recent and all-time run rate', async () => {
    // 11 days of history, so the two bases average over genuinely different windows.
    await renderPage(<Budget />, 'Budget', { extraDays: 10 });
    expect(textOf(region('Budget per day'))).toContain('Rate over 7 days');
    expect(screen.getByRole('button', { name: 'Last 7 days' }).getAttribute('aria-pressed')).toBe('true');

    await userEvent.click(screen.getByRole('button', { name: 'All time' }));
    await waitFor(() =>
      expect(textOf(region('Budget per day'))).toContain('Rate over 11 days'),
    );
    expect(screen.getByRole('button', { name: 'All time' }).getAttribute('aria-pressed')).toBe('true');
    expect(textOf(region('Budget per day'))).toContain('Projected by 1 Des');
  });

  it('names what the daily chart can and cannot see', async () => {
    await renderPage(<Budget />, 'Budget');
    const text = textOf(region('Budget per day'));
    // Cashback is reconstructed from claims, taking coverage to 89%.
    expect(text).toContain('account for 89% of the budget');
    expect(text).toContain('reconstructed from claims × the configured payout');
    // Coupons are the only remaining gap, and the note says why.
    expect(text).toContain('The gap is coupon redemptions, currently Rp190.000');
    expect(text).toContain('a coupon only costs money when a user redeems it');
  });

  it('breaks the budget down by reward type with its own unit each', async () => {
    await renderPage(<Budget />, 'Budget');
    const card = region('Breakdown by reward type');
    const body = card.querySelector('tbody')!;
    const text = textOf(body as HTMLElement);
    expect(text).toContain('credits');
    expect(text).toContain('redeemed');
    expect(text).toContain('spins');
    // Only coupons get a rate; the other two say why they have none.
    expect(within(body as HTMLElement).getByText('auto-credited')).toBeTruthy();
    expect(within(body as HTMLElement).getByText('4,3%')).toBeTruthy();
  });

  it('attributes box spend per box and says gacha sits outside it', async () => {
    await renderPage(<Budget />, 'Budget');
    const card = region('Budget by box');
    expect(textOf(card)).toContain('Welcome Box');
    expect(textOf(card)).toContain('Rp296.600');
    expect(textOf(card)).toContain('Rp793.000');
    expect(textOf(card)).toContain('gacha is a separate draw');
  });

  it('ranks the biggest cost items', async () => {
    await renderPage(<Budget />, 'Budget');
    expect(textOf(region('Biggest cost items'))).toMatch(/Rp\d/);
  });

  it('notes that no budget cap is set yet', async () => {
    await renderPage(<Budget />, 'Budget');
    expect(screen.getByText(/No budget cap is configured yet/)).toBeTruthy();
  });
});

describe('CSV download buttons', () => {
  it('appear on every data table', async () => {
    for (const [ui, waitText, expected] of [
      [<Rewards />, 'Rewards', 1],
      [<Redemption />, 'Redemption', 2],
      [<Budget />, 'Budget', 3],
      [<Gacha />, 'Gacha', 1],
      [<Catalog />, 'Blind boxes', 2],
    ] as const) {
      cleanup();
      await renderPage(ui, waitText);
      expect(screen.getAllByText('CSV').length, waitText).toBe(expected);
    }
  });

  it('exports what is on screen, so the filename records the filter', async () => {
    await renderPage(<Rewards />, 'Rewards');
    const user = userEvent.setup();

    const button = () => screen.getByText('CSV').closest('button')!;
    expect(button().title).toContain('105 rows');
    expect(button().title).toContain('rewards.csv');

    await user.click(within(region('Reward filters')).getByText('Welcome'));
    await waitFor(() => expect(screen.getByText('9 rewards')).toBeTruthy());

    // Nine rows, and the box named in the file.
    expect(button().title).toContain('9 rows');
    expect(button().title).toContain('rewards_welcome-box.csv');
  });

  it('offers a per-box export inside the detail panel', async () => {
    await renderPage(<Catalog />, 'Blind boxes');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Fit Check Box/ }));

    const panel = await waitFor(() => screen.getByRole('dialog', { name: 'Fit Check Box' }));
    const button = within(panel).getByText('CSV').closest('button')!;
    expect(button.title).toContain('14 rows');
    expect(button.title).toContain('box-rewards_fit-check-box_16.csv');
  });
});

describe('Activity page', () => {
  it('leads with active users, onboarded and the untapped segment', async () => {
    await renderPage(<Activity />, 'Activity');
    expect(within(region('Active users')).getByText('318.463')).toBeTruthy();
    expect(within(region('Onboarded')).getByText('44.916')).toBeTruthy();
    expect(textOf(region('Onboarded'))).toContain('14,1% opened the page');
    expect(within(region('Eligible, never opened')).getByText('14.807')).toBeTruthy();
    expect(within(region('Stamps issued')).getByText('1.193.593')).toBeTruthy();
    expect(within(region('Transactions')).getByText('980.591')).toBeTruthy();
    expect(textOf(region('Transactions'))).toContain('31 of 32 activities in use');
  });

  it('calls out users who earned a box but never opened the page', async () => {
    await renderPage(<Activity />, 'Activity');
    const reach = region('Reach');
    expect(textOf(reach)).toContain('14.807 users have already earned at least the Welcome');
    expect(textOf(reach)).toContain('more than the 6.183 onboarded users who are eligible');
  });

  it('lists every activity with its quest and id', async () => {
    await renderPage(<Activity />, 'Activity');
    const body = region('All activities').querySelector('tbody')!;
    expect(body.querySelectorAll('tr')).toHaveLength(32);
    const first = textOf(body.querySelectorAll('tr')[0] as HTMLElement);
    expect(first).toContain('Daily Login');
    expect(first).toContain('IGAME_DAILY_LOGIN');
    expect(first).toContain('Starter Quest');
  });

  it('searches the activity table by name', async () => {
    await renderPage(<Activity />, 'Activity');
    const user = userEvent.setup();
    const activities = region('All activities');
    await user.type(within(activities).getByLabelText('Search'), 'login');

    await waitFor(() => {
      const rows = region('All activities').querySelector('tbody')!.querySelectorAll('tr');
      expect(rows.length).toBeLessThan(32);
    });
    const body = region('All activities').querySelector('tbody')!;
    expect(textOf(body as HTMLElement)).toContain('Daily Login');
  });

  it('lays reach out as a ladder, one column per box, with the full split', async () => {
    await renderPage(<Activity />, 'Activity');
    const reach = region('Reach');
    // The all-users strip above the ladder.
    expect(textOf(reach)).toContain('All users with a stamp');
    expect(textOf(reach)).toContain('318.463');
    expect(textOf(reach)).toContain('44.916 opened · 14,1%');
    expect(textOf(reach)).toContain('273.547 never opened');
    // Welcome Box column: 20.990 reached, split 6.183 opened / 14.807 never.
    expect(within(reach).getAllByText('20.990').length).toBeGreaterThan(0);
    expect(within(reach).getAllByText(/6\.183 opened/).length).toBeGreaterThan(0);
    expect(within(reach).getAllByText(/14\.807 never/).length).toBeGreaterThan(0);
    // How many stop at the Welcome Box: 3.530 opened + 12.183 not.
    expect(within(reach).getAllByText('15.713 stop here').length).toBeGreaterThan(0);
  });

  it('shows the box claim rate on each reached box', async () => {
    await renderPage(<Activity />, 'Activity');
    const reach = region('Reach');
    // 814 claims ÷ 6.183 onboarded users reached = 13%; approximate here
    // because the fixture's claims (15 Sep) and reach (18 Sep) differ.
    expect(within(reach).getAllByText('≈13%').length).toBeGreaterThan(0);
    expect(textOf(reach)).toContain('Claim rates are approximate');
    expect(textOf(reach)).toContain('divided by the onboarded users who reached it');
  });

  it('switches the reach ladder between both, opened only and never opened', async () => {
    await renderPage(<Activity />, 'Activity');
    const user = userEvent.setup();
    const reach = () => region('Reach');

    // Both: Welcome Box 20.990, split in two.
    expect(within(reach()).getAllByText('20.990').length).toBeGreaterThan(0);
    expect(textOf(reach())).toContain('All users with a stamp');

    await user.click(within(reach()).getByText('Opened the page', { selector: 'button' }));
    await waitFor(() => expect(within(reach()).getAllByText('6.183').length).toBeGreaterThan(0));
    expect(textOf(reach())).toContain('44.916');
    expect(textOf(reach())).toContain('14,1% of 318.463 users with a stamp');
    // Onboarded users who stop at Welcome: 3.530.
    expect(within(reach()).getAllByText('3.530 stop here').length).toBeGreaterThan(0);
    // The untapped-users callout belongs to the other view.
    expect(textOf(reach())).not.toContain('have already earned at least the Welcome');

    await user.click(within(reach()).getByText('Never opened', { selector: 'button' }));
    await waitFor(() => expect(within(reach()).getAllByText('14.807').length).toBeGreaterThan(0));
    expect(textOf(reach())).toContain('273.547');
    expect(within(reach()).getAllByText('12.183 stop here').length).toBeGreaterThan(0);
    // Never-opened users cannot claim, so there is no claim rate in this view.
    expect(textOf(reach())).toContain('No claim rate here');
    expect(textOf(reach())).not.toContain('claimed ·');
  });

  it('keeps the activity caveats with the table', async () => {
    await renderPage(<Activity />, 'Activity');
    const card = textOf(region('All activities'));
    expect(card).toContain('Customers are per activity and cannot be added up');
    expect(card).toContain('Daily Login (+14)');
    expect(card).toContain('Pay with Virtual Debit Card (+4)');
    expect(card).toContain('No activity yet: Hunt for QR Code at selected areas');
    expect(document.body.textContent).not.toContain('568.304');
  });

  it('draws customers as a bar and adds transactions per customer', async () => {
    await renderPage(<Activity />, 'Activity');
    const body = region('All activities').querySelector('tbody')!;
    const first = body.querySelectorAll('tr')[0] as HTMLElement;
    // Daily Login: 314.849 customers, 516.450 transactions → 1,6 per customer.
    expect(within(first).getByRole('img', { name: '314.849 customers' })).toBeTruthy();
    expect(textOf(first)).toContain('1,6');
  });

  it('filters activities by group', async () => {
    await renderPage(<Activity />, 'Activity');
    const user = userEvent.setup();
    const card = () => region('All activities');
    await user.click(within(card()).getByText('Savers'));
    await waitFor(() => expect(card().querySelectorAll('tbody tr')).toHaveLength(2));
    expect(textOf(card())).toContain('2 activities · 32.765 stamps issued in this group');
    // The export follows the filter.
    const button = within(card()).getByText('CSV').closest('button')!;
    expect(button.title).toContain('2 rows');
    expect(button.title).toContain('activity_savers-quest_2026-09-18.csv');
  });

  it('sorts by any column', async () => {
    await renderPage(<Activity />, 'Activity');
    const user = userEvent.setup();
    const firstName = () =>
      textOf(region('All activities').querySelectorAll('tbody tr')[0] as HTMLElement);

    // Default: most stamps first.
    expect(firstName()).toContain('Daily Login');

    // Transactions per customer: QR Hunt at CT Corp stores, ~15,3.
    await user.click(within(region('All activities')).getByRole('button', { name: /Txn \/ customer/ }));
    await waitFor(() => expect(firstName()).toContain('Hunt for QR Code at CT Corp stores'));
    expect(firstName()).toContain('15,3');

    // Clicking again reverses it.
    await user.click(within(region('All activities')).getByRole('button', { name: /Txn \/ customer/ }));
    await waitFor(() => expect(firstName()).not.toContain('Hunt for QR Code at CT Corp stores'));
  });

  it('offers CSV downloads for reach and activities', async () => {
    await renderPage(<Activity />, 'Activity');
    expect(screen.getAllByText('CSV')).toHaveLength(2);
    expect(within(region('Reach')).getByText('CSV').closest('button')!.title)
      .toContain('blindbox-reach_2026-09-18.csv');
  });

  it('explains what to upload when neither export is there', async () => {
    stubApi({ withoutReach: true, withoutActivity: true });
    renderWithProviders(<Activity />);
    await waitFor(() => expect(screen.getByText('No activity or reach export uploaded yet')).toBeTruthy());
  });

  it('still shows activity when only the reach export is missing', async () => {
    stubApi({ withoutReach: true });
    renderWithProviders(<Activity />);
    await waitFor(() => expect(screen.getByRole('region', { name: 'All activities' })).toBeTruthy());
    expect(screen.queryByRole('region', { name: 'Reach' })).toBeNull();
  });
});
