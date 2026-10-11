'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import type { CSSProperties } from 'react';
import type { BriefPhase, DiscoveryPhase } from '@/modules/estimator/ai-brief/types';
import css from './brief.module.css';

type BriefTimelineProps = {
  /** Engine phases with weeks; a discovery-call brief's phases have none (no pace is promised). */
  phases: readonly (BriefPhase | DiscoveryPhase)[];
  /** Phase titles, goals and deliverables arrive with the narrative; weeks are known earlier. */
  hasText: boolean;
};

const hasWeeks = (phase: BriefPhase | DiscoveryPhase): phase is BriefPhase => 'weeks' in phase && !!phase.weeks;

/** A phase's title, goal and deliverables (a skeleton until the narrative arrives). */
function PhaseBody({ phase, hasText }: { phase: BriefPhase | DiscoveryPhase; hasText: boolean }) {
  if (hasText && phase.title)
    return (
      <div className={css.phaseBody}>
        <h4 className={css.phaseTitle}>{phase.title}</h4>
        {phase.goal && <p className={css.phaseGoal}>{phase.goal}</p>}
        {phase.deliverables.length > 0 && (
          <ul className={css.deliverables}>
            {phase.deliverables.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    );
  if (hasText) return null;
  return (
    <div className={css.phaseBody} aria-hidden>
      <span className={`${css.skel} ${css.skelLine} ${css.skelShort}`} />
      <span className={`${css.skel} ${css.skelLine}`} />
    </div>
  );
}

/** A discovery-call brief: the phases in order, with no durations or week axis. */
function PhaseList({ phases, hasText }: BriefTimelineProps) {
  const t = useTranslations('aiBrief');
  const headingId = useId();
  return (
    <section className={css.planSection} aria-labelledby={headingId}>
      <h3 id={headingId} className={css.sectionTitle}>
        {t('result.phases')}
      </h3>
      <ol className={css.timeline}>
        {phases.map((phase, i) => (
          <li key={phase.id} className={css.phase}>
            <div className={css.phaseHead}>
              <span className={css.phaseIndex}>{t('result.phase', { n: i + 1 })}</span>
            </div>
            <PhaseBody phase={phase} hasText={hasText} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Axis ticks every 2/4/8 weeks so there are never more than ~7 labels. */
function tickStep(total: number): number {
  if (total <= 12) return 2;
  if (total <= 28) return 4;
  return 8;
}

/**
 * Phases on one week axis. Each bar is solid for its shortest duration and
 * hatched up to its longest, and the next phase starts where the previous
 * one can end at the earliest — the engine gives ranges, so the chart does.
 */
export default function BriefTimeline({ phases: allPhases, hasText }: BriefTimelineProps) {
  const t = useTranslations('aiBrief');
  const headingId = useId();
  if (allPhases.length === 0) return null;
  const phases = allPhases.filter(hasWeeks);
  if (phases.length < allPhases.length) return <PhaseList phases={allPhases} hasText={hasText} />;

  // Phase n starts where phase n-1 can end at the earliest; each bar is its own min (solid) to max (hatched).
  type Row = { phase: BriefPhase; start: number; solidEnd: number; end: number };
  const rows = phases.reduce<Row[]>((acc, phase) => {
    const start = acc[acc.length - 1]?.solidEnd ?? 0;
    return [...acc, { phase, start, solidEnd: start + phase.weeks.min, end: start + phase.weeks.max }];
  }, []);
  const endMax = Math.max(0, ...rows.map(row => row.end));
  const total = Math.max(1, endMax);
  const step = tickStep(total);
  const ticks = Array.from({ length: Math.floor(total / step) }, (_, i) => (i + 1) * step);
  const pct = (weeks: number) => `${(weeks / total) * 100}%`;

  return (
    <section className={css.planSection} aria-labelledby={headingId}>
      <h3 id={headingId} className={css.sectionTitle}>
        {t('result.timeline')}
      </h3>
      <ol className={css.timeline}>
        {rows.map(({ phase, start, solidEnd, end }, i) => {
          const barStyle = {
            '--start': pct(start),
            '--solid': pct(solidEnd - start),
            '--span': pct(end - start),
          } as CSSProperties;
          return (
            <li key={phase.id} className={css.phase}>
              <div className={css.phaseHead}>
                <span className={css.phaseIndex}>{t('result.phase', { n: i + 1 })}</span>
                <span className={css.phaseWeeks}>{t('estimate.weeks', { min: phase.weeks.min, max: phase.weeks.max })}</span>
              </div>
              <div className={css.phaseTrack} style={barStyle} aria-hidden>
                <span className={css.phaseSpan} />
                <span className={css.phaseSolid} />
              </div>
              <PhaseBody phase={phase} hasText={hasText} />
            </li>
          );
        })}
      </ol>
      <div className={css.axis} aria-hidden>
        {ticks.map((week, i) => (
          <span key={week} style={{ left: pct(week) }}>
            {i === 0 ? t('result.weekAxis', { n: week }) : week}
          </span>
        ))}
      </div>
    </section>
  );
}
