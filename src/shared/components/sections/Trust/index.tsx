import { getTranslations } from 'next-intl/server';
import css from './style.module.css';

// Client names for the trust marquee (proper nouns — same across locales).
// Lending and insurance names go last (founders' decision, 2026-10-02).
const NAMES = ['Primus Mall', 'EDOCS', 'HeyAll', 'Align 360', 'WorkAxle', 'NAFT', 'BDM', 'Nestegg.ai', 'Asia Insurance', 'ASCON'];

export default async function Trust() {
  const t = await getTranslations('trust');
  // Duplicate the list so the -50% marquee translate loops seamlessly.
  const row = [...NAMES, ...NAMES];

  return (
    <section className={css.section} aria-label={t('label')}>
      <div className={css.track}>
        {row.map((name, i) => (
          <span key={`${name}-${i}`} className={css.item}>
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}
