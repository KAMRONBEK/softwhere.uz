/**
 * The real numbers the section shows, and its card's project. Every number is
 * derived from the portfolio data (media/portfolio.ts), never typed in by
 * hand; the words are in src/messages/home/code-to-ui/<locale>.json.
 */
import driveMeFrame from '../../assets/code-to-ui/driveme-frame.jpg';
import { projectKind } from '../../media/descriptors';
import { LAB_PROJECTS, getFeaturedProjects, getProjectBySlug, type LabProject } from '../../media/portfolio';

/** The card's project: a live-in-store app with both store platforms. */
const CARD_SLUG = 'driveme';

export const CARD_PROJECT: LabProject = getProjectBySlug(CARD_SLUG) ?? getFeaturedProjects(1)[0] ?? LAB_PROJECTS[0];

/*
 * The card names the kind of product ("Ride-hailing app", via the project
 * describer in the visitor's language), not the app: the founder's rule
 * (2026-10-10) keeps real names on the work wall only. The walkthrough it
 * plays is the app's own, brand and all.
 */

/** What the typed code loads the app by: `getApp('ride-hailing')` (code, so English in every locale). */
export const CARD_KEY = projectKind(CARD_PROJECT)
  .replace(/ app$/, '')
  .replace(/[^a-z0-9]+/gi, '-')
  .toLowerCase();

/**
 * What the card's media plays. For DriveMe the still is a frame of its own
 * walkthrough at 4.5s (the title card would repeat the card's title), and
 * playback starts at that same frame, so poster → video is seamless.
 */
const FRAME_TIME_S = 4.5;
export const CARD_MEDIA: Pick<LabProject, 'video' | 'poster'> =
  CARD_PROJECT.slug === CARD_SLUG
    ? { video: `${CARD_PROJECT.video}#t=${FRAME_TIME_S}`, poster: driveMeFrame.src }
    : { video: CARD_PROJECT.video, poster: CARD_PROJECT.poster };

/** Bars of the chart, in order (labels: the describer's platform names). */
export const PLATFORM_STATS = (['ios', 'android', 'web'] as const).map(key => ({
  key,
  count: LAB_PROJECTS.filter(project => project.platforms.includes(key)).length,
}));

export const PROJECT_TOTAL = LAB_PROJECTS.length;

const BAR_MAX = Math.max(...PLATFORM_STATS.map(stat => stat.count), 1);
export const BAR_RATIOS = PLATFORM_STATS.map(stat => stat.count / BAR_MAX);
export const BAR_COUNTS = PLATFORM_STATS.map(stat => stat.count);

/** Projects whose stack includes React or React Native. */
const REACT_COUNT = LAB_PROJECTS.filter(project => project.tech.some(item => /^React\b/.test(item))).length;

/** Editor chrome: file names are code, the same in every language. */
export const EDITOR_FILES = { active: 'Showcase.tsx', others: ['ui.tsx', 'data.ts'], language: 'TypeScript JSX' } as const;

/** Values the copy interpolates (`home.code-to-ui`: `{react}`, `{projects}`). */
export const CODE_FACTS = { react: REACT_COUNT, projects: PROJECT_TOTAL } as const;
