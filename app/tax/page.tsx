"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConnectedWallet {
  address: string;
  network: string;
  label?: string;
  chains?: { activeChains?: string[] };
}

interface TaxData {
  shortTermGains: number;
  longTermGains: number;
  totalGains: number;
  txCount: number;
  tokenTxCount?: number;
  stakingIncome: {
    totalUsd: number;
    ethRewards?: number;
    minipoolAccruedEth?: number;
    minipoolAccruedUsd?: number;
  };
  transactions?: TxRecord[];
  fetchedAt: string;
  dataSource?: string;
  debug?: { chainsScanned?: string[]; txsPerChain?: Record<string, number>; dataSource?: string };
}

interface TxRecord {
  hash?: string;
  date: string;
  type: string;
  asset: string;
  amount: number;
  from: string;
  to: string;
  isStakingReward?: boolean;
  chain?: string;
  priceUsd?: number;
  valueUsd?: number;
  costBasis?: number;
  gainLoss?: number;
}

interface CombinedTax {
  shortTermGains: number;
  longTermGains: number;
  totalGains: number;
  stakingIncomeUsd: number;
  totalTxCount: number;
  walletsIncluded: number;
}

interface GasData {
  totalGasEth: number;
  totalGasUsd: number;
  gasDeductionsUsd?: number;
  fetchedAt?: string;
}

interface HoldingPeriod {
  asset: string;
  protocol?: string;
  chain?: string;
  acquiredDate: string;
  daysHeld: number;
  daysToThreshold: number;
  value: string;
  apy?: number;
  qualified: boolean;
  potentialSaving: string | null;
  demo?: boolean;
}

interface HarvestOpp {
  asset: string;
  position: string;
  unrealisedLoss: number;
  recommendation: string;
  demo?: boolean;
}

interface YieldIncome {
  totalEarnedUsd: number;
  dailyRateUsd: number;
  positionCount: number;
  holdingPeriods?: HoldingPeriod[];
  harvestOpportunities?: HarvestOpp[];
}

// ─── Country config ───────────────────────────────────────────────────────────

const TAX_YEAR_CONFIG: Record<string, { startMonth: number; startDay: number; format: string }> = {
  AU: { startMonth: 7,  startDay: 1, format: 'FY{start}-{end}' },
  NZ: { startMonth: 4,  startDay: 1, format: 'FY{start}-{end}' },
  IN: { startMonth: 4,  startDay: 1, format: 'FY{start}-{end}' },
  JP: { startMonth: 4,  startDay: 1, format: 'FY{start}-{end}' },
  GB: { startMonth: 4,  startDay: 6, format: 'FY{start}/{end}' },
  US: { startMonth: 1,  startDay: 1, format: '{end}' },
  CA: { startMonth: 1,  startDay: 1, format: '{end}' },
  DE: { startMonth: 1,  startDay: 1, format: '{end}' },
  SG: { startMonth: 1,  startDay: 1, format: '{end}' },
  AE: { startMonth: 1,  startDay: 1, format: '{end}' },
};

interface TaxYear {
  label: string;
  startTs: number;
  endTs: number;
}

function getTaxYears(countryCode: string): TaxYear[] {
  const config = TAX_YEAR_CONFIG[countryCode] || TAX_YEAR_CONFIG.US;
  const { startMonth, startDay } = config;
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1;
  const curDay = now.getUTCDate();
  const fyStartedThisYear = curMonth > startMonth || (curMonth === startMonth && curDay >= startDay);
  const currentFyStartYear = fyStartedThisYear ? curYear : curYear - 1;
  const calendarYear = startMonth === 1;
  const years: TaxYear[] = [];
  for (let i = 0; i < 5; i++) {
    const fyStartYear = currentFyStartYear - i;
    const startTs = Math.floor(Date.UTC(fyStartYear, startMonth - 1, startDay) / 1000);
    const endTs = Math.floor(Date.UTC(fyStartYear + 1, startMonth - 1, startDay) / 1000) - 1;
    const endYearFull = fyStartYear + (calendarYear ? 0 : 1);
    const endToken = calendarYear ? String(endYearFull) : String(endYearFull).slice(-2);
    const label = config.format.replace('{start}', String(fyStartYear)).replace('{end}', endToken);
    years.push({ label, startTs, endTs });
  }
  return years;
}

function formatDateShort(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

interface Country {
  code: string;
  flag: string;
  name: string;
  note: string;
  rate: number;
  currency: string;
  cgtDiscount?: number;
  ltcgRate?: number;
  cgtAllowance?: number;
  cgtInclusion?: number;
  longTermExempt?: boolean;
  taxFree?: boolean;
}

const TAX_COUNTRIES: Country[] = [
  { code: 'AU', flag: '🇦🇺', name: 'Australia',     note: '50% CGT discount >12mo',              rate: 0.325,   cgtDiscount: 0.50, currency: 'AUD' },
  { code: 'US', flag: '🇺🇸', name: 'United States', note: 'Short-term = ordinary income',        rate: 0.24,    ltcgRate: 0.15,    currency: 'USD' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom',note: '£3k CGT allowance',                   rate: 0.20,    cgtAllowance: 3000,currency: 'GBP' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada',         note: '50% CGT inclusion rate',             rate: 0.2653,  cgtInclusion: 0.50,currency: 'CAD' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany',        note: 'Tax-free after 12 months',           rate: 0.26375, longTermExempt: true,currency: 'EUR' },
  { code: 'JP', flag: '🇯🇵', name: 'Japan',          note: 'Misc. income up to 55%',             rate: 0.55,    currency: 'JPY' },
  { code: 'SG', flag: '🇸🇬', name: 'Singapore',      note: 'No CGT for individuals',             rate: 0,       taxFree: true, currency: 'SGD' },
  { code: 'AE', flag: '🇦🇪', name: 'UAE',            note: 'No personal income/CGT tax',         rate: 0,       taxFree: true, currency: 'AED' },
  { code: 'IN', flag: '🇮🇳', name: 'India',          note: 'Flat 30% + 4% cess on all gains',   rate: 0.312,   currency: 'INR' },
  { code: 'NZ', flag: '🇳🇿', name: 'New Zealand',    note: 'No CGT generally',                  rate: 0,       taxFree: true, currency: 'NZD' },
];

const DEMO = { shortTermGains: 1850, longTermGains: 2430, yieldIncome: 1920, gasDeductions: 180 };



function calcTax(
  taxData: { shortTermGains: number; longTermGains: number; stakingIncome?: { totalUsd: number } } | null,
  country: Country,
  yieldIncomeUsd = 0,
): number {
  if (!taxData || country.taxFree) return 0;
  const shortGains = taxData.shortTermGains || 0;
  const longGains  = taxData.longTermGains || 0;
  const stakingIncome = taxData.stakingIncome?.totalUsd || 0;
  const totalIncome = stakingIncome + yieldIncomeUsd;
  let capitalGainsTax = 0;

  if (country.code === 'AU') {
    capitalGainsTax = (shortGains + longGains * (1 - (country.cgtDiscount || 0))) * country.rate;
  } else if (country.code === 'US') {
    capitalGainsTax = shortGains * country.rate + longGains * (country.ltcgRate || 0.15);
  } else if (country.code === 'GB') {
    const taxable = Math.max(0, shortGains + longGains - (country.cgtAllowance || 3000));
    capitalGainsTax = taxable * country.rate;
  } else if (country.code === 'CA') {
    capitalGainsTax = (shortGains + longGains) * (country.cgtInclusion || 0.50) * country.rate;
  } else if (country.code === 'DE') {
    capitalGainsTax = (country.longTermExempt ? shortGains : shortGains + longGains) * country.rate;
  } else {
    capitalGainsTax = (shortGains + longGains) * country.rate;
  }

  return Math.max(0, Math.round(capitalGainsTax + totalIncome * country.rate));
}

function LoadingDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(id);
  }, []);
  return <span style={{ display: 'inline-block', minWidth: 20 }}>{dots}</span>;
}

