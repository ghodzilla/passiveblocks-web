"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

type TradeType = "buy" | "sell" | "yield" | "fee" | "trade" | "airdrop" | "gift_received" | "lost_stolen" | "fork";

type AccountingMethod = "FIFO" | "LIFO" | "HIFO";

type Network = "ethereum" | "base" | "arbitrum" | "optimism" | "polygon" | "solana";

type CsvSource = "binance" | "coinbase" | "kraken" | "generic";

interface Wallet {
  id: string;
  address: string;
  network: Network;
  label: string;
}

interface Trade {
  id: string;
  date: string;
  type: TradeType;
  asset: string;
  quantity: number;
  priceUsd: number;
  notes: string;
}

interface MatchedGain {
  sellDate: string;
  asset: string;
  qty: number;
  proceeds: number;
  costBasis: number;
  gain: number;
  isLongTerm: boolean;
  daysHeld: number;
  buyDate: string;
}

interface CsvPreview {
  source: CsvSource;
  parsed: Trade[];
  rawRows: string[][];
}

// ─── Country rules ────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "AU", flag: "🇦🇺", name: "Australia",      rate: 0.325,  cgtDiscount: 0.50,  note: "50% CGT discount >12mo",         currency: "AUD", longTermMonths: 12 },
  { code: "US", flag: "🇺🇸", name: "United States",  rate: 0.24,   ltcgRate: 0.15,     note: "Short-term = ordinary income",   currency: "USD", longTermMonths: 12 },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom", rate: 0.20,   cgtAllowance: 3000, note: "£3k CGT allowance",              currency: "GBP", longTermMonths: 0  },
  { code: "CA", flag: "🇨🇦", name: "Canada",         rate: 0.2653, cgtInclusion: 0.50, note: "50% CGT inclusion rate",         currency: "CAD", longTermMonths: 0  },
  { code: "DE", flag: "🇩🇪", name: "Germany",        rate: 0.26375,longTermExempt: true,note: "Tax-free after 12 months",       currency: "EUR", longTermMonths: 12 },
  { code: "IN", flag: "🇮🇳", name: "India",          rate: 0.312,  flat: true,          note: "Flat 30% + 4% cess on all gains",currency: "INR", longTermMonths: 0  },
  { code: "SG", flag: "🇸🇬", name: "Singapore",      rate: 0,      taxFree: true,       note: "No CGT for individuals",        currency: "SGD", longTermMonths: 0  },
  { code: "AE", flag: "🇦🇪", name: "UAE",            rate: 0,      taxFree: true,       note: "No personal CGT",               currency: "AED", longTermMonths: 0  },
  { code: "NZ", flag: "🇳🇿", name: "New Zealand",    rate: 0,      taxFree: true,       note: "No CGT generally",              currency: "NZD", longTermMonths: 0  },
] as const;

type CountryCode = typeof COUNTRIES[number]["code"];
type Country = typeof COUNTRIES[number];

function getCountry(code: CountryCode): Country {
  return COUNTRIES.find((c) => c.code === code) as Country;
}

function calcEstimatedTax(country: Country, shortGains: number, longGains: number, yieldIncome: number): number {
  if ((country as { taxFree?: boolean }).taxFree) return 0;
  const rate = country.rate;
  let capitalTax = 0;

  if (country.code === "AU") {
    const c = country as { cgtDiscount: number };
    capitalTax = (shortGains + longGains * (1 - c.cgtDiscount)) * rate;
  } else if (country.code === "US") {
    const c = country as { ltcgRate: number };
    capitalTax = shortGains * rate + longGains * c.ltcgRate;
  } else if (country.code === "GB") {
    const c = country as { cgtAllowance: number };
    const taxable = Math.max(0, shortGains + longGains - c.cgtAllowance);
    capitalTax = taxable * rate;
  } else if (country.code === "CA") {
    const c = country as { cgtInclusion: number };
    capitalTax = (shortGains + longGains) * c.cgtInclusion * rate;
  } else if (country.code === "DE") {
    capitalTax = shortGains * rate; // long-term exempt
  } else {
    capitalTax = (shortGains + longGains) * rate;
  }

  const incomeTax = yieldIncome * rate;
  return Math.max(0, Math.round(capitalTax + incomeTax));
}

// ─── Accounting method gain calculator ───────────────────────────────────────

function calcGains(trades: Trade[], longTermMonths: number, method: AccountingMethod = "FIFO"): MatchedGain[] {
  const buyQueues: Record<string, { date: string; qty: number; price: number }[]> = {};
  const gains: MatchedGain[] = [];

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));

  // Normalise trades: airdrop/fork/gift_received = buy at market price; lost_stolen = sell at $0; trade = sell outgoing + buy incoming
  const normalised: Trade[] = [];
  for (const t of sorted) {
    if (t.type === "buy" || t.type === "airdrop" || t.type === "fork" || t.type === "gift_received") {
      normalised.push({ ...t, type: "buy" });
    } else if (t.type === "sell" || t.type === "fee") {
      normalised.push({ ...t, type: "sell" });
    } else if (t.type === "lost_stolen") {
      normalised.push({ ...t, type: "sell", priceUsd: 0 });
    } else if (t.type === "trade") {
      // treat the whole trade as a sell of the given asset (outgoing at market)
      normalised.push({ ...t, type: "sell" });
    } else if (t.type === "yield") {
      // yield is income, not a disposal — skip for CGT (handled separately)
    } else {
      normalised.push(t);
    }
  }

  for (const t of normalised) {
    if (t.type === "buy") {
      if (!buyQueues[t.asset]) buyQueues[t.asset] = [];
      buyQueues[t.asset].push({ date: t.date, qty: t.quantity, price: t.priceUsd });
    }
    if (t.type === "sell") {
      let remaining = t.quantity;
      const queue = buyQueues[t.asset] || [];

      // Sort queue per method before matching
      if (method === "LIFO") {
        queue.sort((a, b) => b.date.localeCompare(a.date));
      } else if (method === "HIFO") {
        queue.sort((a, b) => b.price - a.price);
      } else {
        // FIFO: already sorted by date ascending
        queue.sort((a, b) => a.date.localeCompare(b.date));
      }

      while (remaining > 0 && queue.length > 0) {
        const lot = queue[0];
        const matched = Math.min(remaining, lot.qty);
        const sellMs = new Date(t.date).getTime();
        const buyMs = new Date(lot.date).getTime();
        const daysHeld = Math.floor((sellMs - buyMs) / 86400000);
        const isLongTerm = longTermMonths > 0 && daysHeld >= longTermMonths * 30;
        const proceeds = matched * t.priceUsd;
        const costBasis = matched * lot.price;
        gains.push({
          sellDate: t.date,
          asset: t.asset,
          qty: matched,
          proceeds,
          costBasis,
          gain: proceeds - costBasis,
          isLongTerm,
          daysHeld,
          buyDate: lot.date,
        });
        lot.qty -= matched;
        remaining -= matched;
        if (lot.qty <= 0) queue.shift();
      }
    }
  }
  return gains;
}

