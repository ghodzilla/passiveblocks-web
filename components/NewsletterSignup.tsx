"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("Something went wrong — try again.");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("Something went wrong — try again.");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
        setFirstName("");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(
          typeof data?.error === "string" ? data.error : "Something went wrong — try again."
        );
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="text-center py-4">
        <div className="text-blue-400 font-semibold text-lg mb-1">
          You&apos;re on the list.
        </div>
        <div className="text-white/50 text-sm">
          First issue lands Monday. Check your inbox.
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 max-w-md mx-auto"
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="First name (optional)"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="sm:w-36 bg-white/[0.06] border border-white/[0.12] rounded-lg px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-400/50 transition-colors"
        />
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-white/[0.06] border border-white/[0.12] rounded-lg px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-400/50 transition-colors"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors whitespace-nowrap"
        >
          {status === "loading" ? "Subscribing…" : "Get free access"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-red-400 text-xs text-center">{errorMsg}</p>
      )}
    </form>
  );
}
