'use client';

import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { SegmentedPill } from './ui';

export type CurrencyCode = 'USD' | 'UZS' | 'KZT' | 'RUB' | 'EUR';

const CURRENCIES: CurrencyCode[] = ['USD', 'UZS', 'KZT', 'RUB', 'EUR'];
const STORAGE_KEY = 'estimator-currency';

const INTL_LOCALES: Record<string, string> = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-US' };

/** Converted amounts get 3 significant digits — "5 100 000 сум" reads honest,
 *  "5 083 214 сум" reads fake, and a fixed step would zero out small values. */
function roundForCurrency(value: number, currency: CurrencyCode): number {
  if (currency === 'USD' || value <= 0) return Math.round(value);
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 2);
  return Math.round(value / magnitude) * magnitude;
}

export function useCurrency() {
  const locale = useLocale();
  const intlLocale = INTL_LOCALES[locale] ?? 'en-US';
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });

  useEffect(() => {
    const fetchRates = async () => {
      let fetched: Record<string, number> = { USD: 1 };
      try {
        const res = await fetch('/api/currency/rates');
        const data = await res.json();
        if (res.ok && data.rates) {
          fetched = data.rates;
          setRates(fetched);
        }
      } catch {
        // Keep USD-only default
      }
      // Restore the saved currency only once its rate actually exists —
      // applying "UZS" while rates are still {USD:1} would label USD amounts
      // as UZS (off by ~12,000×).
      const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      if (stored && CURRENCIES.includes(stored) && (stored === 'USD' || fetched[stored])) {
        setCurrencyState(stored);
      }
    };

    fetchRates();
  }, []);

  const setCurrency = (c: CurrencyCode) => {
    setCurrencyState(c);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, c);
  };

  // Belt-and-braces: if the selected currency has no rate, display USD rather
  // than mislabeling unconverted amounts.
  const effectiveCurrency: CurrencyCode = currency === 'USD' || rates[currency] ? currency : 'USD';

  const convert = (amountUsd: number): number => {
    const rate = rates[effectiveCurrency] ?? 1;
    return amountUsd * rate;
  };

  const format = (amountUsd: number): string => {
    const value = roundForCurrency(convert(amountUsd), effectiveCurrency);
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: effectiveCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  /** "≈ $3,000 – $4,500" range formatter shared by preview/result. */
  const formatRange = (min: number, max: number): string => `${format(min)} – ${format(max)}`;

  // A currency without a fetched rate would silently show USD amounts under a
  // UZS label — only offer currencies we actually have rates for.
  const available = CURRENCIES.filter(c => c === 'USD' || rates[c]);

  return { currency: effectiveCurrency, setCurrency, rates, convert, format, formatRange, available };
}

type CurrencySwitcherProps = {
  currency: CurrencyCode;
  available: CurrencyCode[];
  onCurrencyChange: (c: CurrencyCode) => void;
};

export default function CurrencySwitcher({ currency, available, onCurrencyChange }: CurrencySwitcherProps) {
  return (
    <div className='flex flex-wrap gap-1.5'>
      {available.map(c => (
        <SegmentedPill key={c} selected={currency === c} onClick={() => onCurrencyChange(c)}>
          {c}
        </SegmentedPill>
      ))}
    </div>
  );
}
