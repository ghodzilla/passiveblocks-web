// Server component — fetches live Crypto Fear & Greed Index from alternative.me
// Refreshes every hour via Next.js ISR

type FGEntry = {
  value: string;
  value_classification: string;
  timestamp: string;
};

async function getFearGreed(): Promise<FGEntry[]> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=8", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

function getColor(value: number): { text: string; bg: string; border: string; bar: string } {
  if (value <= 24) return { text: "text-red-400",    bg: "bg-red-950/40",    border: "border-red-500/30",   bar: "bg-red-500"    };
  if (value <= 49) return { text: "text-orange-400", bg: "bg-orange-950/40", border: "border-orange-500/30", bar: "bg-orange-500" };
  if (value <= 54) return { text: "text-yellow-400", bg: "bg-yellow-950/40", border: "border-yellow-500/30", bar: "bg-yellow-500" };
  if (value <= 74) return { text: "text-emerald-400",bg: "bg-emerald-950/40",border: "border-emerald-500/30",bar: "bg-emerald-500"};
  return               { text: "text-green-400",   bg: "bg-green-950/40",  border: "border-green-500/30",  bar: "bg-green-500"  };
}

function dayLabel(timestamp: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Yesterday";
  const d = new Date(parseInt(timestamp) * 1000);
  return d.toLocaleDateString("en-AU", { weekday: "short" });
}

export default async function FearGreedWidget() {
  const data = await getFearGreed();
  if (!data.length) return null;

  const current = data[0];
  const currentVal = parseInt(current.value);
  const colors = getColor(currentVal);
  const history = data.slice(1, 8); // previous 7 days

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5 flex flex-col gap-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase text-white/30 mb-0.5">
            Crypto Sentiment
          </p>
          <p className="text-sm font-bold text-white/70">Fear &amp; Greed Index</p>
        </div>
        <span className="text-[10px] font-semibold text-white/20 bg-white/[0.05] px-2 py-1 rounded-full">
          Live · alt.me
        </span>
      </div>

      {/* Big number */}
      <div className="flex items-end gap-3">
        <span className={`text-5xl font-extrabold tabular-nums leading-none ${colors.text}`}>
          {currentVal}
        </span>
        <div className="mb-1">
          <span className={`text-base font-bold ${colors.text}`}>
            {current.value_classification}
          </span>
          <p className="text-xs text-white/30">out of 100</p>
        </div>
      </div>

      {/* Gauge bar */}
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colors.bar}`}
          style={{ width: `${currentVal}%` }}
        />
      </div>

      {/* 7-day mini history */}
      <div className="flex items-end gap-1.5 pt-1">
        {history.map((entry, i) => {
          const v = parseInt(entry.value);
          const c = getColor(v);
          const heightPct = Math.max(12, v);
          return (
            <div key={entry.timestamp} className="flex flex-col items-center gap-1 flex-1">
              <span className={`text-[9px] font-bold ${c.text}`}>{v}</span>
              <div
                className={`w-full rounded-sm ${c.bar} opacity-70`}
                style={{ height: `${heightPct * 0.32}px` }}
                title={`${dayLabel(entry.timestamp, i + 1)}: ${v} — ${entry.value_classification}`}
              />
              <span className="text-[8px] text-white/20 text-center leading-tight">
                {dayLabel(entry.timestamp, i + 1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
