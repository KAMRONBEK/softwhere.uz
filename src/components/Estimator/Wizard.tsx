'use client';

import Button from '@/components/Button';
import {
  ComplexityStep,
  FeaturesStep,
  PagesStep,
  PlatformStep,
  ProjectTypeStep,
  ResultDisplay,
  TechStackStep,
} from '@/components/Estimator';
import { api } from '@/core/api';
import type { EstimateResult, EstimatorInput, FeatureKey, TechnologyKey } from '@/types/estimator';
import { calculateEstimate } from '@/utils/estimator';
import { useMemo, useState } from 'react';

// Step definitions
const steps = ['Project Type', 'Platforms', 'Complexity', 'Features', 'Pages', 'Advanced'];

export default function Wizard() {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<EstimatorInput>({
    projectType: 'mobile',
    complexity: 'mvp',
    features: [],
    pages: 1,
    platforms: [],
    techStack: [],
  });

  // Initialize with a default estimate
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

  // Local estimate for responsive UI feedback - use useMemo to avoid recalculating on every render
  const localEstimate = useMemo(() => {
    const estimate = calculateEstimate(input);

    console.log('Local estimate calculated:', estimate);

    return estimate;
  }, [input]);

  const fetchAIEstimate = async () => {
    setLoading(true);
    setError('');

    try {
      // Get the API response
      const response = await api.estimator.getEstimate(input);

      console.log('API Response:', response);

      if (response.success && response.data) {
        // The response.data already contains the estimate structure we need
        console.log('Response data to use:', response.data);

        // Use the data directly
        setEstimate(response.data);
        setEstimateSource(response.data.source);

        if (response.data.reasoning) {
          setAiReasoning(response.data.reasoning);
        }

        // If it's a formula response, show a message
        if (response.data.source === 'formula') {
          setError('Using formula calculation (AI estimate was not available).');
        }
      } else {
        // API call failed
        const formulaEstimate = calculateEstimate(input);

        setEstimate(formulaEstimate);
        setEstimateSource('formula');
        setError('Could not get estimate from API. Using local calculation.');
      }
    } catch (err) {
      // On error, use the formula calculation
      const formulaEstimate = calculateEstimate(input);

      setEstimate(formulaEstimate);
      setEstimateSource('formula');
      setError('Error calculating estimate. Using local calculation.');
    } finally {
      setLoading(false);
    }
  };

  // Event handlers for step components
  const handleProjectTypeChange = (type: EstimatorInput['projectType']) => {
    setInput(prev => ({ ...prev, projectType: type }));
  };

  const handlePlatformToggle = (platform: 'ios' | 'android') => {
    const current = input.platforms || [];

    setInput(prev => ({
      ...prev,
      platforms: current.includes(platform) ? current.filter(p => p !== platform) : [...current, platform],
    }));
  };

  const handleComplexityChange = (complexity: EstimatorInput['complexity']) => {
    setInput(prev => ({ ...prev, complexity }));
  };

  const handleFeatureToggle = (feature: FeatureKey) => {
    setInput(prev => ({
      ...prev,
      features: prev.features.includes(feature) ? prev.features.filter(f => f !== feature) : [...prev.features, feature],
    }));
  };

  const handlePageCountChange = (count: number) => {
    setInput(prev => ({ ...prev, pages: count }));
  };

  const handleTechToggle = (tech: TechnologyKey) => {
    const current = input.techStack || [];

    setInput(prev => ({
      ...prev,
      techStack: current.includes(tech) ? current.filter(t => t !== tech) : [...current, tech],
    }));
  };

  // Reset the wizard
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

  // Determine if we should skip the platform step
  const shouldShowPlatformStep = input.projectType === 'mobile';

  // Show current step
  const renderCurrentStep = () => {
    switch (step) {
      case 0:
        return <ProjectTypeStep selectedType={input.projectType} onSelect={handleProjectTypeChange} />;
      case 1:
        // Skip platform step if not mobile
        if (!shouldShowPlatformStep) {
          return <ComplexityStep selectedComplexity={input.complexity} onSelect={handleComplexityChange} />;
        }

        return <PlatformStep selectedPlatforms={input.platforms || []} onTogglePlatform={handlePlatformToggle} />;
      case 2:
        // Adjust for platform step skip
        if (!shouldShowPlatformStep) {
          return <FeaturesStep selectedFeatures={input.features} onToggleFeature={handleFeatureToggle} />;
        }

        return <ComplexityStep selectedComplexity={input.complexity} onSelect={handleComplexityChange} />;
      case 3:
        // Adjust for platform step skip
        if (!shouldShowPlatformStep) {
          return <PagesStep pageCount={input.pages} onPageCountChange={handlePageCountChange} />;
        }

        return <FeaturesStep selectedFeatures={input.features} onToggleFeature={handleFeatureToggle} />;
      case 4:
        // Adjust for platform step skip
        if (!shouldShowPlatformStep) {
          return <TechStackStep selectedTech={input.techStack || []} onToggleTech={handleTechToggle} />;
        }

        return <PagesStep pageCount={input.pages} onPageCountChange={handlePageCountChange} />;
      case 5:
        return <TechStackStep selectedTech={input.techStack || []} onToggleTech={handleTechToggle} />;
      default:
        return null;
    }
  };

  // Adjust navigation based on platform step
  const getMaxSteps = () => {
    return shouldShowPlatformStep ? steps.length : steps.length - 1;
  };

  const isLastStep = step === getMaxSteps() - 1;

  const handleNext = () => {
    if (step < getMaxSteps() - 1) {
      setStep(s => s + 1);
    }
  };

  return (
    <div className='container mx-auto py-10'>
      <h1 className='text-2xl font-bold mb-4'>Project Estimator (alpha)</h1>

      <div className='mb-6'>
        <p>
          Step {step + 1} of {getMaxSteps()}: <strong>{steps[step]}</strong>
        </p>
        <div className='border rounded p-6 mt-4'>{renderCurrentStep()}</div>
      </div>

      <div className='flex gap-4'>
        {step > 0 && (
          <Button onClick={() => setStep(s => s - 1)} className='bg-gray-200 text-gray-800'>
            Back
          </Button>
        )}
        {!isLastStep ? (
          <Button onClick={handleNext}>Next</Button>
        ) : (
          <Button onClick={fetchAIEstimate} disabled={loading}>
            {loading ? 'Calculating...' : 'Get AI-Powered Estimate'}
          </Button>
        )}
      </div>

      {/* Live result */}
      <ResultDisplay
        result={estimate || localEstimate || defaultEstimate}
        source={estimateSource}
        loading={loading}
        error={error}
        aiReasoning={aiReasoning}
        onReset={handleReset}
      />
    </div>
  );
}
