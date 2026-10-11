import { memo, type CSSProperties } from 'react';
import { useLabTheme } from '../../theme/useLabTheme';
import { MenuIcon } from './art';
import { BakeArt, Steam, WheatMark } from './bakery';
import { LAYOUTS, type SiteCopy, type WidthMode } from './data';
import css from './site.module.css';

/** What the browser shows: nothing yet, the wireframe, or the designed site. */
export type SitePhase = 'blank' | 'wire' | 'design';

interface SiteState {
  phase: SitePhase;
  special: string;
  /** Bumps each time a visitor "orders" on launch day (the nav button pings). */
  pingCount: number;
  copy: SiteCopy;
}

/** Stagger order for the wireframe boxes (top to bottom, as a designer would draw them). */
function order(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

/**
 * The example bakery's home page at one fixed layout width, arranged by
 * container queries at Tailwind's md (768px) and lg (1024px) breakpoints.
 *
 * Morph keys: every block that moves between layouts carries `data-m` (its
 * key, the same in each layout); `data-m-only` limits it to the wireframe or
 * the designed phase (the products box in one, its cards in the other) and
 * `data-m-fit='box'` lets it stretch (a filled box) where text blocks scale
 * evenly. useViewportMorph reads them. Wireframe blocks carry `data-wire`
 * (their label) and a stagger index. Decorative for assistive tech: the
 * section describes each step in text.
 */
function Site({ phase, special, pingCount, copy }: SiteState) {
  return (
    <div className={css.site} data-phase={phase} aria-hidden='true'>
      <div className={css.special} data-wire={copy.wire.special} data-m='special' data-m-fit='box' style={order(0)}>
        <span key={special} className={css.specialText}>
          {special}
        </span>
      </div>

      <div className={css.nav}>
        <div className={css.logo} data-wire={copy.wire.logo} data-m='logo' style={order(1)}>
          <span className={css.logoInner}>
            <WheatMark className={css.mark} />
            <span>{copy.brand}</span>
          </span>
        </div>
        <div className={css.links} data-wire={copy.wire.nav} data-m='links' style={order(2)}>
          {copy.nav.map(link => (
            <span key={link}>{link}</span>
          ))}
        </div>
        <div className={css.order} data-wire={copy.wire.order} data-m='order' data-m-fit='box' style={order(3)}>
          <span className={css.orderLong}>{copy.navCta}</span>
          <span className={css.orderShort}>{copy.navCtaShort}</span>
          {pingCount > 0 && <span key={pingCount} className={css.ping} />}
        </div>
        <span className={css.burger} data-m='burger'>
          <MenuIcon />
        </span>
      </div>

      <div className={css.hero}>
        <div className={css.heroCopy}>
          <div className={css.heroTitle} data-wire={copy.wire.title} data-m='title' style={order(4)}>
            <span>{copy.heroTitle}</span>
          </div>
          <div className={css.heroText} data-wire={copy.wire.text} data-m='text' style={order(5)}>
            <span>{copy.heroText}</span>
          </div>
          <div className={css.actions} data-wire={copy.wire.actions} data-m='actions' style={order(6)}>
            <span className={css.primary}>{copy.ctaPrimary}</span>
            <span className={css.secondary}>{copy.ctaSecondary}</span>
          </div>
        </div>
        <div className={css.photo} data-wire={copy.wire.photo} data-m='photo' data-m-fit='box' style={order(5)}>
          <span className={css.photoArt}>
            <Steam className={css.steam} />
            <BakeArt id='loaf' className={css.loaf} />
          </span>
        </div>
      </div>

      <div className={css.fresh} data-wire={copy.wire.fresh} data-m='fresh' data-m-only='wire' data-m-fit='box' style={order(7)}>
        <div className={css.freshInner}>
          <span className={css.freshTitle} data-m='freshTitle' data-m-only='design'>
            {copy.freshTitle}
          </span>
          <ul className={css.grid}>
            {copy.products.map(product => (
              <li key={product.id} className={css.card} data-m={`card-${product.id}`} data-m-only='design' data-m-fit='box'>
                <span className={css.cardArt}>
                  <BakeArt id={product.id} />
                </span>
                <span className={css.cardName}>{product.name}</span>
                <span className={css.cardNote}>{product.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={css.footer} data-wire={copy.wire.footer} data-m='footer' style={order(8)}>
        <span>{copy.footer}</span>
      </div>
    </div>
  );
}

const SiteLayout = memo(Site);

interface SiteStackProps extends SiteState {
  isDark: boolean;
}

/**
 * Everything inside the browser's viewport: the page's paper (the site's
 * background, scaled to the current width), DevTools-style resize handles,
 * and the site pre-rendered once at each layout width. Only the active layout
 * shows; useViewportMorph scales, swaps and morphs them with transforms and
 * opacity only, so a resize never moves anything in layout (no layout shift,
 * no per-frame reflow). Carries the site's palette (light or dark, derived
 * from the lab style's two poles).
 */
function SiteStack({ isDark, ...state }: SiteStackProps) {
  const { scheme } = useLabTheme();
  return (
    <div className={css.stack} data-lab-scheme={scheme} data-site-scheme={isDark ? 'dark' : 'light'}>
      <div className={css.paper} data-paper='' />
      <span className={css.handle} data-handle='-1' />
      <span className={css.handle} data-handle='1' />
      {LAYOUTS.map((layout: WidthMode) => (
        <div key={layout} className={css.layer} data-layer={layout}>
          <SiteLayout {...state} />
        </div>
      ))}
    </div>
  );
}

export default memo(SiteStack);
