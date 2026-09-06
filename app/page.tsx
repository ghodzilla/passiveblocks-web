import Image from "next/image";
import Link from "next/link";
import FearGreedWidget from "@/components/FearGreedWidget";
import DefiYieldIndex from "@/components/DefiYieldIndex";
import CryptoNewsWidget from "@/components/CryptoNewsWidget";
import NewsletterSignup from "@/components/NewsletterSignup";
import { PillarCard } from "@/components/PillarCard";
import { RankedYieldsTable } from "@/components/RankedYieldsTable";
import { YouTubeStrip } from "@/components/YouTubeStrip";
import { PledgeList } from "@/components/PledgeList";

const pillars = [
  {
    name: "Crypto Yield",
    slug: "crypto-yield",
    yieldRange: "4–20% APY",
    oneLiner:
      "Earn on-chain from lending and LP fees across Aave, Fluid, Orca, and Aerodrome.",
    bestFor:
      "DeFi natives who want real yield on stablecoins and blue-chip crypto",
    href: "/learn/crypto-yield",
  },
  {
    name: "Dividend & Income Stocks",
    slug: "stocks",
    yieldRange: "3–14% yield",
    oneLiner:
      "Covered-call ETFs and dividend aristocrats for cash flow outside crypto.",
    bestFor: "Investors who want stable income to balance DeFi volatility",
    href: "/learn/stocks",
  },
  {
    name: "Airdrops",
    slug: "airdrops",
    yieldRange: "Variable",
    oneLiner:
      "Points farming, protocol participation, and early-mover rewards.",
    bestFor:
      "Active crypto users who want upside without extra capital outlay",
    href: "/learn/airdrops",
  },
  {
    name: "AI×Crypto",
    slug: "ai-crypto",
    yieldRange: "~9–30% APY",
    oneLiner:
      "Staking, node rewards, and yield on AI infrastructure tokens like TAO and FET.",
    bestFor:
      "High-conviction holders in the AI×crypto convergence thesis",
    href: "/learn/ai-crypto",
  },
];

