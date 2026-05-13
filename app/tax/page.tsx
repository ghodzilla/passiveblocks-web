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

const HARVEST_OPPORTUNITIES_DEMO: HarvestOpp[] = [
  { asset: 'ETH/USDC LP', unrealisedLoss: -340, position: '$4,200', recommendation: 'Consider harvesting to offset gains', demo: true },
  { asset: 'ARB',         unrealisedLoss: -210, position: '$1,850', recommendation: 'Short-term loss available', demo: true },
  { asset: 'MATIC',       unrealisedLoss: -155, position: '$920',   recommendation: 'Small loss - harvest if near year-end', demo: true },
];

const HOLDING_PERIODS_DEMO: HoldingPeriod[] = [
  { asset: 'wstETH',     acquiredDate: '2024-05-03', daysHeld: 322, daysToThreshold: 43,  value: '$8,400', potentialSaving: '$1,260', qualified: false, demo: true },
  { asset: 'USDC/ETH LP',acquiredDate: '2024-04-18', daysHeld: 337, daysToThreshold: 28,  value: '$5,200', potentialSaving: '$780',   qualified: false, demo: true },
  { asset: 'cbETH',      acquiredDate: '2024-03-10', daysHeld: 376, daysToThreshold: 0,   value: '$3,100', potentialSaving: null,     qualified: true,  demo: true },
];

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
  bg: '#08080f',
  card: { background: '#0f1017', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 } as React.CSSProperties,
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
  const totalIncome = stakingIncomeUsd + yieldIncomeUsd;
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

  const allChainSet = new Set<string>();
  connectedWallets.forEach(w => {
    (w.chains?.activeChains || [w.network || 'ethereum']).forEach(ch => allChainSet.add(ch));
  });
  const allChains = Array.from(allChainSet);

  const holdingPeriods = yieldIncome?.holdingPeriods?.length ? yieldIncome.holdingPeriods : HOLDING_PERIODS_DEMO;
  const isLiveHolding = !!(yieldIncome?.holdingPeriods?.length);
  const harvestData = yieldIncome?.harvestOpportunities?.length ? yieldIncome.harvestOpportunities : HARVEST_OPPORTUNITIES_DEMO;
  const isLiveHarvest = !!(yieldIncome?.harvestOpportunities?.length);
  const approaching = holdingPeriods.filter(p => !p.qualified && p.daysToThreshold <= 60).length;

  const isLive = !!(combinedTax?.walletsIncluded && combinedTax.walletsIncluded > 0);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: S.bg, minHeight: '100vh', color: '#edeef0', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* NAV */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link href="/">
            <Image src="/passiveblocks_logo_cropped.png" alt="PassiveBlocks" width={172} height={40} style={{ height: 40, width: 'auto' }} priority />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Tax', href: '/tax' }, { label: 'Pricing', href: '/pricing' }].map(l => (
              <Link key={l.label} href={l.href} style={{ color: l.label === 'Tax' ? '#edeef0' : 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{l.label}</Link>
            ))}
            <Link href="/#subscribe" style={{ background: '#3b5de4', color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700 }}>
              Subscribe free →
            </Link>
          </div>
        </div>
      </nav>

      {/* PAGE HEADER */}
      <div style={{ background: '#0f1017', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 72, boxSizing: 'border-box' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            🏛️ Tax Dashboard
            {isLive
              ? <span style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>LIVE</span>
              : <span style={{ background: '#f9731622', color: '#f97316', border: '1px solid #f9731644', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>DEMO</span>
            }
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{c.flag} {c.name} · {c.note}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Country picker */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowPicker(v => !v)}
              style={{ background: '#1a2744', color: '#93c5fd', border: '1px solid rgba(99,131,237,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {c.flag} {c.code} <span style={{ fontSize: 10 }}>▼</span>
            </button>
            {showPicker && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: '#0f1017', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, zIndex: 200, minWidth: 300, boxShadow: '0 8px 32px #0009', overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', fontSize: 11, color: 'rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tax Jurisdiction</div>
                {TAX_COUNTRIES.map(tc => (
                  <div key={tc.code} onClick={() => selectCountry(tc.code)}
                    style={{ padding: '10px 14px', cursor: 'pointer', background: tc.code === country ? 'rgba(99,131,237,0.12)' : 'transparent', borderLeft: tc.code === country ? '3px solid #6483ed' : '3px solid transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{tc.flag} {tc.name}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{tc.note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 28px 80px' }}>

        {/* CONNECT WALLET CTA (no wallets) */}
        {connectedWallets.length === 0 && (
          <div style={{ ...S.card, marginBottom: 24, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Connect a wallet to see live tax data</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
              Go to the full <Link href="/tax/calculator" style={{ color: '#6483ed' }}>Tax Calculator</Link> to connect MetaMask, Rabby, or paste an address manually.
              Showing demo figures below.
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', background: '#f9731611', border: '1px solid #f9731633', borderRadius: 8, padding: '8px 14px', display: 'inline-block' }}>
              ⚠️ Demo mode — figures below are illustrative only
            </div>
          </div>
        )}

        {/* TAX YEAR SELECTOR */}
        {connectedWallets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>Tax Year:</label>
            <select value={taxYearIdx} onChange={e => handleTaxYearChange(Number(e.target.value))}
              style={{ background: S.bg, color: '#edeef0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', minWidth: 160 }}>
              {taxYears.map((y, i) => (
                <option key={i} value={i}>{y.label}{i === 0 ? ' (current)' : ''}</option>
              ))}
            </select>
            {taxYears[taxYearIdx] && (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                {formatDateShort(taxYears[taxYearIdx].startTs)} – {formatDateShort(taxYears[taxYearIdx].endTs)}
              </span>
            )}
          </div>
        )}

        {/* STATUS BAR */}
        {connectedWallets.length > 0 && (
          <div style={{ marginBottom: 16, padding: '8px 14px', background: taxError ? '#ef444411' : loadingTax || loadingAll ? '#6483ed11' : '#22c55e11', border: `1px solid ${taxError ? '#ef444433' : loadingTax || loadingAll ? '#6483ed33' : '#22c55e33'}`, borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {taxError && !loadingTax ? (
              <>
                <span style={{ color: '#ef4444' }}>⚠️ {taxError}</span>
                <button onClick={() => fetchTaxSummary(selectedWallet, taxYears[taxYearIdx])}
                  style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  Retry
                </button>
              </>
            ) : (loadingTax || loadingAll) ? (
              <span style={{ color: '#6483ed' }}>⏳ Fetching on-chain data…</span>
            ) : realTaxData ? (
              <span style={{ color: '#22c55e' }}>
                📡 {realTaxData.dataSource || 'Etherscan'} · Last fetched: {new Date(realTaxData.fetchedAt).toLocaleTimeString()}
                {' | '}<strong>{combinedTax?.walletsIncluded ?? 1}</strong> wallet{(combinedTax?.walletsIncluded ?? 1) !== 1 ? 's' : ''}
                {' · '}<strong>{(combinedTax?.totalTxCount ?? realTaxData.txCount ?? 0).toLocaleString()}</strong> txns
              </span>
            ) : (
              <span style={{ color: '#f97316' }}>⚠️ Demo mode — connect a wallet to see real data</span>
            )}
          </div>
        )}

        {/* SECTION 1 — COMBINED TAX SUMMARY (multi-wallet) */}
        {connectedWallets.length > 0 && (
          <div style={{ marginBottom: 24, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(99,131,237,0.2)' }}>
            <div style={{ background: 'linear-gradient(135deg, #1a2744 0%, #221540 100%)', padding: '16px 24px', borderBottom: '1px solid rgba(99,131,237,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                  💼 Combined Tax Summary
                  {loadingAll
                    ? <span style={{ background: '#6483ed22', color: '#6483ed', border: '1px solid #6483ed44', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>LOADING</span>
                    : combinedTax?.walletsIncluded
                    ? <span style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>LIVE</span>
                    : null}
                </div>
                <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>All wallets · All chains · {taxYears[taxYearIdx]?.label}</div>
              </div>
              {combinedTax && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>
                  <div>{combinedTax.walletsIncluded} wallet{combinedTax.walletsIncluded !== 1 ? 's' : ''} · {combinedTax.totalTxCount.toLocaleString()} txns</div>
                  {allChains.length > 0 && <div style={{ color: '#6483ed', marginTop: 2 }}>{allChains.map(ch => ch.charAt(0).toUpperCase() + ch.slice(1)).join(', ')}</div>}
                </div>
              )}
            </div>
            <div style={{ background: '#0c0d12', padding: 24 }}>
              {loadingAll ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6483ed', padding: '20px 0' }}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #6483ed44', borderTopColor: '#6483ed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Fetching all wallets<LoadingDots />
                </div>
              ) : combinedTax ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 14 }}>
                    {[
                      { icon: '📈', label: 'Total Capital Gains', value: `$${Math.abs(combinedTax.totalGains).toLocaleString()}`, color: combinedTax.totalGains >= 0 ? '#22c55e' : '#ef4444', sub: `Short: $${combinedTax.shortTermGains.toLocaleString()} · Long: $${combinedTax.longTermGains.toLocaleString()}` },
                      { icon: '💰', label: 'Total Income', value: `$${((combinedTax.stakingIncomeUsd || 0) + yieldIncomeUsd).toLocaleString()}`, color: '#6483ed', sub: `Staking: $${combinedTax.stakingIncomeUsd.toLocaleString()} · Yield: $${yieldIncomeUsd.toLocaleString()}` },
                      { icon: '🏛️', label: 'Est. Tax Due', value: c.taxFree ? 'Tax-free' : `$${combinedEstTax.toLocaleString()} ${c.currency}`, color: c.taxFree ? '#22c55e' : '#ef4444', sub: c.taxFree ? c.note : `@ ${(c.rate * 100).toFixed(0)}% effective rate` },
                    ].map((stat, i) => (
                      <div key={i} style={{ background: '#0f1017', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px' }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{stat.icon} {stat.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>{stat.sub}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, padding: '20px 0' }}>No wallet data loaded.</div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 2 — PER-WALLET ACCORDION */}
        {evmWallets.length > 0 && (
          <div style={{ ...S.card, marginBottom: 24, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>📊 Per-Wallet Breakdown</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{evmWallets.length} wallet{evmWallets.length !== 1 ? 's' : ''}</span>
            </div>
            {(allWalletsTax.length > 0 ? allWalletsTax : evmWallets.map(w => ({ wallet: w, taxData: null, taxError: null }))).map(({ wallet, taxData, taxError: wErr }, evmIdx) => {
              const isExpanded = expandedWalletIdxs.has(evmIdx);
              const globalIdx = connectedWallets.indexOf(wallet);
              const isSelected = globalIdx === selectedWalletIdx;
              const walletEstTax = calcTax(taxData, c, 0);
              return (
                <div key={evmIdx} style={{ borderBottom: evmIdx < evmWallets.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div onClick={() => toggleWalletRow(evmIdx)}
                    style={{ padding: '14px 24px', cursor: 'pointer', background: isSelected ? 'rgba(99,131,237,0.06)' : 'transparent', display: 'flex', alignItems: 'center', gap: 12, userSelect: 'none' }}>
                    <span style={{ fontSize: 14, color: '#6483ed', width: 16, flexShrink: 0 }}>{isExpanded ? '▼' : '▶'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#edeef0' }}>
                          {wallet.address.slice(0, 10)}…{wallet.address.slice(-8)}
                        </span>
                        {wallet.label && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>({wallet.label})</span>}
                      </div>
                      {!isExpanded && (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {loadingAll ? <span style={{ color: '#6483ed' }}>⏳ Fetching…</span>
                            : taxData ? (
                              <>
                                <span>Short: <strong style={{ color: '#22c55e' }}>${(taxData.shortTermGains || 0).toLocaleString()}</strong></span>
                                <span>Long: <strong style={{ color: '#22c55e' }}>${(taxData.longTermGains || 0).toLocaleString()}</strong></span>
                                <span>Est. tax: <strong style={{ color: c.taxFree ? '#22c55e' : '#ef4444' }}>{c.taxFree ? 'Free' : `$${walletEstTax.toLocaleString()}`}</strong></span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>{(taxData.txCount || 0).toLocaleString()} txns</span>
                              </>
                            ) : wErr ? <span style={{ color: '#ef4444' }}>⚠️ {wErr}</span>
                            : null}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <span style={{ background: '#6483ed22', color: '#6483ed', border: '1px solid #6483ed33', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>SELECTED</span>
                    )}
                  </div>
                  {isExpanded && taxData && (
                    <div style={{ padding: '0 24px 20px', background: S.bg }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
                        {[
                          { label: 'Capital Gains', value: `$${(taxData.totalGains || 0).toLocaleString()}`, sub: `Short: $${taxData.shortTermGains.toLocaleString()} · Long: $${taxData.longTermGains.toLocaleString()}`, color: '#22c55e' },
                          { label: 'Staking Income', value: `$${(taxData.stakingIncome?.totalUsd || 0).toLocaleString()}`, sub: `${(taxData.txCount || 0).toLocaleString()} txns`, color: '#6483ed' },
                          { label: 'Est. Tax Due', value: c.taxFree ? 'Tax-free' : `$${walletEstTax.toLocaleString()} ${c.currency}`, sub: c.taxFree ? c.note : `@ ${(c.rate * 100).toFixed(0)}% rate`, color: c.taxFree ? '#22c55e' : '#ef4444' },
                        ].map((stat, i) => (
                          <div key={i} style={{ background: '#0f1017', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>{stat.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>{stat.sub}</div>
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

        {/* TOP STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { icon: '📈', label: 'Total Capital Gains', value: loadingTax ? '⏳' : `$${capitalGains.toLocaleString()} ${c.currency}`, sub: realTaxData ? `Short: $${shortTermGains.toLocaleString()} · Long: $${longTermGains.toLocaleString()} · ${realTaxData.txCount} txns` : 'Short + long term · Demo', color: '#22c55e' },
            { icon: '💰', label: 'Total Crypto Income', value: loadingTax ? '⏳' : `$${totalIncome.toLocaleString()} ${c.currency}`, sub: `Staking: $${stakingIncomeUsd.toLocaleString()} · Yield: $${yieldIncomeUsd.toLocaleString()}`, color: '#6483ed' },
            { icon: '🏛️', label: 'Estimated Tax Due', value: loadingTax ? '⏳' : c.taxFree ? 'Tax-free' : `$${estTax.toLocaleString()} ${c.currency}`, sub: c.taxFree ? 'Tax-free jurisdiction ✅' : `@ ${(c.rate * 100).toFixed(1)}% effective rate`, color: c.taxFree ? '#22c55e' : '#ef4444' },
          ].map((stat, i) => (
            <div key={i} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ fontSize: 32 }}>{stat.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 5 }}>{stat.sub}</div>
              </div>
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                {realTaxData
                  ? <span style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>LIVE</span>
                  : <span style={{ background: '#f9731622', color: '#f97316', border: '1px solid #f9731644', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>DEMO</span>}
              </div>
            </div>
          ))}
        </div>

        {/* TRANSACTION HISTORY */}
        <div style={{ ...S.card, marginBottom: 24, overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Transaction History</span>
              {realTaxData?.transactions?.length ? (
                <span style={{ marginLeft: 10, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
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
                  style={{ background: showAllTime ? '#6483ed22' : 'rgba(255,255,255,0.05)', color: showAllTime ? '#6483ed' : 'rgba(255,255,255,0.5)', border: `1px solid ${showAllTime ? '#6483ed55' : 'rgba(255,255,255,0.1)'}`, borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {showAllTime ? '📅 All time' : '🔍 Show all time'}
                </button>
              )}
              {connectedWallets.length > 0 && selectedWallet && selectedWallet.network !== 'solana' && (
                <button onClick={() => fetchTaxSummary(selectedWallet, taxYears[taxYearIdx])} disabled={loadingTax}
                  style={{ background: '#6483ed22', color: '#6483ed', border: '1px solid #6483ed33', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: loadingTax ? 0.5 : 1 }}>
                  🔄 Refresh
                </button>
              )}
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Date', 'Type', 'Asset', 'Amount', 'From', 'To', 'Chain'].map(h => (
                  <th key={h} style={{ textAlign: 'left', color: 'rgba(255,255,255,0.35)', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingTax ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 20px', color: '#6483ed' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #6483ed44', borderTopColor: '#6483ed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Loading transactions<LoadingDots />
                    </div>
                  </td>
                </tr>
              ) : realTaxData?.transactions?.length ? (
                realTaxData.transactions.map((tx, i) => (
                  <tr key={i} style={{ background: tx.isStakingReward ? '#22c55e08' : 'transparent', borderLeft: tx.isStakingReward ? '3px solid #22c55e' : '3px solid transparent' }}>
                    <td style={{ padding: '7px 10px', color: '#edeef0', whiteSpace: 'nowrap' }}>
                      {tx.date ? new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ background: tx.isStakingReward ? '#22c55e22' : tx.type === 'ETH Received' ? '#6483ed22' : 'rgba(255,255,255,0.07)', color: tx.isStakingReward ? '#22c55e' : tx.type === 'ETH Received' ? '#6483ed' : 'rgba(255,255,255,0.5)', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', fontWeight: 600 }}>{tx.asset}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{tx.amount}</td>
                    <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 11 }}>
                      {tx.from ? tx.from.slice(0, 6) + '…' + tx.from.slice(-4) : '—'}
                    </td>
                    <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 11 }}>
                      {tx.to ? tx.to.slice(0, 6) + '…' + tx.to.slice(-4) : '—'}
                    </td>
                    <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{tx.chain || 'eth'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: 'rgba(255,255,255,0.35)' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
                    {realTaxData ? (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#edeef0' }}>No transactions for {taxYears[taxYearIdx]?.label}</div>
                        <div style={{ fontSize: 13, marginBottom: 12 }}>Try a different tax year, or show your full history</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#edeef0' }}>No wallet connected</div>
                        <div style={{ fontSize: 13 }}>Connect a wallet on the <Link href="/tax/calculator" style={{ color: '#6483ed' }}>Tax Calculator</Link> page to see your transactions</div>
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
          <div style={{ ...S.card }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>📊 Tax Breakdown</div>
            {combinedTax && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Combined across all wallets & chains</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {[
                { label: 'Short-term gains', val: `+$${displayShortTerm.toLocaleString()}`, color: '#22c55e', sub: null },
                {
                  label: `Long-term gains (${c.cgtDiscount ? (c.cgtDiscount * 100).toFixed(0) + '% discount' : c.longTermExempt ? 'exempt >12mo' : c.cgtInclusion ? (c.cgtInclusion * 100).toFixed(0) + '% inclusion' : c.ltcgRate ? (c.ltcgRate * 100).toFixed(0) + '% LTCG' : 'full rate'})`,
                  val: `+$${displayLongTerm.toLocaleString()}`,
                  color: '#22c55e',
                  sub: c.cgtDiscount ? `→ $${Math.round(displayLongTerm * (1 - c.cgtDiscount)).toLocaleString()} taxable` : c.longTermExempt ? '→ $0 taxable (exempt)' : null,
                },
                { label: 'Staking income', val: `+$${displayStaking.toLocaleString()}`, color: '#6483ed', sub: null },
                { label: 'Yield income (DeFi positions)', val: `+$${yieldIncomeUsd.toLocaleString()}`, color: '#6483ed', sub: yieldIncome?.positionCount ? `${yieldIncome.positionCount} active positions` : null },
                {
                  label: `Gas fees paid (${(c.code === 'AU' || c.code === 'US' || c.code === 'GB') ? 'deductible ✅' : 'not deductible'})`,
                  val: loadingGas ? '⏳' : gasData ? `-$${gasDeductionUsd.toFixed(2)}` : '-$0.00',
                  color: '#10b981',
                  sub: gasData ? `${(gasData.totalGasEth || 0).toFixed(6)} ETH across Base + Arb + Eth` : 'Fetching…',
                },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: S.bg, borderRadius: 8, marginBottom: 2 }}>
                  <div>
                    <div style={{ fontSize: 13 }}>{row.label}</div>
                    {row.sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{row.sub}</div>}
                  </div>
                  <span style={{ fontWeight: 700, color: row.color, fontSize: 14 }}>{row.val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#6483ed11', border: '1px solid #6483ed33', borderRadius: 8, marginTop: 4 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Net Taxable Amount</div>
                  {combinedTax && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>All wallets combined</div>}
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: c.taxFree ? '#22c55e' : '#6483ed' }}>
                  {c.taxFree ? `$0 (tax-free ✅)` : `$${Math.round(displayNetTaxable).toLocaleString()} ${c.currency}`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, marginTop: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Estimated Tax Due</div>
                <span style={{ fontSize: 18, fontWeight: 900, color: c.taxFree ? '#22c55e' : '#ef4444' }}>
                  {c.taxFree ? 'Tax-free ✅' : `$${displayEstTax.toLocaleString()} ${c.currency}`}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: realTaxData ? '#22c55e88' : '#f9731677' }}>
              {realTaxData
                ? `✅ Live data from your connected wallet via Etherscan. Last updated: ${new Date(realTaxData.fetchedAt).toLocaleString()}.`
                : '⚠️ Demo figures only — not financial or tax advice. Consult a qualified tax professional.'}
            </div>
          </div>

          {/* Tax-Loss Harvesting */}
          <div style={{ ...S.card }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🌿 Tax-Loss Harvesting
              {isLiveHarvest
                ? <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, textTransform: 'none' }}>LIVE</span>
                : <span style={{ fontSize: 10, color: '#f97316', fontWeight: 600, textTransform: 'none' }}>ILLUSTRATIVE</span>}
            </div>
            <div style={{ background: '#22c55e22', border: '1px solid #22c55e33', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>
                {harvestData.length} {isLiveHarvest ? 'opportunities found' : 'illustrative opportunities'}
              </span>
            </div>
            {connectedWallets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔗</div>
                Connect a wallet to see real harvesting opportunities
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Asset', 'Position', 'Unrealised Loss', 'Recommendation'].map(h => (
                      <th key={h} style={{ textAlign: 'left', color: 'rgba(255,255,255,0.35)', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {harvestData.map((opp, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', fontWeight: 700 }}>{opp.asset}</td>
                      <td style={{ padding: '10px', color: '#edeef0' }}>{opp.position}</td>
                      <td style={{ padding: '10px', color: '#ef4444', fontWeight: 700 }}>${opp.unrealisedLoss}</td>
                      <td style={{ padding: '10px', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{opp.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 12, background: '#22c55e11', border: '1px solid #22c55e22', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#22c55e' }}>
              💡 Total potential savings: <strong>${harvestData.reduce((s, o) => s + Math.abs(o.unrealisedLoss), 0).toFixed(2)}</strong>{!isLiveHarvest ? ' (illustrative)' : ''}
            </div>
          </div>
        </div>

        {/* HOLDING PERIOD TRACKER */}
        <div style={{ ...S.card, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⏰ Holding Period Tracker
            {isLiveHolding
              ? <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, textTransform: 'none' }}>● LIVE</span>
              : <span style={{ fontSize: 10, color: '#f97316', fontWeight: 600, textTransform: 'none' }}>DEMO</span>}
          </div>
          <div style={{ background: approaching > 0 ? '#f9731622' : '#22c55e22', border: `1px solid ${approaching > 0 ? '#f9731633' : '#22c55e33'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>{approaching > 0 ? '⚠️' : '✅'}</span>
            <span style={{ fontSize: 13, color: approaching > 0 ? '#f97316' : '#22c55e', fontWeight: 600 }}>
              {approaching > 0 ? `${approaching} positions approaching 12-month CGT threshold` : 'All positions within CGT threshold'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {holdingPeriods.map((p, i) => (
              <div key={i} style={{ background: S.bg, borderRadius: 10, padding: '14px 16px', border: p.qualified ? '1px solid #22c55e44' : p.daysToThreshold <= 30 ? '1px solid #ef444444' : '1px solid #f9731644' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.asset}</div>
                  {p.qualified
                    ? <span style={{ background: '#22c55e22', color: '#22c55e', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>✅ Qualified</span>
                    : p.daysToThreshold <= 30
                    ? <span style={{ background: '#ef444422', color: '#ef4444', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>🔥 {p.daysToThreshold}d left</span>
                    : <span style={{ background: '#f9731622', color: '#f97316', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>⚠️ {p.daysToThreshold}d left</span>}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Acquired: {p.acquiredDate} · {p.daysHeld.toFixed(0)} days held</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Position: <span style={{ color: '#edeef0', fontWeight: 600 }}>{p.value}</span></div>
                {!p.qualified && p.potentialSaving && (
                  <div style={{ fontSize: 11, color: '#22c55e', background: '#22c55e11', borderRadius: 6, padding: '6px 10px' }}>
                    💰 Hold to qualify → est. CGT saving: <strong>{p.potentialSaving}</strong>
                  </div>
                )}
                {p.qualified && (
                  <div style={{ fontSize: 11, color: '#22c55e' }}>
                    ✅ CGT discount applies — {c.cgtDiscount ? `${(c.cgtDiscount * 100).toFixed(0)}% discount` : c.longTermExempt ? 'fully exempt' : 'check jurisdiction rules'}
                  </div>
                )}
                {p.demo && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>Demo position</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* YIELD INCOME FROM POSITIONS */}
        {(yieldIncome || true) && (
          <div style={{ ...S.card, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 PassiveBlocks Yield Income
              {yieldIncome ? <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, textTransform: 'none' }}>● LIVE</span> : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
              {[
                { label: 'Total Earned (YTD)', value: `$${(yieldIncome?.totalEarnedUsd || 0).toFixed(2)}`, color: '#22c55e' },
                { label: 'Daily Rate', value: `$${(yieldIncome?.dailyRateUsd || 0.11).toFixed(4)}/day`, color: '#6483ed' },
                { label: 'Active Positions', value: String(yieldIncome?.positionCount || 2), color: '#f97316' },
              ].map((stat, i) => (
                <div key={i} style={{ background: S.bg, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>{stat.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', background: '#6483ed11', border: '1px solid #6483ed22', borderRadius: 8, padding: '10px 14px' }}>
              ℹ️ Yield income from Fluid Base (~5.19% APY) + Fluid Arbitrum (~4.63% APY). Treated as ordinary income in most jurisdictions.
              {!yieldIncome && ' Live data loading…'}
            </div>
          </div>
        )}

        {/* FOOTER DISCLAIMER */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '20px 0' }}>
          Tax estimates only — not financial or tax advice. Consult a qualified accountant for your specific situation.
        </div>

      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '32px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/">
            <Image src="/passiveblocks_logo_cropped.png" alt="PassiveBlocks" width={130} height={30} style={{ height: 32, width: 'auto', opacity: 0.4 }} />
          </Link>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} PassiveBlocks</span>
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
