'use client';

import { getEstimate } from '@/modules/estimator/api';
import type { DesignStatus, EstimatorInput, MobileApproach, Platform, ProjectType, Tier, Urgency } from '@/modules/estimator/types';
import { calculateEstimate } from '@/modules/estimator/utils/estimator';
import { sanitizeEstimatorInput } from '@/modules/estimator/utils/sanitize';
import {
  initialInput,
  selectProjectType,
  selectSubtype,
  setApproach,
  setAutoTech,
  setDescription,
  setDesign,
  setLanguages,
  setScreens,
  setTier,
  setUrgency,
  toggleFeature,
  toggleIntegration,
  togglePlatform,
  toggleTech,
} from '@/modules/estimator/utils/wizardState';
import { Arrow, buttonClass, Container, Page, PageHero } from '@/shared/components/site';
import { trackEvent } from '@/shared/utils/analytics';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrency } from './CurrencySwitcher';
import LivePreview from './LivePreview';
import ResultPanel, { type AiState } from './ResultPanel';
import { DetailsStep, FeaturesStep, IntegrationsStep, ScopeStep, TechStep, TypeStep } from './Steps';
import css from './Wizard.module.css';

type StepId = 'type' | 'scope' | 'features' | 'integrations' | 'tech' | 'details';
const STEPS: StepId[] = ['type', 'scope', 'features', 'integrations', 'tech', 'details'];

const STORAGE_KEY = 'estimator-state-v2';

/**
 * Identity of a configuration for AI-caching purposes. The id arrays are built
 * in click order, so `['push','search']` and `['search','push']` are the same
 * project — sorting them stops "untick, re-tick" from looking like a brand new
 * configuration and re-rolling the AI's numbers.
 */
function configKey(input: EstimatorInput, locale: string): string {
  return JSON.stringify({
    ...input,
    features: [...input.features].sort(),
    integrations: [...input.integrations].sort(),
    techStack: [...input.techStack].sort(),
    locale,
  });
}

