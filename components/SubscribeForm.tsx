"use client";

import { useState } from "react";

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="text-center py-4">
        <div className="text-amber-400 font-semibold text-lg mb-1">You&apos;re in.</div>
        <div className="text-white/50 text-sm">Check your inbox for a confirmation email.</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 bg-white/[0.06] border border-white/[0.12] rounded-lg px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-400/50 transition-colors"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-semibold px-6 py-3 rounded-lg text-sm transition-colors whitespace-nowrap"
      >
        {status === "loading" ? "Subscribing…" : "Get free access"}
      </button>
      {status === "error" && (
        <p className="text-red-400 text-xs mt-2 text-center w-full">Something went wrong — try again.</p>
      )}
    </form>
  );
}
