import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Newsletter Archive — PassiveBlocks",
  description: "Past editions of the PassiveBlocks weekly DeFi yield newsletter.",
};

const ISSUES = [
  {
    issue: 1,
    date: "2026-05-12",
    title: "Issue #1 — Fluid's Rise, Aerodrome's Gauge Cycle, and the Stablecoin Risk Ladder",
    preview:
      "This week: Fluid Protocol taking lending share, how to read the current Aerodrome gauge cycle, and a framework for ranking stablecoin yield by real risk.",
    href: "#",
  },
];

export default function NewsletterPage() {
  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
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
          <Link
            href="/#subscribe"
            className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Subscribe free →
          </Link>
        </div>
      </nav>

      <section className="px-6 pt-16 pb-8 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-white/30 mb-4">Archive</p>
          <h1 className="text-4xl font-extrabold mb-4">Every edition, in one place</h1>
          <p className="text-white/50 text-lg">Free to read. New issue every Monday.</p>
        </div>
      </section>

      <section className="px-6 py-12 max-w-3xl mx-auto">
        {ISSUES.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <p className="text-5xl mb-4">📬</p>
            <p className="text-lg">First issue drops Monday 12 May 2026.</p>
            <Link href="/#subscribe" className="mt-6 inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-lg text-sm transition-colors">
              Get notified →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {ISSUES.map((issue) => (
              <Link
                key={issue.issue}
                href={issue.href}
                className="block bg-white/[0.03] border border-white/[0.07] hover:border-blue-400/20 rounded-2xl p-6 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-white/30 mb-1">{issue.date} · Issue #{issue.issue}</div>
                    <h2 className="font-bold text-white mb-2">{issue.title}</h2>
                    <p className="text-sm text-white/50">{issue.preview}</p>
                  </div>
                  <span className="text-blue-400 text-xl shrink-0">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
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
