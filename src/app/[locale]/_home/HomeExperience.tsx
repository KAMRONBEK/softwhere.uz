import { NextIntlClientProvider, type Locale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { getLatestPosts } from '@/modules/blog/lib/latestPosts';
import LabShell, { type ShellMode } from '@/modules/home/LabShell';
import type { LabSlots } from '@/modules/home/context/LabContext';
import HomeFooter from '@/modules/home/global/HomeFooter';
import LatestPosts, { type HomePost } from '@/modules/home/global/LatestPosts';
import { HOME_FACTS } from '@/modules/home/media/facts';
import ThemeScript from '@/modules/home/theme/ThemeScript';
import { eagerHomeMessages } from '@/modules/home/sections/eagerMessages';
import { homeStandIns } from '@/modules/home/standins';
import { SECTION_IDS, type LabState } from '@/modules/home/types';
import HomeAIBrief from './HomeAIBrief';

/**
 * Real features from other modules, injected into home sections by id (the
 * home module may not import another module). 'ai-demo' is the real AI brief,
 * compact; it reports 'idle' | 'thinking' | 'done' with the bubbling
 * `ai-brief:status` event, which the section's network listens to. It loads
 * its code and copy when the section mounts (HomeAIBrief.tsx).
 */
const homeSlots = (): LabSlots => ({ 'ai-demo': <HomeAIBrief variant='compact' /> });

async function latestPosts(locale: string): Promise<HomePost[]> {
  const posts = await getLatestPosts(locale);
  return posts.map(post => ({
    id: post._id,
    title: post.title,
    href: `/${post.locale}/blog/${encodeURIComponent(post.slug)}`,
    publishedAt: post.createdAt,
  }));
}

interface HomeExperienceProps {
  locale: Locale;
  mode: ShellMode;
  initial: LabState;
}

/**
 * The homepage (src/modules/home) with everything the app layer feeds it: the
 * scoped client messages, the AI brief slot, the latest posts, the page's own
 * footer (the site Footer lives in (site)/layout.tsx, outside the homepage) and the pre-paint
 * theme script. Rendered by /[locale] (mode 'home') and by the
 * noindex staging copy /[locale]/lab/home (mode 'lab').
 */
export default async function HomeExperience({ locale, mode, initial }: HomeExperienceProps) {
  const [messages, posts] = await Promise.all([getMessages(), latestPosts(locale)]);
  return (
    // The homepage's client tree gets `home` trimmed to the visitor header, the
    // shared copy, the hero and the static fallbacks (sections/eagerMessages.ts);
    // each section loads the rest of its copy with its code, and the AI brief
    // brings its own.
    <NextIntlClientProvider messages={{ home: eagerHomeMessages(messages.home, SECTION_IDS) }}>
      <LabShell
        mode={mode}
        initial={initial}
        slots={homeSlots()}
        standIns={homeStandIns(locale)}
        bootScript={<ThemeScript />}
        appendix={<LatestPosts locale={locale} posts={posts} />}
        footer={<HomeFooter locale={locale} />}
        facts={HOME_FACTS}
      />
    </NextIntlClientProvider>
  );
}
