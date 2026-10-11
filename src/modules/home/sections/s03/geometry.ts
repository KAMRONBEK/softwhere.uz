import type { Box, Point, Quad, Rect, XRayCode, XRayPart, XRayScene, XRayScreen, XRayStop } from './scenes';

/**
 * Pure geometry shared by the WebGL scene, the canvas overlay and the CSS
 * fallback: where the frame sits on the stage, quad mapping, hit testing and
 * code-card layout. Image px = logical px of the 1200×800 frame; stage px =
 * CSS px of the stage box.
 */

/** The frame's placement: which part of the image (uv, may exceed 0..1) the stage shows. */
export interface StageWindow {
  /** Stage size in CSS px. */
  width: number;
  height: number;
  /** Image uv at the stage's top-left corner, and the uv extent the stage spans. */
  ox: number;
  oy: number;
  sx: number;
  sy: number;
  /** CSS px per image px. */
  scale: number;
}

interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Wide (desktop) stage: the copy column on the left, the devices in the rest.
 * Must match `.copy` in XRay.module.css (left gutter + width).
 */
export function wideCopyRight(width: number): number {
  const gutter = clamp(width * 0.04, 32, 72);
  return gutter + Math.min(width * 0.3, 480);
}

function safeArea(width: number, height: number, isWide: boolean): Area {
  if (!isWide) {
    const padY = clamp(height * 0.035, 10, 24);
    return { x0: 0, y0: padY, x1: width, y1: height - padY };
  }
  const gutter = clamp(width * 0.04, 32, 72);
  return {
    x0: wideCopyRight(width) + clamp(width * 0.025, 24, 56),
    y0: clamp(height * 0.1, 64, 104),
    x1: width - gutter,
    y1: height - clamp(height * 0.08, 40, 88),
  };
}

