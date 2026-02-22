import Footer from '@/components/Footer';
import Header from '@/components/Header';
import ScrollToTop from '@/components/ScrollToTop';
import ThemeProvider from '@/components/ThemeProvider';
import { BlogProvider } from '@/contexts/BlogContext';
import type { Metadata } from 'next';
import { Locale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Inter } from 'next/font/google';
import React from 'react';

const inter = Inter({ subsets: ['latin'] });

const BASE_URL = 'https://softwhere.uz';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const title = t('title');
  const description = t('description');

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/${locale}`,
      siteName: 'SoftWhere.uz',
      locale,
      type: 'website',
      images: [{ url: `${BASE_URL}/api/og?title=${encodeURIComponent(title)}&locale=${locale}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${BASE_URL}/${locale}`,
      languages: { uz: `${BASE_URL}/uz`, ru: `${BASE_URL}/ru`, en: `${BASE_URL}/en` },
    },
    icons: {
      icon: [
        { url: '/favicon-256.png', sizes: '256x256', type: 'image/png' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/icons/logo.svg', type: 'image/svg+xml' },
      ],
      shortcut: '/favicon-256.png',
      apple: '/favicon-256.png',
    },
  };
}

function StructuredData({ locale }: { locale: string }) {
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'SoftWhere.uz',
      url: BASE_URL,
      logo: `${BASE_URL}/icons/logo.svg`,
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+998332499111',
        contactType: 'customer service',
        availableLanguage: ['Uzbek', 'Russian', 'English'],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'SoftWhere.uz',
      url: BASE_URL,
      inLanguage: [locale, 'uz', 'ru', 'en'],
      publisher: { '@type': 'Organization', name: 'SoftWhere.uz' },
    },
  ];

  return (
    <>
      {schemas.map((s, i) => (
        <script key={i} type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
    </>
  );
}

type Props = {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

export default async function RootLayout({ children, params }: Props) {
  const { locale } = (await params) as { locale: Locale };
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <StructuredData locale={locale} />
          <NextIntlClientProvider messages={messages}>
            <BlogProvider>
              <Header />
              {children}
              <ScrollToTop />
              <Footer />
            </BlogProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
