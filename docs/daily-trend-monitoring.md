# Daily trend monitoring — assessment

**Status:** v1.1 — the **Trends** page (`/trends`), dashboard spec v1.6. Full
days only (latest = H-1); snapshot-level charts removed; per-day tables cover
every date.
**Question it answers:** *what moved yesterday, and is that normal?*

The existing pages answer "where do we stand" with running totals. Daily
monitoring needs a different shape: one figure per day per metric, compared with
the day before and with a normal day, segmented so an increase can be traced to
a group of users. This note covers what is worth watching daily, where each
figure comes from, what the current exports can and cannot support, and what to
ask for next.

---

## 1. What to monitor daily

Ordered as the campaign funnel reads: users arrive, earn stamps, climb the
ladder, claim, and it costs money.

| # | Metric | Why daily | Definition | Source | Available |
|---|---|---|---|---|---|
| 1 | **New users with a stamp** | Acquisition. Is the campaign still pulling people in? | Users with ≥ 1 stamp today − yesterday | `blindbox_reach` (Δ) | Yes, with a daily reach upload |
| 2 | **Newly onboarded** | Discovery. Are users finding the blindbox page? | Onboard Y today − yesterday | `blindbox_reach` (Δ) | Yes, with a daily reach upload |
| 3 | **Newly eligible** | Users who just earned their first box | Users at ≥ 10 stamps today − yesterday | `blindbox_reach` (Δ) | Yes, with a daily reach upload |
| 4 | **New users reaching each box** (segmented) | Progression. Which part of the ladder is moving? | Users at box N *or beyond*, today − yesterday, for each of the 12 boxes, split by opened / never opened the page | `blindbox_reach` (Δ) | Yes, with a daily reach upload |
| 5 | **Daily logins** (≈ DAU) | Engagement. The closest the exports get to daily active users | Daily Login transactions today − yesterday; the login stamp is once per user per day, so this is users who logged in | `activity_level` (Δ) | Yes, with a daily activity upload |
| 6 | **Stamp transactions, stamps issued** | Which behaviours drive stamps | Transactions (excluding Daily Login) and stamps, today − yesterday, per activity and per quest | `activity_level` (Δ) | Yes, with a daily activity upload |
| 7 | **Box claims** | Conversion into rewards | Claims per day, per box and per tier | `daily_claim_rewards` | Yes, already daily |
| 8 | **Gacha claims, gacha users** | The second reward loop | Claims and users that spun, per day (users not addable across days) | `daily_claim_gatcha` | Yes, already daily |
| 9 | **Box cashback** | Cost | Claims × configured payout, per day (exact for cashback) | `daily_claim_rewards` | Yes, already daily |
| 10 | **Coupons redeemed, coupon spend** | Cost — the part the daily spend file has never filled | Cumulative redeemed and spend, today − yesterday | `total_spent_reward` (Δ) | Yes, with a daily total-spend upload |
| 11 | **Gacha cashback** | Cost | Cashback per day | `daily_claim_gatcha` | Yes, already daily |

**Not monitored daily, deliberately:** coupon redemption *rate* and stock left %
are slow-moving ratios. A day-over-day view of them is mostly noise, and they
are already on Redemption, Rewards and Overview. Neither are **levels** — how
many users sit in each tier at a moment. Those are snapshots, not daily
movement; the Activity page shows the current ladder.

## 2. Segmentation

Three segment axes are possible with today's exports:

1. **Stamp tier**: the 12 boxes in five groups, used to stack box claims per
   day. Set in `app/src/config/trends.ts`:

   | Tier | Boxes | Stamps |
   |---|---|---|
   | 1 | Welcome, First Stream | 10–34 |
   | 2 | CTBU, Fit Check | 35–74 |
   | 3 | Weverse, Cineplex | 75–119 |
   | 4 | Visa, Sports Club, Merchandise | 120–209 |
   | 5 | Shared Bites, Seoul, Fancam & Music | 210+ |

2. **Opened the blindbox page or not** (`is_onboard_yn`). Users who have earned
   a box but never opened the page are the campaign's biggest untapped group
   (14.807 on 18 Sep, more than the onboarded eligible users).
3. **Per box**: the finest grain, shown as box × day tables of new users
   reaching each box and of claims.

**How "increase" is measured.** Reach buckets are *exclusive*: each user sits in
the bucket of the highest box they reach. When a user climbs from box 1 to box 3,
box 1's bucket *falls*. So a bucket's day-over-day change is not "new users at
this box", and it can be negative. The page always measures the increase on
**"reached box N or beyond"**, which only ever rises, because nobody loses
stamps. A user who jumps two boxes in a day counts in both rows.

