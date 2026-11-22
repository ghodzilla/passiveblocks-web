-- Let the app replace a pending Druckenmiller week with the filled week.
-- Apply it yourself, after 004, with the direct regime_owner URL (the
-- hostname does not contain -pooler). Do not apply it as part of a deploy.
-- The app does not run this file.
--
-- Until this is applied, regime_app cannot UPDATE regime_druck_week.
-- The book still saves on regime_druck. The week row stays as the unfilled
-- decision, and the next refresh after this file is applied writes the
-- fills, the book value, and the benchmark marks over that pending row.
-- A row that is already filled is not rewritten. DELETE stays revoked.
-- Safe to run more than once.

DO $grants$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'regime_app') THEN
    RAISE NOTICE 'regime_app is not created yet. Create it in the Neon console, then run this file again. Do not put the password in the repo.';
    RETURN;
  END IF;
  EXECUTE 'GRANT UPDATE ON TABLE regime_druck_week TO regime_app';
  EXECUTE 'REVOKE DELETE, TRUNCATE ON TABLE regime_druck_week FROM regime_app';
END
$grants$;

COMMENT ON TABLE regime_druck_week IS
  'One row per strategy rule and decision date. Inserted when the week is decided. Updated once, when that week fills, with the trades, the book value, and the benchmark marks. A filled row is not rewritten.';
