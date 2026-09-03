import Link from 'next/link';
import SectionText from '@/shared/components/SectionTitle';
import css from './style.module.css';
import { getLocale, getTranslations } from 'next-intl/server';

// Cards that map onto a real /[locale]/services/[service] page — slugs must stay
// in sync with SERVICE_NAMESPACES in src/app/[locale]/services/[service]/page.tsx.
// The rest are offerings we describe here but have no landing page for, so they
// stay unlinked rather than pointing at a 404.
const SERVICE_SLUGS: Record<string, string> = {
  service1: 'web-development',
  service2: 'web-development',
  service3: 'mobile-apps',
  service7: 'telegram-bots',
};

const SERVICE_KEYS = ['service1', 'service2', 'service3', 'service4', 'service5', 'service6', 'service7'] as const;

// Telegram bots is the one topic with existing ranking traction, so it carries
// the row highlight.
const HIGHLIGHT_KEY = 'service7';

async function Service() {
  const locale = await getLocale();
  const t = await getTranslations('services');
  const services = SERVICE_KEYS.map((key, index) => ({
    key,
    num: index + 1,
    title: t(`${key}.title`),
    description: t(`${key}.description`),
    slug: SERVICE_SLUGS[key] ?? null,
  }));

  return (
    <section className={css.section} id='services'>
      <div className='container'>
        <div className={css.eyebrow}>{t('eyebrow')}</div>
        <SectionText>{t('title')}</SectionText>
        <SectionText className='mb-10 lg:w-1/2' type='desc'>
          {t('description')}
        </SectionText>
        <div className={css.rows}>
          {services.map(item => {
            const className = [css.row, item.key === HIGHLIGHT_KEY ? css.rowHighlight : '', item.slug ? css.rowLink : '']
              .filter(Boolean)
              .join(' ');
            const content = (
              <>
                <span className={css.num}>{String(item.num).padStart(2, '0')}</span>
                <h3 className={css.rowTitle}>{item.title}</h3>
                <p className={css.rowDesc}>{item.description}</p>
                <span className={css.arrow} aria-hidden='true'>
                  →
                </span>
              </>
            );

            return item.slug ? (
              <Link data-aos='fade-up' className={className} key={item.key} href={`/${locale}/services/${item.slug}`}>
                {content}
              </Link>
            ) : (
              <div data-aos='fade-up' className={className} key={item.key}>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Service;
