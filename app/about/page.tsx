import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — PassiveBlocks",
  description: "PassiveBlocks is a weekly DeFi yield newsletter written by someone actually deploying capital.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#08080f] text-white">
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

      <section className="px-6 py-20 max-w-2xl mx-auto">
        <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-4">About</p>
        <h1 className="text-4xl font-extrabold mb-8">We write what we deploy.</h1>

        <div className="space-y-6 text-white/70 text-lg leading-relaxed">
          <p>
            PassiveBlocks started from a simple frustration: most DeFi content is either written by people who&apos;ve never deployed real capital, or it&apos;s thinly-veiled shilling for protocols paying for coverage.
          </p>
          <p>
            We run real capital across Aave, Fluid, Aerodrome, Orca, and Uniswap V3. We track positions, manage rebalances, deal with impermanent loss, and figure out tax treatment — the unglamorous parts nobody writes about.
          </p>
          <p>
            Every Monday we publish what we found: where the best yield is, what the real risk profile looks like, and what changed this week that you need to know. No sponsored placements. No token bags to pump.
          </p>

          <div className="border-t border-white/10 pt-8">
            <h2 className="text-xl font-bold text-white mb-4">What we cover</h2>
            <ul className="space-y-3">
              {[
                "Weekly yield scan — top opportunities across Base, Arbitrum, and Solana",
                "Protocol deep dives — how the mechanics actually work",
                "Risk signals — TVL movements, correlation shifts, peg deviations",
                "DeFi news — what moved markets and why it matters for yield",
                "Premium: specific entry/exit signals, allocation models, protocol risk scores",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-white/10 pt-8">
            <h2 className="text-xl font-bold text-white mb-4">The model</h2>
            <p>Free newsletter, forever. Premium tier at $19/month for readers who want signals and allocation models, not just analysis.</p>
            <p className="mt-3">We grow the audience, deliver real value, and eventually sell to the right acquirer. We&apos;ll be transparent about that when the time comes.</p>
          </div>
        </div>

        <div className="mt-12 p-6 bg-blue-950/30 border border-blue-400/20 rounded-2xl text-center">
          <p className="text-sm text-white/60 mb-3">Join the newsletter — free.</p>
          <Link href="/#subscribe" className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-lg text-sm transition-colors">
            Subscribe to PassiveBlocks →
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-8">
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
