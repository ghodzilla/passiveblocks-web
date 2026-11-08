import { creditSpan } from './creditSpan';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'research/regime-validation');
const CACHE = path.join(OUT, 'cache');
const RAN_AT = new Date().toISOString();

interface Probe {
  id: string;
  role: string;
  url: string;
  kind: 'vintage' | 'reprint' | 'publication' | 'price';
}

const PROBES: Probe[] = [
  { id: 'FRED-DGS2', role: 'policy yield, latest graph', url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2&cosd=2024-01-02&coed=2024-01-05', kind: 'vintage' },
  { id: 'ALFRED-DGS2-2019-01-02', role: 'policy yield vintage', url: 'https://alfred.stlouisfed.org/graph/alfredgraph.csv?id=DGS2&vintage_date=2019-01-02', kind: 'vintage' },
  { id: 'ALFRED-WALCL-2020-06-01', role: 'balance sheet vintage', url: 'https://alfred.stlouisfed.org/graph/alfredgraph.csv?id=WALCL&vintage_date=2020-06-01', kind: 'vintage' },
  { id: 'ALFRED-HY-2020-06-01', role: 'high yield OAS vintage', url: 'https://alfred.stlouisfed.org/graph/alfredgraph.csv?id=BAMLH0A0HYM2&vintage_date=2020-06-01', kind: 'vintage' },
  { id: 'ALFRED-HY-2024-06-03', role: 'high yield OAS vintage', url: 'https://alfred.stlouisfed.org/graph/alfredgraph.csv?id=BAMLH0A0HYM2&vintage_date=2024-06-03', kind: 'vintage' },
  { id: 'ALFRED-RRP-2024-06-03', role: 'RRP vintage', url: 'https://alfred.stlouisfed.org/graph/alfredgraph.csv?id=RRPONTSYD&vintage_date=2024-06-03', kind: 'vintage' },
  { id: 'ALFRED-TGA-2024-06-03', role: 'TGA vintage', url: 'https://alfred.stlouisfed.org/graph/alfredgraph.csv?id=WTREGEN&vintage_date=2024-06-03', kind: 'vintage' },
  { id: 'ALFRED-POLICY-2024-06-03', role: 'policy rate vintage', url: 'https://alfred.stlouisfed.org/graph/alfredgraph.csv?id=DFEDTARU&vintage_date=2024-06-03', kind: 'vintage' },
  { id: 'ALFRED-USCLI-2020-06-01', role: 'US CLI vintage', url: 'https://alfred.stlouisfed.org/graph/alfredgraph.csv?id=USALOLITOAASTSAM&vintage_date=2020-06-01', kind: 'vintage' },
  { id: 'ALFRED-CAPEX-2020-06-01', role: 'semiconductor IP vintage', url: 'https://alfred.stlouisfed.org/graph/alfredgraph.csv?id=IPG3344S&vintage_date=2020-06-01', kind: 'vintage' },
  { id: 'TREASURY-YIELD-XML', role: 'Treasury yield reprint', url: 'https://home.treasury.gov/sites/default/files/interest-rates/yield.xml', kind: 'reprint' },
  { id: 'FISCAL-TGA', role: 'TGA daily statement', url: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?filter=record_date:gte:2024-01-02&page[size]=3', kind: 'reprint' },
  { id: 'NYFED-RRP', role: 'NY Fed reverse repo', url: 'https://markets.newyorkfed.org/api/rp/reverserepo/all/results.json?startDate=2024-01-02&endDate=2024-01-05', kind: 'reprint' },
  { id: 'CFTC-2024-ZIP', role: 'CFTC legacy futures history', url: 'https://www.cftc.gov/files/dea/history/deacot2024.zip', kind: 'publication' },
  { id: 'FRED-HY-CURRENT', role: 'high yield OAS current free graph', url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2', kind: 'reprint' },
];

interface Row {
  id: string;
  role: string;
  url: string;
  kind: Probe['kind'];
  downloadedAt: string;
  httpStatus: number | null;
  bytes: number;
  sha256: string | null;
  availability: 'unavailable' | 'reprint_only' | 'publication_file' | 'point_in_time';
  note: string;
}

async function fetchBuf(url: string): Promise<{ status: number; body: Buffer }> {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(url.includes('cftc.gov') ? 45_000 : 20_000),
    headers: { 'user-agent': 'passiveblocks-research/1.0' },
  });
  const body = Buffer.from(await response.arrayBuffer());
  return { status: response.status, body };
}

function sha(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

function observations(body: Buffer): { first: string | null; last: string | null; count: number } {
  const lines = body.toString('utf8').trim().split(/\n/).filter((line) => line.length > 0);
  const dates = lines.slice(1).map((line) => line.slice(0, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
  return { first: dates[0] ?? null, last: dates[dates.length - 1] ?? null, count: dates.length };
}

function noteFor(probe: Probe, status: number, body: Buffer): { availability: Row['availability']; note: string } {
  const text = body.subarray(0, 1500).toString('utf8');
  if (status !== 200 || body.length === 0) {
    return { availability: 'unavailable', note: `HTTP ${status}, ${body.length} bytes. Not used.` };
  }
  if (probe.kind === 'vintage') {
    const vintage = probe.url.match(/vintage_date=(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
    const token = vintage ? vintage.replaceAll('-', '') : '';
    const header = text.split('\n')[0] ?? '';
    const span = observations(body);
    const stamped = token.length > 0 && header.includes(token);
    const endsBefore = vintage != null && span.last != null && span.last <= vintage;
    if (stamped && endsBefore) {
      return {
        availability: 'point_in_time',
        note: `One vintage snapshot, ${span.count} observations from ${span.first} to ${span.last}. Header ${header.slice(0, 80)}. The graph file can be a short window rather than the series' full history. A replay needs a snapshot at every decision date.`,
      };
    }
    return { availability: 'reprint_only', note: `Header ${header.slice(0, 80)}. Last observation ${span.last ?? 'missing'}. Not accepted as a vintage.` };
  }
  if (probe.id === 'FRED-HY-CURRENT') {
    const span = observations(body);
    return {
      availability: 'reprint_only',
      note: `Current free FRED graph, ${span.count} observations from ${span.first} to ${span.last}. This is the file served now. It is not a historical vintage. The series page says that starting in April 2026 the series includes only 3 years of observations. Absence from this file is not proof the series has no longer history anywhere else.`,
    };
  }
  if (probe.id === 'TREASURY-YIELD-XML') {
    const dates = text.match(/BID_CURVE_DATE/g)?.length ?? 0;
    const whole = body.toString('utf8').match(/<BID_CURVE_DATE>/g)?.length ?? dates;
    return { availability: 'reprint_only', note: `Current Treasury yield file contains ${whole} curve dates and no vintage column.` };
  }
  if (probe.id === 'FISCAL-TGA') {
    const vintage = /vintage|realtime/i.test(text);
    return { availability: vintage ? 'point_in_time' : 'reprint_only', note: vintage ? 'Response mentions a vintage.' : 'Daily Treasury Statement rows have record_date and no vintage field.' };
  }
  if (probe.id === 'NYFED-RRP') {
    return { availability: 'reprint_only', note: 'Response is not an ALFRED vintage. Inspect before using it as a historical release.' };
  }
  if (probe.id === 'CFTC-2024-ZIP') {
    mkdirSync(CACHE, { recursive: true });
    const file = path.join(CACHE, 'deacot2024.zip');
    writeFileSync(file, body);
    const header = execFileSync('unzip', ['-p', file, 'annual.txt'], { maxBuffer: 2_000_000 }).toString('utf8').split('\n')[0] ?? '';
    const hasRelease = /release|publication/i.test(header);
    return {
      availability: 'publication_file',
      note: hasRelease
        ? 'The annual file has a release column.'
        : `Columns start: ${header.slice(0, 220)}. The as-of date is the report date, not a publication timestamp.`,
    };
  }
  return { availability: 'unavailable', note: 'Unclassified response. Not used.' };
}

function csvDates(body: Buffer): string[] {
  return body.toString('utf8').trim().split(/\n/).slice(1).map((line) => line.slice(0, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
}

async function one(probe: Probe): Promise<Row & { dates: string[] }> {
  const downloadedAt = new Date().toISOString();
  try {
    const { status, body } = await fetchBuf(probe.url);
    const judged = noteFor(probe, status, body);
    return {
      id: probe.id,
      role: probe.role,
      url: probe.url,
      kind: probe.kind,
      downloadedAt,
      httpStatus: status,
      bytes: body.length,
      sha256: body.length ? sha(body) : null,
      availability: judged.availability,
      note: judged.note,
      dates: probe.id === 'FRED-HY-CURRENT' && status === 200 ? csvDates(body) : [],
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return {
      id: probe.id,
      role: probe.role,
      url: probe.url,
      kind: probe.kind,
      downloadedAt,
      httpStatus: null,
      bytes: 0,
      sha256: null,
      availability: 'unavailable',
      note: probe.id === 'CFTC-2024-ZIP'
        ? 'This request failed before a body. The official history index lists yearly futures-only files, so a failed request is not proof the file is absent. Not used.'
        : timedOut ? 'Timed out before any body. Not used.' : 'Request failed before a body. Not used.',
      dates: [],
    };
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const fetched = await Promise.all(PROBES.map((probe) => one(probe)));
  const rows = fetched.map((row) => {
    const published = { ...row };
    delete (published as { dates?: string[] }).dates;
    return published;
  });
  const hy = fetched.find((row) => row.id === 'FRED-HY-CURRENT');
  const span = creditSpan(hy?.dates ?? []);
  const pointInTime = rows.filter((row) => row.availability === 'point_in_time').map((row) => row.id);
  const credit = {
    seriesId: 'BAMLH0A0HYM2',
    testedSource: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2',
    seriesPage: 'https://fred.stlouisfed.org/data/BAMLH0A0HYM2',
    pageNote: 'On 2026-11-07 the series page listed Date Range 2023-11-07 to 2026-11-05 and said: Starting in April 2026, this series will only include 3 years of observations. For more data, go to the source.',
    constraint: 'Observations before 2023-11-07 are unavailable from this tested free FRED source. That is not proof a longer free history is absent everywhere else.',
    rule: 'Credit is the daily OAS series. Its z-score window is 756 observations and its minimum is 252. The z-score is null before 252 observations. The 156-week window belongs to liquidity and positioning, not to credit.',
    failClosed: 'The composite is withheld until liquidity, policy, and credit each have a z-score. New risk stays off. This study does not drop credit or renormalise the remaining legs and then call the result the full strategy.',
    vintageCutoff: 'A public graph vintage is a calendar date and has no intraday time. A decision on date T may use the previous calendar day’s vintage. That is a conservative availability cutoff, not an exact release timestamp.',
    alfredApi: 'https://fred.stlouisfed.org/docs/api/fred/series_observations.html accepts vintage_dates as a comma-separated list. No FRED API key was supplied, so that batched call was not made. Single-date public graphs did return.',
    sha256: hy?.sha256 ?? null,
    ...span,
  };
  const results = {
    studyId: 'regime-validation-2026-11-07',
    ranAt: RAN_AT,
    command: 'npx tsx research/regime-validation/run-availability.ts',
    protocol: 'research/regime-validation/PROTOCOL.md',
    rulesVersion: 'regime-v2',
    ruleVersion: '2026-11-08.2',
    fullStrategy: 'not_validated',
    verdict: 'inconclusive',
    completedReplayDates: 0,
    reason: span.firstCreditZObservation
      ? `On the tested free FRED reprint, credit z-scores begin at observation ${span.firstCreditZObservation} (${span.creditZObservationCount} observations through ${span.lastObservation}). The full 756-observation window begins at ${span.firstFullWindowObservation} (${span.fullWindowObservationCount} observations). A previous-day vintage makes the earliest possible decision ${span.earliestDecisionDate} and the latest ${span.latestDecisionDate}. No vintage was fetched for each of those dates. Completed replay dates: 0. No portfolio return was calculated.`
      : 'The current free FRED high-yield graph did not return a usable observation list. Completed replay dates: 0. No portfolio return was calculated.',
    blocking: 'A full-strategy replay needs a previous-day vintage of WALCL, WTREGEN, RRPONTSYD, the policy rate, DGS2, and BAMLH0A0HYM2 on every decision date in that credit-valid span. Credit stays fail-closed. This run has single-date snapshots, not that panel.',
    hypotheses: [
      { id: 'H1', status: 'not_tested', because: 'The comparison was written into the protocol in this folder before this run. There is no external timestamped registration. The 2021–2026 price paths were already examined. The comparison was not run.' },
      { id: 'H2', status: 'not_tested', because: 'The macro-gate ablation was not run. It is not an out-of-sample registration.' },
    ],
    preExposure: 'Pull request 11 already published Yahoo price paths for SPY, GLD, GOLD.AX, and BTC-USD from 2021-11-06 through 2026-11-06. A later lookback over that period is not unseen. This study does not repeat those paths as a strategy result.',
    survivorship: 'A frozen-rule lookback can use today’s fixed universe. It does not need a historical membership tape or a theme-history tape. That hypothetical would still be a survivor set, and the price period above is pre-exposed. This run did not execute it.',
    metrics: null,
    taxes: 'excluded',
    currency: 'AUD',
    costBps: 10,
    cashYieldBps: 0,
    credit,
    cftc: {
      index: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm',
      releasePage: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm',
      file: 'https://www.cftc.gov/files/dea/history/deacot2024.zip',
      thisRun: rows.find((row) => row.id === 'CFTC-2024-ZIP')?.availability ?? 'unavailable',
      publication: 'The CFTC page says the COT report is generally published each Friday at 3:30 p.m. Eastern Time using the immediately preceding Tuesday, and that holidays can change the release. A report file is not an ALFRED vintage. This run did not retrieve the zip and did not observe a revision history.',
    },
    paperLog: {
      state: 'ledger_infrastructure',
      activated: false,
      operationalPaperNav: false,
      captures: 'After 002 is applied, a refresh can store rule version, checklist version, theme-config version, the snapshot timestamp, the session date, target weights, and the close, FX, and AUD reference for each line.',
      limits: 'The unique key keeps the first row for a rule version and session date and drops a later refresh the same day. A row is a target-weight record. It is not a filled order and it is not a historical backtest. The NAV code is tested with synthetic prices and has no production rows.',
      activation: 'Apply db/regime/002_paper_decisions.sql yourself after review. The app does not apply it and this change does not. Until the table exists, refresh still saves the snapshot and skips the log.',
    },
    rows,
    omitted: [
      'A previous-day vintage of the mandatory liquidity, policy, and credit series at every decision date from the earliest credit-valid day through the sample end.',
      'BAMLH0A0HYM2 observations before 2023-11-07 on the tested free FRED source.',
      'Batched ALFRED vintage_dates. No API key was supplied.',
      'CFTC files with the Friday 3:30 p.m. Eastern publication lag applied. This run did not download the yearly zip.',
      'Signal-health retirement, which needs completed forward windows and was not applied to a replay.',
    ],
    singleDateSnapshots: pointInTime,
  };
  writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify({ ranAt: RAN_AT, rows }, null, 2)}\n`);
  writeFileSync(path.join(OUT, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify({
    fullStrategy: results.fullStrategy,
    completedReplayDates: results.completedReplayDates,
    credit: {
      observationCount: credit.observationCount,
      firstCreditZObservation: credit.firstCreditZObservation,
      earliestDecisionDate: credit.earliestDecisionDate,
      firstFullWindowObservation: credit.firstFullWindowObservation,
      creditZObservationCount: credit.creditZObservationCount,
      fullWindowObservationCount: credit.fullWindowObservationCount,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'availability run failed');
  process.exit(1);
});
