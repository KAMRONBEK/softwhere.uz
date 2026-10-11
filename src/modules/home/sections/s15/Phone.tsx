'use client';

import { memo, type Ref } from 'react';
import { useAppTheme, useDemoEnv, useStep } from './context';
import { RealHome } from './HomeScreen';
import { StatusGlyphs } from './icons';
import ScopeScreen from './ScopeScreen';
import { STEP_INDEX } from './state';
import StoreScreen from './StoreScreen';
import TestScreen from './TestScreen';
import { useCopy } from './useCopy';
import WireScreen from './WireScreen';
import home from './home.module.css';
import layer from './layers.module.css';
import css from './phone.module.css';

type Tone = 'screen' | 'ink' | 'paper';

/** Status bar ink for the screen on show: the board, the white wireframe, or the app's theme. */
function toneFor(step: number, theme: 'light' | 'dark'): Tone {
  if (step === STEP_INDEX.scope) return 'screen';
  if (step === STEP_INDEX.wire) return 'ink';
  return theme === 'light' ? 'ink' : 'paper';
}

/**
 * The device: a CSS phone with real thickness (stacked slabs), side keys,
 * a glass glare that follows the tilt, and one screen per step stacked as
 * layers (layers.module.css hands them over in a cascade). The app's light
 * or dark palette is set on the glass, so every app screen follows it. The
 * screens are memoized and read their own state: a step change here only
 * flips the layer flags.
 */
function Phone({ glareRef }: { glareRef: Ref<HTMLSpanElement> }) {
  const { step, run } = useStep();
  const { theme } = useAppTheme();
  const { isStatic, clock } = useDemoEnv();
  const copy = useCopy();
  const tone = toneFor(step, theme);

  const layerProps = (isOn: boolean) => ({
    className: layer.layer,
    'data-layer-on': isOn ? 'true' : undefined,
    'data-static': isStatic ? 'true' : undefined,
    inert: !isOn,
    'aria-hidden': !isOn,
  });

  return (
    <div className={css.phone} role='group' aria-label={copy.demoLabel}>
      <span className={css.slab} aria-hidden='true' />
      <span className={`${css.slab} ${css.slabBack}`} aria-hidden='true' />
      <span className={`${css.key} ${css.keyAction}`} aria-hidden='true' />
      <span className={`${css.key} ${css.keyVolUp}`} aria-hidden='true' />
      <span className={`${css.key} ${css.keyVolDown}`} aria-hidden='true' />
      <span className={`${css.key} ${css.keyPower}`} aria-hidden='true' />

      <div className={`${css.screen} ${home.palette}`} data-theme={theme}>
        <div {...layerProps(step === STEP_INDEX.scope)}>
          <ScopeScreen />
        </div>
        <div {...layerProps(step === STEP_INDEX.wire)}>
          <WireScreen />
        </div>
        <div {...layerProps(step === STEP_INDEX.design || step === STEP_INDEX.build)}>
          <RealHome />
        </div>
        <div {...layerProps(step === STEP_INDEX.test)}>
          <TestScreen />
        </div>
        <div {...layerProps(step === STEP_INDEX.release)}>
          <StoreScreen />
        </div>

        <div className={css.status} data-tone={tone} aria-hidden='true'>
          <span>{clock}</span>
          <StatusGlyphs className={css.statusGlyphs} />
        </div>
        <span className={css.island} aria-hidden='true' />
        <span className={css.glare} ref={glareRef} aria-hidden='true' />
        {!isStatic && run > 1 && <span className={css.sweep} key={run} aria-hidden='true' />}
        <span className={css.homeBar} data-tone={tone} aria-hidden='true' />
      </div>
    </div>
  );
}

export default memo(Phone);
