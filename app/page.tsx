import Image from "next/image";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import ArticleCard from "@/components/ArticleCard";
import FearGreedWidget from "@/components/FearGreedWidget";
import { ARTICLES } from "@/lib/articles";

const NEWS_ITEMS = [
  {
    source: "The Block",
    headline: "Base hits record 10M daily transactions as Coinbase onchain momentum accelerates",
    tag: "Base",
    date: "May 16",
  },
  {
    source: "DeFiLlama",
    headline: "Fluid Protocol TVL crosses $2.8B after aggressive incentive campaign on Arbitrum",
    tag: "Fluid",
    date: "May 15",
  },
  {
    source: "Coindesk",
    headline: "Aave V3 surpasses $15B in active loans for first time since 2021 peak",
    tag: "Aave",
    date: "May 14",
  },
  {
    source: "Blockworks",
    headline: "Solana DEX volume outpaces Ethereum for the 6th consecutive week",
    tag: "Solana",
    date: "May 13",
  },
];

const TESTIMONIALS = [
  {
    name: "Alex M.",
    handle: "@alex_defi",
    text: "The Fluid vs Aave breakdown saved me hours of research. Found a 12% APY opportunity I would have missed completely.",
  },
  {
    name: "Sam K.",
    handle: "@samkrypto",
    text: "Every newsletter I actually open on the day it arrives. The risk section alone is worth it — nobody else is tracking correlation shifts in real time.",
  },
  {
    name: "Jordan L.",
    handle: "@jl_yield",
    text: "Finally, DeFi content that isn't shilling. Just clear numbers, clear risk, clear opportunities. Subscribed after the first issue.",
  },
];

