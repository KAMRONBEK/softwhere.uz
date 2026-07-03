'use client';

import { submitEstimateLead } from '@/modules/estimator/api';
import type { AiRefinement, EstimatorInput } from '@/modules/estimator/types';
import { trackEvent } from '@/shared/utils/analytics';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PhoneInput, defaultCountries, parseCountry, type ParsedCountry } from 'react-international-phone';
import 'react-international-phone/style.css';
import { SegmentedPill } from './ui';

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
      <div className='rounded-2xl border border-ember-accent bg-[rgba(255,91,30,0.08)] p-6 text-center'>
        <div className='text-3xl mb-2'>✅</div>
        <div className='font-display font-bold text-ember-text text-lg mb-1'>{t('leadSuccessTitle')}</div>
        <p className='text-sm text-ember-muted'>{t('leadSuccessSub')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='rounded-2xl border border-ember-border bg-ember-surface p-5 sm:p-6'>
      <div className='font-display font-bold text-ember-text text-lg mb-1'>{t('leadTitle')}</div>
      <p className='text-sm text-ember-muted mb-5'>{t('leadSub')}</p>

      <div className='grid sm:grid-cols-2 gap-4 mb-4'>
        <div>
          <label htmlFor='lead-name' className='block text-sm font-semibold text-ember-text mb-1.5'>
            {t('leadName')}
          </label>
          <input
            id='lead-name'
            type='text'
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('leadNamePlaceholder')}
            className='w-full rounded-xl border border-ember-border bg-ember-bg text-ember-text placeholder:text-ember-muted px-3.5 py-2.5 text-sm outline-none focus:border-ember-accent transition-colors'
          />
        </div>
        <div className='estimator-phone'>
          <label htmlFor='lead-phone' className='block text-sm font-semibold text-ember-text mb-1.5'>
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
            inputProps={{ id: 'lead-phone' }}
          />
        </div>
      </div>

      <div className='mb-4'>
        <span className='block text-sm font-semibold text-ember-text mb-1.5'>{t('leadContactVia')}</span>
        <div className='flex gap-1.5'>
          <SegmentedPill selected={contact === 'telegram'} onClick={() => setContact('telegram')}>
            ✈️ Telegram
          </SegmentedPill>
          <SegmentedPill selected={contact === 'call'} onClick={() => setContact('call')}>
            📞 {t('leadCall')}
          </SegmentedPill>
        </div>
      </div>

      <div className='mb-5'>
        <label htmlFor='lead-comment' className='block text-sm font-semibold text-ember-text mb-1.5'>
          {t('leadComment')}
        </label>
        <textarea
          id='lead-comment'
          value={comment}
          onChange={e => setComment(e.target.value.slice(0, MAX_COMMENT))}
          placeholder={t('leadCommentPlaceholder')}
          rows={2}
          className='w-full rounded-xl border border-ember-border bg-ember-bg text-ember-text placeholder:text-ember-muted px-3.5 py-2.5 text-sm outline-none focus:border-ember-accent transition-colors resize-y'
        />
      </div>

      {error && (
        <p role='alert' className='text-sm text-ember-accent mb-4'>
          {error}
        </p>
      )}

      <div className='flex flex-col sm:flex-row sm:items-center gap-3'>
        <button
          type='submit'
          disabled={submitting}
          className='px-7 py-3 rounded-full bg-ember-accent text-[#0a0705] font-bold text-sm hover:shadow-[0_0_28px_var(--glow)] transition-shadow disabled:opacity-60 cursor-pointer'
        >
          {submitting ? t('leadSending') : t('leadSubmit')}
        </button>
        <p className='text-xs text-ember-muted'>{t('leadPrivacy')}</p>
      </div>
    </form>
  );
}