export default function Wizard() {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const locale = useLocale();
  const { currency, setCurrency, format, available } = useCurrency();

  const [step, setStep] = useState(0);
  const [input, setInput] = useState<EstimatorInput>(initialInput);
  const [aiState, setAiState] = useState<AiState>({ status: 'loading' });

  const startedRef = useRef(false);
  const hydratedRef = useRef(false);
  const shouldFocusResultRef = useRef(false);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const completedKeyRef = useRef('');
  const aiFetchKeyRef = useRef('');
  const aiAbortRef = useRef<AbortController | null>(null);
  // One AI answer per configuration, for the life of the page. Re-entering the
  // result step used to fire a fresh paid call, so an unchanged project came
  // back with a different "AI second opinion" every time — and ten of those
  // inside a minute tripped the endpoint's own rate limit.
  const aiCacheRef = useRef(new Map<string, AiState>());

  const resultIndex = STEPS.length;
  const isResultStep = step >= resultIndex;

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
          // `<= resultIndex`: someone who reloads while reading their estimate
          // should get their estimate back, not the Details form.
          if (Number.isInteger(parsed.step) && (parsed.step as number) >= 0 && (parsed.step as number) <= resultIndex) {
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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ input, step: Math.min(step, resultIndex) }));
    } catch {
      /* storage full/blocked — persistence is best-effort */
    }
  }, [input, step, resultIndex]);

  // The button that led here unmounts: keyboard and screen reader continue at the result (not on a restored session).
  useEffect(() => {
    if (!isResultStep || !shouldFocusResultRef.current) return;
    shouldFocusResultRef.current = false;
    resultHeadingRef.current?.focus({ preventScroll: true });
  }, [isResultStep]);

  // AI refinement: fires when the user reaches the result; the formula range
  // is already on screen, so this is pure enrichment (never blocks the UX).
  useEffect(() => {
    if (!isResultStep) return;
    const key = configKey(input, locale);

    const cached = aiCacheRef.current.get(key);
    if (cached) {
      setAiState(cached);
      return;
    }
    if (aiFetchKeyRef.current === key) return;
    aiFetchKeyRef.current = key;

    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;

    setAiState({ status: 'loading' });
    getEstimate(input, locale, controller.signal).then(res => {
      if (controller.signal.aborted) return;
      const next: AiState = res.success && res.data?.ai ? { status: 'ready', ai: res.data.ai } : { status: 'unavailable' };
      aiCacheRef.current.set(key, next);
      setAiState(next);
      trackEvent('estimator_ai', { status: next.status === 'ready' ? 'ok' : res.success ? 'unavailable' : 'error' });
    });

    return () => {
      controller.abort();
      // An aborted fetch left aiState at 'loading'; clear the dedupe key so
      // re-entering the result step retries instead of hanging forever.
      if (aiFetchKeyRef.current === key) aiFetchKeyRef.current = '';
    };
  }, [isResultStep, input, locale]);

  /**
   * Single entry point for state changes: every transition is a pure reducer
   * from `utils/wizardState`, so the wizard can never build an input the
   * pricing formula would silently ignore.
   */
  const update = (transition: (prev: EstimatorInput) => EstimatorInput) => {
    // Compute the next value eagerly so the start event carries the type the
    // user actually picked (not the pre-click default, which skews to 'mobile').
    const next = transition(input);
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent('estimator_start', { projectType: next.projectType, locale });
    }
    setInput(next);
  };

  const gotoStep = (i: number) => {
    setStep(i);
    shouldFocusResultRef.current = i >= resultIndex;
    if (i >= resultIndex) {
      // Once per configuration — re-entering the result after "back" is not a
      // new completion.
      const key = JSON.stringify(input);
      if (completedKeyRef.current !== key) {
        completedKeyRef.current = key;
        trackEvent('estimator_complete', { projectType: input.projectType, subtype: input.subtype, tier: input.tier, locale });
      }
    }
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: isReduced ? 'auto' : 'smooth' });
  };

  const handleReset = () => {
    setStep(0);
    setInput(initialInput());
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
        return (
          <TypeStep
            input={input}
            onTypeSelect={(type: ProjectType) => update(prev => selectProjectType(prev, type))}
            onSubtypeSelect={(subtype: string) => update(prev => selectSubtype(prev, subtype))}
          />
        );
      case 'scope':
        return (
          <ScopeStep
            input={input}
            onTogglePlatform={(platform: Platform) => update(prev => togglePlatform(prev, platform))}
            onApproachChange={(approach: MobileApproach) => update(prev => setApproach(prev, approach))}
            onTierChange={(tier: Tier) => update(prev => setTier(prev, tier))}
            onScreensChange={screens => update(prev => setScreens(prev, screens))}
          />
        );
      case 'features':
        return <FeaturesStep input={input} format={format} onToggleFeature={id => update(prev => toggleFeature(prev, id))} />;
      case 'integrations':
        return <IntegrationsStep input={input} format={format} onToggleIntegration={id => update(prev => toggleIntegration(prev, id))} />;
      case 'tech':
        return <TechStep input={input} onAutoTech={() => update(setAutoTech)} onToggleTech={id => update(prev => toggleTech(prev, id))} />;
      case 'details':
        return (
          <DetailsStep
            input={input}
            onDesignChange={(design: DesignStatus) => update(prev => setDesign(prev, design))}
            onLanguagesChange={languages => update(prev => setLanguages(prev, languages))}
            onUrgencyChange={(urgency: Urgency) => update(prev => setUrgency(prev, urgency))}
            onDescriptionChange={description => update(prev => setDescription(prev, description))}
          />
        );
      default:
        return null;
    }
  };

  const railItems = [...STEPS.map(id => ({ id, label: tx(`step.${id}`) })), { id: 'result', label: t('step.result') }];

  return (
    <Page className={css.page}>
      <div className={css.intro} data-started={step > 0 || undefined}>
        <PageHero eyebrow={t('eyebrow')} title={t('headline')} lead={t('subtitle')} />
      </div>

      <Container className={css.layout}>
        {/* Step rail (desktop) */}
        <div data-testid='step-rail' className={css.rail}>
          {railItems.map((item, i) => (
            <button
              key={item.id}
              type='button'
              onClick={() => gotoStep(i)}
              aria-current={i === step ? 'step' : undefined}
              data-state={i === step ? 'active' : i < step ? 'done' : 'todo'}
              className={css.stop}
            >
              <span className={css.num} aria-hidden>
                {i + 1}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Step body */}
        <div data-testid='step-body' className={css.body}>
          <p className={css.progress}>{isResultStep ? t('step.result') : t('stepProgress', { current: step + 1, total: STEPS.length })}</p>
          <div className={css.bar} aria-hidden>
            {STEPS.map((id, i) => (
              <i key={id} data-on={i <= step || undefined} />
            ))}
          </div>

          {isResultStep ? (
            <ResultPanel
              headingRef={resultHeadingRef}
              input={input}
              estimate={estimate}
              aiState={aiState}
              format={format}
              currency={currency}
              available={available}
              setCurrency={setCurrency}
              onBack={() => gotoStep(resultIndex - 1)}
              onReset={handleReset}
            />
          ) : (
            <>
              {renderStep()}

              <div className={css.nav}>
                {step > 0 ? (
                  <button type='button' onClick={() => gotoStep(step - 1)} className={buttonClass('secondary', css.back)}>
                    <Arrow /> {t('back')}
                  </button>
                ) : (
                  <span />
                )}
                <button type='button' onClick={() => gotoStep(step + 1)} className={buttonClass()}>
                  {step === STEPS.length - 1 ? t('seeEstimate') : t('next')} <Arrow />
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
      </Container>

      {/* Below 1280px, a fixed bottom bar: live range + primary action, always thumb-reachable */}
      {!isResultStep && (
        <div data-testid='mobile-bar' className={css.dock}>
          <div className={css.dockInner}>
            <div className={css.dockPrice}>
              <div className={css.dockLabel}>{t('liveEstimate')}</div>
              <div data-testid='live-range' className={css.dockRange}>
                <span>{format(estimate.cost.min)} –</span> <span>{format(estimate.cost.max)}</span>
              </div>
            </div>
            <div className={css.dockActions}>
              {step > 0 && (
                <button
                  type='button'
                  onClick={() => gotoStep(step - 1)}
                  aria-label={t('back')}
                  className={buttonClass('secondary', css.back)}
                >
                  <Arrow />
                </button>
              )}
              <button type='button' onClick={() => gotoStep(step + 1)} className={buttonClass()}>
                {step === STEPS.length - 1 ? t('seeEstimate') : t('next')} <Arrow />
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
