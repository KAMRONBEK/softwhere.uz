import type { ComponentType } from 'react';

/**
 * Section ids, in page order. Stable: they are URL params (?only=) and DOM ids.
 * A section's display number ('07 · Telegram') is its position here, so
 * inserting one renumbers everything after it (file names keep their prefix).
 */
export const SECTION_IDS = [
  'hero',
  'manifesto',
  'xray',
  'assembly',
  'code-to-ui',
  'devices',
  // The "how we build" chapter: 07 Telegram, then mobile, web, RAG and CRM.
  'telegram',
  'mobile-build',
  'web-build',
  'rag-build',
  'crm-build',
  'ai-demo',
  'work-wall',
  'numbers',
  'globe',
  'process',
  'stack-physics',
  'finale',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const STYLE_IDS = ['A', 'B', 'C', 'D'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

/** 1 Original (the reference drawing), 2 Refined (the default). */
export const LOGO_IDS = [1, 2] as const;
export type LogoId = (typeof LOGO_IDS)[number];

/** The mark's ink: SoftWhere's brand orange, or the active style's accent. */
export const LOGO_COLOR_IDS = ['brand', 'accent'] as const;
export type LogoColor = (typeof LOGO_COLOR_IDS)[number];

/** `mid` is accepted in the URL for testing but not shown in the panel. */
export const QUALITY_IDS = ['auto', 'high', 'mid', 'low'] as const;
export type Quality = (typeof QUALITY_IDS)[number];

export type DeviceTier = 'high' | 'mid' | 'low';

/** Everything the founder can change from the control panel; mirrored in the URL. */
export interface LabState {
  style: StyleId;
  logo: LogoId;
  logoColor: LogoColor;
  quality: Quality;
  /** Render only this section (fast testing), or every section when null. */
  only: SectionId | null;
}

export interface SectionMeta {
  id: SectionId;
  /** Two-digit display number, e.g. '03'. */
  number: string;
  name: string;
  brief: string;
  /**
   * Height the section reserves before (and after) it mounts, as a CSS length.
   * Match the section's real height (e.g. '300svh' for a sticky scroll story)
   * so lazy mounting never shifts the page.
   */
  minHeight: string;
  /**
   * The floor instead of `minHeight` when the app layer injected a slot for
   * this section (a real feature replaces the scripted fallback and has its
   * own, usually shorter, height). The shell picks it; sections never do.
   */
  slotMinHeight?: string;
  /**
   * Edges the shell melts into the page colour, for sections whose own
   * backdrop (a starfield, a glow) would otherwise end in a hard seam.
   */
  fadeEdges: readonly SectionEdge[];
}

export type SectionEdge = 'top' | 'bottom';

/** Props every section's default export receives. */
export interface LabSectionProps {
  meta: SectionMeta;
}

export interface LabSectionDef {
  /** Module-level object: identity is stable across renders. */
  meta: SectionMeta;
  Component: ComponentType<LabSectionProps>;
  /** Server-rendered static stand-in shown until the section mounts (SEO, first paint). */
  Fallback: ComponentType<LabSectionProps>;
}
