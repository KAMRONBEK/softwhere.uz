import { projects } from '@/shared/data/projects';
import type { Project } from '@/shared/types';

/**
 * Portfolio media for the lab: every project with a walkthrough video
 * (public/videos/<slug>.mp4 + <slug>.jpg poster). Text fields are English;
 * media/labels.ts and media/useProjectDescriber.ts give the uz/ru words.
 */
export interface LabProject {
  id: number;
  slug: string;
  name: string;
  type: string;
  location: string;
  /** English description. */
  description: string;
  /** The description in every locale (read it with `useProjectDescriber().description`). */
  descriptions: Readonly<Record<'en' | 'ru' | 'uz', string>>;
  tech: string[];
  platforms: Array<'ios' | 'android' | 'web'>;
  video: string;
  poster: string;
  website?: string;
  appStore?: string;
  playMarket?: string;
  /** Has a live App Store / Google Play listing (the data only keeps live links). */
  isLiveInStore: boolean;
  /**
   * Conventional banking, lending, leasing or insurance work. Founders'
   * decision (2026-10-02): shown last, never in hero-level showcases.
   */
  isSensitiveFinance: boolean;
}

// Explicit list first (types like "FinTech" are too broad: Bysmillah is halal
// and interest-free), plus a keyword net for future additions.
const SENSITIVE_SLUGS = new Set([
  'netevia',
  'nestegg',
  'asia-insurance',
  'ascon',
  'agrobank-fresh',
  'ipak-yuli-locator',
  'zpay',
  'emit-autolab',
]);
const SENSITIVE_TYPE = /bank|insur|leas|lend|loan|credit/i;
const HALAL = /halal/i;

function slugOf(videoSrc: string): string {
  return videoSrc.replace(/^\/videos\//, '').replace(/\.mp4$/, '');
}

function platformsOf(technology: string): LabProject['platforms'] {
  const platforms: LabProject['platforms'] = [];
  if (/\biOS\b/.test(technology)) platforms.push('ios');
  if (/\bAndroid\b/.test(technology)) platforms.push('android');
  if (/\bWeb\b/.test(technology)) platforms.push('web');
  return platforms;
}

function toLabProject(project: Project & { video: NonNullable<Project['video']> }): LabProject {
  const slug = slugOf(project.video.src);
  return {
    id: project.id,
    slug,
    name: project.name,
    type: project.type,
    location: project.location,
    description: project.description.en,
    descriptions: { en: project.description.en, ru: project.description.ru, uz: project.description.uz },
    tech: project.technology.split('/').map(item => item.trim()),
    platforms: platformsOf(project.technology),
    video: project.video.src,
    poster: project.video.poster,
    website: project.website,
    appStore: project.appStore,
    playMarket: project.playMarket,
    isLiveInStore: Boolean(project.appStore || project.playMarket),
    isSensitiveFinance: SENSITIVE_SLUGS.has(slug) || (SENSITIVE_TYPE.test(project.type) && !HALAL.test(project.type)),
  };
}

const withVideo = projects.filter((project): project is Project & { video: NonNullable<Project['video']> } => Boolean(project.video));

/** Every project with a video, in portfolio order (strongest first). */
export const LAB_PROJECTS: readonly LabProject[] = withVideo.map(toLabProject);

/** All projects for wall/grid showcases: sensitive-finance work moved to the end. */
export function getShowcaseProjects(): LabProject[] {
  return [...LAB_PROJECTS.filter(p => !p.isSensitiveFinance), ...LAB_PROJECTS.filter(p => p.isSensitiveFinance)];
}

/**
 * Hero-level picks: never sensitive-finance; projects with a live store
 * listing first, then the rest, each group in portfolio order.
 */
export function getFeaturedProjects(count = 6): LabProject[] {
  const eligible = LAB_PROJECTS.filter(p => !p.isSensitiveFinance);
  return [...eligible.filter(p => p.isLiveInStore), ...eligible.filter(p => !p.isLiveInStore)].slice(0, count);
}

export function getProjectBySlug(slug: string): LabProject | undefined {
  return LAB_PROJECTS.find(p => p.slug === slug);
}
