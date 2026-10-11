import type { StaticImageData } from 'next/image';
import nexusExplore from '../assets/showcase/nexus/phone-1-explore.webp';
import nexusMarkets from '../assets/showcase/nexus/phone-2-markets.webp';
import nexusPortfolio from '../assets/showcase/nexus/phone-3-portfolio.webp';
import rastaMarket from '../assets/showcase/rasta-market/phone-1-market.webp';
import rastaLive from '../assets/showcase/rasta-market/phone-2-live.webp';
import rastaProduct from '../assets/showcase/rasta-market/phone-3-product.webp';
import talimSite from '../assets/showcase/talim-ai/desktop-site.webp';
import tesChatChats from '../assets/showcase/tes-chat/phone-1-chats.webp';
import tesChatConversation from '../assets/showcase/tes-chat/phone-2-conversation.webp';
import tesChatThemes from '../assets/showcase/tes-chat/phone-3-themes.webp';

/**
 * Dark-mode screens of the apps the founder approved for the story sections
 * (2026-10-11): a messenger, a learning platform, an investing app and an
 * auction marketplace. Copy around them names only the kind of product
 * (its descriptor); real names stay on the work wall. Every word (descriptor,
 * captions, alt text) is in messages, home.shared.showcase, read with
 * useShowcaseCopy(). The screens are the
 * products' own UI with fictional demo data, kept nameless by small edits:
 * the marketplace's header (its brand) reads "Market", the name of its tab;
 * the learning platform's site capture leaves out its wordmark, and its hero
 * line says "It gives you…" where it named itself.
 *
 * Sources: the messenger, learning-platform and marketplace screens are
 * captures of the apps running locally on seeded demo data; the investing app's
 * are cut from its walkthrough video (public/videos/nexus.mp4 at 8.0s, 11.0s and
 * 18.5s), so they are smaller (540 wide) and slightly softer. Phone screens are
 * fitted to the 3D phone display (540:1176) with a drawn status bar where its
 * punch hole sits.
 */

export type ShowcaseAppId = 'tes-chat' | 'talim-ai' | 'nexus' | 'rasta-market';

export interface ShowcaseScreen {
  /** Key of its copy: home.shared.showcase.<appId>.screens.<id> (read it with useShowcaseCopy()). */
  id: string;
  image: StaticImageData;
}

export interface ShowcaseApp {
  id: ShowcaseAppId;
  /** Slug in media/portfolio.ts, or null for work that is not on the work wall. */
  portfolioSlug: string | null;
  /** The app's own background, shown on a display until a screen has decoded. */
  fill: string;
  /** Phone screens, in the order a visitor would meet them. */
  phone: readonly ShowcaseScreen[];
  /** Desktop captures (a tall page for a scrolling browser window). */
  desktop: readonly ShowcaseScreen[];
}

export const SHOWCASE_APPS: Readonly<Record<ShowcaseAppId, ShowcaseApp>> = {
  'tes-chat': {
    id: 'tes-chat',
    portfolioSlug: 'tes-chat',
    fill: '#000000',
    phone: [
      {
        id: 'chats',
        image: tesChatChats,
      },
      {
        id: 'conversation',
        image: tesChatConversation,
      },
      {
        id: 'themes',
        image: tesChatThemes,
      },
    ],
    desktop: [],
  },
  'talim-ai': {
    id: 'talim-ai',
    portfolioSlug: 'talim-ai',
    fill: '#17120f',
    phone: [],
    desktop: [
      {
        id: 'site',
        image: talimSite,
      },
    ],
  },
  nexus: {
    id: 'nexus',
    portfolioSlug: 'nexus',
    fill: '#181818',
    phone: [
      {
        id: 'explore',
        image: nexusExplore,
      },
      {
        id: 'markets',
        image: nexusMarkets,
      },
      {
        id: 'portfolio',
        image: nexusPortfolio,
      },
    ],
    desktop: [],
  },
  'rasta-market': {
    id: 'rasta-market',
    portfolioSlug: null,
    fill: '#050709',
    phone: [
      {
        id: 'market',
        image: rastaMarket,
      },
      {
        id: 'live',
        image: rastaLive,
      },
      {
        id: 'product',
        image: rastaProduct,
      },
    ],
    desktop: [],
  },
};

export function getShowcaseApp(id: ShowcaseAppId): ShowcaseApp {
  return SHOWCASE_APPS[id];
}
