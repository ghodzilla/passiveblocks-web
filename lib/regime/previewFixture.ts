import type { ComponentProps } from 'react';
import type { RegimeDashboard } from '@/components/regime/RegimeDashboard';
import { BASE_WEIGHTS, MODEL_BUDGET } from './constants';
import type { RiskLine } from './desk';
import { FX_CONVENTION, FX_SYMBOL } from './fx';
import type { GateCheck, GateId } from './gates';
import type { IdeaRow } from './ideas';
import type { PaperMarkPayload } from './paperLog';
import { THEME_CHANGELOG, THEME_CONFIG_VERSION } from './themes.config';
import type { ComponentScore, HistoryPoint, RegimeSnapshot } from './types';
import type { RegimeView } from './view';
import replayJson from '../../research/regime-validation/replay-results.json';

type DashboardProps = ComponentProps<typeof RegimeDashboard>;

const weights = BASE_WEIGHTS;

function component(id: ComponentScore['id'], label: string, z: number, reading: string): ComponentScore {
  return {
    id,
    label,
    z,
    included: true,
    weight: weights[id],
    asOf: '2026-11-19',
    gap: null,
    detail: reading,
    reading,
  };
}

const quietComponents: ComponentScore[] = [
  component('liquidity', 'Liquidity', 0.36, '13-week change in net liquidity'),
  component('policy', 'Policy path', -2.17, 'Policy − 2y −0.83 pp (DFEDTARU)'),
  component('credit', 'Credit', -0.96, 'HY OAS 3.34%'),
  component('growth', 'Growth differential', 1.16, 'US growth outlook versus Australia'),
  component('positioning', 'Positioning extremes', 1.2, 'No positioning print'),
  component('ai', 'AI capex & concentration', 1.25, 'AI spending blend'),
];

function historyPoint(date: string, composite: number, liquidity: number, policy: number): HistoryPoint {
  return {
    date,
    composite,
    regime: composite >= 0.65 ? 'risk_on' : 'transitional',
    liquidity,
    policy,
    credit: -0.9,
    growth: 1.1,
    positioning: 1.1,
    ai: 1.2,
  };
}

function gates(partial: Partial<Record<GateId, { pass: boolean; detail: string }>>): GateCheck[] {
  const base: Record<GateId, { label: string; pass: boolean; detail: string }> = {
    theme: { label: 'Theme', pass: true, detail: 'No theme. This holding is not in AI infrastructure, crypto, or scarcity.' },
    regime: { label: 'Market mood allows it?', pass: false, detail: 'the market mood must be Supportive (score +0.65 or more; today -0.16)' },
    trend: { label: 'Price above its 200-day average?', pass: true, detail: 'Price is above its 200-day average.' },
    momentum: { label: 'Up over the past year?', pass: true, detail: 'Up over the past year.' },
    stretch: { label: 'No sudden spike?', pass: true, detail: 'The last 5 days are not a sudden spike.' },
    halt: { label: 'Loss limit clear?', pass: true, detail: 'Yes — book is 0.0% below its high (limit 10%).' },
  };
  return (Object.keys(base) as GateId[]).map((id) => ({
    id,
    label: base[id].label,
    pass: partial[id]?.pass ?? base[id].pass,
    detail: partial[id]?.detail ?? base[id].detail,
    ...(id === 'theme' ? { themeState: partial.theme?.pass === false ? 'off' as const : 'none' as const } : {}),
  }));
}

function line(partial: Partial<RiskLine> & Pick<RiskLine, 'symbol' | 'name' | 'status'>): RiskLine {
  return {
    role: 'tactical',
    defensive: false,
    stop: null,
    qty: null,
    weight: 0,
    note: '',
    verdict: partial.status === 'avoid'
      ? 'Avoid — on a no-clear-signal day the rules don\'t buy this group. Scarcity is on.'
      : partial.status === 'confirmed'
        ? 'Buy — every check passed.'
        : 'Watch — stored checklist.',
    gates: gates({}),
    dip: null,
    theme: null,
    above200: true,
    momentum12_1: 0.08,
    reversionZ: 0.2,
    pyramid: 'new',
    ...partial,
  };
}

