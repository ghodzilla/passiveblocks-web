import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PassiveBlocks — DeFi Yield Intelligence",
  description: "Weekly DeFi yield analysis for serious capital allocators. Protocols, rates, and risk — distilled.",
  openGraph: {
    title: "PassiveBlocks — DeFi Yield Intelligence",
    description: "Weekly DeFi yield analysis for serious capital allocators. Protocols, rates, and risk — distilled.",
    url: "https://passiveblocks.io",
    siteName: "PassiveBlocks",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PassiveBlocks — DeFi Yield Intelligence",
    description: "Weekly DeFi yield analysis for serious capital allocators.",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
