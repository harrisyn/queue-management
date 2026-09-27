import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Desk',
  manifest: '/widget-desk.webmanifest',
};

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
