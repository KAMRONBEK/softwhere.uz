/**
 * The shipped-work line, derived from the portfolio: admin systems and
 * dashboards our engineers have built, described generically (the founder
 * keeps project names for the work wall; the words are
 * `home.crm-build.shippedWork.<slug>`). A slug that leaves projects.ts drops
 * out of the line on its own.
 */
import { getProjectBySlug } from '../../media/portfolio';

const ADMIN_WORK = ['hamd', 'stadium-people', 'novalinq-eld', 'brand-guard', 'hello-box'] as const;

export type AdminWorkSlug = (typeof ADMIN_WORK)[number];

export const SHIPPED_ADMIN_WORK: readonly AdminWorkSlug[] = ADMIN_WORK.filter(slug => getProjectBySlug(slug));
