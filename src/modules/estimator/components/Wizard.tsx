'use client';

import { getEstimate } from '@/modules/estimator/api';
import { applySubtype, defaultInputFor } from '@/modules/estimator/data/catalog';
import type { DesignStatus, EstimatorInput, MobileApproach, Platform, ProjectType, Tier, Urgency } from '@/modules/estimator/types';
import { calculateEstimate } from '@/modules/estimator/utils/estimator';
import { sanitizeEstimatorInput } from '@/modules/estimator/utils/sanitize';
import { trackEvent } from '@/shared/utils/analytics';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrency } from './CurrencySwitcher';
import LivePreview from './LivePreview';
import ResultPanel, { type AiState } from './ResultPanel';
import { DetailsStep, FeaturesStep, IntegrationsStep, ScopeStep, TechStep, TypeStep } from './Steps';

type StepId = 'type' | 'scope' | 'features' | 'integrations' | 'tech' | 'details';
const STEPS: StepId[] = ['type', 'scope', 'features', 'integrations', 'tech', 'details'];

const STORAGE_KEY = 'estimator-state-v2';

export default function Wizard() {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const locale = useLocale();
  const { currency, setCurrency, format, available } = useCurrency();

  const [step, setStep] = useState(0);
  const [input, setInput] = useState<EstimatorInput>(() => defaultInputFor('mobile'));
  const [aiState, setAiState] = useState<AiState>({ status: 'loading' });

  const startedRef = useRef(false);
  const hydratedRef = useRef(false);
  const completedKeyRef = useRef('');
  const aiFetchKeyRef = useRef('');
  const aiAbortRef = useRef<AbortController | null>(null);

  const resultIndex = STEPS.length;
  const isResultStep = step >= resultIndex;
  const progress = Math.round((Math.min(step, resultIndex) / resultIndex) * 100);

  const estimate = useMemo(() => calculateEstimate(input), [input]);

  // Hydrate a previous session (client-only to avoid SSR mismatch); the stored
  // blob goes through the same sanitizer the API uses, so stale/garbled state
  // degrades to defaults instead of crashing the wizard.
  useEffect(() => {
    // StrictMode runs this twice; the second pass must not re-read storage the
    // persist effect may have touched in between.
    if (hydratedRef.current) return;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { input?: unknown; step?: number };
        const restored = sanitizeEstimatorInput(parsed.input);
        if (restored) {
          setInput(restored);
          if (Number.isInteger(parsed.step) && (parsed.step as number) >= 0 && (parsed.step as number) < resultIndex) {
            setStep(parsed.step as number);
          }
        }
      }
    } catch {
      /* corrupted state — start fresh */
    }
    // Gate the persist effect until restore ran: under StrictMode's double
    // effects, persisting first would overwrite the saved session with defaults.
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ input, step: Math.min(step, resultIndex - 1) }));
    } catch {
      /* storage full/blocked — persistence is best-effort */
    }
  }, [input, step, resultIndex]);

  // AI refinement: fires when the user reaches the result; the formula range
  // is already on screen, so this is pure enrichment (never blocks the UX).
  useEffect(() => {
    if (!isResultStep) return;
    const key = JSON.stringify({ input, locale });
    if (aiFetchKeyRef.current === key) return;
    aiFetchKeyRef.current = key;

    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;

    setAiState({ status: 'loading' });
    getEstimate(input, locale, controller.signal).then(res => {
      if (controller.signal.aborted) return;
      if (res.success && res.data?.ai) {
        setAiState({ status: 'ready', ai: res.data.ai });
        trackEvent('estimator_ai', { status: 'ok' });
      } else {
        setAiState({ status: 'unavailable' });
        trackEvent('estimator_ai', { status: res.success ? 'unavailable' : 'error' });
      }
    });

    return () => {
      controller.abort();
      // An aborted fetch left aiState at 'loading'; clear the dedupe key so
      // re-entering the result step retries instead of hanging forever.
      if (aiFetchKeyRef.current === key) aiFetchKeyRef.current = '';
    };
  }, [isResultStep, input, locale]);

  const update = (patch: Partial<EstimatorInput> | ((prev: EstimatorInput) => EstimatorInput)) => {
    // Compute the next value eagerly so the start event carries the type the
    // user actually picked (not the pre-click default, which skews to 'mobile').
    const next = typeof patch === 'function' ? patch(input) : { ...input, ...patch };
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent('estimator_start', { projectType: next.projectType, locale });
    }
    setInput(next);
  };

  const gotoStep = (i: number) => {
    setStep(i);
    if (i >= resultIndex) {
      // Once per configuration — re-entering the result after "back" is not a
      // new completion.
      const key = JSON.stringify(input);
      if (completedKeyRef.current !== key) {
        completedKeyRef.current = key;
        trackEvent('estimator_complete', { projectType: input.projectType, subtype: input.subtype, tier: input.tier, locale });
      }
    }
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTypeSelect = (type: ProjectType) => {
    if (type === input.projectType) return;
    update(prev => ({ ...defaultInputFor(type), description: prev.description }));
  };

  const handleSubtypeSelect = (subtype: string) => update(prev => applySubtype(prev, subtype));

  const handleTogglePlatform = (platform: Platform) =>
    update(prev => {
      const has = prev.platforms.includes(platform);
      // Never allow zero platforms — the engine would silently price "both".
      if (has && prev.platforms.length === 1) return prev;
      return { ...prev, platforms: has ? prev.platforms.filter(p => p !== platform) : [...prev.platforms, platform] };
    });

  const handleToggle = (field: 'features' | 'integrations') => (id: string) =>
    update(prev => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter(x => x !== id) : [...prev[field], id],
    }));

  const handleToggleTech = (id: string) =>
    update(prev => ({
      ...prev,
      autoTech: false,
      techStack: prev.techStack.includes(id) ? prev.techStack.filter(x => x !== id) : [...prev.techStack, id],
    }));

  const handleAutoTech = () => update(prev => ({ ...prev, autoTech: !prev.autoTech, techStack: [] }));

  const handleReset = () => {
    setStep(0);
    setInput(defaultInputFor('mobile'));
    setAiState({ status: 'loading' });
    aiFetchKeyRef.current = '';
    completedKeyRef.current = '';
    startedRef.current = false;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const renderStep = () => {
    switch (STEPS[step]) {
      case 'type':
        return <TypeStep input={input} onTypeSelect={handleTypeSelect} onSubtypeSelect={handleSubtypeSelect} />;
      case 'scope':
        return (
          <ScopeStep
            input={input}
            onTogglePlatform={handleTogglePlatform}
            onApproachChange={(approach: MobileApproach) => update({ approach })}
            onTierChange={(tier: Tier) => update({ tier })}
            onScreensChange={screens => update({ screens })}
          />
        );
      case 'features':
        return <FeaturesStep input={input} onToggleFeature={handleToggle('features')} />;
      case 'integrations':
        return <IntegrationsStep input={input} onToggleIntegration={handleToggle('integrations')} />;
      case 'tech':
        return <TechStep input={input} onAutoTech={handleAutoTech} onToggleTech={handleToggleTech} />;
      case 'details':
        return (
          <DetailsStep
            input={input}
            onDesignChange={(design: DesignStatus) => update({ design })}
            onLanguagesChange={languages => update({ languages })}
            onUrgencyChange={(urgency: Urgency) => update({ urgency })}
            onDescriptionChange={description => update({ description })}
          />
        );
      default:
        return null;
    }
  };

  const railItems = [...STEPS.map(id => ({ id, label: tx(`step.${id}`) })), { id: 'result', label: t('step.result') }];

  return (
    <div className='page-layout container mx-auto pb-28 xl:pb-16'>
      {/* Header */}
      <div className='text-center max-w-2xl mx-auto mb-10'>
        <div className='uppercase tracking-[0.2em] text-xs font-bold text-ember-accent mb-3'>{t('eyebrow')}</div>
        <h1 className='font-display text-4xl md:text-5xl font-extrabold tracking-tight text-ember-text mb-3'>{t('headline')}</h1>
        <p className='text-ember-muted'>{t('subtitle')}</p>
      </div>

      {/* 3-column wizard */}
      <div className='grid grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)_320px] gap-6 xl:gap-7 items-start'>
        {/* Step rail */}
        <aside className='hidden xl:flex flex-col gap-1.5 xl:sticky xl:top-28'>
          {railItems.map((item, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={item.id}
                type='button'
                onClick={() => gotoStep(i)}
                aria-current={active}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-colors cursor-pointer ${
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
                  {done ? '✓' : i + 1}
                </span>
                <span className='text-sm font-semibold text-ember-text'>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Step body */}
        <div className='rounded-3xl border border-ember-border p-5 sm:p-8 bg-[linear-gradient(160deg,var(--surface2),var(--bg2))] min-h-[440px]'>
          <div className='xl:hidden text-sm text-ember-muted mb-3'>
            {isResultStep ? t('step.result') : t('stepProgress', { current: step + 1, total: STEPS.length })}
          </div>

          <div className='h-1 rounded-full bg-ember-surface overflow-hidden mb-7'>
            <div
              className='h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent2))] transition-[width] duration-500 ease-out'
              style={{ width: `${progress}%` }}
            />
          </div>

          {isResultStep ? (
            <ResultPanel
              input={input}
              estimate={estimate}
              aiState={aiState}
              format={format}
              currency={currency}
              available={available}
              setCurrency={setCurrency}
              onReset={handleReset}
            />
          ) : (
            <>
              {renderStep()}

              <div className='hidden xl:flex justify-between items-center mt-8 pt-6 border-t border-ember-border'>
                {step > 0 ? (
                  <button
                    type='button'
                    onClick={() => gotoStep(step - 1)}
                    className='px-6 py-2.5 rounded-full border border-ember-border text-ember-text text-sm font-semibold hover:border-ember-accent transition-colors cursor-pointer'
                  >
                    ← {t('back')}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type='button'
                  onClick={() => gotoStep(step + 1)}
                  className='px-7 py-2.5 rounded-full bg-ember-accent text-[#0a0705] font-bold text-sm hover:shadow-[0_0_28px_var(--glow)] transition-shadow cursor-pointer'
                >
                  {step === STEPS.length - 1 ? `${t('seeEstimate')} →` : `${t('next')} →`}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Live estimate panel (desktop) */}
        <LivePreview
          estimate={estimate}
          input={input}
          format={format}
          currency={currency}
          available={available}
          setCurrency={setCurrency}
        />
      </div>

      {/* Mobile sticky bottom bar: live range + primary action, always thumb-reachable */}
      {!isResultStep && (
        <div className='xl:hidden fixed bottom-0 inset-x-0 z-40 border-t border-ember-border bg-[color:var(--surface)]/95 backdrop-blur px-4 py-3'>
          <div className='flex items-center justify-between gap-3 max-w-xl mx-auto'>
            <div className='min-w-0'>
              <div className='text-[11px] uppercase tracking-wide font-bold text-ember-muted'>{t('liveEstimate')}</div>
              <div className='font-display font-extrabold text-ember-accent text-lg leading-tight truncate'>
                {format(estimate.cost.min)} – {format(estimate.cost.max)}
              </div>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              {step > 0 && (
                <button
                  type='button'
                  onClick={() => gotoStep(step - 1)}
                  aria-label={t('back')}
                  className='w-11 h-11 rounded-full border border-ember-border text-ember-text font-bold cursor-pointer'
                >
                  ←
                </button>
              )}
              <button
                type='button'
                onClick={() => gotoStep(step + 1)}
                className='px-5 h-11 rounded-full bg-ember-accent text-[#0a0705] font-bold text-sm cursor-pointer'
              >
                {step === STEPS.length - 1 ? t('seeEstimate') : t('next')} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
