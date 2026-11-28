-- Hyperliquid engine schema hl.
-- Applied for paper/simulation. The package does not execute this file.
-- It does not add roles, grants, or credentials.
-- Roles hl_engine and hl_reader, and their grants, are a later
-- hardening step. They are created later, not in this file.
--
-- Stage 1 also keeps a local SQLite file. JSON there is stored as text.
-- This Postgres file uses timestamptz and jsonb.

CREATE SCHEMA IF NOT EXISTS hl;

COMMENT ON SCHEMA hl IS 'paper/simulation';

CREATE TABLE IF NOT EXISTS hl.hl_strategy (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    version text NOT NULL,
    asset_class text NOT NULL CHECK (asset_class IN ('crypto', 'stock', 'commodity')),
    params jsonb NOT NULL,
    params_hash text NOT NULL,
    frozen_at timestamptz,
    status text NOT NULL CHECK (status IN ('practice', 'shadow', 'live', 'benched', 'retired')),
    weight numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
    UNIQUE (name, version, asset_class)
);

-- max_leverage here is the venue's published maximum, not the engine cap.
CREATE TABLE IF NOT EXISTS hl.hl_market (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    as_of date NOT NULL,
    market text NOT NULL,
    dex text NOT NULL,
    asset_class text NOT NULL CHECK (asset_class IN ('crypto', 'stock', 'commodity')),
    volume_7d_median numeric,
    open_interest numeric,
    impact_spread_bps numeric,
    taker_fee numeric,
    maker_fee numeric,
    growth_mode boolean,
    max_leverage integer,
    session_type text,
    eligible boolean NOT NULL,
    reason text,
    UNIQUE (as_of, market)
);

CREATE TABLE IF NOT EXISTS hl.hl_signal (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts timestamptz NOT NULL,
    strategy_id bigint NOT NULL REFERENCES hl.hl_strategy (id),
    market text NOT NULL,
    side text NOT NULL CHECK (side IN ('long', 'short')),
    entry_px numeric NOT NULL,
    stop_px numeric NOT NULL,
    target_px numeric NOT NULL,
    pred_edge_r numeric NOT NULL,
    pred_win_prob numeric NOT NULL,
    pred_fee_bps numeric NOT NULL,
    pred_slippage_bps numeric NOT NULL,
    pred_funding_bps numeric NOT NULL,
    edge_lcb_r numeric NOT NULL,
    weight numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
    decision text NOT NULL CHECK (decision IN ('trade', 'skip', 'hold')),
    skip_reason text,
    features jsonb NOT NULL,
    session_state text,
    git_sha text
);

CREATE INDEX IF NOT EXISTS hl_signal_strategy_ts ON hl.hl_signal (strategy_id, ts);

