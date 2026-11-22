import { fetchYahooBars } from './prices';

export interface ClosePoint {
  date: string;
  close: number;
}

/**
 * QQQ, SPY, and IEF for the paper comparison.
 * Loaded on their own so the page does not rebuild the retired regime book to borrow its price list.
 */
export async function loadBenchmarkCloses(timeoutMs = 12_000): Promise<{
  qqq: ClosePoint[];
  spy: ClosePoint[];
  bonds: ClosePoint[];
  missing: string[];
}> {
  const symbols = ['QQQ', 'SPY', 'IEF'] as const;
  const pending = Promise.all(symbols.map(async (symbol) => {
    try {
      const fetched = await fetchYahooBars(symbol);
      const bars = fetched.error
        ? []
        : fetched.bars.filter((bar) => bar.close > 0).map((bar) => ({ date: bar.date, close: bar.close }));
      return { symbol, bars, missing: bars.length === 0 };
    } catch {
      return { symbol, bars: [] as ClosePoint[], missing: true };
    }
  }));
  const rows = await Promise.race([
    pending,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
  if (!rows) {
    return { qqq: [], spy: [], bonds: [], missing: [...symbols] };
  }
  const by = new Map(rows.map((row) => [row.symbol, row]));
  return {
    qqq: by.get('QQQ')?.bars ?? [],
    spy: by.get('SPY')?.bars ?? [],
    bonds: by.get('IEF')?.bars ?? [],
    missing: rows.filter((row) => row.missing).map((row) => row.symbol),
  };
}
