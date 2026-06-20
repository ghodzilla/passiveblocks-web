import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  LEARN_CATEGORIES,
  getLearnCategory,
  getArticlesByCategory,
} from "@/lib/learn";
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

export default function LearnCategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const cat = getLearnCategory(params.category);
  if (!cat) notFound();

  const articles = getArticlesByCategory(params.category);

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
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">{cat.label}</h1>
          <p className="text-white/50 text-lg">{cat.description}</p>
        </div>

        {/* Article list */}
        <div className="flex flex-col gap-4 mb-12">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/learn/${params.category}/${article.slug}`}
              className="border border-white/10 rounded-2xl p-6 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-2">
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
