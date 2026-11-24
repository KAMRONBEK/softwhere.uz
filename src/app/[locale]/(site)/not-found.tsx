import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { CSSProperties } from 'react';

// Inline styles on the look's tokens: a CSS module imported here would ride in every site page's HTML again.
const LINK: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 52,
  padding: '12px 26px',
  border: '1px solid color-mix(in srgb, var(--fg) 30%, transparent)',
  borderRadius: 'var(--radius)',
  color: 'var(--fg)',
  font: '500 16px/1.2 var(--font-body)',
  textDecoration: 'none',
};
const PRIMARY: CSSProperties = { ...LINK, border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--on-accent)' };

// notFound() inside a site page (an unknown service, a deleted post). Unknown
// paths outside the site's routes get the document in src/app/not-found.tsx.
export default async function SiteNotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'notFound' });

  return (
    <main
      style={{
        maxWidth: 1320,
        margin: '0 auto',
        padding: 'calc(var(--lab-header-h) + clamp(48px, 12vw, 160px)) clamp(20px, 5.5vw, 96px) 96px',
      }}
    >
      <p style={{ margin: '0 0 16px', color: 'var(--muted)', font: '500 14px/1.3 var(--font-body)' }}>404</p>
      <h1
        style={{
          margin: 0,
          maxWidth: '20ch',
          fontSize: 'calc(clamp(2.1rem, 5.2vw, 4.5rem) * var(--display-scale, 1))',
          fontFamily: 'var(--font-display)',
          fontWeight: 'var(--display-weight)',
          letterSpacing: 'var(--display-tracking)',
          lineHeight: 1.04,
        }}
      >
        {t('title')}
      </h1>
      <p style={{ margin: '24px 0 32px', maxWidth: '58ch', color: 'var(--muted)', font: '400 1.125rem/1.55 var(--font-body)' }}>
        {t('body')}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Link href={`/${locale}`} style={PRIMARY}>
          {t('home')}
        </Link>
        <Link href={`/${locale}/services`} style={LINK}>
          {t('services')}
        </Link>
      </div>
    </main>
  );
}
