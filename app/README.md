# Allo Blind Box Season 2 — Monitoring Dashboard

Internal dashboard for the Blind Box Season 2 campaign (launched **15 Sep 2026**).
Leadership reads it; the campaign team feeds it by dropping the daily CSV exports
into the admin page.

- **Frontend** Vite + React + TypeScript + Tailwind, Recharts for charts
- **API** Cloudflare Pages Functions
- **Storage** Cloudflare D1
- **Access** Cloudflare Access (Zero Trust). There is no login screen in this app by design.

Data rules come from `../docs/blindbox-dashboard-spec.md`. Where this app and the
spec disagree, see [Known discrepancies](#known-discrepancies) — the app is right
and the spec is stale.

---

## Quick start

```bash
npm install
npm run seed     # applies migrations to a local D1 file, loads ../docs/*.csv
npm run dev      # Vite on :5173 (HMR) + the API on :8788
```

Open **http://localhost:5173**. The Vite server proxies `/api/*` to the Pages
Functions running on `:8788`, so both halves work from one URL.

Nothing above touches your Cloudflare account. `--persist-to ./.wrangler/state`
keeps D1 in a local SQLite file; `wrangler` only talks to Cloudflare when you
pass `--remote` or run `deploy`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev, Vite + API. Builds once first so `dist/` exists. |
| `npm run build` | Typecheck, then build to `dist/`. |
| `npm run preview` | Build and serve the built app on `:8788` exactly as Pages will. |
| `npm test` | The full suite (333 tests), run against the real CSVs in `../docs`. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run seed` | Migrate + load `../docs/*.csv` into local D1. Re-runnable. |
| `npm run db:reset` | Delete the local database and re-migrate. |
| `npm run db:migrate:remote` | Apply migrations to the **real** D1. Asks nothing — be sure. |
| `npm run deploy` | Build and `wrangler pages deploy`. Touches your account. Pushes to `main` do this from GitHub Actions. |

---

## How the data gets in

Five exports are uploaded daily, two more only when the campaign config changes.
Files are identified **by filename prefix**, then their columns are validated.
`src/config/fileTypes.ts` is the single source of truth for that mapping — no
prefix or column name is hardcoded anywhere else.

| # | Filename prefix | Contents | Load rule |
|---|---|---|---|
| 1 | `daily_claim_gatcha_` | 1 row per date | replace |
| 2 | `daily_claim_rewards_` | 1 row per date × reward | replace |
| 3 | `total_claim_rewards_` | cumulative claims + stock | snapshot |
| 4 | `daily_spent_reward_` | 1 row per date × reward | replace |
| 5 | `total_spent_reward_` | cumulative spend + redemption | snapshot |
| 6 | `blindbox_reward_` | reward reference | replace |
| 7 | `activity_level_` | cumulative activity totals | snapshot |
| 8 | `blindbox_reach_` | users by highest box reached × onboard Y/N | snapshot |
| 9 | `activity_list_` | activity reference | replace |
| 10 | `blindbox_` | box reference | replace |

**Order matters.** Detection takes the first prefix that matches, so every name
starting `blindbox_` — `blindbox_reach_`, `blindbox_reward_` — is tested before
`blindbox_` itself. (The table above is grouped for reading; the real order is in
`src/config/fileTypes.ts`.)

**Reach files are also checked row by row.** An unrecognised `box_stamp`, a
non-Y/N onboard flag or a repeated bucket rejects the file, in the browser and
again on the server — a mis-filed bucket would skew every funnel figure.

**Prefixes are shorter than the filenames.** The exporter currently writes
`daily_spent_reward_result_…`; matching is `startsWith`, so both that and a
future `daily_spent_reward_…` resolve correctly. The old hyphenated
`total-spend-reward_result_` is kept as a legacy alias in the same file and is
safe to delete once no archived exports use it.

**Upload the files as exported, without renaming them.** Both the type and the
export timestamp are read out of the name
(`…_2026-09-15T13_51_34.335429+07_00.csv` → `2026-09-15 13:51:34` WIB). A renamed
file with no timestamp is rejected rather than guessed at.

### Replace vs snapshot

- **Daily files** are full-history exports. Publishing empties the table and
  reloads it in a single D1 batch, so a mid-flight failure cannot leave it half
  written.
- **Total files** are appended, keyed by their export timestamp. Re-uploading a
  timestamp that is already stored is rejected, with the reason shown in the UI.
- **A partial publish is fine.** The five exports are produced at different
  times; any file you leave out keeps its existing data.

### User onboard

Comes from the latest `blindbox_reach` export: the total of onboard `Y` across all
buckets — users who have opened the blindbox page. There is no manual input any
more. Until a reach file is uploaded the Overview shows it as "Not available" and
the stamp ladder falls back to claims only.

The old `page_visitors` table from migration 0001 is left in place, unused.
Dropping a table is destructive and it costs nothing to keep.

---

## Creating the D1 database

```bash
npx wrangler d1 create blindbox-dashboard
```

Paste the returned `database_id` into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "blindbox-dashboard"
database_id = "your-id-here"
migrations_dir = "migrations"
```

Then create the schema on the real database:

```bash
npm run db:migrate:remote
```

**Do not seed production from the CSVs.** Seeding is a local convenience. On the
real database, upload the two reference files and the five daily files through
`/admin/upload` so the `uploads` table records who published what.

### Schema notes

`migrations/0001_init.sql` creates nine tables. Two decisions worth knowing:

- The spend tables **deliberately do not store `blind_box_id2`**. In the spend
  exports that column holds 1–12 while boxes are 13–24, so joining on it would
  attribute every reward to the wrong box. The box is always resolved through
  `blindbox_reward.id`. If the column is not there, nobody can join on it by
  mistake later.
- Two renames happen at parse time: `date_temp → date` and `id → reward_id`.

### Why bulk inserts use SQL literals, not bound parameters

D1 caps a statement at **100 bound parameters**. With a 10-column table that is
ten rows per `INSERT`, so the 1,575-row spend file would need ~160 statements —
over the 50-queries-per-invocation limit on the free plan. `src/lib/sql.ts`
writes values inline instead, chunked to 80 KB (D1's limit is 100 KB), which
brings the same file down to a handful of statements. Every value reaching that
code has already been normalised to a finite number, a string, or null, and the
escaping is unit-tested including a statement-breakout attempt.

---

## Deploying to Cloudflare Pages

First time:

```bash
npx wrangler d1 create blindbox-dashboard        # paste the id into wrangler.toml
npm run db:migrate:remote                        # create the schema on it
npx wrangler pages project create blindbox-dashboard --production-branch main
npm run deploy
```

> Changing `database_id` in `wrangler.toml` also changes where miniflare keeps
> the **local** database, so local D1 will look empty afterwards. Run
> `npm run seed` once to repopulate it. Production is unaffected.

After that, deploys run from GitHub (`.github/workflows/deploy.yml`): every
push to `main` runs the tests, builds, and publishes to Pages. It needs two
repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | An API token (My Profile → API Tokens → Create custom token) with **Account › Cloudflare Pages › Edit** and **Account › D1 › Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | The account id, shown on the Workers & Pages overview |

To redeploy without a commit, use **Actions → Deploy → Run workflow**.
`npm run deploy` from a logged-in machine still works and does the same thing.
Migrations are never applied automatically: run `npm run db:migrate:remote`
before merging a change that adds one.

To wire up your own domain:

1. **Workers & Pages → blindbox-dashboard → Custom domains → Set up a custom
   domain.** Enter the hostname, e.g. `blindbox.yourdomain.com`.
2. Cloudflare adds the CNAME itself if the zone is already on your account.
3. Wait for the certificate to issue, then confirm the site loads.
4. **Set up Access before sharing the URL.** Until you do, the deployment is
   public. See the next section.

Also set the upload allowlist as a Pages environment variable (Settings →
Variables and Secrets), so the write endpoints enforce the same list as the
admin Access policy:

```
UPLOAD_ALLOWLIST = ghazy@example.com,teammate@example.com
```

If it is unset, the write APIs rely on Access alone.

### `_routes.json`, `_redirects`, `_headers`

In `public/`, copied into `dist/` at build time:

- `_routes.json` runs Functions only for `/api/*`, so static assets are served
  straight from the edge.
- `_redirects` serves the app shell for any non-asset path, so `/rewards` and
  `/admin/upload` survive a hard refresh.
- `_headers` sets `X-Frame-Options: DENY`, `nosniff`, `no-referrer`,
  `X-Robots-Tag: noindex` and a restrictive `Permissions-Policy`. These are a
  second layer, not the access control.

### Optional hardening: Content-Security-Policy

Not shipped, because a wrong CSP fails silently in the browser and I could not
verify one here. The page loads fonts from two CDNs and reward artwork from the
campaign's COS bucket, so all three need allowlisting. Add this to `_headers`
under `/*` and then check in a real browser that fonts render and reward images
load:

```
Content-Security-Policy: default-src 'self'; img-src 'self' data: https://allo-prd-1309371152.cos.ap-jakarta.myqcloud.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com; font-src 'self' https://fonts.gstatic.com https://api.fontshare.com https://cdn.fontshare.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'
```

`'unsafe-inline'` is needed for `style-src` because Recharts sets inline styles
on the elements it renders.

---

## Configuring the two Access policies

The whole site sits behind Cloudflare Access with an email allowlist. Leadership
can view; only the campaign team can upload. That is **two applications**, not
one with two rules — a path-scoped application is matched ahead of the wider one.

Everything below is in the **Zero Trust dashboard** → **Access** →
**Applications** → **Add an application** → **Self-hosted**.

### Application 1 — the whole dashboard (viewers)

| Field | Value |
|---|---|
| Application name | `Blind Box Dashboard` |
| Domain | `blindbox.yourdomain.com` (no path) |
| Session duration | 24 hours |

Policy:

| Field | Value |
|---|---|
| Policy name | `Dashboard viewers` |
| Action | Allow |
| Include | **Emails** → the leadership + team addresses, or **Emails ending in** → `@yourcompany.com` |

### Application 2 — the admin area (the team only)

Create this **second**, and make it stricter.

| Field | Value |
|---|---|
| Application name | `Blind Box Dashboard — Admin` |
| Domain | `blindbox.yourdomain.com` with path `admin*` |
| Session duration | 8 hours |

Policy:

| Field | Value |
|---|---|
| Policy name | `Campaign team only` |
| Action | Allow |
| Include | **Emails** → only the people who upload |

Because Access evaluates the most specific path match first, a viewer who is
allowed by Application 1 still hits Application 2's stricter policy at `/admin/*`
and is refused.

**Add the write endpoints to Application 2 as extra domains** so the API is
guarded at the edge too, not only in code. Use *Add a domain* on the same
application:

- `blindbox.yourdomain.com/api/publish`
- `blindbox.yourdomain.com/api/reference`

Those two are the only write routes. `/api/bootstrap`, `/api/uploads` and
`/api/me` are read-only and stay under Application 1. 

### How the app reads identity

Access injects `Cf-Access-Authenticated-User-Email` on every request that gets
through. `functions/api/_shared/auth.ts` reads it and records it as `uploaded_by`
/ `updated_by`. It cannot be spoofed from outside, because a request that has not
passed Access never reaches the app.

**Write endpoints refuse any deployed request without that header**, even before
Access is configured and even if a policy is later misapplied. The local-dev
fallback is gated on the request's own hostname being `localhost` — not on an
environment variable, because `CF_PAGES` and `CF_PAGES_BRANCH` are set by
`wrangler pages dev` too and cannot tell local from deployed. A request that
actually arrives at localhost cannot have come from the internet.

Three gates on a write, in order:

1. Local request → trusted, a developer on their own machine.
2. Deployed request with no Access header → **403, always**.
3. Access header present → `UPLOAD_ALLOWLIST` narrows further if set.

Reads are deliberately *not* gated this way. Access is the control for those;
a second authentication system in the app would be worse, not better.

### Current setup: shared admin password, open reads

Cloudflare Access is **not** configured on this deployment. Instead:

- **Reporting pages are readable by anyone with the link.** There is no login.
- **Writes require a shared password**, configured as a Cloudflare Pages secret:

```bash
npx wrangler pages secret put ADMIN_PASSWORD --project-name blindbox-dashboard
```

Enter the password when prompted. For local development, put
`ADMIN_PASSWORD = "your-local-password"` in the ignored `app/.dev.vars` file.
Keep passwords out of `wrangler.toml` and Git history.

The password is compared **on the server**. A password checked in the React
bundle would be readable by anyone who opens devtools, so the admin screen only
hides the UI — skipping it and calling `/api/publish` directly is still refused.
The browser holds it in `sessionStorage` for the tab, and a rejected password
returns the user to the gate rather than showing a publish error.

A shared password identifies nobody — uploads are recorded as `anonymous` —
and the campaign data remains world-readable. Use a strong password; use Access
when reporting data needs restricted access.

To change it, update the Pages secret and redeploy. To move to Access, follow
the two-application setup above and remove the password secret; the code already
prefers an Access identity when one is present, and the allowlist still applies.

### Verifying it works

0. Before Access is even configured, confirm writes are already refused:
   `curl -X POST https://<your-host>/api/publish` returns **403** with
   "did not come through Cloudflare Access". Reads return 200 until Access gates
   them.
1. Open the site in a private window. You should get the Access login, not the
   dashboard.
2. Sign in as a viewer. The Overview loads; the **Upload** button is absent and
   `/admin/upload` is refused by Access.
3. Sign in as a team member. `/admin/upload` loads, and a publish records your
   real email in the upload history.
4. `curl -X POST https://blindbox.yourdomain.com/api/publish` from outside should
   be refused by Access, not by the app.

---

## Architecture

```
functions/api/            Pages Functions
  bootstrap.ts            GET  everything the UI reads, in one call
  publish.ts              POST daily publish (partial allowed)
  reference.ts            POST box + reward reference replace
  uploads.ts              GET upload history
  me.ts                   GET viewer email + canUpload
  _shared/                auth, env helpers, and the publish planner
src/config/               fileTypes.ts (the prefix map) · merchants.ts
src/lib/csv/              detect · validate · parse (the two renames)
src/lib/metrics/          pure functions, one module per concern (budget.ts owns cost)
src/lib/sql.ts            literal encoding for bulk inserts
src/components/           UI primitives, charts, shared panels
src/pages/                Overview · Activity · Blind boxes · Rewards · Budget · Redemption · Gacha · Admin
src/test/                 the suite, run against ../docs/*.csv
migrations/               0001 core schema · 0002 activity and reach
scripts/seed.ts           local D1 loader
```

**The API is thin and the metrics are pure.** The whole campaign is a few
thousand rows, so `/api/bootstrap` ships them raw in one request and every metric
is a plain TypeScript function over plain arrays. That means the date-range picker
and the test-data toggle re-filter instantly with no refetch, and the same
functions that drive the UI are what the tests assert against.

Design tokens — colour, type scale, spacing, radius, elevation — live only in
`src/styles/tokens.css`, built on the Allo Bank brand system in `../colors_and_type.css`.
Allo Yellow is reserved for primary actions and brand accents; charts use a
separate palette, because thin strokes and small labels in `#FFAF03` are
unreadable on white.

---

## Data rules that are easy to get wrong

- **Never join the spend files on `blind_box_id2`.** It is 1–12 there; boxes are
  13–24. Join on the reward id.
- **Never sum a per-reward user column and call it unique users.**
  `total_claim_user` and `total_user_claimed` are per reward.
- **Gacha users is a per-day figure, not a campaign unique count.** One person
  spins many times. It appears on the Gacha page labelled as such and is
  deliberately absent from the Overview KPI row.
- **Cashback has no redemption rate.** It is credited automatically, so the UI
  says "auto-credited" rather than 100%.
- **Total spend = box reward spend + gacha cashback.** Gacha is not in the spend
  files at all. Both halves are all-time, because the spend snapshot cannot be
  sliced by date; the card says so.
- **Budget has three components measured in different units.** A cashback credit
  is one payout, a redeemed coupon is one face value, a gacha spin may not pay
  out at all. Never average across them — the breakdown table names the unit per
  row.
- **Gacha spend is not attributable to a box.** Budget-by-box sums to box reward
  spend (Rp793.000), not to the full budget.
- **Unredeemed coupon exposure is a floor, not a total.** Face value is derived
  as `spend ÷ redeemed`, so it is unknown for coupons nobody has redeemed. The
  figure covers only the priceable ones and the UI says how many it excludes.
- **Daily cashback is reconstructed, not read.** `daily_spent_reward` does not
  populate box spend, so daily cashback is derived as
  `total_claim × cashback_value` from the claims file — exact for cashback, which
  pays out its configured value on every claim with no redemption step. The
  export is preferred wherever it has data. Coupons have no equivalent
  reconstruction and remain the gap.
- **Pre-launch rows are test data** and hidden unless the toggle is on.
- **`stock_total = 0` means "no stock set"**, not 0% left.
- **A box's stock total hides its scarcest reward.** Pools differ by orders of
  magnitude between rewards, so a box can read 99,8% stocked while one reward
  inside it sits at 67%. The Blind boxes page shows both.
- **Drop-odds drift is judged against sampling noise, not a fixed threshold.**
  The same gap is meaningless at 50 claims and serious at 5.000, so deviations
  are measured in standard errors: past 2 is "slightly off" (chance produces
  that in ~1 reward in 20), past 3 is "off target". Boxes under 30 claims get no
  verdict at all.
- **CSV exports carry raw values, not display strings.** `1336500`, not
  `Rp1.336.500`, and percentages out of 100 rather than fractions. A spreadsheet
  can format a number but cannot un-format one. Column definitions live in
  `src/lib/csv/columns.ts`; the delimiter is a comma per RFC 4180, with a UTF-8
  BOM so Excel reads names correctly. Excel under an Indonesian locale expects
  `;` and will need Text to Columns — switching `DELIMITER` and `DECIMAL` in
  `src/lib/csv/export.ts` is the whole change if that becomes a nuisance.
- **Reach buckets are exclusive; activity customers are not summable.** Summing
  reach buckets gives unique users; summing customers across activities counts
  people repeatedly (568.304 vs ~318.463). The Activity page shows only the first.
- **Ladder conversion needs same-day exports.** Claims ÷ reached is withheld
  unless the claims and reach files share a WIB date.
- **All times are WIB (UTC+7).** Nothing is stored as UTC — `src/lib/time.ts`
  formats server-written timestamps in Jakarta time.

---

## Known discrepancies

The spec is stale in four places. The app follows reality.

1. **Four boxes have bad drop odds, not three.** The spec names 16, 22 and 24;
   **box 20 (Sports Club) sums to 96,1%** too. The weight check is generic and
   catches all four.
2. **Daily coupon redemption is entirely missing from the export**, not just on
   launch day. `daily_spent_reward` reads 0 claimed and 0 redeemed for every
   coupon on all 15 dates, while the cumulative export reports 742 claimed and
   32 redeemed. Its only non-zero redemptions are 10 cashback credits, all
   pre-launch. The Redemption page therefore omits the daily chart rather than
   drawing a flat zero, which would read as "nothing happened".
3. **Gacha users is not a unique count** — see above. The spec calls it one.
4. **The spend export is `total_spent_reward_`**, underscores throughout. The
   spec says `total-spend-reward_result_` "(hyphens, not underscores)".

**No reward is in stock warning yet.** The scarcest is Prime Bag by Zena at 67%
left. The spec's "scarcest stock" table is ranked by *% used*, not % left, so the
Stock Warnings KPI correctly reads 0 and the panel falls back to a "most depleted"
list.

---

## What is missing, in priority order

Full list with reasoning in spec §7. The two that block the most:

1. **Fix the coupon half of `daily_spent_reward` upstream.** Coupon claims and
   redemptions are 0 on every date. Daily cashback is reconstructed from the
   claims file (`total_claim × cashback_value`, which reconciles with the
   cumulative export to within the 75 minutes between the two), so the daily
   budget chart reaches ~89% and **coupons are the only missing component**. No
   dashboard work needed — the charts prefer the export the moment it has data.
2. **A face value per coupon.** Without it, unredeemed exposure can only be
   priced for the 6 coupons someone has redeemed. 19 coupons with 417
   outstanding claims have no face value at all, so the real liability is
   unknown and higher than the ≥ Rp1.720.000 shown.

Then:

3. **A budget cap and targets** — unlocks pacing, a cap line and "days until the
   budget runs out". The Budget page already computes a burn rate and leaves room
   for the line. Needs numbers from the business, not an export.
4. **Cross-box unique users** — needs a new daily unique-user export. Until then
   the only campaign-wide user figure is the manual user onboard number.
5. **Stamp-progress data** — turns the ladder into a real conversion funnel. Also
   settles whether the first step's percentage is meaningful at all.
6. **Stock run-out projection** — needs three or more snapshots. Only one is
   stored today, which is also why the "change since last snapshot" column is
   empty.

Each of these is a new pure function in `src/lib/metrics/` over data the client
already holds, plus a panel — except where a new export is named.
