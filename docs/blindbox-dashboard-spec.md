# Allo Blind Box Season 2 — Monitoring Dashboard Spec

**Status:** Draft v1.6 — Trends page for daily monitoring (see `daily-trend-monitoring.md`)
**Audience:** Leadership and the internal team
**Launch date:** 15 Sep 2026 (all data before this date is test data and is excluded by default)
**Devices:** Desktop and mobile
**Hosting:** Cloudflare Pages on Ghazy's domain

---

## 1. What the dashboard answers

1. How is the campaign doing today, and how is that changing day over day?
2. Of the users who open the blind box page, how many go on to claim?
3. How far are users climbing the stamp ladder (10 → 300 stamps)?
4. How much has the campaign actually cost, split between box cashback, coupon redemptions, and gacha cashback?
5. Of the coupons users claimed, how many did they actually use, and at which merchants?
6. Which rewards are close to running out of stock?
7. What is inside each box? (catalog view for anyone unfamiliar with the mechanics)

---

## 2. Data sources

### 2.1 Reference data (uploaded occasionally, e.g. when the config changes)

| File | Grain | Key fields | Used for |
|---|---|---|---|
| `blindbox` | 1 row per box (12) | `id` (13–24), `name_en`, image URLs (`image_url`, `claimed_image_url`, `locked_image_url`, `not_eligible_image_url`) | Box names, gallery artwork |
| `blindbox_reward` | 1 row per reward (105) | `id`, `blind_box_id` (13–24), `rarity`, `type`, `weight`, `stock_total`, `stock_distributed`, `cashback_value`, `image_url`, `is_active_yn`, `status` | Catalog, odds, rarity, reward images |

### 2.2 Daily data (uploaded every day)

| File (name prefix) | Grain | Key fields | Load rule |
|---|---|---|---|
| `daily_claim_gatcha_` | 1 row per date | `claim_date`, `total_claim`, `total_claim_user`, `cashback_amount` | Full history, **replace** |
| `daily_claim_rewards_` | 1 row per date × reward | `claim_date`, `reward_id`, `blind_box_id2`, `stamp_required`, `cashback_value`, `total_claim`, `total_claim_user` | Full history, **replace** |
| `total_claim_rewards_` | 1 row per reward (cumulative) | `reward_id`, `blind_box_id2`, `stock_total`, `stock_distributed`, `total_claim` | **Snapshot** per export timestamp |
| `daily_spent_reward_` | 1 row per date × reward (every reward appears on every date from 1 Sep) | `date_temp`, `id`, `total_user_claimed`, `total_user_redeemed`, `spend_amount` | Full history, **replace** |
| `total_spent_reward_` | 1 row per reward (cumulative) | `id`, `type`, `coupon_ref_id`, `total_user_claimed`, `total_user_redeemed`, `spend_amount` | **Snapshot** per export timestamp |

The export timestamp is taken from the filename (e.g. `2026-09-15T13_51_34_335429_07_00` → 15 Sep 2026, 13:51:34 WIB).

Files are detected by name **prefix**, so the prefixes above are shorter than the
filenames the exporter currently writes (`daily_spent_reward_result_…`). Both that
and a future name without `_result_` resolve to the same type. The spend export was
previously written with hyphens (`total-spend-reward_result_`); the dashboard still
accepts that name as a legacy alias.

### 2.2b Activity and reach (added in v1.5)

| File (name prefix) | Grain | Key fields | Load rule |
|---|---|---|---|
| `activity_list_` | 1 row per activity (32) | `id`, `quest_id` (1–5), `name_en`, `reward_stamp` | Reference, **replace** |
| `activity_level_` | 1 row per activity (cumulative) | `ref_id`, `customer_id`, `transaction_id`, `stamp_ditributed` | **Snapshot** per export timestamp |
| `blindbox_reach_` | 1 row per onboard flag × bucket | `is_onboard_yn`, `box_stamp`, `mdc_id` | **Snapshot** per export timestamp |

