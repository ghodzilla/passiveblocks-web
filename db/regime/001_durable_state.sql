-- Passiveblocks regime durable state.
--
-- Target (already provisioned, empty of schema): Neon project
-- dark-credit-39672712 (passiveblocks-regime), organization
-- org-ancient-dream-05350346, Free plan, PostgreSQL 17, AWS us-east-1,
-- branch production br-crimson-pine-bbjnrwel, database regime,
-- endpoint ep-nameless-mud-bbezuweu, fixed 0.25 CU.
--
-- Apply this file yourself with the direct connection string (the hostname
-- does not contain -pooler), as regime_owner. The Next.js app does not run
-- it and does not embed a connection string.
--
-- Runtime traffic uses REGIME_DATABASE_URL only. That value must be the
-- pooled string (hostname contains -pooler) for database regime. It must
-- not be the Supabase DATABASE_URL.
--
-- Idempotent. Running it again does not drop rows.
--
-- Free plan storage is 1 GB for the project. This schema keeps one journal,
-- one self-check, and one refresh snapshot. The snapshot is the bulky row
-- (the price book). Attempt history stores health metadata only, never
-- prices, and the app deletes past the newest 45 refresh attempts in the
-- same transaction as the insert. Before each journal upsert the app keeps
-- at most 800 paper marks, 4000 signal calls, 12000 forward outcomes,
-- 156 weekly reviews, and 156 rule changes. Serverless disk is not a store.

CREATE TABLE IF NOT EXISTS regime_journal (
  id smallint PRIMARY KEY DEFAULT 1,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regime_selfcheck (
  id smallint PRIMARY KEY DEFAULT 1,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regime_refresh (
  id smallint PRIMARY KEY DEFAULT 1,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regime_refresh_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempted_at timestamptz NOT NULL,
  outcome text NOT NULL,
  fetch_outcome text NOT NULL,
  persisted boolean NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS regime_refresh_attempts_recent_idx
  ON regime_refresh_attempts (attempted_at DESC, id DESC);

DO $singleton$
BEGIN
  ALTER TABLE regime_journal
    ADD CONSTRAINT regime_journal_singleton CHECK (id = 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$singleton$;

DO $singleton$
BEGIN
  ALTER TABLE regime_selfcheck
    ADD CONSTRAINT regime_selfcheck_singleton CHECK (id = 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$singleton$;

DO $singleton$
BEGIN
  ALTER TABLE regime_refresh
    ADD CONSTRAINT regime_refresh_singleton CHECK (id = 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$singleton$;

COMMENT ON TABLE regime_journal IS
  'One row. Paper portfolio, signal calls, forward outcomes, and weekly notes. The app trims the payload before each upsert.';
COMMENT ON TABLE regime_selfcheck IS
  'One row. Latest daily consistency check. Not a public API payload.';
COMMENT ON TABLE regime_refresh IS
  'One row. Latest refresh health plus the saved snapshot and price book.';
COMMENT ON TABLE regime_refresh_attempts IS
  'Health-only attempt log. The app keeps the newest 45 rows and does not store prices here.';

-- Least privilege.
-- regime_owner remains the migration role. The running app should use a
-- separate role, regime_app, so a leaked runtime URL cannot drop tables.
-- Create regime_app in the Neon console and set its password there. Do not
-- write the password into this file, the repo, or a log.
-- After the role exists, run this file again. The block below notices the
-- role and grants only row access. It does not grant CREATE, DROP, or TRUNCATE.
-- Until regime_app exists, this block does nothing.

DO $grants$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'regime_app') THEN
    RAISE NOTICE 'regime_app is not created yet. Create it in the Neon console, then run this file again. Do not put the password in the repo.';
    RETURN;
  END IF;
  EXECUTE 'GRANT CONNECT ON DATABASE regime TO regime_app';
  EXECUTE 'GRANT USAGE ON SCHEMA public TO regime_app';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE regime_journal, regime_selfcheck, regime_refresh, regime_refresh_attempts TO regime_app';
  EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE regime_refresh_attempts_id_seq TO regime_app';
  EXECUTE 'REVOKE CREATE ON SCHEMA public FROM regime_app';
END
$grants$;