function bodiesBounds(scene: XRayScene): Rect {
  const xs = scene.bodies.flatMap(body => body.quad.map(p => p[0]));
  const ys = scene.bodies.flatMap(body => body.quad.map(p => p[1]));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * Wide stages fit every device into the area right of the copy; narrow
 * stages fit the hero device (`focus`) and let its neighbours run off the
 * edges, like a carousel peeking.
 */
export function placeScene(width: number, height: number, scene: XRayScene, isWide: boolean): StageWindow {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const area = safeArea(w, h, isWide);
  const fit = isWide ? bodiesBounds(scene) : scene.focus;
  const fitW = fit[2] - fit[0];
  const fitH = fit[3] - fit[1];
  const areaW = Math.max(area.x1 - area.x0, 1);
  const areaH = Math.max(area.y1 - area.y0, 1);
  // Narrow: the hero device takes at most ~74% of the width so its neighbours show.
  const maxW = isWide ? areaW : areaW * 0.74;
  const scale = Math.max(Math.min(maxW / fitW, areaH / fitH), 0.05);
  const tx = area.x0 + (areaW - fitW * scale) / 2 - fit[0] * scale;
  const ty = area.y0 + (areaH - fitH * scale) / 2 - fit[1] * scale;
  const [iw, ih] = scene.size;
  return { width: w, height: h, ox: -tx / scale / iw, oy: -ty / scale / ih, sx: w / scale / iw, sy: h / scale / ih, scale };
}

/** CSS transform that puts a box of the frame's logical size where the window says. */
export function planeTransform(win: StageWindow, size: Point): string {
  const tx = -win.ox * size[0] * win.scale;
  const ty = -win.oy * size[1] * win.scale;
  return `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${win.scale.toFixed(5)})`;
}

export function imageToStage(win: StageWindow, size: Point, p: Point): Point {
  return [((p[0] / size[0] - win.ox) / win.sx) * win.width, ((p[1] / size[1] - win.oy) / win.sy) * win.height];
}

export function stageToImage(win: StageWindow, size: Point, p: Point): Point {
  return [(win.ox + (p[0] / win.width) * win.sx) * size[0], (win.oy + (p[1] / win.height) * win.sy) * size[1]];
}

/** Bilinear map of a screen-space point (u, v) through a quad (TL, TR, BR, BL). */
export function mapQuad(quad: Quad, u: number, v: number): Point {
  const [tl, tr, br, bl] = quad;
  const a = (1 - u) * (1 - v);
  const b = u * (1 - v);
  const c = u * v;
  const d = (1 - u) * v;
  return [a * tl[0] + b * tr[0] + c * br[0] + d * bl[0], a * tl[1] + b * tr[1] + c * br[1] + d * bl[1]];
}

export function boxCorners(quad: Quad, box: Box): Quad {
  const [u0, v0, u1, v1] = box;
  return [mapQuad(quad, u0, v0), mapQuad(quad, u1, v0), mapQuad(quad, u1, v1), mapQuad(quad, u0, v1)];
}

/** Rotation of a screen's top edge, in radians. */
export function quadAngle(quad: Quad): number {
  const [tl, tr] = quad;
  return Math.atan2(tr[1] - tl[1], tr[0] - tl[0]);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Mean edge lengths of a quad in image px. */
export function quadSize(quad: Quad): { width: number; height: number } {
  const [tl, tr, br, bl] = quad;
  return { width: (distance(tl, tr) + distance(bl, br)) / 2, height: (distance(tl, bl) + distance(tr, br)) / 2 };
}

export function quadCenter(quad: Quad): Point {
  return mapQuad(quad, 0.5, 0.5);
}

/** A device outline as a rotated rounded rectangle in stage px (for the shader's shadow SDF). */
export interface BodyFrame {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  cos: number;
  sin: number;
  radius: number;
}

export function bodyFrames(scene: XRayScene, win: StageWindow): BodyFrame[] {
  return scene.bodies.map(body => {
    const [cx, cy] = imageToStage(win, scene.size, quadCenter(body.quad));
    const { width, height } = quadSize(body.quad);
    const angle = quadAngle(body.quad);
    return {
      cx,
      cy,
      hw: (width / 2) * win.scale,
      hh: (height / 2) * win.scale,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      radius: body.radius * win.scale,
    };
  });
}

function cross(o: Point, a: Point, b: Point): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Point in a convex quad (any winding). */
export function isInQuad(p: Point, quad: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const c = cross(quad[i], quad[(i + 1) % 4], p);
    if (c === 0) continue;
    const s = Math.sign(c);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Part size in the screen's logical units (dp / pt / px). */
export function partUnits(screen: XRayScreen, part: XRayPart): [number, number] {
  const { width, height } = quadSize(screen.quad);
  const perPx = screen.unitWidth / width;
  const w = (part.box[2] - part.box[0]) * width * perPx;
  const h = (part.box[3] - part.box[1]) * height * perPx;
  return [Math.round(w), Math.round(h)];
}

function partArea(screen: XRayScreen, part: XRayPart): number {
  return (part.box[2] - part.box[0]) * (part.box[3] - part.box[1]) * screen.unitWidth;
}

function isInPart(p: Point, screen: XRayScreen, part: XRayPart): boolean {
  const corners = boxCorners(screen.quad, part.box);
  if (part.shape !== 'circle') return isInQuad(p, corners);
  const center = quadCenter(corners);
  return distance(p, center) <= quadSize(corners).width / 2;
}

export interface XRayHit {
  key: string;
  /** Plain English. */
  label: string;
  tag: string;
  meta: string;
}

/** The most specific part (or screen) under an image-px point. */
export function describeAt(scene: XRayScene, p: Point): XRayHit | null {
  let best: { screen: XRayScreen; part: XRayPart; area: number } | null = null;
  let screenHit: XRayScreen | null = null;
  for (const screen of scene.screens) {
    if (isInQuad(p, screen.quad)) screenHit = screenHit ?? screen;
    for (const part of screen.parts) {
      if (!isInPart(p, screen, part)) continue;
      const area = partArea(screen, part);
      if (!best || area < best.area) best = { screen, part, area };
    }
  }
  if (best) {
    const [w, h] = partUnits(best.screen, best.part);
    return {
      key: `${best.screen.name}/${best.part.id}`,
      label: best.part.label,
      tag: best.part.tag,
      meta: `${w} × ${h} ${best.screen.unit}`,
    };
  }
  if (screenHit) {
    return {
      key: screenHit.name,
      label: screenHit.label,
      tag: `<${screenHit.name} />`,
      meta: screenHit.widthLabel,
    };
  }
  return null;
}

// ── Code cards ──────────────────────────────────────────────────────────────

export interface CodeCardLayout {
  /** Card body top-left (image px); the caption chip sits above it. */
  origin: Point;
  angle: number;
  width: number;
  height: number;
  pad: number;
  lineHeight: number;
  fontSize: number;
  captionSize: number;
  captionHeight: number;
  captionGap: number;
  /** Center of caption + card, image px (the autopilot aims here). */
  center: Point;
}

export type MeasureText = (text: string, fontSize: number) => number;

/** Monospace estimate for layouts without a canvas (CSS fallback, tour stops). */
export const estimateText: MeasureText = (text, fontSize) => text.length * fontSize * 0.62;

export function layoutCodeCard(
  screen: XRayScreen,
  code: XRayCode,
  fontSize: number,
  captionSize: number,
  measure: MeasureText
): CodeCardLayout {
  const pad = fontSize * 0.85;
  const lineHeight = fontSize * 1.5;
  const widest = Math.max(measure(code.file, fontSize * 0.86), ...code.lines.map(line => measure(line, fontSize)));
  const width = widest + pad * 2;
  const height = pad * 2 + lineHeight * (code.lines.length + 1) + fontSize * 0.35;
  const captionHeight = captionSize * 1.75;
  const captionGap = captionSize * 0.4;
  const origin = mapQuad(screen.quad, code.at[0], code.at[1]);
  const angle = quadAngle(screen.quad);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Center of the union [0, -(captionHeight + gap)] .. [width, height] in the card's frame.
  const localY = (height - captionHeight - captionGap) / 2;
  const localX = width / 2;
  const center: Point = [origin[0] + localX * cos - localY * sin, origin[1] + localX * sin + localY * cos];
  return { origin, angle, width, height, pad, lineHeight, fontSize, captionSize, captionHeight, captionGap, center };
}

/** Image-px position of an autopilot stop. */
export function stopPoint(
  scene: XRayScene,
  stop: XRayStop,
  sizes: { code: number; caption: number },
  measure: MeasureText = estimateText
): Point | null {
  const screen = scene.screens[stop.screen];
  if (!screen) return null;
  if (stop.code !== undefined) {
    const code = screen.code[stop.code];
    return code ? layoutCodeCard(screen, code, sizes.code, sizes.caption, measure).center : null;
  }
  const part = screen.parts.find(item => item.id === stop.part);
  return part ? quadCenter(boxCorners(screen.quad, part.box)) : quadCenter(screen.quad);
}

export interface OverlayMetrics {
  /** Code font size, image px. */
  code: number;
  /** Tag / measurement label size, image px. */
  label: number;
  /** Plain-English caption size, image px. */
  caption: number;
  /** Image px per CSS px (line widths, paddings). */
  px: number;
}

/** Overlay text sizes (image px) so text lands at a fixed CSS size under the lens on any stage. */
export function overlayMetrics(cssScale: number, magnification: number, isCompact: boolean): OverlayMetrics {
  const imagePxPerCss = 1 / Math.max(cssScale * magnification, 0.01);
  const [code, label, caption] = isCompact ? [11, 9.5, 11.5] : [14, 11, 13.5];
  return {
    code: clamp(code * imagePxPerCss, 9, 28),
    label: clamp(label * imagePxPerCss, 8, 24),
    caption: clamp(caption * imagePxPerCss, 9, 28),
    px: imagePxPerCss,
  };
}
