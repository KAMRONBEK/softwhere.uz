import type { Metadata } from 'next';
import { ENV } from '@/constants';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(ENV.BASE_URL),
  icons: {
    icon: [
      { url: '/favicon-256.png', sizes: '256x256', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon-256.png',
    apple: '/favicon-256.png',
  },
};

// The localized layout (src/app/[locale]/layout.tsx) is the SOLE owner of the
// <html>/<body> document, the Inter font and the ThemeProvider. This root
// layout is a passthrough so we don't render two nested documents. Next still
// merges the `metadata` above with the per-locale metadata.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
