import { LAB_PROJECTS, type LabProject } from '../../media/portfolio';
import type { KitId, Market } from './stack-data';

/**
 * The tower: the core of one kind of product (the kit the visitor picked),
 * sorted into the four layers every product is built in, bottom (data) to
 * top (delivery). Only real tools, never categories ("Stripe", not
 * "Payments"). A kit's tower is the same on every screen, so its count reads
 * the same on a phone and a desktop.
 *
 * Each block carries a plain line for buyers (messages:
 * `home.stack-physics.tower.<id>`, layer names `layers.<id>`, resolved by
 * useStackWords) and a project count taken from the real portfolio data (projects.ts → LAB_PROJECTS), never
 * typed in by hand. Counts under COUNT_FLOOR are kept but not shown: a small
 * number says less about a tool than its job does. Matching is per
 * technology token (projects.ts `technology` split on "/"), plus the English
 * description where the tech field is silent (Telegram).
 */

export type LayerId = 'data' | 'logic' | 'interface' | 'delivery';

export interface StackLayerDef {
  id: LayerId;
  /** "01" = the foundation. */
  number: string;
}

export interface StackLayer extends StackLayerDef {
  name: string;
  /** What the layer does, in a buyer's words. */
  role: string;
}

/** Bottom first: the order the tower is built in. */
export const STACK_LAYERS: readonly StackLayerDef[] = [
  { id: 'data', number: '01' },
  { id: 'logic', number: '02' },
  { id: 'interface', number: '03' },
  { id: 'delivery', number: '04' },
];

interface TowerToolDef {
  /** A brand name (stays as data in every language). */
  label: string;
  /** Matches one technology token. */
  tech?: RegExp;
  /** Matches the English description (only where the tech field is silent). */
  description?: RegExp;
  /** A project fact instead of a token (a live store listing). */
  uses?: (project: LabProject) => boolean;
}

const TOWER_TOOLS = {
  // Data
  postgres: { label: 'PostgreSQL', tech: /^PostgreSQL\b/ },
  redis: { label: 'Redis' },
  firebase: { label: 'Firebase', tech: /^(Firebase|Firestore)$/ },
  pgvector: { label: 'pgvector', tech: /pgvector/ },
  qdrant: { label: 'Qdrant' },
  clickhouse: { label: 'ClickHouse' },
  // Logic
  nest: { label: 'NestJS', tech: /^NestJS$/ },
  node: { label: 'Node.js', tech: /^(Node\.js|Express|NestJS|Strapi)$/ },
  strapi: { label: 'Strapi', tech: /^Strapi$/ },
  fastapi: { label: 'FastAPI' },
  rabbitmq: { label: 'RabbitMQ' },
  openai: { label: 'OpenAI' },
  claude: { label: 'Claude' },
  onesignal: { label: 'OneSignal', tech: /^OneSignal$/ },
  stripe: { label: 'Stripe', tech: /^Stripe$/ },
  payme: { label: 'Payme', tech: /^Payme$/ },
  click: { label: 'Click', tech: /^Click( API)?$/ },
  // Interface
  'react-native': {
    label: 'React Native',
    tech: /^React Native\b/,
  },
  swift: { label: 'Swift', tech: /^Swift$/ },
  kotlin: { label: 'Kotlin', tech: /^Kotlin$/ },
  next: { label: 'Next.js', tech: /^Next\.js\b/ },
  react: { label: 'React', tech: /^React( \d+)?$/ },
  tailwind: { label: 'Tailwind', tech: /^Tailwind\b/ },
  vite: { label: 'Vite', tech: /^Vite$/ },
  shadcn: { label: 'shadcn/ui', tech: /shadcn/ },
  // Delivery
  // Counted by live listings, so the stat means "published there", not just "built for iOS".
  'app-store': { label: 'App Store', uses: project => Boolean(project.appStore) },
  'google-play': { label: 'Google Play', uses: project => Boolean(project.playMarket) },
  vercel: { label: 'Vercel' },
  cloudflare: { label: 'Cloudflare' },
  telegram: {
    label: 'Telegram',
    description: /\bTelegram\b/,
  },
  'mini-apps': { label: 'Mini Apps' },
  docker: { label: 'Docker', tech: /^Docker$/ },
  aws: { label: 'AWS', tech: /^AWS\b/ },
  'github-actions': { label: 'GitHub Actions' },
} as const satisfies Record<string, TowerToolDef>;

