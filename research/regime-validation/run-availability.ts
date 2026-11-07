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

async function one(probe: Probe): Promise<Row> {
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
      note: timedOut ? 'Timed out before any body. Not used.' : 'Request failed before a body. Not used.',
    };
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const rows = await Promise.all(PROBES.map((probe) => one(probe)));
  const pointInTime = rows.filter((row) => row.availability === 'point_in_time').map((row) => row.id);
  const results = {
    studyId: 'regime-validation-2026-11-07',
    ranAt: RAN_AT,
    command: 'npx tsx research/regime-validation/run-availability.ts',
    protocol: 'research/regime-validation/PROTOCOL.md',
    rulesVersion: 'regime-v2',
    ruleVersion: '2026-11-08.2',
    fullStrategy: 'not_validated',
    verdict: 'inconclusive',
    reason: pointInTime.length === 0
      ? 'No point-in-time vintage file was retrieved for the mandatory macro legs. The production rule was not replayed, and no portfolio return was calculated.'
      : `Single-date vintage snapshots came back for ${pointInTime.join(', ')}. Each file stops on or before its vintage date. That is not a snapshot at every decision date, and the mandatory set is still incomplete. The production rule was not replayed. No portfolio return was calculated.`,
    hypotheses: [
      { id: 'H1', status: 'not_tested', because: 'The pre-registered comparison needs a point-in-time replay. That replay was not run.' },
      { id: 'H2', status: 'not_tested', because: 'The macro-gate ablation is not reported without the same point-in-time path.' },
    ],
    preExposure: 'Pull request 11 already published Yahoo price paths for SPY, GLD, GOLD.AX, and BTC-USD from 2021-11-06 through 2026-11-06. Those paths are not an unseen sample. This study does not repeat them as a strategy result.',
    metrics: null,
    taxes: 'excluded',
    currency: 'AUD',
    costBps: 10,
    cashYieldBps: 0,
    rows,
    omitted: [
      'Historical universe membership. Today’s list would be a survivor set.',
      'Theme-rule history. Only the current config exists.',
      'Weekly parameter edits. No in-force log exists before this paper log.',
      'Signal-health retirement. It needs completed forward windows and was not applied to a replay.',
      'OECD CLI and semiconductor IP vintages beyond the ALFRED attempt above.',
      'Dividends as a separate ledger. Adjusted closes were not taken for a portfolio.',
    ],
  };
  if (pointInTime.length > 0) {
    results.fullStrategy = 'not_validated';
    results.verdict = 'inconclusive';
  }
  writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify({ ranAt: RAN_AT, rows }, null, 2)}\n`);
  writeFileSync(path.join(OUT, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify({ fullStrategy: results.fullStrategy, verdict: results.verdict, rows: rows.map((row) => ({ id: row.id, availability: row.availability, bytes: row.bytes, httpStatus: row.httpStatus })) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'availability run failed');
  process.exit(1);
});
