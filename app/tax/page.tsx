"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

type TradeType = "buy" | "sell" | "yield" | "fee";

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

// ─── FIFO gain calculator ─────────────────────────────────────────────────────

function calcGains(trades: Trade[], longTermMonths: number): MatchedGain[] {
  const buyQueues: Record<string, { date: string; qty: number; price: number }[]> = {};
  const gains: MatchedGain[] = [];

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));

  for (const t of sorted) {
    if (t.type === "buy") {
      if (!buyQueues[t.asset]) buyQueues[t.asset] = [];
      buyQueues[t.asset].push({ date: t.date, qty: t.quantity, price: t.priceUsd });
    }
    if (t.type === "sell") {
      let remaining = t.quantity;
      const queue = buyQueues[t.asset] || [];
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

const EXAMPLE_TRADES: Trade[] = [
  { id: uid(), date: "2025-02-10", type: "buy",   asset: "ETH",  quantity: 2,    priceUsd: 2800, notes: "" },
  { id: uid(), date: "2025-03-15", type: "buy",   asset: "SOL",  quantity: 20,   priceUsd: 145,  notes: "" },
  { id: uid(), date: "2025-06-01", type: "sell",  asset: "ETH",  quantity: 1,    priceUsd: 3400, notes: "" },
  { id: uid(), date: "2025-09-20", type: "yield", asset: "USDC", quantity: 380,  priceUsd: 1,    notes: "Aave lending income" },
  { id: uid(), date: "2026-03-10", type: "sell",  asset: "SOL",  quantity: 10,   priceUsd: 195,  notes: "" },
];

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(gains: MatchedGain[], yieldTotal: number, country: Country) {
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
    ["Short-term gains", fmt(gains.filter(g => !g.isLongTerm).reduce((s, g) => s + g.gain, 0))],
    ["Long-term gains", fmt(gains.filter(g => g.isLongTerm).reduce((s, g) => s + g.gain, 0))],
    ["Tax note", `${country.note} — this is an estimate only, not financial advice`],
  ];

  const csv = rows.map((r) => r.map(String).map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `passiveblocks-tax-${country.code}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

const BLANK_TRADE: Omit<Trade, "id"> = { date: "", type: "buy", asset: "", quantity: 0, priceUsd: 0, notes: "" };

export default function TaxCalculatorPage() {
  const [trades, setTrades] = useState<Trade[]>(EXAMPLE_TRADES);
  const [countryCode, setCountryCode] = useState<CountryCode>("AU");
  const [form, setForm] = useState<Omit<Trade, "id">>(BLANK_TRADE);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const country = getCountry(countryCode);

  const gains = useMemo(() => calcGains(trades, country.longTermMonths), [trades, countryCode]);

  const shortGains = gains.filter((g) => !g.isLongTerm).reduce((s, g) => s + g.gain, 0);
  const longGains  = gains.filter((g) => g.isLongTerm).reduce((s, g) => s + g.gain, 0);
  const totalGains = shortGains + longGains;
  const yieldTotal = trades.filter((t) => t.type === "yield").reduce((s, t) => s + t.quantity * t.priceUsd, 0);
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

  const tradeTypeLabel: Record<TradeType, string> = { buy: "Buy", sell: "Sell", yield: "Yield / Staking", fee: "Fee" };
  const tradeTypeColor: Record<TradeType, string> = { buy: "text-blue-400", sell: "text-green-400", yield: "text-yellow-400", fee: "text-red-400" };

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
            Manual trade entry. FIFO matching. Multi-country rules. Export to CSV.
            <span className="ml-2 text-xs text-white/30">Estimate only — not financial advice.</span>
          </p>
        </div>

        {/* Country + disclaimer */}
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
          <span className="text-xs text-white/30 bg-white/[0.03] border border-white/[0.07] px-3 py-1.5 rounded-full">
            {country.note}
          </span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Short-term gains", value: `$${fmt(shortGains)}`, sub: "< 12 months", color: shortGains >= 0 ? "text-white" : "text-red-400" },
            { label: "Long-term gains",  value: `$${fmt(longGains)}`,  sub: "> 12 months (discounted)", color: longGains >= 0 ? "text-white" : "text-red-400" },
            { label: "Yield income",     value: `$${fmt(yieldTotal)}`, sub: "Staking / lending", color: "text-yellow-400" },
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
          <h2 className="text-lg font-bold">Trade log</h2>
          <div className="flex gap-2">
            <button
              onClick={() => exportCSV(gains, yieldTotal, country)}
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
                  <option value="yield">Yield / Staking</option>
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
            <div className="text-center py-16 text-white/30">
              <div className="text-4xl mb-3">📋</div>
              <p>No trades yet. Add your first trade above.</p>
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
            <h2 className="text-lg font-bold mb-4">Gain / loss breakdown <span className="text-xs font-normal text-white/30 ml-2">FIFO method</span></h2>
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
                  ["Yield / staking income", `$${fmt(yieldTotal)}`, "text-yellow-400"],
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
            onClick={() => exportCSV(gains, yieldTotal, country)}
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