// ─── Financial year helpers ───────────────────────────────────────────────────

type TaxYear =
  | "all"
  | "fy2024-25"
  | "fy2023-24"
  | "fy2022-23"
  | "cal2024"
  | "cal2023";

interface YearRange {
  start: string;
  end: string;
  label: string;
}

const TAX_YEAR_RANGES: Record<TaxYear, YearRange> = {
  "all":       { start: "0000-01-01", end: "9999-12-31", label: "All time" },
  "fy2024-25": { start: "2024-07-01", end: "2025-06-30", label: "FY 2024-25 (Jul 24 – Jun 25)" },
  "fy2023-24": { start: "2023-07-01", end: "2024-06-30", label: "FY 2023-24 (Jul 23 – Jun 24)" },
  "fy2022-23": { start: "2022-07-01", end: "2023-06-30", label: "FY 2022-23 (Jul 22 – Jun 23)" },
  "cal2024":   { start: "2024-01-01", end: "2024-12-31", label: "Calendar 2024" },
  "cal2023":   { start: "2023-01-01", end: "2023-12-31", label: "Calendar 2023" },
};

function filterTradesByYear(trades: Trade[], year: TaxYear): Trade[] {
  if (year === "all") return trades;
  const { start, end } = TAX_YEAR_RANGES[year];
  return trades.filter((t) => t.date >= start && t.date <= end);
}

// ─── CSV parsers ──────────────────────────────────────────────────────────────

