import { LAB_PROJECTS } from '../../media/portfolio';

/**
 * The full toolbox (the drawer under the tower): everything we build with,
 * sorted into eight areas (no Web3, crypto or blockchain: founder's call,
 * 2026-10-10). The tower above shows the core of one kind of product; this
 * is the whole yard.
 *
 * Each tool has one plain line for buyers (what it is for, never a claim
 * about our projects), in messages: `home.stack-physics.tools.<id>`, like
 * every other word here (areas `trades.<id>`, kits `kits.<id>`, generic tool
 * names `labels.<id>`; brand names stay as data). The words reach the
 * builders through `StackWords` (useStackWords.ts). `inPortfolio` is the only
 * portfolio fact here,
 * and it is computed: a tool is marked when one of its `tech` patterns
 * matches a technology token of a real project (projects.ts → LAB_PROJECTS,
 * split on "/"). Descriptions are never searched, so a mention ("searches
 * Telegram") never counts as having built with it.
 *
 * Market: the route locale decides who is reading. `en` is the global market
 * (Stripe, Apple Pay, Google Maps first; Uzbekistan's services last and out
 * of the kits); `uz` and `ru` are the home market (Payme, Click, MyID first).
 *
 * Kits are the "what are you building?" picker: the tools a typical product
 * of that kind draws on, matching the "how we build" chapter (Telegram,
 * mobile, web, RAG, CRM). They are a menu we pick from per product, not a
 * list of past projects.
 */

export type Market = 'global' | 'local';

export function marketForLocale(locale: string): Market {
  return locale === 'en' ? 'global' : 'local';
}

interface ToolDef {
  id: string;
  /** The brand name; a generic name ("AI agents") comes from messages (GENERIC_LABELS). */
  label: string;
  /** Matches one technology token of a portfolio project. */
  tech?: RegExp;
  /** An Uzbekistan-only service: last for the global market, and out of its kits. */
  isLocal?: boolean;
}

interface TradeDef {
  id: string;
  tools: readonly ToolDef[];
}

