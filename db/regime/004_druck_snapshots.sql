-- Weekly Druckenmiller paper book (DRUCK-2026-11-21). Separate from the
-- regime snapshot, from aud-paper-v1, and from the Visser book.
-- The Next.js app does not run this file and does not embed a connection string.
--
-- Apply it yourself, after 001, with the direct regime_owner URL (the
-- hostname does not contain -pooler). Do not apply it as part of a deploy
-- until you have reviewed it.
-- Until these tables exist, the book says so and the refresh skips the save.
-- A failed price feed updates the attempt on regime_druck and does not
-- replace the last good snapshot, and it does not insert a week row.
--
-- regime_druck_week is insert-once. regime_app is not granted UPDATE or
-- DELETE on it, so a runtime URL cannot rewrite a frozen week.

CREATE TABLE IF NOT EXISTS regime_druck (
  id smallint PRIMARY KEY DEFAULT 1,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regime_druck_week (
  id bigserial PRIMARY KEY,
  rule_version text NOT NULL,
  decision_date date NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  UNIQUE (rule_version, decision_date)
);

DO $singleton$
BEGIN
  ALTER TABLE regime_druck
    ADD CONSTRAINT regime_druck_singleton CHECK (id = 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$singleton$;

COMMENT ON TABLE regime_druck IS
  'One row. Latest Druckenmiller attempt plus the last good weekly snapshot. A failed feed does not replace that snapshot.';
COMMENT ON TABLE regime_druck_week IS
  'One row per rule version and decision date. The decision as it stood before the fill. A later refresh does not rewrite it.';

DO $grants$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'regime_app') THEN
    RAISE NOTICE 'regime_app is not created yet. Create it in the Neon console, then run this file again. Do not put the password in the repo.';
    RETURN;
  END IF;
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE regime_druck TO regime_app';
  EXECUTE 'GRANT SELECT, INSERT ON TABLE regime_druck_week TO regime_app';
  EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE regime_druck_week_id_seq TO regime_app';
  EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON TABLE regime_druck_week FROM regime_app';
  EXECUTE 'REVOKE DELETE, TRUNCATE ON TABLE regime_druck FROM regime_app';
END
$grants$;
