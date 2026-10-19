import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { NUMBER_FACTS } from '../sections/s10/facts';
import css from '../components/SectionFallback.module.css';

interface NumbersStandInProps {
  locale: Locale;
}

/**
 * 14 · Numbers: each fact as one plural-correct line (the live rail's
 * `spoken` label), with its caption where the caption takes no arguments
 * (the abroad caption lists countries, so it is left to the section).
 */
export default async function NumbersStandIn({ locale }: NumbersStandInProps) {
  const t = await getTranslations({ locale, namespace: 'home.numbers' });
  return (
    <ul className={css.standinList}>
      {NUMBER_FACTS.map(fact => (
        <li key={fact.id}>
          <p className={css.standinStrong}>{t(`facts.${fact.id}.spoken`, { value: fact.value })}</p>
          {fact.id === 'abroad' ? null : (
            <p>{fact.caption === 'captionShared' ? t('facts.platforms.captionShared') : t(`facts.${fact.id}.caption`)}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
