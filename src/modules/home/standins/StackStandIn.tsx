import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { buildToolbox, marketForLocale, type StackWords } from '../sections/s13/stack-data';
import { TermList } from './StandInParts';

interface StackStandInProps {
  locale: Locale;
}

/** 17 · Stack: the toolbox's eight areas and their tools, in the order the live drawer lists them. */
export default async function StackStandIn({ locale }: StackStandInProps) {
  const t = await getTranslations({ locale, namespace: 'home.stack-physics' });
  const words: StackWords = {
    toolBlurb: id => t(`tools.${id}`),
    genericLabel: id => t(`labels.${id}`),
    trade: id => ({ name: t(`trades.${id}.name`), role: t(`trades.${id}.role`) }),
    kit: id => ({
      label: t(`kits.${id}.label`),
      subject: t(`kits.${id}.subject`),
      forSubject: t(`kits.${id}.forSubject`),
      headline: t(`kits.${id}.headline`),
      top: t(`kits.${id}.top`),
      rider: t(`kits.${id}.rider`),
    }),
  };
  const { trades } = buildToolbox(marketForLocale(locale), words);
  const items = trades.map(trade => ({ id: trade.id, term: trade.name, text: trade.tools.map(tool => tool.label).join(', ') }));
  return <TermList items={items} />;
}
