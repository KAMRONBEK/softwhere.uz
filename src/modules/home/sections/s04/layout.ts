/**
 * Motion config for the mini site, in design px. The page is laid out at a
 * fixed size in site.module.css and scaled to fit the stage (geometry.ts);
 * the timeline reads piece positions back from the DOM, so these offsets are
 * in the same units on every screen.
 */

export type PieceId = 'nav' | 'badge' | 'head' | 'sub' | 'cta1' | 'cta2' | 'lesson' | 'video' | 'tutor' | 'code';

export interface CameraPose {
  /** Tilt toward the viewer (deg). */
  rx: number;
  /** In-plane spin of the page (deg). */
  rz: number;
  scale: number;
  x: number;
  y: number;
}

export interface SiteLayout {
  id: 'wide' | 'narrow';
  /** Depth between layers in the exploded/layered views. */
  zStep: number;
  /** How far pieces fly from their slot in the exploded view (× distance from center). */
  scatter: number;
  /** Max random offset (px) added to the scatter. */
  jitter: number;
  /** How high the floating API card hovers while the site is styled and wired (× its layer depth). */
  codeLift: number;
  camera: { exploded: CameraPose; design: CameraPose; frontend: CameraPose; backend: CameraPose; launch: CameraPose };
}

export const WIDE: SiteLayout = {
  id: 'wide',
  zStep: 30,
  scatter: 0.3,
  jitter: 60,
  codeLift: 0.7,
  camera: {
    exploded: { rx: 56, rz: -26, scale: 0.72, x: -20, y: 60 },
    design: { rx: 52, rz: -22, scale: 0.78, x: -14, y: 46 },
    frontend: { rx: 40, rz: -14, scale: 0.86, x: -8, y: 28 },
    backend: { rx: 24, rz: -7, scale: 0.94, x: -2, y: 12 },
    launch: { rx: 0, rz: 0, scale: 1, x: 0, y: 0 },
  },
};

export const NARROW: SiteLayout = {
  id: 'narrow',
  zStep: 20,
  scatter: 0.2,
  jitter: 22,
  codeLift: 0.6,
  camera: {
    exploded: { rx: 52, rz: -18, scale: 0.8, x: 6, y: 40 },
    design: { rx: 48, rz: -15, scale: 0.88, x: 2, y: 30 },
    frontend: { rx: 36, rz: -9, scale: 0.92, x: 0, y: 18 },
    backend: { rx: 22, rz: -4, scale: 0.97, x: 0, y: 8 },
    launch: { rx: 0, rz: 0, scale: 1, x: 0, y: 0 },
  },
};

/** Exploded-view depth layer per piece (higher floats nearer the viewer). */
export const PIECE_LAYER: Record<PieceId, number> = {
  video: 1,
  lesson: 2,
  head: 2,
  sub: 3,
  tutor: 3,
  badge: 4,
  nav: 5,
  cta1: 6,
  cta2: 6,
  code: 8,
};

/** Timeline positions (timeline seconds; the whole story is 10). */
export const T = {
  total: 10,
  design: 0.15,
  frontend: 2.5,
  backend: 4.7,
  launch: 6.9,
  /** The stage zooms from the build box to the full-screen launch box. */
  zoom: 1.5,
  /** The walkthrough may play from here on. */
  videoOn: 8.5,
  /** Everything is flat: 3D contexts can collapse (crisp text, fewer layers). */
  flat: 8.5,
} as const;

/** Stage index (0–3) for a timeline time. */
export function stageAt(time: number): number {
  if (time >= T.launch) return 3;
  if (time >= T.backend) return 2;
  if (time >= T.frontend) return 1;
  return 0;
}

/** 0 → 1 across the launch zoom. */
export function zoomAt(time: number): number {
  return Math.min(1, Math.max(0, (time - T.launch) / T.zoom));
}

/** Small deterministic pseudo-random in [-1, 1] (no hydration risk). */
export function noise(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}
