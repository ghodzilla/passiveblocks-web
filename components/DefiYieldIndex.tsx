// Server component — PassiveBlocks DeFi Yield Score
// Computed from DeFiLlama pool data across all major DeFi protocols.
// Refreshes hourly via ISR.

const TARGET_CHAINS = new Set(["Ethereum", "Arbitrum", "Base", "Solana"]);

type Pool = { chain: string; tvlUsd: number; apy: number; stablecoin: boolean };

async function getYieldData(): Promise<{ score: number; label: string; medianApy: number; poolCount: number } | null> {
  try {
    const res = await fetch("https://yields.llama.fi/pools", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const json: { data: Pool[] } = await res.json();

    const relevant = json.data.filter(
      (p) => TARGET_CHAINS.has(p.chain) && p.tvlUsd >= 5_000_000 && p.apy > 0 && p.apy < 150
    );
    if (!relevant.length) return null;

    const top = relevant.sort((a, b) => b.tvlUsd - a.tvlUsd).slice(0, 40);
    const apys = top.map((p) => p.apy).sort((a, b) => a - b);
    const mid = Math.floor(apys.length / 2);
    const medianApy = apys.length % 2 ? apys[mid] : (apys[mid - 1] + apys[mid]) / 2;

    let score: number;
    if (medianApy < 3)        score = Math.round(10 + medianApy * 5);
    else if (medianApy < 6)   score = Math.round(25 + (medianApy - 3) * 8.3);
    else if (medianApy < 10)  score = Math.round(50 + (medianApy - 6) * 5);
    else if (medianApy < 20)  score = Math.round(70 + (medianApy - 10) * 1.5);
    else                      score = Math.min(98, Math.round(85 + (medianApy - 20) * 0.3));

    const label =
      score <= 25 ? "Bear Yields" :
      score <= 45 ? "Low" :
      score <= 65 ? "Fair Yields" :
      score <= 82 ? "High" : "Exceptional";

    return { score, label, medianApy, poolCount: relevant.length };
  } catch {
    return null;
  }
}

function pt(deg: number, r: number, cx: number, cy: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(a1: number, a2: number, r: number, cx: number, cy: number) {
  const p1 = pt(a1, r, cx, cy);
  const p2 = pt(a2, r, cx, cy);
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

function scoreColor(score: number): string {
  if (score <= 25) return "#ef4444";
  if (score <= 45) return "#f97316";
  if (score <= 65) return "#facc15";
  if (score <= 82) return "#22c55e";
  return "#16a34a";
}

export default async function DefiYieldIndex() {
  const data = await getYieldData();

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5 flex items-center justify-center min-h-[180px]">
        <p className="text-xs text-white/25">Yield data unavailable</p>
      </div>
    );
  }

  const { score, label, medianApy, poolCount } = data;
  const color = scoreColor(score);
  const cx = 110, cy = 102, r = 76, sw = 7;

  const needleDeg = 180 - score * 1.8;
  const needleRad = (needleDeg * Math.PI) / 180;
  const nLen = r - sw / 2 - 6;
  const nx = (cx + nLen * Math.cos(needleRad)).toFixed(2);
  const ny = (cy - nLen * Math.sin(needleRad)).toFixed(2);

  const zones: [number, number, string][] = [
    [180, 135, "#ef4444"],
    [135, 90,  "#f97316"],
    [90,  72,  "#facc15"],
    [72,  36,  "#22c55e"],
    [36,  0,   "#16a34a"],
  ];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold text-white/60">DeFi Yield Score</p>
        <span className="text-[10px] font-semibold text-white/20 bg-white/[0.05] px-2 py-0.5 rounded-full">
          {poolCount} pools · DeFiLlama
        </span>
      </div>

      <svg viewBox="0 0 220 110" width="100%" style={{ display: "block" }}>
        <path
          d={arcPath(180, 0, r, cx, cy)}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={sw}
          strokeLinecap="butt"
        />
        {zones.map(([a1, a2, c], i) => (
          <path
            key={i}
            d={arcPath(a1, a2, r, cx, cy)}
            fill="none"
            stroke={c}
            strokeWidth={sw}
            strokeLinecap="butt"
          />
        ))}
        <text
          x={cx} y={62}
          textAnchor="middle"
          fill={color}
          fontSize="11"
          fontWeight="700"
          fontFamily="system-ui,sans-serif"
          letterSpacing="0.12em"
        >
          {label.toUpperCase()}
        </text>
        <text
          x={cx} y={75}
          textAnchor="middle"
          fill="white"
          fontSize="34"
          fontWeight="800"
          fontFamily="system-ui,sans-serif"
        >
          {score}
        </text>
        <text
          x={cx} y={88}
          textAnchor="middle"
          fill="rgba(255,255,255,0.2)"
          fontSize="8.5"
          fontFamily="system-ui,sans-serif"
        >
          {medianApy.toFixed(2)}% median APY
        </text>
        <line
          x1={cx} y1={cy} x2={nx} y2={ny}
          stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.8"
        />
        <circle cx={cx} cy={cy} r="3.5" fill="white" opacity="0.8" />
      </svg>

      <div className="flex justify-between text-[8.5px] text-white/20 font-medium px-0.5 -mt-2">
        <span>Bear</span>
        <span>Low</span>
        <span>High</span>
        <span>Exceptional</span>
      </div>
    </div>
  );
}
