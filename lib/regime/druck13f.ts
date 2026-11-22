/**
 * Duquesne Family Office 13F-HR from SEC EDGAR. No API key.
 * The diff is a suggestion. This module does not edit the candidate list.
 */

import { DRUCK_CANDIDATES } from './druck.config';
import { plainDate } from './visser';

export const DUQUESNE_CIK = '0001536411';
export const SEC_USER_AGENT = 'Passive Blocks regime research druck-aud-paper-v1 (https://passiveblocks.com)';
export const BIG_NEW_WEIGHT = 0.02;
export const SHARE_MOVE = 0.05;
export const NATERA_LINE = 0.15;
export const FILING_FRESH_HOURS = 20;

export interface HoldingLine {
  issuer: string;
  title: string;
  cusip: string;
  putCall: string;
  value: number;
  shares: number;
}

export interface FilingRef {
  accession: string;
  filed: string;
  report: string;
  form: string;
}

export interface FilingChange {
  kind: 'new' | 'added' | 'trimmed' | 'exited';
  label: string;
  weight: number;
  shareChange: number | null;
  candidateId: string | null;
}

export interface NateraCheck {
  weight: number | null;
  callWeight: number | null;
  under15: boolean;
  exited: boolean;
}

export interface FilingAnalysis {
  changes: FilingChange[];
  counts: { new: number; added: number; trimmed: number; exited: number };
  natera: NateraCheck;
  lines: string[];
  flags: string[];
  suggestions: string[];
}

export interface FilingReport {
  latest: FilingRef;
  previous: FilingRef | null;
  analysis: FilingAnalysis;
  holdings: HoldingLine[];
  previousHoldings: HoldingLine[] | null;
}

export interface FilingCardModel {
  title: string;
  headline: string;
  lines: string[];
  flags: string[];
  suggestions: string[];
  footnote: string;
}

const FOOTNOTE = 'Weights are each line divided by the whole filing, so dollars and thousands cancel out. Added or trimmed means the share count moved by more than 5%. Suggestion only. The candidate list is not changed.';

interface Keyed extends HoldingLine {
  key: string;
  candidateId: string | null;
}

