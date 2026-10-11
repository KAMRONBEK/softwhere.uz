'use client';

import { useTranslations } from 'next-intl';
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useInView } from '../../components/useInView';
import { gsap, useGSAP } from '../../global/gsap';
import { getLabLenis, scrollToY } from '../../global/scroll';
import type { DeviceTier } from '../../types';
import KitPicker, { ProofChip } from './KitPicker';
import { getToolboxOpen, rememberToolboxOpen, subscribeToolboxOpen } from './kitStore';
import type { Kit, KitId, Toolbox as ToolboxData, ToolboxTool, ToolboxTrade } from './stack-data';
import css from './toolbox.module.css';

/**
 * The full toolbox, as a drawer under the tower's floor. Closed, it is one
 * line of proof (every area, every tool counted) and a button; open, every
 * tool we build with stands in eight small brick walls, one per area, each
 * with a plain line on what it does for the owner.
 *
 * The kit picked above the tower lights up here too (a sticky copy of the
 * picker rides along while the walls scroll by); "Used in our projects" marks
 * the tools a real portfolio project lists. Hover or tap a brick for what it
 * does, in a tag that glides from brick to brick.
 *
 * The walls render once and never again: a kit or the proof switch only
 * flips an attribute on their container, and CSS does the rest (`data-kits`
 * on each brick, `[data-kits~=…]` selectors), so a tap costs a few style
 * recalcs, not 94 re-renders. Phones: each area is one sideways row with its
 * lit tools first. Motion: each wall builds itself bottom course first when
 * the drawer opens (GSAP), lit bricks hop in a wave (CSS, high tier and
 * pointer only). Reduced motion and low tier: no build-in, no hop.
 */

const HIDE_TIP_MS = 140;
/** Keep the tag clear of the sticky picker when choosing above or below. */
const TIP_CLEARANCE = 132;
const TIP_GAP = 10;
const NARROW = 600;
/** Where the bar lands when the tower's column opens the drawer: clear of the visitor header. */
const BAR_LANDING = 96;
const RIDE_S = 1.1;

interface ToolboxProps {
  headingId: string;
  toolbox: ToolboxData;
  kitId: KitId;
  onPickKit: (id: KitId) => void;
  tier: DeviceTier;
  reducedMotion: boolean;
  isTouch: boolean;
}

interface Tip {
  tool: ToolboxTool;
  anchor: HTMLElement;
  /** Closed tags keep their content so they can fade out. */
  isOpen: boolean;
}

type ToolboxT = ReturnType<typeof useTranslations<'home.stack-physics'>>;

function noteFor(t: ToolboxT, kit: Kit | undefined, isProofOn: boolean): string {
  const kitLine = kit ? t('toolbox.noteKit', { subject: kit.subject, forSubject: kit.forSubject, rider: kit.rider }) : '';
  return isProofOn ? `${kitLine} ${t('toolbox.noteProof')}`.trim() : kitLine;
}