export type TowerToolId = keyof typeof TOWER_TOOLS;
/** One tool everywhere, or one per market (Stripe abroad, Payme at home). */
type Pick = TowerToolId | { global: TowerToolId; local: TowerToolId };

/** Per kit, per layer (bottom first), left to right. */
const KIT_TOWERS: Record<KitId, Record<LayerId, readonly Pick[]>> = {
  telegram: {
    data: ['postgres', 'redis'],
    logic: ['node', 'openai', { global: 'stripe', local: 'payme' }],
    interface: ['react', 'vite', 'tailwind'],
    delivery: ['telegram', 'mini-apps'],
  },
  mobile: {
    data: ['postgres', 'redis', 'firebase'],
    logic: ['nest', 'onesignal', { global: 'stripe', local: 'payme' }],
    interface: ['react-native', 'swift', 'kotlin'],
    delivery: ['app-store', 'google-play'],
  },
  web: {
    data: ['postgres', 'redis'],
    logic: ['node', 'strapi', { global: 'stripe', local: 'payme' }],
    interface: ['next', 'react', 'tailwind'],
    delivery: ['vercel', 'cloudflare'],
  },
  rag: {
    data: ['postgres', 'pgvector', 'qdrant'],
    logic: ['fastapi', 'openai', 'claude'],
    interface: ['next', 'telegram'],
    delivery: ['docker', 'aws'],
  },
  crm: {
    data: ['postgres', 'redis', 'clickhouse'],
    logic: ['nest', 'rabbitmq', { global: 'stripe', local: 'click' }],
    interface: ['react', 'next', 'shadcn'],
    delivery: ['docker', 'aws', 'github-actions'],
  },
};

/** Counts below this stay off screen (the judges' rule: show strong numbers only). */
export const COUNT_FLOOR = 10;

export interface StackTool {
  id: TowerToolId;
  label: string;
  layer: LayerId;
  /** 0 = the foundation layer. */
  layerIndex: number;
  blurb: string;
  /** Portfolio projects that used it. */
  count: number;
}

function usesTool(project: LabProject, def: TowerToolDef): boolean {
  if (def.uses) return def.uses(project);
  const byTech = def.tech ? project.tech.some(token => def.tech?.test(token)) : false;
  const byDescription = def.description ? def.description.test(project.description) : false;
  return byTech || byDescription;
}

const COUNTS = new Map<TowerToolId, number>(
  (Object.keys(TOWER_TOOLS) as TowerToolId[]).map(id => [id, LAB_PROJECTS.filter(project => usesTool(project, TOWER_TOOLS[id])).length])
);

function resolve(pick: Pick, market: Market): TowerToolId {
  return typeof pick === 'string' ? pick : pick[market];
}

/**
 * The tower for a kit, bottom layer first, with each block's line from
 * `blurbOf` (the page's language). useStackWords builds every kit's tower
 * once per locale and market, so a tower keeps its identity across renders.
 */
export function buildTower(kit: KitId, market: Market, blurbOf: (id: TowerToolId) => string): readonly StackTool[] {
  return STACK_LAYERS.flatMap((layer, layerIndex) =>
    KIT_TOWERS[kit][layer.id].map(pick => {
      const id = resolve(pick, market);
      const def: TowerToolDef = TOWER_TOOLS[id];
      return { id, label: def.label, layer: layer.id, layerIndex, blurb: blurbOf(id), count: COUNTS.get(id) ?? 0 };
    })
  );
}

/** Portfolio size the counts are taken from. */
export const PROJECT_TOTAL = LAB_PROJECTS.length;
