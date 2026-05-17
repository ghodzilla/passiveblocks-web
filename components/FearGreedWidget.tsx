// Server component — fetches live Crypto Fear & Greed Index from alternative.me
// Refreshes every hour via Next.js ISR

type FGEntry = { value: string; value_classification: string; timestamp: string };

async function getFearGreed(): Promise<FGEntry[]> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
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

function zoneColor(v: number): string {
  if (v <= 24) return "#ef4444";
  if (v <= 49) return "#f97316";
  if (v <= 54) return "#eab308";
  if (v <= 74) return "#10b981";
  return "#22c55e";
}

export default async function FearGreedWidget() {
  const data = await getFearGreed();
  if (!data.length) return null;

  const v = parseInt(data[0].value);
  const label = data[0].value_classification.toUpperCase();
  const color = zoneColor(v);

  const cx = 110, cy = 108, r = 84, sw = 10;

  const needleDeg = 180 - v * 1.8;
  const needleRad = (needleDeg * Math.PI) / 180;
  const nLen = r - sw / 2 - 8;
  const nx = (cx + nLen * Math.cos(needleRad)).toFixed(2);
  const ny = (cy - nLen * Math.sin(needleRad)).toFixed(2);

  // Zones with 1.5° gaps for clean visual separation
  const zones: [number, number, string][] = [
    [180, 136.5, "#ef4444"],
    [133.5, 91.5, "#f97316"],
    [88.5, 82.5,  "#eab308"],
    [79.5, 46.5,  "#10b981"],
    [43.5, 0,     "#22c55e"],
  ];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-white/60">Fear &amp; Greed Index</p>
        <span className="text-[10px] font-semibold text-white/20 bg-white/[0.05] px-2 py-0.5 rounded-full">
          Live · alt.me
        </span>
      </div>

      <svg viewBox="0 0 220 122" width="100%" style={{ display: "block" }}>
        {/* Track */}
        <path
          d={arc(180, 0, r, cx, cy)}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={sw}
          strokeLinecap="butt"
        />
        {/* Coloured zones */}
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
        {/* Classification label */}
        <text
          x={cx} y={cy - 44}
          textAnchor="middle"
          fill={color}
          fontSize="11"
          fontWeight="700"
          fontFamily="system-ui,sans-serif"
          letterSpacing="0.1em"
        >
          {label}
        </text>
        {/* Value */}
        <text
          x={cx} y={cy - 20}
          textAnchor="middle"
          fill="white"
          fontSize="36"
          fontWeight="800"
          fontFamily="system-ui,sans-serif"
        >
          {v}
        </text>
        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={nx} y2={ny}
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.85"
        />
        <circle cx={cx} cy={cy} r="4" fill="white" opacity="0.85" />
      </svg>

      {/* Legend */}
      <div className="flex justify-between text-[9px] text-white/20 font-medium px-1 -mt-3">
        <span>Extreme Fear</span>
        <span>Fear</span>
        <span>Greed</span>
        <span>Extreme Greed</span>
      </div>
    </div>
  );
}