const yieldRows = [
  {
    rank: 1,
    name: "USDC Lending on Aave (Base)",
    pillar: "Crypto Yield",
    pillarSlug: "crypto-yield" as const,
    yield: "8.2% APY",
    riskLabel: "Low" as const,
  },
  {
    rank: 2,
    name: "SPYI (NEOS S&P 500 Income ETF)",
    pillar: "Dividend",
    pillarSlug: "stocks" as const,
    yield: "11.4% yield",
    riskLabel: "Med" as const,
  },
  {
    rank: 3,
    name: "SOL/USDC LP on Orca",
    pillar: "Crypto Yield",
    pillarSlug: "crypto-yield" as const,
    yield: "18.7% APY",
    riskLabel: "Med" as const,
  },
  {
    rank: 4,
    name: "Layer Zero Points Farming",
    pillar: "Airdrops",
    pillarSlug: "airdrops" as const,
    yield: "Variable",
    riskLabel: "High" as const,
  },
  {
    rank: 5,
    name: "Bittensor (TAO) Staking",
    pillar: "AI×Crypto",
    pillarSlug: "ai-crypto" as const,
    yield: "~9% APY",
    riskLabel: "High" as const,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      {/* 1. Nav */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-6">
          <Link href="/">
            <Image
              src="/passiveblocks_logo_cropped.png"
              alt="PassiveBlocks"
              width={172}
              height={40}
              className="h-10 w-auto"
              priority
            />
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm text-white/50">
            <Link href="/learn" className="hover:text-white transition-colors">Learn</Link>
            <Link href="/newsletter" className="hover:text-white transition-colors">Archive</Link>
            <Link href="/tax" className="hover:text-white transition-colors">Tax Calculator</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/50 hover:text-white transition-colors">Sign in</Link>
            <Link
              href="#subscribe"
              className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-colors"
            >
              Subscribe free →
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. Hero */}
      <section className="px-6 pt-20 pb-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight text-balance mb-6">
            The best ways to earn{" "}
            <span className="text-blue-400">passive income</span>{" "}
            — tested, ranked, explained.
          </h1>
          <p className="text-lg text-white/55 max-w-2xl mx-auto mb-8 leading-relaxed">
            Crypto yield, dividend stocks, airdrops, and AI×crypto — every opportunity
            ranked by real risk-adjusted return. Research backed by real capital on the line.
          </p>
          <div className="max-w-md mx-auto mb-6">
            <NewsletterSignup />
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-white/30 flex-wrap">
            <span>4 areas covered</span>
            <span className="text-white/10">·</span>
            <span>weekly ranked opportunities</span>
            <span className="text-white/10">·</span>
            <span>ranked by risk-adjusted yield</span>
          </div>
        </div>
      </section>

      {/* 3. 2×2 pillar grid */}
      <section className="px-6 py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">
              What we cover
            </p>
            <h2 className="text-2xl font-extrabold text-white">
              Four ways to build passive income
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pillars.map((p) => (
              <PillarCard key={p.slug} {...p} />
            ))}
          </div>
        </div>
      </section>

      {/* 4. This week's best, ranked */}
      <section className="px-6 py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">
              Weekly ranking
            </p>
            <h2 className="text-2xl font-extrabold text-white">
              This week&apos;s best, ranked
            </h2>
            <p className="text-xs text-white/30 mt-2">
              Illustrative selection — live risk-adjusted rankings arrive with our yields data (Phase 3).
            </p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
            <RankedYieldsTable rows={yieldRows} />
          </div>
        </div>
      </section>

      {/* 5. Market snapshot */}
      <section className="px-6 py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-white/30 mb-1">
                Market Indices
              </p>
              <h2 className="text-2xl font-extrabold">Sentiment &amp; Opportunity</h2>
            </div>
            <span className="text-xs text-white/20 hidden sm:block">Updated hourly</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <FearGreedWidget />
            <DefiYieldIndex />
          </div>
        </div>
      </section>

      {/* 6. Latest Crypto News */}
      <section className="px-6 py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-white/30 mb-1">
                Daily News
              </p>
              <h2 className="text-2xl font-extrabold">Latest Crypto News</h2>
            </div>
            <span className="text-xs text-white/20 hidden sm:block">Live · refreshed every 30 min</span>
          </div>
          <CryptoNewsWidget />
        </div>
      </section>

      {/* 7. AI×Crypto spotlight */}
      <section className="px-6 py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="border-l-4 border-indigo-500 pl-6 bg-indigo-950/10 rounded-r-2xl py-8 pr-8">
            <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">
              Spotlight
            </p>
            <h2 className="text-2xl font-extrabold text-white mb-3">AI × Crypto</h2>
            <p className="text-white/60 mb-6 max-w-2xl leading-relaxed">
              The convergence of artificial intelligence and crypto infrastructure is creating
              new yield opportunities — from Bittensor (TAO) subnet staking to FET and AGIX
              node rewards. We track the protocols building at this intersection and rank the
              real yield versus the hype.
            </p>
            <Link
              href="/learn/ai-crypto"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm inline-block"
            >
              Explore AI×Crypto →
            </Link>
          </div>
        </div>
      </section>

      {/* 8. YouTubeStrip */}
      <div className="border-t border-white/5">
        <YouTubeStrip />
      </div>

      {/* 9. PledgeList */}
      <div className="border-t border-white/5">
        <PledgeList />
      </div>

      {/* 10. Newsletter band */}
      <section
        id="subscribe"
        className="px-6 py-20 border-t border-white/5 text-center bg-blue-950/20"
      >
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-4">
            Newsletter
          </p>
          <h2 className="text-3xl font-extrabold mb-3">
            Every Monday, free.
          </h2>
          <p className="text-white/50 mb-8 text-lg">
            DeFi yield intelligence in your inbox. No spam — ever.
          </p>
          <NewsletterSignup />
          <p className="text-sm text-white/25 mt-4">
            Unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* 11. Footer */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/25">
          <Image
            src="/passiveblocks_logo_cropped.png"
            alt="PassiveBlocks"
            width={130}
            height={30}
            className="h-8 w-auto opacity-60"
          />
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="hover:text-white/50 transition-colors">Pricing</Link>
            <span>© {new Date().getFullYear()} PassiveBlocks. All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* 12. Compliance disclaimer */}
      <div className="border-t border-white/5 px-6 py-6">
        <div className="max-w-5xl mx-auto text-xs text-white/20 leading-relaxed">
          PassiveBlocks is a research newsletter, not a financial advisor. All content is for
          informational purposes only and does not constitute financial, investment, legal, or
          tax advice. Crypto assets are highly volatile and speculative. Past performance is
          not indicative of future results. Always conduct your own research before making
          any investment decisions.
        </div>
      </div>
    </div>
  );
}
