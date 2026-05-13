import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  LEARN_ARTICLES,
  getLearnArticle,
  getLearnCategory,
  getArticlesByCategory,
} from "@/lib/learn";
import type { Metadata } from "next";

export async function generateStaticParams() {
  return LEARN_ARTICLES.map((a) => ({
    category: a.category,
    slug: a.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: { category: string; slug: string };
}): Promise<Metadata> {
  const article = getLearnArticle(params.slug);
  if (!article) return {};
  return {
    title: `${article.title} — PassiveBlocks`,
    description: article.excerpt,
  };
}

function renderContent(content: string) {
  const paragraphs = content
    .trim()
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

  return paragraphs.map((block, i) => {
    if (block.startsWith("## ")) {
      return (
        <h2 key={i} className="text-xl font-bold text-white mt-10 mb-2">
          {block.replace("## ", "")}
        </h2>
      );
    }
    if (block.startsWith("### ")) {
      return (
        <h3 key={i} className="text-lg font-semibold text-white mt-8 mb-1">
          {block.replace("### ", "")}
        </h3>
      );
    }
    if (block.startsWith("**") && block.endsWith("**") && !block.slice(2).includes("**")) {
      return (
        <p key={i} className="font-semibold text-white">
          {block.replace(/\*\*/g, "")}
        </p>
      );
    }
    if (block.startsWith("- ")) {
      const items = block.split("\n").filter((l) => l.startsWith("- "));
      return (
        <ul key={i} className="list-disc list-inside space-y-1 text-white/70">
          {items.map((item, j) => {
            const lineHtml = item
              .replace("- ", "")
              .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
            return (
              <li key={j} dangerouslySetInnerHTML={{ __html: lineHtml }} />
            );
          })}
        </ul>
      );
    }
    if (block.startsWith("---")) {
      return <hr key={i} className="border-white/10 my-8" />;
    }
    if (block.startsWith("|")) {
      // Markdown table — render as plain pre for now
      return (
        <pre
          key={i}
          className="text-sm text-white/60 overflow-x-auto font-mono bg-white/5 rounded-lg p-4"
        >
          {block}
        </pre>
      );
    }
    // Inline bold + affiliate links
    const htmlContent = block
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(
        /\[(.+?)\]\((https?:\/\/[^\)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline underline-offset-2 hover:text-blue-300">$1</a>'
      );
    return (
      <p key={i} dangerouslySetInnerHTML={{ __html: htmlContent }} />
    );
  });
}

export default function LearnArticlePage({
  params,
}: {
  params: { category: string; slug: string };
}) {
  const article = getLearnArticle(params.slug);
  if (!article || article.category !== params.category) notFound();

  const cat = getLearnCategory(params.category);
  const relatedArticles = getArticlesByCategory(params.category).filter(
    (a) => a.slug !== params.slug
  );

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

      <article className="px-6 py-16 max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <div className="text-sm text-white/30 mb-8">
          <Link href="/learn" className="hover:text-white transition-colors">
            Learn
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/learn/${params.category}`}
            className="hover:text-white transition-colors"
          >
            {cat?.label ?? params.category}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-white/60 line-clamp-1">{article.title}</span>
        </div>

        {/* Article header */}
        <div className="mb-8">
          <span className="text-xs font-bold tracking-widest uppercase text-blue-400">
            {article.tag}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mt-3 mb-4">
            {article.title}
          </h1>
          <div className="flex items-center gap-3 text-sm text-white/40">
            <span>{article.date}</span>
            <span>·</span>
            <span>{article.readTime} read</span>
          </div>
        </div>

        {/* Content */}
        <div className="prose-custom space-y-5 text-white/75 leading-relaxed text-[1.05rem]">
          {renderContent(article.content)}
        </div>

        {/* More in category */}
        {relatedArticles.length > 0 && (
          <div className="mt-16">
            <h3 className="text-lg font-bold mb-4 text-white">
              More in {cat?.label ?? params.category}
            </h3>
            <div className="flex flex-col gap-3">
              {relatedArticles.slice(0, 2).map((rel) => (
                <Link
                  key={rel.slug}
                  href={`/learn/${params.category}/${rel.slug}`}
                  className="border border-white/10 rounded-xl p-4 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-1">
                    {rel.tag}
                  </div>
                  <div className="font-semibold text-white leading-snug">{rel.title}</div>
                  <div className="text-sm text-white/40 mt-1">{rel.readTime} read</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Subscribe CTA */}
        <div className="mt-16 p-6 bg-blue-950/30 border border-blue-400/20 rounded-2xl text-center">
          <p className="text-sm text-white/60 mb-3">
            Get analysis like this every Monday — free.
          </p>
          <Link
            href="/#subscribe"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-lg text-sm transition-colors"
          >
            Subscribe to PassiveBlocks →
          </Link>
        </div>
      </article>

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
