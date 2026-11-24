'use client';

import { submitEstimateLead } from '@/modules/estimator/api';
import type { AiRefinement, EstimatorInput } from '@/modules/estimator/types';
import { buttonClass } from '@/shared/components/site';
import { trackEvent } from '@/shared/utils/analytics';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PhoneInput, defaultCountries, parseCountry, type ParsedCountry } from 'react-international-phone';
import 'react-international-phone/style.css';
import { replaceWithPastedUzPhone } from '@/shared/utils/phonePaste';
import { PhoneIcon, TelegramIcon } from './icons';
import css from './ResultPanel.module.css';
import { SegmentedPill } from './ui';
import ui from './ui.module.css';

// Same market-relevant subset the contact form uses (keeps SSR HTML small).
const RELEVANT_COUNTRIES = new Set(['uz', 'ru', 'kz', 'kg', 'tj', 'tm', 'az', 'tr', 'ae', 'us', 'gb', 'de']);
const leadCountries = defaultCountries.filter(c => RELEVANT_COUNTRIES.has(parseCountry(c).iso2));

const MAX_COMMENT = 1000;

type Props = {
  input: EstimatorInput;
  ai: AiRefinement | null;
};

/**
 * Post-result lead capture (never gates the estimate — UX research is
 * unanimous that gating kills trust). Sends the full configuration + estimate
 * to the agency's DB and Telegram.
 */
export default function LeadForm({ input, ai }: Props) {
  const t = useTranslations('estimator');
  const locale = useLocale();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<ParsedCountry | null>(null);
  const [comment, setComment] = useState('');
  const [contact, setContact] = useState<'call' | 'telegram'>('telegram');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  /** Local digits required for the selected country (dots in its mask; the
   *  library's default mask has 9). Counting raw digits would let the dial
   *  code (+998 = 3 digits) mask an incomplete number. */
  const isPhoneComplete = (): boolean => {
    const dialDigits = country?.dialCode?.replace(/\D/g, '').length ?? 0;
    const localDigits = phone.replace(/\D/g, '').length - dialDigits;
    const mask = typeof country?.format === 'string' ? country.format : '.. ...-..-..';
    const required = (mask.match(/\./g) ?? []).length || 9;
    return localDigits >= Math.min(required, 10);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (name.trim() === '') {
      setError(t('leadErrorName'));
      return;
    }
    if (!isPhoneComplete()) {
      setError(t('leadErrorPhone'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitEstimateLead({
        name: name.trim(),
        phone,
        comment: comment.trim() || undefined,
        contact,
        input,
        locale,
        ai,
      });
      if (res.success) {
        setDone(true);
        trackEvent('estimator_lead_submit', { projectType: input.projectType, locale });
      } else {
        setError(t('leadErrorSubmit'));
      }
    } catch {
      setError(t('leadErrorSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className={`${css.panel} ${css.raised} ${css.done}`} role='status'>
        <svg viewBox='0 0 52 52' width='48' height='48' fill='none' stroke='currentColor' strokeWidth='2.5' aria-hidden='true'>
          <circle cx='26' cy='26' r='23' />
          <path d='m16 27 7 7 14-15' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
        <h3 className={css.formTitle}>{t('leadSuccessTitle')}</h3>
        <p className={css.muted}>{t('leadSuccessSub')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`${css.panel} ${css.raised}`}>
      <h3 className={css.formTitle}>{t('leadTitle')}</h3>
      <p className={css.muted}>{t('leadSub')}</p>

      <div className={css.fields}>
        <div className={css.two}>
          <div>
            <label htmlFor='lead-name' className={css.label}>
              {t('leadName')}
            </label>
            <input
              id='lead-name'
              type='text'
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('leadNamePlaceholder')}
              aria-invalid={error === t('leadErrorName') || undefined}
              className={ui.field}
            />
          </div>
          <div className={`estimator-phone ${css.phone}`} data-invalid={error === t('leadErrorPhone') || undefined}>
            <label htmlFor='lead-phone' className={css.label}>
              {t('leadPhone')}
            </label>
            <PhoneInput
              defaultCountry='uz'
              countries={leadCountries}
              value={phone}
              onChange={(value, meta) => {
                setPhone(value);
                setCountry(meta.country);
              }}
              defaultMask='.. ...-..-..'
              inputProps={{ id: 'lead-phone', onPaste: replaceWithPastedUzPhone(setPhone) }}
            />
          </div>
        </div>

        <div>
          <span className={css.label}>{t('leadContactVia')}</span>
          <div className={ui.pills}>
            <SegmentedPill selected={contact === 'telegram'} onClick={() => setContact('telegram')}>
              <TelegramIcon /> Telegram
            </SegmentedPill>
            <SegmentedPill selected={contact === 'call'} onClick={() => setContact('call')}>
              <PhoneIcon /> {t('leadCall')}
            </SegmentedPill>
          </div>
        </div>

        <div>
          <label htmlFor='lead-comment' className={css.label}>
            {t('leadComment')}
          </label>
          <textarea
            id='lead-comment'
            value={comment}
            onChange={e => setComment(e.target.value.slice(0, MAX_COMMENT))}
            placeholder={t('leadCommentPlaceholder')}
            rows={2}
            className={ui.field}
          />
        </div>

        {error && (
          <p role='alert' className={css.error}>
            {error}
          </p>
        )}

        <div className={css.submit}>
          <button type='submit' disabled={submitting} className={buttonClass()}>
            {submitting ? t('leadSending') : t('leadSubmit')}
          </button>
          <p className={css.small}>{t('leadPrivacy')}</p>
        </div>
      </div>
    </form>
  );
}
