import { distinctByKind, projectKind } from '../../media/descriptors';
import { getFeaturedProjects, getProjectBySlug, LAB_PROJECTS, type LabProject } from '../../media/portfolio';

/**
 * The finale's data: which products it names (by kind, never by name: the
 * founder's rule of 2026-10-10 keeps real names on the work wall only) and
 * the studio's real channels (src/core/constants.ts). Every word a visitor
 * reads is in src/messages/home/finale/{en,ru,uz}.json (`home.finale`); the
 * kinds are worded per locale by useProjectDescriber().
 */

/** Three shipped products, named by kind in the lead-in ("A ride-hailing app."). */
const INTRO_SLUGS = ['driveme', 'talim-ai', 'tes-chat'] as const;
export const INTRO_PROJECTS: readonly LabProject[] = INTRO_SLUGS.flatMap(slug => {
  const project = getProjectBySlug(slug);
  return project ? [project] : [];
});

/**
 * Products whose kinds stream past during the warp ("Taxi app", "Investing
 * app"): every other kind of product we built except sensitive-finance work
 * (founders' rule), live store apps first, each kind once.
 */
const introKinds = new Set(INTRO_PROJECTS.map(project => projectKind(project)));
export const WARP_PROJECTS: readonly LabProject[] = distinctByKind(getFeaturedProjects(LAB_PROJECTS.length)).filter(
  project => !introKinds.has(projectKind(project))
);

export { channelsForLocale, PHONE_PRETTY, TELEGRAM_HANDLE, type ChannelId, type DirectChannel } from './channels';

export const BRAND = 'SoftWhere';
