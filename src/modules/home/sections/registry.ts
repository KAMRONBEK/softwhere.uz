'use client';

import dynamic from 'next/dynamic';
import SectionFallback from '../components/SectionFallback';
import { preloadSectionMessages, withSectionMessages } from '../components/SectionMessages';
import { LAB_COPY } from '../copy';
import HeroFallback from './s01/HeroFallback';
import HeroGate from './s01/HeroGate';
import ManifestoFallback from './s02/ManifestoFallback';
import AIDemoFallback from './s08/AIDemoFallback';
import FinaleFallback from './s14/FinaleFallback';
import { SECTION_IDS, type LabSectionDef, type LabSectionProps, type SectionEdge, type SectionId, type SectionMeta } from '../types';
import { createElement, useContext, type ComponentType, type ReactElement } from 'react';
import { LabSlotsContext, type LabSlots } from '../context/LabContext';
import './heights.css';

/**
 * The prototype's sections, in page order. Each one is its own chunk
 * (next/dynamic) and the shell renders it only when it is ~1 viewport away,
 * so no section's code loads before it is near.
 *
 * `ssr: false` is set where the section is WebGL/physics-heavy and has no
 * useful server HTML. The others may SSR in ?only= mode. If your section
 * touches window/document during render, it needs `ssr: false` here.
 *
 * `minHeight` is the space reserved before the section mounts and its floor
 * afterwards. Taller scroll stories should report their real height so lazy
 * mounting never shifts the page.
 */
/**
 * While a section's chunk is still loading, keep its static stand-in on
 * screen instead of an empty box: the hero's stand-in is the page's LCP
 * (headline, subline, CTAs), and an `ssr: false` section otherwise renders
 * nothing between LazyMount swapping the fallback out and its code arriving.
 * Resolved at render time, after SECTIONS below is built.
 */
function standIn(id: SectionId): () => ReactElement {
  return function SectionStandIn() {
    // The slot's floor too (as the shell's LazyMount box has it), or the AI demo's stand-in would
    // reserve the scripted demo's height while its chunk loads and the page would grow, then shrink.
    const { meta, Fallback } = withSlotFloor(SECTION_BY_ID[id], useContext(LabSlotsContext));
    return createElement(Fallback, { meta });
  };
}

/** A section whose slot the app layer filled reserves the slot's floor (`slotMinHeight`) instead of the fallback's. */
export function withSlotFloor(section: LabSectionDef, slots: LabSlots): LabSectionDef {
  const { meta } = section;
  const hasSlot = slots[meta.id] !== undefined && slots[meta.id] !== null && slots[meta.id] !== false;
  return hasSlot && meta.slotMinHeight ? { ...section, meta: { ...meta, minHeight: meta.slotMinHeight } } : section;
}

/**
 * A section's chunk together with its copy: the code and `home.<id>` load in
 * parallel, and the section renders inside its own messages provider
 * (components/SectionMessages.tsx). The page's HTML only carries the copy the
 * static fallbacks need (sections/eagerMessages.ts).
 */
function withCopy(id: SectionId, chunk: Promise<{ default: ComponentType<LabSectionProps> }>) {
  return Promise.all([chunk, preloadSectionMessages(id)]).then(([mod]) => withSectionMessages(id)(mod));
}

/**
 * The hero is not a next/dynamic chunk: HeroGate (s01/HeroGate.tsx) keeps the
 * static HeroFallback until the visitor's first input or an idle moment after
 * load, and imports the WebGL hero only then (never on reduced motion,
 * Save-Data or the low tier).
 */
const S02Manifesto = dynamic(() => withCopy('manifesto', import('./S02Manifesto')), { loading: standIn('manifesto') });
const S03XRay = dynamic(() => withCopy('xray', import('./S03XRay')), { ssr: false, loading: standIn('xray') });
const S04Assembly = dynamic(() => withCopy('assembly', import('./S04Assembly')), { loading: standIn('assembly') });
const S05CodeToUI = dynamic(() => withCopy('code-to-ui', import('./S05CodeToUI')), { loading: standIn('code-to-ui') });
const S06Devices = dynamic(() => withCopy('devices', import('./S06Devices')), { ssr: false, loading: standIn('devices') });
const S07Telegram = dynamic(() => withCopy('telegram', import('./S07Telegram')), { loading: standIn('telegram') });
// The "how we build" chapter after Telegram (files numbered by when they were added).
const S15MobileBuild = dynamic(() => withCopy('mobile-build', import('./S15MobileBuild')), { loading: standIn('mobile-build') });
const S16WebBuild = dynamic(() => withCopy('web-build', import('./S16WebBuild')), { loading: standIn('web-build') });
const S17RagBuild = dynamic(() => withCopy('rag-build', import('./S17RagBuild')), { loading: standIn('rag-build') });
const S18CrmBuild = dynamic(() => withCopy('crm-build', import('./S18CrmBuild')), { loading: standIn('crm-build') });
const S08AIDemo = dynamic(() => withCopy('ai-demo', import('./S08AIDemo')), { loading: standIn('ai-demo') });
const S09WorkWall = dynamic(() => withCopy('work-wall', import('./S09WorkWall')), { loading: standIn('work-wall') });
const S10Numbers = dynamic(() => withCopy('numbers', import('./S10Numbers')), { loading: standIn('numbers') });
const S11Globe = dynamic(() => withCopy('globe', import('./S11Globe')), { ssr: false, loading: standIn('globe') });
const S12Process = dynamic(() => withCopy('process', import('./S12Process')), { loading: standIn('process') });
const S13StackPhysics = dynamic(() => withCopy('stack-physics', import('./S13StackPhysics')), {
  ssr: false,
  loading: standIn('stack-physics'),
});
const S14Finale = dynamic(() => withCopy('finale', import('./S14Finale')), { loading: standIn('finale') });