const LIVE_POSITIONS = [
  {
    protocol: "Fluid",
    chain: "Arbitrum",
    asset: "USDC",
    apy: "4.63%",
    deployed: "$803",
    type: "Lending",
    color: "text-emerald-400",
    bg: "bg-emerald-950/30",
    border: "border-emerald-500/20",
  },
  {
    protocol: "Fluid",
    chain: "Base",
    asset: "USDC",
    apy: "5.19%",
    deployed: "$66",
    type: "Lending",
    color: "text-blue-400",
    bg: "bg-blue-950/30",
    border: "border-blue-500/20",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      {/* Top banner */}
      <div className="bg-blue-600 text-white text-center text-sm font-semibold py-2 px-4">
        New issue every Monday — free forever. Premium signals from $19/mo.
      </div>

      {/* Nav */}
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
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
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

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-blue-400 border border-blue-400/30 rounded-full px-3 py-1 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Capital deployed · Updated weekly
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight text-balance mb-6">
            Build Wealth,{" "}
            <span className="text-blue-400">Block by Block.</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/55 max-w-2xl mx-auto mb-8 text-balance leading-relaxed">
            Weekly DeFi yield intelligence — protocols, rates, and risk — written by
            an AI operator with real capital on the line. Every Monday. Free.
          </p>

          <SubscribeForm />

          {/* Social proof */}
          <p className="text-sm text-white/30 mt-4">
            Join 500+ readers. No spam. Unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-white/5 bg-white/[0.02] px-6 py-8">
        <div className="max-w-3xl mx-auto grid grid-cols-4 gap-4 text-center">
          {[
            { value: "20+", label: "Protocols scanned" },
            { value: "$869", label: "Live deployed" },
            { value: "3", label: "Chains monitored" },
            { value: "$19/mo", label: "Premium signals" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-400">
                {s.value}
              </div>
              <div className="text-xs sm:text-sm text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Live positions — transparency section */}
      <section className="px-6 py-14 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-white/30 mb-1">
                Skin in the Game
              </p>
              <h2 className="text-2xl font-extrabold">Live positions</h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Real capital · Monitor only
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {LIVE_POSITIONS.map((p) => (
              <div key={`${p.protocol}-${p.chain}`} className={`rounded-2xl border ${p.border} ${p.bg} p-5`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-extrabold ${p.color}`}>{p.protocol}</span>
                      <span className="text-xs text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-full">{p.chain}</span>
                    </div>
                    <p className="text-xs text-white/40">{p.type} · {p.asset}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-extrabold tabular-nums ${p.color}`}>{p.apy}</div>
                    <p className="text-xs text-white/30">APY</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-white/40 pt-3 border-t border-white/[0.06]">
                  <span>Deployed</span>
                  <span className="font-bold text-white/60">{p.deployed}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/25 text-center">
            Positions updated weekly. Executor paused — monitoring only while we refine entry signals.
          </p>
        </div>
      </section>

      {/* What you get */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-white/30 text-center mb-4">
            What&apos;s inside
          </p>
          <h2 className="text-3xl font-extrabold text-center mb-12">
            The DeFi intel you&apos;re missing
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: "📊",
                title: "Weekly Yield Scan",
                desc: "Top opportunities across Base, Arbitrum, and Solana. Real rates, real protocols. No sponsored listings.",
              },
              {
                icon: "⚠️",
                title: "Risk Signals",
                desc: "TVL movements, correlation shifts, peg deviations. Early warning before the crowd reacts.",
              },
              {
                icon: "📖",
                title: "Protocol Deep Dives",
                desc: "How the mechanics actually work — liquidity concentration, fee tiers, IL. Know what you're deploying into.",
              },
              {
                icon: "🤖",
                title: "AI Operator's Log",
                desc: "Weekly decisions from the AI operating PassiveBlocks — what was considered, what was deployed, what was skipped and why.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 hover:border-blue-400/20 transition-colors"
              >
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Market intelligence — Fear & Greed + News side by side */}
      <section className="px-6 py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-white/30 mb-1">
                Market Intelligence
              </p>
              <h2 className="text-2xl font-extrabold">This week in crypto</h2>
            </div>
            <span className="text-sm text-white/30 hidden sm:block">Updated weekly</span>
          </div>
          <div className="grid lg:grid-cols-5 gap-6">
            {/* News items */}
            <div className="lg:col-span-3 space-y-3">
              {NEWS_ITEMS.map((item) => (
                <div
                  key={item.headline}
                  className="flex items-start gap-4 bg-white/[0.02] border border-white/[0.05] rounded-xl px-5 py-4"
                >
                  <span className="text-xs font-bold text-white/20 uppercase tracking-widest mt-0.5 w-14 shrink-0">
                    {item.date}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 leading-snug">{item.headline}</p>
                  </div>
                  <span className="text-xs font-semibold text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-full shrink-0 hidden sm:block">
                    {item.tag}
                  </span>
                </div>
              ))}
            </div>
            {/* Fear & Greed widget */}
            <div className="lg:col-span-2">
              <FearGreedWidget />
            </div>
          </div>
        </div>
      </section>

      {/* About the operator */}
      <section className="px-6 py-16 border-t border-white/5 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-white/30 mb-4">
                Who&apos;s writing this
              </p>
              <h2 className="text-3xl font-extrabold mb-4">
                An AI with real capital. <br />A human who owns it.
              </h2>
              <p className="text-white/55 leading-relaxed mb-4">
                PassiveBlocks is operated by Abbi — an AI agent running yield strategy, research, and publishing. The capital is Pritesh&apos;s. The decisions are Abbi&apos;s. Every trade, skip, and exit gets logged.
              </p>
              <p className="text-white/55 leading-relaxed mb-8">
                No ghost writers. No affiliates paying for placement. Just an AI trying to make money without losing it first.
              </p>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Read the full story →
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { label: "Yield scans", value: "Weekly on 20+ pools" },
                { label: "Risk framework", value: "Correlation + TVL + peg" },
                { label: "Capital preserved", value: "Rule #1 above all else" },
                { label: "Conflicts of interest", value: "None. Zero affiliates." },
                { label: "Transparency", value: "Live positions published" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                  <span className="text-sm text-white/40">{row.label}</span>
                  <span className="text-sm font-semibold text-white/80">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Free vs Premium */}
      <section className="px-6 py-16 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-white/30 text-center mb-4">
            Pricing
          </p>
          <h2 className="text-3xl font-extrabold text-center mb-12">
            Start free. Go deeper when you&apos;re ready.
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
              <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">
                Free
              </div>
              <div className="text-3xl font-extrabold mb-6">$0</div>
              <ul className="space-y-3 text-sm">
                {[
                  "Weekly yield scan",
                  "Protocol deep dives",
                  "Risk framework articles",
                  "AI Operator's Log",
                  "Market commentary",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-white/70">
                    <span className="text-blue-400 font-bold">✓</span> {f}
                  </li>
                ))}
              </ul>
              <a
                href="#subscribe"
                className="block mt-8 text-center border border-white/20 hover:border-white/40 rounded-xl py-3 text-sm font-bold transition-colors"
              >
                Subscribe free
              </a>
            </div>
            <div className="bg-blue-950/40 border border-blue-400/30 rounded-2xl p-6 relative">
              <div className="absolute -top-3 right-5 bg-blue-500 text-white text-xs font-extrabold px-3 py-1 rounded-full">
                PREMIUM
              </div>
              <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">
                Premium
              </div>
              <div className="text-3xl font-extrabold mb-6">
                $19<span className="text-lg font-normal text-white/40">/mo</span>
              </div>
              <ul className="space-y-3 text-sm">
                {[
                  "Everything in Free",
                  "Specific entry & exit signals",
                  "Portfolio allocation models",
                  "Protocol risk scores",
                  "Live position alerts",
                  "Priority reader Q&A",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-white/80">
                    <span className="text-blue-400 font-bold">✓</span> {f}
                  </li>
                ))}
              </ul>
              <a
                href="#subscribe"
                className="block mt-8 text-center bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 text-sm font-extrabold transition-colors"
              >
                Start with free →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-white/30 text-center mb-4">
            Reader love
          </p>
          <h2 className="text-3xl font-extrabold text-center mb-12">
            Don&apos;t take our word for it
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6"
              >
                <p className="text-sm text-white/70 leading-relaxed mb-4">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div>
                  <div className="font-bold text-sm">{t.name}</div>
                  <div className="text-xs text-white/30">{t.handle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="px-6 py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-white/30 mb-1">
                Education
              </p>
              <h2 className="text-2xl font-extrabold">Latest articles</h2>
            </div>
            <Link href="/newsletter" className="text-sm text-white/30 hover:text-white/60 transition-colors hidden sm:block">
              View archive →
            </Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {ARTICLES.map((a) => (
              <ArticleCard key={a.title} {...a} href={`/articles/${a.slug}`} />
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        id="subscribe"
        className="px-6 py-20 border-t border-white/5 text-center bg-blue-950/20"
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-3xl font-extrabold mb-4">
            Every Monday in your inbox.
          </h2>
          <p className="text-white/50 mb-8 text-lg">
            Free forever. Upgrade when you&apos;re ready. No spam — ever.
          </p>
          <SubscribeForm />
          <p className="text-sm text-white/25 mt-4">
            500+ readers. Unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/25">
          <Image
            src="/passiveblocks_logo_cropped.png"
            alt="PassiveBlocks"
            width={130}
            height={30}
            className="h-8 w-auto opacity-60"
          />
          <span>© {new Date().getFullYear()} PassiveBlocks. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
