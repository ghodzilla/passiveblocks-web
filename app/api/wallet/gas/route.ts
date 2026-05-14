import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GET /api/wallet/gas?address=0x...&year=2025
// Returns total gas spent (USD) for a wallet across Base + Arbitrum for a given tax year.
// Gas fees are deductible as cost basis additions in AU, US, and UK.

const ETHERSCAN_V2_URL = 'https://api.etherscan.io/v2/api';
const CHAIN_IDS: Record<string, number> = {
  base:     8453,
  arbitrum: 42161,
  ethereum: 1,
};

async function getEthPrice(): Promise<number> {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    const d = await r.json() as { ethereum?: { usd: number } };
    return d?.ethereum?.usd || 2000;
  } catch {
    return 2000;
  }
}

interface EtherscanTx {
  hash: string;
  gasUsed: string;
  gasPrice: string;
  timeStamp: string;
  isError: string;
}

async function getGasSpentEtherscan(
  chain: string,
  address: string,
  apiKey: string,
  startTs: number,
  endTs: number,
  ethPrice: number,
): Promise<{ gasEth: number; gasUsd: number; apiError?: string }> {
  const chainId = CHAIN_IDS[chain];
  if (!chainId) return { gasEth: 0, gasUsd: 0 };
  try {
    const res = await fetch(
      `${ETHERSCAN_V2_URL}?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc`,
      { headers: { 'Authorization': `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return { gasEth: 0, gasUsd: 0 };
    const data = await res.json() as { status: string; message: string; result: unknown };
    if (data.status === '0' && data.message === 'NOTOK') {
      return { gasEth: 0, gasUsd: 0, apiError: String(data.result).slice(0, 100) };
    }
    const txs = Array.isArray(data.result) ? data.result as EtherscanTx[] : [];

    let totalGasWei = BigInt(0);
    for (const tx of txs) {
      if (tx.isError === '1') continue;
      const ts = parseInt(tx.timeStamp);
      if (ts < startTs || ts > endTs) continue;
      const gasUsed = BigInt(tx.gasUsed || '0');
      const gasPrice = BigInt(tx.gasPrice || '0');
      totalGasWei += gasUsed * gasPrice;
    }

    const gasEth = Number(totalGasWei) / 1e18;
    return {
      gasEth: parseFloat(gasEth.toFixed(8)),
      gasUsd: parseFloat((gasEth * ethPrice).toFixed(4)),
    };
  } catch {
    return { gasEth: 0, gasUsd: 0 };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Valid EVM address required' }, { status: 400 });
  }

  const apiKey = process.env.ETHERSCAN_API_KEY || '';

  if (!apiKey) {
    return NextResponse.json({ error: 'ETHERSCAN_API_KEY not configured' }, { status: 503 });
  }

  // Tax year timestamps (calendar year — adjust for FY if needed)
  const startTs = Math.floor(new Date(`${year}-01-01T00:00:00Z`).getTime() / 1000);
  const endTs   = Math.floor(new Date(`${year}-12-31T23:59:59Z`).getTime() / 1000);

  const ethPrice = await getEthPrice();

  const chains = ['base', 'arbitrum', 'ethereum'];
  const results = await Promise.all(
    chains.map(async (chain) => {
      const { gasEth, gasUsd } = await getGasSpentEtherscan(chain, address, apiKey, startTs, endTs, ethPrice);
      return { chain, gasEth, gasUsd };
    })
  );

  const totalGasEth = results.reduce((s, r) => s + r.gasEth, 0);
  const totalGasUsd = results.reduce((s, r) => s + r.gasUsd, 0);

  return NextResponse.json({
    address,
    year,
    totalGasEth: parseFloat(totalGasEth.toFixed(8)),
    totalGasUsd: parseFloat(totalGasUsd.toFixed(4)),
    gasDeductionsUsd: parseFloat(totalGasUsd.toFixed(4)),
    ethPriceUsd: ethPrice,
    chains: results,
    note: 'Gas fees are deductible as cost basis additions in AU, US, and UK. Consult a tax professional.',
    fetchedAt: new Date().toISOString(),
  });
}
