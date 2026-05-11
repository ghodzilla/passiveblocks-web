import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PassiveBlocks — Build Wealth, Block by Block",
  description: "Weekly DeFi yield analysis for serious capital allocators. Protocols, rates, and risk — distilled.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "PassiveBlocks — Build Wealth, Block by Block",
    description: "Weekly DeFi yield analysis for serious capital allocators. Protocols, rates, and risk — distilled.",
    url: "https://passiveblocks.io",
    siteName: "PassiveBlocks",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PassiveBlocks — Build Wealth, Block by Block",
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
