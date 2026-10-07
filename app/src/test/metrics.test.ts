import { describe, it, expect, beforeAll } from 'vitest';
import { buildDataset, type Dataset } from '@/lib/metrics/dataset';
import { claimTotals, cumulativeClaimTotals, stampLadder } from '@/lib/metrics/claims';
import { cumulativeGachaTotals, gachaTotals } from '@/lib/metrics/gacha';
import { spendTotals, spendByBox, dailySpendSeries, derivedCashbackByDate } from '@/lib/metrics/spend';
import { redemptionTotals, couponTable, redemptionByBox, redemptionByMerchant, dailyRedemptionAvailability, dailyRedemptionSeries } from '@/lib/metrics/redemption';
import { stockSummary, stockStatusOf } from '@/lib/metrics/stock';
import { rewardRows, sortByStockLeft, topByClaims } from '@/lib/metrics/rewards';
import {
  boxSummaries, boxesWithBadWeights, boxesWithOddsDrift, oddsVerdictOf, MIN_CLAIMS_FOR_ODDS,
} from '@/lib/metrics/boxes';
import { overviewKpis } from '@/lib/metrics/overview';
import { belowFirstBox, reachFunnel, reachTotals } from '@/lib/metrics/reach';
import { activityByQuest, activityRows, activityTotals } from '@/lib/metrics/activity';
import {
  budgetByBox, budgetByType, budgetTotals, cashbackByBox, cashbackTable, cashbackTotals,
  dailyBudgetCoverage, dailyBudgetSeries, unredeemedExposure, CAMPAIGN_END_DATE,
} from '@/lib/metrics/budget';
import { budgetProjection, remainingRewardValue } from '@/lib/metrics/projection';
import { addDays } from '@/lib/time';
import { loadFixtureBootstrap } from './fixtures';
import type { Bootstrap } from '@/lib/types';

let boot: Bootstrap;
/** Launch-day only, the default view. */
let ds: Dataset;
/** With pre-launch test rows included. */
let dsWithTest: Dataset;

beforeAll(() => {
  boot = loadFixtureBootstrap();
  ds = buildDataset(boot, { showTestData: false });
  dsWithTest = buildDataset(boot, { showTestData: true });
});

// Every figure below comes from section 6 of the spec.
describe('spec §6 — box claims on launch day (12:36 WIB)', () => {
  it('totals 1,991 claims, split 1,289 cashback and 702 coupon', () => {
    const totals = claimTotals(ds);
    expect(totals.total).toBe(1991);
    expect(totals.cashback).toBe(1289);
    expect(totals.coupon).toBe(702);
  });

  it('climbs the stamp ladder 814 / 577 / 399 / 189 / 11 / 1', () => {
    const ladder = stampLadder(ds);
    const claims = ladder.steps.map((s) => [s.boxName, s.claims] as const);
    expect(claims.slice(0, 6)).toEqual([
      ['Welcome Box', 814],
      ['First Stream Box', 577],
      ['CTBU Box', 399],
      ['Fit Check Box', 189],
      ['Weverse Box', 11],
      ['Cineplex Box', 1],
    ]);
  });

  it('orders the ladder by stamps, 10 through 300', () => {
    expect(stampLadder(ds).steps.map((s) => s.stampRequired))
      .toEqual([10, 20, 35, 50, 75, 100, 120, 145, 180, 210, 250, 300]);
  });

  it('greys out six boxes when only claims are available', () => {
    // Without a reach export the ladder falls back to claims, and boxes nobody
    // has claimed from read as not reached.
    const noReach = buildDataset({ ...boot, reachSnapshot: [], freshness: { ...boot.freshness, reach_snapshot: null } });
    const notReached = stampLadder(noReach).steps.filter((s) => s.notReached);
    expect(notReached.map((s) => s.boxName)).toEqual([
      'Visa Box', 'Sports Club Box', 'Merchandise Box',
      'Shared Bites Box', 'Seoul Box', 'Fancam & Music Box',
    ]);
  });

  it('greys out nothing once reach shows people at every box', () => {
    // Six onboarded users sit at box 12, so every box has been reached —
    // even the ones nobody had claimed from on 15 Sep.
    expect(stampLadder(ds).steps.filter((s) => s.notReached)).toEqual([]);
  });

  it('shows step-down on claims when only claims are available', () => {
    const noReach = buildDataset({ ...boot, reachSnapshot: [], freshness: { ...boot.freshness, reach_snapshot: null } });
    const steps = stampLadder(noReach).steps;
    expect(steps[1]?.stepDownPct).toBeCloseTo(577 / 814, 6);
    // No onboard figure, so the first box has nothing to step down from.
    expect(steps[0]?.stepDownPct).toBeNull();
  });

  it('shows step-down on onboarded users reached once reach is available', () => {
    const steps = stampLadder(ds).steps;
    // Welcome: 6.183 of 44.916 onboarded users have ≥10 stamps.
    expect(steps[0]?.reachedY).toBe(6_183);
    expect(steps[0]?.stepDownPct).toBeCloseTo(6_183 / 44_916, 6);
    // First Stream: 2.653 of those 6.183.
    expect(steps[1]?.stepDownPct).toBeCloseTo(2_653 / 6_183, 6);
    // Claims still travel with each step.
    expect(steps[0]?.claims).toBe(814);
  });
});

describe('spec §6 — gacha (12:19 WIB)', () => {
  it('records 1,279 claims, 812 unique users and Rp1.336.500 cashback', () => {
    const totals = gachaTotals(ds);
    expect(totals.claims).toBe(1279);
    expect(totals.usersLatestDay).toBe(812);
    expect(totals.cashback).toBe(1_336_500);
    expect(totals.latestDate).toBe('2026-09-15');
  });

  it('derives cashback per user from the same day', () => {
    expect(gachaTotals(ds).cashbackPerUser).toBeCloseTo(1_336_500 / 812, 6);
  });
});

