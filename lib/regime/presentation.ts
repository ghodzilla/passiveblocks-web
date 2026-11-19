import type { Desk, RiskLine } from './desk';
import type { IdeaRow } from './ideas';
import type { PaperPosition } from './journal';
import { componentPlain } from './ownerCopy';
import { classifyNames, marketPath, type MarketPath, type NamePaths, type PathNameInput } from './pathToBuy';
import { presentCall, type PresentCall } from './presentCall';
import { themesForSymbol } from './themes';
import type { RegimeView } from './view';

const CAP_EPS = 0.005;

export function nameIsAtCap(input: {
  role: RiskLine['role'];
  invested: number | null;
  maxGross: number | null;
  nonCash: number | null;
  maxNet: number | null;
}): boolean {
  if (input.invested == null || input.maxGross == null || !Number.isFinite(input.invested) || !Number.isFinite(input.maxGross)) {
    return false;
  }
  if (input.invested >= input.maxGross - CAP_EPS) return true;
  if (input.role !== 'cash' && input.nonCash != null && input.maxNet != null && input.nonCash >= input.maxNet - CAP_EPS) {
    return true;
  }
  return false;
}

function themeFacts(desk: Desk, symbol: string): { themeOn: boolean | null; offLabels: string[] } {
  const configs = themesForSymbol(symbol);
  if (configs.length === 0) return { themeOn: null, offLabels: [] };
  const offLabels = configs
    .filter((config) => desk.themes.find((theme) => theme.id === config.id)?.on !== true)
    .map((config) => config.label);
  return { themeOn: offLabels.length < configs.length, offLabels };
}

export interface Presentation {
  calls: Map<string, PresentCall>;
  market: MarketPath;
  names: NamePaths;
  /** True when the invested cap is full, so a new buy does not fit. */
  investedFull: boolean;
  capKnown: boolean;
}

export function buildPresentation(input: {
  view: RegimeView;
  held?: Record<string, number>;
}): Presentation {
  const { snapshot, ideas, desk } = input.view;
  const held = input.held ?? {};
  const exposures = desk.paperLedger?.exposures ?? null;
  const invested = exposures?.gross ?? null;
  const nonCash = exposures?.net ?? null;
  const maxGross = exposures?.maxGross ?? snapshot.effectiveBudget.maxGross;
  const maxNet = exposures?.maxNet ?? snapshot.effectiveBudget.maxNet;
  const capKnown = invested != null && maxGross != null;
  const investedFull = capKnown && invested >= maxGross - CAP_EPS;
  const positions = new Map((desk.paperLedger?.positions ?? []).map((position) => [position.symbol, position]));
  const rows = new Map(ideas.rows.map((row) => [row.symbol, row]));
  const calls = new Map<string, PresentCall>();
  const pathNames: PathNameInput[] = [];

  for (const line of desk.lines) {
    const row = rows.get(line.symbol);
    const position = positions.get(line.symbol) ?? null;
    const heldWeight = held[line.symbol] ?? 0;
    const owned = line.pyramid === 'hold' || line.pyramid === 'no-add-loser' || heldWeight > 0 || (position != null && position.qty > 0);
    const { themeOn, offLabels } = themeFacts(desk, line.symbol);
    const atCap = nameIsAtCap({
      role: line.role,
      invested,
      maxGross,
      nonCash,
      maxNet,
    });
    const currency = line.symbol.endsWith('.AX') ? 'A$' : 'US$';
    calls.set(line.symbol, presentCall({
      status: line.status,
      verdict: line.verdict,
      role: line.role,
      pyramid: line.pyramid,
      weight: line.weight,
      sleeve: row?.sleeve ?? 'This group',
      gates: line.gates,
      themeOn,
      themeLabels: offLabels,
      owned,
      entry: position?.entry ?? null,
      stop: position?.stop ?? null,
      currency,
      actionable: snapshot.actionable,
      atCap,
    }));
    pathNames.push(pathInput(line, row, position, owned, atCap, snapshot.actionable));
  }

  return {
    calls,
    market: marketPath({
      composite: snapshot.composite,
      liquidity: snapshot.components.find((component) => component.id === 'liquidity')?.z ?? null,
      components: snapshot.components.map((component) => ({
        id: component.id,
        title: componentPlain(component.id, component.z).title,
        z: component.z,
        weight: component.weight,
        included: component.included,
      })),
      history: snapshot.history,
    }),
    names: classifyNames({
      names: pathNames,
      bookEquity: desk.equity,
      bookPeak: desk.peakEquity,
      bookCurrency: desk.paperLedger?.currency === 'AUD' ? 'AUD' : null,
    }),
    investedFull,
    capKnown,
  };
}

function pathInput(
  line: RiskLine,
  row: IdeaRow | undefined,
  position: PaperPosition | null,
  owned: boolean,
  atCap: boolean,
  actionable: boolean,
): PathNameInput {
  return {
    symbol: line.symbol,
    name: line.name,
    role: line.role,
    status: line.status,
    sleeve: row?.sleeve ?? 'This group',
    owned: owned || (position != null && position.qty > 0),
    weight: line.weight,
    gates: line.gates,
    lastClose: row?.signals.lastClose ?? null,
    ma200: row?.signals.ma200 ?? null,
    momentum12_1: line.momentum12_1 ?? row?.signals.momentum12_1 ?? null,
    reversionZ: line.reversionZ ?? row?.signals.reversionZ ?? null,
    atCap,
    actionable,
  };
}
