import { writeFileSync } from 'node:fs';
import { DRUCK_CASH_SYMBOL, DRUCK_SPY } from './druck.config';
import { fetchFredCsv } from './fredCsv';
import { FX_SYMBOL } from './fx';
import { fetchYahooBars } from './prices';
import { laggedNetLiquidity, SHADOW_SYMBOLS, walkShadow, type ShadowBundle, type ShadowReport } from './druckShadow';
import type { CloseBar } from './visser';

async function prices(): Promise<Record<string, CloseBar[]>> {
  const out: Record<string, CloseBar[]> = {};
  for (const symbol of SHADOW_SYMBOLS) {
    const fetched = await fetchYahooBars(symbol, 'max', 1_293_840_000);
    out[symbol] = fetched.bars.map((bar) => ({ date: bar.date, close: bar.close }));
    if ((symbol === DRUCK_SPY || symbol === DRUCK_CASH_SYMBOL || symbol === FX_SYMBOL || symbol === 'QQQ' || symbol === 'IEF') && out[symbol].length === 0) {
      throw new Error(fetched.error ?? `${symbol} did not arrive.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return out;
}

/** Download the public series and write the saved backtest. Does not touch the database or Vercel. */
export async function runAndWrite(file = 'lib/regime/druckShadowResults.json'): Promise<ShadowReport> {
  const computedAt = new Date().toISOString();
  try {
    const [bars, hy, dgs10, dgs2, walcl, tga, rrp] = await Promise.all([
      prices(),
      fetchFredCsv('BAMLH0A0HYM2'),
      fetchFredCsv('DGS10'),
      fetchFredCsv('DGS2'),
      fetchFredCsv('WALCL'),
      fetchFredCsv('WTREGEN'),
      fetchFredCsv('RRPONTSYD'),
    ]);
    const bundle: ShadowBundle = {
      prices: bars,
      hy,
      dgs10,
      dgs2,
      dollar: bars['DX-Y.NYB'] ?? [],
      netLiquidity: laggedNetLiquidity(walcl, tga, rrp),
    };
    const report = walkShadow(bundle, computedAt);
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    const report: ShadowReport = {
      ok: false,
      computedAt,
      firstDate: null,
      lastDate: null,
      skippedWeeks: 0,
      note: error instanceof Error ? error.message : 'The backtest did not finish.',
      rows: [],
    };
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  }
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('druckShadowRun.ts')) {
  runAndWrite()
    .then((report) => {
      console.log(JSON.stringify({
        ok: report.ok,
        note: report.note,
        firstDate: report.firstDate,
        lastDate: report.lastDate,
        skippedWeeks: report.skippedWeeks,
        rows: report.rows,
      }));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : 'The backtest did not finish.');
      process.exit(1);
    });
}