export default function Toolbox({ headingId, toolbox, kitId, onPickKit, tier, reducedMotion, isTouch }: ToolboxProps) {
  const t = useTranslations('home.stack-physics');
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const shelvesRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef(0);
  const pointerTypeRef = useRef('mouse');
  const wasTipOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(getToolboxOpen);
  const [isProofOn, setIsProofOn] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const [isDockStuck, setIsDockStuck] = useState(false);
  const isVisible = useInView(rootRef, '50% 0px');

  const kit = toolbox.kits.find(candidate => candidate.id === kitId);
  const toolById = useMemo(
    () => new Map<string, ToolboxTool>(toolbox.trades.flatMap(trade => trade.tools.map(tool => [tool.id, tool] as const))),
    [toolbox]
  );

  const setOpen = (next: boolean) => {
    rememberToolboxOpen(next);
    setIsOpen(next);
  };

  /** From the foot of the walls: back to the bar first, so closing never drops the visitor into the next section. */
  const closeFromFoot = () => {
    const bar = barRef.current;
    if (bar) scrollToY(Math.max(0, bar.getBoundingClientRect().top + window.scrollY - 96));
    setOpen(false);
  };

  const rideFrameRef = useRef<() => void>(() => undefined);
  useEffect(() => () => rideFrameRef.current(), []);

  // "See all N tools" in the tower's column: open, then glide down to the bar.
  useEffect(
    () =>
      subscribeToolboxOpen(() => {
        rememberToolboxOpen(true);
        setIsOpen(true);
        // Ride once the walls are laid out: until then the page is too short to reach the bar.
        let frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            const bar = barRef.current;
            if (!bar) return;
            const target = Math.max(0, bar.getBoundingClientRect().top + window.scrollY - BAR_LANDING);
            const lenis = getLabLenis();
            lenis?.resize();
            if (lenis && !reducedMotion) lenis.scrollTo(target, { duration: RIDE_S });
            else scrollToY(target);
          });
        });
        rideFrameRef.current = () => cancelAnimationFrame(frame);
      }),
    [reducedMotion]
  );

  // ---------- the tag ----------

  const showTip = useCallback(
    (anchor: HTMLElement) => {
      window.clearTimeout(hideTimerRef.current);
      const tool = toolById.get(anchor.dataset.brick ?? '');
      if (!tool) return;
      setTip(previous => (previous?.isOpen && previous.anchor === anchor ? previous : { tool, anchor, isOpen: true }));
    },
    [toolById]
  );

  const hideTip = useCallback((delay = 0) => {
    window.clearTimeout(hideTimerRef.current);
    const close = () => setTip(previous => (previous?.isOpen ? { ...previous, isOpen: false } : previous));
    if (delay === 0) close();
    else hideTimerRef.current = window.setTimeout(close, delay);
  }, []);

  // Place the tag over its brick (below it when the sticky picker would cover it).
  useLayoutEffect(() => {
    const root = rootRef.current;
    const element = tipRef.current;
    const shelves = shelvesRef.current;
    const wasOpen = wasTipOpenRef.current;
    wasTipOpenRef.current = tip?.isOpen ?? false;
    if (!tip?.isOpen || !root || !element || !shelves) return;
    const rootBox = root.getBoundingClientRect();
    const brickBox = tip.anchor.getBoundingClientRect();
    const shelvesBox = shelves.getBoundingClientRect();
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const gutter = shelvesBox.left - rootBox.left;
    const centered = brickBox.left - rootBox.left + brickBox.width / 2 - width / 2;
    const x = Math.min(Math.max(centered, gutter), root.clientWidth - gutter - width);
    const fitsAbove = brickBox.top - height - TIP_GAP > TIP_CLEARANCE;
    const y = fitsAbove ? brickBox.top - rootBox.top - height - TIP_GAP : brickBox.bottom - rootBox.top + TIP_GAP;
    element.dataset.glide = wasOpen && !reducedMotion ? 'true' : 'false';
    element.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }, [tip, reducedMotion]);

  // The brick the tag is about wears a ring (set on the DOM: the walls never re-render).
  const isTipOpen = tip?.isOpen ?? false;
  const tipAnchor = isTipOpen ? tip?.anchor : undefined;
  useEffect(() => {
    if (!tipAnchor) return;
    tipAnchor.setAttribute('data-active', 'true');
    return () => tipAnchor.removeAttribute('data-active');
  }, [tipAnchor]);

  // Touch: a tap anywhere but a brick puts the tag away; so does leaving the section.
  useEffect(() => {
    if (!isTipOpen) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-brick]')) return;
      hideTip();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isTipOpen, hideTip]);

  useEffect(() => {
    if (!isVisible || !isOpen) hideTip();
  }, [isVisible, isOpen, hideTip]);

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), []);

  // Phones: a new kit's tools lead every row, so each row starts from its beginning again.
  useEffect(() => {
    const shelves = shelvesRef.current;
    if (!shelves || !isOpen || window.innerWidth >= NARROW) return;
    shelves.querySelectorAll<HTMLElement>('[data-wall]').forEach(wall => {
      if (wall.scrollLeft > 0) wall.scrollTo({ left: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }, [kitId, isOpen, reducedMotion]);

  // The picker is stuck once the line just above it passes under the bar's top offset: it then
  // paints the strip above itself too. A scroll read (not an IntersectionObserver): a jump that
  // skips over the line must count too.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const dock = sentinel?.nextElementSibling;
    // Closed or away, the dock reads as not stuck (derived below): nothing to set here.
    if (!isVisible || !isOpen || !sentinel || !(dock instanceof HTMLElement)) return;
    const offset = parseFloat(getComputedStyle(dock).top) || 0;
    const update = () => setIsDockStuck(sentinel.getBoundingClientRect().top < offset);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [isVisible, isOpen]);

  const brickOf = (event: PointerEvent<HTMLElement>) =>
    event.target instanceof Element ? event.target.closest<HTMLElement>('[data-brick]') : null;

  const onWallPointerOver = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    const brick = brickOf(event);
    if (brick) showTip(brick);
    else hideTip(HIDE_TIP_MS);
  };

  const onWallPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') hideTip(HIDE_TIP_MS);
  };

  const onWallPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerTypeRef.current = event.pointerType;
  };

  // Tap (touch or pen) toggles the tag; a mouse already has it on hover.
  const onWallClick = (event: MouseEvent<HTMLDivElement>) => {
    if (pointerTypeRef.current === 'mouse') return;
    const brick = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-brick]') : null;
    if (!brick) return;
    if (tip?.isOpen && tip.anchor === brick) hideTip();
    else showTip(brick);
  };

  // A row scrolled sideways under an open tag would leave it pointing at nothing.
  const onWallScroll = () => {
    if (isTipOpen) hideTip();
  };

  // ---------- motion ----------

  useGSAP(
    () => {
      const bar = barRef.current;
      if (!bar || reducedMotion) return;
      gsap.from(bar.querySelectorAll('[data-tb-reveal]'), {
        y: 18,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.06,
        scrollTrigger: { trigger: bar, start: 'top 88%', once: true },
      });
    },
    { scope: barRef, dependencies: [reducedMotion] }
  );

  useGSAP(
    () => {
      const shelves = shelvesRef.current;
      if (!shelves || !isOpen || reducedMotion || tier === 'low') return;
      // Each wall builds itself as it comes into view: the floor draws, then the courses, bottom first.
      // Two tweens per wall, not a timeline: a timeline's ScrollTrigger refreshes a tick late, and a
      // `once` trigger that is already passed (a header jump past this section) then kills itself
      // inside the next trigger's refresh loop, which crashes ScrollTrigger (gsap 3.15).
      shelves.querySelectorAll<HTMLElement>('[data-shelf]').forEach(shelf => {
        const trigger = { trigger: shelf, start: 'top 92%', once: true };
        gsap.from(shelf.querySelector('[data-shelf-floor]'), { scaleX: 0, duration: 0.7, ease: 'expo.out', scrollTrigger: trigger });
        gsap.from(shelf.querySelectorAll('[data-brick]'), {
          y: -18,
          opacity: 0,
          duration: 0.42,
          ease: 'back.out(1.7)',
          stagger: 0.022,
          delay: 0.05,
          scrollTrigger: trigger,
        });
      });
    },
    { scope: shelvesRef, dependencies: [isOpen, reducedMotion, tier] }
  );

  const tipTrade = tip ? toolbox.trades.find(trade => trade.id === tip.tool.trade) : undefined;
  const hasHop = tier === 'high' && !isTouch && !reducedMotion;

  return (
    <div ref={rootRef} className={css.root} data-open={isOpen ? 'true' : undefined} data-proof={isProofOn ? 'on' : undefined}>
      <div ref={barRef} className={css.bar}>
        <div className={css.barMain}>
          <h3 id={headingId} className={css.kicker} data-tb-reveal=''>
            {t('toolbox.kicker')}
          </h3>
          <p className={css.summary} data-tb-reveal=''>
            {t('toolbox.summary', { tools: toolbox.total, areas: toolbox.trades.length })}
          </p>
          {/* Every name wears its dot in front; the clip hides the one that starts a line. */}
          <div className={css.areasClip} data-tb-reveal=''>
            <p className={css.areas}>
              {toolbox.trades.map(trade => (
                <span key={trade.id}>
                  <span className={css.dot} aria-hidden='true' />
                  {trade.name}
                </span>
              ))}
            </p>
          </div>
        </div>
        <button
          type='button'
          className={css.toggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setOpen(!isOpen)}
          data-tb-reveal=''
          data-magnetic=''
        >
          <span>{isOpen ? t('toolbox.close') : t('toolbox.open', { tools: toolbox.total })}</span>
          <ChevronIcon />
        </button>
      </div>

      <div id={panelId} className={css.panel} hidden={!isOpen}>
        <p className={css.kitsLabel} id={`${headingId}-kits`}>
          {t('kitsLabel')}
        </p>
        <div ref={sentinelRef} className={css.sentinel} aria-hidden='true' />
        <div className={css.dock} data-stuck={isDockStuck && isVisible && isOpen ? 'true' : undefined}>
          <KitPicker
            kits={toolbox.kits}
            value={kitId}
            onPick={onPickKit}
            labelledBy={`${headingId}-kits`}
            name='toolbox-kits'
            reducedMotion={reducedMotion}
          >
            <ProofChip label={t('toolbox.proof')} isOn={isProofOn} onToggle={() => setIsProofOn(value => !value)} />
          </KitPicker>
        </div>
        <p className={css.note} aria-live='polite'>
          {noteFor(t, kit, isProofOn)}
        </p>

        <div
          ref={shelvesRef}
          className={css.shelves}
          data-kit={kitId}
          data-hop={hasHop ? 'on' : undefined}
          onPointerOver={onWallPointerOver}
          onPointerLeave={onWallPointerLeave}
          onPointerDown={onWallPointerDown}
          onClick={onWallClick}
          onScrollCapture={onWallScroll}
        >
          <Walls trades={toolbox.trades} />
        </div>

        <button type='button' className={css.foot} onClick={closeFromFoot}>
          {t('toolbox.close')}
          <ChevronIcon />
        </button>
      </div>

      <div ref={tipRef} className={css.tip} data-open={isTipOpen ? 'true' : 'false'} aria-hidden='true'>
        {tip && tipTrade && (
          <div key={tip.tool.id} className={css.tipBody}>
            <div className={css.tipTag}>
              <span>
                {tipTrade.number} · {tipTrade.name}
              </span>
              {tip.tool.inPortfolio && (
                <span className={css.tipProof}>
                  <span className={css.proofMark} />
                  {t('toolbox.proof')}
                </span>
              )}
            </div>
            <div className={css.tipName}>{tip.tool.label}</div>
            <p className={css.tipBlurb}>{tip.tool.blurb}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function kitsOf(trade: ToolboxTrade): string {
  return [...new Set(trade.tools.flatMap(tool => (tool.kits ? tool.kits.split(' ') : [])))].join(' ');
}

/** Every area's wall. Rendered once per market: kits and the proof switch are attributes on the container. */
const Walls = memo(function Walls({ trades }: { trades: readonly ToolboxTrade[] }) {
  const t = useTranslations('home.stack-physics');
  return trades.map(trade => (
    <article key={trade.id} className={css.shelf} data-shelf='' data-kits={kitsOf(trade)}>
      <header className={css.shelfHead}>
        <span className={css.shelfNumber}>{trade.number}</span>
        <h4 className={css.shelfName}>{trade.name}</h4>
        <span className={css.shelfCount}>{t('toolbox.areaCount', { tools: trade.tools.length })}</span>
      </header>
      <p className={css.shelfRole}>{trade.role}</p>
      <ul
        className={css.wall}
        data-wall=''
        aria-label={t('toolbox.wallLabel', { area: trade.name })}
        style={{ '--n': trade.tools.length } as CSSProperties}
      >
        {trade.tools.map((tool, index) => (
          <li
            key={tool.id}
            className={css.brick}
            data-brick={tool.id}
            data-kits={tool.kits || undefined}
            data-proof={tool.inPortfolio ? 'true' : undefined}
            style={{ '--order': tool.order, '--i': index } as CSSProperties}
          >
            <span className={css.face}>
              <span className={css.name}>{tool.label}</span>
              <span className={css.srOnly}>
                {' — '}
                {t('toolbox.toolDescription', { blurb: tool.blurb, used: tool.inPortfolio ? 'yes' : 'no' })}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className={css.shelfFloor} data-shelf-floor='' aria-hidden='true' />
    </article>
  ));
});

function ChevronIcon() {
  return (
    <svg
      className={css.chevron}
      viewBox='0 0 16 16'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M3.5 6l4.5 4.5L12.5 6' />
    </svg>
  );
}
