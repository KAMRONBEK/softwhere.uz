import { useTranslations } from 'next-intl';

type PagesStepProps = {
  pageCount: number;
  onPageCountChange: (count: number) => void;
};

export default function PagesStep({ pageCount, onPageCountChange }: PagesStepProps) {
  const t = useTranslations('estimator');

  // Helper function to determine the complexity label based on page count
  const getComplexityLabel = () => {
    if (pageCount <= 5) return t('pagesComplexity.simple');
    if (pageCount <= 20) return t('pagesComplexity.medium');
    if (pageCount <= 50) return t('pagesComplexity.complex');

    return t('pagesComplexity.veryComplex');
  };

  // Get corresponding color for complexity
  const getComplexityColor = () => {
    if (pageCount <= 5) return 'text-green-600';
    if (pageCount <= 20) return 'text-blue-600';
    if (pageCount <= 50) return 'text-orange-600';

    return 'text-red-600';
  };

  return (
    <div>
      <label htmlFor='pages' className='block mb-2 font-display text-ember-text'>
        {t('pagesLabel')}
      </label>

      <div className='mb-6'>
        <div className='flex justify-between mb-2'>
          <span className='text-sm text-ember-muted'>{t('pagesQuestion')}</span>
          <span className={`font-bold ${getComplexityColor()}`}>{getComplexityLabel()}</span>
        </div>

        <input
          id='pages'
          type='range'
          min='1'
          max='100'
          className='w-full accent-[color:var(--accent)]'
          value={pageCount}
          onChange={e => onPageCountChange(Number(e.target.value))}
        />

        <div className='flex justify-between text-sm mt-1'>
          <span>1</span>
          <span className='font-bold text-ember-accent'>{pageCount}</span>
          <span>100</span>
        </div>
      </div>

      <div className='p-4 bg-ember-surface rounded-lg border border-ember-border mt-4'>
        <h4 className='font-medium mb-2 font-display text-ember-text'>{t('pagesScreenTitle')}</h4>
        <p className='text-sm text-ember-muted'>{t('pagesScreenDesc')}</p>
      </div>
    </div>
  );
}
