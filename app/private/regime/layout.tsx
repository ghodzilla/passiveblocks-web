import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Today’s market plan',
  robots: { index: false, follow: false },
};

export default function RegimeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
