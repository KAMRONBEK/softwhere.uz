/**
 * X-ray lens shader. One full-screen quad over a transparent canvas; all
 * positions in stage CSS px (y down) so JS and GLSL share one coordinate
 * system. Output is premultiplied RGBA: around the devices the page itself
 * shows through, so the stage has no box and no seams in any style.
 *
 * Surface: the cut-out frame (premultiplied texture), displaced by analytic
 * pointer ripples, with a soft shadow (light styles) or accent light spill
 * (dark styles) from the device outlines, and chromatic aberration around
 * the lens rim.
 * Inside the lens: a magnified "blueprint" of the same screen — style paper,
 * an image-space grid, a difference-of-Gaussians ink drawing of the
 * screenshot (the wireframe), and the canvas overlay (component boxes, code
 * and plain-English captions). The lens is a liquid ellipse that stretches
 * along its velocity and wobbles slightly.
 *
 * No mipmaps on purpose: inside() runs in a divergent branch, where implicit
 * derivatives are undefined, so textures use plain linear filtering and the
 * grid's AA width is computed outside the branch.
 */

export const MAX_DROPS = 12;
export const MAX_BODIES = 3;

export const XRAY_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const XRAY_FRAGMENT = /* glsl */ `
precision highp float;

#define MAX_DROPS ${MAX_DROPS}
#define MAX_BODIES ${MAX_BODIES}

uniform sampler2D uImage;
uniform sampler2D uOverlay;
uniform sampler2D uImageB;
uniform sampler2D uOverlayB;
uniform float uMix;
uniform vec2 uMixCenter;

uniform vec2 uRes;
uniform vec4 uWindow;
uniform vec4 uWindowB;
uniform vec2 uSize;
uniform vec2 uTexel;
uniform vec3 uLens;
uniform vec2 uLensVel;
uniform float uMag;
uniform float uCross;
uniform float uTime;
uniform float uMotion;
uniform float uChroma;
uniform vec4 uDrops[MAX_DROPS];

// Device outlines as rotated rounded boxes (stage px): center.xy, half size.zw / cos, sin, radius.
uniform vec4 uBody[MAX_BODIES];
uniform vec3 uBodyRot[MAX_BODIES];
uniform vec4 uBodyB[MAX_BODIES];
uniform vec3 uBodyRotB[MAX_BODIES];
uniform vec3 uShade; // x: offset y (px), y: falloff (px), z: strength

uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uEdge;
uniform vec3 uAccent;
uniform vec3 uAccent2;
uniform vec3 uShadow;
uniform float uAdditive;
uniform vec2 uFade;

varying vec2 vUv;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

vec2 toImgUv(vec4 win, vec2 p) {
  return win.xy + (p / uRes) * win.zw;
}

float inFrame(vec2 uv) {
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return inside.x * inside.y;
}

// Premultiplied texel; transparent outside the frame.
vec4 tex(sampler2D t, vec2 uv) {
  return texture2D(t, uv) * inFrame(uv);
}

float paperLuma() {
  return dot(uPaper, LUMA);
}

// Luma of the frame composited over the paper, so device outlines read as edges too.
float luma(sampler2D t, vec2 uv) {
  vec4 c = tex(t, uv);
  return dot(c.rgb, LUMA) + (1.0 - c.a) * paperLuma();
}

vec2 ripple(vec2 p) {
  vec2 acc = vec2(0.0);
  for (int i = 0; i < MAX_DROPS; i++) {
    vec4 d = uDrops[i];
    if (d.w <= 0.0) continue;
    float age = uTime - d.z;
    if (age < 0.0 || age > 2.8) continue;
    vec2 dir = p - d.xy;
    float dist = length(dir) + 0.001;
    float x = dist - age * 360.0;
    float env = exp(-x * x / 2600.0) * exp(-age * 1.6) * smoothstep(0.0, 0.1, age);
    acc += (dir / dist) * sin(x * 0.085) * env * d.w;
  }
  return acc;
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float bodyDistance(vec2 p, vec4 body[MAX_BODIES], vec3 rot[MAX_BODIES]) {
  float d = 1e5;
  for (int i = 0; i < MAX_BODIES; i++) {
    if (body[i].z <= 0.0) continue;
    vec2 rel = p - body[i].xy;
    vec2 local = vec2(rel.x * rot[i].x + rel.y * rot[i].y, -rel.x * rot[i].y + rel.y * rot[i].x);
    d = min(d, sdRoundBox(local, body[i].zw, rot[i].z));
  }
  return d;
}

// Under the devices: a soft ink shadow on light paper, a faint accent light spill on dark.
vec4 backdrop(vec2 p, vec4 body[MAX_BODIES], vec3 rot[MAX_BODIES]) {
  float d = bodyDistance(p - vec2(0.0, uShade.x), body, rot);
  float a = exp(-max(d, 0.0) / uShade.y) * smoothstep(-uShade.y * 1.5, 0.0, d + uShade.y * 0.4) * uShade.z;
  vec3 tint = mix(uShadow, uAccent, uAdditive);
  return vec4(tint * a, a);
}

float lensDistance(vec2 p, out vec2 rel) {
  rel = p - uLens.xy;
  float speed = length(uLensVel);
  vec2 dir = speed > 1.0 ? uLensVel / speed : vec2(1.0, 0.0);
  float stretch = 1.0 + min(speed / 2400.0, 0.3) * uMotion;
  vec2 local = vec2(dot(rel, dir), dot(rel, vec2(-dir.y, dir.x)));
  float d = length(vec2(local.x / stretch, local.y * sqrt(stretch)));
  float ang = atan(rel.y, rel.x);
  float wobble = 0.012 * sin(ang * 3.0 + uTime * 1.7) + 0.008 * sin(ang * 5.0 - uTime * 2.3);
  return d + uMotion * min(uLens.z, 220.0) * wobble;
}

float gridLine(vec2 p, float stepPx, vec2 aa) {
  vec2 g = abs(fract(p / stepPx + 0.5) - 0.5) * stepPx;
  vec2 l = 1.0 - smoothstep(vec2(0.0), aa * 1.5, g);
  return max(l.x, l.y);
}

// Difference of Gaussians, dark-feature polarity: a thin "ink drawing" of the UI.
// Text stays legible as strokes; shape boundaries become single lines.
float inkLines(sampler2D t, vec2 uv) {
  vec2 o = uTexel * 1.5;
  float small = luma(t, uv) * 0.5
    + (luma(t, uv + vec2(o.x, 0.0)) + luma(t, uv - vec2(o.x, 0.0)) + luma(t, uv + vec2(0.0, o.y)) + luma(t, uv - vec2(0.0, o.y))) * 0.125;
  vec2 r = o * 2.6;
  vec2 q = o * 1.84;
  float large = (luma(t, uv + vec2(r.x, 0.0)) + luma(t, uv - vec2(r.x, 0.0)) + luma(t, uv + vec2(0.0, r.y)) + luma(t, uv - vec2(0.0, r.y))
    + luma(t, uv + q) + luma(t, uv - q) + luma(t, uv + vec2(q.x, -q.y)) + luma(t, uv + vec2(-q.x, q.y))) * 0.125;
  return smoothstep(0.012, 0.075, large - small);
}

vec3 insideLayer(sampler2D img, sampler2D ov, vec4 win, vec2 p, vec2 gridAa) {
  vec2 uv = toImgUv(win, p);
  vec2 ip = uv * uSize;
  vec4 s = tex(img, uv);
  // A faint film of the screen's tones where there is a device: bright UI lifts dark paper, dark UI deepens light paper.
  float l = dot(s.rgb, LUMA) / max(s.a, 0.001);
  vec3 c = mix(uPaper, uInk, mix(1.0 - l, l, uAdditive) * 0.08 * s.a);
  c = mix(c, uInk, gridLine(ip, 20.0, gridAa) * 0.05 + gridLine(ip, 100.0, gridAa) * 0.1);
  c = mix(c, uEdge, inkLines(img, uv) * 0.9);
  vec4 o = tex(ov, uv);
  return c * (1.0 - o.a) + o.rgb;
}

vec4 surfaceLayer(sampler2D img, vec4 win, vec2 p, vec2 radial, float spread) {
  vec2 uv = toImgUv(win, p);
  vec4 c = tex(img, uv);
  if (spread > 0.05) {
    vec2 off = radial * spread / uRes * win.zw;
    c.r = tex(img, uv + off).r;
    c.b = tex(img, uv - off).b;
  }
  return c;
}

vec4 composite(sampler2D img, sampler2D ov, vec4 win, vec4 body[MAX_BODIES], vec3 rot[MAX_BODIES], vec2 p, vec2 rip, vec2 gridAa) {
  vec2 rel;
  float d = lensDistance(p + rip * 0.35, rel);
  float R = max(uLens.z, 0.0);
  float inMask = 1.0 - smoothstep(R - 1.0, R + 1.0, d);
  vec2 radial = rel / max(length(rel), 1.0);
  float outside = max(d - R, 0.0);

  float spread = uChroma * exp(-outside / 22.0) * (1.0 - inMask) * step(1.0, R);
  vec4 surf = surfaceLayer(img, win, p + rip, radial, spread);
  vec4 col = surf + backdrop(p + rip * 0.5, body, rot) * (1.0 - surf.a);

  if (inMask > 0.0) {
    float r01 = clamp(d / max(R, 1.0), 0.0, 1.0);
    float bend = 1.0 - 0.09 * pow(r01, 5.0);
    vec2 ip = uLens.xy + rel / uMag * bend + rip * 0.6;
    vec3 inner = insideLayer(img, ov, win, ip, gridAa);

    // Scanner: a bright line sweeping down the lens, with a short trail.
    float top = max(uLens.y - R, 0.0);
    float span = min(uLens.y + R, uRes.y) - top;
    float yScan = top + fract(uTime / 2.8) * span;
    float dy = p.y - yScan;
    float scan = (exp(-dy * dy / 2.5) + (dy < 0.0 ? exp(dy / 28.0) * 0.22 : 0.0)) * uMotion;
    inner = mix(inner + uAccent * scan * 0.45, mix(inner, uAccent, clamp(scan * 0.4, 0.0, 1.0)), 1.0 - uAdditive);

    // Fine crosshair at the center (the system cursor is hidden over the stage).
    vec2 ar = abs(rel);
    float crossX = (1.0 - smoothstep(0.45, 1.1, ar.y)) * step(ar.x, 8.0) * step(3.0, ar.x);
    float crossY = (1.0 - smoothstep(0.45, 1.1, ar.x)) * step(ar.y, 8.0) * step(3.0, ar.y);
    inner = mix(inner, uAccent, clamp(crossX + crossY, 0.0, 1.0) * uCross);

    // Glass depth: soft inner falloff near the rim and a specular arc.
    inner = mix(inner, uInk, pow(r01, 7.0) * 0.1);
    float spec = smoothstep(0.84, 0.97, r01) * pow(max(dot(radial, vec2(-0.707, -0.707)), 0.0), 3.0);
    inner = mix(inner, vec3(1.0), spec * 0.14);
    col = mix(col, vec4(inner, 1.0), inMask);
  }

  // Chromatic rim: accent ring outside, second accent just inside, soft halo.
  float ring = exp(-pow((d - R) / 1.2, 2.0));
  float ringOut = exp(-pow((d - R - 3.5) / 2.0, 2.0));
  float ringIn = exp(-pow((d - R + 3.0) / 2.0, 2.0));
  float halo = exp(-outside / (14.0 + R * 0.08)) * (1.0 - inMask);
  // Instrument ticks around the rim, like a loupe bezel: 60 minor, every fifth longer; turning slowly.
  float tickT = (atan(rel.y, rel.x) + uTime * 0.12 * uMotion) * 9.5493;
  float tickIndex = floor(tickT + 0.5);
  float isMajor = 1.0 - step(0.5, mod(tickIndex, 5.0));
  float along = abs(tickT - tickIndex) * 0.10472 * max(d, 1.0);
  float tickLen = mix(4.0, 9.0, isMajor);
  float tickBand = smoothstep(R + 6.0, R + 7.0, d) * (1.0 - smoothstep(R + 6.0 + tickLen, R + 7.0 + tickLen, d));
  float ticks = (1.0 - smoothstep(0.3, 0.85, along)) * tickBand * uCross * step(40.0, R) * mix(0.55, 0.9, isMajor);

  float glowA = clamp(ring * 0.95 + ringOut * 0.45 + halo * 0.32 + ticks, 0.0, 1.0);
  vec4 dark = vec4(col.rgb + uAccent * glowA + uAccent2 * ringIn * 0.6, clamp(col.a + glowA * 0.85 + ringIn * 0.5, 0.0, 1.0));
  float lightA = clamp(ring * 0.95 + ringOut * 0.35 + halo * 0.16 + ticks, 0.0, 1.0);
  vec4 light = mix(col, vec4(uAccent, 1.0), lightA);
  light = mix(light, vec4(uAccent2, 1.0), ringIn * 0.55);
  return mix(light, dark, uAdditive);
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 gridAa = fwidth(p) * (uSize * uWindow.zw / uRes) / uMag;
  vec2 rip = ripple(p);
  vec4 col = composite(uImage, uOverlay, uWindow, uBody, uBodyRot, p, rip, gridAa);

  if (uMix > 0.0) {
    vec4 next = composite(uImageB, uOverlayB, uWindowB, uBodyB, uBodyRotB, p, rip, gridAa);
    vec2 toP = p - uMixCenter;
    float dist = length(toP);
    float front = uMix * length(uRes) * 1.1;
    float ang = atan(toP.y, toP.x);
    float n = (sin(ang * 7.0 + uTime * 3.0) * 0.6 + sin(ang * 13.0 - uTime * 2.0) * 0.4) * 16.0;
    float w = 1.0 - smoothstep(front - 26.0, front + 2.0, dist + n);
    col = mix(col, next, w);
    float edge = exp(-pow((dist + n - front) / 5.0, 2.0)) * (1.0 - step(0.999, uMix));
    vec4 edgeDark = vec4(col.rgb + uAccent * edge, clamp(col.a + edge * 0.8, 0.0, 1.0));
    vec4 edgeLight = mix(col, vec4(uAccent, 1.0), edge * 0.8);
    col = mix(edgeLight, edgeDark, uAdditive);
  }

  // Melt into the page at the stage edges (no seams when the x-ray fills the stage).
  vec2 edgeDist = min(p, uRes - p);
  float fade = smoothstep(0.0, max(uFade.x, 0.001), edgeDist.x) * smoothstep(0.0, max(uFade.y, 0.001), edgeDist.y);
  gl_FragColor = col * fade;
}
`;
