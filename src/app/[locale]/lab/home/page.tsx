import type { Metadata, Viewport } from 'next';
import { Locale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { parseLabParams } from '@/modules/home/config';
import { LAB_COPY } from '@/modules/home/copy';
import { LAB_STYLES } from '@/modules/home/theme/styles';
import HomeExperience from '../../_home/HomeExperience';

// Staging copy of the homepage for the founder: the same page as /[locale],
// plus the Lab panel (?panel=1) and URL state (?style=&logo=&lc=&q=&only=).
// Never linked, not in the sitemap, disallowed in robots.ts, and noindex here
// in case a URL leaks. Like the homepage it sits outside the (site) route
// group, so it gets no site Header/Footer. Rendered per request because the URL
// decides the initial state.
export const metadata: Metadata = {
  title: LAB_COPY.meta.title,
  description: LAB_COPY.meta.description,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

// viewport-fit=cover makes env(safe-area-inset-*) real on notched phones,
// which the full-bleed sections and the floating panel rely on.
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: LAB_STYLES.A.colors.bg,
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LabHomePage({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const initial = parseLabParams(await searchParams);
  return <HomeExperience locale={locale} mode='lab' initial={initial} />;
}
