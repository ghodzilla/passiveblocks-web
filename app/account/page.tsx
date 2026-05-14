"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase-client";

interface AuthStatus {
  loggedIn: boolean;
  plan: string;
  email?: string;
}

function AccountContent() {
  const searchParams = useSearchParams();
  const justUpgraded = searchParams.get("success") === "1";

  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then(r => r.json())
      .then((d: AuthStatus) => setStatus(d))
      .catch(() => setStatus({ loggedIn: false, plan: "free" }));
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json() as { url?: string };
    if (data.url) window.location.href = data.url;
    else setPortalLoading(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div style={{ minHeight: "100vh", background: "#08080f", color: "#edeef0" }}>
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "16px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/">
            <Image src="/passiveblocks_logo_cropped.png" alt="PassiveBlocks" width={148} height={36} style={{ height: 36, width: "auto" }} />
          </Link>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link href="/tax" style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Tax Calculator</Link>
            <button onClick={signOut} style={{ fontSize: 13, color: "#6b6c72", background: "none", border: "1px solid #2a2b30", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 24px" }}>
        {justUpgraded && (
          <div style={{ background: "#16a34a22", border: "1px solid #16a34a44", borderRadius: 12, padding: "16px 20px", marginBottom: 28, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <div>
              <div style={{ fontWeight: 700, color: "#4ade80", marginBottom: 2 }}>Welcome to PassiveBlocks Premium!</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Your tax calculator access is now active.</div>
            </div>
          </div>
        )}

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>Your Account</h1>

        {!status ? (
          <div style={{ color: "#6b6c72", fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            {/* Profile card */}
            <div style={{ background: "#111214", border: "1px solid #2a2b30", borderRadius: 16, padding: "24px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b6c72", marginBottom: 16, borderLeft: "3px solid #6789ed", paddingLeft: 10 }}>Account</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, color: "#edeef0", marginBottom: 4 }}>{status.email || "—"}</div>
                  <div style={{ fontSize: 12, color: "#6b6c72" }}>Magic link login</div>
                </div>
                <button onClick={signOut} style={{ fontSize: 12, color: "#6b6c72", background: "none", border: "1px solid #2a2b30", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>
                  Sign out
                </button>
              </div>
            </div>

            {/* Plan card */}
            <div style={{ background: "#111214", border: `1px solid ${status.plan === "premium" ? "#6789ed44" : "#2a2b30"}`, borderRadius: 16, padding: "24px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b6c72", marginBottom: 16, borderLeft: "3px solid #6789ed", paddingLeft: 10 }}>Subscription</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#edeef0", marginBottom: 4 }}>
                    {status.plan === "premium" ? "Premium" : "Free"}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b6c72" }}>
                    {status.plan === "premium" ? "$19/month · Cancel anytime" : "No active subscription"}
                  </div>
                </div>
                <span style={{ background: status.plan === "premium" ? "#6789ed22" : "#2a2b3022", color: status.plan === "premium" ? "#6789ed" : "#6b6c72", border: `1px solid ${status.plan === "premium" ? "#6789ed44" : "#2a2b3044"}`, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
                  {status.plan === "premium" ? "ACTIVE" : "FREE"}
                </span>
              </div>

              {status.plan === "premium" ? (
                <button
                  onClick={openPortal}
                  disabled={portalLoading}
                  style={{ width: "100%", background: "#18191d", border: "1px solid #2a2b30", color: "#edeef0", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: portalLoading ? "not-allowed" : "pointer", opacity: portalLoading ? 0.7 : 1 }}
                >
                  {portalLoading ? "Opening portal…" : "Manage billing / Cancel"}
                </button>
              ) : (
                <Link
                  href="/pricing"
                  style={{ display: "block", textAlign: "center", background: "#2563eb", color: "#fff", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, textDecoration: "none" }}
                >
                  Upgrade to Premium — $19/mo
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountContent />
    </Suspense>
  );
}
