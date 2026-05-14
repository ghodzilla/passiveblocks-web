import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';

export const runtime = 'nodejs';

// ─── Etherscan V2 API (single endpoint, chainid param) ───────────────────────
const ETHERSCAN_V2_URL = 'https://api.etherscan.io/v2/api';
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base:     8453,
  arbitrum: 42161,
  optimism: 10,
  polygon:  137,
};

// DeFiLlama coin IDs for major tokens
const DEFI_LLAMA_IDS: Record<string, string> = {
  'ETH':    'coingecko:ethereum',
  'WETH':   'coingecko:weth',
  'USDC':   'coingecko:usd-coin',
  'USDT':   'coingecko:tether',
  'WBTC':   'coingecko:wrapped-bitcoin',
  'stETH':  'coingecko:staked-ether',
  'cbETH':  'coingecko:coinbase-wrapped-staked-eth',
  'wstETH': 'coingecko:wrapped-steth',
};

// ─── Price cache ──────────────────────────────────────────────────────────────
const priceCache = new Map<string, { price: number; fetchedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PRICE_CACHE_FILE = '/tmp/pb-tax-price-cache.json';

function loadFileCache() {
  try {
    if (existsSync(PRICE_CACHE_FILE)) {
      const raw = JSON.parse(readFileSync(PRICE_CACHE_FILE, 'utf8')) as Record<string, { price: number; fetchedAt: number }>;
      const now = Date.now();
      for (const [key, entry] of Object.entries(raw)) {
        if (now - entry.fetchedAt < CACHE_TTL_MS) priceCache.set(key, entry);
      }
    }
  } catch { /* ignore */ }
}

function saveFileCache() {
  try {
    const obj: Record<string, { price: number; fetchedAt: number }> = {};
    for (const [key, entry] of Array.from(priceCache.entries())) obj[key] = entry;
    writeFileSync(PRICE_CACHE_FILE, JSON.stringify(obj), 'utf8');
  } catch { /* non-fatal */ }
}

loadFileCache();

async function fetchHistoricalPrices(
  timestamps: number[],
  coinId: string = 'coingecko:ethereum',
): Promise<Record<number, number>> {
  const dayTimestamps = Array.from(new Set(timestamps.map(t => Math.floor(t / 86400) * 86400)));
  const toFetch = dayTimestamps.filter(dayTs => {
    const cached = priceCache.get(`${coinId}:${dayTs}`);
    return !cached || Date.now() - cached.fetchedAt >= CACHE_TTL_MS;
  });

  if (toFetch.length > 0) {
    for (let i = 0; i < toFetch.length; i += 100) {
      const batch = toFetch.slice(i, i + 100);
      try {
        const res = await fetch('https://coins.llama.fi/batchHistorical', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coins: { [coinId]: { timestamps: batch } } }),
        });
        if (!res.ok) throw new Error(`DeFiLlama HTTP ${res.status}`);
        const data = await res.json() as { coins: Record<string, { prices: { timestamp: number; price: number }[] }> };
        const prices = data?.coins?.[coinId]?.prices || [];
        const now = Date.now();
        for (const p of prices) {
          const dayKey = Math.floor(p.timestamp / 86400) * 86400;
          priceCache.set(`${coinId}:${dayKey}`, { price: p.price, fetchedAt: now });
        }
      } catch {
        for (const ts of batch) {
          try {
            const r = await fetch(`https://coins.llama.fi/prices/historical/${ts}/${coinId}`);
            const d = await r.json() as { coins: Record<string, { price: number }> };
            const price = d?.coins?.[coinId]?.price;
            if (price) {
              const dayKey = Math.floor(ts / 86400) * 86400;
              priceCache.set(`${coinId}:${dayKey}`, { price, fetchedAt: Date.now() });
            }
          } catch { /* individual fallback failed */ }
        }
      }
    }
    saveFileCache();
  }

  const result: Record<number, number> = {};
  for (const dayTs of dayTimestamps) {
    const entry = priceCache.get(`${coinId}:${dayTs}`);
    if (entry) result[dayTs] = entry.price;
  }
  return result;
}

function getPriceAtTimestamp(
  priceMap: Record<number, number>,
  timestamp: number,
  fallbackPrice: number,
): number {
  const dayKey = Math.floor(timestamp / 86400) * 86400;
  return priceMap[dayKey] ?? priceMap[dayKey - 86400] ?? priceMap[dayKey + 86400] ?? fallbackPrice;
}