**Segments the exports cannot support yet** (see §5): new vs. existing Allo
customers, Prime vs. non-Prime, acquisition channel, and daily *unique* claimers.

## 3. How a daily figure is made

**Full days only.** The latest day on the page is the last complete one —
H-1 when the files are exported just after midnight. A day still running is
never shown, compared or downloaded.

- **Daily files** (claims, gacha) have one row per calendar day. The day an
  export is pulled on is still running, so it is left out until the next
  export.
- **Cumulative files** (reach, activity, total spend) are totals to date. Each
  export is read as the closing figure of the day whose midnight is nearest to
  it: an export at 00:30 on 2 Oct closes **1 Oct**. A day's figure is its
  closing total minus the day before's. When several exports close the same
  day, the one nearest midnight is used, so a mid-day re-export does not
  disturb the daily figures.
  - Exported just after midnight, every figure is one calendar day. Exported
    at another time, say 11:04, a day runs 11:04 to 11:04, and the page says
    so.
  - If a day's export is missing, the next difference covers two days. It is
    shown, labelled "2-day window", and is never used as a baseline or flagged.
    The day with no export shows as "—".
  - If exports land at very different times (more than ±4 h from 24 h apart),
    the page says so.
- **Comparisons.** Each metric's latest full day is compared with the day
  before and with the mean of up to 7 single days before it (at least
  3). A day **30% or more** above or below that mean is flagged *Unusually high
  / low*, unless the mean is under 20. Small numbers swing too much to mean
  anything. All thresholds live in `app/src/config/trends.ts`.
- **Reviewing a past day.** The scorecard reports the date range's end date, so
  moving the range back shows how an earlier day looked.

## 4. What changed in the dashboard

- **API.** `/api/bootstrap` now also returns one export per day it closes for
  reach and activity (raw), and for total spend (summed per reward type in SQL —
  105 rows per export would be wasteful). Previously only the latest two exports
  were sent, which is why no day-by-day history was possible. **No schema
  migration**: the history was already being stored, one snapshot per upload.
- **Trends page**, second in the navigation (and a mobile tab; Blind boxes moved
  under More):
  1. *Daily scorecard*: every metric above, with day, value, vs previous day,
     vs 7-day average, a 14-day sparkline, and the unusual-day flag. CSV download.
  2. *New users reaching each box, per day*: box × day table on every date
     since launch, shaded within each row, with a Both / Opened the page /
     Never opened switch. CSV download.
  3. *Box claims per day*: stacked by tier, then box × day. CSV download.
  4. *Stamps issued per day*: stacked by quest on every date since launch,
     then activity × day. CSV download.
- Metrics are pure functions in `app/src/lib/metrics/trends.ts`, tested in
  `app/src/test/trends.test.ts` and `trendsPage.test.tsx`.

## 5. What the team needs to do, and what to ask for next

### Do now — no new data needed

1. **Upload `blindbox_reach`, `activity_level` and `total_spent_reward` every
   day**, alongside the daily files. Without this, rows 1–6 and 10 stay empty;
   the page says how many days it has. Two days of uploads give the first
   figure, four give the first baseline, eight a full 7-day baseline.
2. **Export at the same time every day — ideally just after midnight WIB.**
   Then every snapshot difference is exactly one calendar day, and the daily
   files' last day is complete instead of partial.
3. **Backfill if possible.** If the source tables can be queried *as of* past
   dates, exporting one reach / activity / total-spend file per day since
   15 Sep would fill the history immediately.

### Ask the data team for (new exports or columns)

In order of value for daily monitoring:

1. **Daily active users and daily unique claimers** — `COUNT(DISTINCT user)` per
   day, overall and per box. Today the only daily-user figures are new users
   (from reach), daily logins (a proxy), and gacha users. None of them counts
   people who claimed.
2. **A segment column on reach**: new vs. existing customer, Prime vs. non-Prime,
   or acquisition channel. Any one of these turns "users grew by 8.000" into
   "users grew by 8.000, 70% of them new to Allo" — the segmentation that
   explains an increase rather than describing it.
3. **Reach by stamp count, not only by box** (e.g. buckets of 5 stamps). Shows
   users approaching the next box, which predicts tomorrow's claims.
4. **The coupon half of `daily_spent_reward`** — still the upstream fix (spec
   §2.4). Until then, daily coupon cost comes from total-spend differences,
   which needs the daily upload in point 1.

### Dashboard work that could follow (data already exists)

- **Stock run-out projection** from daily `total_claim_rewards` snapshots (spec
  §7.6), once a week of history is stored.
- **Alerts**: the unusual-day flag could also post to Slack or email each
  morning.
- **Day-of-week view** once 3+ weeks exist: weekend dips currently read as
  "unusually low".
