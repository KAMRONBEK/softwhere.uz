'use client';

import { memo } from 'react';
import { BUILD_CODE, BUILD_PLATFORMS, BUILD_STACK, FLOW_SCREEN_IDS, NOTES, SWATCH_IDS } from './data';
import { useAppTheme, useDemoEnv, useStep } from './context';
import { ArrowIcon, CheckIcon, StoreGlyph } from './icons';
import MiniApp from './MiniApp';
import { STEP_INDEX } from './state';
import { useCopy } from './useCopy';
import css from './satellites.module.css';

/** Relative effort of the four version-one features on the scope card (illustrative bars, no figures). */
const SCOPE_BARS = [0.42, 0.58, 0.86, 0.34];

/**
 * Desktop only (≥ 900px): small cards that float in front of the set beside
 * the phone and say what the step produces — the scope document, the user
 * flow, the design system, the weekly build, more devices, the store
 * listings. Decorative copies of what the phone shows (aria-hidden), except
 * the light/dark switch, which drives the app.
 */
function Satellites() {
  const { step } = useStep();
  const { theme } = useAppTheme();
  const { dispatch } = useDemoEnv();
  const copy = useCopy();
  const S = copy.satellites;
  const on = (index: number) => (step === index ? 'true' : undefined);
  const isDark = theme === 'dark';

  return (
    <div className={css.satellites}>
      {/* 1 · the written scope, feature by feature */}
      <div className={`${css.card} ${css.right} ${css.doc}`} data-on={on(STEP_INDEX.scope)} aria-hidden='true'>
        <span className={css.kicker}>{copy.scope.scoped}</span>
        <span className={css.docLines}>
          <i style={{ width: '92%' }} />
          <i style={{ width: '78%' }} />
          <i style={{ width: '85%' }} />
        </span>
        <ul className={css.docRows}>
          {NOTES.filter(note => !note.isLater).map((note, index) => (
            <li key={note.id}>
              <span>{copy.note(note.id)}</span>
              <i style={{ transform: `scaleX(${SCOPE_BARS[index]})` }} />
            </li>
          ))}
        </ul>
      </div>

      {/* 2 · the flow between screens */}
      <div className={`${css.card} ${css.left} ${css.flow}`} data-on={on(STEP_INDEX.wire)} aria-hidden='true'>
        <span className={css.kicker}>{S.flowTitle}</span>
        <span className={css.flowRow}>
          {FLOW_SCREEN_IDS.map((id, index) => (
            <span key={id} className={css.flowItem}>
              <span className={css.flowScreen}>
                <i />
                <i />
                <i />
              </span>
              <span className={css.flowName}>{S.screen(id)}</span>
              {index < FLOW_SCREEN_IDS.length - 1 && <ArrowIcon className={css.flowArrow} />}
            </span>
          ))}
        </span>
      </div>

      {/* 3 · the design system, and the switch that drives the app */}
      <div className={`${css.card} ${css.right} ${css.palette}`} data-on={on(STEP_INDEX.design)} inert={step !== STEP_INDEX.design}>
        <span className={css.kicker}>{S.paletteTitle}</span>
        <span className={css.swatches} aria-hidden='true'>
          {SWATCH_IDS.map((id, index) => (
            <span key={id} className={css.swatch} data-swatch={index}>
              <i />
              {S.swatch(id)}
            </span>
          ))}
        </span>
        <span className={css.type} aria-hidden='true'>
          <span className={css.typeDisplay}>
            Aa<small>{S.headings}</small>
          </span>
          <span className={css.typeBody}>
            Aa<small>{S.body}</small>
          </span>
        </span>
        <span className={css.segment} role='radiogroup' aria-label={S.themeLabel}>
          <button
            type='button'
            role='radio'
            aria-checked={!isDark}
            onClick={() => dispatch({ type: 'THEME', theme: 'light', isUser: true })}
          >
            {S.light}
          </button>
          <button type='button' role='radio' aria-checked={isDark} onClick={() => dispatch({ type: 'THEME', theme: 'dark', isUser: true })}>
            {S.dark}
          </button>
        </span>
      </div>

      {/* 4 · this week's build, and the code behind the add button */}
      <div className={`${css.card} ${css.left} ${css.build}`} data-on={on(STEP_INDEX.build)} aria-hidden='true'>
        <span className={css.buildHead}>
          <span className={css.buildIcon}>
            <MiniApp theme={theme} />
          </span>
          <span className={css.buildText}>
            <strong>{S.buildTitle}</strong>
            <span>{S.sent}</span>
          </span>
        </span>
        <span className={css.chips}>
          {BUILD_PLATFORMS.map(name => (
            <span key={name} className={css.chip}>
              <CheckIcon className={css.chipIcon} />
              {name}
            </span>
          ))}
        </span>
        <code className={css.code}>
          {BUILD_CODE.map(line => (
            <span key={line}>{line}</span>
          ))}
        </code>
        <span className={css.stack}>{BUILD_STACK}</span>
      </div>

      {/* 5 · more real devices */}
      <div className={`${css.device} ${css.left} ${css.deviceSmall}`} data-on={on(STEP_INDEX.test)} aria-hidden='true'>
        <span className={css.deviceBody}>
          <span className={css.deviceScreen}>
            <MiniApp theme={theme} />
          </span>
        </span>
        <span className={css.deviceLabel}>
          <CheckIcon className={css.deviceCheck} />
          {copy.test.device('ios-s')}
        </span>
      </div>
      <div className={`${css.device} ${css.right} ${css.deviceTablet}`} data-on={on(STEP_INDEX.test)} aria-hidden='true'>
        <span className={css.deviceBody}>
          <span className={css.deviceScreen}>
            <MiniApp theme={theme} />
          </span>
        </span>
        <span className={css.deviceLabel}>
          <CheckIcon className={css.deviceCheck} />
          {copy.test.device('tab')}
        </span>
      </div>

      {/* 6 · the listings */}
      <div className={`${css.card} ${css.right} ${css.release}`} data-on={on(STEP_INDEX.release)} aria-hidden='true'>
        <span className={css.approved}>
          <CheckIcon className={css.chipIcon} />
          {S.approved}
        </span>
        <span className={css.badges}>
          <span className={css.badge}>
            <StoreGlyph kind='ios' className={css.badgeGlyph} />
            <span>
              <small>iOS</small>
              App Store
            </span>
          </span>
          <span className={css.badge}>
            <StoreGlyph kind='android' className={css.badgeGlyph} />
            <span>
              <small>Android</small>
              Google Play
            </span>
          </span>
        </span>
        <span className={css.live}>{S.live}</span>
      </div>
    </div>
  );
}

export default memo(Satellites);
