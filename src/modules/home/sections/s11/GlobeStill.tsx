'use client';

import { useEffect, useRef } from 'react';
import { arcPoints, getLandDots, globeLayout, latLonToVec, rotate, smoothstep, type Vec3 } from './geo';
import { rgba, type GlobeLook } from './look';
import { ALL_PINS, DESTINATIONS, HOME_PIN, TAG_INDEX } from './markets';
import { arcDraw, facingVisibility, labelShown, pinShown, storyPose, writeLabel, type GlobeRuntime } from './story';

const MAX_DPR = 2;
const DOT_FILL = 0.46;
const ARC_STEPS = 64;
const HOME = latLonToVec(HOME_PIN.lat, HOME_PIN.lon);
const ARC_PATHS = DESTINATIONS.map(pin => arcPoints(HOME, latLonToVec(pin.lat, pin.lon), ARC_STEPS));
const PIN_VECTORS = ALL_PINS.map(pin => latLonToVec(pin.lat, pin.lon, 1.012));

interface GlobeStillProps {
  runtime: GlobeRuntime;
  look: GlobeLook;
  className?: string;
}

function draw(canvas: HTMLCanvasElement, runtime: GlobeRuntime, look: GlobeLook): void {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas.getBoundingClientRect();
  if (!ctx || width === 0 || height === 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const { cx, cy, r } = globeLayout(width, height);
  const p = runtime.target;
  const pose = storyPose(p);
  const yaw = pose.yaw + runtime.drag.yaw;
  const pitch = Math.max(-1.25, Math.min(1.25, pose.pitch + runtime.drag.pitch));
  const project = (v: Vec3): [number, number, number] => {
    const [x, y, z] = rotate(v, yaw, pitch);
    return [cx + x * r, cy - y * r, z];
  };

  // Atmosphere: a bright band hugging the limb and a wide soft falloff.
  const halo = ctx.createRadialGradient(cx, cy, r * 0.98, cx, cy, r * 1.32);
  halo.addColorStop(0, rgba(look.halo, look.haloStrength * 0.75));
  halo.addColorStop(0.18, rgba(look.halo, look.haloStrength * 0.32));
  halo.addColorStop(1, rgba(look.halo, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 1.4, cy - r * 1.4, r * 2.8, r * 2.8);
  // Body with a fresnel-like rim inside the limb.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(look.body, Math.max(look.bodyOpacity, 0.9));
  ctx.fill();
  const rim = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
  rim.addColorStop(0, rgba(look.rim, 0));
  rim.addColorStop(1, rgba(look.rim, look.rimStrength * 0.55));
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.lineWidth = look.isDark ? 1.5 : 1;
  ctx.strokeStyle = rgba(look.limbLine, look.isDark ? 0.75 : look.limbLineStrength);
  ctx.stroke();

  // Land: lit countries in the accent, the rest as ink/light; three alpha bands toward the limb.
  // Denser lattice for big globes (desktop with reduced motion lands here too).
  const dots = getLandDots(r > 230 ? 'mid' : 'low');
  const lit = new Set<number>([TAG_INDEX.uz]);
  DESTINATIONS.forEach((pin, i) => {
    if (arcDraw(i, p) >= 0.999) lit.add(TAG_INDEX[pin.tag]);
  });
  const size = Math.max(1.2, r * dots.spacing * DOT_FILL);
  const bands = [0.35, 0.7, 1];
  for (const isLit of [false, true]) {
    for (let band = 0; band < bands.length; band++) {
      ctx.beginPath();
      for (let i = 0; i < dots.count; i++) {
        if (lit.has(dots.tags[i]) !== isLit) continue;
        const [x, y, z] = project([dots.positions[i * 3], dots.positions[i * 3 + 1], dots.positions[i * 3 + 2]]);
        if (z <= 0) continue;
        const limb = smoothstep(0, 0.42, z);
        if (Math.min(bands.length - 1, Math.floor(limb * bands.length)) !== band) continue;
        const radius = (size / 2) * (0.5 + 0.5 * limb);
        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
      const alpha = bands[band] * (isLit ? look.litOpacity : look.landOpacity);
      ctx.fillStyle = rgba(isLit ? look.lit : look.land, alpha);
      ctx.fill();
    }
  }

  // Arcs: only the drawn part, hidden where it passes behind the globe.
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, r * 0.007);
  ARC_PATHS.forEach((path, i) => {
    const drawn = arcDraw(i, p);
    if (drawn <= 0) return;
    const last = Math.round(drawn * ARC_STEPS);
    const start = project(path[0]);
    const end = project(path[ARC_STEPS]);
    const gradient = ctx.createLinearGradient(start[0], start[1], end[0], end[1]);
    gradient.addColorStop(0, rgba(look.arcFrom, look.isDark ? 0.9 : 0.85));
    gradient.addColorStop(1, rgba(look.arcTo, look.isDark ? 0.9 : 0.85));
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    let isDrawing = false;
    for (let k = 0; k <= last; k++) {
      const [x, y, z] = project(path[k]);
      const isVisible = z > 0 || Math.hypot(x - cx, y - cy) > r;
      if (isVisible && isDrawing) ctx.lineTo(x, y);
      else if (isVisible) ctx.moveTo(x, y);
      isDrawing = isVisible;
    }
    ctx.stroke();
  });

  // Pins and their labels.
  PIN_VECTORS.forEach((v, index) => {
    const [x, y, z] = project(v);
    const visibility = pinShown(index, p) * facingVisibility(z);
    writeLabel(runtime.labels[index], x, y, labelShown(index, p) * facingVisibility(z), width);
    if (visibility <= 0) return;
    ctx.beginPath();
    ctx.arc(x, y, index === 0 ? 4.5 : 3.2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(look.comet, visibility);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, index === 0 ? 11 : 7, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(look.ring, 0.55 * visibility);
    ctx.stroke();
  });
}

/**
 * The globe as a still 2D drawing: the low-tier version (no WebGL) and the
 * WebGL canvas's fallback. Redrawn only when the story beat or a drag
 * changes it, never in a loop.
 */
export default function GlobeStill({ runtime, look, className }: GlobeStillProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const render = () => {
      frame = 0;
      draw(canvas, runtime, look);
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const observer = new ResizeObserver(request);
    observer.observe(canvas);
    runtime.listeners.add(request);
    request();
    return () => {
      observer.disconnect();
      runtime.listeners.delete(request);
      cancelAnimationFrame(frame);
    };
  }, [runtime, look]);

  return <canvas ref={canvasRef} className={className} aria-hidden='true' />;
}
