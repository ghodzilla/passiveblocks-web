export const AI_MEGACAP_CLUSTER = [
  'QQQ',
  'XLK',
  'XLC',
  'SMH',
  'NVDA',
  'MSFT',
  'AAPL',
  'AMZN',
  'GOOGL',
  'META',
  'AVGO',
  'TSLA',
  'VGS.AX',
  'BTC-USD',
  'ETH-USD',
  'SOL-USD',
] as const;

const CLUSTER = new Set<string>(AI_MEGACAP_CLUSTER);

/** Confirmed members of one overlap group cannot sum past this fraction of the book. */
export const OVERLAP_GROUP_CAP = 0.25;
export const PAIR_CORR_FLAG = 0.8;

export interface OverlapGroup {
  symbols: string[];
  combinedBefore: number;
  combinedAfter: number;
  reason: string;
}

export interface OverlapResult {
  weights: number[];
  groups: OverlapGroup[];
  gap: string | null;
}

interface Row {
  symbol: string;
  status: 'confirmed' | 'watch' | 'avoid';
  weight: number;
}

/**
 * Caps confirmed ideas that are the same AI/megacap exposure, or whose
 * trailing correlation is at least 0.80. SPY is not in the identity cluster.
 * When pairwise correlation cannot be computed the identity cap still applies.
 */
export function applyOverlapCaps(
  rows: Row[],
  pairCorr: { a: string; b: string; corr: number }[] | null,
): OverlapResult {
  const weights = rows.map((row) => (row.weight > 0 ? row.weight : 0));
  const parent = rows.map((_, index) => index);
  const find = (index: number): number => {
    let cursor = index;
    while (parent[cursor] !== cursor) cursor = parent[cursor];
    return cursor;
  };
  const unite = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };

  const confirmed = rows
    .map((row, index) => ({ row, index }))
    .filter((item) => item.row.status === 'confirmed');
  const indexOf = new Map<string, number>();
  for (const item of confirmed) indexOf.set(item.row.symbol, item.index);

  const clusterMembers = confirmed.filter((item) => CLUSTER.has(item.row.symbol));
  for (let i = 1; i < clusterMembers.length; i++) {
    unite(clusterMembers[0].index, clusterMembers[i].index);
  }

  const corrLinks = new Set<string>();
  if (pairCorr) {
    for (const pair of pairCorr) {
      if (pair.corr < PAIR_CORR_FLAG) continue;
      const left = indexOf.get(pair.a);
      const right = indexOf.get(pair.b);
      if (left == null || right == null) continue;
      unite(left, right);
      const lo = Math.min(left, right);
      const hi = Math.max(left, right);
      corrLinks.add(`${lo}|${hi}`);
    }
  }

  const buckets = new Map<number, number[]>();
  for (const item of confirmed) {
    const root = find(item.index);
    const list = buckets.get(root);
    if (list) list.push(item.index);
    else buckets.set(root, [item.index]);
  }

  const groups: OverlapGroup[] = [];
  for (const indexes of Array.from(buckets.values())) {
    if (indexes.length < 2) continue;
    const symbols = indexes.map((index) => rows[index].symbol).sort();
    const before = indexes.reduce((sum, index) => sum + weights[index], 0);
    let after = before;
    if (before > OVERLAP_GROUP_CAP && before > 0) {
      const factor = OVERLAP_GROUP_CAP / before;
      for (const index of indexes) weights[index] = Math.round(weights[index] * factor * 1e6) / 1e6;
      after = indexes.reduce((sum, index) => sum + weights[index], 0);
    }
    const inCluster = symbols.every((symbol) => CLUSTER.has(symbol));
    const anyCluster = symbols.some((symbol) => CLUSTER.has(symbol));
    let linkedByCorr = false;
    for (let a = 0; a < indexes.length; a++) {
      for (let b = a + 1; b < indexes.length; b++) {
        const lo = Math.min(indexes[a], indexes[b]);
        const hi = Math.max(indexes[a], indexes[b]);
        if (corrLinks.has(`${lo}|${hi}`)) linkedByCorr = true;
      }
    }
    const reason = inCluster
      ? 'Same AI/megacap or crypto exposure (QQQ, XLK, XLC, SMH, NVDA, MSFT, AAPL, AMZN, GOOGL, META, AVGO, TSLA, VGS.AX, BTC-USD, ETH-USD, SOL-USD). SPY is not in this group.'
      : anyCluster && linkedByCorr
        ? 'AI/megacap cluster and pairwise correlation at or above 0.80.'
        : `Pairwise correlation at or above ${PAIR_CORR_FLAG.toFixed(2)}.`;
    groups.push({
      symbols,
      combinedBefore: Math.round(before * 1e6) / 1e6,
      combinedAfter: Math.round(after * 1e6) / 1e6,
      reason,
    });
  }

  groups.sort((a, b) => (a.symbols[0] < b.symbols[0] ? -1 : a.symbols[0] > b.symbols[0] ? 1 : 0));

  const gap = pairCorr == null
    ? 'Pairwise correlation was unavailable, so overlap uses the AI/megacap identity list only. The group cap still applies.'
    : null;

  return { weights, groups, gap };
}
