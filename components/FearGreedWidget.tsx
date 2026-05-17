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

function arcPath(a1: number, a2: number, r: number, cx: number, cy: number) {
  const p1 = pt(a1, r, cx, cy);
  const p2 = pt(a2, r, cx, cy);
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

function zoneColor(v: number): string {
  if (v <= 24) return "#ef4444";
  if (v <= 49) return "#f97316";
  if (v <= 54) return "#facc15";
  if (v <= 74) return "#22c55e";
  return "#16a34a";
}

export default async function FearGreedWidget() {
  const data = await getFearGreed();
  if (!data.length) return null;

  const v = parseInt(data[0].value);
  const label = data[0].value_classification.toUpperCase();
  const color = zoneColor(v);

  const cx = 110, cy = 102, r = 76, sw = 7;

  const needleDeg = 180 - v * 1.8;
  const needleRad = (needleDeg * Math.PI) / 180;
  const nLen = r - sw / 2 - 6;
  const nx = (cx + nLen * Math.cos(needleRad)).toFixed(2);
  const ny = (cy - nLen * Math.sin(needleRad)).toFixed(2);

  // Exact zone boundaries, butt caps — no sausage-link artefacts
  const zones: [number, number, string][] = [
    [180, 135, "#ef4444"],
    [135, 90,  "#f97316"],
    [90,  81,  "#facc15"],
    [81,  45,  "#22c55e"],
    [45,  0,   "#16a34a"],
  ];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold text-white/60">Fear &amp; Greed Index</p>
        <span className="text-[10px] font-semibold text-white/20 bg-white/[0.05] px-2 py-0.5 rounded-full">
          Live · alt.me
        </span>
      </div>

      <svg viewBox="0 0 220 110" width="100%" style={{ display: "block" }}>
        {/* Track */}
        <path
          d={arcPath(180, 0, r, cx, cy)}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={sw}
          strokeLinecap="butt"
        />
        {/* Coloured zones */}
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
        {/* Classification label */}
        <text
          x={cx} y={44}
          textAnchor="middle"
          fill={color}
          fontSize="11"
          fontWeight="700"
          fontFamily="system-ui,sans-serif"
          letterSpacing="0.12em"
        >
          {label}
        </text>
        {/* Value */}
        <text
          x={cx} y={75}
          textAnchor="middle"
          fill="white"
          fontSize="34"
          fontWeight="800"
          fontFamily="system-ui,sans-serif"
        >
          {v}
        </text>
        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={nx} y2={ny}
          stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.8"
        />
        <circle cx={cx} cy={cy} r="3.5" fill="white" opacity="0.8" />
      </svg>

      {/* Legend */}
      <div className="flex justify-between text-[8.5px] text-white/20 font-medium px-0.5 -mt-2">
        <span>Extreme Fear</span>
        <span>Fear</span>
        <span>Greed</span>
        <span>Extreme Greed</span>
      </div>
    </div>
  );
}
