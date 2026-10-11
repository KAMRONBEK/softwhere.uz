'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useRef, type ComponentType, type CSSProperties } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useInView } from '../components/useInView';
import { useLabDevice } from '../device/useDeviceTier';
import { useLabLogo, type LogoProps } from '../logos';
import { useLabTheme } from '../theme/useLabTheme';
import type { DeviceTier, LabSectionProps } from '../types';
import { buildStatement, OUTCOME_IDS, SERVICE_IDS } from './s02/copy';
import { K } from './s02/engine';
import KineticLine from './s02/KineticLine';
import { useFitLines } from './s02/useFitLines';
import { useKinetic } from './s02/useKinetic';
import css from './s02/manifesto.module.css';

/**
 * 02 · Manifesto — kinetic type. "Demos are easy. Shipping is hard. We ship."
 * set as one fitted poster, with two tapes (what we build × what clients
 * get) pulled across the foot of "We ship." as it rises into view.
 *
 * The letters are real from the first paint; as each line enters, a weight
 * wave rolls across it while a quarter of its letters flip through stand-in
 * letters of the same case and width (≈0.35s, skipped on a fast scroll).
 * Scroll velocity leans and stretches the lines (each with its own lag) and
 * trails echoes; the tapes speed up, reverse and lean with it. The wide tape
 * slaps across "We ship." as it rises into view, jolting each letter it
 * passes, and crosses it as high as every letter stays legible (crossing.ts).
 * Letters near the cursor — or under a finger held still — flip to a
 * contrasting weight; tap a line to replay it.
 *
 * Modes: 'full' (high/mid tier), 'lite' (low tier: static type, CSS
 * marquees), 'still' (reduced motion: the sealed poster, nothing moves).
 */

type Mode = 'full' | 'lite' | 'still';

const MARQUEE_COPIES = [0, 1, 2, 3];
const ECHOES: Record<DeviceTier, number> = { high: 2, mid: 1, low: 0 };

/** The weight letters swap to under the pointer: far from the style's own. */
function contrastWeight(displayWeight: number): number {
  if (displayWeight >= 700) return 200;
  if (displayWeight >= 600) return 300;
  return 900;
}

interface TapeProps {
  items: readonly string[];
  className: string;
  /** 1 = runs left, -1 = runs right (scrolling up reverses it for a moment). */
  dir: 1 | -1;
  speed: number;
  /** Side the band is pulled in from. */
  side: 1 | -1;
  /** Share of the seal it waits for before it follows. */
  delay: number;
  /** The wide band: useFitLines reads its height to place the crossing. */
  isBand?: boolean;
  Mark: ComponentType<LogoProps>;
}

function Tape({ items, className, dir, speed, side, delay, isBand = false, Mark }: TapeProps) {
  return (
    <div className={`${css.tape} ${className}`} data-dir={dir} data-speed={speed} data-side={side} data-delay={delay} {...{ [K.tape]: '' }}>
      <div className={css.reel} {...(isBand ? { 'data-fit-band': '' } : {})} {...{ [K.reel]: '' }}>
        <div className={css.counter} {...{ [K.counter]: '' }}>
          <div className={css.lean} {...{ [K.lean]: '' }}>
            <div className={css.track} {...{ [K.track]: '' }}>
              {MARQUEE_COPIES.map(copy => (
                <div key={copy} className={css.group} {...(copy === 0 ? { [K.group]: '' } : {})}>
                  {items.map(item => (
                    <span key={item} className={css.item}>
                      {item}
                      <Mark className={css.sep} />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function S02Manifesto({ meta }: LabSectionProps) {
  // Copy: src/messages/home/manifesto/{en,ru,uz}.json; order and layout: s02/copy.ts.
  const t = useTranslations('home.manifesto');
  const statement = useMemo(() => buildStatement(key => t(`statement.${key}`)), [t]);
  const services = SERVICE_IDS.map(id => t(`services.${id}`));
  const outcomes = OUTCOME_IDS.map(id => t(`outcomes.${id}`));
  const rootRef = useRef<HTMLDivElement>(null);
  const { tier, reducedMotion, isTouch } = useLabDevice();
  const theme = useLabTheme();
  const { Mark } = useLabLogo();
  const isInView = useInView(rootRef);
  const mode: Mode = reducedMotion ? 'still' : tier === 'low' ? 'lite' : 'full';
  const echoes = mode === 'full' ? ECHOES[tier] : 0;
  const engineTier = tier === 'high' ? 'high' : 'mid';

  // Echo count is in the key so newly rendered echo letters get kerned too.
  // The words are in the key too: a new language means new letters to kern and fit.
  const fitKey = `${theme.styleId}:${echoes}:${statement.map(line => line.words.join(' ')).join('|')}`;
  useFitLines(rootRef, fitKey);
  useKinetic(rootRef, { isEnabled: mode === 'full', tier: engineTier, isTouch, isInView, replayKey: theme.styleId });

  // Exactly the height the registry reserves: useFitLines scales the type to fit it.
  const rootStyle = { '--alt-weight': contrastWeight(theme.type.displayWeight), minHeight: meta.minHeight } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={css.root}
      style={rootStyle}
      data-mode={mode}
      data-tier={engineTier}
      data-inview={isInView ? 'true' : 'false'}
    >
      <SectionHeading meta={meta} isVisuallyHidden>
        {t('heading')}
      </SectionHeading>

      <div className={css.statement} data-fit-column='' aria-hidden='true'>
        {statement.map(line => (
          <KineticLine key={line.key} line={line} echoes={echoes} />
        ))}
      </div>

      <div className={css.tapes} data-fit-tapes='' aria-hidden='true' {...{ [K.tapes]: '' }}>
        <Tape className={css.tapeOutcomes} items={outcomes} dir={-1} speed={0.8} side={1} delay={0.18} Mark={Mark} />
        <Tape className={css.tapeServices} items={services} dir={1} speed={1} side={-1} delay={0} isBand Mark={Mark} />
      </div>

      <ul className={css.srOnly} aria-label={t('servicesLabel')}>
        {services.map(service => (
          <li key={service}>{service}</li>
        ))}
      </ul>
      <ul className={css.srOnly} aria-label={t('outcomesLabel')}>
        {outcomes.map(outcome => (
          <li key={outcome}>{outcome}</li>
        ))}
      </ul>
    </div>
  );
}
