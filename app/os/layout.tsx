import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Passive Blocks OS',
  robots: { index: false, follow: false },
};

export default function OsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
