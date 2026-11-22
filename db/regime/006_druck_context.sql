-- Extra context for the Druckenmiller paper book. It does not change the rules.
-- Apply it yourself, after 004, with the direct regime_owner URL (the
-- hostname does not contain -pooler). Do not apply it as part of a deploy.
-- The app does not run this file.
--
-- Until these tables exist, the page says so. The weekly book still saves.
-- A failed earnings check or a failed 13F download does not replace the last
-- good copy, and it does not change a weekly call.
--
-- regime_druck_call and regime_druck_call_score are insert-once.
-- regime_druck_earnings_snap and regime_druck_13f_snap are insert-once.
-- The current earnings row and the current 13F row may be updated.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS regime_druck_call (
  id bigserial PRIMARY KEY,
  rule_version text NOT NULL,
  decision_date date NOT NULL,
  name_id text NOT NULL,
  symbol text NOT NULL,
  action text NOT NULL,
  price_aud double precision NOT NULL,
  price_local double precision NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_version, decision_date, name_id)
);

CREATE TABLE IF NOT EXISTS regime_druck_call_score (
  id bigserial PRIMARY KEY,
  rule_version text NOT NULL,
  decision_date date NOT NULL,
  name_id text NOT NULL,
  horizon_weeks smallint NOT NULL,
  payload jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_version, decision_date, name_id, horizon_weeks)
);

CREATE TABLE IF NOT EXISTS regime_druck_earnings (
  symbol text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL,
  ok boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS regime_druck_earnings_snap (
  id bigserial PRIMARY KEY,
  symbol text NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regime_druck_13f (
  id smallint PRIMARY KEY DEFAULT 1,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regime_druck_13f_snap (
  id bigserial PRIMARY KEY,
  accession text NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (accession)
);

DO $singleton$
BEGIN
  ALTER TABLE regime_druck_13f
    ADD CONSTRAINT regime_druck_13f_singleton CHECK (id = 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$singleton$;

COMMENT ON TABLE regime_druck_call IS
  'One row per name per decision. The action and the price at the decision. A later fill does not rewrite it.';
COMMENT ON TABLE regime_druck_call_score IS
  'One row per name, decision, and horizon (4 or 12 weeks). Inserted once the later price is known.';
COMMENT ON TABLE regime_druck_earnings IS
  'Latest earnings check per ticker. A failed download does not replace a row that was ok.';
COMMENT ON TABLE regime_druck_earnings_snap IS
  'One row per successful earnings download. Kept so a later refresh can be compared with an older one.';
COMMENT ON TABLE regime_druck_13f IS
  'One row. The latest Duquesne 13F compared with the one before it. Suggestions only. The candidate list is not edited.';
COMMENT ON TABLE regime_druck_13f_snap IS
  'One row per 13F accession. The parsed holdings as downloaded.';

DO $grants$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'regime_app') THEN
    RAISE NOTICE 'regime_app is not created yet. Create it in the Neon console, then run this file again. Do not put the password in the repo.';
    RETURN;
  END IF;
  EXECUTE 'GRANT SELECT, INSERT ON TABLE regime_druck_call TO regime_app';
  EXECUTE 'GRANT SELECT, INSERT ON TABLE regime_druck_call_score TO regime_app';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE regime_druck_earnings TO regime_app';
  EXECUTE 'GRANT SELECT, INSERT ON TABLE regime_druck_earnings_snap TO regime_app';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE regime_druck_13f TO regime_app';
  EXECUTE 'GRANT SELECT, INSERT ON TABLE regime_druck_13f_snap TO regime_app';
  EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE regime_druck_call_id_seq TO regime_app';
  EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE regime_druck_call_score_id_seq TO regime_app';
  EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE regime_druck_earnings_snap_id_seq TO regime_app';
  EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE regime_druck_13f_snap_id_seq TO regime_app';
  EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON TABLE regime_druck_call FROM regime_app';
  EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON TABLE regime_druck_call_score FROM regime_app';
  EXECUTE 'REVOKE DELETE, TRUNCATE ON TABLE regime_druck_earnings FROM regime_app';
  EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON TABLE regime_druck_earnings_snap FROM regime_app';
  EXECUTE 'REVOKE DELETE, TRUNCATE ON TABLE regime_druck_13f FROM regime_app';
  EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON TABLE regime_druck_13f_snap FROM regime_app';
END
$grants$;
