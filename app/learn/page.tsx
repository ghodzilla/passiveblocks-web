import Image from "next/image";
import Link from "next/link";
import { LEARN_CATEGORIES, LEARN_ARTICLES } from "@/lib/learn";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn DeFi Yield — PassiveBlocks",
  description:
    "Plain-English guides for crypto holders who want to earn more without guessing. DeFi basics, staking, protocols, wallets, yield strategies, and AU tax.",
};

export default function LearnPage() {
  const recentArticles = [...LEARN_ARTICLES]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

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
            <Link href="/learn" className="text-white transition-colors">
              Learn
            </Link>
            <Link href="/newsletter" className="hover:text-white transition-colors">
              Archive
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

      {/* Hero */}
      <section className="px-6 py-16 max-w-5xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
          Learn DeFi Yield
        </h1>
        <p className="text-lg text-white/50 max-w-xl mx-auto">
          Plain-English guides for crypto holders who want to earn more without guessing.
        </p>
      </section>

      {/* Categories grid */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <h2 className="text-xl font-bold mb-6 text-white/80">Browse by topic</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {LEARN_CATEGORIES.map((cat) => {
            const count = LEARN_ARTICLES.filter((a) => a.category === cat.id).length;
            return (
              <Link
                key={cat.id}
                href={`/learn/${cat.id}`}
                className="border border-white/10 rounded-2xl p-6 bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <div className="text-3xl mb-3">{cat.icon}</div>
                <div className="font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
                  {cat.label}
                </div>
                <div className="text-sm text-white/40 mb-3 leading-snug">
                  {cat.description}
                </div>
                <div className="text-xs text-blue-400 font-semibold">
                  {count} article{count !== 1 ? "s" : ""} →
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent articles */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <h2 className="text-xl font-bold mb-6 text-white/80">Recently added</h2>
        <div className="flex flex-col gap-4">
          {recentArticles.map((article) => {
            return (
              <Link
                key={article.slug}
                href={`/learn/${article.category}/${article.slug}`}
                className="border border-white/10 rounded-2xl p-5 bg-white/5 hover:bg-white/10 transition-colors flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold tracking-widest uppercase text-blue-400">
                      {article.tag}
                    </span>
                  </div>
                  <div className="font-semibold text-white leading-snug">{article.title}</div>
                  <div className="text-sm text-white/40 mt-1 line-clamp-2">{article.excerpt}</div>
                </div>
                <div className="text-xs text-white/30 whitespace-nowrap sm:text-right">
                  <div>{article.date}</div>
                  <div>{article.readTime} read</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

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