const S = {
  bg: '#111214',
  card: { background: '#18191d', border: '1px solid #2a2b30', borderRadius: 16, padding: 24 } as React.CSSProperties,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TaxDashboard() {
  const [country, setCountry] = useState<string>('AU');
  const [showPicker, setShowPicker] = useState(false);
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>([]);
  const [selectedWalletIdx, setSelectedWalletIdx] = useState(0);
  const [realTaxData, setRealTaxData] = useState<TaxData | null>(null);
  const [loadingTax, setLoadingTax] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);

  // Multi-wallet combined
  const [allWalletsTax, setAllWalletsTax] = useState<Array<{ wallet: ConnectedWallet; taxData: TaxData | null; taxError?: string | null }>>([]);
  const [combinedTax, setCombinedTax] = useState<CombinedTax | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [expandedWalletIdxs, setExpandedWalletIdxs] = useState<Set<number>>(new Set([0]));

  // Tax years
  const [taxYears, setTaxYears] = useState<TaxYear[]>(() => getTaxYears('AU'));
  const [taxYearIdx, setTaxYearIdx] = useState(0);

  // Supplementary data
  const [yieldIncome, setYieldIncome] = useState<YieldIncome | null>(null);
  const [gasData, setGasData] = useState<GasData | null>(null);
  const [loadingGas, setLoadingGas] = useState(false);

  // Transaction history toggle
  const [showAllTime, setShowAllTime] = useState(false);

  // Wallet management
  const [newAddress, setNewAddress] = useState('');
  const [newNetwork, setNewNetwork] = useState('ethereum');
  const [scanningAll, setScanningAll] = useState(false);

  // Wallet picker auto-detection
  const [detectedWallets, setDetectedWallets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Delay to let browser extension content scripts inject into window
    const detect = () => {
      const w = window as Window & {
        ethereum?: { isMetaMask?: boolean; isRabby?: boolean; isCoinbaseWallet?: boolean; isRainbow?: boolean; isTrust?: boolean };
        coinbaseWalletExtension?: unknown;
        phantom?: { ethereum?: unknown; solana?: unknown };
        solana?: { isPhantom?: boolean };
        trustwallet?: unknown;
      };
      const eth = w.ethereum;
      setDetectedWallets({
        metamask: !!(eth?.isMetaMask && !eth?.isRabby && !eth?.isCoinbaseWallet),
        rabby: !!eth?.isRabby,
        coinbase: !!(eth?.isCoinbaseWallet || w.coinbaseWalletExtension),
        phantom: !!(w.phantom?.ethereum || w.phantom?.solana || w.solana?.isPhantom),
        rainbow: !!eth?.isRainbow,
        trust: !!(eth?.isTrust || w.trustwallet),
      });
    };
    detect();
    const t = setTimeout(detect, 500); // re-run after extensions inject
    return () => clearTimeout(t);
  }, []);

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchTaxSummary = useCallback((wallet: ConnectedWallet, yearEntry: TaxYear, allTime = false) => {
    if (!wallet || wallet.network === 'solana') return;
    setLoadingTax(true);
    setRealTaxData(null);
    setTaxError(null);
    const activeChains = wallet.chains?.activeChains?.length
      ? wallet.chains.activeChains
      : [wallet.network || 'ethereum'];
    const params: Record<string, string> = {
      address: wallet.address,
      chains: activeChains.join(','),
    };
    if (!allTime) {
      params.startTs = String(yearEntry.startTs);
      params.endTs = String(yearEntry.endTs);
    }
    fetch('/api/wallet/tax-summary?' + new URLSearchParams(params))
      .then(r => r.json())
      .then((data: TaxData & { error?: string }) => {
        if (data.error) setTaxError(data.error);
        else setRealTaxData(data);
        setLoadingTax(false);
      })
      .catch((err: Error) => { setTaxError(err.message); setLoadingTax(false); });
  }, []);

  const fetchAllWalletsTax = useCallback((wallets: ConnectedWallet[], yearEntry: TaxYear) => {
    const evmWallets = wallets.filter(w => w.network !== 'solana');
    if (evmWallets.length === 0) return;
    setLoadingAll(true);
    Promise.allSettled(
      evmWallets.map(wallet => {
        const activeChains = (wallet.chains?.activeChains || [wallet.network || 'ethereum']).slice(0, 2);
        const qs = new URLSearchParams({
          address: wallet.address,
          chains: activeChains.join(','),
          startTs: String(yearEntry.startTs),
          endTs: String(yearEntry.endTs),
        });
        return fetch('/api/wallet/tax-summary?' + qs, { signal: AbortSignal.timeout(15000) }).then(r => r.json());
      })
    ).then(results => {
      const walletResults = evmWallets.map((wallet, i) => ({
        wallet,
        taxData: results[i].status === 'fulfilled' && !(results[i] as PromiseFulfilledResult<TaxData & { error?: string }>).value.error
          ? (results[i] as PromiseFulfilledResult<TaxData>).value
          : null,
        taxError: results[i].status === 'rejected'
          ? (results[i] as PromiseRejectedResult).reason?.message
          : ((results[i] as PromiseFulfilledResult<TaxData & { error?: string }>).value?.error || null),
      }));
      setAllWalletsTax(walletResults);
      const combined = walletResults.reduce<CombinedTax>((acc, { taxData }) => {
        if (!taxData) return acc;
        return {
          shortTermGains:  acc.shortTermGains  + (taxData.shortTermGains || 0),
          longTermGains:   acc.longTermGains   + (taxData.longTermGains  || 0),
          totalGains:      acc.totalGains      + (taxData.totalGains     || 0),
          stakingIncomeUsd:acc.stakingIncomeUsd + (taxData.stakingIncome?.totalUsd || 0),
          totalTxCount:    acc.totalTxCount    + (taxData.txCount         || 0),
          walletsIncluded: acc.walletsIncluded + 1,
        };
      }, { shortTermGains: 0, longTermGains: 0, totalGains: 0, stakingIncomeUsd: 0, totalTxCount: 0, walletsIncluded: 0 });
      setCombinedTax(combined);
      setLoadingAll(false);
    });
  }, []);

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load wallets from localStorage (either key used by the existing tax page)
    const stored = localStorage.getItem('pb_wallets') || localStorage.getItem('pb_tax_wallets');
    let walletList: ConnectedWallet[] = [];
    if (stored) { try { walletList = JSON.parse(stored); } catch {} }
    // Deduplicate by address (case-insensitive) — self-heal localStorage duplicates
    const seen = new Set<string>();
    walletList = walletList.filter(w => {
      const key = w.address.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    localStorage.setItem('pb_wallets', JSON.stringify(walletList));
    setConnectedWallets(walletList);

    const saved = localStorage.getItem('tax_country');
    const activeCountry = saved || 'AU';
    if (saved) setCountry(saved);

    const initYears = getTaxYears(activeCountry);
    setTaxYears(initYears);
    setTaxYearIdx(0);

    if (walletList.length > 0) {
      const evmWallet = walletList.find(w => w.network !== 'solana') || walletList[0];
      const evmIdx = walletList.indexOf(evmWallet);
      setSelectedWalletIdx(evmIdx >= 0 ? evmIdx : 0);
      fetchTaxSummary(evmWallet, initYears[0]);
      fetchAllWalletsTax(walletList, initYears[0]);

      const evmAddr = evmWallet.network !== 'solana' ? evmWallet.address : null;
      if (evmAddr) {
        setLoadingGas(true);
        fetch(`/api/wallet/gas?address=${evmAddr}&year=${new Date().getFullYear()}`)
          .then(r => r.json())
          .then((d: GasData & { error?: string }) => { if (!d.error) setGasData(d); setLoadingGas(false); })
          .catch(() => setLoadingGas(false));
      }
    }

    fetch('/api/yield/income')
      .then(r => r.json())
      .then((d: YieldIncome & { error?: string }) => { if (!d.error) setYieldIncome(d); })
      .catch(() => {});
  }, [fetchTaxSummary, fetchAllWalletsTax]);

  // ── Wallet management ──────────────────────────────────────────────────────

  function addWalletManual() {
    const addr = newAddress.trim();
    if (!addr) return;
    const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr) && !addr.startsWith('0x');
    const network = isSolana ? 'solana' : newNetwork;
    const wallet: ConnectedWallet = { address: addr, network, label: addr.slice(0,6)+'…'+addr.slice(-4) };
    if (connectedWallets.some(w => w.address.toLowerCase() === addr.toLowerCase())) return;
    const updated = [...connectedWallets, wallet];
    setConnectedWallets(updated);
    localStorage.setItem('pb_wallets', JSON.stringify(updated));
    setNewAddress('');
    if (network !== 'solana') {
      fetchTaxSummary(wallet, taxYears[taxYearIdx]);
      fetchAllWalletsTax(updated, taxYears[taxYearIdx]);
    }
  }

  async function connectEVM(walletName: string, installUrl: string) {
    type WalletWindow = Window & {
      ethereum?: { request: (a: { method: string }) => Promise<string[]>; isMetaMask?: boolean; isRabby?: boolean };
      phantom?: { ethereum?: { request: (a: { method: string }) => Promise<string[]> } };
    };
    const w = window as WalletWindow;
    const provider = w.ethereum || w.phantom?.ethereum;
    if (!provider) {
      window.open(installUrl, '_blank', 'noopener');
      return;
    }
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const addr = accounts[0];
      if (!addr) return;
      if (connectedWallets.some(cw => cw.address.toLowerCase() === addr.toLowerCase())) return;
      const wallet: ConnectedWallet = { address: addr, network: 'ethereum', label: walletName, chains: { activeChains: ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon'] } };
      const updated = [...connectedWallets, wallet];
      setConnectedWallets(updated);
      localStorage.setItem('pb_wallets', JSON.stringify(updated));
      fetchTaxSummary(wallet, taxYears[taxYearIdx]);
      fetchAllWalletsTax(updated, taxYears[taxYearIdx]);
      setLoadingGas(true);
      fetch(`/api/wallet/gas?address=${addr}&year=${new Date().getFullYear()}`)
        .then(r => r.json())
        .then((d: GasData & { error?: string }) => { if (!d.error) setGasData(d); setLoadingGas(false); })
        .catch(() => setLoadingGas(false));
    } catch {
      // user dismissed the popup — silent
    }
  }

  function removeWallet(idx: number) {
    const updated = connectedWallets.filter((_, i) => i !== idx);
    setConnectedWallets(updated);
    localStorage.setItem('pb_wallets', JSON.stringify(updated));
    if (updated.length === 0) { setRealTaxData(null); setCombinedTax(null); setAllWalletsTax([]); }
    else { fetchAllWalletsTax(updated, taxYears[taxYearIdx]); }
  }

  function exportCSV() {
    const year = taxYears[taxYearIdx]?.label || new Date().getFullYear();
    const walletAddrs = connectedWallets.map(w => w.address).join('; ') || 'Demo';
    const rows: string[][] = [
      ['PassiveBlocks Tax Report', '', '', '', '', '', '', ''],
      ['Tax Year', String(year), '', '', '', '', '', ''],
      ['Jurisdiction', c.name, '', '', '', '', '', ''],
      ['Wallets', walletAddrs, '', '', '', '', '', ''],
      ['Generated', new Date().toISOString(), '', '', '', '', '', ''],
      [],
      ['SUMMARY', '', '', '', '', '', '', ''],
      ['Short-term gains', `$${displayShortTerm.toFixed(2)}`, '', '', '', '', '', ''],
      ['Long-term gains', `$${displayLongTerm.toFixed(2)}`, '', '', '', '', '', ''],
      ['Staking income', `$${displayStaking.toFixed(2)}`, '', '', '', '', '', ''],
      ['Yield income', `$${yieldIncomeUsd.toFixed(2)}`, '', '', '', '', '', ''],
      ['Gas deductions', `-$${gasDeductible.toFixed(2)}`, '', '', '', '', '', ''],
      ['Net taxable amount', `$${displayNetTaxable.toFixed(2)}`, '', '', '', '', '', ''],
      ['Estimated tax', `$${displayEstTax.toFixed(2)}`, '', '', '', '', '', ''],
      [],
      ['TRANSACTIONS', '', '', '', '', '', '', ''],
      ['Date', 'Type', 'Asset', 'Amount', 'Price (USD)', 'Value (USD)', 'Cost Basis', 'Gain/Loss'],
    ];
    const txs = realTaxData?.transactions || [];
    txs.forEach(tx => {
      rows.push([
        tx.date ? new Date(tx.date).toLocaleDateString() : '',
        tx.type || '',
        tx.asset || '',
        tx.amount != null ? String(tx.amount) : '',
        tx.priceUsd != null ? `$${Number(tx.priceUsd).toFixed(2)}` : '',
        tx.valueUsd != null ? `$${Number(tx.valueUsd).toFixed(2)}` : '',
        tx.costBasis != null ? `$${Number(tx.costBasis).toFixed(2)}` : '',
        tx.gainLoss != null ? `$${Number(tx.gainLoss).toFixed(2)}` : '',
      ]);
    });
    if (txs.length === 0) rows.push(['No transactions loaded — connect a wallet and scan first', '', '', '', '', '', '', '']);
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `passiveblocks-tax-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const year = taxYears[taxYearIdx]?.label || new Date().getFullYear();
    const walletAddrs = connectedWallets.map(w => `${w.address.slice(0,8)}…${w.address.slice(-4)}`).join(', ') || 'Demo mode';
    const txs = realTaxData?.transactions || [];
    const txRows = txs.map(tx => `
      <tr>
        <td>${tx.date ? new Date(tx.date).toLocaleDateString() : '—'}</td>
        <td>${tx.type || '—'}</td>
        <td>${tx.asset || '—'}</td>
        <td>${tx.amount != null ? Number(tx.amount).toFixed(4) : '—'}</td>
        <td>${tx.valueUsd != null ? '$' + Number(tx.valueUsd).toFixed(2) : '—'}</td>
        <td style="color:${Number(tx.gainLoss) >= 0 ? '#16a34a' : '#dc2626'}">${tx.gainLoss != null ? (Number(tx.gainLoss) >= 0 ? '+' : '') + '$' + Number(tx.gainLoss).toFixed(2) : '—'}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PassiveBlocks Tax Report ${year}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; margin: 40px; font-size: 13px; }
      h1 { font-size: 22px; margin-bottom: 4px; } h2 { font-size: 15px; margin: 24px 0 8px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
      .meta { color: #555; font-size: 12px; margin-bottom: 24px; }
      .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
      .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
      .card .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
      .card .value { font-size: 20px; font-weight: 700; }
      .green { color: #16a34a; } .red { color: #dc2626; } .blue { color: #2563eb; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; padding: 8px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-weight: 600; }
      td { padding: 7px 8px; border-bottom: 1px solid #f3f4f6; }
      tr:hover td { background: #f9fafb; }
      .footer { margin-top: 32px; font-size: 11px; color: #888; border-top: 1px solid #e5e7eb; padding-top: 12px; }
      @media print { body { margin: 20px; } }
    </style></head><body>
    <h1>PassiveBlocks — Crypto Tax Report</h1>
    <div class="meta">Tax Year: <strong>${year}</strong> &nbsp;·&nbsp; Jurisdiction: <strong>${c.name}</strong> &nbsp;·&nbsp; Wallets: <strong>${walletAddrs}</strong> &nbsp;·&nbsp; Generated: ${new Date().toLocaleString()}</div>
    <h2>Summary</h2>
    <div class="summary">
      <div class="card"><div class="label">Short-term gains</div><div class="value ${displayShortTerm >= 0 ? 'green' : 'red'}">$${displayShortTerm.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
      <div class="card"><div class="label">Long-term gains</div><div class="value ${displayLongTerm >= 0 ? 'green' : 'red'}">$${displayLongTerm.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
      <div class="card"><div class="label">Staking + Yield income</div><div class="value green">$${(displayStaking + yieldIncomeUsd).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
      <div class="card"><div class="label">Gas deductions</div><div class="value">-$${gasDeductible.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
      <div class="card"><div class="label">Net taxable amount</div><div class="value blue">$${displayNetTaxable.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
      <div class="card"><div class="label">Estimated tax (${c.name})</div><div class="value red">$${displayEstTax.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
    </div>
    <h2>Transaction History (${txs.length} transactions)</h2>
    ${txs.length > 0 ? `<table><thead><tr><th>Date</th><th>Type</th><th>Asset</th><th>Amount</th><th>Value (USD)</th><th>Gain / Loss</th></tr></thead><tbody>${txRows}</tbody></table>` : '<p style="color:#888">No transactions loaded — connect a wallet and scan to populate.</p>'}
    <div class="footer">Generated by PassiveBlocks &nbsp;·&nbsp; passiveblocks.io &nbsp;·&nbsp; This is not financial or tax advice. Consult a qualified accountant.</div>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  function scanAll() {
    if (connectedWallets.length === 0) return;
    setScanningAll(true);
    fetchAllWalletsTax(connectedWallets, taxYears[taxYearIdx]);
    const wallet = connectedWallets[selectedWalletIdx];
    if (wallet && wallet.network !== 'solana') fetchTaxSummary(wallet, taxYears[taxYearIdx]);
    const evmAddr = connectedWallets.find(w => w.network !== 'solana')?.address;
    if (evmAddr) {
      setLoadingGas(true);
      fetch(`/api/wallet/gas?address=${evmAddr}&year=${new Date().getFullYear()}`)
        .then(r => r.json())
        .then((d: GasData & { error?: string }) => { if (!d.error) setGasData(d); setLoadingGas(false); })
        .catch(() => setLoadingGas(false));
    }
    setTimeout(() => setScanningAll(false), 3000);
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  function selectCountry(code: string) {
    setCountry(code);
    localStorage.setItem('tax_country', code);
    setShowPicker(false);
    const newYears = getTaxYears(code);
    setTaxYears(newYears);
    setTaxYearIdx(0);
    const wallet = connectedWallets[selectedWalletIdx];
    if (wallet && wallet.network !== 'solana') fetchTaxSummary(wallet, newYears[0]);
    fetchAllWalletsTax(connectedWallets, newYears[0]);
  }

  function handleTaxYearChange(idx: number) {
    setTaxYearIdx(idx);
    const wallet = connectedWallets[selectedWalletIdx];
    if (wallet && wallet.network !== 'solana') fetchTaxSummary(wallet, taxYears[idx]);
    fetchAllWalletsTax(connectedWallets, taxYears[idx]);
  }

  function handleWalletChange(idx: number) {
    setSelectedWalletIdx(idx);
    fetchTaxSummary(connectedWallets[idx], taxYears[taxYearIdx]);
  }

  function toggleWalletRow(evmIdx: number) {
    setExpandedWalletIdxs(prev => {
      const next = new Set(prev);
      if (next.has(evmIdx)) next.delete(evmIdx);
      else next.add(evmIdx);
      return next;
    });
    const evmWallets = connectedWallets.filter(w => w.network !== 'solana');
    if (evmWallets[evmIdx]) {
      const globalIdx = connectedWallets.indexOf(evmWallets[evmIdx]);
      if (globalIdx !== selectedWalletIdx) handleWalletChange(globalIdx);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const c = TAX_COUNTRIES.find(x => x.code === country) || TAX_COUNTRIES[0];
  const evmWallets = connectedWallets.filter(w => w.network !== 'solana');
  const selectedWallet = connectedWallets[selectedWalletIdx];
  const yieldIncomeUsd = yieldIncome?.totalEarnedUsd || 0;
  const stakingIncomeUsd = realTaxData?.stakingIncome?.totalUsd || 0;
  const capitalGains = realTaxData ? realTaxData.totalGains : (DEMO.shortTermGains + DEMO.longTermGains);
  const shortTermGains = realTaxData ? realTaxData.shortTermGains : DEMO.shortTermGains;
  const longTermGains  = realTaxData ? realTaxData.longTermGains  : DEMO.longTermGains;
  const estTax = calcTax(
    realTaxData || { shortTermGains: DEMO.shortTermGains, longTermGains: DEMO.longTermGains, stakingIncome: { totalUsd: 0 } },
    c, yieldIncomeUsd
  );

  const displayShortTerm = combinedTax ? combinedTax.shortTermGains : shortTermGains;
  const displayLongTerm  = combinedTax ? combinedTax.longTermGains  : longTermGains;
  const displayStaking   = combinedTax ? combinedTax.stakingIncomeUsd : stakingIncomeUsd;
  const displayEstTax    = calcTax(
    { shortTermGains: displayShortTerm, longTermGains: displayLongTerm, stakingIncome: { totalUsd: displayStaking } },
    c, yieldIncomeUsd
  );
  const combinedEstTax = c.taxFree ? 0 : (combinedTax ? calcTax(
    { shortTermGains: combinedTax.shortTermGains, longTermGains: combinedTax.longTermGains, stakingIncome: { totalUsd: combinedTax.stakingIncomeUsd } },
    c, yieldIncomeUsd
  ) : 0);

  const gasDeductionUsd = gasData?.gasDeductionsUsd ?? gasData?.totalGasUsd ?? 0;
  const gasDeductible = (c.code === 'AU' || c.code === 'US' || c.code === 'GB') ? gasDeductionUsd : 0;

  const displayNetTaxable = (() => {
    if (c.taxFree) return 0;
    let taxableGains = 0;
    if (c.code === 'AU') taxableGains = displayShortTerm + displayLongTerm * (1 - (c.cgtDiscount || 0));
    else if (c.code === 'CA') taxableGains = (displayShortTerm + displayLongTerm) * (c.cgtInclusion || 0.50);
    else if (c.code === 'GB') taxableGains = Math.max(0, displayShortTerm + displayLongTerm - (c.cgtAllowance || 3000));
    else if (c.code === 'DE' && c.longTermExempt) taxableGains = displayShortTerm;
    else taxableGains = displayShortTerm + displayLongTerm;
    return Math.max(0, taxableGains + displayStaking + yieldIncomeUsd - gasDeductible);
  })();

  const isLive = !!(combinedTax?.walletsIncluded && combinedTax.walletsIncluded > 0);

  // Holding periods — always show demo as fallback (yield dashboard behavior)
  const holdingPeriods = yieldIncome?.holdingPeriods || [];
  const isLiveHolding = holdingPeriods.length > 0;
  const approaching = holdingPeriods.filter(p => !p.qualified && p.daysToThreshold <= 60).length;

  // Harvest — always show demo as fallback (yield dashboard behavior)
  const harvestData = yieldIncome?.harvestOpportunities || [];
  const isLiveHarvest = harvestData.length > 0;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: S.bg, minHeight: '100vh', color: '#edeef0', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* NAV — fixed, blur, yield dashboard style */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', background: 'rgba(17,18,20,0.85)', borderBottom: '1px solid #2a2b30' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link href="/">
            <Image src="/passiveblocks_logo_cropped.png" alt="PassiveBlocks" width={172} height={40} style={{ height: 40, width: 'auto' }} priority />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {[{ label: 'Tax', href: '/tax' }, { label: 'Pricing', href: '/pricing' }].map(l => (
              <Link key={l.label} href={l.href} style={{ color: l.label === 'Tax' ? '#edeef0' : '#6b6c72', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{l.label}</Link>
            ))}
          </div>
        </div>
      </nav>

      {/* PAGE HEADER — yield dashboard style */}
      <div style={{ background: '#18191d', borderBottom: '1px solid #2a2b30', padding: '0 28px', marginTop: 64, display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 72, boxSizing: 'border-box' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            🏛️ Tax Dashboard
            {isLive
              ? <span style={{ background: '#8aad8a22', color: '#8aad8a', border: '1px solid #8aad8a44', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>LIVE</span>
              : <span style={{ background: '#ff931722', color: '#ff9317', border: '1px solid #ff931744', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>DEMO</span>
            }
          </div>
          <div style={{ fontSize: 12, color: '#6b6c72', marginTop: 3 }}>{c.flag} {c.name} · {c.note}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Country picker */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowPicker(v => !v)}
              style={{ background: '#1e3a5f', color: '#93c5fd', border: '1px solid #6789ed44', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {c.flag} {c.code} <span style={{ fontSize: 10 }}>▼</span>
            </button>
            {showPicker && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: '#18191d', border: '1px solid #2a2b30', borderRadius: 10, zIndex: 200, minWidth: 300, boxShadow: '0 8px 32px #0009', overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', fontSize: 11, color: '#6b6c72', borderBottom: '1px solid #2a2b30', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tax Jurisdiction</div>
                {TAX_COUNTRIES.map(tc => (
                  <div key={tc.code} onClick={() => selectCountry(tc.code)}
                    style={{ padding: '10px 14px', cursor: 'pointer', background: tc.code === country ? '#6789ed22' : 'transparent', borderLeft: tc.code === country ? '3px solid #6789ed' : '3px solid transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{tc.flag} {tc.name}</span>
                    <span style={{ fontSize: 11, color: '#6b6c72' }}>{tc.note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 28px 80px' }}>

        {/* TAX YEAR SELECTOR */}
        {connectedWallets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <label style={{ fontSize: 12, color: '#6b6c72', whiteSpace: 'nowrap' }}>Tax Year:</label>
            <select value={taxYearIdx} onChange={e => handleTaxYearChange(Number(e.target.value))}
              style={{ background: S.bg, color: '#edeef0', border: '1px solid #2a2b30', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', minWidth: 160 }}>
              {taxYears.map((y, i) => (
                <option key={i} value={i}>{y.label}{i === 0 ? ' (current)' : ''}</option>
              ))}
            </select>
            {taxYears[taxYearIdx] && (
              <span style={{ fontSize: 12, color: '#6b6c72' }}>
                {formatDateShort(taxYears[taxYearIdx].startTs)} – {formatDateShort(taxYears[taxYearIdx].endTs)}
              </span>
            )}
          </div>
        )}

        {/* STATUS BAR */}
        {connectedWallets.length > 0 && (
          <div style={{ marginBottom: 16, padding: '8px 14px', background: taxError ? '#ef444411' : loadingTax || loadingAll ? '#6789ed11' : '#8aad8a11', border: `1px solid ${taxError ? '#ef444433' : loadingTax || loadingAll ? '#6789ed33' : '#8aad8a33'}`, borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {taxError && !loadingTax ? (
              <>
                <span style={{ color: '#ef4444' }}>⚠️ {taxError}</span>
                <button onClick={() => fetchTaxSummary(selectedWallet, taxYears[taxYearIdx])}
                  style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  Retry
                </button>
              </>
            ) : (loadingTax || loadingAll) ? (
              <span style={{ color: '#6789ed' }}>⏳ Fetching on-chain data…</span>
            ) : realTaxData ? (
              <span style={{ color: '#8aad8a' }}>
                📡 {realTaxData.dataSource || 'Etherscan'} · Last fetched: {new Date(realTaxData.fetchedAt).toLocaleTimeString()}
                {' | '}<strong>{combinedTax?.walletsIncluded ?? 1}</strong> wallet{(combinedTax?.walletsIncluded ?? 1) !== 1 ? 's' : ''}
                {' · '}<strong>{(combinedTax?.totalTxCount ?? realTaxData.txCount ?? 0).toLocaleString()}</strong> txns
              </span>
            ) : (
              <span style={{ color: '#ff9317' }}>⚠️ Demo mode — connect a wallet to see real data</span>
            )}
          </div>
        )}


        {/* SECTION 2 — PER-WALLET ACCORDION */}
        {evmWallets.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg, #18191d 0%, #1a1e24 100%)', border: '1px solid #2a2b30', borderRadius: 16, marginBottom: 24, padding: 0, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #2a2b30', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6c72', borderLeft: '4px solid #8aad8a', paddingLeft: 10 }}>Per-Wallet Breakdown</span>
              <span style={{ fontSize: 12, color: '#6b6c72' }}>{evmWallets.length} wallet{evmWallets.length !== 1 ? 's' : ''}</span>
            </div>
            {(allWalletsTax.length > 0 ? allWalletsTax : evmWallets.map(w => ({ wallet: w, taxData: null, taxError: null }))).map(({ wallet, taxData, taxError: wErr }, evmIdx) => {
              const isExpanded = expandedWalletIdxs.has(evmIdx);
              const globalIdx = connectedWallets.indexOf(wallet);
              const isSelected = globalIdx === selectedWalletIdx;
              const walletEstTax = calcTax(taxData, c, 0);
              return (
                <div key={evmIdx} style={{ borderBottom: evmIdx < evmWallets.length - 1 ? '1px solid #1e1f23' : 'none' }}>
                  <div onClick={() => toggleWalletRow(evmIdx)}
                    style={{ padding: '14px 24px', cursor: 'pointer', background: isSelected ? '#6789ed0a' : 'transparent', display: 'flex', alignItems: 'center', gap: 12, userSelect: 'none' }}>
                    <span style={{ fontSize: 14, color: '#6789ed', width: 16, flexShrink: 0 }}>{isExpanded ? '▼' : '▶'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#edeef0' }}>
                          {wallet.address.slice(0, 10)}…{wallet.address.slice(-8)}
                        </span>
                        {wallet.label && <span style={{ fontSize: 12, color: '#6b6c72' }}>({wallet.label})</span>}
                      </div>
                      {!isExpanded && (
                        <div style={{ fontSize: 12, color: '#6b6c72', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {loadingAll ? <span style={{ color: '#6789ed' }}>⏳ Fetching…</span>
                            : taxData ? (
                              <>
                                <span>Short: <strong style={{ color: '#8aad8a' }}>${(taxData.shortTermGains || 0).toLocaleString()}</strong></span>
                                <span>Long: <strong style={{ color: '#8aad8a' }}>${(taxData.longTermGains || 0).toLocaleString()}</strong></span>
                                <span>Est. tax: <strong style={{ color: c.taxFree ? '#8aad8a' : '#ef4444' }}>{c.taxFree ? 'Free' : `$${walletEstTax.toLocaleString()}`}</strong></span>
                                <span style={{ color: '#6b6c72' }}>{(taxData.txCount || 0).toLocaleString()} txns</span>
                              </>
                            ) : wErr ? <span style={{ color: '#ef4444' }}>⚠️ {wErr}</span>
                            : null}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <span style={{ background: '#6789ed22', color: '#6789ed', border: '1px solid #6789ed33', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>SELECTED</span>
                    )}
                  </div>
                  {isExpanded && taxData && (
                    <div style={{ padding: '0 24px 20px', background: '#111214' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
                        {[
                          { label: 'Capital Gains', value: `$${(taxData.totalGains || 0).toLocaleString()}`, sub: `Short: $${taxData.shortTermGains.toLocaleString()} · Long: $${taxData.longTermGains.toLocaleString()}`, color: '#8aad8a' },
                          { label: 'Staking Income', value: `$${(taxData.stakingIncome?.totalUsd || 0).toLocaleString()}`, sub: `${(taxData.txCount || 0).toLocaleString()} txns`, color: '#6789ed' },
                          { label: 'Est. Tax Due', value: c.taxFree ? 'Tax-free' : `$${walletEstTax.toLocaleString()} ${c.currency}`, sub: c.taxFree ? c.note : `@ ${(c.rate * 100).toFixed(0)}% rate`, color: c.taxFree ? '#8aad8a' : '#ef4444' },
                        ].map((stat, i) => (
                          <div key={i} style={{ background: '#18191d', border: '1px solid #2a2b30', borderRadius: 12, padding: 16 }}>
                            <div style={{ fontSize: 11, color: '#6b6c72', textTransform: 'uppercase', marginBottom: 6 }}>{stat.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                            <div style={{ fontSize: 12, color: '#6b6c72', marginTop: 6 }}>{stat.sub}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* HERO STAT CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            {
              label: 'Total Capital Gains',
              value: loadingTax ? '—' : `$${(combinedTax ? combinedTax.totalGains : capitalGains).toLocaleString()}`,
              currency: c.currency,
              sub: combinedTax
                ? `Short: $${combinedTax.shortTermGains.toLocaleString()} · Long: $${combinedTax.longTermGains.toLocaleString()}`
                : realTaxData ? `Short: $${shortTermGains.toLocaleString()} · Long: $${longTermGains.toLocaleString()}` : 'Short + long term · Demo',
              color: '#8aad8a',
              accent: '#8aad8a',
            },
            {
              label: 'Total Crypto Income',
              value: loadingTax ? '—' : `$${((combinedTax ? combinedTax.stakingIncomeUsd : stakingIncomeUsd) + yieldIncomeUsd).toLocaleString()}`,
              currency: c.currency,
              sub: `Staking: $${(combinedTax ? combinedTax.stakingIncomeUsd : stakingIncomeUsd).toLocaleString()} · Yield: $${yieldIncomeUsd.toLocaleString()}`,
              color: '#6789ed',
              accent: '#6789ed',
            },
            {
              label: 'Est. Tax Due',
              value: loadingTax ? '—' : c.taxFree ? 'Tax-free' : `$${(combinedTax ? combinedEstTax : estTax).toLocaleString()}`,
              currency: c.taxFree ? '' : c.currency,
              sub: c.taxFree ? 'Tax-free jurisdiction ✅' : `@ ${(c.rate * 100).toFixed(1)}% effective rate`,
              color: c.taxFree ? '#8aad8a' : '#ff9317',
              accent: c.taxFree ? '#8aad8a' : '#ff9317',
            },
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'linear-gradient(135deg, #18191d 0%, #1a1e24 100%)',
              border: '1px solid #2a2b30',
              borderLeft: `4px solid ${stat.accent}`,
              borderRadius: 16,
              padding: 24,
              minHeight: 120,
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 11, color: '#6b6c72', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{stat.label}</div>
              <div>
                <div style={{ fontSize: 38, fontWeight: 900, color: stat.color, lineHeight: 1.1, marginTop: 8 }}>
                  {stat.value}
                  {stat.currency && !loadingTax && <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 6, color: stat.color, opacity: 0.7 }}>{stat.currency}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#6b6c72', marginTop: 8 }}>{stat.sub}</div>
              </div>
              <div style={{ marginTop: 12 }}>
                {(combinedTax?.walletsIncluded || realTaxData)
                  ? <span style={{ background: `${stat.accent}22`, color: stat.accent, border: `1px solid ${stat.accent}44`, borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>LIVE</span>
                  : <span style={{ background: '#ff931722', color: '#ff9317', border: '1px solid #ff931744', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>DEMO</span>}
              </div>
            </div>
          ))}
        </div>

        {/* CONNECTED ACCOUNTS — wallet manager section */}
        <div style={{ background: 'linear-gradient(135deg, #18191d 0%, #1a1e24 100%)', border: '1px solid #2a2b30', borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6c72', marginBottom: 16, borderLeft: '4px solid #6789ed', paddingLeft: 10 }}>Connected Accounts</div>

          {/* Add wallet form */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <input value={newAddress} onChange={e => setNewAddress(e.target.value)}
              placeholder="Paste any 0x wallet address (Ethereum, Base, Arbitrum…)"
              onKeyDown={e => e.key === 'Enter' && addWalletManual()}
              style={{ flex: 1, minWidth: 300, background: '#111214', color: '#edeef0', border: '1px solid #2a2b30', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none' }} />
            <select value={newNetwork} onChange={e => setNewNetwork(e.target.value)}
              style={{ background: '#111214', color: '#edeef0', border: '1px solid #2a2b30', borderRadius: 8, padding: '10px 12px', fontSize: 13, cursor: 'pointer', outline: 'none' }}>
              <option value="ethereum">Ethereum</option>
              <option value="base">Base</option>
              <option value="arbitrum">Arbitrum</option>
              <option value="optimism">Optimism</option>
              <option value="polygon">Polygon</option>
              <option value="solana">Solana</option>
            </select>
            <button onClick={addWalletManual}
              style={{ background: '#8aad8a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              Add &amp; Scan
            </button>
          </div>

          {/* Multi-wallet picker */}
          {(() => {
            const WALLETS = [
              { id: 'metamask', name: 'MetaMask',       emoji: '🦊', installUrl: 'https://metamask.io/download/' },
              { id: 'rabby',    name: 'Rabby',           emoji: '🐰', installUrl: 'https://rabby.io/' },
              { id: 'coinbase', name: 'Coinbase Wallet', emoji: '🔵', installUrl: 'https://www.coinbase.com/wallet' },
              { id: 'phantom',  name: 'Phantom',         emoji: '👻', installUrl: 'https://phantom.app/' },
              { id: 'rainbow',  name: 'Rainbow',         emoji: '🌈', installUrl: 'https://rainbow.me/' },
              { id: 'trust',    name: 'Trust Wallet',    emoji: '🛡️', installUrl: 'https://trustwallet.com/' },
            ];
            return (
              <div style={{ marginBottom: connectedWallets.length > 0 ? 20 : 16 }}>
                <div style={{ fontSize: 11, color: '#6b6c72', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Connect Browser Wallet</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {WALLETS.map(w => {
                    const isDetected = !!detectedWallets[w.id];
                    return (
                      <div
                        key={w.id}
                        onClick={() => connectEVM(w.name, w.installUrl)}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = isDetected ? '#8aad8a66' : '#6789ed44')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = isDetected ? '#8aad8a33' : '#2a2b30')}
                        style={{ background: '#111214', border: `1px solid ${isDetected ? '#8aad8a33' : '#2a2b30'}`, borderRadius: 10, padding: '12px 10px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s', userSelect: 'none' }}
                      >
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{w.emoji}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#edeef0', marginBottom: 4 }}>{w.name}</div>
                        {isDetected ? (
                          <div style={{ fontSize: 11, color: '#8aad8a', fontWeight: 600 }}>● Detected</div>
                        ) : (
                          <div style={{ fontSize: 11, color: '#6b6c72' }}>Click to connect</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Wallet list */}
          {connectedWallets.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, color: '#6b6c72', marginBottom: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Connected ({connectedWallets.length})
              </div>
              {connectedWallets.map((w, i) => {
                const wTaxData = allWalletsTax.find(x => x.wallet.address.toLowerCase() === w.address.toLowerCase())?.taxData;
                // Avatar color based on address hash
                const avatarColors = ['#6789ed', '#8aad8a', '#ff9317', '#a78bfa', '#f472b6', '#34d399'];
                const avatarBg = avatarColors[(parseInt(w.address.slice(2, 4) || '0', 16)) % avatarColors.length];
                const avatarText = w.address.slice(2, 4).toUpperCase();
                const shortAddr = `${w.address.slice(0, 6)}…${w.address.slice(-4)}`;
                return (
                  <div key={i} style={{ background: '#111214', borderRadius: 12, padding: '14px 16px', border: '1px solid #2a2b30', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: wTaxData ? 14 : 0 }}>
                      {/* Avatar circle */}
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${avatarBg}33`, border: `2px solid ${avatarBg}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: avatarBg, flexShrink: 0, fontFamily: 'monospace' }}>
                        {avatarText}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#edeef0', fontWeight: 600 }}>{shortAddr}</span>
                          <span style={{ fontSize: 10, color: '#6b6c72', background: '#2a2b30', borderRadius: 4, padding: '2px 7px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{w.network}</span>
                          {w.label && w.label !== w.address.slice(0,6)+'…'+w.address.slice(-4) && (
                            <span style={{ fontSize: 11, color: '#6b6c72' }}>{w.label}</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => removeWallet(i)}
                        style={{ background: 'transparent', color: '#6b6c72', border: '1px solid #2a2b30', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#ef444415'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef444433'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b6c72'; e.currentTarget.style.borderColor = '#2a2b30'; }}>
                        Remove
                      </button>
                    </div>
                    {loadingAll ? (
                      <div style={{ fontSize: 12, color: '#6789ed', paddingLeft: 48 }}>⏳ Scanning…</div>
                    ) : wTaxData ? (
                      <div style={{ borderTop: '1px solid #2a2b3044', paddingTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12 }}>
                        <div style={{ background: S.bg, borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ color: '#6b6c72', marginBottom: 4, fontSize: 11 }}>Short-term</div>
                          <div style={{ fontWeight: 700, color: '#8aad8a' }}>${(wTaxData.shortTermGains || 0).toLocaleString()}</div>
                        </div>
                        <div style={{ background: S.bg, borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ color: '#6b6c72', marginBottom: 4, fontSize: 11 }}>Long-term</div>
                          <div style={{ fontWeight: 700, color: '#8aad8a' }}>${(wTaxData.longTermGains || 0).toLocaleString()}</div>
                        </div>
                        <div style={{ background: S.bg, borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ color: '#6b6c72', marginBottom: 4, fontSize: 11 }}>Staking</div>
                          <div style={{ fontWeight: 700, color: '#6789ed' }}>${(wTaxData.stakingIncome?.totalUsd || 0).toLocaleString()}</div>
                        </div>
                        <div style={{ background: S.bg, borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ color: '#6b6c72', marginBottom: 4, fontSize: 11 }}>Txns</div>
                          <div style={{ fontWeight: 700, color: '#edeef0' }}>{(wTaxData.txCount || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    ) : w.network !== 'solana' ? (
                      <div style={{ fontSize: 12, color: '#6b6c72', paddingLeft: 48 }}>Click Scan to load tax data →</div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#6b6c72', paddingLeft: 48 }}>Solana — tax calculation not yet supported</div>
                    )}
                  </div>
                );
              })}
              <button onClick={scanAll} disabled={scanningAll || loadingAll}
                style={{ marginTop: 4, background: '#8aad8a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', opacity: (scanningAll || loadingAll) ? 0.6 : 1, transition: 'opacity 0.15s' }}
                onMouseEnter={e => { if (!scanningAll && !loadingAll) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = (scanningAll || loadingAll) ? '0.6' : '1'; }}>
                {scanningAll || loadingAll ? '⏳ Scanning all chains…' : '🔍 Scan All Wallets & Chains'}
              </button>
            </div>
          )}
        </div>

        {/* TRANSACTION HISTORY */}
        <div style={{ background: 'linear-gradient(135deg, #18191d 0%, #1a1e24 100%)', border: '1px solid #2a2b30', borderRadius: 16, padding: 24, marginBottom: 24, overflowX: 'auto', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6c72', borderLeft: '4px solid #6789ed', paddingLeft: 10 }}>Transaction History</span>
              {realTaxData?.transactions?.length ? (
                <span style={{ marginLeft: 10, fontSize: 11, color: '#6b6c72' }}>
                  {showAllTime ? 'All time' : taxYears[taxYearIdx]?.label} · {realTaxData.transactions.length} transactions
                </span>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {connectedWallets.length > 0 && (
                <button
                  onClick={() => {
                    const next = !showAllTime;
                    setShowAllTime(next);
                    if (selectedWallet) fetchTaxSummary(selectedWallet, taxYears[taxYearIdx], next);
                  }}
                  style={{ background: showAllTime ? '#6789ed22' : '#2a2b30', color: showAllTime ? '#6789ed' : '#6b6c72', border: `1px solid ${showAllTime ? '#6789ed55' : '#2a2b30'}`, borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {showAllTime ? '📅 All time' : '🔍 Show all time'}
                </button>
              )}
              {connectedWallets.length > 0 && selectedWallet && selectedWallet.network !== 'solana' && (
                <button onClick={() => fetchTaxSummary(selectedWallet, taxYears[taxYearIdx])} disabled={loadingTax}
                  style={{ background: '#6789ed22', color: '#6789ed', border: '1px solid #6789ed33', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: loadingTax ? 0.5 : 1 }}>
                  🔄 Refresh
                </button>
              )}
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Date', 'Type', 'Asset', 'Amount', 'From', 'To', 'Chain'].map(h => (
                  <th key={h} style={{ textAlign: 'left', color: '#6b6c72', padding: '8px 10px', borderBottom: '1px solid #2a2b30', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingTax ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 20px', color: '#6789ed' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #6789ed44', borderTopColor: '#6789ed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Loading transactions<LoadingDots />
                    </div>
                  </td>
                </tr>
              ) : realTaxData?.transactions?.length ? (
                realTaxData.transactions.map((tx, i) => (
                  <tr key={i} style={{ background: tx.isStakingReward ? '#8aad8a08' : 'transparent', borderLeft: tx.isStakingReward ? '3px solid #8aad8a' : '3px solid transparent' }}>
                    <td style={{ padding: '7px 10px', color: '#edeef0', whiteSpace: 'nowrap' }}>
                      {tx.date ? new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ background: tx.isStakingReward ? '#8aad8a22' : tx.type === 'ETH Received' ? '#6789ed22' : '#2a2b30', color: tx.isStakingReward ? '#8aad8a' : tx.type === 'ETH Received' ? '#6789ed' : '#6b6c72', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', fontWeight: 600 }}>{tx.asset}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{tx.amount}</td>
                    <td style={{ padding: '7px 10px', color: '#6b6c72', fontFamily: 'monospace', fontSize: 11 }}>
                      {tx.from ? tx.from.slice(0, 6) + '…' + tx.from.slice(-4) : '—'}
                    </td>
                    <td style={{ padding: '7px 10px', color: '#6b6c72', fontFamily: 'monospace', fontSize: 11 }}>
                      {tx.to ? tx.to.slice(0, 6) + '…' + tx.to.slice(-4) : '—'}
                    </td>
                    <td style={{ padding: '7px 10px', color: '#6b6c72', fontSize: 11 }}>{tx.chain || 'eth'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: '#6b6c72' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
                    {realTaxData ? (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#edeef0' }}>No transactions for {taxYears[taxYearIdx]?.label}</div>
                        <div style={{ fontSize: 13, marginBottom: 12 }}>Try a different tax year, or show your full history</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#edeef0' }}>No wallet connected</div>
                        <div style={{ fontSize: 13 }}>Connect a wallet above to see your transactions</div>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* TAX BREAKDOWN + HARVEST (2 col) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Tax Breakdown */}
          <div style={{ background: 'linear-gradient(135deg, #18191d 0%, #1a1e24 100%)', border: '1px solid #2a2b30', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6c72', borderLeft: '4px solid #ff9317', paddingLeft: 10, marginBottom: 4 }}>Tax Breakdown</div>
            {combinedTax && <div style={{ fontSize: 11, color: '#6b6c72', marginBottom: 16 }}>Combined across all wallets & chains</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {[
                { label: 'Short-term gains', val: `+$${displayShortTerm.toLocaleString()}`, color: '#8aad8a', sub: null },
                {
                  label: `Long-term gains (${c.cgtDiscount ? (c.cgtDiscount * 100).toFixed(0) + '% discount' : c.longTermExempt ? 'exempt >12mo' : c.cgtInclusion ? (c.cgtInclusion * 100).toFixed(0) + '% inclusion' : c.ltcgRate ? (c.ltcgRate * 100).toFixed(0) + '% LTCG' : 'full rate'})`,
                  val: `+$${displayLongTerm.toLocaleString()}`,
                  color: '#8aad8a',
                  sub: c.cgtDiscount ? `→ $${Math.round(displayLongTerm * (1 - c.cgtDiscount)).toLocaleString()} taxable` : c.longTermExempt ? '→ $0 taxable (exempt)' : null,
                },
                { label: 'Staking income', val: `+$${displayStaking.toLocaleString()}`, color: '#6789ed', sub: null },
                { label: 'Yield income (DeFi positions)', val: `+$${yieldIncomeUsd.toLocaleString()}`, color: '#6789ed', sub: yieldIncome?.positionCount ? `${yieldIncome.positionCount} active positions` : null },
                {
                  label: `Gas fees paid (${(c.code === 'AU' || c.code === 'US' || c.code === 'GB') ? 'deductible ✅' : 'not deductible'})`,
                  val: loadingGas ? '⏳' : gasData ? `-$${gasDeductionUsd.toFixed(2)}` : '-$0.00',
                  color: '#10b981',
                  sub: gasData ? `${(gasData.totalGasEth || 0).toFixed(6)} ETH across Base + Arb + Eth` : 'Fetching…',
                },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#111214', borderRadius: 8, marginBottom: 2 }}>
                  <div>
                    <div style={{ fontSize: 13 }}>{row.label}</div>
                    {row.sub && <div style={{ fontSize: 11, color: '#6b6c72', marginTop: 2 }}>{row.sub}</div>}
                  </div>
                  <span style={{ fontWeight: 700, color: row.color, fontSize: 14 }}>{row.val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#6789ed11', border: '1px solid #6789ed33', borderRadius: 8, marginTop: 4 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Net Taxable Amount</div>
                  {combinedTax && <div style={{ fontSize: 11, color: '#6b6c72', marginTop: 2 }}>All wallets combined</div>}
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: c.taxFree ? '#8aad8a' : '#6789ed' }}>
                  {c.taxFree ? `$0 (tax-free ✅)` : `$${Math.round(displayNetTaxable).toLocaleString()} ${c.currency}`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, marginTop: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Estimated Tax Due</div>
                <span style={{ fontSize: 18, fontWeight: 900, color: c.taxFree ? '#8aad8a' : '#ef4444' }}>
                  {c.taxFree ? 'Tax-free ✅' : `$${displayEstTax.toLocaleString()} ${c.currency}`}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={exportCSV} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: '#1a2a1a', border: '1px solid #8aad8a44', borderRadius: 8, color: '#8aad8a', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ⬇ Export CSV
              </button>
              <button onClick={exportPDF} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: '#1a1d2a', border: '1px solid #6789ed44', borderRadius: 8, color: '#6789ed', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🖨 Export PDF
              </button>
            </div>
            <div style={{ fontSize: 11, color: realTaxData ? '#8aad8a88' : '#ff931766', marginTop: 12 }}>
              {realTaxData
                ? `✅ Live data from your connected wallet via Etherscan. Last updated: ${new Date(realTaxData.fetchedAt).toLocaleString()}.`
                : '⚠️ Demo figures only — not financial or tax advice. Consult a qualified tax professional.'}
            </div>
          </div>

          {/* Tax-Loss Harvesting — always show (demo as fallback) */}
          <div style={{ background: 'linear-gradient(135deg, #18191d 0%, #1a1e24 100%)', border: '1px solid #2a2b30', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6c72', borderLeft: '4px solid #8aad8a', paddingLeft: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              Tax-Loss Harvesting
              {isLiveHarvest
                ? <span style={{ fontSize: 10, color: '#8aad8a', fontWeight: 600, textTransform: 'none' }}>LIVE</span>
                : <span style={{ fontSize: 10, color: '#ff9317', fontWeight: 600, textTransform: 'none' }}>ILLUSTRATIVE</span>}
            </div>
            {isLiveHarvest ? (
              <>
                <div style={{ background: '#8aad8a22', border: '1px solid #8aad8a33', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔍</span>
                  <span style={{ fontSize: 13, color: '#8aad8a', fontWeight: 600 }}>{harvestData.length} opportunities found</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Asset', 'Position', 'Unrealised Loss', 'Recommendation'].map(h => (
                        <th key={h} style={{ textAlign: 'left', color: '#6b6c72', padding: '8px 10px', borderBottom: '1px solid #2a2b30', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {harvestData.map((opp, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #18191d' }}>
                        <td style={{ padding: '10px', fontWeight: 700 }}>{opp.asset}</td>
                        <td style={{ padding: '10px', color: '#edeef0' }}>{opp.position}</td>
                        <td style={{ padding: '10px', color: '#ef4444', fontWeight: 700 }}>${opp.unrealisedLoss}</td>
                        <td style={{ padding: '10px', color: '#6b6c72', fontSize: 11 }}>{opp.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 12, background: '#8aad8a11', border: '1px solid #8aad8a22', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#8aad8a' }}>
                  💡 Total potential savings: <strong>${harvestData.reduce((s, o) => s + Math.abs(o.unrealisedLoss), 0).toFixed(2)}</strong>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#6b6c72', fontSize: 13 }}>
                {connectedWallets.length === 0
                  ? 'Connect a wallet and scan to identify loss harvesting opportunities.'
                  : 'No unrealised losses found in your current positions — nothing to harvest right now.'}
              </div>
            )}
          </div>
        </div>

        {/* HOLDING PERIOD TRACKER — always show (demo as fallback) */}
        <div style={{ background: 'linear-gradient(135deg, #18191d 0%, #1a1e24 100%)', border: '1px solid #2a2b30', borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6c72', borderLeft: '4px solid #a78bfa', paddingLeft: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            Holding Period Tracker
            {isLiveHolding
              ? <span style={{ fontSize: 10, color: '#8aad8a', fontWeight: 600, textTransform: 'none' }}>● LIVE</span>
              : null}
          </div>
          {!isLiveHolding ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#6b6c72', fontSize: 13 }}>
              {connectedWallets.length === 0
                ? 'Connect a wallet and scan to track CGT holding periods.'
                : 'No DeFi positions detected in your connected wallets.'}
            </div>
          ) : (
          <>
          <div style={{ background: approaching > 0 ? '#ff931722' : '#8aad8a22', border: `1px solid ${approaching > 0 ? '#ff931733' : '#8aad8a33'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>{approaching > 0 ? '⚠️' : '✅'}</span>
            <span style={{ fontSize: 13, color: approaching > 0 ? '#ff9317' : '#8aad8a', fontWeight: 600 }}>
              {approaching > 0 ? `${approaching} positions approaching 12-month CGT threshold` : 'All positions within CGT threshold'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {holdingPeriods.map((p, i) => (
              <div key={i} style={{ background: '#111214', borderRadius: 10, padding: '14px 16px', border: p.qualified ? '1px solid #8aad8a44' : p.daysToThreshold <= 30 ? '1px solid #ef444444' : '1px solid #ff931744' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.asset}</div>
                  {p.qualified
                    ? <span style={{ background: '#8aad8a22', color: '#8aad8a', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>✅ Qualified</span>
                    : p.daysToThreshold <= 30
                    ? <span style={{ background: '#ef444422', color: '#ef4444', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>🔥 {p.daysToThreshold}d left</span>
                    : <span style={{ background: '#ff931722', color: '#ff9317', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>⚠️ {p.daysToThreshold}d left</span>}
                </div>
                <div style={{ fontSize: 12, color: '#6b6c72', marginBottom: 4 }}>Acquired: {p.acquiredDate} · {p.daysHeld.toFixed(0)} days held</div>
                <div style={{ fontSize: 12, color: '#6b6c72', marginBottom: 8 }}>Position value: <span style={{ color: '#edeef0', fontWeight: 600 }}>{p.value}</span></div>
                {!p.qualified && (
                  <div style={{ fontSize: 11, color: '#8aad8a', background: '#8aad8a11', borderRadius: 6, padding: '6px 10px' }}>
                    💰 Hold to qualify → est. CGT saving: <strong>{p.potentialSaving || 'N/A'}</strong>
                  </div>
                )}
                {p.qualified && (
                  <div style={{ fontSize: 11, color: '#8aad8a' }}>
                    ✅ CGT discount applies — {c.cgtDiscount ? `${(c.cgtDiscount * 100).toFixed(0)}% discount` : c.longTermExempt ? 'fully exempt' : 'check jurisdiction rules'}
                  </div>
                )}
              </div>
            ))}
          </div>
          </>
          )}
        </div>

        {/* FOOTER DISCLAIMER */}
        <div style={{ fontSize: 12, color: '#6b6c72', textAlign: 'center', padding: '20px 0' }}>
          Tax estimates only — not financial or tax advice. Consult a qualified accountant for your specific situation.
        </div>

      </div>

      {/* Newsletter CTA */}
      <div style={{ borderTop: '1px solid #2a2b30', background: '#0d1117', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>📬</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f5', marginBottom: 6 }}>Get the weekly yield newsletter</div>
          <div style={{ fontSize: 13, color: '#6b6c72', marginBottom: 16 }}>Top DeFi yields, protocol signals, and what we&apos;re watching — every Friday.</div>
          <Link href="/#subscribe" style={{ display: 'inline-block', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700, padding: '10px 24px', borderRadius: 8, textDecoration: 'none' }}>
            Subscribe free →
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #2a2b30', padding: '32px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/">
            <Image src="/passiveblocks_logo_cropped.png" alt="PassiveBlocks" width={130} height={30} style={{ height: 32, width: 'auto', opacity: 0.4 }} />
          </Link>
          <span style={{ fontSize: 13, color: '#6b6c72' }}>© {new Date().getFullYear()} PassiveBlocks</span>
        </div>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          nav, button, footer { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
        }
      `}</style>
    </div>
  );
}
