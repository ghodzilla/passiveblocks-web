-- Shadow book for the v2 rules. It does not touch the live Druckenmiller tables.
-- Apply it yourself, after 006, with the direct regime_owner URL (the
-- hostname does not contain -pooler). Do not apply it as part of a deploy.
-- The app does not run this file.
--
-- Until these tables exist, the page says the shadow week is not saved.
-- The live book still saves, and the backtest table on the page still shows.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS regime_druck_shadow (
  id smallint PRIMARY KEY DEFAULT 1,
  rule_version text NOT NULL,
  book_id text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regime_druck_shadow_week (
  id bigserial PRIMARY KEY,
  rule_version text NOT NULL,
  decision_date date NOT NULL,
  payload jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_version, decision_date)
);

DO $singleton$
BEGIN
  ALTER TABLE regime_druck_shadow
    ADD CONSTRAINT regime_druck_shadow_singleton CHECK (id = 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$singleton$;

COMMENT ON TABLE regime_druck_shadow IS
  'Latest v2 shadow week. Separate from regime_druck. Updating it does not change the live book.';
COMMENT ON TABLE regime_druck_shadow_week IS
  'One shadow decision per date. Inserted once. The live week table is not used.';

DO $grants$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'regime_app') THEN
    RAISE NOTICE 'regime_app is not created yet. Create it in the Neon console, then run this file again. Do not put the password in the repo.';
    RETURN;
  END IF;
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE regime_druck_shadow TO regime_app';
  EXECUTE 'GRANT SELECT, INSERT ON TABLE regime_druck_shadow_week TO regime_app';
  EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE regime_druck_shadow_week_id_seq TO regime_app';
  EXECUTE 'REVOKE DELETE, TRUNCATE ON TABLE regime_druck_shadow FROM regime_app';
  EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON TABLE regime_druck_shadow_week FROM regime_app';
END
$grants$;
