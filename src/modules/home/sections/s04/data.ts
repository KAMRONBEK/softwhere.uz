import { getProjectBySlug, LAB_PROJECTS, type LabProject } from '../../media/portfolio';
import { useProjectDescriber } from '../../media/useProjectDescriber';

/**
 * Data for 04 · Assembly; the words are in src/messages/home/assembly/<locale>.json
 * (`home.assembly`). The mini site is a rebuild of a real client product,
 * Talim AI (talim-ai.uz, portfolio #1), not of our own site: its headline,
 * badge, buttons and lesson card are the ones on the live landing page (see
 * the walkthrough video, 0:02), the tutor exchange uses problem 1 of the
 * "Venn Diagrams – Part 2" PDF shown in the same video, and the code card is
 * an illustration of its stack (PostgreSQL + pgvector RAG). No studio stats.
 *
 * Founder's rule (2026-10-10): real names live on the work wall only. So the
 * rebuild wears the visitor's name ("Your School" at yourdomain.com, like
 * 07's "Your Café"), and the copy says what kind of product it is. Set
 * SHOWS_PRODUCT_BRAND to true to show the product's own name and address
 * again (founder's call: it is a favourite of his).
 */
export const SHOWS_PRODUCT_BRAND = false;

const PRODUCT_SLUG = 'talim-ai';
const FALLBACK_HOST = 'talim-ai.uz';

export const PRODUCT: LabProject = getProjectBySlug(PRODUCT_SLUG) ?? LAB_PROJECTS[0];

function hostOf(website: string | undefined): string {
  if (!website) return FALLBACK_HOST;
  try {
    return new URL(website).host.replace(/^www\./, '');
  } catch {
    return FALLBACK_HOST;
  }
}

/** The product's own address; only shown when SHOWS_PRODUCT_BRAND is on (else `site.url` from messages). */
export const PRODUCT_HOST = hostOf(PRODUCT.website);

/** "an AI learning platform" (en, with its article) / "ИИ-платформа для обучения" (ru, uz: no article). */
export function useProductKind(): string {
  return useProjectDescriber().describe(PRODUCT);
}

/** The walkthrough, labelled by kind ("AI learning platform"), not by name, in the visitor's language. */
export function useProductMedia(): Pick<LabProject, 'name' | 'video' | 'poster'> {
  const title = useProjectDescriber().title(PRODUCT);
  return SHOWS_PRODUCT_BRAND ? PRODUCT : { name: title, video: PRODUCT.video, poster: PRODUCT.poster };
}

/** Language codes the description lists ("Works in Uzbek, English, and Russian"). */
const LANGUAGE_CODES: ReadonlyArray<[name: string, code: string]> = [
  ['Uzbek', 'uz'],
  ['English', 'en'],
  ['Russian', 'ru'],
];
export const PRODUCT_LANGUAGES = LANGUAGE_CODES.filter(([name]) => PRODUCT.description.includes(name))
  .map(([, code]) => code)
  .join(' / ');

/** A count-up number; `time` renders seconds as m:ss. */
export interface CountSpec {
  value: number;
  format?: 'time';
}

/** Stage ids in story order (labels and lines: `home.assembly.stages.<id>`). */
export const STAGE_IDS = ['design', 'frontend', 'backend', 'launch'] as const;
export type StageId = (typeof STAGE_IDS)[number];

/** Nav links of the mini site (`home.assembly.site.links.<id>`). */
export const SITE_LINK_IDS = ['how', 'schools', 'pricing'] as const;

/** The lesson card's numbers (from the walkthrough); counted up by the timeline. */
export const LESSON = {
  kind: 'PDF',
  pages: { value: 18 } satisfies CountSpec,
  minutes: { value: 12 } satisfies CountSpec,
  rows: [
    { id: 'summary' },
    { id: 'podcast', count: { value: 380, format: 'time' } satisfies CountSpec },
    { id: 'quiz', count: { value: 10 } satisfies CountSpec },
  ],
  mastery: { value: 72 } satisfies CountSpec,
} as const;

/** Badge on the tutor card: the technique's name, the same in every language. */
export const TUTOR_BADGE = 'RAG';
export const CODE_FILE = 'api/tutor.ts';
export const LAUNCH_STATUS = '200 OK';
