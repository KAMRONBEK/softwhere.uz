import { Complexity } from '@/types/estimator';

type ComplexityStepProps = {
  selectedComplexity: Complexity;
  onSelect: (complexity: Complexity) => void;
};

export default function ComplexityStep({ selectedComplexity, onSelect }: ComplexityStepProps) {
  const complexityOptions = [
    {
      type: 'mvp' as const,
      icon: '🚀',
      label: 'MVP',
      description: 'Minimum Viable Product',
      subtext: 'Essential features only',
    },
    {
      type: 'standard' as const,
      icon: '⚙️',
      label: 'Standard',
      description: 'Full-Featured',
      subtext: 'Complete solution',
    },
    {
      type: 'enterprise' as const,
      icon: '🏢',
      label: 'Enterprise',
      description: 'Complex Integration',
      subtext: 'Advanced features & integrations',
    },
  ];

  return (
    <div>
      <label className='block mb-2'>Project Complexity</label>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        {complexityOptions.map(option => (
          <button
            key={option.type}
            type='button'
            aria-pressed={selectedComplexity === option.type}
            className={`border rounded-lg p-4 flex flex-col items-center cursor-pointer transition-all hover:shadow-md ${
              selectedComplexity === option.type ? 'border-orange-500 bg-orange-50' : ''
            }`}
            onClick={() => onSelect(option.type)}
          >
            <div className='text-3xl mb-2'>{option.icon}</div>
            <div className='font-medium'>{option.label}</div>
            <div className='text-center mt-2 text-sm text-gray-600'>{option.description}</div>
            <div className='mt-1 text-xs text-gray-500'>{option.subtext}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