function idea(lineItem: RiskLine, sleeve: string, lastClose: number, ma200: number): IdeaRow {
  return {
    symbol: lineItem.symbol,
    name: lineItem.name,
    venue: lineItem.symbol.endsWith('.AX') ? 'ASX' : 'US',
    kind: 'etf',
    assetClass: 'equities',
    sleeve,
    role: lineItem.role,
    defensive: lineItem.defensive,
    status: lineItem.status,
    strength: null,
    signals: {
      asOf: '2026-11-19',
      lastClose,
      ma200,
      above200: lastClose > ma200,
      momentum12_1: lineItem.momentum12_1,
      annVol20: 0.16,
      reversionZ: lineItem.reversionZ,
    },
    maxWeight: lineItem.weight,
    rationale: sleeve,
    drivers: '',
    invalidation: '',
    priceStale: false,
    source: 'yahoo',
  };
}

function snapshot(input: {
  regime: RegimeSnapshot['regime'];
  composite: number;
  actionable: boolean;
  action: RegimeSnapshot['action'];
  weak: boolean;
  components: ComponentScore[];
}): RegimeSnapshot {
  const budget = input.regime ? MODEL_BUDGET[input.regime] : MODEL_BUDGET.transitional;
  const effective = input.action === 'do_nothing'
    ? { volTarget: 0.06, maxGross: 0.4, maxNet: 0.2 }
    : input.actionable
      ? budget
      : { volTarget: 0.03, maxGross: 0.2, maxNet: 0 };
  return {
    rulesVersion: 'regime-v2',
    generatedAt: '2026-11-19T06:20:00.000Z',
    today: '2026-11-19',
    printDate: '2026-11-19',
    regime: input.regime,
    regimeLabel: input.regime === 'risk_on' ? 'Risk-On Liquidity Expansion' : 'Transitional',
    composite: input.composite,
    actionable: input.actionable,
    weak: input.weak,
    action: input.action,
    message: input.actionable ? 'Risk budget open.' : 'Do nothing / reduce risk. A core series is missing or stale.',
    modelBudget: budget,
    effectiveBudget: effective,
    budgetOverridden: !input.actionable || input.action === 'do_nothing',
    components: input.components,
    history: [
      historyPoint('2026-11-12', input.composite - 0.06, input.components[0].z == null ? 0 : input.components[0].z - 0.06, -2),
      historyPoint('2026-11-19', input.composite, input.components[0].z ?? 0, input.components[1].z ?? 0),
    ],
    freshness: [],
    gaps: [],
  };
}

function deskFor(lines: RiskLine[], input: {
  equity: number;
  invested: number;
  nonCash: number;
  maxGross: number;
  maxNet: number;
  themes: RegimeView['desk']['themes'];
}): RegimeView['desk'] {
  return {
    themes: input.themes,
    lines,
    capital: 100000,
    targetCagr: 0.66,
    drawdown: 0,
    halted: false,
    equity: input.equity,
    peakEquity: input.equity,
    realisedCagr: null,
    backtestedCagr: null,
    maxDrawdown: null,
    gapToTarget: null,
    changes: [],
    configVersion: THEME_CONFIG_VERSION,
    changelog: THEME_CHANGELOG,
    gaps: [],
    params: { atrK: 2.5, riskPct: 0.0075, momentumLookback: 252, dipLow: 0.1, dipHigh: 0.2 },
    overlap: { groups: [], gap: null, cap: 0.25 },
    crowdingScale: 1,
    realisedText: 'Not enough history yet',
    backtestedText: 'Not enough history yet',
    gapText: 'Not enough history yet',
    maxDrawdownText: 'Not enough history yet',
    paperLedger: {
      policy: 'book-limits-2026-11-07',
      currency: 'AUD',
      status: 'enforced',
      legacy: null,
      legacyPositions: 0,
      pending: [],
      equity: input.equity,
      valued: true,
      fx: { symbol: FX_SYMBOL, convention: FX_CONVENTION, rate: 0.652, observationDate: '2026-11-19', fetchedAt: '2026-11-19T06:20:00.000Z', fresh: true, error: null },
      note: 'AUD paper book.',
      marks: [
        { date: '2026-11-07', equity: 100000 },
        { date: '2026-11-14', equity: 100210 },
        { date: '2026-11-19', equity: input.equity },
      ],
      positions: [
        { symbol: 'XLV', qty: 12, entry: 180, stop: 166.34, riskPerShare: 13.66, openedOn: '2026-10-02', tranches: 1 },
      ],
      exposures: {
        gross: input.invested,
        net: input.nonCash,
        risk: 0,
        defensive: input.nonCash,
        cash: 1 - input.invested,
        maxGross: input.maxGross,
        maxNet: input.maxNet,
      },
    },
  };
}

