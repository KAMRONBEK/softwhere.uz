import { projectKind } from '../../media/descriptors';
import type { PlatformId } from '../../media/labels';
import { getProjectBySlug, LAB_PROJECTS, type LabProject } from '../../media/portfolio';
import { getShowcaseApp, type ShowcaseApp, type ShowcaseAppId, type ShowcaseScreen } from '../../media/showcase';

/**
 * Data for 06 · Devices. The words are in src/messages/home/devices/<locale>.json
 * and home.shared.showcase (screen captions, app descriptors); useDevicesCopy.ts
 * puts them together. Counts are derived from the real portfolio data at module
 * load, never typed in.
 *
 * The devices run the founder's picks in dark mode (2026-10-11, see
 * media/showcase.ts): a messenger, an investing app and an auction
 * marketplace on the phone, an AI learning platform scrolling on the laptop.
 * The phone shows real app screens, not the 16:9 promo videos (a phone
 * playing a video of phones read as an ad).
 *
 * The screens are the products' own UI; the copy around them names only the
 * kind of product (founder's rule, 2026-10-10: real names live on the work
 * wall), so the laptop's address bar stays empty and the site's wordmark is
 * left out of its capture (media/showcase.ts).
 */

const LAPTOP_APP = getShowcaseApp('talim-ai');

/** The laptop's app: the intro names it by its descriptor ("an AI learning platform"). */
export const LAPTOP_APP_ID: ShowcaseAppId = LAPTOP_APP.id;

/** Store chips: brand names, the same in every language. */
const STORE_NAMES = { appStore: 'App Store', playMarket: 'Google Play' } as const;

export type ScreenTransition = 'push' | 'fade';

export interface DeviceScreen {
  /** The showcase screen (its caption: useShowcaseCopy().caption). */
  shot: ShowcaseScreen;
  src: string;
  /** Where a finger taps to leave this screen (0..1, y from the top). */
  tap: readonly [number, number];
}

/** Card facts for work that is not in the portfolio data (it is not on the work wall either). */
interface AppFacts {
  /** Industry and market as the portfolio data would write them (the describer localizes both). */
  type: string;
  location: string;
  platforms: readonly PlatformId[];
  tech: readonly string[];
}

/** The phone's apps; each one's rail tag and one-liner are `home.devices.apps.<id>`. */
export type DevicesAppId = Extract<ShowcaseAppId, 'tes-chat' | 'nexus' | 'rasta-market'>;

interface AppSpec {
  id: DevicesAppId;
  /** How screens 2 and 3 arrive: a navigation push, or a tab switch. */
  transition: ScreenTransition;
  /** Where a finger taps to leave screens 1 and 2 (0..1, y from the top). */
  taps: readonly [readonly [number, number], readonly [number, number]];
  /** Used when the app has no portfolio entry. */
  facts?: AppFacts;
}

/** The phone's apps, in order (screens and captions: media/showcase.ts). */
const APP_SPECS: readonly AppSpec[] = [
  {
    id: 'tes-chat',
    transition: 'push',
    taps: [
      [0.42, 0.23],
      [0.93, 0.078],
    ],
  },
  {
    id: 'nexus',
    transition: 'fade',
    taps: [
      [0.41, 0.083],
      [0.5, 0.915],
    ],
  },
  {
    id: 'rasta-market',
    transition: 'push',
    taps: [
      [0.5, 0.372],
      [0.31, 0.35],
    ],
    facts: {
      type: 'Marketplace',
      location: 'Uzbekistan',
      platforms: ['ios', 'android', 'web'],
      tech: ['React Native', 'Expo', 'Next.js', 'NestJS', 'Socket.IO'],
    },
  },
];

type DescribedProject = Pick<LabProject, 'slug' | 'type' | 'location' | 'description' | 'platforms'>;

export interface DevicesApp {
  id: DevicesAppId;
  /** The portfolio entry (title and kicker are described from it), or null for work not on the work wall. */
  project: DescribedProject | null;
  /** Industry and market for the kicker (the portfolio's, or the spec's facts). */
  field: Pick<LabProject, 'type' | 'location'>;
  /** The kicker leaves the industry out when the title already says it ("Messaging" under "Messenger"). */
  isFieldInTitle: boolean;
  /** Platforms a store chip does not already say (Google Play implies Android, the App Store iOS). */
  platforms: PlatformId[];
  stores: string[];
  /** Stack highlights (projects.ts when the app is there; platform names left out). */
  tech: string[];
  transition: ScreenTransition;
  fill: string;
  screens: readonly DeviceScreen[];
}

