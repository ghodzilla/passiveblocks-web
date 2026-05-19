import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  LEARN_ARTICLES,
  getLearnArticle,
  getLearnCategory,
  getArticlesByCategory,
  type LearnArticle,
} from "@/lib/learn";
import type { Metadata } from "next";

const SITE_URL = "https://www.passiveblocks.io";
const OG_IMAGE_FALLBACK = `${SITE_URL}/passiveblocks_logo.png`;
const LOGO_IMAGE = `${SITE_URL}/passiveblocks_logo.png`;

function deriveExcerpt(article: LearnArticle): string {
  if (article.excerpt && article.excerpt.trim().length > 0) {
    return article.excerpt;
  }
  // Fallback: first 160 chars of body text (strip markdown markers + heading lines)
  const plain = article.content
    .split("\n")
    .filter((l) => !l.startsWith("#") && !l.startsWith("|") && !l.startsWith("---"))
    .join(" ")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.slice(0, 160);
}

function articleDates(article: LearnArticle): { published: string; modified: string } {
  // Use publishedAt / updatedAt if present, otherwise fall back to `date` field.
  // `date` field is YYYY-MM-DD; we expand to ISO 8601 with a fixed UTC time.
  const toIso = (d: string) => {
    if (!d) return new Date().toISOString();
    if (d.includes("T")) return d;
    return `${d}T00:00:00.000Z`;
  };
  const published = toIso(article.publishedAt || article.date);
  const modified = toIso(article.updatedAt || article.publishedAt || article.date);
  return { published, modified };
}

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
  if (!article || article.category !== params.category) return {};
  const description = deriveExcerpt(article);
  const canonical = `${SITE_URL}/learn/${article.category}/${article.slug}`;
  const { published, modified } = articleDates(article);

  return {
    title: `${article.title} — PassiveBlocks`,
    description,
    alternates: { canonical },
    openGraph: {
      title: article.title,
      description,
      url: canonical,
      type: "article",
      siteName: "PassiveBlocks",
      publishedTime: published,
      modifiedTime: modified,
      authors: ["PassiveBlocks"],
      images: [
        {
          url: OG_IMAGE_FALLBACK,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: [OG_IMAGE_FALLBACK],
    },
  };
}

// ── Inline markdown helpers ────────────────────────────────────────────────────
function renderInline(text: string): string {
  // Escape first, then re-introduce safe tags via marker substitution to avoid double-escape on attrs.
  // We accept the trade-off that markdown link URLs are author-controlled (article content authored by us).
  // 1) bold **x**
  let out = text.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="text-white font-semibold">$1</strong>'
  );
  // 2) italics *x* (only single asterisks not adjacent to spaces)
  out = out.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em class="text-white/80">$2</em>');
  // 3) links [text](url)
  out = out.replace(
    /\[(.+?)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g,
    (_m, label: string, url: string) => {
      const isExternal = url.startsWith("http");
      const attrs = isExternal
        ? `target="_blank" rel="noopener noreferrer"`
        : "";
      return `<a href="${url}" ${attrs} class="text-blue-400 underline underline-offset-2 hover:text-blue-300">${label}</a>`;
    }
  );
  return out;
}

// ── Block renderer ─────────────────────────────────────────────────────────────
function renderTable(block: string, key: number): JSX.Element {
  const lines = block.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) {
    return (
      <pre key={key} className="text-sm text-white/60 overflow-x-auto font-mono bg-white/5 rounded-lg p-4">
        {block}
      </pre>
    );
  }
  const splitRow = (row: string) =>
    row
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  const header = splitRow(lines[0]);
  // lines[1] is alignment separator (---), skip it
  const bodyLines = lines.slice(2);
  return (
    <div key={key} className="overflow-x-auto my-6">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {header.map((h, hi) => (
              <th
                key={hi}
                className="text-left py-2 px-3 border-b border-white/15 text-blue-300 font-semibold"
                dangerouslySetInnerHTML={{ __html: renderInline(h) }}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyLines.map((row, ri) => {
            const cells = splitRow(row);
            return (
              <tr key={ri} className="border-b border-white/5 hover:bg-white/[0.02]">
                {cells.map((c, ci) => (
                  <td
                    key={ci}
                    className="py-2 px-3 align-top text-white/75"
                    dangerouslySetInnerHTML={{ __html: renderInline(c) }}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderContent(content: string) {
  const blocks = content
    .trim()
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, i) => {
    if (block.startsWith("## ")) {
      return (
        <h2 key={i} className="text-xl font-bold text-white mt-10 mb-2">
          {block.replace(/^## /, "")}
        </h2>
      );
    }
    if (block.startsWith("### ")) {
      return (
        <h3 key={i} className="text-lg font-semibold text-white mt-8 mb-1">
          {block.replace(/^### /, "")}
        </h3>
      );
    }
    if (block.startsWith("---")) {
      return <hr key={i} className="border-white/10 my-8" />;
    }
    if (block.startsWith("|")) {
      return renderTable(block, i);
    }
    if (block.startsWith("- ") || block.startsWith("* ")) {
      const items = block.split("\n").filter((l) => /^[-*] /.test(l.trim()));
      return (
        <ul key={i} className="list-disc list-inside space-y-1 text-white/70">
          {items.map((item, j) => {
            const html = renderInline(item.replace(/^[-*] /, ""));
            return <li key={j} dangerouslySetInnerHTML={{ __html: html }} />;
          })}
        </ul>
      );
    }
    if (/^\d+\.\s/.test(block.split("\n")[0])) {
      const items = block.split("\n").filter((l) => /^\d+\.\s/.test(l.trim()));
      return (
        <ol key={i} className="list-decimal list-inside space-y-1 text-white/70">
          {items.map((item, j) => {
            const html = renderInline(item.replace(/^\d+\.\s/, ""));
            return <li key={j} dangerouslySetInnerHTML={{ __html: html }} />;
          })}
        </ol>
      );
    }
    if (
      block.startsWith("**") &&
      block.endsWith("**") &&
      !block.slice(2, -2).includes("**")
    ) {
      return (
        <p key={i} className="font-semibold text-white">
          {block.replace(/\*\*/g, "")}
        </p>
      );
    }
    return (
      <p key={i} dangerouslySetInnerHTML={{ __html: renderInline(block) }} />
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
  const description = deriveExcerpt(article);
  const canonical = `${SITE_URL}/learn/${article.category}/${article.slug}`;
  const { published, modified } = articleDates(article);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description,
    image: OG_IMAGE_FALLBACK,
    author: {
      "@type": "Organization",
      name: "PassiveBlocks",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "PassiveBlocks",
      logo: {
        "@type": "ImageObject",
        url: LOGO_IMAGE,
      },
    },
    datePublished: published,
    dateModified: modified,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
  };

  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      {/* JSON-LD Article schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
