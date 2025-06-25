import { ESTIMATOR, FeatureKey } from '@/constants/estimator';

type FeaturesStepProps = {
  selectedFeatures: FeatureKey[];
  onToggleFeature: (feature: FeatureKey) => void;
};

export default function FeaturesStep({ selectedFeatures, onToggleFeature }: FeaturesStepProps) {
  const features = Object.keys(ESTIMATOR.FEATURE_PRICES) as FeatureKey[];

  // Icons for each feature
  const featureIcons: Record<string, string> = {
    camera: '📷',
    gps: '📍',
    notifications: '🔔',
    payments: '💳',
    chat: '💬',
    offline: '⚡',
  };

  // More descriptive feature labels
  const featureLabels: Record<string, string> = {
    camera: 'Camera Access',
    gps: 'Location Services',
    notifications: 'Push Notifications',
    payments: 'Payment Processing',
    chat: 'Real-time Chat',
    offline: 'Offline Mode',
  };

  return (
    <div>
      <label className='block mb-2'>Core Features</label>
      <div className='grid grid-cols-2 gap-3'>
        {features.map(feature => (
          <div
            key={feature}
            className={`border rounded-lg p-3 flex items-start cursor-pointer transition-all hover:shadow-md ${
              selectedFeatures.includes(feature) ? 'border-orange-500 bg-orange-50' : ''
            }`}
            onClick={() => onToggleFeature(feature)}
          >
            <div className='text-2xl mr-3'>{featureIcons[feature] || '✨'}</div>
            <div>
              <div className='font-medium'>{featureLabels[feature] || feature}</div>
              <div className='text-xs text-gray-500'>+${ESTIMATOR.FEATURE_PRICES[feature].toLocaleString()}</div>
            </div>
            {selectedFeatures.includes(feature) && (
              <div className='ml-auto'>
                <div className='bg-orange-500 rounded-full p-1'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    className='h-4 w-4 text-white'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className='mt-4 text-sm text-gray-500'>Select all the features you need for your project</p>
    </div>
  );
}