function ideasFor(rows: IdeaRow[], defensiveOnly: boolean): RegimeView['ideas'] {
  return {
    defensiveOnly,
    action: defensiveOnly ? 'do_nothing' : 'risk_budget_open',
    regime: defensiveOnly ? 'transitional' : 'risk_on',
    banner: null,
    playbook: [],
    rows,
    watchlistNote: null,
    gaps: [],
    pricesFetchedAt: '2026-11-19T06:20:00.000Z',
    singlePositionCap: 0.2,
    systematicCap: 0.02,
    crowding: { average: 0.42, dispersion: 0.03, scale: 1, names: 8, pairs: 28, warning: null, gap: null },
    overlap: { groups: [], gap: null, cap: 0.25 },
    signalHealth: [
      { id: 'momentum', label: 'Past-year trend', ic: null, hitRate: null, samples: 12, status: 'unknown' },
      { id: 'trend', label: '200-day average', ic: null, hitRate: null, samples: 12, status: 'unknown' },
      { id: 'reversion', label: 'Sudden spike', ic: null, hitRate: null, samples: 12, status: 'unknown' },
    ],
  };
}

const quietHeld: { symbol: string; weight: number }[] = [
  { symbol: 'CASH', weight: 0.599 },
  { symbol: 'SHY', weight: 0.101 },
  { symbol: 'AAA.AX', weight: 0.1 },
  { symbol: 'BILL.AX', weight: 0.1 },
  { symbol: 'UUP', weight: 0.022 },
  { symbol: 'XLRE', weight: 0.021 },
  { symbol: 'USMV', weight: 0.021 },
  { symbol: 'XLP', weight: 0.018 },
  { symbol: 'XLV', weight: 0.018 },
];