describe('spec §6 — spend and redemption (cumulative, 13:51 WIB)', () => {
  it('totals Rp793.000 box spend, Rp603.000 cashback and Rp190.000 coupons', () => {
    const totals = spendTotals(ds);
    expect(totals.boxSpend).toBe(793_000);
    expect(totals.cashbackSpend).toBe(603_000);
    expect(totals.couponSpend).toBe(190_000);
  });

  it('adds gacha cashback on top, since it is absent from the spend files', () => {
    const totals = spendTotals(ds);
    expect(totals.gachaCashback).toBeGreaterThan(0);
    expect(totals.totalSpend).toBe(totals.boxSpend + totals.gachaCashback);
  });

  it('reports 742 coupons claimed and 32 redeemed, a 4,3% rate', () => {
    const totals = redemptionTotals(ds);
    expect(totals.claimed).toBe(742);
    expect(totals.redeemed).toBe(32);
    expect(totals.rate).toBeCloseTo(32 / 742, 6);
    expect((totals.rate! * 100).toFixed(1)).toBe('4.3');
  });

  it('matches the per-box spend table exactly', () => {
    const rows = spendByBox(ds).filter((r) => r.claimed > 0);
    expect(rows.map((r) => [r.boxName, r.claimed, r.redeemed, r.spend])).toEqual([
      ['Welcome Box', 860, 624, 296_600],
      ['First Stream Box', 601, 395, 236_100],
      ['CTBU Box', 410, 252, 149_900],
      ['Fit Check Box', 195, 89, 102_900],
      ['Weverse Box', 12, 8, 5_500],
      ['Cineplex Box', 1, 1, 2_000],
    ]);
  });

  it('puts Welcome Box spend at Rp296.600', () => {
    expect(spendByBox(ds).find((r) => r.boxName === 'Welcome Box')?.spend).toBe(296_600);
  });

  it('lists the six redeemed coupons with their spend', () => {
    // Two coupons are tied on 9 redeemed, so compare as an ordered-by-key set
    // rather than asserting an arbitrary tie-break.
    const key = (r: (string | number)[]) => r.join('|');
    const redeemed = couponTable(ds)
      .filter((c) => c.redeemed > 0)
      .map((c) => [c.name, c.boxName, c.redeemed, c.claimed, c.spend] as (string | number)[]);
    expect(redeemed.map(key).sort()).toEqual([
      ['Tokopedia Discount of Rp5K', 'Welcome Box', 9, 72, 45_000],
      ['Blibli Discount of Rp5K', 'First Stream Box', 9, 105, 45_000],
      ['Tokopedia Discount of Rp5K', 'First Stream Box', 7, 52, 35_000],
      ['Tokopedia Discount of Rp10K', 'Fit Check Box', 4, 27, 40_000],
      ['Indomaret Discount of Rp5K', 'First Stream Box', 2, 54, 10_000],
      ['Blibli Discount of Rp15K', 'Fit Check Box', 1, 15, 15_000],
    ].map(key).sort());
    expect(redeemed).toHaveLength(6);
  });

  it('derives face value only where something was redeemed', () => {
    const tokopedia5k = couponTable(ds).find(
      (c) => c.name === 'Tokopedia Discount of Rp5K' && c.boxName === 'Welcome Box',
    );
    expect(tokopedia5k?.averageFaceValue).toBe(5_000);
    const unredeemed = couponTable(ds).find((c) => c.redeemed === 0);
    expect(unredeemed?.averageFaceValue).toBeNull();
  });

  it('keeps 1,337 auto-credited cashback claims out of the coupon rate', () => {
    const cashback = ds.spendSnapshot.filter((r) => r.type === 'CASHBACK');
    expect(cashback.reduce((t, r) => t + r.total_user_claimed, 0)).toBe(1337);
    // Cashback is credited automatically, so it never enters the rate.
    expect(redemptionTotals(ds).claimed).toBe(742);
  });
});

describe('the spend-file join', () => {
  it('attributes spend through the reward id, not blind_box_id2', () => {
    // The spend exports carry blind_box_id2 = 1-12 while boxes are 13-24.
    // Joining on it would put every reward in a box that does not exist.
    const boxIds = new Set(ds.boxes.map((b) => b.id));
    expect([...boxIds].every((id) => id >= 13 && id <= 24)).toBe(true);

    const welcomeRewards = ds.rewards.filter((r) => r.blind_box_id === 13).map((r) => r.id);
    const welcomeSpend = ds.spendSnapshot
      .filter((r) => welcomeRewards.includes(r.reward_id))
      .reduce((t, r) => t + r.spend_amount, 0);
    expect(welcomeSpend).toBe(296_600);
  });

  it('resolves every spend row to a real box', () => {
    const unresolved = ds.spendSnapshot.filter((r) => !ds.boxIdByRewardId.has(r.reward_id));
    expect(unresolved).toEqual([]);
  });

  it('never stores blind_box_id2 on the spend tables', () => {
    // If it is not there, it cannot be joined on by mistake later.
    expect(Object.keys(ds.spendSnapshot[0] ?? {})).not.toContain('blind_box_id2');
    expect(Object.keys(ds.dailySpend[0] ?? {})).not.toContain('blind_box_id2');
  });
});

describe('the launch-date filter', () => {
  it('excludes pre-launch test claims by default', () => {
    expect(ds.dailyRewards.every((r) => r.claim_date >= '2026-09-15')).toBe(true);
    expect(ds.dates).toEqual(['2026-09-15']);
  });

  it('includes them when test data is shown', () => {
    expect(dsWithTest.dates.length).toBeGreaterThan(1);
    expect(dsWithTest.dates[0]).toBe('2026-08-29');
    expect(claimTotals(dsWithTest).total).toBeGreaterThan(claimTotals(ds).total);
  });

  it('leaves cumulative snapshots alone, as they cannot be sliced by date', () => {
    // This is why the Rp793.000 total includes a few pre-launch test claims.
    expect(spendTotals(dsWithTest).boxSpend).toBe(spendTotals(ds).boxSpend);
  });

  it('honours an explicit date range', () => {
    const narrowed = buildDataset(boot, { showTestData: true, from: '2026-09-12', to: '2026-09-13' });
    expect(narrowed.dates).toEqual(['2026-09-12', '2026-09-13']);
  });
});

describe('unique users', () => {
  it('takes them only from the gacha file, per day', () => {
    // total_claim_user is per reward in the claim files; adding it up across
    // 105 rewards counts the same person many times over.
    const naiveSum = ds.dailyRewards.reduce((t, r) => t + r.total_claim_user, 0);
    expect(naiveSum).toBeGreaterThan(gachaTotals(ds).usersLatestDay);
    expect(gachaTotals(ds).usersLatestDay).toBe(812);
  });

  it('does not add gacha users across days', () => {
    const perDay = dsWithTest.dailyGacha.reduce((t, r) => t + r.total_claim_user, 0);
    expect(gachaTotals(dsWithTest).usersLatestDay).toBe(812);
    expect(gachaTotals(dsWithTest).usersLatestDay).toBeLessThan(perDay);
  });
});

