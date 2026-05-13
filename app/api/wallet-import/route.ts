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
  BONK:  "coingecko:bonk",
  JTO:   "coingecko:jito-governance-token",
  JUP:   "coingecko:jupiter-exchange-solana",
  PYTH:  "coingecko:pyth-network",
  RAY:   "coingecko:raydium",
  ORCA:  "coingecko:orca",
};

// Solana SPL token mint → symbol lookup
const SOLANA_TOKEN_MINTS: Record<string, string> = {
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "BONK",
  "jtojtomepa8beP8AuQc6eL9h5Ryei1WKZE8kNnzBHY": "JTO",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "JUP",
  "HZ1JovNiVvGrGs1X3bH58Mfv3mCfY6VeRHC1Uc5Dge": "PYTH",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "RAY",
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE": "ORCA",
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": "mSOL",
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": "stSOL",
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

// ─── Solana handler ───────────────────────────────────────────────────────────

interface SolanaTrade {
  id: string;
  date: string;
  type: string;
  asset: string;
  quantity: number;
  priceUsd: number;
  notes: string;
}

async function handleSolana(address: string): Promise<SolanaTrade[]> {
  const heliusKey = process.env.HELIUS_API_KEY;
  const trades: SolanaTrade[] = [];

  if (heliusKey) {
    // Use Helius enhanced transactions API (parsed, high quality)
    try {
      const res = await fetch(
        `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${heliusKey}&limit=100`,
        { signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) throw new Error(`Helius HTTP ${res.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txs: any[] = await res.json();

      for (const tx of txs) {
        if (tx.transactionError) continue;
        const ts: number = tx.timestamp || 0;
        const date = new Date(ts * 1000).toISOString().slice(0, 10);
        const sig: string = tx.signature || "";

        // Native SOL transfers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const nt of (tx.nativeTransfers || []) as any[]) {
          const lamports: number = nt.amount || 0;
          const qty = lamports / 1e9;
          if (qty < 0.0001) continue;
          const isIn: boolean = (nt.toUserAccount || "").toLowerCase() === address.toLowerCase();
          const price = await getHistoricalPrice("SOL", ts);
          trades.push({
            id: `${sig}-sol-${nt.fromUserAccount}-${nt.toUserAccount}`,
            date,
            type: isIn ? "buy" : "sell",
            asset: "SOL",
            quantity: parseFloat(qty.toFixed(6)),
            priceUsd: parseFloat(price.toFixed(4)),
            notes: `Solana · ${sig.slice(0, 10)}…`,
          });
        }

        // SPL token transfers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const tt of (tx.tokenTransfers || []) as any[]) {
          const mint: string = tt.mint || "";
          const symbol = SOLANA_TOKEN_MINTS[mint] || mint.slice(0, 6);
          const rawAmt: number = tt.tokenAmount || 0;
          if (rawAmt < 0.000001) continue;
          const isIn: boolean = (tt.toUserAccount || "").toLowerCase() === address.toLowerCase();
          const price = await getHistoricalPrice(symbol, ts);
          trades.push({
            id: `${sig}-spl-${mint}-${tt.fromUserAccount}-${tt.toUserAccount}`,
            date,
            type: isIn ? "buy" : "sell",
            asset: symbol,
            quantity: parseFloat(rawAmt.toFixed(6)),
            priceUsd: parseFloat(price.toFixed(4)),
            notes: `Solana SPL · ${sig.slice(0, 10)}…`,
          });
        }
      }
    } catch (e) {
      console.error("Helius error:", e);
      // Fall through to public RPC if Helius fails
    }

    return trades;
  }

  // Fallback: public Solana RPC (limited to 50 signatures due to rate limits)
  try {
    const sigRes = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress",
        params: [address, { limit: 50 }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const sigData = await sigRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sigs: any[] = sigData?.result || [];

    for (const sigInfo of sigs) {
      if (sigInfo.err) continue;
      const sig: string = sigInfo.signature;
      const blockTime: number = sigInfo.blockTime || 0;
      const date = new Date(blockTime * 1000).toISOString().slice(0, 10);

      try {
        const txRes = await fetch("https://api.mainnet-beta.solana.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "getTransaction",
            params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
          }),
          signal: AbortSignal.timeout(10000),
        });
        const txData = await txRes.json();
        const tx = txData?.result;
        if (!tx) continue;

        const meta = tx.meta;
        const accountKeys: string[] = (tx.transaction?.message?.accountKeys || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((k: any) => (typeof k === "string" ? k : k?.pubkey || ""));
        const myIndex = accountKeys.findIndex(
          (k: string) => k.toLowerCase() === address.toLowerCase()
        );

        // SOL balance changes
        if (myIndex >= 0 && meta?.preBalances && meta?.postBalances) {
          const solDelta = (meta.postBalances[myIndex] - meta.preBalances[myIndex]) / 1e9;
          // Ignore dust / fee-only changes
          if (Math.abs(solDelta) >= 0.001) {
            const price = await getHistoricalPrice("SOL", blockTime);
            trades.push({
              id: `${sig}-sol`,
              date,
              type: solDelta > 0 ? "buy" : "sell",
              asset: "SOL",
              quantity: parseFloat(Math.abs(solDelta).toFixed(6)),
              priceUsd: parseFloat(price.toFixed(4)),
              notes: `Solana · ${sig.slice(0, 10)}…`,
            });
          }
        }

        // SPL token balance changes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const preToken: any[] = meta?.preTokenBalances || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const postToken: any[] = meta?.postTokenBalances || [];

        for (const post of postToken) {
          if (post.owner !== address) continue;
          const pre = preToken.find(
            (p) => p.accountIndex === post.accountIndex && p.mint === post.mint
          );
          const preAmt = parseFloat(pre?.uiTokenAmount?.uiAmountString || "0");
          const postAmt = parseFloat(post.uiTokenAmount?.uiAmountString || "0");
          const delta = postAmt - preAmt;
          if (Math.abs(delta) < 0.000001) continue;

          const mint: string = post.mint;
          const symbol = SOLANA_TOKEN_MINTS[mint] || mint.slice(0, 6);
          const price = await getHistoricalPrice(symbol, blockTime);
          trades.push({
            id: `${sig}-spl-${mint}`,
            date,
            type: delta > 0 ? "buy" : "sell",
            asset: symbol,
            quantity: parseFloat(Math.abs(delta).toFixed(6)),
            priceUsd: parseFloat(price.toFixed(4)),
            notes: `Solana SPL · ${sig.slice(0, 10)}…`,
          });
        }
      } catch {
        // Skip individual tx errors
      }
    }
  } catch (e) {
    console.error("Solana RPC error:", e);
    return [];
  }

  return trades;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const addressRaw = searchParams.get("address");
  const network = searchParams.get("network") || "ethereum";

  if (!addressRaw) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  // Solana path — base58 address, no 0x prefix
  if (network === "solana") {
    const solAddress = addressRaw.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solAddress)) {
      return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
    }
    const trades = await handleSolana(solAddress);
    return NextResponse.json({ trades, count: trades.length });
  }

  // EVM path
  const address = addressRaw.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
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
