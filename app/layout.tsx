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
  verification: {
    google: "TODO_ADD_YOUR_GSC_VERIFICATION_CODE",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PassiveBlocks",
  url: "https://passiveblocks.io",
  logo: "https://www.passiveblocks.io/passiveblocks_logo.png",
  description: "Weekly passive income analysis across crypto, stocks, and AI. No hype, no sponsored garbage.",
  sameAs: [
    "https://twitter.com/passiveblocks",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">{children}<Analytics /></body>
    </html>
  );
}
