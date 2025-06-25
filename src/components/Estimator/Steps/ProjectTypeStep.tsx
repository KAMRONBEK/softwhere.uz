import { ProjectType } from '@/types/estimator';

type ProjectTypeStepProps = {
  selectedType: ProjectType;
  onSelect: (type: ProjectType) => void;
};

export default function ProjectTypeStep({ selectedType, onSelect }: ProjectTypeStepProps) {
  const projectTypes: { type: ProjectType; icon: string; label: string }[] = [
    { type: 'mobile', icon: '📱', label: 'Mobile App' },
    { type: 'web', icon: '🖥️', label: 'Web App' },
    { type: 'telegram', icon: '✈️', label: 'Telegram Bot' },
    { type: 'desktop', icon: '💻', label: 'Desktop App' },
    { type: 'other', icon: '🔧', label: 'Other' },
  ];

  return (
    <div>
      <label className='block mb-2'>Select Project Type</label>
      <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
        {projectTypes.map(project => (
          <div
            key={project.type}
            className={`border rounded-lg p-4 flex flex-col items-center cursor-pointer transition-all hover:shadow-md ${
              selectedType === project.type ? 'border-orange-500 bg-orange-50' : ''
            }`}
            onClick={() => onSelect(project.type)}
          >
            <div className='text-3xl mb-2'>{project.icon}</div>
            <div className='font-medium'>{project.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
