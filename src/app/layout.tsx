import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Example font
import './globals.css';

// Initialize font (adjust as needed)
const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://softwhere.uz'),
  icons: {
    icon: [
      {
        url: '/favicon-256.png',
        sizes: '256x256',
        type: 'image/png',
      },
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/icons/logo.svg',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/favicon-256.png',
    apple: '/favicon-256.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