describe('stock', () => {
  it('computes stock left as 1 − distributed / total', () => {
    expect(stockStatusOf(100, 10).pct).toBeCloseTo(0.9, 6);
    expect(stockStatusOf(100, 10).status).toBe('ok');
    expect(stockStatusOf(100, 92).status).toBe('warning');
    expect(stockStatusOf(100, 100).status).toBe('out');
  });

  it('shows "no stock set" instead of dividing by zero', () => {
    expect(stockStatusOf(0, 0)).toEqual({ pct: null, status: 'no-stock' });
    const noStock = stockSummary(ds).rows.filter((r) => r.status === 'no-stock');
    expect(noStock.map((r) => r.name)).toEqual(['1 Session in Strong Pilates']);
  });

  it('has nothing in warning yet on this export', () => {
    // Nothing is near running out: the scarcest reward still has 67% left.
    const summary = stockSummary(ds);
    expect(summary.warningCount).toBe(0);
    expect(summary.outCount).toBe(0);
    expect(summary.alerts).toEqual([]);
  });

  it('falls back to the most depleted rewards, matching spec §6', () => {
    const depleted = stockSummary(ds).mostDepleted.slice(0, 4);
    expect(depleted.map((r) => [r.name, r.stockTotal, r.stockDistributed])).toEqual([
      ['Prime Bag by Zena', 6, 2],
      ['5 Weverse Jelly', 41, 8],
      ['5 Weverse Jelly', 57, 4],
      ['Zena Discount of Rp100K', 30, 2],
    ]);
    expect(depleted[0]?.usedPct).toBeCloseTo(2 / 6, 6);
  });

  it('sorts the rewards table by stock left, lowest first', () => {
    const sorted = sortByStockLeft(rewardRows(ds));
    expect(sorted[0]?.name).toBe('Prime Bag by Zena');
    // "No stock set" has no place on the scale and sinks to the bottom.
    expect(sorted[sorted.length - 1]?.stockStatus).toBe('no-stock');
  });
});

describe('the rewards table', () => {
  it('has a row for each of the 105 rewards', () => {
    expect(rewardRows(ds)).toHaveLength(105);
  });

  it('matches the top five rewards by claims from spec §6', () => {
    // Claims here are the selected period's, from the daily claims file. The
    // cumulative snapshot would report 272 for the first row instead of 271,
    // because it also counts a pre-launch test claim.
    const top = topByClaims(rewardRows(ds), 5);
    expect(top.map((r) => [r.name, r.boxName, r.claimed])).toEqual([
      ['Balance Rp100', 'Welcome Box', 271],
      ['Balance Rp500', 'Welcome Box', 165],
      ['Balance Rp100', 'First Stream Box', 163],
      ['Balance Rp500', 'First Stream Box', 101],
      ['Blibli Discount of Rp5K', 'First Stream Box', 100],
    ]);
  });

  it('gives cashback rows no redemption rate', () => {
    const rows = rewardRows(ds);
    expect(rows.filter((r) => r.type === 'CASHBACK').every((r) => r.redemptionRate === null)).toBe(true);
    expect(rows.some((r) => r.type === 'COUPON' && r.redemptionRate !== null)).toBe(true);
  });

  it('omits the change column until a second snapshot exists', () => {
    expect(rewardRows(ds).every((r) => r.change === null)).toBe(true);
  });
});

describe('the box catalogue', () => {
  it('covers all 12 boxes and 105 rewards', () => {
    const boxes = boxSummaries(ds);
    expect(boxes).toHaveLength(12);
    expect(boxes.reduce((t, b) => t + b.rewardCount, 0)).toBe(105);
  });

  it('orders boxes by stamps required, 10 through 300', () => {
    expect(boxSummaries(ds).map((b) => b.stampRequired))
      .toEqual([10, 20, 35, 50, 75, 100, 120, 145, 180, 210, 250, 300]);
  });

  it('leaves the eight correctly-weighted boxes unflagged', () => {
    expect(boxSummaries(ds).filter((b) => !b.weightWarning)).toHaveLength(8);
  });
});

describe('the known daily-spend data issue', () => {
  it('flags launch day, where the daily file reports no claims at all', () => {
    const launchDay = dailySpendSeries(ds).find((p) => p.date === '2026-09-15');
    expect(launchDay?.incomplete).toBe(true);
    // Cashback is filled in from the claims file; coupons have no fallback.
    expect(launchDay?.cashbackDerived).toBe(true);
    expect(launchDay?.cashback).toBe(580_300);
    expect(launchDay?.coupon).toBe(0);
  });

  it('still shows gacha cashback that day, which comes from a different file', () => {
    expect(dailySpendSeries(ds).find((p) => p.date === '2026-09-15')?.gacha).toBe(1_336_500);
  });

  it('does not flag a date the claims file also shows as quiet', () => {
    const quiet = dailySpendSeries(dsWithTest).find((p) => p.date === '2026-09-02');
    expect(quiet?.incomplete).toBe(false);
  });
});

describe('merchants', () => {
  it('groups the redeemed coupons under Tokopedia, Blibli and Indomaret', () => {
    const merchants = redemptionByMerchant(ds).filter((m) => m.redeemed > 0);
    expect(merchants.map((m) => [m.merchant, m.redeemed])).toEqual([
      ['Tokopedia', 20],
      ['Blibli', 10],
      ['Indomaret', 2],
    ]);
  });

  it('collapses JD Sports variants into one merchant', () => {
    const names = redemptionByMerchant(ds).map((m) => m.merchant);
    expect(names.filter((n) => n.startsWith('JD Sports'))).toEqual(['JD Sports']);
  });
});

describe('redemption by box', () => {
  it('rates each box on coupons only', () => {
    const welcome = redemptionByBox(ds).find((b) => b.boxName === 'Welcome Box');
    // Coupons only: the box's 860 total claims include auto-credited cashback.
    expect(welcome?.claimed).toBe(245);
    expect(welcome?.redeemed).toBe(9);
    expect(welcome?.rate).toBeCloseTo(9 / 245, 6);
  });
});

