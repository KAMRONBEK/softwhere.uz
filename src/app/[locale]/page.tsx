import { Locale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import HomeClientLayer from '@/shared/components/HomeClientLayer';
import Hero from '@/shared/components/sections/Hero';
import EstimatorCTA from '@/shared/components/sections/EstimatorCTA';
import Service from '@/shared/components/sections/Service';
import Discuss from '@/shared/components/sections/Discuss';
import Projects from '@/shared/components/sections/Projects';
import Contact from '@/shared/components/sections/Contact';
import FAQ from '@/shared/components/sections/FAQ';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);

  return (
    <main>
      <HomeClientLayer locale={locale} />
      <Hero />
      <EstimatorCTA />
      <Service />
      <Discuss />
      <Projects />
      <Contact />
      <FAQ />
    </main>
  );
}
