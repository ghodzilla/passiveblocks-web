-- Append-only paper-decision log for prospective validation.
--
-- The Next.js app does not run this file and does not embed a connection
-- string. Apply it yourself, after 001, with the direct regime_owner URL.
-- Do not apply it as part of a deploy until you have reviewed it.
-- Until this table exists, refresh keeps saving the snapshot and skips the log.
--
-- Rows are inserted once. regime_app is not granted UPDATE or DELETE on this
-- table, so a runtime URL cannot rewrite a frozen decision or a mark.
-- One row per rule version, event type, and session date.

CREATE TABLE IF NOT EXISTS regime_paper_event (
  id bigserial PRIMARY KEY,
  rule_version text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('decision', 'mark')),
  session_date date NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  UNIQUE (rule_version, event_type, session_date)
);

COMMENT ON TABLE regime_paper_event IS
  'Append-only prospective validation. Decision rows are frozen. Mark rows record unit NAV only when AUD translation and prices are complete.';

DO $grants$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'regime_app') THEN
    RAISE NOTICE 'regime_app is not created yet. Create it in the Neon console, then run this file again. Do not put the password in the repo.';
    RETURN;
  END IF;
  EXECUTE 'GRANT SELECT, INSERT ON TABLE regime_paper_event TO regime_app';
  EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE regime_paper_event_id_seq TO regime_app';
  EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON TABLE regime_paper_event FROM regime_app';
END
$grants$;
