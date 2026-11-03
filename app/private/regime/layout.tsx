import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Macro Regime',
  robots: { index: false, follow: false },
};

export default function RegimeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