function quietLines(): RiskLine[] {
  const avoidGates = gates({
    regime: { pass: false, detail: 'on a no-clear-signal day the rules don\'t buy this group' },
  });
  const marketGates = gates({
    theme: { pass: true, detail: 'AI infrastructure is on.' },
    regime: { pass: false, detail: 'the market mood must be Supportive (score +0.65 or more; today -0.16)' },
  }).map((gate) => (gate.id === 'theme' ? { ...gate, themeState: 'on' as const } : gate));
  const goldGates = (price: string) => gates({
    trend: { pass: false, detail: `price is below its 200-day average (${price})` },
    momentum: { pass: false, detail: 'not up over the past year' },
    theme: { pass: true, detail: 'Scarcity is on.' },
  }).map((gate) => (gate.id === 'theme' ? { ...gate, themeState: 'off-allowed' as const } : gate));
  return [
    line({ symbol: 'SHY', name: 'US 1–3 yr government bonds', role: 'cash', defensive: true, status: 'hold', pyramid: 'hold', gates: gates({ regime: { pass: true, detail: 'Allowed today (defensive).' } }) }),
    line({ symbol: 'AAA.AX', name: 'Australian cash fund', role: 'cash', defensive: true, status: 'hold', pyramid: 'hold' }),
    line({ symbol: 'BILL.AX', name: 'Australian cash fund', role: 'cash', defensive: true, status: 'hold', pyramid: 'hold' }),
    line({ symbol: 'UUP', name: 'US dollar fund', defensive: true, status: 'confirmed', weight: 0.022, pyramid: 'hold', verdict: 'Buy — every check passed.', gates: gates({ regime: { pass: true, detail: 'Allowed today (defensive).' } }) }),
    line({ symbol: 'XLRE', name: 'US property shares', defensive: true, status: 'watch', pyramid: 'hold', above200: false, gates: gates({ trend: { pass: false, detail: 'price is below its 200-day average' } }) }),
    line({ symbol: 'USMV', name: 'US low-volatility shares', defensive: true, status: 'watch', pyramid: 'hold' }),
    line({ symbol: 'XLP', name: 'US consumer staples', defensive: true, status: 'watch', pyramid: 'hold' }),
    line({ symbol: 'XLV', name: 'US health care', defensive: true, status: 'watch', pyramid: 'hold', gates: gates({ regime: { pass: false, detail: 'the market mood must be Supportive (score +0.65 or more; today -0.16)' } }) }),
    line({ symbol: 'EQIX', name: 'Equinix', status: 'watch', theme: 'ai-infrastructure', gates: marketGates, verdict: 'Watch — 1 thing in the way: the market mood must be Supportive.' }),
    line({ symbol: 'SPY', name: 'US shares', status: 'avoid', gates: avoidGates }),
    line({ symbol: 'VAS.AX', name: 'Australian shares', status: 'avoid', gates: avoidGates }),
    line({ symbol: 'VGS.AX', name: 'World shares ex-Australia', status: 'avoid', gates: avoidGates }),
    line({ symbol: 'IOZ.AX', name: 'Australian large shares', status: 'avoid', gates: avoidGates }),
    line({ symbol: 'XLE', name: 'US energy shares', status: 'avoid', gates: avoidGates }),
    line({ symbol: 'XLF', name: 'US bank shares', status: 'avoid', gates: avoidGates }),
    line({ symbol: 'XLY', name: 'US discretionary shares', status: 'avoid', above200: false, momentum12_1: -0.12, gates: avoidGates.map((gate) => gate.id === 'trend' ? { ...gate, pass: false, detail: 'price is below its 200-day average' } : gate) }),
    line({ symbol: 'GLD', name: 'Gold', defensive: true, status: 'watch', theme: 'scarcity', above200: false, momentum12_1: -0.04, gates: goldGates('US$355.55 vs US$409.12'), verdict: 'Watch — price is below its 200-day average. Scarcity is on.' }),
    line({ symbol: 'GOLD.AX', name: 'Gold', defensive: true, status: 'watch', theme: 'scarcity', above200: false, momentum12_1: -0.03, gates: goldGates('A$42.00 vs A$48.00'), verdict: 'Watch — price is below its 200-day average. Scarcity is on.' }),
  ];
}

const sleeves: Record<string, string> = {
  SPY: 'Shares',
  'VAS.AX': 'Shares',
  'VGS.AX': 'Shares',
  'IOZ.AX': 'Shares',
  XLE: 'Cyclicals',
  XLF: 'Cyclicals',
  XLY: 'Cyclicals',
  GLD: 'Gold',
  'GOLD.AX': 'Gold',
  UUP: 'US dollar',
  EQIX: 'AI infrastructure',
  XLV: 'Defensive shares',
  XLRE: 'Defensive shares',
  USMV: 'Defensive shares',
  XLP: 'Defensive shares',
};

const prices: Record<string, [number, number]> = {
  EQIX: [820, 760],
  SPY: [590, 540],
  'VAS.AX': [104, 98],
  'VGS.AX': [132, 120],
  'IOZ.AX': [34, 31],
  XLE: [92, 86],
  XLF: [48, 44],
  XLY: [180, 210],
  GLD: [355.55, 409.12],
  'GOLD.AX': [42, 48],
  UUP: [29, 28],
  XLV: [155, 148],
  XLRE: [40, 42],
  USMV: [90, 84],
  XLP: [80, 76],
  SHY: [82, 82],
  'AAA.AX': [50, 50],
  'BILL.AX': [50, 50],
};

function withRows(lines: RiskLine[]): IdeaRow[] {
  return lines.map((item) => {
    const [last, ma] = prices[item.symbol] ?? [100, 90];
    return idea(item, sleeves[item.symbol] ?? 'This group', last, ma);
  });
}