function stripBOM(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { fields.push(current); current = ""; }
      else { current += ch; }
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(text: string): string[][] {
  const clean = stripBOM(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return clean.split("\n").filter((l) => l.trim()).map(parseCSVLine);
}

function tradeHash(t: Omit<Trade, "id">): string {
  return `${t.date}|${t.type}|${t.asset}|${t.quantity.toFixed(8)}`;
}

function parseBinanceCSV(rows: string[][]): Trade[] {
  // Date(UTC),Pair,Side,Price,Executed,Amount,Fee
  const trades: Trade[] = [];
  for (const row of rows.slice(1)) {
    if (row.length < 7) continue;
    const [dateRaw, , side, priceRaw, executedRaw] = row;
    if (!dateRaw || !side) continue;
    // date: "2024-01-15 10:23:45"
    const date = dateRaw.trim().slice(0, 10);
    const type: TradeType = side.trim().toUpperCase() === "BUY" ? "buy" : "sell";
    // executed: "0.5 ETH"
    const execParts = executedRaw.trim().split(" ");
    const qty = parseFloat(execParts[0]) || 0;
    const asset = (execParts[1] || "").toUpperCase();
    const priceUsd = parseFloat(priceRaw) || 0;
    if (!asset || qty <= 0) continue;
    const t: Omit<Trade, "id"> = { date, type, asset, quantity: qty, priceUsd, notes: "Binance import" };
    trades.push({ ...t, id: tradeHash(t) });
  }
  return trades;
}

function parseCoinbaseCSV(rows: string[][]): Trade[] {
  // Timestamp,Transaction Type,Asset,Quantity Transacted,Spot Price Currency,Spot Price at Transaction,...
  const trades: Trade[] = [];
  for (const row of rows.slice(1)) {
    if (row.length < 6) continue;
    const [tsRaw, txType, asset, qtyRaw, , priceRaw] = row;
    if (!tsRaw || !txType) continue;
    const date = tsRaw.trim().slice(0, 10).replace("T", " ").slice(0, 10);
    const qty = parseFloat(qtyRaw) || 0;
    const priceUsd = parseFloat(priceRaw) || 0;
    const sym = asset.trim().toUpperCase();
    if (!sym || qty <= 0) continue;

    let type: TradeType;
    const txNorm = txType.trim().toLowerCase();
    if (txNorm === "buy") type = "buy";
    else if (txNorm === "sell") type = "sell";
    else if (txNorm === "receive") type = "buy";
    else if (txNorm === "send") type = "sell";
    else if (txNorm === "rewards income" || txNorm === "staking income") type = "yield";
    else if (txNorm === "convert") type = "trade";
    else continue; // skip unknowns

    const t: Omit<Trade, "id"> = { date, type, asset: sym, quantity: qty, priceUsd, notes: "Coinbase import" };
    trades.push({ ...t, id: tradeHash(t) });
  }
  return trades;
}

function parseKrakenCSV(rows: string[][]): Trade[] {
  // txid,refid,time,type,subtype,aclass,asset,amount,fee,balance
  const trades: Trade[] = [];
  for (const row of rows.slice(1)) {
    if (row.length < 9) continue;
    const [, , timeRaw, typeRaw, , , assetRaw, amountRaw] = row;
    if (!timeRaw || !typeRaw) continue;
    const date = timeRaw.trim().slice(0, 10);
    const amount = parseFloat(amountRaw) || 0;
    if (amount === 0) continue;

    // Strip Kraken's .S / X / Z prefix/suffix quirks
    const sym = assetRaw.trim().replace(/^X/, "").replace(/^Z/, "").toUpperCase();
    if (!sym) continue;

    let type: TradeType;
    const txNorm = typeRaw.trim().toLowerCase();
    if (txNorm === "trade") type = amount > 0 ? "buy" : "sell";
    else if (txNorm === "deposit") type = "buy";
    else if (txNorm === "withdrawal") type = "sell";
    else if (txNorm === "staking" || txNorm === "earn") type = "yield";
    else continue;

    const t: Omit<Trade, "id"> = { date, type, asset: sym, quantity: Math.abs(amount), priceUsd: 0, notes: "Kraken import" };
    trades.push({ ...t, id: tradeHash(t) });
  }
  return trades;
}

function parseGenericCSV(rows: string[][]): Trade[] {
  // date,type,asset,quantity,price_usd,notes
  const trades: Trade[] = [];
  for (const row of rows.slice(1)) {
    if (row.length < 5) continue;
    const [dateRaw, typeRaw, assetRaw, qtyRaw, priceRaw, notesRaw] = row;
    const date = dateRaw.trim().slice(0, 10);
    const type = (typeRaw.trim().toLowerCase()) as TradeType;
    const validTypes: TradeType[] = ["buy", "sell", "trade", "yield", "airdrop", "gift_received", "lost_stolen", "fee", "fork"];
    if (!validTypes.includes(type)) continue;
    const qty = parseFloat(qtyRaw) || 0;
    const priceUsd = parseFloat(priceRaw) || 0;
    const asset = assetRaw.trim().toUpperCase();
    if (!asset || qty <= 0) continue;
    const t: Omit<Trade, "id"> = { date, type, asset, quantity: qty, priceUsd, notes: notesRaw?.trim() || "Generic import" };
    trades.push({ ...t, id: tradeHash(t) });
  }
  return trades;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

const EXAMPLE_TRADES: Trade[] = [];

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(gains: MatchedGain[], yieldTotal: number, country: Country, method: AccountingMethod) {
  const rows = [
    ["Asset", "Buy Date", "Sell Date", "Days Held", "Classification", "Qty", "Cost Basis (USD)", "Proceeds (USD)", "Gain/Loss (USD)"],
    ...gains.map((g) => [
      g.asset, g.buyDate, g.sellDate, g.daysHeld,
      g.isLongTerm ? "Long-term" : "Short-term",
      fmt(g.qty, 4), fmt(g.costBasis), fmt(g.proceeds), fmt(g.gain),
    ]),
    [],
    ["Yield Income (USD)", fmt(yieldTotal)],
    ["Country", country.name],
    ["Accounting Method", method],
    ["Short-term gains", fmt(gains.filter(g => !g.isLongTerm).reduce((s, g) => s + g.gain, 0))],
    ["Long-term gains", fmt(gains.filter(g => g.isLongTerm).reduce((s, g) => s + g.gain, 0))],
    ["Tax note", `${country.note} — this is an estimate only, not financial advice`],
  ];

  const csv = rows.map((r) => r.map(String).map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `passiveblocks-tax-${country.code}-${method}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

const BLANK_TRADE: Omit<Trade, "id"> = { date: "", type: "buy", asset: "", quantity: 0, priceUsd: 0, notes: "" };

const NETWORKS: { code: Network; label: string; icon: string; evm: boolean }[] = [
  { code: "ethereum", label: "Ethereum", icon: "⟠",  evm: true  },
  { code: "base",     label: "Base",     icon: "🔵", evm: true  },
  { code: "arbitrum", label: "Arbitrum", icon: "🔷", evm: true  },
  { code: "optimism", label: "Optimism", icon: "🔴", evm: true  },
  { code: "polygon",  label: "Polygon",  icon: "🟣", evm: true  },
  { code: "solana",   label: "Solana",   icon: "◎",  evm: false },
];

const BLANK_WALLET: Omit<Wallet, "id"> = { address: "", network: "ethereum", label: "" };

const CSV_SOURCES: { id: CsvSource; label: string; hint: string }[] = [
  { id: "binance",  label: "Binance",  hint: "Trade History export — Date(UTC), Pair, Side, Price, Executed, Amount, Fee" },
  { id: "coinbase", label: "Coinbase", hint: "Transaction History — Timestamp, Transaction Type, Asset, Quantity…" },
  { id: "kraken",   label: "Kraken",   hint: "Ledgers export — txid, refid, time, type, subtype, aclass, asset, amount, fee, balance" },
  { id: "generic",  label: "Generic",  hint: "Our template — date, type, asset, quantity, price_usd, notes" },
];

export default function TaxCalculatorPage() {
  const [trades, setTrades] = useState<Trade[]>(EXAMPLE_TRADES);
  const [countryCode, setCountryCode] = useState<CountryCode>("AU");
  const [accountingMethod, setAccountingMethod] = useState<AccountingMethod>("FIFO");
  const [taxYear, setTaxYear] = useState<TaxYear>("all");
  const [form, setForm] = useState<Omit<Trade, "id">>(BLANK_TRADE);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // CSV import state
  const [csvTab, setCsvTab] = useState<CsvSource>("binance");
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [csvImportMsg, setCsvImportMsg] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Wallet state
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletForm, setWalletForm] = useState<Omit<Wallet, "id">>(BLANK_WALLET);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);
  const [scanningAll, setScanningAll] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Record<string, boolean>>({
    metamask: false, rabby: false, phantom: false,
    coinbase: false, rainbow: false, trust: false,
    ledger: false, walletconnect: false,
  });
  const [showPhantomPicker, setShowPhantomPicker] = useState(false);
  const [ledgerConnecting, setLedgerConnecting] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("pb_tax_wallets");
    if (saved) { try { setWallets(JSON.parse(saved)); } catch {} }
    detectWallets();
    const t1 = setTimeout(detectWallets, 500);
    const t2 = setTimeout(detectWallets, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showPhantomPicker) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-phantom-picker]")) setShowPhantomPicker(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showPhantomPicker]);

  // Auto-reset LIFO/HIFO to FIFO when AU is selected (ATO requirement)
  useEffect(() => {
    if (countryCode === "AU" && accountingMethod !== "FIFO") {
      setAccountingMethod("FIFO");
    }
  }, [countryCode]); // eslint-disable-line react-hooks/exhaustive-deps

  function detectWallets() {
    if (typeof window === "undefined") return;
    const win = window as unknown as Record<string, unknown>;
    const eth = win.ethereum as Record<string, unknown> | undefined;
    const hasUsb = typeof navigator !== "undefined" && !!(navigator as unknown as Record<string, unknown>).usb;
    setInstalled({
      metamask:     !!(eth?.isMetaMask && !eth?.isRabby),
      rabby:        !!(eth?.isRabby),
      phantom:      !!(win.phantom || (win.solana as Record<string, unknown>)?.isPhantom),
      coinbase:     !!(eth?.isCoinbaseWallet || win.coinbaseWalletExtension),
      rainbow:      !!(eth?.isRainbow),
      trust:        !!(eth?.isTrust || eth?.isTrustWallet || win.trustwallet),
      ledger:       hasUsb,
      walletconnect: false,
    });
  }

  function saveWallets(next: Wallet[]) {
    setWallets(next);
    localStorage.setItem("pb_tax_wallets", JSON.stringify(next));
  }

  function getEVMProvider(flag: string): { request: (a: { method: string }) => Promise<string[]> } | null {
    if (typeof window === "undefined") return null;
    const eth = (window as unknown as Record<string, Record<string, unknown>>).ethereum;
    if (!eth) return null;
    if (eth[flag]) return eth as unknown as { request: (a: { method: string }) => Promise<string[]> };
    if (Array.isArray(eth.providers)) {
      const match = (eth.providers as Record<string, unknown>[]).find(p => p[flag]);
      return match ? match as unknown as { request: (a: { method: string }) => Promise<string[]> } : null;
    }
    return null;
  }

  async function connectEVM(provider: { request: (a: { method: string }) => Promise<string[]> }, wLabel: string) {
    setConnecting(true);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (!accounts?.length) return;
      const addr = accounts[0].toLowerCase();
      const toAdd: Wallet[] = [];
      for (const net of NETWORKS) {
        if (!wallets.find((w) => w.address === addr && w.network === net.code)) {
          toAdd.push({ id: uid(), address: addr, network: net.code, label: wLabel });
        }
      }
      if (toAdd.length) saveWallets([...wallets, ...toAdd]);
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string };
      if (err.code !== 4001) alert("Connection error: " + (err.message || String(e)));
    } finally {
      setConnecting(false);
    }
  }

  async function connectMetaMask() {
    const p = getEVMProvider("isMetaMask");
    if (!p || (p as unknown as Record<string, unknown>).isRabby) { window.open("https://metamask.io/download/", "_blank"); return; }
    await connectEVM(p, "MetaMask");
  }
  async function connectRabby() {
    const p = getEVMProvider("isRabby");
    if (!p) { window.open("https://rabby.io/", "_blank"); return; }
    await connectEVM(p, "Rabby");
  }
  async function connectCoinbase() {
    const p = getEVMProvider("isCoinbaseWallet");
    if (!p) { window.open("https://www.coinbase.com/wallet", "_blank"); return; }
    await connectEVM(p, "Coinbase Wallet");
  }
  async function connectRainbow() {
    const p = getEVMProvider("isRainbow");
    if (!p) { window.open("https://rainbow.me/", "_blank"); return; }
    await connectEVM(p, "Rainbow");
  }
  async function connectTrust() {
    const p = getEVMProvider("isTrust") || getEVMProvider("isTrustWallet");
    if (!p) { window.open("https://trustwallet.com/browser-extension", "_blank"); return; }
    await connectEVM(p, "Trust Wallet");
  }
  async function connectPhantomEVM() {
    setShowPhantomPicker(false);
    const win = window as unknown as Record<string, Record<string, unknown>>;
    const p = win.phantom?.ethereum as unknown as { request: (a: { method: string }) => Promise<string[]> } | undefined;
    if (!p) { alert("Enable EVM in Phantom settings, then refresh."); return; }
    await connectEVM(p, "Phantom (EVM)");
  }
  async function connectPhantomSolana() {
    setShowPhantomPicker(false);
    alert("Solana trade import coming soon. Add your Solana address manually if needed.");
  }
  async function connectLedger() {
    const hasUsb = typeof navigator !== "undefined" && !!(navigator as unknown as Record<string, unknown>).usb;
    if (!hasUsb) {
      window.open("https://www.ledger.com/", "_blank"); return;
    }
    setLedgerConnecting(true);
    alert("Ledger WebUSB: add your EVM address manually for now. (Full USB support coming soon)");
    setLedgerConnecting(false);
  }

  function addWallet() {
    const raw = walletForm.address.trim();
    const isEVM = /^0x[0-9a-fA-F]{40}$/.test(raw);
    const isSolana = !raw.startsWith("0x") && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw);
    if (!isEVM && !isSolana) {
      alert("Enter a valid EVM address (0x…) or Solana base58 address.");
      return;
    }
    const addr = isEVM ? raw.toLowerCase() : raw;
    const network: Network = isSolana ? "solana" : walletForm.network;
    if (wallets.find((w) => w.address === addr && w.network === network)) {
      alert("This address + network is already added."); return;
    }
    const w: Wallet = { ...walletForm, address: addr, network, id: uid() };
    saveWallets([...wallets, w]);
    setWalletForm(BLANK_WALLET);
  }

  function removeWallet(id: string) {
    saveWallets(wallets.filter((w) => w.id !== id));
  }

  function removeWalletByAddress(address: string) {
    saveWallets(wallets.filter((w) => w.address !== address));
  }

  async function importAllChains(address: string) {
    let totalFresh = 0;
    let errorMsg: string | null = null;
    for (const net of NETWORKS) {
      if (net.code === "solana") {
        // Solana: call API with the address directly
        const solWallet = wallets.find((x) => x.address === address && x.network === "solana");
        if (!solWallet) continue;
        setImportingId(solWallet.id);
        try {
          const res = await fetch(`/api/wallet-import?address=${address}&network=solana`);
          const data = await res.json();
          if (data.error) {
            if (!errorMsg) errorMsg = data.error;
          } else {
            const incoming = data.trades as Trade[];
            setTrades((prev) => {
              const existingIds = new Set(prev.map((t) => t.id));
              const fresh = incoming.filter((t) => !existingIds.has(t.id));
              totalFresh += fresh.length;
              return [...prev, ...fresh];
            });
          }
        } catch (e) {
          if (!errorMsg) errorMsg = String(e);
        }
        continue;
      }
      const w = wallets.find((x) => x.address === address && x.network === net.code);
      if (!w) continue;
      setImportingId(w.id);
      try {
        const res = await fetch(`/api/wallet-import?address=${address}&network=${net.code}`);
        const data = await res.json();
        if (data.error) {
          if (!errorMsg) errorMsg = data.error;
        } else {
          const incoming = data.trades as Trade[];
          setTrades((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const fresh = incoming.filter((t) => !existingIds.has(t.id));
            totalFresh += fresh.length;
            return [...prev, ...fresh];
          });
        }
      } catch (e) {
        if (!errorMsg) errorMsg = String(e);
      }
    }
    setImportingId(null);
    const statusMsg = errorMsg
      ? `Error: ${errorMsg}`
      : `Imported ${totalFresh} new trades across all chains`;
    setImportMsg((m) => ({ ...m, [address]: statusMsg }));
  }

  async function importWallet(w: Wallet) {
    setImportingId(w.id);
    setImportMsg((m) => ({ ...m, [w.id]: "Fetching transactions…" }));
    try {
      const res = await fetch(`/api/wallet-import?address=${w.address}&network=${w.network}`);
      const data = await res.json();
      if (data.error) {
        setImportMsg((m) => ({ ...m, [w.id]: `Error: ${data.error}` }));
      } else {
        const incoming = data.trades as Trade[];
        const existingIds = new Set(trades.map((t) => t.id));
        const fresh = incoming.filter((t) => !existingIds.has(t.id));
        setTrades((prev) => [...prev, ...fresh]);
        setImportMsg((m) => ({ ...m, [w.id]: `Imported ${fresh.length} trades (${incoming.length - fresh.length} already present)` }));
      }
    } catch (e) {
      setImportMsg((m) => ({ ...m, [w.id]: `Failed: ${String(e)}` }));
    } finally {
      setImportingId(null);
    }
  }

  async function scanAllWallets() {
    const evmNetworks = NETWORKS.filter((n) => n.evm);
    const uniqueAddresses = Array.from(new Set(wallets.filter((w) => w.network !== "solana").map((w) => w.address)));
    if (!uniqueAddresses.length) { setScanError("No EVM wallets connected."); return; }
    setScanningAll(true);
    setScanError(null);
    setScanMsg(null);
    let grandTotal = 0;
    let keyMissing = false;
    for (const addr of uniqueAddresses) {
      for (const net of evmNetworks) {
        try {
          const res = await fetch(`/api/wallet-import?address=${addr}&network=${net.code}`);
          const data = await res.json();
          if (data.error) {
            if (String(data.error).toLowerCase().includes("not configured")) {
              keyMissing = true;
            }
          } else {
            const incoming = data.trades as Trade[];
            setTrades((prev) => {
              const existingIds = new Set(prev.map((t) => t.id));
              const fresh = incoming.filter((t) => !existingIds.has(t.id));
              grandTotal += fresh.length;
              return [...prev, ...fresh];
            });
          }
        } catch {}
      }
    }
    setScanningAll(false);
    if (keyMissing) {
      setScanError("Scan requires an Etherscan API key — contact support.");
    } else {
      setScanMsg(`Scan complete — ${grandTotal} new trade${grandTotal !== 1 ? "s" : ""} imported across ${uniqueAddresses.length} wallet${uniqueAddresses.length > 1 ? "s" : ""} and all chains.`);
    }
  }

  // ─── CSV import handlers ──────────────────────────────────────────────────

  function handleCsvFile(file: File) {
    setCsvPreview(null);
    setCsvImportMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) { setCsvImportMsg("File appears empty or unreadable."); return; }

      let parsed: Trade[] = [];
      if (csvTab === "binance")  parsed = parseBinanceCSV(rows);
      else if (csvTab === "coinbase") parsed = parseCoinbaseCSV(rows);
      else if (csvTab === "kraken")   parsed = parseKrakenCSV(rows);
      else                             parsed = parseGenericCSV(rows);

      if (parsed.length === 0) { setCsvImportMsg("No recognised transactions found. Check the format matches the selected exchange."); return; }
      setCsvPreview({ source: csvTab, parsed, rawRows: rows });
    };
    reader.readAsText(file);
  }

  function confirmCsvImport() {
    if (!csvPreview) return;
    const existingHashes = new Set(trades.map((t) => t.id));
    const fresh = csvPreview.parsed.filter((t) => !existingHashes.has(t.id));
    const dupes = csvPreview.parsed.length - fresh.length;
    setTrades((prev) => [...prev, ...fresh]);
    setCsvImportMsg(`Imported ${fresh.length} new trades${dupes > 0 ? ` (${dupes} duplicate${dupes > 1 ? "s" : ""} skipped)` : ""}.`);
    setCsvPreview(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  function cancelCsvPreview() {
    setCsvPreview(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  // ─── Computed values ──────────────────────────────────────────────────────

  const country = getCountry(countryCode);

  const filteredTrades = useMemo(
    () => filterTradesByYear(trades, taxYear),
    [trades, taxYear]
  );

  const gains = useMemo(
    () => calcGains(filteredTrades, country.longTermMonths, accountingMethod),
    [filteredTrades, countryCode, accountingMethod] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const shortGains = gains.filter((g) => !g.isLongTerm).reduce((s, g) => s + g.gain, 0);
  const longGains  = gains.filter((g) => g.isLongTerm).reduce((s, g) => s + g.gain, 0);
  const totalGains = shortGains + longGains;
  const yieldTotal = filteredTrades.filter((t) => t.type === "yield" || t.type === "airdrop" || t.type === "fork").reduce((s, t) => s + t.quantity * t.priceUsd, 0);
  const estimatedTax = calcEstimatedTax(country, shortGains, longGains, yieldTotal);

  function saveForm() {
    if (!form.date || !form.asset || form.quantity <= 0 || form.priceUsd < 0) return;
    if (editId) {
      setTrades((prev) => prev.map((t) => t.id === editId ? { ...form, id: editId } : t));
      setEditId(null);
    } else {
      setTrades((prev) => [...prev, { ...form, id: uid() }]);
    }
    setForm(BLANK_TRADE);
    setShowForm(false);
  }

  function startEdit(t: Trade) {
    setForm({ date: t.date, type: t.type, asset: t.asset, quantity: t.quantity, priceUsd: t.priceUsd, notes: t.notes });
    setEditId(t.id);
    setShowForm(true);
  }

  function deleteTrade(id: string) {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }

  function clearAll() {
    if (confirm("Clear all trades?")) setTrades([]);
  }

  const WALLET_CARDS = [
    { id: "metamask",     icon: "🦊", name: "MetaMask",        desc: "Browser Extension", action: connectMetaMask,  install: "https://metamask.io/download/",            soon: false },
    { id: "rabby",        icon: "🐰", name: "Rabby",           desc: "Browser Extension", action: connectRabby,     install: "https://rabby.io/",                        soon: false },
    { id: "phantom",      icon: "👻", name: "Phantom",         desc: "EVM + Solana",      action: () => { detectWallets(); setTimeout(() => setShowPhantomPicker(v => !v), 100); }, install: "https://phantom.app/", soon: false },
    { id: "coinbase",     icon: "🔵", name: "Coinbase Wallet", desc: "Browser Extension", action: connectCoinbase,  install: "https://www.coinbase.com/wallet",          soon: false },
    { id: "rainbow",      icon: "🌈", name: "Rainbow",         desc: "Browser Extension", action: connectRainbow,   install: "https://rainbow.me/",                      soon: false },
    { id: "trust",        icon: "🛡️", name: "Trust Wallet",    desc: "Browser Extension", action: connectTrust,     install: "https://trustwallet.com/browser-extension", soon: false },
    { id: "ledger",       icon: ledgerConnecting ? "⏳" : "🔒", name: "Ledger", desc: ledgerConnecting ? "Connecting…" : "Hardware · WebUSB", action: connectLedger, install: "https://www.ledger.com/", soon: false },
    { id: "walletconnect",icon: "📡", name: "WalletConnect",   desc: "Mobile & Desktop",  action: null,             install: null,                                        soon: true  },
  ];

  const tradeTypeLabel: Record<TradeType, string> = {
    buy: "Buy", sell: "Sell", yield: "Yield / Staking", fee: "Fee",
    trade: "Trade / Swap", airdrop: "Airdrop", gift_received: "Gift Received",
    lost_stolen: "Lost / Stolen", fork: "Hard Fork",
  };
  const tradeTypeColor: Record<TradeType, string> = {
    buy: "text-blue-400", sell: "text-green-400", yield: "text-yellow-400", fee: "text-red-400",
    trade: "text-purple-400", airdrop: "text-teal-400", gift_received: "text-pink-400",
    lost_stolen: "text-red-500", fork: "text-orange-400",
  };

  const yearLabel = TAX_YEAR_RANGES[taxYear].label;

  // Tax year options — FY labels for AU, calendar for others
  const isAU = countryCode === "AU";
  const taxYearOptions: { value: TaxYear; label: string }[] = [
    { value: "all",       label: "All time" },
    ...(isAU
      ? [
          { value: "fy2024-25" as TaxYear, label: "FY 2024-25" },
          { value: "fy2023-24" as TaxYear, label: "FY 2023-24" },
          { value: "fy2022-23" as TaxYear, label: "FY 2022-23" },
        ]
      : [
          { value: "cal2024" as TaxYear, label: "Calendar 2024" },
          { value: "cal2023" as TaxYear, label: "Calendar 2023" },
        ]),
  ];

  // Remove wallet is referenced but unused in this component directly
  void removeWallet;

  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <Image src="/passiveblocks_logo_cropped.png" alt="PassiveBlocks" width={172} height={40} className="h-10 w-auto" priority />
          </Link>
          <Link href="/#subscribe" className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-colors">
            Subscribe free →
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-3">DeFi Tax Calculator</p>
          <h1 className="text-4xl font-extrabold mb-3">Estimate your crypto tax</h1>
          <p className="text-white/50 text-lg max-w-2xl">
            CSV import from Binance, Coinbase, Kraken. FIFO / LIFO / HIFO. Multi-country rules. Export to CSV.
            <span className="ml-2 text-xs text-white/30">Estimate only — not financial advice.</span>
          </p>
        </div>

        {/* Country + accounting method + tax year row */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/40">Country:</span>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value as CountryCode)}
              className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400/50"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-white/40">Method:</span>
            <div className="relative group">
              <select
                value={accountingMethod}
                onChange={(e) => setAccountingMethod(e.target.value as AccountingMethod)}
                className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400/50"
              >
                <option value="FIFO">FIFO</option>
                <option value="LIFO">LIFO</option>
                <option value="HIFO">HIFO</option>
              </select>
              {countryCode === "AU" && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a1a2e] border border-yellow-500/30 text-yellow-300 text-xs rounded-lg px-3 py-2 hidden group-hover:block z-50 pointer-events-none">
                  Note: ATO requires FIFO for Australian CGT. LIFO/HIFO are available for reference only.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-white/40">Tax year:</span>
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(e.target.value as TaxYear)}
              className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400/50"
            >
              {taxYearOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <span className="text-xs text-white/30 bg-white/[0.03] border border-white/[0.07] px-3 py-1.5 rounded-full">
            {country.note}
          </span>
        </div>

        {/* ── CSV IMPORT ────────────────────────────────────────────────────── */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 mb-6">
          <p className="text-xs font-bold tracking-widest uppercase text-white/60 mb-1">Import CSV</p>
          <p className="text-xs text-white/30 mb-4">Import trade history directly from your exchange. Duplicates are automatically skipped.</p>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-white/[0.03] rounded-xl p-1 w-fit">
            {CSV_SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => { setCsvTab(s.id); setCsvPreview(null); setCsvImportMsg(null); if (csvInputRef.current) csvInputRef.current.value = ""; }}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${csvTab === s.id ? "bg-blue-600 text-white" : "text-white/40 hover:text-white/70"}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Hint */}
          <p className="text-xs text-white/30 mb-4 font-mono bg-white/[0.02] px-3 py-2 rounded-lg border border-white/[0.06]">
            {CSV_SOURCES.find((s) => s.id === csvTab)?.hint}
          </p>

          {/* Generic template download */}
          {csvTab === "generic" && (
            <div className="mb-4">
              <button
                onClick={() => {
                  const header = "date,type,asset,quantity,price_usd,notes\n";
                  const example = "2024-01-15,buy,ETH,1.5,2850.00,Purchased on exchange\n2024-06-01,sell,ETH,0.5,3200.00,Sold for profit\n2024-03-10,yield,SOL,5.2,180.00,Staking reward\n";
                  const blob = new Blob([header + example], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "passiveblocks-generic-template.csv"; a.click(); URL.revokeObjectURL(url);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors border border-blue-400/20 px-3 py-1.5 rounded-lg"
              >
                Download template CSV
              </button>
            </div>
          )}

          {/* File input */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }}
              className="block text-sm text-white/50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer cursor-pointer"
            />
          </div>

          {/* Preview */}
          {csvPreview && (
            <div className="mt-4 bg-white/[0.02] border border-white/[0.1] rounded-xl p-4">
              <p className="text-sm font-semibold text-white/80 mb-2">
                Found {csvPreview.parsed.length} transaction{csvPreview.parsed.length !== 1 ? "s" : ""} — preview (first 3):
              </p>
              <div className="overflow-x-auto mb-4">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="text-white/30 text-left">
                      <th className="pr-3 pb-1">Date</th>
                      <th className="pr-3 pb-1">Type</th>
                      <th className="pr-3 pb-1">Asset</th>
                      <th className="pr-3 pb-1 text-right">Qty</th>
                      <th className="pr-3 pb-1 text-right">Price (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.parsed.slice(0, 3).map((t, i) => (
                      <tr key={i} className="text-white/60">
                        <td className="pr-3 py-0.5 font-mono">{t.date}</td>
                        <td className={`pr-3 py-0.5 font-semibold ${tradeTypeColor[t.type]}`}>{tradeTypeLabel[t.type]}</td>
                        <td className="pr-3 py-0.5 font-bold">{t.asset}</td>
                        <td className="pr-3 py-0.5 text-right">{fmt(t.quantity, 4)}</td>
                        <td className="pr-3 py-0.5 text-right">{t.priceUsd > 0 ? `$${fmt(t.priceUsd)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button onClick={confirmCsvImport} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors">
                  Import {csvPreview.parsed.length} trade{csvPreview.parsed.length !== 1 ? "s" : ""}
                </button>
                <button onClick={cancelCsvPreview} className="border border-white/20 hover:border-white/40 px-5 py-2 rounded-lg text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {csvImportMsg && (
            <div className={`mt-3 flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${csvImportMsg.includes("No recognised") || csvImportMsg.includes("empty") ? "bg-red-500/10 border border-red-500/30 text-red-400" : "bg-blue-500/10 border border-blue-500/30 text-blue-400"}`}>
              {csvImportMsg.includes("Imported") ? "✓" : "⚠"} {csvImportMsg}
            </div>
          )}
        </div>

        {/* Wallets */}
        <div className="mb-10">

          {/* ── CONNECT A WALLET card ─────────────────────────────────────── */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 mb-4">
            <p className="text-xs font-bold tracking-widest uppercase text-white/60 mb-1">Connect a Wallet</p>
            <p className="text-xs text-white/30 mb-5">
              ✓ green badge = detected in your browser &nbsp;·&nbsp; grey = not installed (click for install link)
            </p>

            {/* 4×2 wallet grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
              {WALLET_CARDS.map((wc) => {
                const isInstalled = installed[wc.id];
                const isHovered   = hoveredCard === wc.id;
                const isPhantomOpen = wc.id === "phantom" && showPhantomPicker;

                if (wc.soon) return (
                  <div key={wc.id} title="Coming soon"
                    style={{ position: "relative" }}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] text-center opacity-40 cursor-not-allowed min-h-[110px]">
                    <span className="text-3xl">{wc.icon}</span>
                    <span className="text-sm font-semibold text-white/80">{wc.name}</span>
                    <span className="text-[10px] text-white/30">{wc.desc}</span>
                    <span className="absolute top-2 right-2 text-[9px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/20 px-1.5 py-0.5 rounded">SOON</span>
                  </div>
                );

                return (
                  <div key={wc.id} style={{ position: "relative" }} data-phantom-picker={wc.id === "phantom" ? "true" : undefined}>
                    <button
                      onClick={() => wc.action?.()}
                      disabled={connecting}
                      onMouseEnter={() => setHoveredCard(wc.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                      className={`w-full flex flex-col items-center justify-center gap-2 p-4 rounded-xl border text-center transition-all min-h-[110px] ${
                        isPhantomOpen
                          ? "border-purple-500 bg-purple-500/10"
                          : isHovered
                            ? isInstalled ? "border-blue-400/60 bg-white/[0.06]" : "border-white/20 bg-white/[0.04]"
                            : isInstalled ? "border-white/[0.14] bg-white/[0.03]" : "border-white/[0.06] bg-white/[0.01]"
                      } ${isInstalled ? "opacity-100" : "opacity-50"}`}
                      style={{ position: "relative" }}
                    >
                      <span className="text-3xl">{wc.icon}</span>
                      <span className="text-sm font-semibold text-white/80">{wc.name}</span>
                      <span className="text-[10px] text-white/35">{isInstalled ? wc.desc : "Install →"}</span>
                      {isInstalled && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-[9px] text-green-400 font-bold">✓</span>
                      )}
                    </button>

                    {/* Phantom sub-picker */}
                    {isPhantomOpen && (
                      <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-[#1e1124] border border-purple-500/60 rounded-xl p-2 flex flex-col gap-1.5">
                        <button onClick={connectPhantomEVM}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 text-sm font-semibold text-white/80 transition-colors text-left">
                          <span>⟠</span> EVM (Ethereum)
                        </button>
                        <button onClick={connectPhantomSolana}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 text-sm font-semibold text-white/80 transition-colors text-left">
                          <span>◎</span> Solana
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-white/25 whitespace-nowrap">or add address manually</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Manual form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-white/40 block mb-1.5">Wallet Address *</label>
                <input
                  type="text"
                  placeholder="0x… or Solana address"
                  value={walletForm.address}
                  onChange={(e) => setWalletForm({ ...walletForm, address: e.target.value })}
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-400/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1.5">Label (optional)</label>
                <input
                  type="text"
                  placeholder="My DeFi Wallet"
                  value={walletForm.label}
                  onChange={(e) => setWalletForm({ ...walletForm, label: e.target.value })}
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400/50"
                />
              </div>
            </div>

            {/* Network pills */}
            <div className="mb-5">
              <label className="text-xs text-white/40 block mb-2">Network</label>
              <div className="flex flex-wrap gap-2">
                {NETWORKS.map((n) => (
                  <button
                    key={n.code}
                    type="button"
                    onClick={() => setWalletForm({ ...walletForm, network: n.code })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
                      walletForm.network === n.code
                        ? "bg-blue-600/20 border-blue-500/60 text-blue-400"
                        : "border-white/[0.1] text-white/40 hover:border-white/25 hover:text-white/60"
                    }`}
                  >
                    <span>{n.icon}</span> {n.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={addWallet}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              ➕ Add Wallet
            </button>
          </div>

          {/* ── Scan All Chains button ────────────────────────────────────── */}
          {wallets.length > 0 && (
            <>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-white/30">
                  {Array.from(new Set(wallets.map(w => w.address))).length} address{Array.from(new Set(wallets.map(w => w.address))).length > 1 ? "es" : ""} · {wallets.length} chain entr{wallets.length > 1 ? "ies" : "y"}
                </p>
                <button
                  onClick={scanAllWallets}
                  disabled={scanningAll || !!importingId}
                  className="flex items-center gap-2 text-sm bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {scanningAll ? <><span className="animate-spin inline-block">↻</span> Scanning…</> : "🔍 Scan All Chains"}
                </button>
              </div>
              {scanError && (
                <div className="mb-3 flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-2.5 rounded-xl">
                  ⚠️ {scanError}
                </div>
              )}
              {scanMsg && !scanError && (
                <div className="mb-3 flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm px-4 py-2.5 rounded-xl">
                  ✓ {scanMsg}
                </div>
              )}
            </>
          )}

          {/* ── Connected wallet list — grouped by address ─────────────────── */}
          {wallets.length === 0 ? (
            <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl px-5 py-14 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="font-semibold text-white/50 mb-1">No wallets connected yet</p>
              <p className="text-sm text-white/40">Connect a wallet above or paste an address manually.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from(new Set(wallets.map((w) => w.address))).map((addr) => {
                const entries = wallets.filter((w) => w.address === addr);
                const label = entries[0]?.label || "";
                const networks = entries.map((e) => e.network);
                const isImporting = entries.some((e) => importingId === e.id);
                const addrMsg = importMsg[addr];
                return (
                  <div key={addr} className="bg-white/[0.02] border border-white/[0.07] hover:border-white/[0.12] rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3 transition-colors">
                    <div>
                      {label && (
                        <p className="text-xs text-white/50 font-semibold mb-0.5">{label}</p>
                      )}
                      <span className="font-mono text-sm text-white/70">{addr.slice(0, 10)}…{addr.slice(-8)}</span>
                      {/* Chain pills */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {NETWORKS.filter((n) => networks.includes(n.code)).map((n) => (
                          <span key={n.code} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-white/50">
                            {n.icon} {n.label}
                          </span>
                        ))}
                      </div>
                      {addrMsg && (
                        <p className={`text-xs mt-1.5 ${addrMsg.startsWith("Error") || addrMsg.startsWith("Failed") ? "text-red-400" : "text-blue-400"}`}>
                          {addrMsg}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => importAllChains(addr)}
                        disabled={!!importingId}
                        className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors"
                      >
                        {isImporting ? "Importing…" : "Scan All Chains"}
                      </button>
                      <button
                        onClick={() => removeWalletByAddress(addr)}
                        className="text-sm border border-red-500/30 text-red-400 hover:border-red-500/60 px-3 py-2 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div className="mb-3">
          {taxYear !== "all" && (
            <p className="text-xs text-white/30 mb-3">Showing {yearLabel} · {filteredTrades.length} of {trades.length} trades</p>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Short-term gains", value: `$${fmt(shortGains)}`, sub: "< 12 months", color: shortGains >= 0 ? "text-white" : "text-red-400" },
            { label: "Long-term gains",  value: `$${fmt(longGains)}`,  sub: "> 12 months (discounted)", color: longGains >= 0 ? "text-white" : "text-red-400" },
            { label: "Yield / Airdrop income", value: `$${fmt(yieldTotal)}`, sub: "Staking / lending / drops", color: "text-yellow-400" },
            { label: "Est. tax",         value: (country as { taxFree?: boolean }).taxFree ? "None" : `$${fmt(estimatedTax)}`, sub: country.currency, color: (country as { taxFree?: boolean }).taxFree ? "text-green-400" : "text-blue-400" },
          ].map((card) => (
            <div key={card.label} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <div className="text-xs text-white/40 mb-2">{card.label}</div>
              <div className={`text-2xl font-extrabold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-white/30 mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Trade list + actions */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Trade log <span className="text-xs font-normal text-white/30">{trades.length} trade{trades.length !== 1 ? "s" : ""} total</span></h2>
          <div className="flex gap-2">
            <button
              onClick={() => exportCSV(gains, yieldTotal, country, accountingMethod)}
              className="text-sm border border-white/20 hover:border-white/40 px-4 py-2 rounded-lg transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={clearAll}
              className="text-sm border border-red-500/30 text-red-400 hover:border-red-500/60 px-4 py-2 rounded-lg transition-colors"
            >
              Clear all
            </button>
            <button
              onClick={() => { setForm(BLANK_TRADE); setEditId(null); setShowForm(true); }}
              className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-colors"
            >
              + Add trade
            </button>
          </div>
        </div>

        {/* Add/edit form */}
        {showForm && (
          <div className="bg-white/[0.03] border border-blue-400/20 rounded-2xl p-6 mb-6">
            <h3 className="font-bold mb-5 text-blue-400">{editId ? "Edit trade" : "Add trade"}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-white/40 block mb-1">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400/50" />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TradeType })}
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400/50">
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                  <option value="trade">Trade / Swap</option>
                  <option value="yield">Yield / Staking</option>
                  <option value="airdrop">Airdrop</option>
                  <option value="gift_received">Gift Received</option>
                  <option value="lost_stolen">Lost / Stolen</option>
                  <option value="fork">Hard Fork</option>
                  <option value="fee">Fee</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Asset (e.g. ETH, SOL)</label>
                <input type="text" placeholder="ETH" value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value.toUpperCase() })}
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400/50" />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Quantity</label>
                <input type="number" placeholder="1.0" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400/50" />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Price per unit (USD)</label>
                <input type="number" placeholder="2800" value={form.priceUsd || ""} onChange={(e) => setForm({ ...form, priceUsd: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400/50" />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Notes (optional)</label>
                <input type="text" placeholder="e.g. Aave yield" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400/50" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveForm} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors">
                {editId ? "Save changes" : "Add trade"}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); setForm(BLANK_TRADE); }}
                className="border border-white/20 hover:border-white/40 px-6 py-2 rounded-lg text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Trade table */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden mb-10">
          {trades.length === 0 ? (
            <div className="text-center py-16 text-white/50">
              <div className="text-4xl mb-3">📋</div>
              <p className="mb-1 font-semibold">No trades yet.</p>
              <p className="text-xs text-white/40">Import a CSV above, connect a wallet and scan, or add trades manually.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-xs text-white/30 uppercase tracking-widest">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Asset</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Price (USD)</th>
                  <th className="px-3 py-3 text-right">Value (USD)</th>
                  <th className="px-3 py-3">Notes</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {[...trades].sort((a, b) => a.date.localeCompare(b.date)).map((t) => (
                  <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-white/60 font-mono text-xs">{t.date}</td>
                    <td className={`px-3 py-3 font-semibold ${tradeTypeColor[t.type]}`}>{tradeTypeLabel[t.type]}</td>
                    <td className="px-3 py-3 font-bold">{t.asset}</td>
                    <td className="px-3 py-3 text-right text-white/70">{fmt(t.quantity, 4)}</td>
                    <td className="px-3 py-3 text-right text-white/70">${fmt(t.priceUsd)}</td>
                    <td className="px-3 py-3 text-right text-white/70">${fmt(t.quantity * t.priceUsd)}</td>
                    <td className="px-3 py-3 text-white/30 text-xs">{t.notes}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => startEdit(t)} className="text-white/30 hover:text-white/70 transition-colors text-xs">Edit</button>
                        <button onClick={() => deleteTrade(t.id)} className="text-red-400/50 hover:text-red-400 transition-colors text-xs">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Gains breakdown */}
        {gains.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-bold mb-4">
              Gain / loss breakdown
              <span className="text-xs font-normal text-white/30 ml-2">{accountingMethod} method{taxYear !== "all" ? ` · ${yearLabel}` : ""}</span>
            </h2>
            <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] text-left text-xs text-white/30 uppercase tracking-widest">
                    <th className="px-5 py-3">Asset</th>
                    <th className="px-3 py-3">Buy Date</th>
                    <th className="px-3 py-3">Sell Date</th>
                    <th className="px-3 py-3 text-right">Days</th>
                    <th className="px-3 py-3">Class</th>
                    <th className="px-3 py-3 text-right">Cost Basis</th>
                    <th className="px-3 py-3 text-right">Proceeds</th>
                    <th className="px-3 py-3 text-right">Gain / Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {gains.map((g, i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 font-bold">{g.asset}</td>
                      <td className="px-3 py-3 text-white/50 text-xs font-mono">{g.buyDate}</td>
                      <td className="px-3 py-3 text-white/50 text-xs font-mono">{g.sellDate}</td>
                      <td className="px-3 py-3 text-right text-white/50">{g.daysHeld}d</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.isLongTerm ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"}`}>
                          {g.isLongTerm ? "Long" : "Short"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-white/60">${fmt(g.costBasis)}</td>
                      <td className="px-3 py-3 text-right text-white/60">${fmt(g.proceeds)}</td>
                      <td className={`px-3 py-3 text-right font-semibold ${g.gain >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {g.gain >= 0 ? "+" : ""}${fmt(g.gain)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/[0.07] bg-white/[0.02]">
                    <td colSpan={7} className="px-5 py-3 text-xs text-white/30 font-semibold uppercase tracking-widest">Total realised</td>
                    <td className={`px-3 py-3 text-right font-extrabold ${totalGains >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {totalGains >= 0 ? "+" : ""}${fmt(totalGains)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Tax summary */}
        <div className="bg-blue-950/30 border border-blue-400/20 rounded-2xl p-6 mb-10">
          <h2 className="font-bold text-blue-400 mb-4">Tax summary — {country.flag} {country.name}</h2>
          {(country as { taxFree?: boolean }).taxFree ? (
            <p className="text-green-400 font-semibold text-lg">No capital gains tax applies in {country.name}. {country.note}.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-3 text-sm">
                {[
                  ["Short-term gains", `$${fmt(shortGains)}`, shortGains >= 0 ? "text-white" : "text-red-400"],
                  ["Long-term gains",  `$${fmt(longGains)}`,  longGains  >= 0 ? "text-white" : "text-red-400"],
                  ["Yield / staking / airdrop income", `$${fmt(yieldTotal)}`, "text-yellow-400"],
                  ["Total taxable gains", `$${fmt(totalGains + yieldTotal)}`, "text-white font-bold"],
                ].map(([label, value, cls]) => (
                  <div key={String(label)} className="flex justify-between items-center border-b border-white/[0.05] pb-2">
                    <span className="text-white/50">{label}</span>
                    <span className={String(cls)}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col justify-center items-center bg-blue-950/40 rounded-xl p-6 text-center">
                <div className="text-xs text-white/40 mb-2 uppercase tracking-widest">Estimated tax ({country.currency})</div>
                <div className="text-4xl font-extrabold text-blue-400">${fmt(estimatedTax)}</div>
                <div className="text-xs text-white/30 mt-2">{country.note}</div>
                <div className="text-xs text-white/20 mt-1">{accountingMethod} · {yearLabel}</div>
              </div>
            </div>
          )}
          <p className="text-xs text-white/20 mt-4">
            This is an estimate only and does not constitute financial or tax advice. Consult a qualified accountant for your specific situation.
          </p>
        </div>

        {/* Export + CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
          <button
            onClick={() => exportCSV(gains, yieldTotal, country, accountingMethod)}
            className="w-full sm:w-auto bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.12] text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            Export to CSV
          </button>
          <div className="text-center sm:text-right">
            <p className="text-xs text-white/30">Want entry/exit signals and allocation models?</p>
            <Link href="/#subscribe" className="text-blue-400 text-sm font-semibold hover:text-blue-300 transition-colors">
              Upgrade to Premium →
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 mt-12">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-white/25">
          <Link href="/">
            <Image src="/passiveblocks_logo_cropped.png" alt="PassiveBlocks" width={130} height={30} className="h-8 w-auto opacity-50" />
          </Link>
          <span>© {new Date().getFullYear()} PassiveBlocks</span>
        </div>
      </footer>
    </div>
  );
}
