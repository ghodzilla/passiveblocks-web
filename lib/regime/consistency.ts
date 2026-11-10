import type { PaperLedger } from './audPaper';
import { BOOK_LIMITS_VERSION, BOOK_LIMIT_TOLERANCE } from './bookLimits';
import { bookExposureSentence } from './exposureCopy';
import { budgetsFor } from './classify';
import { defensiveOnly, type IdeasReport } from './ideas';
import { OVERLAP_GROUP_CAP } from './overlap';
import { THEME_WEIGHT_CAP } from './sizing';
import { themesForSymbol } from './themes';
import type { Desk, RiskLine } from './desk';
import type { RegimeSnapshot } from './types';

export interface ConsistencyRule {
  id: string;
  pass: boolean;
  detail: string;
}

export interface ConsistencyReport {
  rules: ConsistencyRule[];
}

export function heldBookRule(ledger: PaperLedger | null): ConsistencyRule {
  const withinCaps = ledger?.exposures != null
    && ledger.exposures.gross <= ledger.exposures.maxGross + BOOK_LIMIT_TOLERANCE
    && ledger.exposures.net <= ledger.exposures.maxNet + BOOK_LIMIT_TOLERANCE;
  const heldDetail = !ledger
    ? 'No AUD paper book is attached. The audit does not treat a missing book as a capped value.'
    : ledger.status === 'unvalued'
      ? `Policy ${ledger.policy ?? BOOK_LIMITS_VERSION}. The AUD book is unvalued. No net value is shown and no new buy is added.`
      : ledger.exposures
        ? `Policy ${ledger.policy ?? BOOK_LIMITS_VERSION}. Paper only. ${bookExposureSentence(ledger.exposures)} Pending ${ledger.pending.length}.`
        : `Policy ${ledger.policy ?? BOOK_LIMITS_VERSION}. Paper only. The AUD book has no held exposure to compare. Pending ${ledger.pending.length}.`;
  return {
    id: 'held-book',
    pass: !ledger || ledger.status === 'unvalued' || ledger.status === 'legacy_only' || ledger.exposures == null || withinCaps,
    detail: ledger?.legacy
      ? `${heldDetail} The earlier ledger is retained and is not an AUD value.`
      : heldDetail,
  };
}

function budgetClose(left: { volTarget: number; maxGross: number; maxNet: number }, right: { volTarget: number; maxGross: number; maxNet: number }): boolean {
  return Math.abs(left.volTarget - right.volTarget) < 1e-9
    && Math.abs(left.maxGross - right.maxGross) < 1e-9
    && Math.abs(left.maxNet - right.maxNet) < 1e-9;
}

function lineBySymbol(lines: RiskLine[], symbol: string): RiskLine | undefined {
  return lines.find((line) => line.symbol === symbol);
}

