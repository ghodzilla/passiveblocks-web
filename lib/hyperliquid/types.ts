export type DeskSnapshot = {
  headline: string;
  source: string;
  banner?: string;
  feed?: 'replay' | 'live';
  as_of: string | null;
  as_of_sydney: string | null;
  notices: string[];
  status: {
    mode: string;
    validated: boolean;
    version: string;
    network: string;
    heartbeat_at: string | null;
    book_age_s: number | null;
    fresh: boolean;
    halt: boolean;
    drain: boolean;
    pause_new_entries: boolean;
    window_day: number;
    window_days: number;
  };
  pnl: {
    start_usdc: number;
    shadow_equity_usdc: number;
    shadow_pnl_usdc: number;
    shadow_pnl_pct: number;
    gated_mean_r: number | null;
    ungated_mean_r: number | null;
    note: string;
  };
  autonomy: {
    exercised: number;
    cap: number;
    name: string;
    promotion: string;
  };
  health: {
    routing_accuracy: number;
    signal_escapes: number;
    false_closes: number;
    unnecessary_interruptions: number;
    stale_blocks: number;
    gate_mix: Record<string, number>;
    close_mix: Record<string, number>;
    drawdown: number;
    equity_usdc: number;
    open_risk: {
      positions: number;
      gross_leverage: number;
      cluster_risk: Record<string, number>;
      total_risk: number;
      daily_pnl_pct: number;
    };
    limits: {
      max_leverage: number;
      daily_loss_stop: number;
      drawdown_kill: number;
      max_positions: number;
      cluster_risk_cap: number;
      total_risk_cap: number;
    };
  };
  equity_curve: { t: string | null; equity: number }[];
  baseline_curve: { t: string | null; equity: number }[];
  strategies: {
    name: string;
    asset_class: string;
    status: string;
    weight: number;
    n: number;
    mean_r: number;
    shrunk_edge: number;
    lcb: number;
    calibration_slope: number | null;
    win_rate: number | null;
    pnl_usdc: number;
  }[];
  whitelist: {
    eligible: string[];
    stocks_and_commodities: {
      eligible_note: string;
      stocks: string;
      commodities: string;
      earnings: string;
      oil_roll: string;
      macro: string;
    };
  };
  positions: {
    strategy: string;
    market: string;
    side: string;
    book: string;
    entry: number;
    stop: number;
    target: number;
    notional_usdc: number;
    funding_usdc: number;
    counts_toward_limits: boolean;
    stop_in_plan: boolean;
    stop_note: string;
  }[];
  signals: {
    strategy: string;
    market: string;
    side: string;
    decision: string;
    skip_reason: string | null;
    verdict: string | null;
    confidence: number | null;
    at: string | null;
  }[];
  skip_pnl: { reason: string; n: number; mean_r: number }[];
  plans: {
    id: number;
    strategy: string | null;
    market: string;
    side: string;
    entry: number;
    stop: number;
    target: number;
    verdict: string | null;
    outcome: string | null;
    gaps: string[];
    legs: {
      role?: string;
      fill?: string;
      plan_px?: number | null;
      fill_px?: number | null;
    }[];
  }[];
  events: { kind: string; at: string | null; severity: string; text: string; sent?: boolean }[];
  scorecard: {
    verdict: string;
    plain: string;
    items: { name: string; pass: boolean; detail: string }[];
  };
};
