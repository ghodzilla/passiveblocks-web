import Link from "next/link";
import { notFound } from "next/navigation";
import { getDraft } from "@/lib/drafts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Draft — PassiveBlocks (private)",
  robots: { index: false, follow: false },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string): string {
  // Escape first, then apply inline markdown.
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, '<code class="bg-white/10 text-amber-200 rounded px-1 py-0.5 text-[0.9em]">$1</code>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
  // Links: [text](url)
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline underline-offset-2 hover:text-blue-300">$1</a>',
  );
  return out;
}

function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      out.push('<hr class="border-white/10 my-6" />');
      i++;
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (h) {
      const level = h[1].length;
      const text = inline(h[2]);
      const sizes: Record<number, string> = {
        1: "text-3xl font-extrabold text-white mt-8 mb-3",
        2: "text-2xl font-bold text-white mt-8 mb-2",
        3: "text-xl font-bold text-white mt-6 mb-2",
        4: "text-lg font-semibold text-white mt-5 mb-1",
        5: "text-base font-semibold text-white mt-4 mb-1",
        6: "text-sm font-semibold text-white mt-4 mb-1",
      };
      out.push(`<h${level} class="${sizes[level]}">${text}</h${level}>`);
      i++;
      continue;
    }

    // Fenced code block
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      out.push(
        `<pre class="bg-white/5 border border-white/10 rounded-lg p-4 overflow-x-auto text-sm font-mono text-white/80 my-4"><code>${escapeHtml(buf.join("\n"))}</code></pre>`,
      );
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(
        `<blockquote class="border-l-4 border-blue-400/40 pl-4 my-4 text-white/70 italic">${inline(buf.join(" "))}</blockquote>`,
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(
        `<ul class="list-disc list-outside pl-6 space-y-1 my-4 text-white/75">${items
          .map((it) => `<li>${inline(it)}</li>`)
          .join("")}</ul>`,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push(
        `<ol class="list-decimal list-outside pl-6 space-y-1 my-4 text-white/75">${items
          .map((it) => `<li>${inline(it)}</li>`)
          .join("")}</ol>`,
      );
      continue;
    }

    // Table (pipe-delimited)
    if (/^\|/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      out.push(
        `<pre class="bg-white/5 border border-white/10 rounded-lg p-3 overflow-x-auto text-xs font-mono text-white/70 my-4">${escapeHtml(buf.join("\n"))}</pre>`,
      );
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: collect contiguous non-empty, non-special lines
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^\|/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(
      `<p class="text-white/75 leading-relaxed my-3">${inline(buf.join(" "))}</p>`,
    );
  }

  return out.join("\n");
}

export default function DraftDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const draft = getDraft(params.slug);
  if (!draft) notFound();

  const html = renderMarkdown(draft.content);

  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      <nav className="border-b border-white/5 px-5 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/drafts"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            ← Back to drafts
          </Link>
          <span className="text-[11px] font-bold tracking-widest uppercase text-white/40">
            Private
          </span>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-5 py-8">
        <header className="mb-6 pb-6 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3 text-[11px] font-bold tracking-widest uppercase">
            <span className="text-blue-400">{draft.typeLabel}</span>
            <span className="text-white/20">·</span>
            <span
              className={
                draft.status === "LIVE"
                  ? "text-emerald-300"
                  : "text-amber-300"
              }
            >
              {draft.status}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-3">
            {draft.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/40">
            <span>Modified {draft.modifiedAt}</span>
            <span>·</span>
            <span>{draft.wordCount.toLocaleString()} words</span>
            <span>·</span>
            <span className="font-mono">{draft.filename}</span>
          </div>
        </header>

        <div
          className="text-[1rem]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>

      <footer className="border-t border-white/5 px-5 py-6 mt-12">
        <div className="max-w-3xl mx-auto text-[11px] text-white/30">
          <Link href="/drafts" className="hover:text-white transition-colors">
            ← Back to drafts index
          </Link>
        </div>
      </footer>
    </div>
  );
}
