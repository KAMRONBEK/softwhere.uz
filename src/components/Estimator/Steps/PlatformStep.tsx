import { useTranslations } from 'next-intl';

type PlatformStepProps = {
  selectedPlatforms: string[];
  onTogglePlatform: (platform: 'ios' | 'android') => void;
};

export default function PlatformStep({ selectedPlatforms, onTogglePlatform }: PlatformStepProps) {
  const t = useTranslations('estimator');
  const platforms = [
    { id: 'ios', icon: '🍎', label: 'iOS' },
    { id: 'android', icon: '🤖', label: 'Android' },
  ];

  return (
    <div>
      <label className='block mb-2'>{t('platformChoose')}</label>
      <div className='grid grid-cols-2 gap-4'>
        {platforms.map(platform => (
          <button
            key={platform.id}
            type='button'
            aria-pressed={selectedPlatforms.includes(platform.id)}
            className={`border dark:border-gray-700 rounded-lg p-4 flex flex-col items-center cursor-pointer transition-all hover:shadow-md ${
              selectedPlatforms.includes(platform.id) ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' : 'bg-white dark:bg-gray-800'
            }`}
            onClick={() => onTogglePlatform(platform.id as 'ios' | 'android')}
          >
            <div className='text-3xl mb-2'>{platform.icon}</div>
            <div className='font-medium'>{platform.label}</div>
            {selectedPlatforms.includes(platform.id) && (
              <div className='mt-2 bg-orange-500 text-white rounded-full px-2 py-1 text-xs'>{t('selected')}</div>
            )}
          </button>
        ))}
      </div>
      <p className='mt-4 text-sm text-gray-500 dark:text-gray-400'>{t('platformHint')}</p>
    </div>
  );
}
