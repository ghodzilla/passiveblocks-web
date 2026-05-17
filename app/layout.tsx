import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PassiveBlocks — DeFi Yield Intelligence",
  description: "Weekly DeFi yield analysis for serious capital allocators. Best stablecoin rates, staking APY, and LP strategies — distilled.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "PassiveBlocks — DeFi Yield Intelligence",
    description: "Weekly DeFi yield analysis for serious capital allocators. Best stablecoin rates, staking APY, and LP strategies — distilled.",
    url: "https://passiveblocks.io",
    siteName: "PassiveBlocks",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PassiveBlocks — DeFi Yield Intelligence",
    description: "Weekly DeFi yield analysis. Best stablecoin rates, staking APY, and LP strategies.",
  },
  metadataBase: new URL("https://passiveblocks.io"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}<Analytics /></body>
    </html>
  );
}
