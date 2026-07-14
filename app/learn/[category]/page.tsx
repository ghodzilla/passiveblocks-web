import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  LEARN_CATEGORIES,
  getLearnCategory,
  getArticlesByCategory,
} from "@/lib/learn";
import { PILLARS, type PillarSlug } from "@/lib/pillars";
import NewsletterSignup from "@/components/NewsletterSignup";
import type { Metadata } from "next";

export async function generateStaticParams() {
  return LEARN_CATEGORIES.map((cat) => ({ category: cat.id }));
}

export async function generateMetadata({
  params,
}: {
  params: { category: string };
}): Promise<Metadata> {
  const cat = getLearnCategory(params.category);
  if (!cat) return {};
  return {
    title: `${cat.label} — Learn — PassiveBlocks`,
    description: cat.description,
  };
}

// ── Pillar-specific copy ───────────────────────────────────────────────────────
const PILLAR_META: Record<
  string,
  { explainer: string; riskProfile: string }
> = {
  "crypto-yield": {
    explainer:
      "DeFi protocols pay you to lend capital or provide trading liquidity. Rates are set by supply and demand — not a bank. This section covers everything from stablecoin lending at 4–7% to concentrated LP positions that can return 20–60% when fees align, with honest accounting for every risk in between.",
    riskProfile:
      "Risk: Medium to high — smart contract exposure, protocol risk, possible impermanent loss on LP positions, depeg risk on stable pairs.",
  },
  stocks: {
    explainer:
      "Dividend ETFs and covered-call income funds offer predictable monthly or quarterly distributions without picking individual stocks. This section explains how distributions actually work, what drives stated yield, and the difference between sustainable dividend income and NAV-eroding return-of-capital strategies.",
    riskProfile:
      "Risk: Low to medium — market risk, distribution yield fluctuations, covered-call strategies cap upside in rising markets.",
  },
  airdrops: {
    explainer:
      "Protocols distribute tokens to early users as a reward for participation, testing, and liquidity provisioning. This section covers how to identify likely airdrop candidates, how eligibility is determined, and how to farm efficiently without burning more in gas than you receive.",
    riskProfile:
      "Risk: Medium to high — opportunity cost, gas fees, eligibility uncertain, tax treatment varies by jurisdiction, sybil detection may disqualify mass farmers.",
  },
  "ai-crypto": {
    explainer:
      "A growing set of protocols pay stakers and node operators in their native AI tokens. The yield denominated in USD can look attractive — until the token price moves. This section gives an honest account of what the yield actually consists of, how networks like Bittensor work, and where the risks are.",
    riskProfile:
      "Risk: High — token price volatility, early-stage network risk, USD returns are uncertain for token-denominated rewards.",
  },
};

export default function LearnCategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const cat = getLearnCategory(params.category);
  if (!cat) notFound();

  const articles = getArticlesByCategory(params.category);
  const isPillar = params.category in PILLARS;
  const pillarStyle = isPillar ? PILLARS[params.category as PillarSlug] : null;
  const pillarMeta = PILLAR_META[params.category] ?? null;

  return (
    <div className="min-h-screen bg-[#08080f] text-white">
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
            <Link href="/learn" className="hover:text-white transition-colors">
              Learn
            </Link>
            <Link href="/newsletter" className="hover:text-white transition-colors">
              Archive
            </Link>
            <Link href="/tax" className="hover:text-white transition-colors">
              Tax Calculator
            </Link>
            <Link href="/about" className="hover:text-white transition-colors">
              About
            </Link>
          </div>
          <Link
            href="/#subscribe"
            className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Subscribe free →
          </Link>
        </div>
      </nav>

      <div className="px-6 py-12 max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <div className="text-sm text-white/30 mb-8">
          <Link href="/learn" className="hover:text-white transition-colors">
            Learn
          </Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">{cat.label}</span>
        </div>

        {/* Category hero */}
        <div className="mb-12">
          <div className="text-5xl mb-4">{cat.icon}</div>

          {/* Pillar name — use accent colour for the 4 pillar categories */}
          {pillarStyle ? (
            <h1
              className="text-3xl sm:text-4xl font-extrabold mb-3"
              style={{ color: pillarStyle.accent === "#1c6b47" ? undefined : undefined }}
            >
              <span className={pillarStyle.textClass}>{cat.label}</span>
            </h1>
          ) : (
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
              {cat.label}
            </h1>
          )}

          {/* Explainer — use pillar-specific copy if available, else fall back to description */}
          {pillarMeta ? (
            <>
              <p className="text-white/60 text-lg leading-relaxed mb-4">
                {pillarMeta.explainer}
              </p>
              <p
                className={`text-sm font-medium ${pillarStyle ? pillarStyle.textClass : "text-blue-400"} opacity-80`}
              >
                {pillarMeta.riskProfile}
              </p>
            </>
          ) : (
            <p className="text-white/50 text-lg">{cat.description}</p>
          )}
        </div>

        {/* Article list */}
        {articles.length > 0 ? (
          <div className="flex flex-col gap-4 mb-12">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/learn/${params.category}/${article.slug}`}
                className="border border-white/10 rounded-2xl p-6 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div
                      className={`text-xs font-bold tracking-widest uppercase mb-2 ${
                        pillarStyle ? pillarStyle.textClass : "text-blue-400"
                      }`}
                    >
                      {article.tag}
                    </div>
                    <div className="font-semibold text-white text-lg leading-snug mb-2">
                      {article.title}
                    </div>
                    <div className="text-sm text-white/40 leading-relaxed">
                      {article.excerpt}
                    </div>
                  </div>
                  <div className="text-xs text-white/30 whitespace-nowrap text-right shrink-0">
                    <div>{article.date}</div>
                    <div className="mt-1">{article.readTime} read</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-white/30 text-sm mb-12">
            No articles yet — check back soon.
          </p>
        )}

        {/* Inline newsletter capture for pillar hubs */}
        {isPillar && (
          <div className="mb-12 p-6 bg-white/[0.03] border border-white/10 rounded-2xl">
            <p className="text-white/60 text-sm text-center mb-4">
              Get the weekly PassiveBlocks briefing — yield moves, protocol
              updates, and honest analysis. Free.
            </p>
            <NewsletterSignup />
          </div>
        )}

        {/* Back link */}
        <Link
          href="/learn"
          className="text-sm text-white/40 hover:text-white transition-colors"
        >
          ← Back to Learn
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 mt-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-white/25">
          <Link href="/">
            <Image
              src="/passiveblocks_logo_cropped.png"
              alt="PassiveBlocks"
              width={130}
              height={30}
              className="h-8 w-auto opacity-50"
            />
          </Link>
          <span>© {new Date().getFullYear()} PassiveBlocks</span>
        </div>
      </footer>
    </div>
  );
}