describe('the overview KPI row', () => {
  it('assembles the launch-day headline numbers', () => {
    const kpis = overviewKpis(ds);
    expect(kpis.boxClaims.total).toBe(1991);
    expect(kpis.gachaClaims.total).toBe(1279);
    expect(kpis.gachaClaims.cashback).toBe(1_336_500);
    expect(kpis.totalSpend.boxSpend).toBe(793_000);
    expect(kpis.couponRedemption.redeemed).toBe(32);
    expect(kpis.couponRedemption.claimed).toBe(742);
    expect(kpis.stock.warningCount).toBe(0);
  });

  it('takes User onboard from the reach export, not a manual figure', () => {
    const onboard = overviewKpis(ds).userOnboard;
    expect(onboard?.value).toBe(44_916);
    expect(onboard?.asOf).toBe('2026-09-18 11:04:14');
    expect(onboard?.rate).toBeCloseTo(44_916 / 318_463, 6);
    expect(stampLadder(ds).onboard?.value).toBe(44_916);
  });

  it('has no User onboard figure until a reach export exists', () => {
    const noReach = buildDataset({ ...boot, reachSnapshot: [], freshness: { ...boot.freshness, reach_snapshot: null } });
    expect(overviewKpis(noReach).userOnboard).toBeNull();
    expect(stampLadder(noReach).onboard).toBeNull();
    expect(stampLadder(noReach).basis).toBe('claims');
  });

  it('has no day-over-day change with only one day of data', () => {
    expect(overviewKpis(ds).boxClaims.change).toBeNull();
  });

  it('computes day-over-day change once there are two days', () => {
    const change = overviewKpis(dsWithTest).boxClaims.change;
    expect(change).not.toBeNull();
    expect(change?.current).toBe(1991);
    expect(change?.delta).toBe(change!.current - change!.previous);
  });
});

describe('the basis of the total spend figure', () => {
  it('adds all-time gacha cashback to all-time box spend', () => {
    // Neither half can be date-sliced without putting them on different bases:
    // the spend snapshot is a cumulative total that includes a few pre-launch
    // test claims, so the gacha half includes its pre-launch spins too.
    const totals = spendTotals(ds);
    expect(totals.boxSpend).toBe(793_000);
    expect(totals.gachaCashback).toBe(1_358_300);
    expect(totals.totalSpend).toBe(2_151_300);
  });

  it('is unaffected by the date range or the test-data toggle', () => {
    const narrowed = buildDataset(boot, { showTestData: false, from: '2026-09-15', to: '2026-09-15' });
    expect(spendTotals(narrowed).totalSpend).toBe(spendTotals(dsWithTest).totalSpend);
  });

  it('is larger than the launch-day gacha cashback shown on the Gacha page', () => {
    expect(spendTotals(ds).gachaCashback).toBeGreaterThan(gachaTotals(ds).cashback);
    expect(gachaTotals(ds).cashback).toBe(1_336_500);
  });
});

describe('the cumulative claim totals on the KPI row', () => {
  it('totals box and gacha claims since launch', () => {
    expect(cumulativeClaimTotals(ds).total).toBe(1991);
    expect(cumulativeGachaTotals(ds).claims).toBe(1279);
  });

  it('ignores the date range, unlike the period totals', () => {
    // Narrowing to a single pre-launch day empties the period totals but must
    // leave the headline running totals alone.
    const narrowed = buildDataset(boot, { showTestData: true, from: '2026-09-02', to: '2026-09-02' });
    expect(claimTotals(narrowed).total).toBe(0);
    expect(cumulativeClaimTotals(narrowed).total).toBeGreaterThan(1991);
    expect(overviewKpis(narrowed).boxClaims.total).toBe(cumulativeClaimTotals(narrowed).total);
  });

  it('still respects the test-data toggle', () => {
    expect(cumulativeClaimTotals(dsWithTest).total).toBeGreaterThan(cumulativeClaimTotals(ds).total);
    expect(cumulativeGachaTotals(dsWithTest).claims).toBeGreaterThan(cumulativeGachaTotals(ds).claims);
  });

  it('reports gacha claims, not users, so repeat spins are not read as people', () => {
    const gacha = cumulativeGachaTotals(ds);
    // 1.279 spins from 812 claiming users on launch day: a user spins many
    // times, so the two figures mean different things.
    expect(gacha.claims).toBe(1279);
    expect(gacha.claims).toBeGreaterThan(gacha.usersLatestDay);
    expect(overviewKpis(ds).gachaClaims.total).toBe(gacha.claims);
  });
});

describe('daily redemption availability', () => {
  it('reports the daily coupon series as empty, not merely partial', () => {
    // Every coupon row in daily_spent_reward reads 0 claimed / 0 redeemed on
    // every date, while the cumulative export reports 742 and 32. The column
    // is present but unpopulated, which is worse than the spec's description
    // of "0 on 15 Sep".
    expect(dailyRedemptionAvailability(ds)).toBe('empty');
    expect(dailyRedemptionAvailability(dsWithTest)).toBe('empty');

    const daily = dailyRedemptionSeries(dsWithTest);
    expect(daily.every((p) => p.claimed === 0 && p.redeemed === 0 && p.spend === 0)).toBe(true);
    expect(redemptionTotals(ds).redeemed).toBe(32);
  });

  it('is "ok" once the daily figures line up with the cumulative ones', () => {
    // Guards the detection itself: with a populated daily series it passes.
    const patched = buildDataset(
      {
        ...boot,
        // Every row, not just coupons — the incompleteness check compares the
        // file's total claims against the claims file, so a coupon-only
        // fixture would itself look under-reported.
        dailySpend: boot.spendSnapshot.map((r) => ({
            date: '2026-09-15',
            reward_id: r.reward_id,
            name_en: r.name_en,
            type: r.type,
            coupon_ref_id: r.coupon_ref_id,
            total_user_claimed: r.total_user_claimed,
            total_user_redeemed: r.total_user_redeemed,
            spend_amount: r.spend_amount,
          source_export_at: '2026-09-15 13:40:36',
        })),
      },
      { showTestData: false },
    );
    expect(dailyRedemptionAvailability(patched)).toBe('ok');
  });

  it('splits the daily series by box, and sums back to the combined view', () => {
    // The Blind boxes page filters this series by box, so a per-box slice has
    // to stay a strict partition of the unfiltered one.
    const patched = buildDataset(
      {
        ...boot,
        dailySpend: boot.spendSnapshot.map((r) => ({
          date: '2026-09-15',
          reward_id: r.reward_id,
          name_en: r.name_en,
          type: r.type,
          coupon_ref_id: r.coupon_ref_id,
          total_user_claimed: r.total_user_claimed,
          total_user_redeemed: r.total_user_redeemed,
          spend_amount: r.spend_amount,
          source_export_at: '2026-09-15 13:40:36',
        })),
      },
      { showTestData: false },
    );

    const combined = dailyRedemptionSeries(patched);
    const perBox = patched.boxes.map((b) => dailyRedemptionSeries(patched, b.id));

    expect(perBox.every((series) => series.length === combined.length)).toBe(true);
    for (const [i, point] of combined.entries()) {
      expect(sumBy(perBox, (series) => series[i]!.claimed)).toBe(point.claimed);
      expect(sumBy(perBox, (series) => series[i]!.redeemed)).toBe(point.redeemed);
      expect(sumBy(perBox, (series) => series[i]!.spend)).toBe(point.spend);
    }

    // And a box with coupon activity really does carry some of it.
    const welcome = dailyRedemptionSeries(patched, 13);
    expect(sumBy(welcome, (p) => p.redeemed)).toBeGreaterThan(0);
  });
});

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