const COMPONENTS: Record<SectionId, ComponentType<LabSectionProps>> = {
  hero: HeroGate,
  manifesto: S02Manifesto,
  xray: S03XRay,
  assembly: S04Assembly,
  'code-to-ui': S05CodeToUI,
  devices: S06Devices,
  telegram: S07Telegram,
  'mobile-build': S15MobileBuild,
  'web-build': S16WebBuild,
  'rag-build': S17RagBuild,
  'crm-build': S18CrmBuild,
  'ai-demo': S08AIDemo,
  'work-wall': S09WorkWall,
  numbers: S10Numbers,
  globe: S11Globe,
  process: S12Process,
  'stack-physics': S13StackPhysics,
  finale: S14Finale,
};

/**
 * Each section's real height. Fixed scroll stories are plain lengths (they
 * must match the section's own CSS); content-height sections read a
 * breakpoint-aware custom property from heights.css.
 */
const MIN_HEIGHT: Partial<Record<SectionId, string>> = {
  hero: '120svh',
  manifesto: 'var(--lab-h-manifesto)',
  assembly: '200svh',
  'code-to-ui': 'var(--lab-h-code-to-ui)',
  devices: '400svh',
  telegram: 'var(--lab-h-telegram)',
  'mobile-build': 'var(--lab-h-mobile-build)',
  'web-build': 'var(--lab-h-web-build)',
  'rag-build': 'var(--lab-h-rag-build)',
  'crm-build': 'var(--lab-h-crm-build)',
  'ai-demo': 'var(--lab-h-ai-demo)',
  'work-wall': 'var(--lab-h-work-wall)',
  numbers: '300svh',
  globe: '280svh',
  process: 'var(--lab-h-process)',
  'stack-physics': 'var(--lab-h-stack-physics)',
  finale: 'var(--lab-h-finale)',
};
const DEFAULT_MIN_HEIGHT = '100svh';

/**
 * The floor when the app layer fills the section's slot: the real AI brief's
 * idle composer is about half as tall as the scripted demo on a phone, so the
 * demo's height would leave a blank band before 13 · Work wall.
 */
const SLOT_MIN_HEIGHT: Partial<Record<SectionId, string>> = {
  'ai-demo': 'var(--lab-h-ai-demo-slot)',
};

/**
 * Seams the shell softens: the glow behind Devices and the dust behind
 * Numbers would stop in a hard line above the next section, and the Finale's
 * warp streaks would start at a ruler edge under the Stack floor. (The
 * Globe's light pool fades out inside its own backdrop: its route bar sits
 * too close to the bottom edge for an overlay.)
 */
const FADE_EDGES: Partial<Record<SectionId, readonly SectionEdge[]>> = {
  devices: ['bottom'],
  numbers: ['bottom'],
  finale: ['top'],
};
const NO_FADE: readonly SectionEdge[] = [];

/**
 * Static stand-ins rendered before a section mounts — and so the server HTML
 * of the homepage (crawlers, no-JS, first paint). Default: SectionFallback
 * (the section's `heading` + `summary` messages). A section may register a
 * richer one here (the hero's LCP layout, say): a light, statically imported
 * component — no GSAP, WebGL, matter-js or other heavy imports — that renders
 * the same SectionHeading (h1 for the hero).
 */
const FALLBACKS: Partial<Record<SectionId, ComponentType<LabSectionProps>>> = {
  hero: HeroFallback,
  manifesto: ManifestoFallback,
  'ai-demo': AIDemoFallback,
  finale: FinaleFallback,
};

export const SECTIONS: readonly LabSectionDef[] = SECTION_IDS.map((id, index) => ({
  meta: {
    id,
    number: String(index + 1).padStart(2, '0'),
    name: LAB_COPY.sections[id].name,
    brief: LAB_COPY.sections[id].brief,
    minHeight: MIN_HEIGHT[id] ?? DEFAULT_MIN_HEIGHT,
    ...(SLOT_MIN_HEIGHT[id] ? { slotMinHeight: SLOT_MIN_HEIGHT[id] } : {}),
    fadeEdges: FADE_EDGES[id] ?? NO_FADE,
  },
  Component: COMPONENTS[id],
  Fallback: FALLBACKS[id] ?? SectionFallback,
}));

const SECTION_BY_ID = Object.fromEntries(SECTIONS.map(section => [section.meta.id, section])) as Record<SectionId, LabSectionDef>;

export const SECTION_METAS: readonly SectionMeta[] = SECTIONS.map(section => section.meta);
