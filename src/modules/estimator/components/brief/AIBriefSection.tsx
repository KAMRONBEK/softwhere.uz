import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import AIBriefExperience, { type AIBriefExperienceProps } from './AIBriefExperience';
import { pickAiBriefMessages } from './messages';

/**
 * Server wrapper: the brief with exactly the messages it needs, so any page
 * (the /ai-estimate route, a homepage section, the lab's AI slot) can drop it
 * in without knowing which namespaces it reads.
 */
export default async function AIBriefSection(props: AIBriefExperienceProps) {
  const messages = pickAiBriefMessages(await getMessages());
  return (
    <NextIntlClientProvider messages={messages}>
      <AIBriefExperience {...props} />
    </NextIntlClientProvider>
  );
}
