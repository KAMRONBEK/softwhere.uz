import { ESTIMATOR, TechnologyKey } from '@/constants/estimator';

type TechStackStepProps = {
  selectedTech: TechnologyKey[];
  onToggleTech: (tech: TechnologyKey) => void;
};

export default function TechStackStep({ selectedTech, onToggleTech }: TechStackStepProps) {
  const technologies = Object.keys(ESTIMATOR.TECH_STACK_ADJUSTMENT) as TechnologyKey[];

  // Tech stack impact descriptions
  const techImpact: Record<string, { icon: string; impact: string; description: string }> = {
    ios_native: {
      icon: '🍎',
      impact: '+15%',
      description: 'High-quality native iOS experience',
    },
    android_native: {
      icon: '🤖',
      impact: '+15%',
      description: 'High-quality native Android experience',
    },
    flutter: {
      icon: '🦋',
      impact: '-5%',
      description: 'Cross-platform, slightly faster development',
    },
    react_native: {
      icon: '⚛️',
      impact: '±0%',
      description: 'Cross-platform standard',
    },
    nextjs: {
      icon: '▲',
      impact: '±0%',
      description: 'Modern React framework',
    },
    nestjs: {
      icon: '🐱',
      impact: '+10%',
      description: 'Enterprise-grade Node.js framework',
    },
  };

  const formatTechName = (tech: string): string => {
    return tech
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div>
      <label className='block mb-2'>Advanced Options (Tech Stack)</label>
      <p className='text-sm text-gray-500 mb-4'>
        Select technologies that align with your specific requirements and preferences. Your choices may impact the final cost and timeline.
      </p>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
        {technologies.map(tech => (
          <div
            key={tech}
            className={`border rounded-lg p-3 flex items-center cursor-pointer transition-all hover:shadow-md ${
              selectedTech.includes(tech) ? 'border-orange-500 bg-orange-50' : ''
            }`}
            onClick={() => onToggleTech(tech)}
          >
            <div className='text-2xl mr-3'>{techImpact[tech]?.icon || '⚙️'}</div>
            <div className='flex-1'>
              <div className='font-medium'>{formatTechName(tech)}</div>
              <div className='text-xs text-gray-600'>{techImpact[tech]?.description}</div>
            </div>
            <div
              className={`text-sm font-medium ${
                techImpact[tech]?.impact.includes('+')
                  ? 'text-red-500'
                  : techImpact[tech]?.impact.includes('-')
                    ? 'text-green-500'
                    : 'text-gray-500'
              }`}
            >
              {techImpact[tech]?.impact || '±0%'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
