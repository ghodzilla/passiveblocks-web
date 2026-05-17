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

// Compute SVG point on gauge arc (math angles: 0=right, 90=up, 180=left)
function pt(deg: number, r: number, cx: number, cy: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

// Arc segment path (decreasing angle = sweeping counterclockwise in screen space = through top)
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

  // Gauge geometry
  const cx = 110, cy = 104, r = 82, sw = 14;

  // Needle
  const needleDeg = 180 - v * 1.8;
  const needleRad = (needleDeg * Math.PI) / 180;
  const nLen = r - sw / 2 - 5;
  const nx = (cx + nLen * Math.cos(needleRad)).toFixed(2);
  const ny = (cy - nLen * Math.sin(needleRad)).toFixed(2);

  // Zones: [startAngle, endAngle, color]
  const zones: [number, number, string][] = [
    [180, 135, "#ef4444"],  // Extreme Fear  (0-25)
    [135, 90,  "#f97316"],  // Fear          (25-50)
    [90,  81,  "#eab308"],  // Neutral       (50-55)
    [81,  45,  "#10b981"],  // Greed         (55-75)
    [45,  0,   "#22c55e"],  // Extreme Greed (75-100)
  ];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold text-white/70">Fear &amp; Greed Index</p>
        <span className="text-[10px] font-semibold text-white/20 bg-white/[0.05] px-2 py-0.5 rounded-full">
          Live · alt.me
        </span>
      </div>

      {/* Gauge SVG */}
      <svg viewBox="0 0 220 118" width="100%" style={{ display: "block" }}>
        {/* Track */}
        <path
          d={arc(180, 0, r, cx, cy)}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
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
            strokeLinecap="butt"
            opacity="0.9"
          />
        ))}
        {/* Classification label */}
        <text
          x={cx}
          y={56}
          textAnchor="middle"
          fill={color}
          fontSize="12"
          fontWeight="700"
          fontFamily="system-ui,sans-serif"
          letterSpacing="0.08em"
        >
          {label}
        </text>
        {/* Value */}
        <text
          x={cx}
          y={84}
          textAnchor="middle"
          fill="white"
          fontSize="32"
          fontWeight="800"
          fontFamily="system-ui,sans-serif"
        >
          {v}
        </text>
        {/* /100 */}
        <text
          x={cx}
          y={97}
          textAnchor="middle"
          fill="rgba(255,255,255,0.25)"
          fontSize="9"
          fontFamily="system-ui,sans-serif"
        >
          out of 100
        </text>
        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={nx} y2={ny}
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* Needle pivot */}
        <circle cx={cx} cy={cy} r="4.5" fill="white" opacity="0.9" />
      </svg>

      {/* Legend */}
      <div className="flex justify-between text-[8px] text-white/25 font-medium px-1 -mt-2">
        <span className="text-left leading-tight">Extreme<br />Fear</span>
        <span className="text-center">Fear</span>
        <span className="text-center">Greed</span>
        <span className="text-right leading-tight">Extreme<br />Greed</span>
      </div>
    </div>
  );
}
