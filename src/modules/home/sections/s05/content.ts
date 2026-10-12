/**
 * The real numbers the section shows, and its card's project. Every number is
 * derived from the portfolio data (media/portfolio.ts), never typed in by
 * hand; the words are in src/messages/home/code-to-ui/<locale>.json.
 */
import driveMeFrameRu from '../../assets/code-to-ui/driveme-frame.ru.jpg';
import driveMeFrameUz from '../../assets/code-to-ui/driveme-frame.uz.jpg';
import driveMeFrame from '../../assets/code-to-ui/driveme-frame.jpg';
import { projectKind } from '../../media/descriptors';
import type { DescriptorLocale } from '../../media/labels';
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
 * What the card's media plays, per page language. For DriveMe the still is a
 * frame of its own walkthrough at 4.5s (the title card would repeat the
 * card's title), and playback starts at that same frame, so poster → video
 * is seamless. Its chapter captions are burned in, so uz and ru play their
 * own renders: `driveme.<locale>.mp4` from video/src/projects/driveme.<locale>.json
 * (docs/portfolio-videos.md), with stills taken at the same 4.5s.
 */
const FRAME_TIME_S = 4.5;
type CardMedia = Pick<LabProject, 'video' | 'poster'>;

const DRIVEME_FRAMES: Readonly<Record<DescriptorLocale, string>> = {
  en: driveMeFrame.src,
  ru: driveMeFrameRu.src,
  uz: driveMeFrameUz.src,
};

/** `/videos/driveme.mp4` → `/videos/driveme.uz.mp4`; English keeps the plain file. */
function localizedVideo(src: string, locale: DescriptorLocale): string {
  return locale === 'en' ? src : src.replace(/\.mp4$/, `.${locale}.mp4`);
}

function cardMedia(locale: DescriptorLocale): CardMedia {
  if (CARD_PROJECT.slug !== CARD_SLUG) return { video: CARD_PROJECT.video, poster: CARD_PROJECT.poster };
  return { video: `${localizedVideo(CARD_PROJECT.video, locale)}#t=${FRAME_TIME_S}`, poster: DRIVEME_FRAMES[locale] };
}

export const CARD_MEDIA: Readonly<Record<DescriptorLocale, CardMedia>> = {
  en: cardMedia('en'),
  ru: cardMedia('ru'),
  uz: cardMedia('uz'),
};

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
