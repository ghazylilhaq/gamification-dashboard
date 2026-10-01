# gamification-dashboard

**Blindbox S2 Daily Monitor** (`dashboard.html`): a daily trend dashboard for Allo Bank Gamification Season 2.

- Web (GitHub Pages): https://ghazylilhaq.github.io/gamification-dashboard/
- claude.ai page (private, shares the latest upload with the team): https://claude.ai/artifact/7nEA3yq2g9Ls3Y8MapzuLf

## Deploying

`index.html` is built from `dashboard.html`. After editing `dashboard.html`, run `./scripts/build.sh` and commit both files.
GitHub Pages serves `index.html` from the root of `main` (Settings › Pages › Deploy from a branch › `main` / `/ (root)`).

On GitHub Pages each person loads their own export: the file is processed in their browser and the result is kept only in that browser. Nothing is uploaded to GitHub. The shared team view only works on the claude.ai page.

## Daily routine

1. Open the **Blindbox History Report S2** Google Sheet.
2. File › Download › Microsoft Excel (.xlsx).
3. Drop the file on the dashboard (or click **Load today's export**).

The file is parsed in the browser. Only daily aggregates (counts and sums, no customer IDs) are saved, so everyone who opens the page sees the latest upload. Only editors of the page can update this shared copy.

## What it monitors

| Area | Metric | Why it matters daily |
|---|---|---|
| Claims | Box claims per day, with a 7-day average | Main engagement pulse; spots drops or spikes |
| Users | Claiming users per day, split into new and returning; total participants | Shows whether growth comes from acquisition or retention |
| Stamp segmentation | Users reaching each stamp milestone per day (heatmap), milestone funnel conversion, and the current mix of users by highest milestone | Shows how users move up the stamp ladder and where they stall |
| Boxes | Opens per blindbox vs. the previous day and the 7-day average | Spots which box drives the change |
| Rewards | Cashback paid (Rp) and coupons won per day | Daily cost |
| Stock | Remaining stock, average daily payout over 7 days, days of cover per reward | Shows rewards that will run out before they do |
| Delivery health | Failure rate, failed claims, coupons won but missing from the Coupon Receive Report, manual injects | Shows operational issues |

### Alerts (on the report day)

- Failure rate above 2% (warning) or 5% (critical)
- Claims more than 30% below the 7-day average, or more than 50% above it
- Claims with a status other than SUCCESS or FAILED
- Rewards out of stock, or with under 7 or under 14 days of cover
- Coupon delivery gap above 5% of coupons won

If the newest day in the file ends before 23:00 it is marked partial, and the report day defaults to the day before.

## Tabs read from the export

| Tab | Used for |
|---|---|
| BlindBox History Report | claims, users, milestones, boxes, cashback, coupons, payouts per reward |
| Stock Monitoring | remaining stock per reward |
| Coupon Receive Report | coupon delivery gap |
| Manual Inject | manual coupon injections |

A CSV of only the BlindBox History Report tab also works; the stock and delivery sections then show what's missing.

## Known limit

Stamp milestones are counted when a user **opens** the milestone's box (`stamp_milestone_at_open`). Users who earned the stamps but haven't opened the box don't show up. A stamp-earning ledger (customer, date, activity, stamps) would allow exact stamp segments and per-activity trends.
