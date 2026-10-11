'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type FocusEvent,
  type FormEvent,
  type Ref,
} from 'react';
import { useContactPrefill } from '@/shared/utils/contactPrefill';
import { postLead } from '@/shared/utils/lead';
import { SectionHeading } from '../../components/LabSection';
import { useInView } from '../../components/useInView';
import { useLabLogo } from '../../logos';
import type { SectionMeta } from '../../types';
import { BRAND, channelsForLocale, type ChannelId } from './copy';
import { CheckMark, MailIcon, PhoneIcon, TelegramIcon } from './icons';
import css from './panel.module.css';

type Status = 'idle' | 'sending' | 'sent' | 'failed';

interface Values {
  name: string;
  contact: string;
  idea: string;
}

interface Errors {
  name?: boolean;
  contact?: boolean;
}

const EMPTY: Values = { name: '', contact: '', idea: '' };
/** The warp jump plays at least this long before the result lands (ms), however fast the server answers. */
const LAUNCH_MS = 950;
/** Where the lead says it came from (stored as the lead's source, shown in the team's Telegram). */
const LEAD_SOURCE = 'home-finale';
const YEAR = new Date().getFullYear();

const CHANNEL_ICON: Record<ChannelId, ComponentType> = {
  telegram: TelegramIcon,
  call: PhoneIcon,
  email: MailIcon,
};

function validate(values: Values): Errors {
  return {
    ...(values.name.trim() ? {} : { name: true }),
    ...(values.contact.trim() ? {} : { contact: true }),
  };
}

const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

const isTextField = (node: EventTarget | null): boolean => node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement;

export interface ContactPanelProps {
  ref?: Ref<HTMLDivElement>;
  meta: SectionMeta;
  /** Plays the warp jump as the lead is sent. */
  onLaunch: () => void;
  /** A text field gained or lost focus (the warp freezes while the keyboard is up). */
  onTypingChange: (isTyping: boolean) => void;
  isReducedMotion: boolean;
}

/**
 * The calm after the warp: the one heading of the section, a three-field
 * inquiry form that creates a real lead (POST /api/contact through
 * postLead: stored, then sent to the team's Telegram) with its sending, sent
 * and failed states inline, the studio's real direct channels and the active
 * logo. `id='contact'` is the page's contact anchor (the site's `#contact`
 * links, the AI brief's "Talk to us about this plan", which also prefills the
 * idea through useContactPrefill).
 */