// ─── Etherscan fetchers ───────────────────────────────────────────────────────

interface EthTx {
  timestamp: number;
  value: number;
  from: string;
  to: string;
  type: 'in' | 'out';
  isStakingReward: boolean;
  chain: string;
  hash?: string;
}

interface TokenTx {
  timestamp: number;
  value: number;
  asset: string;
  from: string;
  to: string;
  type: 'in' | 'out';
  chain: string;
}

type EtherscanResponse = { status: string; message: string; result: unknown };

async function fetchEtherscanChain(
  chain: string,
  address: string,
  apiKey: string,
): Promise<{ ethTxs: EthTx[]; tokenTxs: TokenTx[]; apiError?: string }> {
  const chainId = CHAIN_IDS[chain];
  if (!chainId) return { ethTxs: [], tokenTxs: [] };

  if (!apiKey) return { ethTxs: [], tokenTxs: [], apiError: 'ETHERSCAN_API_KEY not configured' };

  const addrLower = address.toLowerCase();
  const base = `${ETHERSCAN_V2_URL}?chainid=${chainId}&module=account&address=${address}&startblock=0&endblock=99999999&sort=asc`;
  const headers = { 'Authorization': `Bearer ${apiKey}` };

  const [txRes, tokenRes] = await Promise.allSettled([
    fetch(`${base}&action=txlist`, { headers, signal: AbortSignal.timeout(10000) }),
    fetch(`${base}&action=tokentx`, { headers, signal: AbortSignal.timeout(10000) }),
  ]);

  const ethTxs: EthTx[] = [];
  const tokenTxs: TokenTx[] = [];
  let apiError: string | undefined;

  if (txRes.status === 'fulfilled' && txRes.value.ok) {
    const data = await txRes.value.json() as EtherscanResponse;
    if (data.status === '0' && data.message === 'NOTOK') {
      apiError = String(data.result).slice(0, 120);
    } else if (Array.isArray(data.result)) {
      for (const tx of data.result as Array<{ isError: string; timeStamp: string; value: string; from: string; to: string; hash: string }>) {
        if (tx.isError === '1') continue;
        ethTxs.push({
          timestamp: parseInt(tx.timeStamp),
          value: parseFloat(tx.value) / 1e18,
          from: tx.from,
          to: tx.to,
          type: tx.to?.toLowerCase() === addrLower ? 'in' : 'out',
          isStakingReward: false,
          chain,
          hash: tx.hash,
        });
      }
    }
  }

  if (tokenRes.status === 'fulfilled' && tokenRes.value.ok) {
    const data = await tokenRes.value.json() as EtherscanResponse;
    if (Array.isArray(data.result)) {
      for (const t of data.result as Array<{ timeStamp: string; value: string; tokenSymbol: string; from: string; to: string; tokenDecimal: string }>) {
        tokenTxs.push({
          timestamp: parseInt(t.timeStamp),
          value: parseFloat(t.value) / Math.pow(10, parseInt(t.tokenDecimal) || 18),
          asset: t.tokenSymbol || '',
          from: t.from,
          to: t.to,
          type: t.to?.toLowerCase() === addrLower ? 'in' : 'out',
          chain,
        });
      }
    }
  }

  return { ethTxs, tokenTxs, apiError };
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const startTs = parseInt(searchParams.get('startTs') || '0');
  const endTs = parseInt(searchParams.get('endTs') || String(Math.floor(Date.now() / 1000)));
  const chainsParam = searchParams.get('chains');
  const chainsToScan = chainsParam
    ? chainsParam.split(',').map(c => c.trim()).filter(c => CHAIN_IDS[c]).slice(0, 3)
    : ['ethereum'];

  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid EVM address' }, { status: 400 });
  }

  const apiKey = process.env.ETHERSCAN_API_KEY || '';
  const addrLower = address.toLowerCase();

  if (!apiKey) {
    return NextResponse.json({
      error: 'Etherscan API key not configured. Set ETHERSCAN_API_KEY in Vercel environment variables.',
    }, { status: 503 });
  }

  try {
    // 1. Fetch all chains in parallel
    const chainResults = await Promise.allSettled(
      chainsToScan.map(chain => fetchEtherscanChain(chain, address, apiKey))
    );

    let allEthTxs: EthTx[] = [];
    let allTokenTxs: TokenTx[] = [];
    const txsPerChain: Record<string, number> = {};
    const apiErrors: string[] = [];

    for (let i = 0; i < chainResults.length; i++) {
      const result = chainResults[i];
      const chainName = chainsToScan[i];
      if (result.status === 'fulfilled') {
        const { ethTxs, tokenTxs, apiError } = result.value;
        if (apiError) apiErrors.push(`${chainName}: ${apiError}`);
        txsPerChain[chainName] = ethTxs.length + tokenTxs.length;
        allEthTxs.push(...ethTxs);
        allTokenTxs.push(...tokenTxs);
      }
    }

    if (apiErrors.length > 0 && allEthTxs.length === 0 && allTokenTxs.length === 0) {
      return NextResponse.json({ error: `Etherscan API error: ${apiErrors[0]}` }, { status: 502 });
    }

    allEthTxs.sort((a, b) => a.timestamp - b.timestamp);
    allTokenTxs.sort((a, b) => a.timestamp - b.timestamp);

    // 2. Filter by date range
    if (startTs > 0 || endTs < Math.floor(Date.now() / 1000)) {
      allEthTxs = allEthTxs.filter(tx => tx.timestamp >= startTs && tx.timestamp <= endTs);
      allTokenTxs = allTokenTxs.filter(tx => tx.timestamp >= startTs && tx.timestamp <= endTs);
    }

    // 3. Get current ETH price
    let currentEthPrice = 3000;
    try {
      const priceRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        { signal: AbortSignal.timeout(5000) }
      );
      const priceData = await priceRes.json() as { ethereum?: { usd: number } };
      if (priceData?.ethereum?.usd) currentEthPrice = priceData.ethereum.usd;
    } catch { /* use fallback */ }

    // 4. Fetch historical ETH prices for all txs with value
    const ethTxsWithValue = allEthTxs.filter(tx => tx.value > 0);
    const allTimestamps = ethTxsWithValue.map(tx => tx.timestamp);
    const priceMap = allTimestamps.length > 0
      ? await fetchHistoricalPrices(allTimestamps, 'coingecko:ethereum')
      : {};

    // 5. Fetch token prices
    const tokenPriceMaps: Record<string, Record<number, number>> = {};
    for (const [symbol, llamaId] of Object.entries(DEFI_LLAMA_IDS)) {
      if (symbol === 'ETH') continue;
      const relevantTxs = allTokenTxs.filter(t => t.asset?.toUpperCase() === symbol && t.value > 0);
      if (relevantTxs.length > 0) {
        try {
          tokenPriceMaps[symbol] = await fetchHistoricalPrices(
            relevantTxs.map(t => t.timestamp),
            llamaId
          );
        } catch {
          tokenPriceMaps[symbol] = {};
        }
      }
    }

    // 6. ETH FIFO cost-basis calculation
    let shortTermGains = 0;
    let longTermGains = 0;
    let stakingEthUsd = 0;

    const costBasisQueue: Array<{ ethAmount: number; costBasisUsd: number; timestamp: number }> = [];

    for (const tx of ethTxsWithValue) {
      const ethValue = tx.value;
      const historicalPrice = getPriceAtTimestamp(priceMap, tx.timestamp, currentEthPrice);

      if (tx.to?.toLowerCase() === addrLower) {
        // Received
        const costBasisUsd = ethValue * historicalPrice;
        if (tx.isStakingReward) stakingEthUsd += costBasisUsd;
        costBasisQueue.push({ ethAmount: ethValue, costBasisUsd, timestamp: tx.timestamp });
      }

      if (tx.from?.toLowerCase() === addrLower) {
        // Sent — realise gains via FIFO
        const salePrice = historicalPrice;
        let remaining = ethValue;

        while (remaining > 0 && costBasisQueue.length > 0) {
          const lot = costBasisQueue[0];
          const heldDays = (tx.timestamp - lot.timestamp) / 86400;
          let lotCostUsed: number;
          let lotEthUsed: number;

          if (lot.ethAmount <= remaining) {
            lotCostUsed = lot.costBasisUsd;
            lotEthUsed = lot.ethAmount;
            remaining -= lot.ethAmount;
            costBasisQueue.shift();
          } else {
            const fraction = remaining / lot.ethAmount;
            lotCostUsed = lot.costBasisUsd * fraction;
            lotEthUsed = remaining;
            lot.ethAmount -= remaining;
            lot.costBasisUsd *= (1 - fraction);
            remaining = 0;
          }

          const lotSaleValue = lotEthUsed * salePrice;
          const gain = lotSaleValue - lotCostUsed;
          if (heldDays >= 365) longTermGains += gain;
          else shortTermGains += gain;
        }
      }
    }

    // 7. Token gains (FIFO per symbol)
    let tokenShortTermGains = 0;
    let tokenLongTermGains = 0;

    const tokenSymbols = Array.from(new Set(allTokenTxs.map(t => t.asset?.toUpperCase()).filter((s): s is string => !!s)));

    for (const symbol of tokenSymbols) {
      const llamaId = DEFI_LLAMA_IDS[symbol];
      if (!llamaId) continue;

      const priceMapToken = tokenPriceMaps[symbol] || {};
      const symbolTxs = allTokenTxs
        .filter(t => t.asset?.toUpperCase() === symbol && t.value > 0)
        .sort((a, b) => a.timestamp - b.timestamp);

      const tokenQueue: Array<{ amount: number; costBasisUsd: number; timestamp: number }> = [];

      for (const tx of symbolTxs) {
        const amount = tx.value;
        const fallbackPrice = (symbol === 'USDC' || symbol === 'USDT') ? 1.0 : currentEthPrice;
        const historicalPrice = getPriceAtTimestamp(priceMapToken, tx.timestamp, fallbackPrice);

        if (tx.to?.toLowerCase() === addrLower) {
          tokenQueue.push({ amount, costBasisUsd: amount * historicalPrice, timestamp: tx.timestamp });
        }

        if (tx.from?.toLowerCase() === addrLower) {
          let remaining = amount;
          const salePrice = historicalPrice;

          while (remaining > 0 && tokenQueue.length > 0) {
            const lot = tokenQueue[0];
            const heldDays = (tx.timestamp - lot.timestamp) / 86400;
            let lotCostUsed: number;
            let lotAmountUsed: number;

            if (lot.amount <= remaining) {
              lotCostUsed = lot.costBasisUsd;
              lotAmountUsed = lot.amount;
              remaining -= lot.amount;
              tokenQueue.shift();
            } else {
              const fraction = remaining / lot.amount;
              lotCostUsed = lot.costBasisUsd * fraction;
              lotAmountUsed = remaining;
              lot.amount -= remaining;
              lot.costBasisUsd *= (1 - fraction);
              remaining = 0;
            }

            const lotSaleValue = lotAmountUsed * salePrice;
            const gain = lotSaleValue - lotCostUsed;
            if (heldDays >= 365) tokenLongTermGains += gain;
            else tokenShortTermGains += gain;
          }
        }
      }
    }

    const totalGains = shortTermGains + longTermGains + tokenShortTermGains + tokenLongTermGains;

    // 8. Build transaction list
    const transactions = [...allEthTxs, ...allTokenTxs]
      .filter(tx => tx.timestamp > 0)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 200)
      .map(tx => ({
        hash: (tx as EthTx).hash || null,
        date: new Date(tx.timestamp * 1000).toISOString(),
        type: (tx as EthTx).isStakingReward ? 'Staking Reward'
          : (tx as TokenTx).asset && (tx as TokenTx).asset !== 'ETH' ? 'Token Transfer'
          : tx.type === 'in' ? 'ETH Received'
          : 'ETH Sent',
        asset: (tx as TokenTx).asset || 'ETH',
        amount: parseFloat(((tx as EthTx).value ?? (tx as TokenTx).value ?? 0).toFixed(6)),
        from: tx.from || '',
        to: tx.to || '',
        isStakingReward: (tx as EthTx).isStakingReward || false,
        chain: tx.chain || 'ethereum',
      }));

    return NextResponse.json({
      address,
      chains: chainsToScan,
      txCount: allEthTxs.length,
      tokenTxCount: allTokenTxs.length,
      shortTermGains: Math.round(shortTermGains + tokenShortTermGains),
      longTermGains: Math.round(longTermGains + tokenLongTermGains),
      totalGains: Math.round(totalGains),
      stakingIncome: {
        totalUsd: Math.round(stakingEthUsd),
        ethRewards: 0,
        minipoolAccruedEth: 0,
        minipoolAccruedUsd: 0,
        minipoolCount: 0,
      },
      transactions,
      ethPrice: currentEthPrice,
      dataSource: 'etherscan',
      fetchedAt: new Date().toISOString(),
      debug: { chainsScanned: chainsToScan, txsPerChain, dataSource: 'etherscan' },
    });

  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
