import Footer from '@/components/Footer';
import Header from '@/components/Header';
import ScrollToTop from '@/components/ScrollToTop';
import { BlogProvider } from '@/contexts/BlogContext';
import type { Metadata } from 'next';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Inter } from 'next/font/google';
import React from 'react';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('title'),
    description: t('description'),
    icons: {
      icon: [
        {
          url: '/favicon.svg',
          type: 'image/svg+xml',
        },
        {
          url: '/icons/logo.svg',
          type: 'image/svg+xml',
        },
      ],
      shortcut: '/favicon.svg',
      apple: '/icons/logo.svg',
    },
  };
}

type Props = {
  children: React.ReactNode;
  params: {
    locale: 'en' | 'uz' | 'ru';
  };
};

const RootLayout: React.FC<Props> = ({ children, params: { locale } }) => {
  const messages = useMessages();

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