describe('budget', () => {
  it('splits the budget three ways and they sum to the total', () => {
    const totals = budgetTotals(ds);
    expect(totals.boxCashback).toBe(603_000);
    expect(totals.coupon).toBe(190_000);
    expect(totals.gachaCashback).toBe(1_358_300);
    expect(totals.total).toBe(2_151_300);
    expect(totals.boxCashback + totals.coupon + totals.gachaCashback).toBe(totals.total);
  });

  it('gives each type its own unit, because they are not comparable', () => {
    const rows = budgetByType(ds);
    expect(rows.map((r) => [r.type, r.units, r.unitLabel, r.spend])).toEqual([
      ['CASHBACK', 1337, 'credits', 603_000],
      ['COUPON', 32, 'redeemed', 190_000],
      ['GACHA', 1279, 'spins', 1_358_300],
    ]);
  });

  it('has shares that sum to exactly 1', () => {
    const shares = budgetByType(ds).reduce((t, r) => t + r.share, 0);
    expect(shares).toBeCloseTo(1, 10);
  });

  it('gives coupons a redemption rate and the other two none', () => {
    const rows = budgetByType(ds);
    expect(rows.find((r) => r.type === 'COUPON')?.redemptionRate).toBeCloseTo(32 / 742, 6);
    expect(rows.find((r) => r.type === 'CASHBACK')?.redemptionRate).toBeNull();
    expect(rows.find((r) => r.type === 'GACHA')?.redemptionRate).toBeNull();
  });

  it('averages each type over its own unit', () => {
    const rows = budgetByType(ds);
    expect(rows.find((r) => r.type === 'CASHBACK')?.averagePerUnit).toBeCloseTo(603_000 / 1337, 6);
    expect(rows.find((r) => r.type === 'COUPON')?.averagePerUnit).toBe(5_937.5);
    expect(rows.find((r) => r.type === 'GACHA')?.averagePerUnit).toBeCloseTo(1_358_300 / 1279, 6);
  });

  it('attributes box spend per box and excludes gacha from it', () => {
    const rows = budgetByBox(ds).filter((r) => r.total > 0);
    expect(rows.map((r) => [r.boxName, r.cashback, r.coupon, r.total])).toEqual([
      ['Welcome Box', 251_600, 45_000, 296_600],
      ['First Stream Box', 146_100, 90_000, 236_100],
      ['CTBU Box', 149_900, 0, 149_900],
      ['Fit Check Box', 47_900, 55_000, 102_900],
      ['Weverse Box', 5_500, 0, 5_500],
      ['Cineplex Box', 2_000, 0, 2_000],
    ]);
    // Sums to box reward spend, not the full budget — gacha has no box.
    expect(rows.reduce((t, r) => t + r.total, 0)).toBe(793_000);
  });

  it('measures how far the daily series falls short of the real budget', () => {
    const coverage = dailyBudgetCoverage(ds);
    // Cashback is reconstructed from claims, so the daily view now reaches 89%.
    // The remaining gap is coupon redemptions, which cannot be reconstructed.
    expect(coverage.dailyTotal).toBe(1_916_800);
    expect(coverage.cumulativeTotal).toBe(2_151_300);
    expect(coverage.ratio).toBeCloseTo(0.891, 3);
    expect(coverage.usesDerivedCashback).toBe(true);
    expect(coverage.missingCouponSpend).toBe(190_000);
    // Still short, so the UI must keep telling people not to read the trend.
    expect(coverage.trustworthy).toBe(false);
  });

  it('runs a cumulative total across the daily series', () => {
    const series = dailyBudgetSeries(dsWithTest);
    let running = 0;
    for (const point of series) {
      running += point.total;
      expect(point.cumulative).toBeCloseTo(running, 6);
    }
  });

  it('computes a burn rate and flags a partial latest day', () => {
    const totals = budgetTotals(ds, '2026-09-15');
    expect(totals.daysCounted).toBe(1);
    expect(totals.dailyBurnRate).toBe(2_151_300);
    expect(totals.latestDayPartial).toBe(true);
    // Without an export date there is nothing to compare against.
    expect(budgetTotals(ds).latestDayPartial).toBe(false);
  });

  it('ignores the date range, like the other cumulative figures', () => {
    const narrowed = buildDataset(boot, { showTestData: true, from: '2026-09-02', to: '2026-09-02' });
    expect(budgetTotals(narrowed).total).toBe(2_151_300);
  });
});

describe('unredeemed coupon exposure', () => {
  it('prices only the coupons someone has actually redeemed', () => {
    const e = unredeemedExposure(ds);
    // 742 claimed − 32 redeemed.
    expect(e.unredeemedCoupons).toBe(710);
    expect(e.pricedCoupons).toBe(6);
    expect(Math.round(e.knownExposure)).toBe(1_720_000);
  });

  it('reports the blind spot rather than implying the figure is complete', () => {
    const e = unredeemedExposure(ds);
    // Face value is spend ÷ redeemed, so a never-redeemed coupon has none.
    expect(e.unpricedCoupons).toBe(19);
    expect(e.unpricedUnredeemed).toBe(417);
    // The priced and unpriced outstanding claims together make up the 710.
    expect(e.unpricedUnredeemed).toBeLessThan(e.unredeemedCoupons);
  });

  it('dwarfs the coupon spend it would add to', () => {
    // Rp1,72m committed against Rp190rb actually spent on coupons so far —
    // nine times over, and 80% of the entire budget to date. That is why it
    // leads the Budget page rather than sitting in a footnote.
    const exposure = unredeemedExposure(ds).knownExposure;
    const totals = budgetTotals(ds);
    expect(exposure / totals.coupon).toBeGreaterThan(9);
    expect(exposure / totals.total).toBeCloseTo(0.8, 1);
  });
});

