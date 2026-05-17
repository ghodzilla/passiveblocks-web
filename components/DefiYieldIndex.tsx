// Server component — PassiveBlocks DeFi Yield Opportunity Index
// Computed from DeFiLlama stablecoin pool data. Refreshes hourly via ISR.

const TARGET_CHAINS = new Set(["Ethereum", "Arbitrum", "Base", "Solana"]);

type Pool = {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  stablecoin: boolean;
};

async function getYieldData(): Promise<{ score: number; label: string; medianApy: number; poolCount: number } | null> {
  try {
    const res = await fetch("https://yields.llama.fi/pools", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const json: { data: Pool[] } = await res.json();

    const relevant = json.data.filter(
      (p) =>
        p.stablecoin &&
        TARGET_CHAINS.has(p.chain) &&
        p.tvlUsd >= 1_000_000 &&
        p.apy > 0 &&
        p.apy < 300
    );
    if (!relevant.length) return null;

    const top = relevant.sort((a, b) => b.tvlUsd - a.tvlUsd).slice(0, 25);
    const apys = top.map((p) => p.apy).sort((a, b) => a - b);
    const mid = Math.floor(apys.length / 2);
    const medianApy = apys.length % 2 ? apys[mid] : (apys[mid - 1] + apys[mid]) / 2;

    let score: number;
    if (medianApy < 2)       score = Math.round(10 + medianApy * 7.5);
    else if (medianApy < 4)  score = Math.round(25 + (medianApy - 2) * 12.5);
    else if (medianApy < 6)  score = Math.round(50 + (medianApy - 4) * 10);
    else if (medianApy < 10) score = Math.round(70 + (medianApy - 6) * 5);
    else                     score = Math.min(98, Math.round(90 + (medianApy - 10) * 0.5));

    let label: string;
    if (score <= 25)      label = "Bear Yields";
    else if (score <= 45) label = "Low";
    else if (score <= 65) label = "Fair Yields";
    else if (score <= 82) label = "High";
    else                  label = "Exceptional";

    return { score, label, medianApy, poolCount: relevant.length };
  } catch {
    return null;
  }
}

function pt(deg: number, r: number, cx: number, cy: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arc(a1: number, a2: number, r: number, cx: number, cy: number) {
  const p1 = pt(a1, r, cx, cy);
  const p2 = pt(a2, r, cx, cy);
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 0 0 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

function scoreColor(score: number): string {
  if (score <= 25) return "#ef4444";
  if (score <= 45) return "#f97316";
  if (score <= 65) return "#eab308";
  if (score <= 82) return "#10b981";
  return "#22c55e";
}

export default async function DefiYieldIndex() {
  const data = await getYieldData();

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5 flex items-center justify-center min-h-[200px]">
        <p className="text-xs text-white/25">Yield data unavailable</p>
      </div>
    );
  }

  const { score, label, medianApy, poolCount } = data;
  const color = scoreColor(score);

  const cx = 110, cy = 108, r = 84, sw = 10;
  const needleDeg = 180 - score * 1.8;
  const needleRad = (needleDeg * Math.PI) / 180;
  const nLen = r - sw / 2 - 8;
  const nx = (cx + nLen * Math.cos(needleRad)).toFixed(2);
  const ny = (cy - nLen * Math.sin(needleRad)).toFixed(2);

  const zones: [number, number, string][] = [
    [180, 136.5, "#ef4444"],
    [133.5, 91.5, "#f97316"],
    [88.5, 72,    "#eab308"],
    [70, 36,      "#10b981"],
    [34, 0,       "#22c55e"],
  ];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-white/60">Stablecoin Yield Score</p>
        <span className="text-[10px] font-semibold text-white/20 bg-white/[0.05] px-2 py-0.5 rounded-full">
          {poolCount} pools · DeFiLlama
        </span>
      </div>

      <svg viewBox="0 0 220 122" width="100%" style={{ display: "block" }}>
        <path
          d={arc(180, 0, r, cx, cy)}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={sw}
          strokeLinecap="butt"
        />
        {zones.map(([a1, a2, c], i) => (
          <path
            key={i}
            d={arc(a1, a2, r, cx, cy)}
            fill="none"
            stroke={c}
            strokeWidth={sw}
            strokeLinecap="round"
            opacity="0.95"
          />
        ))}
        <text
          x={cx} y={cy - 44}
          textAnchor="middle"
          fill={color}
          fontSize="11"
          fontWeight="700"
          fontFamily="system-ui,sans-serif"
          letterSpacing="0.1em"
        >
          {label.toUpperCase()}
        </text>
        <text
          x={cx} y={cy - 20}
          textAnchor="middle"
          fill="white"
          fontSize="36"
          fontWeight="800"
          fontFamily="system-ui,sans-serif"
        >
          {score}
        </text>
        <text
          x={cx} y={cy - 5}
          textAnchor="middle"
          fill="rgba(255,255,255,0.22)"
          fontSize="9"
          fontFamily="system-ui,sans-serif"
        >
          {medianApy.toFixed(2)}% median APY
        </text>
        <line
          x1={cx} y1={cy}
          x2={nx} y2={ny}
          stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.85"
        />
        <circle cx={cx} cy={cy} r="4" fill="white" opacity="0.85" />
      </svg>

      <div className="flex justify-between text-[9px] text-white/20 font-medium px-1 -mt-3">
        <span>Bear</span>
        <span>Low</span>
        <span>High</span>
        <span>Exceptional</span>
      </div>
    </div>
  );
}
