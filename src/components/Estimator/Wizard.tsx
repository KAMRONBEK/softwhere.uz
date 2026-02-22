'use client';

import Button from '@/components/Button';
import { FeaturesStep, PagesStep, PlatformStep, ProjectTypeStep, ResultDisplay, ScopeStep, TechStackStep } from '@/components/Estimator';
import { logger } from '@/core/logger';
import { api } from '@/core/api';
import type { EstimateResult, EstimatorInput } from '@/types/estimator';
import { calculateEstimate } from '@/utils/estimator';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

type StepId = 'service' | 'platforms' | 'scope' | 'features' | 'scale' | 'advanced';
const ALL_STEPS: StepId[] = ['service', 'platforms', 'scope', 'features', 'scale', 'advanced'];
const STEP_LABELS: Record<StepId, string> = {
  service: 'stepProjectType',
  platforms: 'stepPlatforms',
  scope: 'stepScope',
  features: 'stepFeatures',
  scale: 'stepScale',
  advanced: 'stepAdvanced',
};

export default function Wizard() {
  const t = useTranslations('estimator');
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<EstimatorInput>({
    projectType: 'mobile',
    complexity: 'mvp',
    features: [],
    pages: 1,
    platforms: [],
    techStack: [],
  });

  const defaultEstimate = calculateEstimate({
    projectType: 'mobile',
    complexity: 'mvp',
    features: [],
    pages: 1,
  });

  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiReasoning, setAiReasoning] = useState('');
  const [estimateSource, setEstimateSource] = useState<'formula' | 'ai' | null>(null);

  const localEstimate = useMemo(() => calculateEstimate(input), [input]);

  const shouldShowPlatformStep = input.projectType === 'mobile';
  const shouldShowTechStep = input.projectType !== 'other';
  let steps: StepId[] = shouldShowPlatformStep ? ALL_STEPS : ALL_STEPS.filter(s => s !== 'platforms');
  if (!shouldShowTechStep) steps = steps.filter(s => s !== 'advanced');
  const maxSteps = steps.length;
  const isLastStep = step === maxSteps - 1;

  const fetchAIEstimate = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.estimator.getEstimate(input);

      if (response.success && response.data) {
        setEstimate(response.data);
        setEstimateSource(response.data.source);
        if (response.data.reasoning) setAiReasoning(response.data.reasoning);
        if (response.data.source === 'formula') {
          setError('Using formula calculation (AI estimate was not available).');
        }
      } else {
        setEstimate(calculateEstimate(input));
        setEstimateSource('formula');
        setError('Could not get estimate from API. Using local calculation.');
      }
    } catch (err) {
      logger.error('Estimate API failed', err, 'ESTIMATOR');
      setEstimate(calculateEstimate(input));
      setEstimateSource('formula');
      setError('Error calculating estimate. Using local calculation.');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectTypeChange = (type: EstimatorInput['projectType']) => {
    setInput(prev => ({ ...prev, projectType: type, subtype: undefined, platforms: [] }));
  };

  const handlePlatformToggle = (platform: 'ios' | 'android') => {
    const current = input.platforms ?? [];
    setInput(prev => ({
      ...prev,
      platforms: current.includes(platform) ? current.filter(p => p !== platform) : [...current, platform],
    }));
  };

  const handleComplexityChange = (c: EstimatorInput['complexity']) => {
    setInput(prev => ({ ...prev, complexity: c }));
  };

  const handleSubtypeChange = (s: string) => {
    setInput(prev => ({ ...prev, subtype: s }));
  };

  const handleFeatureToggle = (feature: string) => {
    setInput(prev => ({
      ...prev,
      features: prev.features.includes(feature) ? prev.features.filter(f => f !== feature) : [...prev.features, feature],
    }));
  };

  const handlePageCountChange = (count: number) => {
    setInput(prev => ({ ...prev, pages: count }));
  };

  const handleTechToggle = (tech: string) => {
    const current = input.techStack ?? [];
    setInput(prev => ({
      ...prev,
      techStack: current.includes(tech) ? current.filter(t => t !== tech) : [...current, tech],
    }));
  };

  const handleReset = () => {
    setStep(0);
    setInput({
      projectType: 'mobile',
      complexity: 'mvp',
      features: [],
      pages: 1,
      platforms: [],
      techStack: [],
    });
    setEstimate(null);
    setAiReasoning('');
    setEstimateSource(null);
    setError('');
  };

  const currentStepId = steps[step];

  const renderCurrentStep = () => {
    switch (currentStepId) {
      case 'service':
        return <ProjectTypeStep selectedType={input.projectType} onSelect={handleProjectTypeChange} />;
      case 'platforms':
        return <PlatformStep selectedPlatforms={input.platforms ?? []} onTogglePlatform={handlePlatformToggle} />;
      case 'scope':
        return (
          <ScopeStep
            projectType={input.projectType}
            selectedComplexity={input.complexity}
            selectedSubtype={input.subtype}
            onComplexityChange={handleComplexityChange}
            onSubtypeChange={handleSubtypeChange}
          />
        );
      case 'features':
        return (
          <FeaturesStep
            projectType={input.projectType}
            subtype={input.subtype}
            selectedFeatures={input.features}
            onToggleFeature={handleFeatureToggle}
          />
        );
      case 'scale':
        return <PagesStep pageCount={input.pages} onPageCountChange={handlePageCountChange} />;
      case 'advanced':
        return (
          <TechStackStep
            projectType={input.projectType}
            subtype={input.subtype}
            selectedTech={input.techStack ?? []}
            onToggleTech={handleTechToggle}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className='container mx-auto py-10'>
      <h1 className='text-2xl font-bold mb-4'>{t('title')}</h1>

      <div className='mb-6'>
        <p>
          Step {step + 1} of {maxSteps}: <strong>{(t as (k: string) => string)(STEP_LABELS[currentStepId] ?? currentStepId)}</strong>
        </p>
        <div className='border rounded p-6 mt-4'>{renderCurrentStep()}</div>
      </div>

      <div className='flex gap-4'>
        {step > 0 && (
          <Button onClick={() => setStep(s => s - 1)} className='bg-gray-200 text-gray-800'>
            {t('back')}
          </Button>
        )}
        {!isLastStep ? (
          <Button onClick={() => setStep(s => s + 1)}>{t('next')}</Button>
        ) : (
          <Button onClick={fetchAIEstimate} disabled={loading}>
            {loading ? t('calculating') : t('getEstimate')}
          </Button>
        )}
      </div>

      <ResultDisplay
        result={estimate ?? localEstimate ?? defaultEstimate}
        source={estimateSource}
        loading={loading}
        error={error}
        aiReasoning={aiReasoning}
        onReset={handleReset}
      />
    </div>
  );
}