const TRADE_DEFS = [
  {
    id: 'mobile',
    tools: [
      { id: 'react-native', label: 'React Native', tech: /^React Native\b/ },
      { id: 'swift', label: 'Swift', tech: /^Swift$/ },
      { id: 'swiftui', label: 'SwiftUI' },
      { id: 'kotlin', label: 'Kotlin', tech: /^Kotlin$/ },
      { id: 'compose', label: 'Jetpack Compose' },
      { id: 'expo', label: 'Expo', tech: /\bExpo\b/ },
      { id: 'flutter', label: 'Flutter' },
      { id: 'dart', label: 'Dart' },
    ],
  },
  {
    id: 'web',
    tools: [
      { id: 'next', label: 'Next.js', tech: /^Next\.js\b/ },
      { id: 'react', label: 'React', tech: /^React( \d+)?$/ },
      { id: 'typescript', label: 'TypeScript', tech: /^TypeScript$/ },
      { id: 'tailwind', label: 'Tailwind CSS', tech: /^Tailwind\b/ },
      { id: 'vue', label: 'Vue' },
      { id: 'nuxt', label: 'Nuxt' },
      { id: 'angular', label: 'Angular' },
      { id: 'svelte', label: 'Svelte', tech: /^Svelte(Kit)?$/ },
      { id: 'vite', label: 'Vite', tech: /^Vite$/ },
      { id: 'redux', label: 'Redux Toolkit', tech: /^Redux\b/ },
      {
        id: 'tanstack',
        label: 'TanStack Query',
        tech: /^(TanStack|React) Query$/,
      },
      { id: 'shadcn', label: 'shadcn/ui', tech: /shadcn/ },
      { id: 'mui', label: 'Material UI', tech: /^Material UI$/ },
    ],
  },
  {
    id: 'backend',
    tools: [
      {
        id: 'node',
        label: 'Node.js',
        tech: /^(Node\.js|Express|NestJS|Strapi)$/,
      },
      { id: 'nest', label: 'NestJS', tech: /^NestJS$/ },
      { id: 'express', label: 'Express', tech: /^Express$/ },
      { id: 'strapi', label: 'Strapi', tech: /^Strapi$/ },
      { id: 'python', label: 'Python' },
      { id: 'fastapi', label: 'FastAPI' },
      { id: 'django', label: 'Django' },
      { id: 'go', label: 'Go' },
      { id: 'rust', label: 'Rust' },
      { id: 'java', label: 'Java' },
      { id: 'spring', label: 'Spring Boot' },
      { id: 'ktor', label: 'Ktor' },
      { id: 'dotnet', label: 'C# / .NET', tech: /^ASP\.NET\b/ },
      { id: 'php', label: 'PHP' },
      { id: 'laravel', label: 'Laravel' },
      { id: 'graphql', label: 'GraphQL', tech: /GraphQL/ },
      { id: 'grpc', label: 'gRPC' },
      { id: 'websockets', label: 'WebSockets', tech: /WebSocket|Socket\.io/ },
    ],
  },
  {
    id: 'data',
    tools: [
      { id: 'postgres', label: 'PostgreSQL', tech: /^PostgreSQL\b/ },
      { id: 'redis', label: 'Redis' },
      { id: 'mysql', label: 'MySQL' },
      { id: 'sqlserver', label: 'SQL Server', tech: /^SQL Server$/ },
      { id: 'mongodb', label: 'MongoDB' },
      { id: 'sqlite', label: 'SQLite', tech: /^SQLite$/ },
      { id: 'clickhouse', label: 'ClickHouse' },
      { id: 'elasticsearch', label: 'Elasticsearch' },
      { id: 'kafka', label: 'Kafka' },
      { id: 'rabbitmq', label: 'RabbitMQ' },
      { id: 'prisma', label: 'Prisma', tech: /^Prisma$/ },
      { id: 'drizzle', label: 'Drizzle', tech: /Drizzle/ },
    ],
  },
  {
    id: 'ai',
    tools: [
      { id: 'openai', label: 'OpenAI' },
      { id: 'claude', label: 'Anthropic Claude' },
      { id: 'gemini', label: 'Google Gemini' },
      { id: 'open-llm', label: 'Open-source LLMs' },
      { id: 'rag', label: 'RAG', tech: /^RAG$/ },
      { id: 'pgvector', label: 'pgvector', tech: /pgvector/ },
      { id: 'qdrant', label: 'Qdrant' },
      { id: 'langchain', label: 'LangChain' },
      { id: 'llamaindex', label: 'LlamaIndex' },
      { id: 'agents', label: 'AI agents' },
      { id: 'speech', label: 'Speech to text' },
      { id: 'vision', label: 'Computer vision' },
    ],
  },
  {
    id: 'cloud',
    tools: [
      { id: 'aws', label: 'AWS', tech: /^AWS\b/ },
      { id: 'gcp', label: 'Google Cloud' },
      { id: 'azure', label: 'Azure', tech: /^Azure\b/ },
      { id: 'docker', label: 'Docker', tech: /^Docker$/ },
      { id: 'kubernetes', label: 'Kubernetes' },
      { id: 'terraform', label: 'Terraform' },
      { id: 'github-actions', label: 'GitHub Actions' },
      { id: 'vercel', label: 'Vercel' },
      { id: 'cloudflare', label: 'Cloudflare' },
      { id: 'nginx', label: 'Nginx' },
    ],
  },
  {
    id: 'integrations',
    tools: [
      { id: 'stripe', label: 'Stripe', tech: /^Stripe$/ },
      { id: 'wallet-pay', label: 'Apple Pay & Google Pay' },
      {
        id: 'iap',
        label: 'In-app purchases',
        tech: /^(In-app purchases|react-native-iap)$/,
      },
      {
        id: 'google-maps',
        label: 'Google Maps',
        tech: /^(Google Maps|react-native-maps)$/,
      },
      { id: 'firebase', label: 'Firebase', tech: /^(Firebase|Firestore)$/ },
      { id: 'onesignal', label: 'OneSignal', tech: /^OneSignal$/ },
      { id: 'sentry', label: 'Sentry' },
      { id: 'webrtc', label: 'WebRTC', tech: /^WebRTC$/ },
      { id: 'telegram-bot', label: 'Telegram Bot API' },
      { id: 'telegram-mini', label: 'Telegram Mini Apps' },
      { id: 'payme', label: 'Payme', tech: /^Payme$/, isLocal: true },
      { id: 'click', label: 'Click', tech: /^Click( API)?$/, isLocal: true },
      {
        id: 'yandex-maps',
        label: 'Yandex Maps',
        tech: /^Yandex (MapKit|routing)$/,
        isLocal: true,
      },
      { id: 'myid', label: 'MyID', tech: /^MyID\b/, isLocal: true },
      { id: 'e-imzo', label: 'E-IMZO', tech: /^E-IMZO$/, isLocal: true },
    ],
  },
  {
    id: 'design',
    tools: [
      { id: 'figma', label: 'Figma', tech: /^Figma$/ },
      { id: 'rive', label: 'Rive' },
      { id: 'lottie', label: 'Lottie' },
      { id: 'blender', label: 'Blender' },
      { id: 'threejs', label: 'Three.js' },
      { id: 'gsap', label: 'GSAP' },
    ],
  },
] as const satisfies readonly TradeDef[];

