import Link from "next/link";
import Image from "next/image";

export default function PricingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#08080f", color: "#edeef0" }}>
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "16px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/">
            <Image src="/passiveblocks_logo_cropped.png" alt="PassiveBlocks" width={148} height={36} style={{ height: 36, width: "auto" }} />
          </Link>
          <div style={{ display: "flex", gap: 24, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
            <Link href="/tax" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Tax Calculator</Link>
            <Link href="/login" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Sign in</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6789ed", marginBottom: 16 }}>
          Pricing
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
          Start free.<br />
          <span style={{ color: "#6789ed" }}>Premium is coming.</span>
        </h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", maxWidth: 520, margin: "0 auto 56px", lineHeight: 1.6 }}>
          The weekly newsletter, DeFi yield analysis and our crypto tax calculator — all free. A premium tier built around the tax toolkit is on the way. Join the free list and you&apos;ll hear first.
        </p>

        {/* Plans */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 48 }}>
          {/* Free */}
          <div style={{ background: "#111214", border: "1px solid #2a2b30", borderRadius: 16, padding: "32px 24px", textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6b6c72", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Free</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 4 }}>$0</div>
            <div style={{ fontSize: 13, color: "#6b6c72", marginBottom: 24 }}>forever</div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10 }}>
              {["Weekly newsletter", "DeFi yield analysis", "Protocol risk breakdowns", "Community access"].map(f => (
                <li key={f} style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#8aad8a" }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/#subscribe" style={{ display: "block", textAlign: "center", border: "1px solid #2a2b30", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 600, color: "#edeef0", textDecoration: "none" }}>
              Subscribe free
            </Link>
          </div>

          {/* Premium */}
          <div style={{ background: "linear-gradient(135deg, #1a1e2e 0%, #111624 100%)", border: "1px solid #6789ed44", borderRadius: 16, padding: "32px 24px", textAlign: "left", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 12, right: 12, background: "#6789ed", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 20, padding: "3px 10px" }}>Coming soon</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6789ed", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Premium</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Coming soon</div>
            <div style={{ fontSize: 13, color: "#6b6c72", marginBottom: 24 }}>tax-toolkit tier — pricing TBA</div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Everything in Free",
                "Crypto tax calculator",
                "Capital gains & income tracking",
                "Gas fee deduction report",
                "CSV & PDF tax exports",
                "Priority support",
              ].map(f => (
                <li key={f} style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#6789ed" }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/#subscribe"
              style={{ display: "block", textAlign: "center", width: "100%", boxSizing: "border-box", background: "#2563eb", color: "#fff", borderRadius: 8, padding: "13px 0", fontSize: 14, fontWeight: 700, textDecoration: "none" }}
            >
              Join the free list — hear first
            </Link>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "#6b6c72" }}>
          Free to start, no card required. When Premium launches, the free list hears first.
        </p>
      </div>
    </div>
  );
}
