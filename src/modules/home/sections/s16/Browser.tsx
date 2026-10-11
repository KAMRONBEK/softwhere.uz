import { memo, type ReactNode, type RefObject } from 'react';
import { CodeIcon, DesktopIcon, LockIcon, MoonIcon, PenIcon, PhoneIcon, SunIcon, TabletIcon } from './art';
import type { StepId, WidthMode } from './data';
import { useCopy } from './useCopy';
import css from './browser.module.css';

interface BrowserProps {
  areaRef: RefObject<HTMLDivElement | null>;
  stepId: StepId;
  /** The example site (SiteStack: every layout, scaled into the viewport). */
  site: ReactNode;
  /** The step panels: beside the frame on wide stages, over its foot on phones. */
  panels: ReactNode;
}

function AddressIcon({ stepId }: { stepId: StepId }) {
  if (stepId === 'wire' || stepId === 'design') return <PenIcon className={css.addressIcon} />;
  if (stepId === 'code') return <CodeIcon className={css.addressIcon} />;
  return <LockIcon className={css.addressIcon} />;
}

/**
 * A neutral browser window. The address bar tells the story on its own: a
 * prototype, then a preview link, then the admin, then the live domain.
 * Inside, the page sits on a dotted canvas (visible whenever the page is
 * narrower than the frame, like DevTools' device mode).
 */
export default function Browser({ areaRef, stepId, site, panels }: BrowserProps) {
  const isLive = stepId === 'launch';
  const copy = useCopy();
  return (
    <div className={css.browser} data-live={isLive ? 'true' : undefined}>
      <div className={css.chrome}>
        <span className={css.dots} aria-hidden='true'>
          <i />
          <i />
          <i />
        </span>
        <div className={css.address}>
          <AddressIcon stepId={stepId} />
          <span key={copy.address[stepId]} className={css.url}>
            {copy.address[stepId]}
          </span>
          {isLive && <span className={css.liveTag}>{copy.live}</span>}
        </div>
        <span className={css.example}>{copy.exampleTag}</span>
      </div>
      <div ref={areaRef} className={css.area}>
        {site}
      </div>
      {panels}
    </div>
  );
}

interface ToolbarProps {
  mode: WidthMode;
  isDark: boolean;
  readoutRef: RefObject<HTMLOutputElement | null>;
  onMode: (mode: WidthMode) => void;
  onToggleDark: () => void;
}

const MODES: ReadonlyArray<{ id: WidthMode; Icon: typeof DesktopIcon }> = [
  { id: 'desktop', Icon: DesktopIcon },
  { id: 'tablet', Icon: TabletIcon },
  { id: 'phone', Icon: PhoneIcon },
];

/** Screen-width switch (with the live width readout) and the site's dark-mode switch. */
function ToolbarView({ mode, isDark, readoutRef, onMode, onToggleDark }: ToolbarProps) {
  const copy = useCopy().toolbar;
  const index = MODES.findIndex(item => item.id === mode);
  return (
    <div className={css.toolbar} role='toolbar' aria-label={copy.label}>
      <div className={css.segmented} role='radiogroup' aria-label={copy.widthLabel}>
        <span className={css.thumb} style={{ transform: `translateX(${index * 100}%)` }} aria-hidden='true' />
        {MODES.map(({ id, Icon }) => (
          <button
            key={id}
            type='button'
            role='radio'
            aria-checked={mode === id}
            aria-label={copy.modes[id]}
            title={copy.modes[id]}
            className={css.segment}
            onClick={() => onMode(id)}
          >
            <Icon />
          </button>
        ))}
      </div>
      <output ref={readoutRef} className={css.readout} aria-live='off' />
      <button type='button' className={css.darkToggle} aria-pressed={isDark} aria-label={copy.dark} onClick={onToggleDark}>
        <span className={css.darkIcon} aria-hidden='true'>
          {isDark ? <SunIcon /> : <MoonIcon />}
        </span>
        <span className={css.darkLabel} aria-hidden='true'>
          {copy.dark}
        </span>
      </button>
    </div>
  );
}

export const Toolbar = memo(ToolbarView);