function shell(view: RegimeView, extra: Partial<DashboardProps>): DashboardProps {
  const mark: PaperMarkPayload = {
    currency: 'AUD',
    nav: view.desk.equity && view.desk.capital ? view.desk.equity / view.desk.capital : null,
    navStatus: 'ok',
    reason: 'Held book.',
    gross: view.desk.paperLedger?.exposures?.gross ?? 0,
    cashWeight: view.desk.paperLedger?.exposures?.cash ?? 1,
    turnover: 0,
    costsPaid: 0,
    weights: extra.paperLog?.latest?.weights ?? [],
    prices: [],
    basis: 'held-book',
  };
  return {
    view,
    selfCheck: null,
    health: null,
    attempt: null,
    blockReason: null,
    csrf: null,
    settingsNotice: null,
    auditNote: 'Checklist stored with the 19 Nov 2026 snapshot. The page does not replace those sentences. Labels below are the display reading.',
    evaluation: {
      ruleVersion: 'regime-v2',
      fullStrategy: 'not_validated',
      fullStrategyReason: 'The saved-price check is separate from the replay bars.',
      priceOnly: true,
      assumptions: { oneWayBps: 10, cashYieldBps: 0, oneWay: 0.001, cashYieldAnnual: 0, clamped: false },
      costNote: '',
      cashNote: '',
      dividendNote: '',
      lookAhead: '',
      sampleNote: '',
      returnLabel: '',
      symbols: [],
      included: 0,
      skipped: 0,
      unavailableReason: null,
    },
    validation: null,
    replay: replayJson as unknown as DashboardProps['replay'],
    paperLog: { status: 'ok', decisions: 40, marks: 30, latest: mark },
    ...extra,
  };
}

export function quietProps(): DashboardProps {
  const lines = quietLines();
  const themes = [
    {
      id: 'ai-infrastructure',
      label: 'AI infrastructure',
      enabled: true,
      on: true,
      objective: 'Chips, power, and data-centre landlords.',
      reason: 'On — AI spending rose.',
      symbols: [],
      lines: lines.filter((item) => item.symbol === 'EQIX'),
    },
    {
      id: 'scarcity',
      label: 'Scarcity',
      enabled: true,
      on: false,
      objective: 'Gold and bitcoin when real yields or the dollar fall.',
      reason: 'Off — real interest rates rose and the US dollar rose. Turns on if either falls.',
      symbols: [],
      lines: lines.filter((item) => item.symbol === 'GLD' || item.symbol === 'GOLD.AX'),
    },
    {
      id: 'crypto',
      label: 'Crypto',
      enabled: true,
      on: false,
      objective: 'Bitcoin, ether, and solana.',
      reason: 'Off. Bitcoin is not above its 200-day average.',
      symbols: [],
      lines: [],
    },
  ];
  const view: RegimeView = {
    snapshot: snapshot({
      regime: 'transitional',
      composite: -0.16,
      actionable: false,
      action: 'reduce_risk',
      weak: true,
      components: quietComponents,
    }),
    ideas: ideasFor(withRows(lines), true),
    desk: deskFor(lines, { equity: 100464, invested: 0.401, nonCash: 0.1, maxGross: 0.4, maxNet: 0.2, themes }),
    consistency: { rules: [{ id: 'held-book', pass: true, detail: 'Paper book inside the caps.' }] },
  };
  return shell(view, {
    blockReason: 'The latest refresh did not receive every mandatory feed. New buys stay off.',
    health: {
      outcome: 'failure',
      fetchOutcome: 'failure',
      persisted: true,
      snapshotSaved: false,
      durable: true,
      attemptedAt: '2026-11-20T02:15:00.000Z',
      lastFullySuccessfulFetchAt: '2026-11-19T02:15:00.000Z',
      lastPersistedAt: '2026-11-19T02:15:00.000Z',
      storage: 'neon',
      note: 'Mandatory feeds failed. The previous saved snapshot was kept and new buys stay off.',
      sources: [
        { id: 'WALCL', label: 'Fed total assets', mandatory: true, observationDate: '2026-11-12', fetchedAt: '2026-11-20T02:15:00.000Z', error: 'FRED returned 403' },
        { id: 'BAMLH0A0HYM2', label: 'US high-yield spread', mandatory: true, observationDate: '2026-11-19', fetchedAt: '2026-11-20T02:15:00.000Z', error: 'FRED returned 403' },
      ],
    },
    paperLog: {
      status: 'ok',
      decisions: 40,
      marks: 30,
      latest: {
        currency: 'AUD',
        nav: 1.0046,
        navStatus: 'ok',
        reason: 'Held book.',
        gross: 0.401,
        cashWeight: 0.599,
        turnover: 0,
        costsPaid: 0.001,
        weights: quietHeld,
        prices: [],
        basis: 'held-book',
      },
    },
  });
}

