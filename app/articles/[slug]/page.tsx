import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ARTICLES, getArticle } from "@/lib/articles";
import type { Metadata } from "next";

export async function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const article = getArticle(params.slug);
  if (!article) return {};
  return {
    title: `${article.title} — PassiveBlocks`,
    description: article.excerpt,
  };
}

export default function ArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const article = getArticle(params.slug);
  if (!article) notFound();

  const paragraphs = article.content
    .trim()
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

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

      <article className="px-6 py-16 max-w-2xl mx-auto">
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

        <div className="prose-custom space-y-5 text-white/75 leading-relaxed text-[1.05rem]">
          {paragraphs.map((block, i) => {
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
                  {items.map((item, j) => (
                    <li key={j}>{item.replace("- ", "")}</li>
                  ))}
                </ul>
              );
            }
            if (block.startsWith("---")) {
              return <hr key={i} className="border-white/10 my-8" />;
            }
            const boldReplaced = block.replace(
              /\*\*(.+?)\*\*/g,
              '<strong class="text-white font-semibold">$1</strong>'
            );
            return (
              <p key={i} dangerouslySetInnerHTML={{ __html: boldReplaced }} />
            );
          })}
        </div>

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
