'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { MAX_IDEA_CHARS, MIN_IDEA_CHARS } from '@/modules/estimator/ai-brief/constants';
import css from './brief.module.css';

/** Example ideas, the same keys in every locale (the texts are market-specific). */
const EXAMPLE_KEYS = ['booking', 'bot', 'delivery', 'marketplace', 'ai'] as const;

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (idea: string) => void;
  /** Callout above the field: a rejection, a policy decline or an error with its actions. */
  feedback?: ReactNode;
  isCompact?: boolean;
  /** Focus the field on mount (after "Edit idea"). */
  shouldFocus?: boolean;
  /**
   * Static prefix for the field's ids. The lab renders the composer inside a
   * tree that differs between the server and the client, where `useId` values
   * mismatch on hydration; one composer per variant per page makes a static id safe.
   */
  idPrefix?: string;
};

/** The platform never changes while the page is open; the server renders "Ctrl". */
const subscribeNever = () => () => {};
const platformModKey = () => (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl');

/** Counter turns into a warning in the last 10% before the cap. */
const WARN_AT = Math.round(MAX_IDEA_CHARS * 0.9);

export default function Composer({ value, onChange, onSubmit, feedback, isCompact = false, shouldFocus = false, idPrefix }: ComposerProps) {
  const t = useTranslations('aiBrief.composer');
  const generatedId = useId();
  const baseId = idPrefix ?? generatedId;
  const fieldId = `${baseId}-field`;
  const hintId = `${baseId}-hint`;
  const countId = `${baseId}-count`;
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [hint, setHint] = useState<string | null>(null);
  const modKey = useSyncExternalStore(subscribeNever, platformModKey, () => 'Ctrl');
  const length = value.trim().length;

  useEffect(() => {
    if (!shouldFocus) return;
    const field = fieldRef.current;
    field?.focus();
    field?.setSelectionRange(field.value.length, field.value.length);
  }, [shouldFocus]);

  const submit = () => {
    const idea = value.trim();
    if (idea.length < MIN_IDEA_CHARS) {
      setHint(t('tooShort'));
      fieldRef.current?.focus();
      return;
    }
    if (idea.length > MAX_IDEA_CHARS) {
      setHint(t('tooLong', { max: MAX_IDEA_CHARS }));
      return;
    }
    setHint(null);
    onSubmit(idea);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };

  const applyExample = (text: string) => {
    onChange(text);
    setHint(null);
    requestAnimationFrame(() => {
      const field = fieldRef.current;
      field?.focus();
      field?.setSelectionRange(text.length, text.length);
    });
  };

  const counterClass = length > MAX_IDEA_CHARS ? css.countOver : length >= WARN_AT ? css.countWarn : css.count;

  return (
    <form className={isCompact ? `${css.composer} ${css.composerCompact}` : css.composer} onSubmit={handleSubmit} noValidate>
      {feedback}
      <label htmlFor={fieldId} className={css.srOnly}>
        {t('label')}
      </label>
      <div className={css.field}>
        <textarea
          ref={fieldRef}
          id={fieldId}
          className={css.textarea}
          value={value}
          onChange={event => {
            onChange(event.target.value);
            if (hint) setHint(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          maxLength={MAX_IDEA_CHARS + 200}
          rows={isCompact ? 3 : 4}
          aria-describedby={`${hintId} ${countId}`}
          aria-invalid={hint !== null}
          spellCheck
        />
        <div className={css.examples}>
          <span className={css.examplesLabel}>{t('examplesLabel')}</span>
          <div className={css.exampleChips}>
            {EXAMPLE_KEYS.map(key => (
              <button key={key} type='button' className={css.exampleChip} onClick={() => applyExample(t(`examples.${key}.text`))}>
                {t(`examples.${key}.label`)}
              </button>
            ))}
          </div>
        </div>
        <div className={css.composerFoot}>
          <p id={hintId} className={hint ? css.fieldHint : css.privacy} role={hint ? 'alert' : undefined}>
            {hint ?? (
              <>
                <svg viewBox='0 0 16 16' aria-hidden className={css.lock}>
                  <path
                    d='M4.5 7V5.2a3.5 3.5 0 0 1 7 0V7M3.8 7h8.4c.4 0 .8.4.8.8v5.4c0 .4-.4.8-.8.8H3.8a.8.8 0 0 1-.8-.8V7.8c0-.4.4-.8.8-.8z'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='1.3'
                    strokeLinejoin='round'
                  />
                </svg>
                {t('privacy')}
              </>
            )}
          </p>
          <div className={css.submitRow}>
            <span id={countId} className={counterClass} aria-live='polite'>
              {t('count', { count: length, max: MAX_IDEA_CHARS })}
            </span>
            <span className={css.shortcut} aria-hidden>
              {t('shortcut', { key: modKey })}
            </span>
            <button type='submit' className={css.primaryButton}>
              {t('submit')}
            </button>
          </div>
        </div>
      </div>
      <div className={css.notes}>
        <p className={css.freeNote}>{t('freeNote')}</p>
        <p className={css.freeNote}>{t('exactNote')}</p>
      </div>
    </form>
  );
}
