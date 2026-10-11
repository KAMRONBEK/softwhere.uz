import { memo, type CSSProperties, type ReactNode } from 'react';
import { LAB_FONTS } from '../../theme/fonts';
import { useLabTheme } from '../../theme/useLabTheme';
import { CodeIcon, DesktopIcon, PenIcon, PhoneIcon, TabletIcon } from './art';
import ChecksPanel from './ChecksPanel';
import ContentPanel from './ContentPanel';
import { CODE_FILE, LAYOUTS, type StepId, type WidthMode } from './data';
import LaunchPanel from './LaunchPanel';
import css from './panels.module.css';
import { useCopy } from './useCopy';
import type { SpecialEditor } from './useSpecialEditor';

function stagger(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

interface PanelProps {
  id: StepId;
  activeId: StepId;
  children: ReactNode;
}

/** One step's card. Only the active one is visible and reachable (inert otherwise). */
function Panel({ id, activeId, children }: PanelProps) {
  const isActive = id === activeId;
  const label = useCopy().step(id).term;
  return (
    <section className={css.panel} data-panel={id} data-active={isActive ? 'true' : undefined} inert={!isActive} aria-label={label}>
      {children}
    </section>
  );
}

function NotePanel() {
  const { wire } = useCopy().panels;
  return (
    <div className={css.note}>
      <p className={css.head}>
        <PenIcon className={css.headIcon} />
        {wire.title}
      </p>
      <p className={css.noteText}>{wire.text}</p>
    </div>
  );
}

function TokensPanel() {
  const { style } = useLabTheme();
  const copy = useCopy().panels.design;
  const display = LAB_FONTS[style.fonts.display].label;
  const body = LAB_FONTS[style.fonts.body].label;
  return (
    <div className={css.tokens}>
      <p className={css.head}>{copy.title}</p>
      <div className={css.tokenRow}>
        <span className={css.tokenLabel}>{copy.colours}</span>
        <ul className={css.swatches}>
          {copy.swatches.map((swatch, index) => (
            <li key={swatch.id} className={css.swatch} style={stagger(index)}>
              <span className={css.chip} data-swatch={index} />
              {swatch.name}
            </li>
          ))}
        </ul>
      </div>
      <div className={css.tokenRow}>
        <span className={css.tokenLabel}>{copy.type}</span>
        <div className={css.typeSpecimens}>
          <p className={css.specimen} style={stagger(4)}>
            <span className={css.aaDisplay}>Aa</span>
            <span>
              {display}
              <small>{copy.headings}</small>
            </span>
          </p>
          <p className={css.specimen} style={stagger(5)}>
            <span className={css.aaBody}>Aa</span>
            <span>
              {body}
              <small>{copy.body}</small>
            </span>
          </p>
        </div>
      </div>
      <div className={css.tokenRow}>
        <span className={css.tokenLabel}>{copy.shape}</span>
        <div className={css.shapes} style={stagger(6)}>
          <span className={css.radiusSample} />
          {[4, 8, 16, 24].map(space => (
            <span key={space} className={css.space} style={{ width: space * 1.5 }} />
          ))}
        </div>
      </div>
      <p className={css.foot}>{copy.note}</p>
    </div>
  );
}

/** The menu grid's markup, with the class that wins at the current width lit up. */
const CODE_LINES: ReadonlyArray<{ text: string; mode?: WidthMode }> = [
  { text: '<ul className="grid gap-6' },
  { text: '    grid-cols-1', mode: 'phone' },
  { text: '    md:grid-cols-2', mode: 'tablet' },
  { text: '    lg:grid-cols-3">', mode: 'desktop' },
  { text: '  {items.map(renderCard)}' },
  { text: '</ul>' },
];

const DEVICE_ICONS: Record<WidthMode, typeof DesktopIcon> = { desktop: DesktopIcon, tablet: TabletIcon, phone: PhoneIcon };

/**
 * Wide frames: the menu's markup with the rule for the current width lit up,
 * and that width's layout in plain words. Narrow frames (phones): one line,
 * so the page keeps the stage.
 */
function CodePanel({ mode }: { mode: WidthMode }) {
  const copy = useCopy().panels.code;
  return (
    <>
      <div className={css.code}>
        <p className={css.head}>
          <CodeIcon className={css.headIcon} />
          {CODE_FILE}
          <span className={css.bp}>{copy.layout[mode]}</span>
        </p>
        <pre className={css.pre}>
          {CODE_LINES.map(line => (
            <code key={line.text} className={css.line} data-on={line.mode === mode ? 'true' : undefined}>
              {line.text}
            </code>
          ))}
        </pre>
      </div>
      <div className={css.layoutChip}>
        <span className={css.chipDevices} aria-hidden='true'>
          {LAYOUTS.map(layout => {
            const Icon = DEVICE_ICONS[layout];
            return (
              <span key={layout} className={css.chipDevice} data-on={layout === mode ? 'true' : undefined}>
                <Icon />
              </span>
            );
          })}
        </span>
        <span className={css.chipText}>{copy.chip}</span>
        <span className={css.bp}>{copy.layout[mode]}</span>
      </div>
    </>
  );
}

interface PanelsProps {
  activeId: StepId;
  /** The stage is on screen and the story has started (drives the timed panels). */
  isLive: boolean;
  isReduced: boolean;
  mode: WidthMode;
  editor: SpecialEditor;
  /** The bakery's opening hours (the admin shows them), in the visitor's clock. */
  hours: string;
  onOrder: () => void;
}

/**
 * The cards that tell each step's detail: a design note, the tokens, the
 * responsive markup, the speed & SEO report, the admin field and the launch
 * analytics. All six stay mounted (state survives scrolling back and forth);
 * CSS crossfades the active one in.
 */
function Panels({ activeId, isLive, isReduced, mode, editor, hours, onOrder }: PanelsProps) {
  return (
    <div className={css.panels}>
      <Panel id='wire' activeId={activeId}>
        <NotePanel />
      </Panel>
      <Panel id='design' activeId={activeId}>
        <TokensPanel />
      </Panel>
      <Panel id='code' activeId={activeId}>
        <CodePanel mode={mode} />
      </Panel>
      <Panel id='checks' activeId={activeId}>
        <ChecksPanel isActive={isLive && activeId === 'checks'} isReduced={isReduced} />
      </Panel>
      <Panel id='content' activeId={activeId}>
        <ContentPanel editor={editor} hours={hours} />
      </Panel>
      <Panel id='launch' activeId={activeId}>
        <LaunchPanel isActive={isLive && activeId === 'launch'} isReduced={isReduced} onOrder={onOrder} />
      </Panel>
    </div>
  );
}

export default memo(Panels);
