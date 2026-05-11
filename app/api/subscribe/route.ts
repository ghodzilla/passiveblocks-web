import { NextRequest, NextResponse } from "next/server";

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
  const { email } = await req.json();
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey || !pubId) {
    console.log(`[subscribe] ${new Date().toISOString()} — ${email}`);
    await notifyTelegram(email);
    return NextResponse.json({ ok: true });
  }

  const res = await fetch(`https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email,
      reactivate_existing: false,
      send_welcome_email: true,
    }),
  });

  if (!res.ok) {
    console.error("[subscribe] Beehiiv error:", res.status, await res.text());
    return NextResponse.json({ error: "Subscription failed" }, { status: 500 });
  }

  await notifyTelegram(email);
  return NextResponse.json({ ok: true });
}
