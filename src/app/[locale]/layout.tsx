import Footer from '@/components/Footer';
import Header from '@/components/Header';
import ScrollToTop from '@/components/ScrollToTop';
import { BlogProvider } from '@/contexts/BlogContext';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Inter } from 'next/font/google';
import React from 'react';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  try {
    const t = await getTranslations({ locale, namespace: 'metadata' });

    return {
      title: t('title'),
      description: t('description'),
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
  } catch (error) {
    // Fallback metadata if translation fails
    return {
      title: 'Softwhere - Mobile App Development in Uzbekistan',
      description: 'Professional mobile app and web development services in Uzbekistan',
      icons: {
        icon: '/favicon.svg',
        shortcut: '/favicon-256.png',
      },
    };
  }
}

type Props = {
  children: React.ReactNode;
  params: {
    locale: 'en' | 'uz' | 'ru';
  };
};

const RootLayout: React.FC<Props> = async ({ children, params: { locale } }) => {
  // Get messages on the server side
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <BlogProvider>
            <Header />
            {children}
            <ScrollToTop />
            <Footer />
          </BlogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;
