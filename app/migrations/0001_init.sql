-- Allo Blind Box Season 2 — monitoring dashboard schema.
--
-- Column names mirror the source CSV exports so that the upload path stays a
-- straight mapping, with two deliberate renames called out in the spec:
--   daily_spent_reward_result.date_temp -> daily_spend.date
--   daily_spent_reward_result.id        -> daily_spend.reward_id
--   total-spend-reward_result.id        -> spend_snapshots.reward_id
--
-- The spend files also carry a blind_box_id2 column, but there it holds 1-12
-- instead of 13-24 and must never be joined on. It is intentionally NOT stored:
-- the box is always resolved through blindbox_reward.id.

-- ---------------------------------------------------------------- reference

CREATE TABLE IF NOT EXISTS blindbox (
  id                    INTEGER PRIMARY KEY,   -- 13..24
  name_en               TEXT NOT NULL,
  name_bs               TEXT,
  description_en        TEXT,
  description_bs        TEXT,
  image_url             TEXT,
  claimed_image_url     TEXT,
  open_image_url        TEXT,
  locked_image_url      TEXT,
  not_eligible_image_url TEXT,
  created_time          TEXT,
  updated_time          TEXT,
  source_export_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blindbox_reward (
  id                INTEGER PRIMARY KEY,
  blind_box_id      INTEGER NOT NULL,          -- 13..24, joins blindbox.id
  name_en           TEXT NOT NULL,
  name_bs           TEXT,
  description_en    TEXT,
  rarity            TEXT,                      -- COMMON | RARE | SUPER_RARE
  type              TEXT,                      -- CASHBACK | COUPON
  weight            REAL,
  image_url         TEXT,
  stock_total       INTEGER,
  stock_distributed INTEGER,
  stock_bound       INTEGER,
  coupon_ref_id     TEXT,
  cashback_value    REAL,
  status            TEXT,                      -- SUCCESS | PENDING
  is_active_yn      TEXT,
  fallback_sort     INTEGER,
  order_id          TEXT,
  created_time      TEXT,
  updated_time      TEXT,
  source_export_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reward_box ON blindbox_reward (blind_box_id);

-- -------------------------------------------------------------- daily (replace)

CREATE TABLE IF NOT EXISTS daily_gacha (
  claim_date       TEXT PRIMARY KEY,
  total_claim      INTEGER NOT NULL DEFAULT 0,
  total_claim_user INTEGER NOT NULL DEFAULT 0,  -- true unique users for that day
  cashback_amount  REAL NOT NULL DEFAULT 0,
  source_export_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_rewards (
  claim_date       TEXT NOT NULL,
  reward_id        INTEGER NOT NULL,
  blind_box_id2    INTEGER NOT NULL,            -- 13..24, safe to join here
  program_id       TEXT,
  stamp_required   INTEGER,
  reward_name      TEXT,
  reward_type      TEXT,
  cashback_value   REAL,
  stock_total      INTEGER,
  stock_distributed INTEGER,
  total_claim      INTEGER NOT NULL DEFAULT 0,
  total_claim_user INTEGER NOT NULL DEFAULT 0,  -- per reward; never sum as uniques
  source_export_at TEXT NOT NULL,
  PRIMARY KEY (claim_date, reward_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_rewards_date ON daily_rewards (claim_date);

CREATE TABLE IF NOT EXISTS daily_spend (
  date              TEXT NOT NULL,             -- from date_temp
  reward_id         INTEGER NOT NULL,          -- from id
  program_id        TEXT,
  name_en           TEXT,
  type              TEXT,
  coupon_ref_id     TEXT,
  total_user_claimed  INTEGER NOT NULL DEFAULT 0,
  total_user_redeemed INTEGER NOT NULL DEFAULT 0,
  spend_amount      REAL NOT NULL DEFAULT 0,
  source_export_at  TEXT NOT NULL,
  PRIMARY KEY (date, reward_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_spend_date ON daily_spend (date);

-- ------------------------------------------------------------ totals (snapshot)

CREATE TABLE IF NOT EXISTS reward_snapshots (
  snapshot_at       TEXT NOT NULL,             -- export timestamp from the filename
  reward_id         INTEGER NOT NULL,
  blind_box_id2     INTEGER NOT NULL,          -- 13..24, safe to join here
  program_id        TEXT,
  stamp_required    INTEGER,
  reward_name       TEXT,
  reward_type       TEXT,
  cashback_value    REAL,
  stock_total       INTEGER,
  stock_distributed INTEGER,
  total_claim       INTEGER NOT NULL DEFAULT 0,
  total_claim_user  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_at, reward_id)
);

CREATE INDEX IF NOT EXISTS idx_reward_snapshots_at ON reward_snapshots (snapshot_at);

CREATE TABLE IF NOT EXISTS spend_snapshots (
  snapshot_at       TEXT NOT NULL,
  reward_id         INTEGER NOT NULL,          -- from id
  program_id        TEXT,
  name_en           TEXT,
  type              TEXT,
  coupon_ref_id     TEXT,
  stock_total       INTEGER,
  stock_distributed INTEGER,
  total_user_claimed  INTEGER NOT NULL DEFAULT 0,
  total_user_redeemed INTEGER NOT NULL DEFAULT 0,
  spend_amount      REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_at, reward_id)
);

CREATE INDEX IF NOT EXISTS idx_spend_snapshots_at ON spend_snapshots (snapshot_at);

-- ------------------------------------------------------------------- manual

-- Append-only. The row with the greatest id is the current value.
CREATE TABLE IF NOT EXISTS page_visitors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  value      INTEGER NOT NULL,
  as_of      TEXT NOT NULL,                    -- 'YYYY-MM-DD HH:MM' WIB
  note       TEXT,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- -------------------------------------------------------------- upload audit

CREATE TABLE IF NOT EXISTS uploads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_type   TEXT NOT NULL,
  export_at   TEXT,
  row_count   INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL,                   -- published | rejected | failed
  error       TEXT,
  batch_id    TEXT                             -- groups files published together
);

CREATE INDEX IF NOT EXISTS idx_uploads_at ON uploads (uploaded_at DESC);