- **The count columns are named like ids.** `customer_id`, `transaction_id` and
  `mdc_id` hold counts (the query aliased `COUNT(DISTINCT x)` back to `x`), and
  `stamp_ditributed` is misspelled at source. Stored as `customers`,
  `transactions`, `users`, `stamps_distributed`.
- **Quest names** are not in the export: 1 Starter · 2 Lifestyle · 3 Savers ·
  4 Special · 5 Paylater (`src/config/quests.ts`).
- **Customers are per activity and not summable.** Across activities they add
  to 568,304 against ~318,463 real people.
- **Stamps reconcile** as `transactions × reward_stamp` for 29 of 31 activities;
  Daily Login is +14 and Virtual Debit +4. Shown as a data note.
- **Reach buckets are exclusive**: each user sits in the bucket for the *highest*
  box their stamps reach (`<10 stamp` = 0, `Reach box N` = N). Proof: onboarded
  box 12 (6 users) exceeds box 9 (2), impossible for a cumulative count. So:
  - the sum of all buckets is a **genuine unique count of users with any stamp**
    (318,463 on 18 Sep — never fewer than Daily Login's 314,849 customers);
  - "reached at least box N" is the sum of buckets N and above.
- **`is_onboard_yn = Y` means the user has opened the blindbox page.** Its total
  (44,916 on 18 Sep) is the **User onboard** figure, which is no longer entered
  by hand.
- An unrecognised `box_stamp` label, a flag other than Y/N, or a repeated bucket
  **rejects the file** rather than being guessed at.

### 2.3 User onboard (was “page visitors”, manual until v1.4)

**Since v1.5 this comes from `blindbox_reach`**: the total of `is_onboard_yn = Y`
across all buckets. The manual admin form has been removed. Until a reach export
is uploaded, the figure shows as "Not available" and the stamp ladder falls back
to claims only.

*Previously (v1.4 and earlier):* a single number entered by hand in the admin
area.

**Displayed as “User onboard.”** Stored as `page_visitors` in D1; the display name is
what the business uses.

- **Fields:** number, "as of" date/time (WIB), note (optional), updated by.
- **Editable** at any time; every change is kept in a history log.
- **Not daily.** It has no trend and no day-over-day change.
- **Display:** always show it with its date, e.g. "User onboard: 12,000 (as of 15 Sep, 18:00 WIB)". If it is older than the latest data upload, show a "may be outdated" hint.

### 2.4 Data rules

**Joining**
- **Claim files.** `blind_box_id2` (13–24) matches `blindbox.id` and `blindbox_reward.blind_box_id`. Ignore `blind_box_id` (1–12).
- **Spend files.** Here `blind_box_id2` is **1–12**, not 13–24. Never join spend files on it. Join on the reward ID instead (`id` in spend files = `reward_id` in claim files = `blindbox_reward.id`) and take the box from `blindbox_reward`.

**Dates**
- **Launch filter.** Exclude dates before 2026-09-15 by default. An optional toggle can show test data.
- **Partial day.** When a date equals the export date, label it "today (partial, as of HH:MM WIB)". Files are exported at different times, so each section shows its own "as of" time.

**Users**
- **Unique users.** `total_claim_user` and `total_user_claimed` are counted per reward, so summing them across rewards counts people multiple times. Never display such a sum as "unique users."
- **Gacha users are not a unique campaign count.** `daily_claim_gatcha.total_claim_user` counts users who claimed *on that day*. A user can spin many times, and the figure cannot be added across days without counting the same person repeatedly. Report it as a per-day figure only — never as "unique users" — and keep it off the Overview KPI row, where a bare number beside the word "users" reads as a campaign total.
- **The only campaign-wide user figure** is the manual **user onboard** number. A cross-box unique count needs a new export; see §7.

**Cost and redemption**
- **Cost source of truth.** Spend comes from the spend files. `spend_amount` is money actually spent:
  - For cashback, redeemed always equals claimed, since cashback is credited automatically.
  - For coupons, spend = coupon face value × coupons redeemed.
- **Total spend.** Box reward spend + gacha cashback. Gacha is a separate cashback-only draw unlocked every 20 spins, and it is **not** included in the spend files.
- **Redemption rate** is only meaningful for coupons. Show cashback as "auto-credited" rather than as a 100% rate.

**Stock**
- **Stock warning.** A reward is in **warning** when 10% or less of its stock is left, and **out** when 0% is left.
- **No stock set.** If `stock_total` is 0 (currently "1 Session in Strong Pilates"), show "no stock set" instead of dividing by zero.

**Checks**
- **Weight check.** Flag any box whose reward weights do not sum to 100. Current data: **four** boxes are off — box 16 sums to 102, box 20 to 96.1, box 22 to 101, and box 24 to 96.98. (Box 20 was missing from earlier drafts.)

**Known data issue (to fix upstream)**

This is worse than earlier drafts described. Measured against the 15 Sep exports:

- **Every coupon row in `daily_spent_reward` reads 0 claimed and 0 redeemed, on all 15 dates** — not only 15 Sep. The cumulative export reports 742 claimed and 32 redeemed over the same period.
- The only non-zero redemptions in the daily file are **10 cashback credits, and all of them fall on pre-launch dates** (1, 3, 4, 9, 12 and 14 Sep). Launch day is entirely empty.
- Daily coupon spend totals **Rp0** against **Rp190,000** cumulative.
- Its stock columns are also current values repeated on every date, not daily values, so they are ignored.

The columns exist and are mapped correctly; they are simply not being populated.

**Daily cashback is reconstructed instead, and only coupons are actually lost.**
`daily_claim_rewards` carries both the number of claims and the configured payout
per claim, and a cashback reward pays out exactly its `cashback_value` every time
it is claimed — there is no redemption step to introduce uncertainty. So daily
cashback spend is derived as `total_claim × cashback_value`:

- Summed over all dates this gives **Rp588,100** against **Rp603,000** in the
  13:51 cumulative snapshot. The Rp14,900 gap is the 75 minutes of activity
  between the 12:36 claims export and the 13:51 spend one, so the two reconcile.
- On the six pre-launch dates where the daily export *did* populate cashback, the
  derived figure matches it **to the rupiah** — the only cross-check available,
  and it passes.
- The export is preferred wherever it has data, so the charts self-correct the day
  the upstream query is fixed.

**Coupons cannot be reconstructed.** A claimed coupon only costs money when a user
redeems it, the claims file records no redemptions, and face value is unknown for
coupons nobody has redeemed. So:

- Daily budget charts reach **89%** coverage (was 62%), with coupon redemptions —
  currently Rp190,000 — the only missing component. Each chart states this.
- The Redemption page **omits its daily coupon chart entirely** rather than drawing
  a flat zero, which would read as "nothing happened" instead of "data missing".
- Cumulative spend and redemption KPIs use the total spend file and are unaffected.

---

## 3. Metrics

| Metric | Definition | Source |
|---|---|---|
| User onboard (since launch) | Latest manual value | Manual input |
| Onboard → Welcome Box rate | Welcome Box claims since launch ÷ user onboard. **Still unconfirmed:** only valid if the two figures count the same population and each user can open each box once. Until confirmed, read the first ladder step as indicative, not as a conversion rate | Manual + claims |
| Box claims | Σ `total_claim` | `daily_claim_rewards` |
| Ladder reach | Claims per box, ordered by `stamp_required` | `daily_claim_rewards` |
| Step-down % | Claims in box N ÷ claims in box N−1 | Derived |
| Gacha claims / cashback | `total_claim` / `cashback_amount`, cumulative since launch | `daily_claim_gatcha` |
| Gacha users claiming (per day) | `total_claim_user` for one date. Not summable, not unique across the campaign | `daily_claim_gatcha` |
| Cashback per gacha user | Gacha cashback ÷ gacha users (same day) | `daily_claim_gatcha` |
| Box reward spend | Σ `spend_amount` | Total spend (cumulative), daily spend (per day) |
| Cashback spend | Σ `spend_amount` where `type` = CASHBACK | Spend files |
| Coupon spend | Σ `spend_amount` where `type` = COUPON | Spend files |
| Total spend / budget | Box reward spend + gacha cashback. Both halves are all-time, because the spend snapshot cannot be sliced by date | Spend files + gacha |
| Budget by reward type | Spend split three ways: box cashback, coupon redemptions, gacha cashback | Spend files + gacha |
| Daily burn rate | Total budget ÷ days elapsed since launch | Derived |
| Coupons claimed / redeemed | Σ `total_user_claimed` / Σ `total_user_redeemed` where `type` = COUPON | Total spend |
| Coupon redemption rate | Coupons redeemed ÷ coupons claimed (overall, per box, per merchant, per coupon) | Total spend |
| Coupon face value | `spend_amount ÷ total_user_redeemed` (only when redeemed > 0) | Total spend |
| Stock left % | `1 − stock_distributed / stock_total` | Latest total snapshot |
| Change since last snapshot | Latest snapshot − previous snapshot, per reward (claims, redemptions, spend) | Snapshots |

---

## 4. Layout

### Page 1 — Overview (default)

1. **Header.** Campaign name, data freshness ("Claims as of 12:36 WIB · Spend as of 13:51 WIB"), date range picker, a "Show test data" toggle, and an Upload button.
2. **KPI row:**
   - User onboard (manual value with its "as of" date, no day-over-day change)
   - Total box claims, cumulative since launch, with the cashback / coupon split underneath
   - Total gacha claims, cumulative since launch, with cashback underneath
   - Total spend (box rewards + gacha), with a three-way split underneath
   - Coupon redemption rate (e.g. "4.3% · 32 of 742")
   - Rewards in stock warning (count, red when above 0)
   - All cards except user onboard show the change vs. the previous day.
   - **The three "total" cards ignore the date range** and are labelled as such, so a running total does not move when someone narrows the range to read a chart. The charts below do respond to it.
3. **Daily trend.** Bars for box claims and gacha claims per day, with a line for total spend.
4. **Stamp ladder.** A horizontal funnel covering the period since launch: user onboard first, then 12 steps (Welcome Box at 10 stamps → Fancam & Music Box at 300). Shows claims and step-down % between steps. Boxes with no claims yet are greyed out and labelled "not reached yet." When no onboard figure has been entered the first step is dropped entirely rather than shown as zero.
5. **Spend split.** A stacked bar per day: box cashback, coupon redemptions, and gacha cashback. Includes a donut or stacked total for the cumulative split.
6. **Stock alerts.** A compact list of rewards at warning or out, showing box, reward, stock left, and a progress bar.

### Page 2 — Rewards

- Box filter (chips for the 12 boxes) and a type filter (Cashback / Coupon).
- A table of all 105 rewards with these columns: reward image, name, box, rarity badge, type, weight %, stock left bar, claimed, redeemed, redemption %, spend, change since last snapshot.
- Sorted by stock left (lowest first) by default.
- Top rewards: the 10 most-claimed rewards and the 10 biggest spend items.

### Page 3 — Redemption

Covers **both** ways a reward costs money: coupons that users redeem, and cashback that is credited automatically.

**Coupons**

- **KPIs:**
  - Coupons claimed
  - Coupons redeemed
  - Redemption rate
  - Coupon spend
  - Average face value of redeemed coupons
- **Redemption by merchant:** a bar chart of claimed vs. redeemed, grouped by merchant (derived from the coupon name, e.g. Tokopedia, Blibli, Indomaret).
- **Redemption by box:** a bar chart of coupon redemption rate per box.
- **Coupon table:** coupon, box, `coupon_ref_id`, claimed, redeemed, rate, spend.
- **Daily redemption and spend trend.** Omitted entirely while the daily spend export has no coupon data — see the known data issue in §2.4.

**Cashback (new in v1.4)**

- **KPIs:** cashback credited (count), cashback spend, average per credit.
- **No redemption rate.** Cashback is credited automatically, so redeemed always equals claimed. Show "auto-credited" instead of 100%.
- **Cashback by box**, and a table of every cashback reward: reward, box, credited, spend, average per credit.

### Page 1b — Activity (new in v1.5)

What users do to earn stamps, and how far it gets them. Cumulative snapshots, so
the date range does not apply.

- **KPIs:** active users (unique, from reach), onboarded (Y and rate), **eligible
  but never opened the page** (onboard N with ≥10 stamps — 14,807 on 18 Sep,
  more than the 6,183 eligible onboarded users), transactions, stamps issued.
- **How far users have got:** a ladder, one column per box, of users whose
  stamps reach it or beyond. A switch shows **both**, **opened the page (Y)** or
  **never opened (N)**; every figure follows it — count, split, step-down, how
  many stop at the box, and the **box claim rate** (claims ÷ onboarded users
  reached; not shown in the N view, since those users cannot claim). Marked ≈
  when claims and reach come from different days.
- **All activities:** filterable by quest group, sortable on any column.
  Customers are drawn as a bar; transactions per customer shows which activities
  people repeat. The not-summable and reconciliation notes sit with the table.
- CSV downloads for reach and for the activity table as filtered.

**Stamp ladder (Overview and Blind boxes), upgraded in v1.5.** With a reach
export each box shows onboarded users who have reached it, the step-down
between boxes, and claims beneath. Conversion (since-launch claims ÷ onboarded
users reached) is shown **only when the claims and reach exports share a WIB
date**; otherwise both dates are stated and conversion is withheld. It still
assumes one claim per user per box (§3, to confirm).

### Page 1c — Trends (new in v1.6)

Daily monitoring: what moved each day, and whether that is normal. Full
reasoning in `daily-trend-monitoring.md`.

- **Daily scorecard.** New users with a stamp, newly onboarded, newly eligible,
  daily logins (≈ DAU), stamp transactions, stamps issued, box claims, gacha
  claims and users, box cashback, coupons redeemed, coupon spend, gacha
  cashback. Each shows its latest finished day, vs the previous day, vs the mean
  of up to 7 days before (≥ 3 needed), and a 14-day sparkline. ±30% from the
  mean is flagged unless the mean is under 20. A day still running is shown as
  "today so far", never compared.
- **Users with stamps by tier** (Box 1–2, 3–4, 5–6, 7–9, 10–12) at the end of
  each day, switchable between both / opened the page / never opened; then new
  users reaching each box per day, as a box × day table.
- **Box claims per day** by the same tiers, then box × day.
- **Stamps issued per day** by quest, then each activity's latest day.
- Snapshot sources give a day's figure as the difference between consecutive
  daily exports, so reach, activity and total spend must be uploaded **daily**.

### Page 4 — Budget (new in v1.4)

**The most important view.** What the campaign has cost, and how fast.

- **KPIs:** total budget spent, box cashback, coupon redemptions, gacha cashback, daily burn rate.
- **Daily budget**, stacked by reward type (box cashback / coupon redemptions / gacha cashback), with a cumulative line.
- **Breakdown by reward type:** a table of the three types with credited-or-redeemed counts, spend, average per unit, and share of total budget.
- **Breakdown by box:** cashback spend, coupon spend and total per box.
- **Biggest cost items:** the top spend rewards.
- Gacha is not in the spend files, so its cashback is always added separately. Any figure that mixes the two says "all time", because the spend snapshot cannot be sliced by date.
- A budget cap and pacing against it are parked in §7; the daily burn rate is the closest thing available without a target.

### Page 5 — Gacha

- KPIs: claims, unique users, cashback, cashback per user.
- Daily trend of claims and users.
- Cumulative cashback line (a budget line will be added next scope).

### Page 6 — Catalog (reference view)

- A gallery of the 12 boxes using `image_url`, each showing its stamp requirement and number of rewards.
- Clicking a box opens a panel with its rewards: image, name, rarity, drop odds (weight), value, and stock.
- A warning badge on any box whose weights do not sum to 100.

### Page 7 — Admin / Upload

- **Daily upload.** Drop zone for the 5 daily files.
  - Detect each file by name prefix and check its columns.
  - Show a preview per file: row count, date range, export time, and what changed since the last upload.
  - Allow publishing a partial set: files that are missing keep their previous data.
- **User onboard.** A small form to update the number and its "as of" date, with the change history below it.
- **Reference upload.** A separate section for `blindbox` and `blindbox_reward`.
- **Upload history.** Timestamp, file names, uploaded by, and status for each upload.

### Mobile behaviour

- KPI cards stack in a 2-column grid.
- Charts use the full width.
- The stamp ladder becomes vertical.
- Tables collapse into cards showing name, stock bar, claimed/redeemed, and spend.
- Navigation moves to a bottom tab bar (Overview, Trends, Activity, Rewards, More). Blind boxes, Budget, Redemption, Gacha and Admin sit under More.

---

## 5. Architecture (Cloudflare)

- **Frontend.** Static app on Cloudflare Pages.
- **Parsing.** CSVs are parsed in the browser (PapaParse), then sent to a Pages Function.
- **Storage.** Cloudflare D1 (SQLite), with these tables:
  - `blindbox`, `blindbox_reward`
  - `daily_gacha`
  - `daily_rewards`
  - `reward_snapshots` (from `total_claim_rewards`, includes `snapshot_at`)
  - `daily_spend` (from `daily_spent_reward`; `date_temp` → `date`, `id` → `reward_id`)
  - `spend_snapshots` (from `total_spent_reward`, includes `snapshot_at`; `id` → `reward_id`)
  - `page_visitors` (value, as_of, note, updated_by, updated_at; each edit is a new row, and the latest row is the current value). Displayed as **User onboard**.
  - `uploads`
- **Access control.** Cloudflare Access (Zero Trust) in front of the whole site, allowing only approved emails, with a stricter policy on `/admin/*`. This is internal bank data, so it should never sit on a public URL. Implemented as **two** Access applications, because a path-scoped application is matched ahead of the wider one; the three write routes are added to the stricter one. See `app/README.md`.
- **Spend tables deliberately omit `blind_box_id2`.** In the spend exports that column holds 1–12 while boxes are 13–24, so it must never be joined on. Leaving it out of the schema means it cannot be joined on by mistake later.
- **Bulk inserts use SQL literals, not bound parameters.** D1 caps a statement at 100 bound parameters, which would force ~160 statements for the 1,575-row daily spend file and exceed the free plan's 50-queries-per-invocation limit. Values are written inline instead, chunked to 80 KB.
- **Images.** Loaded directly from the COS URLs, with a placeholder if an image fails to load.

---

## 6. Launch-day sample data (15 Sep 2026, partial day)

Use these numbers in the prototype so it looks realistic.

### Gacha (as of 12:19 WIB)

- 1,279 claims
- 812 unique users
- Rp1,336,500 cashback

### Box claims (as of 12:36 WIB)

1,991 total: 1,289 cashback and 702 coupon.

| Box | Stamps | Claims |
|---|---|---|
| Welcome Box | 10 | 814 |
| First Stream Box | 20 | 577 |
| CTBU Box | 35 | 399 |
| Fit Check Box | 50 | 189 |
| Weverse Box | 75 | 11 |
| Cineplex Box | 100 | 1 |
| Visa, Sports Club, Merchandise, Shared Bites, Seoul, Fancam & Music | 120–300 | 0 |

### Spend and redemption (cumulative, as of 13:51 WIB)

These figures include a few pre-launch test claims.

**Overall**
- Box reward spend: **Rp793,000**
  - Cashback: Rp603,000 (1,337 auto-credited)
  - Coupons: Rp190,000
- Coupons: 742 claimed, 32 redeemed (**4.3%**)

**Per box**

| Box | Claimed | Redeemed | Spend |
|---|---|---|---|
| Welcome Box | 860 | 624 | Rp296,600 |
| First Stream Box | 601 | 395 | Rp236,100 |
| CTBU Box | 410 | 252 | Rp149,900 |
| Fit Check Box | 195 | 89 | Rp102,900 |
| Weverse Box | 12 | 8 | Rp5,500 |
| Cineplex Box | 1 | 1 | Rp2,000 |

**Coupons redeemed so far**

| Coupon | Box | Redeemed / claimed | Spend |
|---|---|---|---|
| Tokopedia Rp5K | Welcome | 9 / 72 | Rp45,000 |
| Blibli Rp5K | First Stream | 9 / 105 | Rp45,000 |
| Tokopedia Rp5K | First Stream | 7 / 52 | Rp35,000 |
| Tokopedia Rp10K | Fit Check | 4 / 27 | Rp40,000 |
| Indomaret Rp5K | First Stream | 2 / 54 | Rp10,000 |
| Blibli Rp15K | Fit Check | 1 / 15 | Rp15,000 |

### Top rewards by claims (12:36 WIB)

| Reward | Box | Claims |
|---|---|---|
| Balance Rp100 | Welcome | 271 |
| Balance Rp500 | Welcome | 165 |
| Balance Rp100 | First Stream | 163 |
| Balance Rp500 | First Stream | 101 |
| Blibli Discount of Rp5K | First Stream | 100 |

### Scarcest stock

**Note:** this table is ranked by **% used**, not % left. Stock left % is
`1 − distributed / total`, so Prime Bag below has **67% left**, not 33%. On this
export **nothing is at or below the 10%-left warning threshold**, so the stock
warning count is correctly 0 and the dashboard falls back to a "most depleted"
list — which is exactly the ordering below.

| Reward | Stock | Distributed | Used |
|---|---|---|---|
| Prime Bag by Zena | 6 | 2 | 33% |
| 5 Weverse Jelly (First Stream) | 41 | 8 | 20% |
| 5 Weverse Jelly (Weverse) | 57 | 4 | 7% |
| Zena Discount of Rp100K | 30 | 2 | 7% |

---

## 7. Next scope (parked)

Ordered by how much they are being asked for. Each is a new pure function in
`src/lib/metrics/` over data the client already holds, plus a panel — except
where a new export is needed, which is called out.

### Blocked on upstream data

1. **Fix the coupon half of `daily_spent_reward`.** *Blocks the last 11% of the
   daily budget view.* Coupon claims and redemptions are 0 on every date (§2.4).
   Cashback is now reconstructed from the claims file, so daily coverage is 89%
   and **coupon redemptions are the only component still missing**. Needs no
   dashboard work — the columns are already mapped and the charts prefer the
   export the moment it has data.
2. **Budget cap and targets.** *Blocks pacing.* A cashback budget cap, a user
   target and an MTU goal unlock target lines, "days until the budget runs out",
   and pacing against plan. The Budget page already computes a daily burn rate
   and leaves room for a cap line on the cumulative chart. Needs the numbers
   from the business, not an export.
3. **Unique claimers per box.** *Partly resolved in v1.5*: reach gives unique
   users with any stamp and by box reached. Still missing is how many *distinct
   users* claimed each box — conversion currently assumes one claim per user
   per box.
4. **Stamp progress data.** *Done in v1.5* via `blindbox_reach` — the ladder is
   now a reached → claimed funnel. Remaining gap: conversion needs claims and
   reach exported the same day.
5. **Face value for never-redeemed coupons.** Face value is derived as
   `spend ÷ redeemed`, so it is unknown for the 64 coupons nobody has redeemed
   yet. Without it, **unredeemed coupon exposure** — the maximum cost if every
   claimed coupon were used — cannot be computed. This is the biggest blind spot
   in the budget picture: 710 claimed coupons currently carry an unknown
   liability. Needs a face value per `coupon_ref_id`.
6. **Stock run-out projection.** Days until stock runs out at the current rate,
   once 3 or more daily snapshots exist. Only one snapshot is stored today, which
   is also why the "change since last snapshot" column is empty.

### Fixable at the source

7. **Weight sums.** Four boxes do not sum to 100 (§2.4). The dashboard flags
   them; the fix belongs in the campaign config.
8. **Reward status.** Three of the 105 rewards are `PENDING` while active. They
   are badged rather than filtered out, on the assumption that is intentional —
   worth confirming.

### Dashboard-side, not yet built

9. **Per-day cashback and coupon detail** once (1) lands: the Budget page's
   breakdown by reward type is cumulative only, because the daily file cannot
   support it yet.
10. **Merchant mapping as data.** Merchant is currently derived from the coupon
    name with a small alias table (`src/config/merchants.ts`) because no merchant
    field exists. A merchant column on the reward would remove the guesswork.
11. **Export/share.** No CSV download or scheduled email. Leadership currently
    reads the dashboard directly.

Done in v1.3: coupon cost and voucher redemption per reward, both now covered by
the spend files.

Done in v1.4: the Budget page, the cashback section on Redemption, daily cashback
reconstructed from the claims file, and the corrections in §2.4 and §6.

Done in v1.5: the Activity page, automatic User onboard from reach, and the
reached → claimed stamp ladder.

## 8. Build prompts

The prompts for Claude Design and Claude Code are in `blindbox-dashboard-prompts.md`.

---

## 9. Changes in v1.4

Corrections found while building the dashboard against the real exports. Where
this document and the app disagreed, the app was right.

| # | Was | Now |
|---|---|---|
| 1 | Three boxes with bad weight sums (16, 22, 24) | **Four** — box 20 (Sports Club) sums to 96.1 |
| 2 | `daily_spent_reward_result` shows 0 on 15 Sep | **Every coupon row is 0 on all 15 dates**; its only redemptions are 10 pre-launch cashback credits. Daily cashback is now reconstructed from claims × payout, leaving coupons as the only gap |
| 3 | Gacha users are a true unique count | A **per-day** count of users claiming; not unique across the campaign, not summable |
| 4 | `total-spend-reward_result_` (hyphens) | `total_spent_reward_`; the old name is kept as a legacy alias |
| 5 | "Page visitors" | **"User onboard"** (display name; the table stays `page_visitors`) |
| 6 | Box claims / gacha users as KPIs | **Total box claims** and **total gacha claims**, cumulative since launch and ignoring the date range |
| 7 | "Scarcest stock" read as % left | That table is ranked by **% used**; nothing is within the 10%-left warning threshold |

All launch-day figures in §6 were verified against the seven exports and
reproduce exactly.


---

## 10. Changes in v1.5

| Was | Now |
|---|---|
| User onboard typed into Admin | Read from `blindbox_reach` (onboard Y); manual form removed |
| Stamp ladder: claims per box | Onboarded users reached per box, with claims and same-day conversion |
| No unique user count | 318,463 unique users with any stamp, from reach's exclusive buckets |
| — | Activity tab: reach funnel, stamps by quest, all 32 activities |
| Seven upload file types | Ten: `activity_level_`, `blindbox_reach_` (regular), `activity_list_` (reference) |

---

## 11. Changes in v1.6

| Was | Now |
|---|---|
| Only the latest two snapshots reached the UI | `/api/bootstrap` also returns the last export of each day for reach, activity and total spend (spend summed per type) |
| No day-by-day view of users, activity or coupons | Trends page: daily scorecard, users by stamp tier, new users per box per day, claims per box per day, stamps by quest |
| Daily coupon cost unavailable (§2.4) | Recovered as the day-over-day change in `total_spent_reward`, when it is uploaded daily |
| Mobile tabs: Overview, Activity, Blind boxes, Rewards | Overview, Trends, Activity, Rewards; Blind boxes under More |
