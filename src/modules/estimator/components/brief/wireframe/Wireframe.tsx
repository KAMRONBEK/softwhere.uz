import type { CSSProperties, ReactNode } from 'react';
import type { WireframeBlock, WireframeScreen } from '@/modules/estimator/ai-brief/types';
import { NavBar, SketchBlock, type FrameKind } from './blocks';
import css from './wireframe.module.css';

/**
 * One wireframe screen in its device frame. The phone docks its header at the
 * top and its tab bar at the bottom; wide frames (browser/desktop) turn the
 * nav-bar into a sidebar; the chat frame is a messenger with a bot keyboard.
 * The drawing is decorative — `label` describes it for assistive tech.
 */

type WireframeProps = {
  screen: WireframeScreen;
  /** Accessible description of the sketch. */
  label: string;
  /** Draw the blocks in one by one (first appearance only). */
  isAnimated?: boolean;
  /** Stagger offset for this screen within a strip, ms. */
  delayMs?: number;
};

const frameOf = (device: WireframeScreen['device']): FrameKind => (device === 'phone' ? 'phone' : device === 'chat' ? 'chat' : 'wide');

function takeFirst(blocks: WireframeBlock[], kind: WireframeBlock['kind']): [WireframeBlock | null, WireframeBlock[]] {
  const index = blocks.findIndex(b => b.kind === kind);
  if (index < 0) return [null, blocks];
  return [blocks[index], [...blocks.slice(0, index), ...blocks.slice(index + 1)]];
}

/** Each block fades/draws in after the previous one. */
function Drawn({ order, children, className = '' }: { order: number; children: ReactNode; className?: string }) {
  return (
    <div className={`${css.drawn} ${className}`} style={{ '--order': order } as CSSProperties}>
      {children}
    </div>
  );
}

function Body({ blocks, frame, startOrder }: { blocks: WireframeBlock[]; frame: FrameKind; startOrder: number }) {
  let buttons = 0;
  return (
    <>
      {blocks.map((block, i) => {
        const isPrimary = frame !== 'chat' && block.kind === 'button' && buttons++ === 0;
        return (
          <Drawn key={i} order={startOrder + i} className={css[`k_${block.kind.replace('-', '_')}`]}>
            <SketchBlock block={block} ctx={{ frame, isPrimary }} />
          </Drawn>
        );
      })}
    </>
  );
}

function PhoneFrame({ screen }: { screen: WireframeScreen }) {
  const [header, rest] = takeFirst(screen.blocks, 'header');
  const [nav, body] = takeFirst(rest, 'nav-bar');
  return (
    <div className={`${css.frame} ${css.phone}`}>
      <div className={css.statusBar}>
        <span>9:41</span>
        <span className={css.island} />
        <span className={css.statusIcons} />
      </div>
      {header && (
        <Drawn order={0}>
          <SketchBlock block={header} ctx={{ frame: 'phone', isPrimary: false }} />
        </Drawn>
      )}
      <div className={css.scroll}>
        <Body blocks={body} frame='phone' startOrder={1} />
      </div>
      {nav && (
        <Drawn order={body.length + 1} className={css.dock}>
          <NavBar block={nav} frame='phone' />
        </Drawn>
      )}
      <span className={css.homeBar} />
    </div>
  );
}

function ChatFrame({ screen }: { screen: WireframeScreen }) {
  const [header, rest] = takeFirst(screen.blocks, 'header');
  const [nav, body] = takeFirst(rest, 'nav-bar');
  return (
    <div className={`${css.frame} ${css.phone} ${css.chatFrame}`}>
      <div className={css.statusBar}>
        <span>9:41</span>
        <span className={css.island} />
        <span className={css.statusIcons} />
      </div>
      <div className={css.chatHeader}>
        <span className={css.chatAvatar} />
        <span className={css.chatTitle}>
          <span className={`${css.t} ${css.t_strong}`}>{header?.label ?? screen.name}</span>
          <span className={`${css.bar} ${css.chatSub}`} />
        </span>
      </div>
      <div className={`${css.scroll} ${css.chatScroll}`}>
        <Body blocks={body} frame='chat' startOrder={1} />
      </div>
      {nav && (
        <Drawn order={body.length + 1} className={css.dock}>
          <NavBar block={nav} frame='chat' />
        </Drawn>
      )}
      <div className={css.composerBar}>
        <span className={css.composerInput} />
        <span className={css.composerSend} />
      </div>
    </div>
  );
}

function WideFrame({ screen }: { screen: WireframeScreen }) {
  const [header, rest] = takeFirst(screen.blocks, 'header');
  const [nav, body] = takeFirst(rest, 'nav-bar');
  const isBrowser = screen.device === 'browser';
  return (
    <div className={`${css.frame} ${css.wide}`}>
      <div className={css.chrome}>
        <span className={css.lights}>
          <span />
          <span />
          <span />
        </span>
        {isBrowser ? <span className={css.url} /> : <span className={`${css.bar} ${css.windowTitle}`} />}
      </div>
      {header && (
        <Drawn order={0}>
          <SketchBlock block={header} ctx={{ frame: 'wide', isPrimary: false }} />
        </Drawn>
      )}
      <div className={nav ? `${css.wideBody} ${css.wideBodyNav}` : css.wideBody}>
        {nav && (
          <Drawn order={1} className={css.sideCol}>
            <NavBar block={nav} frame='wide' />
          </Drawn>
        )}
        <div className={`${css.scroll} ${css.wideMain}`}>
          <Body blocks={body} frame='wide' startOrder={2} />
        </div>
      </div>
    </div>
  );
}

export default function Wireframe({ screen, label, isAnimated = false, delayMs = 0 }: WireframeProps) {
  const frame = frameOf(screen.device);
  const style = { '--delay': `${delayMs}ms` } as CSSProperties;
  return (
    <div
      role='img'
      aria-label={label}
      className={`${css.sketch} ${css[`sketch_${frame}`]} ${isAnimated ? css.animated : ''}`}
      style={style}
    >
      <div aria-hidden className={css.paper}>
        {frame === 'phone' && <PhoneFrame screen={screen} />}
        {frame === 'chat' && <ChatFrame screen={screen} />}
        {frame === 'wide' && <WideFrame screen={screen} />}
      </div>
    </div>
  );
}

/** Plain-text summary of a screen for assistive tech: "Header Find a class, search, …". */
export function describeBlocks(screen: WireframeScreen): string {
  return screen.blocks
    .map(block => block.label || block.kind)
    .filter(Boolean)
    .join(', ');
}
