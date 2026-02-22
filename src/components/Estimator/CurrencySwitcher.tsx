'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';

export type CurrencyCode = 'USD' | 'UZS' | 'EUR' | 'RUB';

const CURRENCIES: CurrencyCode[] = ['USD', 'UZS', 'EUR', 'RUB'];
const STORAGE_KEY = 'estimator-currency';

export function useCurrency() {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      if (stored && CURRENCIES.includes(stored)) return stored;
    }
    return 'USD';
  });
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('/api/currency/rates');
        const data = await res.json();

        if (res.ok && data.rates) setRates(data.rates);
      } catch {
        // Keep default rates
      }
    };

    fetchRates();
  }, []);

  const setCurrency = (c: CurrencyCode) => {
    setCurrencyState(c);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, c);
  };

  const convert = (amountUsd: number): number => {
    const rate = rates[currency] ?? 1;

    return amountUsd * rate;
  };

  const format = (amountUsd: number): string => {
    const value = convert(amountUsd);

    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return { currency, setCurrency, rates, convert, format };
}

type CurrencySwitcherProps = {
  currency: CurrencyCode;
  onCurrencyChange: (c: CurrencyCode) => void;
};

export default function CurrencySwitcher({ currency, onCurrencyChange }: CurrencySwitcherProps) {
  const t = useTranslations('estimator');

  return (
    <div className='flex items-center gap-2'>
      <span className='text-sm text-gray-500'>Currency:</span>
      <select
        value={currency}
        onChange={e => onCurrencyChange(e.target.value as CurrencyCode)}
        className='border rounded px-2 py-1 text-sm'
      >
        <option value='USD'>{t('currency.usd')}</option>
        <option value='UZS'>{t('currency.uzs')}</option>
        <option value='EUR'>{t('currency.eur')}</option>
        <option value='RUB'>{t('currency.rub')}</option>
      </select>
    </div>
  );
}