export function buyProps(): DashboardProps {
  const open = gates({
    regime: { pass: true, detail: 'The market mood is Supportive, so a new buy is allowed.' },
  });
  const lines: RiskLine[] = [
    line({ symbol: 'SPY', name: 'US shares', status: 'confirmed', weight: 0.12, gates: open, verdict: 'Buy — every check passed.' }),
    line({ symbol: 'VAS.AX', name: 'Australian shares', status: 'confirmed', weight: 0.08, gates: open, verdict: 'Buy — every check passed.' }),
    line({ symbol: 'EQIX', name: 'Equinix', status: 'confirmed', weight: 0.05, theme: 'ai-infrastructure', gates: open.map((gate) => gate.id === 'theme' ? { ...gate, detail: 'AI infrastructure is on.', themeState: 'on' as const } : gate), verdict: 'Buy — every check passed. AI infrastructure is on.' }),
    line({ symbol: 'GLD', name: 'Gold', status: 'watch', above200: false, gates: gates({ regime: { pass: true, detail: 'Allowed today (defensive).' }, trend: { pass: false, detail: 'price is below its 200-day average' } }) }),
    line({ symbol: 'SHY', name: 'US 1–3 yr government bonds', role: 'cash', status: 'hold', pyramid: 'hold', weight: 0 }),
  ];
  const themes = [
    {
      id: 'ai-infrastructure',
      label: 'AI infrastructure',
      enabled: true,
      on: true,
      objective: 'Chips, power, and data-centre landlords.',
      reason: 'On — AI spending rose.',
      symbols: [],
      lines: lines.filter((item) => item.symbol === 'EQIX'),
    },
    {
      id: 'scarcity',
      label: 'Scarcity',
      enabled: true,
      on: false,
      objective: 'Gold.',
      reason: 'Off — real interest rates rose.',
      symbols: [],
      lines: lines.filter((item) => item.symbol === 'GLD'),
    },
    {
      id: 'crypto',
      label: 'Crypto',
      enabled: true,
      on: false,
      objective: 'Crypto.',
      reason: 'Off.',
      symbols: [],
      lines: [],
    },
  ];
  const buyComponents = quietComponents.map((item) => (
    item.id === 'policy' ? { ...item, z: 0.4, reading: '2-year yield versus the policy rate, 0.10 pp' }
      : item.id === 'credit' ? { ...item, z: 0.3 }
        : item.id === 'liquidity' ? { ...item, z: 0.5 }
          : item
  ));
  const view: RegimeView = {
    snapshot: snapshot({
      regime: 'risk_on',
      composite: 0.82,
      actionable: true,
      action: 'risk_budget_open',
      weak: false,
      components: buyComponents,
    }),
    ideas: ideasFor(withRows(lines), false),
    desk: deskFor(lines, { equity: 108400, invested: 0.25, nonCash: 0.25, maxGross: 1.5, maxNet: 1, themes }),
    consistency: { rules: [{ id: 'held-book', pass: true, detail: 'Paper book inside the caps.' }] },
  };
  return shell(view, {
    blockReason: null,
    paperLog: {
      status: 'ok',
      decisions: 40,
      marks: 30,
      latest: {
        currency: 'AUD',
        nav: 1.084,
        navStatus: 'ok',
        reason: 'Held book.',
        gross: 0.25,
        cashWeight: 0.75,
        turnover: 0.25,
        costsPaid: 0.001,
        weights: [
          { symbol: 'CASH', weight: 0.75 },
          { symbol: 'SPY', weight: 0.12 },
          { symbol: 'VAS.AX', weight: 0.08 },
          { symbol: 'EQIX', weight: 0.05 },
        ],
        prices: [],
        basis: 'held-book',
      },
    },
  });
}