export function auditRegime(input: {
  snapshot: RegimeSnapshot;
  ideas: IdeasReport;
  desk: Desk;
}): ConsistencyReport {
  const { snapshot, ideas, desk } = input;
  const rules: ConsistencyRule[] = [];
  const expected = budgetsFor(snapshot.regime, snapshot.action);
  const standDown = defensiveOnly(snapshot.action);

  rules.push({
    id: 'banner-budget',
    pass: budgetClose(snapshot.effectiveBudget, expected.effectiveBudget),
    detail: 'The volatility, gross, and net tiles match the budget for the banner action.',
  });
  rules.push({
    id: 'banner-action',
    pass: ideas.action === snapshot.action && ideas.defensiveOnly === standDown
      && ideas.banner === (standDown ? snapshot.message : null)
      && snapshot.message.length > 0,
    detail: 'The do-nothing banner, the top message, and the action are the same decision.',
  });

  const themeMismatches: string[] = [];
  const sizeMismatches: string[] = [];
  const wordMismatches: string[] = [];
  const healthMismatches: string[] = [];
  const haltMismatches: string[] = [];
  const rowMismatches: string[] = [];
  const stanceMismatches: string[] = [];
  const dipMismatches: string[] = [];
  const dipLabelMismatches: string[] = [];

  for (const line of desk.lines) {
    const mapped = themesForSymbol(line.symbol);
    const live = mapped.map((config) => desk.themes.find((theme) => theme.id === config.id));
    const themeGate = line.gates.find((gate) => gate.id === 'theme');
    const anyOn = live.some((theme) => theme?.on);
    if (mapped.length === 0) {
      if (!themeGate?.pass || !themeGate.detail.startsWith('No theme')) themeMismatches.push(line.symbol);
    } else if (anyOn) {
      if (!themeGate?.pass) themeMismatches.push(line.symbol);
    } else if (themeGate?.pass && !themeGate.detail.includes('not a block')) themeMismatches.push(line.symbol);

    const gatesPass = line.gates.every((gate) => gate.pass);
    if (line.weight > 0 && (line.status !== 'confirmed' || !gatesPass)) sizeMismatches.push(line.symbol);
    if (line.status === 'confirmed' && (!(line.weight > 0) || !gatesPass)) sizeMismatches.push(line.symbol);
    if (line.weight === 0 && line.status === 'confirmed') sizeMismatches.push(line.symbol);

    const trend = line.gates.find((gate) => gate.id === 'trend');
    const saidAbove = (trend?.detail.includes('above its 200-day') ?? false) || line.verdict.includes('above its 200-day');
    const saidBelow = (trend?.detail.includes('below its 200-day') ?? false) || line.verdict.includes('below its 200-day');
    if (saidAbove && line.above200 !== true) wordMismatches.push(line.symbol);
    if (saidBelow && line.above200 !== false) wordMismatches.push(line.symbol);
    if (line.role !== 'cash' && line.above200 === false && trend?.pass && !trend.detail.includes('retired')) wordMismatches.push(line.symbol);

    if (line.status === 'confirmed' && line.role !== 'cash') {
      const momentum = ideas.signalHealth.find((signal) => signal.id === 'momentum');
      const trendHealth = ideas.signalHealth.find((signal) => signal.id === 'trend');
      const stretch = ideas.signalHealth.find((signal) => signal.id === 'reversion');
      if (momentum && momentum.status !== 'retired' && !(line.momentum12_1 != null && line.momentum12_1 > 0)) healthMismatches.push(line.symbol);
      if (trendHealth && trendHealth.status !== 'retired' && line.above200 !== true) healthMismatches.push(line.symbol);
      if (stretch && stretch.status !== 'retired' && !(line.reversionZ != null && line.reversionZ < 1.5)) healthMismatches.push(line.symbol);
      if (momentum?.status === 'retired' && trendHealth?.status === 'retired') healthMismatches.push(line.symbol);
    }

    const haltGate = line.gates.find((gate) => gate.id === 'halt');
    if (desk.halted && line.pyramid === 'new' && (line.weight > 0 || haltGate?.pass)) haltMismatches.push(line.symbol);
    if (haltGate && !haltGate.pass && line.weight > 0) haltMismatches.push(line.symbol);

    if (line.dip) {
      const themeOk = themeGate?.pass && !themeGate.detail.startsWith('No theme');
      const haltOk = haltGate?.pass;
      const regimeOk = snapshot.regime === 'risk_on' || snapshot.regime === 'transitional';
      if (!themeOk || !haltOk || !regimeOk) dipMismatches.push(line.symbol);
      const saysConfirmed = /confirmed/i.test(line.dip);
      if (saysConfirmed && !(line.weight > 0 && line.status === 'confirmed')) dipLabelMismatches.push(line.symbol);
      if (!saysConfirmed && line.weight > 0 && line.status === 'confirmed' && line.dip.startsWith('Dip spotted')) dipLabelMismatches.push(line.symbol);
    }
  }

  for (const row of ideas.rows) {
    const line = lineBySymbol(desk.lines, row.symbol);
    if (!line) {
      rowMismatches.push(row.symbol);
      continue;
    }
    if (line.status !== row.status || Math.abs(line.weight - row.maxWeight) > 1e-6) rowMismatches.push(row.symbol);
  }

  for (const play of ideas.playbook) {
    for (const symbol of play.symbols) {
      const line = lineBySymbol(desk.lines, symbol);
      if (!line) continue;
      const regimeGate = line.gates.find((gate) => gate.id === 'regime');
      const prefer = play.printStance === 'prefer';
      if (Boolean(regimeGate?.pass) !== prefer) stanceMismatches.push(symbol);
    }
  }

  const gross = desk.lines.reduce((sum, line) => sum + line.weight, 0);
  const net = desk.lines.reduce((sum, line) => sum + (line.role === 'cash' ? 0 : line.weight), 0);
  const themeCapBreach = desk.themes.some((theme) => {
    const sum = theme.lines.reduce((total, line) => total + line.weight, 0);
    return sum > THEME_WEIGHT_CAP + 1e-3;
  });
  const overlapBreach = desk.overlap.groups.some((group) => {
    let shown = 0;
    for (const symbol of group.symbols) shown += lineBySymbol(desk.lines, symbol)?.weight ?? 0;
    return Math.abs(shown - group.combinedAfter) > 1e-3 || shown > desk.overlap.cap + 1e-3;
  });

  rules.push({
    id: 'theme-gate',
    pass: themeMismatches.length === 0,
    detail: themeMismatches.length
      ? `Theme switch and the idea gate disagree for ${themeMismatches.join(', ')}.`
      : 'Each idea theme gate matches the live theme switch. Names with no theme say so.',
  });
  rules.push({
    id: 'tag-size',
    pass: sizeMismatches.length === 0,
    detail: sizeMismatches.length
      ? `Tag and size disagree for ${sizeMismatches.join(', ')}.`
      : 'A size is shown only when every gate passes, and a passing book is the only Confirmed tag.',
  });
  rules.push({
    id: 'trend-words',
    pass: wordMismatches.length === 0,
    detail: wordMismatches.length
      ? `Above/Below does not match the reason for ${wordMismatches.join(', ')}.`
      : 'Above/Below uses the same 200-day boolean as the written reason.',
  });
  rules.push({
    id: 'signal-health',
    pass: healthMismatches.length === 0,
    detail: healthMismatches.length
      ? `Signal health and the confirmation gates disagree for ${healthMismatches.join(', ')}.`
      : 'Retired and live signals match the gates on every Confirmed name.',
  });
  rules.push({
    id: 'drawdown-halt',
    pass: haltMismatches.length === 0,
    detail: haltMismatches.length
      ? `The drawdown halt still shows a new entry for ${haltMismatches.join(', ')}.`
      : 'The drawdown halt blocks every new entry.',
  });
  rules.push({
    id: 'idea-row',
    pass: rowMismatches.length === 0,
    detail: rowMismatches.length
      ? `The ideas table and the sizing book disagree for ${rowMismatches.join(', ')}.`
      : 'The ideas table and the sizing book are the same rows.',
  });
  rules.push({
    id: 'playbook-stance',
    pass: stanceMismatches.length === 0,
    detail: stanceMismatches.length
      ? `Playbook stance and the regime gate disagree for ${stanceMismatches.join(', ')}.`
      : 'Each playbook stance matches that symbol’s regime gate.',
  });
  rules.push({
    id: 'dip-label',
    pass: dipLabelMismatches.length === 0,
    detail: dipLabelMismatches.length
      ? `A dip says confirmed without a size, or a sized dip does not, for ${dipLabelMismatches.join(', ')}.`
      : 'The word confirmed appears on a dip only when that name has a size.',
  });
  rules.push({
    id: 'dip-tag',
    pass: dipMismatches.length === 0,
    detail: dipMismatches.length
      ? `A dip tag is showing without its theme, regime, and halt gates for ${dipMismatches.join(', ')}.`
      : 'A dip tag is present only when the theme is on, the regime allows a dip, and the halt is off.',
  });
  rules.push({
    id: 'caps',
    pass: gross <= snapshot.effectiveBudget.maxGross + 1e-3
      && net <= snapshot.effectiveBudget.maxNet + 1e-3
      && !themeCapBreach
      && !overlapBreach
      && Math.abs(desk.overlap.cap - OVERLAP_GROUP_CAP) < 1e-9,
    detail: 'Gross, net, theme, and overlap caps match the sizes shown.',
  });
  rules.push({
    id: 'crowding',
    pass: Math.abs(desk.crowdingScale - ideas.crowding.scale) < 1e-9
      && (ideas.crowding.warning == null || ideas.crowding.scale < 1)
      && (ideas.crowding.scale === 1 || ideas.crowding.warning != null || ideas.crowding.average == null),
    detail: 'The crowding alarm and the scale applied to the sizes are the same number.',
  });
  rules.push(heldBookRule(desk.paperLedger ?? null));
  rules.push({
    id: 'history',
    pass: (desk.realisedCagr != null || desk.realisedText === 'Not enough history yet')
      && (desk.backtestedCagr != null || desk.backtestedText === 'Not enough history yet')
      && (desk.gapToTarget != null || desk.gapText === 'Not enough history yet')
      && (desk.maxDrawdown != null || desk.maxDrawdownText === 'Not enough history yet')
      && !(desk.realisedCagr == null && desk.realisedText.includes('0'))
      && !(desk.maxDrawdown == null && desk.maxDrawdownText.includes('0')),
    detail: 'Missing history is labelled “Not enough history yet” instead of a zero.',
  });

  return { rules };
}
