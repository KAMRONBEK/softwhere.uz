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

// ISR: the latest-posts block refreshes hourly (and on 'blog-posts' tag busts).
export const revalidate = 3600;

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
