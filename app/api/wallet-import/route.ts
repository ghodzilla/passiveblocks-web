import { NextRequest, NextResponse } from "next/server";

const EXPLORER_APIS: Record<string, { url: string; envKey: string }> = {
  ethereum: { url: "https://api.etherscan.io/api",              envKey: "ETHERSCAN_API_KEY"  },
  base:     { url: "https://api.basescan.org/api",              envKey: "ETHERSCAN_API_KEY"  },
  arbitrum: { url: "https://api.arbiscan.io/api",               envKey: "ETHERSCAN_API_KEY"  },
  optimism: { url: "https://api-optimistic.etherscan.io/api",   envKey: "ETHERSCAN_API_KEY"  },
  polygon:  { url: "https://api.polygonscan.com/api",           envKey: "ETHERSCAN_API_KEY"  },
};

// DeFiLlama token slug map (best-effort; unmapped tokens get price 0)
const TOKEN_SLUGS: Record<string, string> = {
  ETH:   "coingecko:ethereum",
  WETH:  "coingecko:weth",
  USDC:  "coingecko:usd-coin",
  USDT:  "coingecko:tether",
  DAI:   "coingecko:dai",
  WBTC:  "coingecko:wrapped-bitcoin",
  CBBTC: "coingecko:coinbase-wrapped-btc",
  SOL:   "coingecko:solana",
  ARB:   "coingecko:arbitrum",
  OP:    "coingecko:optimism",
  MATIC: "coingecko:matic-network",
  UNI:   "coingecko:uniswap",
  AAVE:  "coingecko:aave",
  LINK:  "coingecko:chainlink",
  stETH: "coingecko:staked-ether",
  wstETH:"coingecko:wrapped-steth",
  cbETH: "coingecko:coinbase-wrapped-staked-eth",
  rETH:  "coingecko:rocket-pool-eth",
};

async function getHistoricalPrice(symbol: string, timestamp: number): Promise<number> {
  const slug = TOKEN_SLUGS[symbol.toUpperCase()] || TOKEN_SLUGS[symbol];
  if (!slug) return 0;

  // Round to nearest hour
  const ts = Math.floor(timestamp / 3600) * 3600;

  try {
    const res = await fetch(
      `https://coins.llama.fi/prices/historical/${ts}/${slug}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.coins?.[slug]?.price ?? 0;
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.toLowerCase();
  const network = searchParams.get("network") || "ethereum";

  if (!address || !/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid EVM address" }, { status: 400 });
  }

  const explorer = EXPLORER_APIS[network];
  if (!explorer) {
    return NextResponse.json({ error: "Unsupported network" }, { status: 400 });
  }

  const apiKey = process.env[explorer.envKey];
  if (!apiKey) {
    return NextResponse.json(
      { error: "ETHERSCAN_API_KEY not configured. Add it to Vercel environment variables." },
      { status: 503 }
    );
  }

  // Fetch ERC-20 token transfers
  const erc20Url = `${explorer.url}?module=account&action=tokentx&address=${address}&sort=asc&apikey=${apiKey}`;
  // Fetch normal ETH transactions
  const ethUrl   = `${explorer.url}?module=account&action=txlist&address=${address}&sort=asc&apikey=${apiKey}`;

  const [erc20Res, ethRes] = await Promise.allSettled([
    fetch(erc20Url, { signal: AbortSignal.timeout(15000) }).then((r) => r.json()),
    fetch(ethUrl,   { signal: AbortSignal.timeout(15000) }).then((r) => r.json()),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const erc20Txs: any[] = erc20Res.status === "fulfilled" && erc20Res.value?.result ? erc20Res.value.result : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ethTxs:  any[] = ethRes.status  === "fulfilled" && ethRes.value?.result  ? ethRes.value.result  : [];

  // Collect unique (symbol, ts) pairs to batch price lookups
  const priceCache = new Map<string, number>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function cachedPrice(symbol: string, ts: number): Promise<number> {
    const rounded = Math.floor(ts / 3600) * 3600;
    const key = `${symbol}-${rounded}`;
    if (priceCache.has(key)) return priceCache.get(key)!;
    const price = await getHistoricalPrice(symbol, ts);
    priceCache.set(key, price);
    return price;
  }

  // Build trades from ERC-20 transfers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tradeTasks = erc20Txs.slice(0, 200).map(async (tx: any) => {
    const ts      = parseInt(tx.timeStamp);
    const symbol  = tx.tokenSymbol?.toUpperCase() || "???";
    const decimals= parseInt(tx.tokenDecimal) || 18;
    const qty     = parseFloat(tx.value) / Math.pow(10, decimals);
    if (qty < 0.000001) return null;

    const price   = await cachedPrice(symbol, ts);
    const isIn    = tx.to.toLowerCase() === address;
    const date    = new Date(ts * 1000).toISOString().slice(0, 10);

    return {
      id:       tx.hash + "-" + tx.logIndex,
      date,
      type:     isIn ? "buy" : "sell",
      asset:    symbol,
      quantity: parseFloat(qty.toFixed(6)),
      priceUsd: parseFloat(price.toFixed(4)),
      notes:    `${network} · tx ${tx.hash.slice(0, 10)}…`,
    };
  });

  // Build trades from ETH transfers (value > 0, not failed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ethTradeTasks = ethTxs.filter((tx: any) => tx.value !== "0" && tx.isError === "0").slice(0, 100).map(async (tx: any) => {
    const ts   = parseInt(tx.timeStamp);
    const qty  = parseFloat(tx.value) / 1e18;
    if (qty < 0.0001) return null;

    const price = await cachedPrice("ETH", ts);
    const isIn  = tx.to?.toLowerCase() === address;
    const date  = new Date(ts * 1000).toISOString().slice(0, 10);

    return {
      id:       tx.hash + "-eth",
      date,
      type:     isIn ? "buy" : "sell",
      asset:    "ETH",
      quantity: parseFloat(qty.toFixed(6)),
      priceUsd: parseFloat(price.toFixed(4)),
      notes:    `${network} · tx ${tx.hash.slice(0, 10)}…`,
    };
  });

  const allResults = await Promise.all([...tradeTasks, ...ethTradeTasks]);
  const trades = allResults.filter(Boolean);

  return NextResponse.json({ trades, count: trades.length });
}
