import type { SectionId } from './types';

/**
 * Founder-facing copy only (English): the staging route's metadata, the Lab
 * panel and the section names/briefs it lists. Nothing here reaches visitors;
 * visitor copy lives in src/messages/home/<part>/{en,ru,uz}.json.
 */
export const LAB_COPY = {
  meta: {
    title: 'Homepage lab — SoftWhere',
    description: 'Hidden prototype of the SoftWhere homepage. Not for indexing.',
  },
  panel: {
    open: 'Lab',
    close: 'Close',
    title: 'Homepage lab',
    style: 'Style',
    logo: 'Logo',
    logoColor: 'Logo color',
    logoColorBrand: 'Brand orange',
    logoColorAccent: 'Style accent',
    quality: 'Quality',
    qualityAuto: 'Auto',
    qualityHigh: 'High',
    qualityLow: 'Low',
    detected: 'Detected',
    sections: 'Sections',
    solo: 'Solo',
    showAll: 'Show all sections',
    soloActive: 'Showing one section',
    copyLink: 'Copy link',
    copied: 'Copied',
  },
  sections: {
    hero: {
      name: 'Hero',
      brief: 'Logo and headline over a live WebGL scene built from our real project footage.',
    },
    manifesto: {
      name: 'Manifesto',
      brief: 'Scroll-scrubbed kinetic typography: what the studio promises, word by word.',
    },
    xray: {
      name: 'X-Ray',
      brief: 'A cursor or finger lens that reveals the wireframe and code beneath a finished app screen.',
    },
    assembly: {
      name: 'Assembly',
      brief: 'An app assembles itself from exploded UI layers as you scroll.',
    },
    'code-to-ui': {
      name: 'Code to UI',
      brief: 'Code types itself on one side and compiles into a live interface on the other.',
    },
    devices: {
      name: 'Devices',
      brief: '3D phone, tablet and laptop playing real walkthrough videos, turning with the scroll.',
    },
    telegram: {
      name: 'Telegram',
      brief: 'A Telegram bot and Mini App conversation that plays out as you scroll.',
    },
    'mobile-build': {
      name: 'Mobile App',
      brief: 'How we build a mobile app, step by step on a phone as you scroll: screens, backend, store release.',
    },
    'web-build': {
      name: 'Website',
      brief: 'How we build a website, from layout to a fast, findable page live on the web, as you scroll.',
    },
    'rag-build': {
      name: 'AI on Your Docs',
      brief: 'How we put AI on your own documents (RAG): files go in, answers come back with their sources.',
    },
    'crm-build': {
      name: 'CRM & Admin',
      brief: 'How we build a CRM or admin system: roles, records, workflows and reports, assembled as you scroll.',
    },
    'ai-demo': {
      name: 'AI Demo',
      brief: 'AI automation, live: a messy request goes in, structured work comes out.',
    },
    'work-wall': {
      name: 'Work Wall',
      brief: 'An endless parallax wall of our real project videos; hover or tap to focus one.',
    },
    numbers: {
      name: 'Numbers',
      brief: 'Big animated counters: live store apps, shipped projects, countries, years.',
    },
    globe: {
      name: 'Globe',
      brief: 'A 3D globe with arcs from Tashkent to clients in the US, Europe and Central Asia.',
    },
    process: {
      name: 'Process',
      brief: 'How we work, as a pinned horizontal scroll story.',
    },
    'stack-physics': {
      name: 'Stack Physics',
      brief: 'Our tech stack falls and piles up with real physics; drag or tilt to play.',
    },
    finale: {
      name: 'Finale',
      brief: 'The closing call to action with a magnetic button and a final flourish.',
    },
  } satisfies Record<SectionId, { name: string; brief: string }>,
} as const;
