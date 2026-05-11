import Image from "next/image";
import SubscribeForm from "@/components/SubscribeForm";
import ArticleCard from "@/components/ArticleCard";

const ARTICLES = [
  {
    tag: "Yield Analysis",
    title: "Fluid Protocol: The Quiet Monster Eating DeFi Lending",
    excerpt:
      "Fluid's unified liquidity layer is capturing market share from Aave and Compound at a pace most analysts haven't noticed yet. Here's the mechanics and the yield opportunity.",
    date: "2026-05-07",
    readTime: "6 min",
  },
  {
    tag: "Protocol Deep Dive",
    title: "Aerodrome vs Uniswap V3: Where the Real Swap Fees Live",
    excerpt:
      "Same token pairs, radically different fee distribution. On Base, the delta between platforms on WETH/USDC is 38 APY points. We break down why — and when each wins.",
    date: "2026-04-30",
    readTime: "8 min",
  },
  {
    tag: "Risk Framework",
    title: "Stablecoin Lending in 2026: The Risk Hierarchy You Need",
    excerpt:
      "Not all 5% APY is equal. Between custodial risk, smart contract risk, oracle manipulation, and peg deviation, the spread between the safest and riskiest USDC yield is wider than most people think.",
    date: "2026-04-21",
    readTime: "7 min",
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

export default function Home() {
  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      {/* Top banner */}
      <div className="bg-emerald-500 text-black text-center text-sm font-semibold py-2 px-4">
        New issue every Monday — free forever. Premium signals from $19/mo.
      </div>

      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Image
            src="/passiveblocks_logo.png"
            alt="PassiveBlocks"
            width={200}
            height={48}
            className="h-10 w-auto"
            priority
          />
          <a
            href="#subscribe"
            className="text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Subscribe free →
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block text-xs font-bold tracking-widest uppercase text-emerald-400 border border-emerald-400/30 rounded-full px-3 py-1 mb-8">
            DeFi Yield Intelligence
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight text-balance mb-6">
            Build Wealth,{" "}
            <span className="text-emerald-400">Block by Block.</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/55 max-w-2xl mx-auto mb-8 text-balance leading-relaxed">
            Weekly DeFi yield analysis — protocols, rates, and risk — written by
            someone actually deploying capital. Every Monday. Free.
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
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center">
          {[
            { value: "Weekly", label: "Every Monday" },
            { value: "4+", label: "Protocols tracked" },
            { value: "$19/mo", label: "Premium signals" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                {s.value}
              </div>
              <div className="text-xs sm:text-sm text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
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
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: "📊",
                title: "Weekly Yield Scan",
                desc: "Top opportunities across Base, Arbitrum, and Solana. Real rates, real protocols. No sponsored listings, no influencer shilling.",
              },
              {
                icon: "⚠️",
                title: "Risk Signals",
                desc: "TVL movements, correlation shifts, peg deviations. We track the early warning signals so you don't get caught off-guard.",
              },
              {
                icon: "📖",
                title: "Protocol Education",
                desc: "How the mechanics actually work — liquidity concentration, fee tiers, impermanent loss. Know what you're deploying into.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 hover:border-emerald-400/20 transition-colors"
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
                  "Market commentary",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-white/70">
                    <span className="text-emerald-400 font-bold">✓</span> {f}
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
            <div className="bg-emerald-950/40 border border-emerald-400/30 rounded-2xl p-6 relative">
              <div className="absolute -top-3 right-5 bg-emerald-400 text-black text-xs font-extrabold px-3 py-1 rounded-full">
                PREMIUM
              </div>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">
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
                  "Priority reader Q&A",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-white/80">
                    <span className="text-emerald-400 font-bold">✓</span> {f}
                  </li>
                ))}
              </ul>
              <a
                href="#subscribe"
                className="block mt-8 text-center bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl py-3 text-sm font-extrabold transition-colors"
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
            <span className="text-sm text-white/30 hidden sm:block">New every week</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {ARTICLES.map((a) => (
              <ArticleCard key={a.title} {...a} />
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        id="subscribe"
        className="px-6 py-20 border-t border-white/5 text-center bg-emerald-950/20"
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
            src="/passiveblocks_logo.png"
            alt="PassiveBlocks"
            width={160}
            height={40}
            className="h-8 w-auto opacity-60"
          />
          <span>© {new Date().getFullYear()} PassiveBlocks. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