const PLATFORM_TECH = /^(ios|android|web)$/i;
const TECH_SHOWN = 5;

type AppCard = Pick<DevicesApp, 'project' | 'field' | 'isFieldInTitle' | 'platforms' | 'stores' | 'tech'>;

function cardOf(project: LabProject | undefined, facts: AppFacts | undefined): AppCard | null {
  if (project) {
    const stores: string[] = [];
    if (project.appStore) stores.push(STORE_NAMES.appStore);
    if (project.playMarket) stores.push(STORE_NAMES.playMarket);
    return {
      project,
      field: { type: project.type, location: project.location },
      isFieldInTitle: project.type.toLowerCase() === projectKind(project),
      platforms: project.platforms.filter(
        platform => !(platform === 'ios' && project.appStore) && !(platform === 'android' && project.playMarket)
      ),
      stores,
      tech: project.tech.filter(item => !PLATFORM_TECH.test(item)).slice(0, TECH_SHOWN),
    };
  }
  if (!facts) return null;
  return {
    project: null,
    field: { type: facts.type, location: facts.location },
    isFieldInTitle: false,
    platforms: [...facts.platforms],
    stores: [],
    tech: facts.tech.slice(0, TECH_SHOWN),
  };
}

function toApp(showcase: ShowcaseApp, spec: AppSpec): DevicesApp | null {
  const project = showcase.portfolioSlug ? getProjectBySlug(showcase.portfolioSlug) : undefined;
  // Founders' rule: banking, lending, leasing and insurance work never leads a showcase.
  if (project?.isSensitiveFinance) return null;
  const card = cardOf(project, spec.facts);
  const [first, second, third] = showcase.phone;
  if (!card || !first || !second || !third) return null;
  return {
    id: spec.id,
    ...card,
    transition: spec.transition,
    fill: showcase.fill,
    screens: [
      { shot: first, src: first.image.src, tap: spec.taps[0] },
      { shot: second, src: second.image.src, tap: spec.taps[1] },
      { shot: third, src: third.image.src, tap: [0.5, 0.5] },
    ],
  };
}

/** The apps the phone runs, in order. */
export const DEVICE_APPS: readonly DevicesApp[] = APP_SPECS.flatMap(spec => toApp(getShowcaseApp(spec.id), spec) ?? []);

/** Screens per app (every spec has exactly three). */
export const SCREENS_PER_APP = 3;

const [LAPTOP_SCREEN] = LAPTOP_APP.desktop;
const LAPTOP_CAPTURE = LAPTOP_SCREEN.image;

/** The laptop: the top of the learning platform's site in dark mode, scrolling slowly. */
export const LAPTOP_SITE = {
  src: LAPTOP_CAPTURE.src,
  /** No address: it would name the product. */
  url: '',
  /** Capture size (px): the first ~3 screens of the page at 1440 wide. */
  width: LAPTOP_CAPTURE.width,
  height: LAPTOP_CAPTURE.height,
  fill: LAPTOP_APP.fill,
} as const;

/** Every texture the scene may need, phone screens first (app order). */
export const ALL_SCREEN_SOURCES: readonly string[] = DEVICE_APPS.flatMap(app => app.screens.map(screen => screen.src));

const storeLive = LAB_PROJECTS.filter(project => project.isLiveInStore);

/** Markets of the store-live apps, most apps first, as portfolio `location` values (the describer localizes them). */
export const STORE_MARKETS: ReadonlyArray<Pick<LabProject, 'location'>> = (() => {
  const counts = new Map<string, number>();
  storeLive.forEach(project => counts.set(project.location, (counts.get(project.location) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([location]) => ({ location }));
})();

/** Values the copy interpolates (`home.devices`: `{liveApps}`, `{phoneApps}`). */
export const DEVICES_FACTS = { liveApps: storeLive.length, phoneApps: DEVICE_APPS.length } as const;
