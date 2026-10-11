import {
  boxCorners,
  layoutCodeCard,
  partUnits,
  quadAngle,
  quadCenter,
  quadSize,
  type CodeCardLayout,
  type OverlayMetrics,
} from './geometry';
import { tokenColor, tokenizeLine, withAlpha, type XRayPalette } from './palette';
import type { Quad, XRayCode, XRayPart, XRayScene, XRayScreen } from './scenes';

/**
 * Draws the "inside" annotations of one scene into a 2D canvas in image space
 * (the WebGL shader samples it under the lens): dashed screen outlines,
 * DevTools-style component boxes with tag chips and measurements, and code
 * cards that lie on the device screens. Transparent everywhere else, so the
 * blueprint grid and the detected UI edges show through.
 */

export type OverlaySizes = OverlayMetrics;

function tracePath(ctx: CanvasRenderingContext2D, quad: Quad): void {
  ctx.beginPath();
  ctx.moveTo(quad[0][0], quad[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(quad[i][0], quad[i][1]);
  ctx.closePath();
}

function font(size: number, family: string, weight = 500): string {
  return `${weight} ${size}px ${family}`;
}

/** A filled chip with text at (x, y) in the current frame; uses the current ctx.font. */
function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg: string, fg: string, px: number): number {
  const padX = 4 * px;
  const width = ctx.measureText(text).width + padX * 2;
  const height = size * 1.45;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = fg;
  ctx.fillText(text, x + padX, y + height / 2 + size * 0.04);
  return width;
}

function drawCornerTicks(ctx: CanvasRenderingContext2D, quad: Quad, length: number): void {
  for (let i = 0; i < 4; i++) {
    const corner = quad[i];
    const next = quad[(i + 1) % 4];
    const prev = quad[(i + 3) % 4];
    for (const toward of [next, prev]) {
      const dx = toward[0] - corner[0];
      const dy = toward[1] - corner[1];
      const len = Math.hypot(dx, dy) || 1;
      const reach = Math.min(length, len / 3);
      ctx.beginPath();
      ctx.moveTo(corner[0], corner[1]);
      ctx.lineTo(corner[0] + (dx / len) * reach, corner[1] + (dy / len) * reach);
      ctx.stroke();
    }
  }
}

function drawHatch(ctx: CanvasRenderingContext2D, corners: Quad, inset: number, color: string, px: number): void {
  const [tl, tr, br, bl] = corners;
  const strips: Quad[] = [
    [
      tl,
      [tl[0] + (tr[0] - tl[0]) * inset, tl[1] + (tr[1] - tl[1]) * inset],
      [bl[0] + (br[0] - bl[0]) * inset, bl[1] + (br[1] - bl[1]) * inset],
      bl,
    ],
    [
      [tr[0] - (tr[0] - tl[0]) * inset, tr[1] - (tr[1] - tl[1]) * inset],
      tr,
      br,
      [br[0] - (br[0] - bl[0]) * inset, br[1] - (br[1] - bl[1]) * inset],
    ],
  ];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 * px;
  for (const strip of strips) {
    ctx.save();
    tracePath(ctx, strip);
    ctx.clip();
    const xs = strip.map(p => p[0]);
    const ys = strip.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const step = 5 * px;
    ctx.beginPath();
    for (let x = minX - (maxY - minY); x < maxX; x += step) {
      ctx.moveTo(x, maxY);
      ctx.lineTo(x + (maxY - minY), minY);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawPart(ctx: CanvasRenderingContext2D, screen: XRayScreen, part: XRayPart, palette: XRayPalette, sizes: OverlaySizes): void {
  const { px } = sizes;
  const corners = boxCorners(screen.quad, part.box);
  const angle = quadAngle(screen.quad);
  ctx.save();
  ctx.lineWidth = 1.25 * px;
  ctx.strokeStyle = palette.accent;
  ctx.fillStyle = withAlpha(palette.accent, palette.isDark ? 0.1 : 0.08);
  if (part.shape === 'circle') {
    const center = quadCenter(corners);
    ctx.beginPath();
    ctx.arc(center[0], center[1], quadSize(corners).width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    tracePath(ctx, corners);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 2.25 * px;
    drawCornerTicks(ctx, corners, 7 * px);
  }
  ctx.restore();

  // Tag chip (top-left, inside) and measurement (bottom-right, inside), in the screen's rotated frame.
  const { width: boxW, height: boxH } = quadSize(corners);
  const [w, h] = partUnits(screen, part);
  ctx.save();
  ctx.translate(corners[0][0], corners[0][1]);
  ctx.rotate(angle);
  ctx.textBaseline = 'middle';
  ctx.font = font(sizes.label, palette.mono);
  const inset = 3 * px;
  chip(ctx, part.tag, inset, inset, sizes.label, palette.accent, palette.onAccent, px);
  const dims = `${w}×${h}`;
  ctx.font = font(sizes.label * 0.92, palette.mono, 400);
  const dimsWidth = ctx.measureText(dims).width + 8 * px;
  if (boxW > dimsWidth * 2.2 && boxH > sizes.label * 3.2) {
    chip(
      ctx,
      dims,
      boxW - dimsWidth - inset,
      boxH - sizes.label * 1.4 - inset,
      sizes.label * 0.92,
      withAlpha(palette.card, 0.88),
      palette.muted,
      px
    );
  }
  ctx.restore();
}

function drawScreen(ctx: CanvasRenderingContext2D, screen: XRayScreen, palette: XRayPalette, sizes: OverlaySizes): void {
  const { px } = sizes;
  ctx.save();
  ctx.setLineDash([5 * px, 4 * px]);
  ctx.lineWidth = 1.25 * px;
  ctx.strokeStyle = withAlpha(palette.isDark ? palette.accent2 : palette.ink, 0.85);
  tracePath(ctx, screen.quad);
  ctx.stroke();
  ctx.restore();

  const angle = quadAngle(screen.quad);
  const [tl, , , bl] = screen.quad;
  const label = `${screen.name} · ${screen.unitWidth}${screen.unit}`;
  const chipH = sizes.label * 1.45;
  const above = tl[1] > chipH + 6 * px;
  ctx.save();
  ctx.translate(above ? tl[0] : bl[0], above ? tl[1] : bl[1]);
  ctx.rotate(angle);
  ctx.textBaseline = 'middle';
  ctx.font = font(sizes.label, palette.mono, 400);
  chip(ctx, label, 0, above ? -chipH - 3 * px : 3 * px, sizes.label, withAlpha(palette.card, 0.9), palette.muted, px);
  ctx.restore();
}

function drawCodeCard(ctx: CanvasRenderingContext2D, code: XRayCode, layout: CodeCardLayout, palette: XRayPalette, px: number): void {
  const { origin, angle, width, height, pad, lineHeight, fontSize, captionSize, captionHeight, captionGap } = layout;
  ctx.save();
  ctx.translate(origin[0], origin[1]);
  ctx.rotate(angle);

  // Plain-English caption above the card: what the code does, for people who don't read code.
  ctx.font = font(captionSize, palette.body, 600);
  const captionPadX = captionSize * 0.62;
  const captionWidth = ctx.measureText(code.caption).width + captionPadX * 2;
  ctx.beginPath();
  ctx.roundRect(0, -captionHeight - captionGap, captionWidth, captionHeight, Math.min(palette.radius * px, captionHeight / 2));
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.onAccent;
  ctx.fillText(code.caption, captionPadX, -captionGap - captionHeight / 2 + captionSize * 0.04);

  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, palette.radius * px);
  ctx.fillStyle = withAlpha(palette.card, 0.96);
  ctx.fill();
  ctx.lineWidth = 1 * px;
  ctx.strokeStyle = withAlpha(palette.ink, 0.16);
  ctx.stroke();

  ctx.font = font(fontSize * 0.86, palette.mono, 400);
  ctx.fillStyle = palette.muted;
  ctx.fillText(code.file, pad, pad + lineHeight / 2);
  ctx.fillStyle = withAlpha(palette.ink, 0.12);
  ctx.fillRect(pad, pad + lineHeight, width - pad * 2, Math.max(1, 1 * px));

  ctx.font = font(fontSize, palette.mono, 400);
  code.lines.forEach((line, index) => {
    let x = pad;
    const y = pad + lineHeight * (index + 1.5) + fontSize * 0.35;
    for (const token of tokenizeLine(line)) {
      ctx.fillStyle = tokenColor(palette, token.kind);
      ctx.fillText(token.text, x, y);
      x += ctx.measureText(token.text).width;
    }
  });
  ctx.restore();
}

export interface OverlayLayout {
  /** Code card layouts per screen, image px. */
  cards: CodeCardLayout[][];
}

/**
 * Redraws `canvas` at `pixelScale` device px per image px. Returns the code
 * card layouts (the autopilot aims the lens at their centers).
 */
export function drawOverlay(
  canvas: HTMLCanvasElement,
  scene: XRayScene,
  palette: XRayPalette,
  sizes: OverlaySizes,
  pixelScale: number
): OverlayLayout {
  const [width, height] = scene.size;
  const targetW = Math.round(width * pixelScale);
  const targetH = Math.round(height * pixelScale);
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { cards: [] };
  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const measure = (text: string, size: number) => {
    ctx.font = font(size, palette.mono, 400);
    return ctx.measureText(text).width;
  };

  for (const screen of scene.screens) drawScreen(ctx, screen, palette, sizes);
  for (const screen of scene.screens) {
    for (const part of screen.parts) {
      if (part.pad) {
        drawHatch(ctx, boxCorners(screen.quad, part.box), part.pad, withAlpha(palette.accent2, palette.isDark ? 0.35 : 0.3), sizes.px);
      }
    }
  }
  // Big containers first so nested parts' chips stay on top.
  const parts = scene.screens.flatMap(screen =>
    screen.parts.map(part => ({ screen, part, area: (part.box[2] - part.box[0]) * (part.box[3] - part.box[1]) }))
  );
  parts.sort((a, b) => b.area - a.area);
  for (const { screen, part } of parts) drawPart(ctx, screen, part, palette, sizes);

  const cards = scene.screens.map(screen =>
    screen.code.map(code => {
      const layout = layoutCodeCard(screen, code, sizes.code, sizes.caption, measure);
      drawCodeCard(ctx, code, layout, palette, sizes.px);
      return layout;
    })
  );
  return { cards };
}