describe('cashback', () => {
  it('totals credits and spend, with no redemption step', () => {
    const cb = cashbackTotals(ds);
    expect(cb.credited).toBe(1337);
    expect(cb.spend).toBe(603_000);
    expect(cb.averagePerCredit).toBeCloseTo(603_000 / 1337, 6);
  });

  it('lists all 35 cashback rewards, biggest cost first', () => {
    const rows = cashbackTable(ds);
    expect(rows).toHaveLength(35);
    expect(rows[0]!.spend).toBeGreaterThanOrEqual(rows[1]!.spend);
    expect(rows.reduce((t, r) => t + r.spend, 0)).toBe(603_000);
  });

  it('breaks cashback down by box through the reward id', () => {
    const rows = cashbackByBox(ds);
    expect(rows.find((r) => r.boxName === 'Welcome Box')?.spend).toBe(251_600);
    expect(rows.reduce((t, r) => t + r.spend, 0)).toBe(603_000);
  });
});

describe('reconstructing daily cashback from claims', () => {
  it('derives cashback as claims × the configured payout', () => {
    const derived = derivedCashbackByDate(ds);
    // Launch day: the claims file is the only source that has this per date.
    expect(derived.get('2026-09-15')).toBe(580_300);
  });

  it('agrees exactly with the export wherever the export has data', () => {
    // The six pre-launch dates the daily export did populate are the only
    // cross-check available, and the two methods match to the rupiah.
    const derived = derivedCashbackByDate(dsWithTest);
    const exportedByDate = new Map<string, number>();
    for (const row of dsWithTest.dailySpend) {
      if (row.type !== 'CASHBACK') continue;
      exportedByDate.set(row.date, (exportedByDate.get(row.date) ?? 0) + row.spend_amount);
    }
    const compared = [...exportedByDate.entries()].filter(([, v]) => v > 0);
    expect(compared.length).toBe(6);
    for (const [date, exported] of compared) {
      expect(derived.get(date), `derived cashback for ${date}`).toBeCloseTo(exported, 6);
    }
  });

  it('reconciles with the cumulative export to within the gap between them', () => {
    // Claims were exported at 12:36, cumulative spend at 13:51. The 75 minutes
    // between explains the difference, so anything under ~3% is expected.
    const derivedAllTime = [...derivedCashbackByDate(dsWithTest).values()].reduce((a, b) => a + b, 0);
    const cumulative = budgetTotals(dsWithTest).boxCashback;
    expect(derivedAllTime).toBe(588_100);
    expect(cumulative).toBe(603_000);
    expect(Math.abs(derivedAllTime - cumulative) / cumulative).toBeLessThan(0.03);
    // Derived is the lower of the two, being the earlier export.
    expect(derivedAllTime).toBeLessThan(cumulative);
  });

  it('prefers the export over the reconstruction when the export has data', () => {
    // So the chart self-corrects the day the upstream query is fixed.
    const series = dailyBudgetSeries(dsWithTest);
    const populated = series.find((p) => p.date === '2026-09-04');
    expect(populated?.cashbackDerived).toBe(false);
    expect(populated?.cashback).toBe(2_000);

    const empty = series.find((p) => p.date === '2026-09-15');
    expect(empty?.cashbackDerived).toBe(true);
    expect(empty?.cashback).toBe(580_300);
  });

  it('leaves coupons alone, since a claimed coupon is not yet a cost', () => {
    // A coupon costs money only on redemption, and the claims file records no
    // redemptions — so there is nothing to reconstruct from.
    expect(dailyBudgetSeries(dsWithTest).every((p) => p.coupon === 0)).toBe(true);
    expect(budgetTotals(ds).coupon).toBe(190_000);
  });
});

describe('per-box monitoring', () => {
  it('aggregates stock from the rewards in each box', () => {
    const welcome = boxSummaries(ds).find((b) => b.name === 'Welcome Box')!;
    expect(welcome.rewardCount).toBe(9);
    expect(welcome.stockTotal).toBe(619_221);
    expect(welcome.stockDistributed).toBe(824);
    expect(welcome.stockLeftPct).toBeCloseTo(1 - 824 / 619_221, 6);
  });

  it('surfaces the scarcest reward, which the box total hides', () => {
    // Fit Check reads 99,8% stocked overall while one reward sits at 66,7%.
    const fitCheck = boxSummaries(ds).find((b) => b.name === 'Fit Check Box')!;
    expect(fitCheck.stockLeftPct).toBeGreaterThan(0.99);
    expect(fitCheck.worstReward?.name).toBe('Prime Bag by Zena');
    expect(fitCheck.worstReward?.leftPct).toBeCloseTo(4 / 6, 6);
  });

  it('carries claims and spend per box, matching spec §6', () => {
    const rows = boxSummaries(ds).filter((b) => b.claims > 0);
    expect(rows.map((b) => [b.name, b.claims, b.spend])).toEqual([
      ['Welcome Box', 814, 296_600],
      ['First Stream Box', 577, 236_100],
      ['CTBU Box', 399, 149_900],
      ['Fit Check Box', 189, 102_900],
      ['Weverse Box', 11, 5_500],
      ['Cineplex Box', 1, 2_000],
    ]);
  });

  it('computes the observed share of each reward within its box', () => {
    const welcome = boxSummaries(ds).find((b) => b.name === 'Welcome Box')!;
    const top = welcome.rewards.find((r) => r.name === 'Balance Rp100')!;
    expect(top.weight).toBe(30);
    expect(top.claims).toBe(271);
    expect(top.actualPct).toBeCloseTo((271 / 814) * 100, 6);
    expect(top.deviation).toBeCloseTo((271 / 814) * 100 - 30, 6);
  });
});

