'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { PhoneInput, defaultCountries, parseCountry } from 'react-international-phone';
import 'react-international-phone/style.css';
import { toast } from 'react-toastify';
import { Container, buttonClass } from '@/shared/components/site';
import { trackEvent } from '@/shared/utils/analytics';
import { useContactPrefill } from '@/shared/utils/contactPrefill';
import { replaceWithPastedUzPhone } from '@/shared/utils/phonePaste';
import { sender } from '@/shared/utils/send';
import css from './contact.module.css';

// The dropdown SSRs its full country list (~210 <li> with a flag each): only
// the markets that write to us; any other number can still be typed.
const RELEVANT_COUNTRIES = new Set(['uz', 'ru', 'kz', 'kg', 'tj', 'tm', 'az', 'tr', 'ae', 'us', 'gb', 'de']);
const contactCountries = defaultCountries.filter(c => RELEVANT_COUNTRIES.has(parseCountry(c).iso2));

const PHONE = { href: 'tel:+998332499111', label: '+998 33 249-91-11' };
const EMAIL = 'kamuranbek98@gmail.com';

/** The page's contact form ("Talk to us about this plan" drafts its message), drawn as the homepage's finale. */
export default function ContactForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [messageError, setMessageError] = useState(false);
  const t = useTranslations('contact');
  const tM = useTranslations('toastMessage');
  // Nothing is sent until the visitor submits.
  useContactPrefill(setMessage);

  const validate = (): boolean => {
    const isPhoneInvalid = phone.replace(/\D/g, '').length < 9;
    const isNameInvalid = name.trim() === '';
    setPhoneError(isPhoneInvalid);
    const isMessageInvalid = message.trim() === '';
    setNameError(isNameInvalid);
    setMessageError(isMessageInvalid);
    if (!isPhoneInvalid && !isNameInvalid && !isMessageInvalid) return true;
    toast.error(tM(isPhoneInvalid ? 'phoneNumber' : isNameInvalid ? 'name' : 'message'));
    document.getElementById(isPhoneInvalid ? 'phone-input' : isNameInvalid ? 'name' : 'message')?.focus();
    return false;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);
    const id = toast.loading(tM('loading'));
    try {
      const isSent = await sender(String(id), name, phone, message, '', { success: tM('success'), error: tM('error') });
      if (!isSent) return;
      setName('');
      setPhone('');
      setMessage('');
      setPhoneError(false);
      setNameError(false);
      setMessageError(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={css.section} id='contact' aria-labelledby='contact-heading'>
      <Container>
        <div className={css.inner}>
          <div className={css.lead}>
            <h2 id='contact-heading' className={css.heading}>
              {t('title')}
            </h2>
            <p className={css.deck}>{t('description')}</p>
            <ul className={css.direct}>
              <li>
                <a href={PHONE.href} onClick={() => trackEvent('external_link_click', { type: 'phone', source: 'contact' })}>
                  {PHONE.label}
                </a>
              </li>
              <li>
                <a href={`mailto:${EMAIL}`} onClick={() => trackEvent('external_link_click', { type: 'email', source: 'contact' })}>
                  {EMAIL}
                </a>
              </li>
              <li className={css.place}>{t('place')}</li>
            </ul>
          </div>
          <form onSubmit={handleSubmit} className={`${css.card} contact-form`} noValidate>
            <div className={css.pair}>
              <div className={css.field} data-invalid={phoneError}>
                <label htmlFor='phone-input'>{t('phoneNumber')}</label>
                <PhoneInput
                  defaultCountry='uz'
                  countries={contactCountries}
                  value={phone}
                  onChange={value => {
                    setPhone(value);
                    if (phoneError) setPhoneError(false);
                  }}
                  defaultMask='.. ...-..-..'
                  inputProps={{
                    id: 'phone-input',
                    autoComplete: 'tel',
                    onPaste: replaceWithPastedUzPhone(setPhone),
                    'aria-invalid': phoneError,
                    'aria-describedby': phoneError ? 'phone-error' : undefined,
                  }}
                />
                {phoneError && (
                  <span id='phone-error' role='alert' className={css.error}>
                    {tM('phoneNumber')}
                  </span>
                )}
              </div>
              <div className={css.field} data-invalid={nameError}>
                <label htmlFor='name'>{t('name')}</label>
                <input
                  value={name}
                  onChange={event => {
                    setName(event.target.value);
                    if (nameError) setNameError(false);
                  }}
                  type='text'
                  autoComplete='name'
                  placeholder={t('name')}
                  id='name'
                  aria-invalid={nameError}
                  aria-describedby={nameError ? 'name-error' : undefined}
                />
                {nameError && (
                  <span id='name-error' role='alert' className={css.error}>
                    {tM('name')}
                  </span>
                )}
              </div>
            </div>
            <div className={css.field} data-invalid={messageError}>
              <label htmlFor='message'>{t('message')}</label>
              <textarea
                value={message}
                onChange={event => {
                  setMessage(event.target.value);
                  if (messageError) setMessageError(false);
                }}
                id='message'
                placeholder={t('messagePlaceholder')}
                rows={5}
                aria-invalid={messageError}
                aria-describedby={messageError ? 'message-error' : undefined}
              />
              {messageError && (
                <span id='message-error' role='alert' className={css.error}>
                  {tM('message')}
                </span>
              )}
            </div>
            <button className={buttonClass('primary', css.submit)} type='submit' disabled={isSubmitting}>
              {t('btn')}
            </button>
          </form>
        </div>
      </Container>
    </section>
  );
}
