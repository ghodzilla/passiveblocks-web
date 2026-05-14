"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/tax";
  const hasError = searchParams.get("error") === "auth_failed";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    const supabase = createClient();
    const siteUrl = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#08080f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <Link href="/" style={{ marginBottom: 40 }}>
        <Image src="/passiveblocks_logo_cropped.png" alt="PassiveBlocks" width={160} height={38} style={{ height: 38, width: "auto" }} />
      </Link>

      <div style={{ background: "#111214", border: "1px solid #2a2b30", borderRadius: 16, padding: "40px 32px", width: "100%", maxWidth: 420 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#edeef0", marginBottom: 8 }}>Sign in to PassiveBlocks</h1>
        <p style={{ fontSize: 14, color: "#6b6c72", marginBottom: 28 }}>We&apos;ll email you a magic link — no password needed.</p>

        {hasError && (
          <div style={{ background: "#dc262622", border: "1px solid #dc262644", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#f87171" }}>
            The sign-in link expired. Please request a new one.
          </div>
        )}

        {status === "sent" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#edeef0", marginBottom: 6 }}>Check your inbox</div>
            <div style={{ fontSize: 13, color: "#6b6c72" }}>We sent a sign-in link to <strong style={{ color: "#edeef0" }}>{email}</strong>.<br />Click it to access your account.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: "100%", background: "#18191d", border: "1px solid #2a2b30", borderRadius: 8, padding: "12px 14px", fontSize: 14, color: "#edeef0", outline: "none", marginBottom: 14, boxSizing: "border-box" }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              style={{ width: "100%", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: status === "loading" ? "not-allowed" : "pointer", opacity: status === "loading" ? 0.7 : 1 }}
            >
              {status === "loading" ? "Sending…" : "Send magic link"}
            </button>
            {status === "error" && (
              <div style={{ marginTop: 12, fontSize: 13, color: "#f87171", textAlign: "center" }}>Something went wrong — please try again.</div>
            )}
          </form>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: "#6b6c72" }}>
        By signing in you agree to our{" "}
        <Link href="/about" style={{ color: "#6789ed" }}>Terms</Link>.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
