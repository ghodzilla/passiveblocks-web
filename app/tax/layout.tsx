import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DeFi Tax Calculator — PassiveBlocks",
  description:
    "Calculate your DeFi tax obligations for Australia. Track staking income, LP gains, and CGT events across Aave, Fluid, Orca, and more.",
  openGraph: {
    title: "DeFi Tax Calculator — PassiveBlocks",
    description:
      "Calculate your DeFi tax obligations for Australia. Track staking income, LP gains, and CGT events across Aave, Fluid, Orca, and more.",
    url: "https://passiveblocks.io/tax",
    siteName: "PassiveBlocks",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DeFi Tax Calculator — PassiveBlocks",
    description:
      "Calculate your DeFi tax obligations for Australia. Staking income, LP gains, CGT.",
  },
};

export default function TaxLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
