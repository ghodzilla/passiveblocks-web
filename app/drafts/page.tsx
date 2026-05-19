import Link from "next/link";
import { getAllDrafts, groupByType, type DraftMeta } from "@/lib/drafts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Drafts — PassiveBlocks (private)",
  robots: { index: false, follow: false },
};

function StatusBadge({ status }: { status: DraftMeta["status"] }) {
  if (status === "LIVE") {
    return (
      <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
        LIVE
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
      DRAFT
    </span>
  );
}

export default function DraftsIndexPage() {
  const all = getAllDrafts();
  const groups = groupByType(all);

  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      <nav className="border-b border-white/5 px-5 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-tight text-white">
            PassiveBlocks
          </Link>
          <span className="text-[11px] font-bold tracking-widest uppercase text-white/40">
            Drafts · Private
          </span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-5 py-10">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-1">Content drafts</h1>
          <p className="text-sm text-white/50">
            {all.length} files · Review before publish. Newest first within each group.
          </p>
        </header>

        {groups.length === 0 ? (
          <div className="text-white/40 text-sm">No drafts found.</div>
        ) : (
          <div className="space-y-10">
            {groups.map((group) => (
              <section key={group.type}>
                <h2 className="text-xs font-bold tracking-widest uppercase text-white/40 mb-3">
                  {group.label} <span className="text-white/25">· {group.items.length}</span>
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.items.map((d) => (
                    <li key={d.slug}>
                      <Link
                        href={`/drafts/${d.slug}`}
                        className="block h-full border border-white/10 rounded-xl p-4 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="font-semibold text-white leading-snug line-clamp-2">
                            {d.title}
                          </div>
                          <StatusBadge status={d.status} />
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-white/40 mb-2">
                          <span>{d.modifiedAt}</span>
                          <span>·</span>
                          <span>{d.wordCount.toLocaleString()} words</span>
                          <span>·</span>
                          <span className="font-mono truncate max-w-[180px]">{d.filename}</span>
                        </div>
                        <p className="text-sm text-white/55 leading-relaxed line-clamp-3">
                          {d.preview}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 px-5 py-6 mt-12">
        <div className="max-w-5xl mx-auto text-[11px] text-white/30">
          Private review surface · IP-restricted · Not indexed
        </div>
      </footer>
    </div>
  );
}
