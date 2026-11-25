'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { parseContact } from '@/modules/estimator/ai-brief/contact';
import { BRIEF_PRICE_MODE } from '@/modules/estimator/ai-brief/priceMode';
import { trackEvent } from '@/shared/utils/analytics';
import css from './brief.module.css';

export const REQUEST_SECTION_ID = 'plan-request';
const ENDPOINT = '/api/estimate/brief/request';
const TIMEOUT_MS = 20_000;
const MAX_NAME = 120;
const MAX_CONTACT = 120;
const MAX_COMMENT = 1000;

type RequestFormProps = {
  idea: string;
  /** The sealed plan; without it the request carries the idea only. */
  requestToken: string | null;
  locale: BriefLocale;
  isDiscovery: boolean;
};

type Field = 'name' | 'contact';
type Status = 'idle' | 'sending' | 'sent' | 'failed' | 'wait';

/** "Send request": name, one contact and an optional comment; the plan travels in its sealed token. */
export default function RequestForm({ idea, requestToken, locale, isDiscovery }: RequestFormProps) {
  const t = useTranslations('aiBrief.request');
  const tFrom = useTranslations('aiBrief.from');
  const tCta = useTranslations('aiBrief.cta');
  const baseId = useId();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState('');
  const [fieldError, setFieldError] = useState<Field | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const id = (part: string) => `${baseId}-${part}`;

  const rejectField = (field: Field) => {
    setFieldError(field);
    document.getElementById(id(field))?.focus();
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (status === 'sending') return;
    if (!name.trim()) return rejectField('name');
    const parsed = parseContact(contact);
    if (!parsed) return rejectField('contact');
    setStatus('sending');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The idea goes along, so an expired token never loses it.
        body: JSON.stringify({ token: requestToken, idea, name, contact: parsed, comment, locale, website }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        setStatus('sent');
        trackEvent('plan_request_submit', { locale, plan: requestToken ? 'sealed' : 'idea' });
        return;
      }
      const body = (await res.json().catch(() => null)) as { field?: string } | null;
      if (body?.field === 'name' || body?.field === 'contact') {
        setStatus('idle');
        rejectField(body.field);
        return;
      }
      setStatus(res.status === 429 ? 'wait' : 'failed');
    } catch {
      setStatus('failed');
    }
  };

  if (status === 'sent') {
    return (
      <section id={REQUEST_SECTION_ID} className={css.request} role='status'>
        <div>
          <h3 className={css.ctaTitle}>{t('sentTitle')}</h3>
          <p className={css.ctaBody}>{t('sentBody')}</p>
        </div>
      </section>
    );
  }

  return (
    <section id={REQUEST_SECTION_ID} className={css.request} aria-labelledby={id('title')}>
      <div>
        <h3 id={id('title')} className={css.ctaTitle}>
          {isDiscovery ? tCta('discoveryTitle') : BRIEF_PRICE_MODE === 'from' ? tFrom('open') : t('title')}
        </h3>
        <p className={css.ctaBody}>{isDiscovery ? t('discoveryBody') : t('body')}</p>
      </div>
      <form className={css.requestForm} onSubmit={send} noValidate>
        <div className={css.requestField}>
          <label htmlFor={id('name')}>{t('name')}</label>
          <input
            id={id('name')}
            value={name}
            maxLength={MAX_NAME}
            autoComplete='name'
            onChange={event => {
              setName(event.target.value);
              if (fieldError === 'name') setFieldError(null);
            }}
            aria-invalid={fieldError === 'name'}
            aria-describedby={fieldError === 'name' ? id('name-error') : undefined}
          />
          {fieldError === 'name' && (
            <p id={id('name-error')} className={css.requestError} role='alert'>
              {t('nameError')}
            </p>
          )}
        </div>
        <div className={css.requestField}>
          <label htmlFor={id('contact')}>{t('contact')}</label>
          <input
            id={id('contact')}
            value={contact}
            maxLength={MAX_CONTACT}
            placeholder={t('contactPlaceholder')}
            autoCapitalize='none'
            onChange={event => {
              setContact(event.target.value);
              if (fieldError === 'contact') setFieldError(null);
            }}
            aria-invalid={fieldError === 'contact'}
            aria-describedby={fieldError === 'contact' ? id('contact-error') : undefined}
          />
          {fieldError === 'contact' && (
            <p id={id('contact-error')} className={css.requestError} role='alert'>
              {t('contactError')}
            </p>
          )}
        </div>
        <div className={css.requestField}>
          <label htmlFor={id('comment')}>{t('comment')}</label>
          <textarea
            id={id('comment')}
            value={comment}
            maxLength={MAX_COMMENT}
            rows={3}
            onChange={event => setComment(event.target.value)}
          />
        </div>
        {/* Honeypot: people never see it, form bots fill it. */}
        <input
          className={css.requestTrap}
          name='website'
          value={website}
          onChange={event => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete='off'
          aria-hidden
        />
        {(status === 'failed' || status === 'wait') && (
          <p className={css.requestError} role='alert'>
            {status === 'wait' ? t('wait') : t('failed')}
          </p>
        )}
        <button type='submit' className={css.primaryButton} disabled={status === 'sending'}>
          {status === 'sending' ? t('sending') : t('send')}
        </button>
        <p className={css.requestConsent}>
          {t('consent')} <Link href={`/${locale}/privacy-policy`}>{t('privacy')}</Link>
        </p>
      </form>
    </section>
  );
}
