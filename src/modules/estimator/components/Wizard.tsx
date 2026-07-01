'use client';

import Button from '@/shared/components/Button';
import {
  FeaturesStep,
  PagesStep,
  PlatformStep,
  ProjectTypeStep,
  ResultDisplay,
  ScopeStep,
  TechStackStep,
} from '@/modules/estimator/components';
import LivePreview from './LivePreview';
import { useCurrency } from './CurrencySwitcher';
import { logger } from '@/core/logger';
import { getEstimate } from '@/modules/estimator/api';
import type { EstimateResult, EstimatorInput } from '@/modules/estimator/types';
import { calculateEstimate } from '@/modules/estimator/utils/estimator';
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
  // next-intl types t() to literal keys; STEP_LABELS values are dynamic.
  const tLabel = t as (key: string) => string;
  const { currency, setCurrency, format } = useCurrency();

  const [step, setStep] = useState(0);
  const [input, setInput] = useState<EstimatorInput>({
    projectType: 'mobile',
    complexity: 'mvp',
    features: [],
    pages: 1,
    platforms: [],
    techStack: [],
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

  const resultIndex = steps.length; // the trailing "Estimate" step
  const isResultStep = step >= resultIndex;
  const isLastInputStep = step === steps.length - 1;
  const progress = Math.round((Math.min(step, resultIndex) / resultIndex) * 100);

  const fetchAIEstimate = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getEstimate(input);

      if (response.success && response.data) {
        setEstimate(response.data);
        setEstimateSource(response.data.source);
        if (response.data.reasoning) setAiReasoning(response.data.reasoning);
        if (response.data.source === 'formula') {
          setError(t('errorFormulaFallback'));
        }
      } else {
        setEstimate(calculateEstimate(input));
        setEstimateSource('formula');
        setError(t('errorApiFallback'));
      }
    } catch (err) {
      logger.error('Estimate API failed', err, 'ESTIMATOR');
      setEstimate(calculateEstimate(input));
      setEstimateSource('formula');
      setError(t('errorCalcFallback'));
    } finally {
      setLoading(false);
    }
  };

  const gotoStep = (i: number) => {
    setStep(i);
    if (i >= resultIndex && !loading) fetchAIEstimate();
  };

  const next = () => {
    if (isLastInputStep) gotoStep(resultIndex);
    else setStep(s => s + 1);
  };

  const back = () => setStep(s => Math.max(0, s - 1));

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
      techStack: current.includes(tech) ? current.filter(x => x !== tech) : [...current, tech],
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

  const railItems = [...steps.map(id => ({ id, label: tLabel(STEP_LABELS[id]) })), { id: 'result', label: t('stepEstimate') }];

  return (
    <div className='page-layout container mx-auto pb-16'>
      {/* Header */}
      <div className='text-center max-w-2xl mx-auto mb-10'>
        <div className='uppercase tracking-[0.2em] text-xs font-bold text-ember-accent mb-3'>{t('eyebrow')}</div>
        <h1 className='font-display text-4xl md:text-5xl font-extrabold tracking-tight text-ember-text mb-3'>{t('headline')}</h1>
        <p className='text-ember-muted'>{t('subtitle')}</p>
      </div>

      {/* 3-column wizard */}
      <div className='grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_320px] gap-6 lg:gap-7 items-start'>
        {/* Step rail */}
        <aside className='hidden lg:flex flex-col gap-1.5 lg:sticky lg:top-28'>
          {railItems.map((item, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={item.id}
                type='button'
                onClick={() => gotoStep(i)}
                aria-current={active}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-colors ${
                  active ? 'bg-ember-surface border border-ember-accent' : 'border border-transparent hover:bg-ember-surface'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    active
                      ? 'bg-ember-accent text-[#0a0705]'
                      : done
                        ? 'bg-[rgba(255,91,30,0.2)] text-ember-accent'
                        : 'bg-ember-surface2 text-ember-muted'
                  }`}
                >
                  {i + 1}
                </span>
                <span className='text-sm font-semibold text-ember-text'>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Step body */}
        <div className='rounded-3xl border border-ember-border p-6 sm:p-8 bg-[linear-gradient(160deg,var(--surface2),var(--bg2))] min-h-[440px]'>
          <div className='lg:hidden text-sm text-ember-muted mb-3'>
            {isResultStep ? t('stepEstimate') : t('stepProgress', { current: step + 1, total: steps.length })}
          </div>

          <div className='h-1 rounded-full bg-ember-surface overflow-hidden mb-7'>
            <div
              className='h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent2))] transition-[width] duration-500 ease-out'
              style={{ width: `${progress}%` }}
            />
          </div>

          {isResultStep ? (
            <ResultDisplay
              result={estimate ?? localEstimate}
              source={estimateSource}
              loading={loading}
              error={error}
              aiReasoning={aiReasoning}
              onReset={handleReset}
              format={format}
            />
          ) : (
            renderCurrentStep()
          )}

          {!isResultStep && (
            <div className='flex justify-between items-center mt-8 pt-6 border-t border-ember-border'>
              {step > 0 ? (
                <Button onClick={back} className='!bg-transparent !border !border-ember-border !text-ember-text !rounded-full'>
                  ← {t('back')}
                </Button>
              ) : (
                <span />
              )}
              <Button
                onClick={next}
                className='!bg-ember-accent !text-[#0a0705] font-bold !rounded-full hover:shadow-[0_0_28px_var(--glow)]'
              >
                {isLastInputStep ? `${t('seeEstimate')} →` : `${t('next')} →`}
              </Button>
            </div>
          )}
        </div>

        {/* Live estimate panel */}
        <LivePreview estimate={localEstimate} input={input} format={format} currency={currency} setCurrency={setCurrency} />
      </div>
    </div>
  );
}
