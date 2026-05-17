import { NextRequest, NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function notifyTelegram(email: string) {
  const token = process.env.TG_TOKEN;
  const chat = process.env.TG_CHAT || "6571132280";
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text: `📬 New PassiveBlocks subscriber: ${email}`,
    }),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, firstName } = body as { email?: unknown; firstName?: unknown };

  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID_PB;

  if (!apiKey || !audienceId) {
    // Fallback: log and notify — no audience configured yet
    console.log(`[subscribe] ${new Date().toISOString()} — ${email} (no Resend audience configured)`);
    await notifyTelegram(email);
    return NextResponse.json({ success: true });
  }

  const contactBody: Record<string, unknown> = {
    email,
    unsubscribed: false,
  };

  if (firstName && typeof firstName === "string" && firstName.trim().length > 0) {
    contactBody.first_name = firstName.trim();
  }

  const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(contactBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[subscribe] Resend error:", res.status, errText);
    // 409 = contact already exists — Resend deduplicates; treat as success
    if (res.status === 409) {
      await notifyTelegram(email);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Subscription failed" }, { status: 500 });
  }

  await notifyTelegram(email);
  return NextResponse.json({ success: true });
}
