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
      <label htmlFor='pages' className='block mb-2'>
        {t('pagesLabel')}
      </label>

      <div className='mb-6'>
        <div className='flex justify-between mb-2'>
          <span className='text-sm text-gray-500 dark:text-gray-400'>{t('pagesQuestion')}</span>
          <span className={`font-bold ${getComplexityColor()}`}>{getComplexityLabel()}</span>
        </div>

        <input
          id='pages'
          type='range'
          min='1'
          max='100'
          className='w-full accent-orange-500'
          value={pageCount}
          onChange={e => onPageCountChange(Number(e.target.value))}
        />

        <div className='flex justify-between text-sm mt-1'>
          <span>1</span>
          <span className='font-bold'>{pageCount}</span>
          <span>100</span>
        </div>
      </div>

      <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-700 mt-4'>
        <h4 className='font-medium mb-2'>{t('pagesScreenTitle')}</h4>
        <p className='text-sm text-gray-600 dark:text-gray-400'>{t('pagesScreenDesc')}</p>
      </div>
    </div>
  );
}