function textBetween(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

/** Parse a 13F information table. Options stay separate from the shares. */
export function parseInfoTable(xml: string): HoldingLine[] {
  const blocks = xml.match(/<infoTable\b[^>]*>[\s\S]*?<\/infoTable>/gi) ?? [];
  const merged = new Map<string, HoldingLine>();
  for (const block of blocks) {
    const issuer = textBetween(block, 'nameOfIssuer');
    const cusip = textBetween(block, 'cusip');
    if (!issuer || !cusip) continue;
    const line: HoldingLine = {
      issuer,
      title: textBetween(block, 'titleOfClass'),
      cusip,
      putCall: textBetween(block, 'putCall'),
      value: Number(textBetween(block, 'value')) || 0,
      shares: Number(textBetween(block, 'sshPrnamt')) || 0,
    };
    const key = `${line.cusip}|${line.putCall.toUpperCase()}`;
    const prev = merged.get(key);
    if (prev) {
      prev.value += line.value;
      prev.shares += line.shares;
    } else {
      merged.set(key, line);
    }
  }
  return Array.from(merged.values());
}

export function pickInfoTableName(names: readonly string[]): string | null {
  const xml = names.filter((name) => name.toLowerCase().endsWith('.xml'));
  const form = xml.find((name) => /form13f|infotable/i.test(name) && !/primary_doc/i.test(name));
  return form ?? null;
}

/** Two latest 13F periods. An amendment replaces the original for that quarter. */
export function pick13fFilings(body: unknown): FilingRef[] {
  if (!body || typeof body !== 'object') return [];
  const recent = (body as { filings?: { recent?: Record<string, unknown> } }).filings?.recent;
  if (!recent) return [];
  const forms = Array.isArray(recent.form) ? recent.form : [];
  const accessions = Array.isArray(recent.accessionNumber) ? recent.accessionNumber : [];
  const filed = Array.isArray(recent.filingDate) ? recent.filingDate : [];
  const report = Array.isArray(recent.reportDate) ? recent.reportDate : [];
  const rows: FilingRef[] = [];
  for (let i = 0; i < forms.length; i++) {
    const form = String(forms[i] ?? '');
    if (form !== '13F-HR' && form !== '13F-HR/A') continue;
    const accession = String(accessions[i] ?? '');
    const filedOn = String(filed[i] ?? '');
    const period = String(report[i] ?? '');
    if (!accession || !/^\d{4}-\d{2}-\d{2}$/.test(filedOn) || !/^\d{4}-\d{2}-\d{2}$/.test(period)) continue;
    rows.push({ accession, filed: filedOn, report: period, form });
  }
  const byPeriod = new Map<string, FilingRef>();
  for (const row of rows) {
    const prev = byPeriod.get(row.report);
    if (!prev || row.filed > prev.filed) byPeriod.set(row.report, row);
  }
  return Array.from(byPeriod.values()).sort((a, b) => (a.report < b.report ? 1 : a.report > b.report ? -1 : 0)).slice(0, 2);
}

function candidateIdOf(line: HoldingLine): string | null {
  const blob = `${line.issuer} ${line.title}`.toUpperCase();
  if (blob.includes('SEAGATE')) return 'stx';
  if (blob.includes('WESTERN DIGITAL')) return 'wdc';
  if (blob.includes('NATERA')) return 'ntra';
  if (blob.includes('AMAZON')) return 'amzn';
  if (blob.includes('INSMED')) return 'insm';
  if (blob.startsWith('SEA LTD') || blob.startsWith('SEA LIMITED')) return 'se';
  if (blob.startsWith('YPF')) return 'ypf';
  if (blob.includes('MSCI BRAZIL')) return 'ewz';
  if (blob.includes('CYBERSECURITY ETF') || blob.includes('CIBR')) return 'hack';
  if (blob.includes('GOLD MINERS')) return 'gdx';
  if (blob.includes('SEMICONDUCTOR ETF')) return 'semi';
  return null;
}

function labelOf(line: HoldingLine): string {
  const put = line.putCall ? ` ${line.putCall.toLowerCase()} options` : '';
  const title = line.title && !/^COM\b/i.test(line.title) ? ` (${line.title})` : '';
  return `${line.issuer}${title}${put}`;
}

function keyOf(line: HoldingLine): string {
  return `${line.cusip}|${line.putCall.toUpperCase()}`;
}

function pct(weight: number): string {
  return `${(weight * 100).toFixed(1)}%`;
}

function shareText(change: number | null): string {
  if (change == null || !Number.isFinite(change)) return '';
  const body = `${Math.abs(change * 100).toFixed(0)}%`;
  return change >= 0 ? `, shares up ${body}` : `, shares down ${body}`;
}

export function analyseFilings(previous: readonly HoldingLine[], latest: readonly HoldingLine[]): FilingAnalysis {
  const total = latest.reduce((sum, line) => sum + (line.value > 0 ? line.value : 0), 0);
  const prevTotal = previous.reduce((sum, line) => sum + (line.value > 0 ? line.value : 0), 0);
  const weightOf = (value: number, base: number) => (base > 0 ? value / base : 0);
  const prevMap = new Map<string, Keyed>();
  for (const line of previous) {
    prevMap.set(keyOf(line), { ...line, key: keyOf(line), candidateId: candidateIdOf(line) });
  }
  const latestMap = new Map<string, Keyed>();
  for (const line of latest) {
    latestMap.set(keyOf(line), { ...line, key: keyOf(line), candidateId: candidateIdOf(line) });
  }
  const changes: FilingChange[] = [];
  for (const line of Array.from(latestMap.values())) {
    const prev = prevMap.get(line.key);
    const weight = weightOf(line.value, total);
    if (!prev) {
      changes.push({ kind: 'new', label: labelOf(line), weight, shareChange: null, candidateId: line.candidateId });
      continue;
    }
    if (!(prev.shares > 0) || !(line.shares > 0)) continue;
    const shareChange = line.shares / prev.shares - 1;
    if (shareChange > SHARE_MOVE) {
      changes.push({ kind: 'added', label: labelOf(line), weight, shareChange, candidateId: line.candidateId });
    } else if (shareChange < -SHARE_MOVE) {
      changes.push({ kind: 'trimmed', label: labelOf(line), weight, shareChange, candidateId: line.candidateId });
    }
  }
  for (const line of Array.from(prevMap.values())) {
    if (latestMap.has(line.key)) continue;
    changes.push({
      kind: 'exited',
      label: labelOf(line),
      weight: weightOf(line.value, prevTotal),
      shareChange: null,
      candidateId: line.candidateId,
    });
  }
  const counts = {
    new: changes.filter((change) => change.kind === 'new').length,
    added: changes.filter((change) => change.kind === 'added').length,
    trimmed: changes.filter((change) => change.kind === 'trimmed').length,
    exited: changes.filter((change) => change.kind === 'exited').length,
  };
  const stock = (lines: Map<string, Keyed>, id: string) => Array.from(lines.values()).filter((line) => line.candidateId === id && !line.putCall);
  const calls = (lines: Map<string, Keyed>, id: string) => Array.from(lines.values()).filter((line) => line.candidateId === id && line.putCall);
  const nateraStock = stock(latestMap, 'ntra').reduce((sum, line) => sum + line.value, 0);
  const nateraCalls = calls(latestMap, 'ntra').reduce((sum, line) => sum + line.value, 0);
  const hadStock = stock(prevMap, 'ntra').length > 0;
  const exited = hadStock && stock(latestMap, 'ntra').length === 0;
  const weight = total > 0 && nateraStock > 0 ? nateraStock / total : null;
  const natera: NateraCheck = {
    weight,
    callWeight: total > 0 && nateraCalls > 0 ? nateraCalls / total : null,
    under15: exited || weight == null || weight < NATERA_LINE,
    exited,
  };
  const notable = changes.filter((change) => change.candidateId != null || change.weight >= BIG_NEW_WEIGHT);
  const shown = notable.slice(0, 12);
  const lines = shown.map((change) => {
    const verb = change.kind === 'new' ? 'New' : change.kind === 'added' ? 'Added' : change.kind === 'trimmed' ? 'Trimmed' : 'Exited';
    const where = change.kind === 'exited' ? 'was ' : '';
    return `${verb}: ${change.label} (${where}${pct(change.weight)} of the reported portfolio${shareText(change.shareChange)}).`;
  });
  if (notable.length > shown.length) lines.push(`And ${notable.length - shown.length} other large changes.`);
  const flags: string[] = [];
  for (const change of changes) {
    if (change.kind === 'exited' && change.candidateId && !change.label.toLowerCase().includes('options')) {
      const name = DRUCK_CANDIDATES.find((candidate) => candidate.id === change.candidateId)?.name ?? change.label;
      flags.push(`Duquesne exited ${name}. It is still on the candidate list.`);
    }
  }
  if (natera.exited) {
    flags.push('Duquesne no longer reports Natera shares. That is under 15%. The sell note on Natera names that line. The book does not sell by itself.');
  } else if (natera.weight == null) {
    flags.push('Natera is not in this 13F. That is under 15%. The sell note on Natera names that line. The book does not sell by itself.');
  } else if (natera.under15) {
    const callsNote = natera.callWeight != null ? ` Call options are a further ${pct(natera.callWeight)}.` : '';
    flags.push(`Natera is ${pct(natera.weight)} of the reported portfolio, under 15%.${callsNote} The sell note on Natera names that line. The book does not sell by itself.`);
  } else {
    const callsNote = natera.callWeight != null ? ` Call options are a further ${pct(natera.callWeight)}.` : '';
    flags.push(`Natera is ${pct(natera.weight)} of the reported portfolio.${callsNote} The 15% line is not broken.`);
  }
  const suggestions: string[] = [];
  for (const change of changes) {
    if (change.kind === 'new' && change.candidateId == null && change.weight >= BIG_NEW_WEIGHT) {
      suggestions.push(`Duquesne opened ${change.label} at ${pct(change.weight)} of the reported portfolio. It is not on the candidate list.`);
    }
  }
  for (const change of changes) {
    if (change.kind === 'exited' && change.candidateId && !change.label.toLowerCase().includes('options')) {
      const name = DRUCK_CANDIDATES.find((candidate) => candidate.id === change.candidateId)?.name ?? change.label;
      suggestions.push(`Duquesne no longer reports ${name}. Consider taking it off the list.`);
    }
  }
  if (suggestions.length === 0) suggestions.push('No list change to suggest from this filing.');
  suggestions.push('Suggestion only. The list is not changed.');
  return { changes, counts, natera, lines, flags, suggestions };
}

export function presentFiling(input: {
  status: 'ok' | 'missing_schema' | 'unconfigured' | 'empty';
  report: { latest: FilingRef; previous: FilingRef | null; analysis: FilingAnalysis } | null;
}): FilingCardModel {
  const title = '13F changes';
  if (input.status === 'unconfigured') {
    return { title, headline: 'No database is configured, so the 13F is not saved.', lines: [], flags: [], suggestions: [], footnote: FOOTNOTE };
  }
  if (input.status === 'missing_schema') {
    return {
      title,
      headline: 'The 13F table is not in the database yet. Apply db/regime/006_druck_context.sql.',
      lines: [],
      flags: [],
      suggestions: [],
      footnote: FOOTNOTE,
    };
  }
  if (!input.report) {
    return {
      title,
      headline: 'No 13F is saved yet. The check reads Duquesne Family Office from the SEC. The list is not changed by this card.',
      lines: [],
      flags: [],
      suggestions: [],
      footnote: FOOTNOTE,
    };
  }
  const { latest, previous, analysis } = input.report;
  const compared = previous
    ? `compared with the filing of ${plainDate(previous.filed)}`
    : 'with no earlier filing to compare';
  const counts = `${analysis.counts.new} new, ${analysis.counts.added} added, ${analysis.counts.trimmed} trimmed, ${analysis.counts.exited} exited`;
  return {
    title,
    headline: `Latest filing ${plainDate(latest.filed)}, for the quarter ending ${plainDate(latest.report)}, ${compared}. ${counts}.`,
    lines: analysis.lines,
    flags: analysis.flags,
    suggestions: analysis.suggestions,
    footnote: FOOTNOTE,
  };
}

function cikPath(cik: string): string {
  return String(Number(cik));
}

function accessionPath(accession: string): string {
  return accession.replace(/-/g, '');
}

async function secText(url: string, fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'user-agent': SEC_USER_AGENT, accept: 'application/json, text/xml, */*' },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/** Download the two latest Duquesne 13Fs and diff them. Null when the SEC does not answer. */
export async function fetchDuquesne13f(fetchImpl: typeof fetch = fetch, pause: () => Promise<void> = sleep): Promise<FilingReport | null> {
  const submissions = await secText(`https://data.sec.gov/submissions/CIK${DUQUESNE_CIK}.json`, fetchImpl);
  if (!submissions) return null;
  let body: unknown;
  try {
    body = JSON.parse(submissions) as unknown;
  } catch {
    return null;
  }
  const picked = pick13fFilings(body);
  if (picked.length === 0) return null;
  const loaded: { ref: FilingRef; holdings: HoldingLine[] }[] = [];
  for (const ref of picked) {
    await pause();
    const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikPath(DUQUESNE_CIK)}/${accessionPath(ref.accession)}/index.json`;
    const indexText = await secText(indexUrl, fetchImpl);
    if (!indexText) return null;
    let index: unknown;
    try {
      index = JSON.parse(indexText) as unknown;
    } catch {
      return null;
    }
    const items = index && typeof index === 'object'
      ? (index as { directory?: { item?: { name?: string }[] } }).directory?.item ?? []
      : [];
    const name = pickInfoTableName(items.map((item) => item.name ?? '').filter(Boolean));
    if (!name) return null;
    await pause();
    const xml = await secText(`https://www.sec.gov/Archives/edgar/data/${cikPath(DUQUESNE_CIK)}/${accessionPath(ref.accession)}/${name}`, fetchImpl);
    if (!xml) return null;
    const holdings = parseInfoTable(xml);
    if (holdings.length === 0) return null;
    loaded.push({ ref, holdings });
  }
  const latest = loaded[0];
  const previous = loaded[1] ?? null;
  return {
    latest: latest.ref,
    previous: previous?.ref ?? null,
    holdings: latest.holdings,
    previousHoldings: previous?.holdings ?? null,
    analysis: analyseFilings(previous?.holdings ?? [], latest.holdings),
  };
}

