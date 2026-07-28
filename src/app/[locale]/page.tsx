import { Locale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import LatestPostsSection from '@/modules/blog/components/LatestPostsSection';
import HomeClientLayer from '@/shared/components/HomeClientLayer';
import Hero from '@/shared/components/sections/Hero';
import Trust from '@/shared/components/sections/Trust';
import Service from '@/shared/components/sections/Service';
import AISpotlight from '@/shared/components/sections/AISpotlight';
import Process from '@/shared/components/sections/Process';
import Projects from '@/shared/components/sections/Projects';
import Contact from '@/shared/components/sections/Contact';
import EstimatorCTA from '@/shared/components/sections/EstimatorCTA';

// ISR: publishes bust the 'blog-posts' tag, which re-renders this page and
// keeps the latest-posts block fresh — the time window is only a safety net,
// so keep it long. Hourly re-renders here were a measurable Fluid CPU cost.
export const revalidate = 86400;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);

  return (
    <main>
      <HomeClientLayer locale={locale} />
      <Hero />
      <Trust />
      <Service />
      <AISpotlight />
      <Process />
      <Projects />
      <LatestPostsSection locale={locale} />
      <Contact />
      <EstimatorCTA />
    </main>
  );
}