-- strategy_id is provenance only. The gate does not grade itself.
CREATE TABLE IF NOT EXISTS hl.hl_gate_decision (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    signal_id bigint NOT NULL REFERENCES hl.hl_signal (id),
    strategy_id bigint REFERENCES hl.hl_strategy (id),
    verdict text NOT NULL CHECK (verdict IN ('accept', 'verify_more', 'reject')),
    probability numeric NOT NULL CHECK (probability >= 0 AND probability <= 1),
    reasons jsonb NOT NULL,
    features jsonb NOT NULL,
    git_sha text,
    created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_gate_decision_signal ON hl.hl_gate_decision (signal_id);

CREATE TABLE IF NOT EXISTS hl.hl_trade_plan (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    signal_id bigint NOT NULL REFERENCES hl.hl_signal (id),
    gate_decision_id bigint REFERENCES hl.hl_gate_decision (id),
    market text NOT NULL,
    side text NOT NULL CHECK (side IN ('long', 'short')),
    entry_px numeric NOT NULL,
    stop_px numeric NOT NULL,
    target_px numeric NOT NULL,
    size numeric NOT NULL,
    entry_cloid text,
    stop_cloid text,
    target_cloid text,
    created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_trade_plan_signal ON hl.hl_trade_plan (signal_id);

CREATE TABLE IF NOT EXISTS hl.hl_close_event (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id bigint NOT NULL REFERENCES hl.hl_trade_plan (id),
    outcome text NOT NULL CHECK (outcome IN ('closed_as_planned', 'verify_more', 'mismatch')),
    legs jsonb NOT NULL,
    unverified_gaps jsonb NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_close_event_plan ON hl.hl_close_event (plan_id);

CREATE TABLE IF NOT EXISTS hl.hl_market_blacklist (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    market text NOT NULL,
    actor text NOT NULL,
    reason text NOT NULL,
    created_at timestamptz NOT NULL,
    cleared_at timestamptz
);

CREATE TABLE IF NOT EXISTS hl.hl_desk_health (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    as_of timestamptz NOT NULL,
    routing_accuracy numeric,
    signal_escapes integer NOT NULL,
    false_closes integer NOT NULL,
    unnecessary_interruptions integer NOT NULL,
    recovery jsonb,
    created_at timestamptz NOT NULL
);

-- book is the gated or ungated shadow book. source stays shadow.
CREATE TABLE IF NOT EXISTS hl.hl_shadow_trade (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    signal_id bigint NOT NULL REFERENCES hl.hl_signal (id),
    source text NOT NULL CHECK (source IN ('shadow')),
    book text NOT NULL CHECK (book IN ('gated', 'ungated')),
    entry_px numeric,
    exit_px numeric,
    fees numeric,
    slippage numeric,
    funding numeric,
    realised_r numeric,
    mae numeric,
    mfe numeric,
    hold_seconds integer,
    exit_reason text
);

CREATE INDEX IF NOT EXISTS hl_shadow_trade_signal ON hl.hl_shadow_trade (signal_id);

-- Rows in hl_order are records. This file does not send them.
CREATE TABLE IF NOT EXISTS hl.hl_order (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id bigint REFERENCES hl.hl_trade_plan (id),
    cloid text,
    oid bigint,
    market text NOT NULL,
    side text NOT NULL CHECK (side IN ('long', 'short')),
    order_type text,
    limit_px numeric,
    size numeric,
    status text,
    raw jsonb,
    created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_order_plan ON hl.hl_order (plan_id);

CREATE TABLE IF NOT EXISTS hl.hl_fill (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint REFERENCES hl.hl_order (id),
    source text NOT NULL CHECK (source IN ('shadow', 'exchange')),
    px numeric NOT NULL,
    size numeric NOT NULL,
    fee numeric,
    closed_pnl numeric,
    raw jsonb,
    ts timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_fill_order ON hl.hl_fill (order_id);

CREATE TABLE IF NOT EXISTS hl.hl_position (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts timestamptz NOT NULL,
    market text NOT NULL,
    size numeric NOT NULL,
    entry_px numeric,
    leverage numeric,
    liq_px numeric,
    upnl numeric,
    has_stop boolean NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_position_ts ON hl.hl_position (ts, market);

CREATE TABLE IF NOT EXISTS hl.hl_equity (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts timestamptz NOT NULL,
    testnet_equity numeric,
    shadow_equity numeric NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_equity_ts ON hl.hl_equity (ts);

CREATE TABLE IF NOT EXISTS hl.hl_funding (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts timestamptz NOT NULL,
    market text NOT NULL,
    position_size numeric,
    rate numeric NOT NULL,
    payment numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS hl.hl_risk_event (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts timestamptz NOT NULL,
    kind text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('CRITICAL', 'WARN', 'INFO')),
    detail text NOT NULL,
    payload jsonb
);

CREATE TABLE IF NOT EXISTS hl.hl_heartbeat (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts timestamptz NOT NULL,
    version text NOT NULL,
    network text NOT NULL,
    ws_ages jsonb
);

CREATE TABLE IF NOT EXISTS hl.hl_calibration (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    strategy_id bigint REFERENCES hl.hl_strategy (id),
    week_start date NOT NULL,
    kind text NOT NULL CHECK (kind IN ('strategy', 'engine')),
    slope numeric,
    intercept numeric,
    brier numeric,
    cost_model_error numeric,
    drift_stat numeric,
    action text,
    CHECK (
        (kind = 'strategy' AND strategy_id IS NOT NULL)
        OR (kind = 'engine' AND strategy_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS hl_calibration_strategy
    ON hl.hl_calibration (strategy_id, week_start)
    WHERE kind = 'strategy';

CREATE UNIQUE INDEX IF NOT EXISTS hl_calibration_engine
    ON hl.hl_calibration (week_start)
    WHERE kind = 'engine';

CREATE TABLE IF NOT EXISTS hl.hl_window (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    started_at timestamptz NOT NULL,
    ended_at timestamptz,
    manifest_hash text NOT NULL,
    strategies jsonb NOT NULL,
    verdict text CHECK (verdict IS NULL OR verdict IN ('GO', 'EXTEND', 'NO-GO'))
);

CREATE TABLE IF NOT EXISTS hl.hl_daily_score (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    day date NOT NULL,
    strategy_id bigint REFERENCES hl.hl_strategy (id),
    kind text NOT NULL CHECK (kind IN ('strategy', 'total')),
    n_trades integer NOT NULL,
    mean_r numeric,
    pnl numeric,
    CHECK (
        (kind = 'strategy' AND strategy_id IS NOT NULL)
        OR (kind = 'total' AND strategy_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS hl_daily_score_strategy
    ON hl.hl_daily_score (day, strategy_id)
    WHERE kind = 'strategy';

CREATE UNIQUE INDEX IF NOT EXISTS hl_daily_score_total
    ON hl.hl_daily_score (day)
    WHERE kind = 'total';

CREATE TABLE IF NOT EXISTS hl.hl_alert_outbox (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    severity text NOT NULL CHECK (severity IN ('CRITICAL', 'WARN', 'INFO')),
    dedup_key text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL,
    sent_at timestamptz,
    acked_at timestamptz
);

CREATE INDEX IF NOT EXISTS hl_alert_outbox_unsent
    ON hl.hl_alert_outbox (created_at)
    WHERE sent_at IS NULL;

-- One row, id 1. Flags only. This row cannot change a risk limit.
CREATE TABLE IF NOT EXISTS hl.hl_control (
    id smallint PRIMARY KEY CHECK (id = 1),
    halt boolean NOT NULL,
    flatten_requested boolean NOT NULL,
    drain boolean NOT NULL,
    pause_new_entries boolean NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO hl.hl_control (id, halt, flatten_requested, drain, pause_new_entries)
VALUES (1, false, false, false, false)
ON CONFLICT (id) DO NOTHING;