function sleep(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 200));
}

export function filingFresh(fetchedAt: string, now: Date, hours = FILING_FRESH_HOURS): boolean {
  const age = now.getTime() - Date.parse(fetchedAt);
  return Number.isFinite(age) && age >= 0 && age < hours * 3_600_000;
}

/** Fixture diff for the preview. Not a live filing. */
export function sampleFilingReport(): { latest: FilingRef; previous: FilingRef; analysis: FilingAnalysis } {
  const previous: HoldingLine[] = [
    { issuer: 'Natera Inc', title: 'COM', cusip: '632307104', putCall: '', value: 1400, shares: 3000 },
    { issuer: 'Seagate Technology Hldngs Pl', title: 'ORD SHS', cusip: 'G7945M107', putCall: '', value: 400, shares: 1000 },
    { issuer: 'Western Digital Corp', title: 'COM', cusip: '958102105', putCall: '', value: 80, shares: 400 },
    { issuer: 'Amazon Com Inc', title: 'COM', cusip: '023135106', putCall: '', value: 200, shares: 800 },
  ];
  const latest: HoldingLine[] = [
    { issuer: 'Natera Inc', title: 'COM', cusip: '632307104', putCall: '', value: 1460, shares: 3100 },
    { issuer: 'Seagate Technology Hldngs Pl', title: 'ORD SHS', cusip: 'G7945M107', putCall: '', value: 300, shares: 800 },
    { issuer: 'Amazon Com Inc', title: 'COM', cusip: '023135106', putCall: '', value: 220, shares: 900 },
    { issuer: 'Palantir Technologies Inc', title: 'COM', cusip: '69608A108', putCall: '', value: 210, shares: 2000 },
  ];
  return {
    latest: { accession: '0001536411-26-000011', filed: '2026-11-16', report: '2026-09-30', form: '13F-HR' },
    previous: { accession: '0001536411-26-000006', filed: '2026-08-14', report: '2026-06-30', form: '13F-HR' },
    analysis: analyseFilings(previous, latest),
  };
}