export type TradeId = (typeof TRADE_DEFS)[number]['id'];
export type ToolId = (typeof TRADE_DEFS)[number]['tools'][number]['id'];

export type KitId = 'telegram' | 'mobile' | 'web' | 'rag' | 'crm';

/** Tools named by what they are, not a brand: their names are translated (`labels.<id>`). */
export const GENERIC_LABELS = ['open-llm', 'agents', 'speech', 'vision', 'iap', 'wallet-pay'] as const;
export type GenericLabelId = (typeof GENERIC_LABELS)[number];

/** A kit's words in the page's language (`kits.<id>`). */
export interface KitWords {
  label: string;
  /** Who the notes are about ("a mobile app"). */
  subject: string;
  /** The same, after "for" ("for a mobile app" / "для мобильного приложения" / "mobil ilova uchun"). */
  forSubject: string;
  /** The tower's business line while this kit stands. */
  headline: string;
  /** The tower's top layer, in the owner's words ("the app your customers tap"). */
  top: string;
  /** How we choose within the kit. */
  rider: string;
}

/** Every word the toolbox and the tower need, resolved from messages by useStackWords(). */
export interface StackWords {
  toolBlurb: (id: ToolId) => string;
  genericLabel: (id: GenericLabelId) => string;
  trade: (id: TradeId) => { name: string; role: string };
  kit: (id: KitId) => KitWords;
}

const GENERIC = new Set<string>(GENERIC_LABELS);
const isGeneric = (id: string): id is GenericLabelId => GENERIC.has(id);

export interface ToolboxTool {
  id: ToolId;
  label: string;
  blurb: string;
  trade: TradeId;
  /** Position across the whole toolbox (0 = first), for staggered motion. */
  order: number;
  /** A real portfolio project lists it in its technology. */
  inPortfolio: boolean;
  /** The kits that light it up, space-separated (a CSS `~=` hook: `[data-kits~='mobile']`). */
  kits: string;
}

export interface ToolboxTrade {
  id: TradeId;
  /** "01" = the first area. */
  number: string;
  name: string;
  role: string;
  tools: readonly ToolboxTool[];
}

interface KitDef {
  id: KitId;
  tools: readonly ToolId[];
}

