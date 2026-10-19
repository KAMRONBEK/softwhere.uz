import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { PROCESS_STEPS } from '../sections/s12/steps';
import { TermList } from './StandInParts';

interface ProcessStandInProps {
  locale: Locale;
}

/** 16 · Process: the five stages with their one line, as the live route's stage blocks (s12/parts.tsx). */
export default async function ProcessStandIn({ locale }: ProcessStandInProps) {
  const t = await getTranslations({ locale, namespace: 'home.process' });
  const items = PROCESS_STEPS.map(({ id }) => ({ id, term: t(`steps.${id}.title`), text: t(`steps.${id}.summary`) }));
  return <TermList items={items} label={t('stepsLabel')} />;
}