export default function ContactPanel({ ref, meta, onLaunch, onTypingChange, isReducedMotion }: ContactPanelProps) {
  const t = useTranslations('home.finale');
  const locale = useLocale();
  const { Logo } = useLabLogo();
  const channels = channelsForLocale(locale);
  const channelTitle = (id: ChannelId, value: string): string =>
    id === 'telegram'
      ? t('direct.telegramTitle', { handle: value })
      : id === 'call'
        ? t('direct.callTitle', { phone: value })
        : t('direct.emailTitle', { email: value });
  // Static ids (one finale per page): useId differs between the SSR and client trees here.
  const uid = `${meta.id}-form`;
  const ids = { name: `${uid}-name`, contact: `${uid}-contact`, idea: `${uid}-idea`, done: `${uid}-done` };
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>('idle');
  /** The name the success message thanks (the fields clear once the lead is in). */
  const [sentName, setSentName] = useState('');
  const isMountedRef = useRef(true);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  // The logo plays its entrance the first time the footer comes into view.
  const footRef = useRef<HTMLDivElement>(null);
  const isFootInView = useInView(footRef);
  const [hasSeenFoot, setHasSeenFoot] = useState(false);
  if (isFootInView && !hasSeenFoot) setHasSeenFoot(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // "Talk to us about this plan" (the AI brief) hands its summary to the idea field.
  const receivePrefill = useCallback((message: string) => {
    setValues(prev => ({ ...prev, idea: message }));
    setStatus(prev => (prev === 'sending' ? prev : 'idle'));
  }, []);
  useContactPrefill(receivePrefill);

  useEffect(() => {
    if (status === 'sent') doneRef.current?.focus({ preventScroll: true });
  }, [status]);

  const change = (field: keyof Values) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setValues(prev => ({ ...prev, [field]: value }));
    if (field !== 'idea' && errors[field] && value.trim()) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleFocus = (event: FocusEvent<HTMLFormElement>) => {
    if (isTextField(event.target)) onTypingChange(true);
  };

  const handleBlur = (event: FocusEvent<HTMLFormElement>) => {
    // Moving between fields keeps the keyboard up: only leaving them all counts.
    if (!isTextField(event.relatedTarget) || !formRef.current?.contains(event.relatedTarget as Node)) onTypingChange(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'sending' || status === 'sent') return;
    const found = validate(values);
    setErrors(found);
    const firstInvalid = found.name ? ids.name : found.contact ? ids.contact : null;
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLInputElement>(`[id="${firstInvalid}"]`)?.focus();
      return;
    }
    // Drop the phone keyboard so the jump to warp is visible.
    if (document.activeElement instanceof HTMLElement && isTextField(document.activeElement)) document.activeElement.blur();
    onTypingChange(false);
    onLaunch();
    setStatus('sending');
    const lead = { name: values.name.trim(), phone: values.contact.trim(), message: values.idea.trim(), from: LEAD_SOURCE };
    const [isSent] = await Promise.all([postLead(lead), isReducedMotion ? Promise.resolve() : wait(LAUNCH_MS)]);
    if (!isMountedRef.current) return;
    if (isSent) {
      setSentName(lead.name);
      setValues(EMPTY);
    }
    setStatus(isSent ? 'sent' : 'failed');
  };

  const startOver = () => {
    setStatus('idle');
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>(`[id="${ids.name}"]`)?.focus({ preventScroll: true }));
  };

  const isSent = status === 'sent';
  const isSending = status === 'sending';

  return (
    <div ref={ref} className={css.panel}>
      <div className={css.inner}>
        <div className={css.lead}>
          <SectionHeading meta={meta} className={css.heading}>
            {t('heading')}
          </SectionHeading>
          <p className={css.deck} data-deck=''>
            {t('summary')}
          </p>

          <div className={css.direct} data-rise=''>
            <p className={css.directLabel}>{t('direct.label')}</p>
            <div className={css.directRow}>
              {channels.map(channel => {
                const Icon = CHANNEL_ICON[channel.id];
                const title = channelTitle(channel.id, channel.value);
                return (
                  <a
                    key={channel.id}
                    className={css.directLink}
                    href={channel.href}
                    aria-label={title}
                    title={title}
                    data-magnetic=''
                    {...(channel.isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    <Icon />
                    <span>{t(`direct.${channel.id}`)}</span>
                  </a>
                );
              })}
            </div>
            <p className={css.estimate}>
              <span>{t('estimate.lead')}</span>{' '}
              <Link href={`/${locale}/estimator`} className={css.estimateLink}>
                {t('estimate.link')}
              </Link>
            </p>
          </div>
        </div>

        <div id='contact' className={css.card} data-status={status} data-card=''>
          <form
            ref={formRef}
            className={css.form}
            onSubmit={submit}
            onFocus={handleFocus}
            onBlur={handleBlur}
            noValidate
            aria-label={t('form.label')}
            inert={isSent}
            aria-hidden={isSent || undefined}
          >
            <div className={css.field} data-invalid={Boolean(errors.name)}>
              <label htmlFor={ids.name}>{t('form.name')}</label>
              <input
                id={ids.name}
                name='name'
                type='text'
                autoComplete='name'
                enterKeyHint='next'
                value={values.name}
                onChange={change('name')}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? `${ids.name}-error` : undefined}
              />
              <p id={`${ids.name}-error`} className={css.error} aria-live='polite'>
                {errors.name ? t('form.errorName') : ''}
              </p>
            </div>
            <div className={css.field} data-invalid={Boolean(errors.contact)}>
              <label htmlFor={ids.contact}>{t('form.contact')}</label>
              <input
                id={ids.contact}
                name='contact'
                type='text'
                autoComplete='email'
                enterKeyHint='next'
                placeholder={t('form.contactPlaceholder')}
                value={values.contact}
                onChange={change('contact')}
                aria-invalid={Boolean(errors.contact)}
                aria-describedby={errors.contact ? `${ids.contact}-error` : undefined}
              />
              <p id={`${ids.contact}-error`} className={css.error} aria-live='polite'>
                {errors.contact ? t('form.errorContact') : ''}
              </p>
            </div>
            <div className={css.field}>
              <label htmlFor={ids.idea}>
                {t('form.idea')} <span className={css.optional}>{t('form.ideaOptional')}</span>
              </label>
              <textarea
                id={ids.idea}
                name='idea'
                rows={3}
                enterKeyHint='send'
                placeholder={t('form.ideaPlaceholder')}
                value={values.idea}
                onChange={change('idea')}
              />
            </div>
            <button type='submit' className={css.submit} data-magnetic='' data-state={status} aria-disabled={isSending || isSent}>
              <span className={css.submitLabel}>{isSending ? t('form.sending') : t('form.submit')}</span>
              <span className={css.submitStreak} aria-hidden='true' />
            </button>
            <p className={css.sendError} role='alert'>
              {status === 'failed' ? t('form.errorSend') : ''}
            </p>
            <p className={css.privacy}>
              {t.rich('form.privacy', {
                link: chunks => <a href={`/${locale}/privacy-policy`}>{chunks}</a>,
              })}
            </p>
          </form>

          <div className={css.done} aria-hidden={!isSent} inert={!isSent}>
            {isSent && <CheckMark className={css.check} />}
            <h3 ref={doneRef} id={ids.done} className={css.doneTitle} tabIndex={-1}>
              {t('success.title')}
            </h3>
            <p className={css.doneBody}>{t('success.body', { name: sentName })}</p>
            <button type='button' className={css.again} onClick={startOver}>
              {t('success.again')}
            </button>
          </div>
        </div>
      </div>

      <div ref={footRef} className={css.foot}>
        <div className={css.logoSlot}>{hasSeenFoot && <Logo className={css.logo} title={BRAND} animate />}</div>
        <p className={css.place}>
          <span>{t('place')}</span>
          <span>
            © {YEAR} {BRAND}
          </span>
        </p>
      </div>
    </div>
  );
}
