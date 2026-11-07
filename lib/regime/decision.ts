import type { Desk, RiskLine } from './desk';
import type { GateCheck } from './gates';
import type { IdeaStatus, IdeasReport } from './ideas';
import type { SignalHealth } from './health';
import { THEME_CONFIG_VERSION } from './themes.config';
import { themesForSymbol } from './themes';

/** Bump when a gate, health rule, or stored checklist field changes meaning. */
export const RULE_VERSION = '2026-11-08.2';

export interface StoredDecisionLine {
  symbol: string;
  name: string;
  role: RiskLine['role'];
  status: IdeaStatus;
  weight: number;
  verdict: string;
  gates: GateCheck[];
  above200: boolean | null;
  momentum12_1: number | null;
  reversionZ: number | null;
  asOf: string | null;
  dip: string | null;
  theme: string | null;
}

export interface StoredDecisionTheme {
  id: string;
  label: string;
  on: boolean;
  enabled: boolean;
  reason: string;
}

export interface StoredDecision {
  ruleVersion: string;
  themeConfigVersion: string;
  storedAt: string;
  signalHealth: SignalHealth[];
  themes: StoredDecisionTheme[];
  lines: StoredDecisionLine[];
  note: string;
}

export function decisionFromDesk(input: {
  desk: Desk;
  signalHealth: SignalHealth[];
  storedAt: string;
}): StoredDecision {
  return {
    ruleVersion: RULE_VERSION,
    themeConfigVersion: input.desk.configVersion || THEME_CONFIG_VERSION,
    storedAt: input.storedAt,
    signalHealth: input.signalHealth,
    themes: input.desk.themes.map((theme) => ({
      id: theme.id,
      label: theme.label,
      on: theme.on,
      enabled: theme.enabled,
      reason: theme.reason,
    })),
    lines: input.desk.lines.map((line) => ({
      symbol: line.symbol,
      name: line.name,
      role: line.role,
      status: line.status,
      weight: line.weight,
      verdict: line.verdict,
      gates: line.gates,
      above200: line.above200,
      momentum12_1: line.momentum12_1,
      reversionZ: line.reversionZ,
      asOf: null,
      dip: line.dip,
      theme: line.theme,
    })),
    note: 'Saved with the snapshot. A theme that is on is not approval to trade. Confirmed means every checklist item passed and the size is above zero. It is not a recommendation to buy.',
  };
}

export function applyStoredDecision(desk: Desk, ideas: IdeasReport, decision: StoredDecision): { desk: Desk; ideas: IdeasReport } {
  const savedLines = new Map(decision.lines.map((line) => [line.symbol, line]));
  const lines = desk.lines.map((line) => {
    const saved = savedLines.get(line.symbol);
    if (!saved) return line;
    return {
      ...line,
      status: saved.status,
      weight: saved.weight,
      verdict: saved.verdict,
      gates: saved.gates,
      above200: saved.above200,
      momentum12_1: saved.momentum12_1,
      reversionZ: saved.reversionZ,
      dip: saved.dip,
      theme: saved.theme,
    };
  });
  const savedThemes = new Map(decision.themes.map((theme) => [theme.id, theme]));
  const themes = desk.themes.map((theme) => {
    const saved = savedThemes.get(theme.id);
    const themeLines = lines.filter((line) => themesForSymbol(line.symbol).some((item) => item.id === theme.id));
    if (!saved) return { ...theme, lines: themeLines };
    return { ...theme, on: saved.on, enabled: saved.enabled, reason: saved.reason, lines: themeLines };
  });
  const nextDesk = { ...desk, lines, themes };
  const nextIdeas: IdeasReport = {
    ...ideas,
    signalHealth: decision.signalHealth,
    rows: ideas.rows.map((row) => {
      const saved = savedLines.get(row.symbol);
      if (!saved) return row;
      return { ...row, status: saved.status, maxWeight: saved.weight };
    }),
  };
  return { desk: nextDesk, ideas: nextIdeas };
}