/** In the order of the "how we build" chapter: Telegram, mobile, web, RAG, CRM. */
const KIT_DEFS: readonly KitDef[] = [
  {
    id: 'telegram',
    tools: [
      'telegram-bot',
      'telegram-mini',
      'react',
      'typescript',
      'vite',
      'tailwind',
      'node',
      'python',
      'postgres',
      'redis',
      'stripe',
      'payme',
      'click',
      'openai',
      'docker',
      'sentry',
    ],
  },
  {
    id: 'mobile',
    tools: [
      'react-native',
      'swift',
      'swiftui',
      'kotlin',
      'compose',
      'expo',
      'flutter',
      'dart',
      'typescript',
      'node',
      'nest',
      'postgres',
      'redis',
      'firebase',
      'onesignal',
      'sentry',
      'stripe',
      'wallet-pay',
      'iap',
      'google-maps',
      'yandex-maps',
      'payme',
      'click',
      'myid',
      'github-actions',
      'aws',
      'figma',
      'lottie',
      'rive',
    ],
  },
  {
    id: 'web',
    tools: [
      'next',
      'react',
      'typescript',
      'tailwind',
      'vue',
      'nuxt',
      'svelte',
      'vite',
      'node',
      'strapi',
      'postgres',
      'stripe',
      'wallet-pay',
      'payme',
      'click',
      'vercel',
      'cloudflare',
      'sentry',
      'figma',
      'gsap',
      'threejs',
    ],
  },
  {
    id: 'rag',
    tools: [
      'python',
      'fastapi',
      'openai',
      'claude',
      'gemini',
      'open-llm',
      'langchain',
      'llamaindex',
      'rag',
      'pgvector',
      'qdrant',
      'agents',
      'speech',
      'vision',
      'postgres',
      'elasticsearch',
      'redis',
      'next',
      'telegram-bot',
      'docker',
    ],
  },
  {
    id: 'crm',
    tools: [
      'react',
      'next',
      'angular',
      'typescript',
      'tailwind',
      'shadcn',
      'tanstack',
      'node',
      'nest',
      'go',
      'spring',
      'dotnet',
      'django',
      'laravel',
      'postgres',
      'mysql',
      'redis',
      'clickhouse',
      'rabbitmq',
      'kafka',
      'docker',
      'kubernetes',
      'github-actions',
      'telegram-bot',
      'stripe',
      'click',
      'e-imzo',
      'sentry',
    ],
  },
];

export const DEFAULT_KIT: KitId = 'mobile';

export interface Kit extends KitWords {
  id: KitId;
  tools: ReadonlySet<ToolId>;
}

export interface Toolbox {
  trades: readonly ToolboxTrade[];
  kits: readonly Kit[];
  total: number;
  /** Tools a real portfolio project lists. */
  portfolioTotal: number;
}

const PROJECT_TOKENS: readonly string[] = LAB_PROJECTS.flatMap(project => project.tech);

function isInPortfolio(tech: RegExp | undefined): boolean {
  return tech ? PROJECT_TOKENS.some(token => tech.test(token)) : false;
}

const LOCAL_TOOLS = new Set<string>(
  TRADE_DEFS.flatMap(trade => (trade.tools as readonly ToolDef[]).filter(tool => tool.isLocal).map(tool => tool.id))
);

/** Home market: Uzbekistan's services lead their area; global: they close it. */
function ordered(tools: readonly ToolDef[], market: Market): readonly ToolDef[] {
  if (market === 'global') return tools;
  return [...tools.filter(tool => tool.isLocal), ...tools.filter(tool => !tool.isLocal)];
}

/** The toolbox for a market, in the words given (build it once per locale: useStackWords). */
export function buildToolbox(market: Market, words: StackWords): Toolbox {
  const kits: Kit[] = KIT_DEFS.map(kit => ({
    id: kit.id,
    ...words.kit(kit.id),
    // A visitor abroad is never told a kit "usually takes" a service only Uzbekistan uses.
    tools: new Set(kit.tools.filter(id => market === 'local' || !LOCAL_TOOLS.has(id))),
  }));
  let nextOrder = 0;
  const trades: ToolboxTrade[] = TRADE_DEFS.map((trade, tradeIndex) => ({
    id: trade.id,
    number: String(tradeIndex + 1).padStart(2, '0'),
    ...words.trade(trade.id),
    tools: ordered(trade.tools, market).map(tool => ({
      id: tool.id as ToolId,
      label: isGeneric(tool.id) ? words.genericLabel(tool.id) : tool.label,
      blurb: words.toolBlurb(tool.id as ToolId),
      trade: trade.id,
      order: nextOrder++,
      inPortfolio: isInPortfolio(tool.tech),
      kits: kits
        .filter(kit => kit.tools.has(tool.id as ToolId))
        .map(kit => kit.id)
        .join(' '),
    })),
  }));
  const tools = trades.flatMap(trade => trade.tools);
  return { trades, kits, total: tools.length, portfolioTotal: tools.filter(tool => tool.inPortfolio).length };
}

/** Tool ids in toolbox order, for message checks. */
export const TOOL_IDS: readonly ToolId[] = TRADE_DEFS.flatMap(trade => trade.tools.map(tool => tool.id));