describe('drop-odds verdicts', () => {
  it('scales tolerance with the sample, not the raw gap', () => {
    // The same 5-point gap is noise at 50 claims and a real signal at 5,000.
    const small = oddsVerdictOf(20, 12, 50); // 24% observed
    const large = oddsVerdictOf(20, 1_250, 5_000); // 25% observed
    expect(small.verdict).toBe('on-target');
    expect(large.verdict).toBe('off-target');
    expect(Math.abs(large.z!)).toBeGreaterThan(Math.abs(small.z!));
  });

  it('gives no verdict below the minimum claim count', () => {
    const result = oddsVerdictOf(20, 1, MIN_CLAIMS_FOR_ODDS - 1);
    expect(result.verdict).toBe('insufficient');
    expect(result.actualPct).toBeNull();
    expect(result.z).toBeNull();
  });

  it('calls a perfectly-on-weight reward on target', () => {
    expect(oddsVerdictOf(25, 250, 1_000).verdict).toBe('on-target');
    expect(oddsVerdictOf(25, 250, 1_000).deviation).toBeCloseTo(0, 9);
  });

  it('separates "slightly off" from "off target"', () => {
    // Around 2 SE is expected occasionally; past 3 SE is not.
    expect(oddsVerdictOf(50, 1_000, 2_000).verdict).toBe('on-target');
    expect(oddsVerdictOf(50, 1_046, 2_000).verdict).toBe('slight');
    expect(oddsVerdictOf(50, 1_080, 2_000).verdict).toBe('off-target');
  });

  it('reads the current export as healthy, not as three problems', () => {
    // Three of 42 rewards sit just past 2 SE — about what chance produces at
    // that sample size, so nothing should be called off target.
    const judged = boxSummaries(ds).filter((b) => b.oddsVerdict !== 'insufficient');
    expect(judged).toHaveLength(4);
    expect(boxesWithOddsDrift(ds)).toEqual([]);

    const flagged = judged.flatMap((b) => b.rewards.filter((r) => r.verdict === 'slight'));
    expect(flagged).toHaveLength(3);
    for (const reward of flagged) {
      expect(Math.abs(reward.z!)).toBeGreaterThan(2);
      expect(Math.abs(reward.z!)).toBeLessThan(3);
    }
  });

  it('does not judge boxes nobody has climbed to', () => {
    const unjudged = boxSummaries(ds).filter((b) => b.oddsVerdict === 'insufficient');
    expect(unjudged.map((b) => b.name)).toEqual([
      'Weverse Box', 'Cineplex Box', 'Visa Box', 'Sports Club Box',
      'Merchandise Box', 'Shared Bites Box', 'Seoul Box', 'Fancam & Music Box',
    ]);
  });

  it('flags the same four bad weight sums as the catalog did', () => {
    expect(boxesWithBadWeights(ds).map((b) => b.boxId)).toEqual([16, 20, 22, 24]);
  });
});

describe('blindbox reach', () => {
  it('reads the buckets as exclusive, so their sum is a unique count', () => {
    const t = reachTotals(ds);
    expect(t.activeUsers).toBe(318_463);
    expect(t.onboardY).toBe(44_916);
    expect(t.onboardN).toBe(273_547);
    expect(t.onboardY + t.onboardN).toBe(t.activeUsers);
  });

  it('is consistent with the activity export — never fewer users than Daily Login', () => {
    // Anyone who logged in got a stamp, so reach must cover them all.
    const login = ds.raw.activitySnapshot.find((r) => r.ref_id === 'IGAME_DAILY_LOGIN')!;
    expect(login.customers).toBe(314_849);
    expect(reachTotals(ds).activeUsers).toBeGreaterThanOrEqual(login.customers);
  });

  it('turns exclusive buckets into a cumulative funnel', () => {
    const f = reachFunnel(ds);
    expect(f).toHaveLength(12);
    // Welcome: everyone at box 1 or beyond.
    expect(f[0]).toMatchObject({ box: 1, atY: 3_530, reachedY: 6_183, reachedN: 14_807 });
    // Box 12 has six users; boxes 10 and 11 have none sitting at them, but
    // those six reached them on the way up.
    expect(f[9]).toMatchObject({ box: 10, atY: 0, reachedY: 6 });
    expect(f[11]).toMatchObject({ box: 12, atY: 6, reachedY: 6 });
    // A cumulative funnel never rises as it climbs.
    for (let i = 1; i < f.length; i += 1) {
      expect(f[i]!.reached).toBeLessThanOrEqual(f[i - 1]!.reached);
    }
  });

  it('counts eligible users who have never opened the page', () => {
    const t = reachTotals(ds);
    expect(t.untappedEligible).toBe(14_807);
    expect(t.eligibleY).toBe(6_183);
    // More eligible users have not found the page than have.
    expect(t.untappedEligible).toBeGreaterThan(t.eligibleY);
  });

  it('reports users still below the first box', () => {
    expect(belowFirstBox(ds)).toEqual({ y: 38_733, n: 258_740 });
  });

  it('reports change once a second reach export exists', () => {
    expect(reachTotals(ds).change).toBeNull();
    const later = buildDataset({
      ...boot,
      prevReachSnapshot: boot.reachSnapshot.map((r) => ({ ...r, users: r.is_onboard === 'Y' ? r.users - 1 : r.users })),
    });
    // 11 onboarded buckets each lost one user in the "previous" export.
    expect(reachTotals(later).change?.onboardY).toBe(11);
  });
});

