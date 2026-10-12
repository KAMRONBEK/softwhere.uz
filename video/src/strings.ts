import type { Locale } from './schema';

/**
 * The few words the composition itself draws (outro labels and sign-off); everything else comes
 * from the project config, which is written in the config's own `locale`. Uzbek and Russian follow
 * docs/localization/uz-ru-style-guide.md (siz / вы, U+02BB in oʻ/gʻ).
 */
type Strings = {
  caseStudy: string;
  techStack: string;
  availableOn: string;
  status: string;
  shipped: (years: string) => string;
  archived: string;
  launchingSoon: string;
  signOff: string;
};

export const STRINGS: Readonly<Record<Locale, Strings>> = {
  en: {
    caseStudy: 'Case study',
    techStack: 'Tech stack',
    availableOn: 'Available on',
    status: 'Status',
    shipped: years => `Shipped ${years}`,
    archived: 'Archived',
    launchingSoon: 'Launching soon',
    signOff: "Let's build your next product.",
  },
  uz: {
    caseStudy: 'Ish namunasi',
    techStack: 'Texnologiyalar',
    availableOn: 'Yuklab olish',
    status: 'Holati',
    shipped: years => `Ishga tushgan: ${years}`,
    archived: 'Arxivda',
    launchingSoon: 'Tez orada ishga tushadi',
    signOff: 'Keyingi mahsulotingizni birga yaratamiz.',
  },
  ru: {
    caseStudy: 'Кейс',
    techStack: 'Технологии',
    availableOn: 'Доступно в',
    status: 'Статус',
    shipped: years => `Запуск: ${years}`,
    archived: 'В архиве',
    launchingSoon: 'Скоро запуск',
    signOff: 'Создадим ваш следующий продукт вместе.',
  },
};
