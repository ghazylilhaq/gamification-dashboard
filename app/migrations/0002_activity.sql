-- Activity and blind box reach.
--
-- Three new exports:
--   activity_list_    -> activity            (reference, replaced on upload)
--   activity_level_   -> activity_snapshots  (cumulative, appended per export)
--   blindbox_reach_   -> reach_snapshots     (cumulative, appended per export)
--
-- Renames happen at parse time, as with daily_spend:
--   activity_level.customer_id       -> customers
--   activity_level.transaction_id    -> transactions
--   activity_level.stamp_ditributed  -> stamps_distributed   (source typo)
--   blindbox_reach.mdc_id            -> users
--   blindbox_reach.box_stamp         -> box_bucket (parsed) + box_label (raw)
--
-- The source columns named customer_id / transaction_id / mdc_id hold COUNTS,
-- not ids — the query aliased COUNT(DISTINCT x) back to x. Renaming them here
-- stops anyone downstream from treating a count as a key.

-- ---------------------------------------------------------------- reference

CREATE TABLE IF NOT EXISTS activity (
  id                      TEXT PRIMARY KEY,   -- e.g. IGAME_DAILY_LOGIN; = activity_level.ref_id
  quest_id                INTEGER,            -- 1..5, named in src/config/quests.ts
  name_en                 TEXT NOT NULL,
  name_bs                 TEXT,
  description_en          TEXT,
  description_bs          TEXT,
  reward_stamp            INTEGER NOT NULL DEFAULT 0,
  min_amount_transaction  REAL,
  is_same_merchant_limit_yn TEXT,
  daily_merchant_limit    INTEGER,
  saver_user_type         TEXT,
  tnc_tag                 TEXT,
  source_of_fund          TEXT,
  nominal_type            TEXT,
  created_time            TEXT,
  updated_time            TEXT,
  source_export_at        TEXT NOT NULL
);

-- ------------------------------------------------------------ snapshots

CREATE TABLE IF NOT EXISTS activity_snapshots (
  snapshot_at         TEXT NOT NULL,
  ref_id              TEXT NOT NULL,          -- joins activity.id
  program_id          TEXT,
  customers           INTEGER NOT NULL DEFAULT 0,  -- distinct customers; NOT summable across activities
  transactions        INTEGER NOT NULL DEFAULT 0,
  stamps_distributed  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_at, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_snapshots_at ON activity_snapshots (snapshot_at);

-- Users bucketed by the HIGHEST box their stamps reach. Buckets are exclusive:
-- each user appears in exactly one row per snapshot, so summing across buckets
-- gives a genuine unique count. "Reached at least box N" is the sum of buckets
-- N and above.
CREATE TABLE IF NOT EXISTS reach_snapshots (
  snapshot_at   TEXT NOT NULL,
  is_onboard    TEXT NOT NULL,                -- 'Y' opened the blindbox page, 'N' has not
  box_bucket    INTEGER NOT NULL,             -- 0 = under 10 stamps, 1..12 = highest box reached
  box_label     TEXT NOT NULL,                -- raw source label, e.g. 'Reach box 3'
  program_id    TEXT,
  users         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_at, is_onboard, box_bucket)
);

CREATE INDEX IF NOT EXISTS idx_reach_snapshots_at ON reach_snapshots (snapshot_at);

-- page_visitors from 0001 is no longer written or read: User onboard now comes
-- from reach_snapshots. It is left in place rather than dropped, since
-- dropping a table is destructive and it costs nothing to keep.