describe('activity', () => {
  it('joins every activity in the list, including one with no activity yet', () => {
    const rows = activityRows(ds);
    expect(rows).toHaveLength(32);
    const idle = rows.filter((r) => r.inactive);
    expect(idle.map((r) => r.id)).toEqual(['IGAME_QR_HUNT_AREA']);
  });

  it('orders activities by stamps issued', () => {
    const rows = activityRows(ds);
    expect(rows[0]?.id).toBe('IGAME_DAILY_LOGIN');
    expect(rows[0]?.stamps).toBe(516_464);
  });

  it('names each quest from config', () => {
    expect(activityByQuest(ds).map((q) => [q.questId, q.quest])).toEqual([
      [1, 'Starter Quest'], [2, 'Lifestyle Quest'], [3, 'Savers Quest'],
      [4, 'Special Quest'], [5, 'Paylater Quest'],
    ]);
  });

  it('totals stamps and transactions per quest', () => {
    const q = Object.fromEntries(activityByQuest(ds).map((r) => [r.questId, r]));
    expect(q[1]!.stamps).toBe(574_395);
    expect(q[2]!.stamps).toBe(428_084);
    expect(q[5]!.stamps).toBe(111_367);
    expect(activityByQuest(ds).reduce((t, r) => t + r.stampShare, 0)).toBeCloseTo(1, 10);
  });

  it('reconciles stamps against transactions × reward stamp', () => {
    const t = activityTotals(ds);
    expect(t.stamps).toBe(1_193_593);
    expect(t.transactions).toBe(980_591);
    expect(t.mismatches.map((m) => [m.id, m.actual - m.expected])).toEqual([
      ['IGAME_DAILY_LOGIN', 14],
      ['IGAME_VIRTUAL_DEBIT', 4],
    ]);
    expect(activityRows(ds).filter((r) => r.reconciles === true)).toHaveLength(29);
  });

  it('never offers a summed customer count', () => {
    // Summing per-activity customers gives 568.304 — far more than the 318.463
    // people who exist. Nothing in the module should return that number.
    const summed = activityRows(ds).reduce((t, r) => t + r.customers, 0);
    expect(summed).toBe(568_304);
    const totals = activityTotals(ds) as unknown as Record<string, unknown>;
    expect(Object.values(totals)).not.toContain(568_304);
    expect(activityByQuest(ds).some((q) => 'customers' in q)).toBe(false);
  });
});

describe('projection to the 1 Dec campaign close', () => {
  it('runs from the last day of actual data to the close, inclusive and non-decreasing', () => {
    const p = budgetProjection(ds);
    expect(p.lastActualDate).toBe('2026-09-15');
    expect(p.points[0]).toEqual({ date: '2026-09-15', projected: p.anchor });
    expect(p.points[p.points.length - 1]?.date).toBe(CAMPAIGN_END_DATE);
    // 77 future days plus the anchor day the dashed line starts from.
    expect(p.daysRemaining).toBe(77);
    expect(p.points).toHaveLength(78);
    for (let i = 1; i < p.points.length; i += 1) {
      expect(p.points[i]!.projected).toBeGreaterThanOrEqual(p.points[i - 1]!.projected);
    }
  });

  it('splits the run rate into a cappable box arm and an uncappable gacha arm', () => {
    const p = budgetProjection(ds);
    // The fixture is launch day only, so the window is that one day and the
    // rate is its own spend. Gacha is the larger half of it.
    expect(p.windowDays).toBe(1);
    expect(p.boxRate).toBe(580_300);
    expect(p.gachaRate).toBe(1_336_500);
    expect(p.runRate).toBe(1_916_800);
    expect(p.basis).toBe('recent');
    expect(p.projectedTotal).toBe(p.anchor + p.runRate! * 77);
  });

  it('averages the whole campaign on the all-time basis, the recent window otherwise', () => {
    // buildDataset over a fixture of one day cannot separate the two, so this
    // walks a series built by hand through the same public entry point.
    const stretched = buildDataset({
      ...boot,
      dailyRewards: boot.dailyRewards.flatMap((r) =>
        [...Array(11).keys()].map((i) => ({ ...r, claim_date: addDays(r.claim_date, i) })),
      ),
      dailyGacha: boot.dailyGacha.flatMap((r) =>
        [...Array(11).keys()].map((i) => ({ ...r, claim_date: addDays(r.claim_date, i) })),
      ),
      dailySpend: boot.dailySpend.flatMap((r) =>
        [...Array(11).keys()].map((i) => ({ ...r, date: addDays(r.date, i) })),
      ),
    }, { showTestData: false });

    expect(budgetProjection(stretched, null, { basis: 'recent' }).windowDays).toBe(7);
    expect(budgetProjection(stretched, null, { basis: 'allTime' }).windowDays).toBe(11);
    expect(budgetProjection(stretched).basis).toBe('recent');
    // The two windows cover different days, so they land on different rates —
    // which is the whole reason the page offers a choice between them.
    const recent = budgetProjection(stretched, null, { basis: 'recent' }).runRate!;
    const allTime = budgetProjection(stretched, null, { basis: 'allTime' }).runRate!;
    expect(recent).toBeGreaterThan(0);
    expect(allTime).toBeGreaterThan(0);
    expect(recent).not.toBeCloseTo(allTime, 6);
  });

  it('drops a partial final day rather than letting it drag the rate down', () => {
    // With the only day partial there is nothing complete left to measure.
    const p = budgetProjection(ds, '2026-09-15');
    expect(p.runRate).toBeNull();
    expect(p.points).toEqual([]);
  });

  it('flattens the box arm once the remaining prize pool is exhausted', () => {
    const p = budgetProjection(ds, null, { endDate: '2030-01-01' });
    expect(p.capped).toBe(true);
    // headroom / boxRate is 1012.05 days, so the cap first binds on day 1013.
    expect(p.cappedOnDate).toBe(addDays('2026-09-15', 1013));
    const after = p.points.filter((pt) => pt.date > p.cappedOnDate!);
    // Past the cap only gacha still adds, at exactly its own rate.
    for (let i = 1; i < after.length; i += 1) {
      expect(after[i]!.projected - after[i - 1]!.projected).toBeCloseTo(p.gachaRate!, 6);
    }
  });

  it('draws nothing once the close has passed', () => {
    const p = budgetProjection(ds, null, { endDate: '2026-09-15' });
    expect(p.points).toEqual([]);
    expect(p.runRate).toBeNull();
  });

  it('refuses to forecast from a range that stops short of the latest data', () => {
    const narrow = buildDataset(boot, { showTestData: true, from: '2026-09-12', to: '2026-09-13' });
    const p = budgetProjection(narrow);
    expect(p.truncated).toBe(true);
    expect(p.points).toEqual([]);
  });

  it('prices the remaining prize pool, and says how much of it it cannot price', () => {
    const r = remainingRewardValue(ds);
    expect(r.cashback).toBe(557_086_300);
    expect(r.coupon).toBeCloseTo(28_490_566, 0);
    // Coupons already claimed and not yet redeemed, from unredeemedExposure.
    expect(r.outstanding).toBeCloseTo(unredeemedExposure(ds).knownExposure, 6);
    expect(r.total).toBeCloseTo(r.cashback + r.coupon + r.outstanding, 6);
    // The floor, not the total: a coupon nobody has redeemed has no face value.
    expect(r.unpricedRewards).toBe(63);
    expect(r.unpricedUnits).toBe(224_782);
  });
});
