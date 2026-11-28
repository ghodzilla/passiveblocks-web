import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hyperliquid desk',
  robots: { index: false, follow: false },
};

export default function HyperliquidLayout({ children }: { children: React.ReactNode }) {
  return children;
}
