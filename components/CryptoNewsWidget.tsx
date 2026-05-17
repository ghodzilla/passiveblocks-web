// Server component — fetches live crypto news from RSS feeds
// Refreshes every 30 min via Next.js ISR

type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  tag: string;
};

const SOURCES = [
  { name: "CoinTelegraph", url: "https://cointelegraph.com/rss", tag: "CoinTelegraph" },
  { name: "Coindesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", tag: "CoinDesk" },
];

function extractText(xml: string, tag: string): string {
  const cdataMatch = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`).exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();
  const plainMatch = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`).exec(xml);
  return plainMatch ? plainMatch[1].trim() : "";
}

function inferTag(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("ethereum") || t.includes(" eth ")) return "Ethereum";
  if (t.includes("bitcoin") || t.includes(" btc ")) return "Bitcoin";
  if (t.includes("solana") || t.includes(" sol ")) return "Solana";
  if (t.includes("base")) return "Base";
  if (t.includes("arbitrum")) return "Arbitrum";
  if (t.includes("defi") || t.includes("protocol") || t.includes("liquidity")) return "DeFi";
  if (t.includes("aave") || t.includes("uniswap") || t.includes("compound")) return "DeFi";
  if (t.includes("stablecoin") || t.includes("usdc") || t.includes("usdt")) return "Stables";
  if (t.includes("nft") || t.includes("token") || t.includes("altcoin")) return "Altcoin";
  return "Crypto";
}

function formatAge(pubDate: string): string {
  try {
    const diff = Date.now() - new Date(pubDate).getTime();
    const hours = Math.floor(diff / 3_600_000);
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return "";
  }
}

async function fetchFeed(url: string, sourceName: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: NewsItem[] = [];
    const rawItems = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
    for (const raw of rawItems.slice(0, 10)) {
      const title = extractText(raw, "title");
      const link = extractText(raw, "link") || (/<link\s*\/>/.exec(raw)?.[0] ?? "");
      const pubDate = extractText(raw, "pubDate");
      if (!title) continue;
      items.push({ title, link, pubDate, source: sourceName, tag: inferTag(title) });
    }
    return items;
  } catch {
    return [];
  }
}

export default async function CryptoNewsWidget() {
  const results = await Promise.allSettled(
    SOURCES.map((s) => fetchFeed(s.url, s.name))
  );

  const all: NewsItem[] = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => {
      try {
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      } catch {
        return 0;
      }
    })
    .slice(0, 6);

  if (!all.length) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {all.map((item, i) => (
        <a
          key={i}
          href={item.link || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 bg-white/[0.02] border border-white/[0.05] rounded-xl px-5 py-3.5 hover:border-white/[0.12] hover:bg-white/[0.035] transition-colors group"
        >
          <span className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mt-0.5 w-12 shrink-0 leading-tight">
            {formatAge(item.pubDate)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/75 leading-snug group-hover:text-white/90 transition-colors line-clamp-2">
              {item.title}
            </p>
            <span className="text-[10px] text-white/25 mt-0.5 block">{item.source}</span>
          </div>
          <span className="text-[10px] font-semibold text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-full shrink-0 hidden sm:block mt-0.5">
            {item.tag}
          </span>
        </a>
      ))}
    </div>
  );
}
