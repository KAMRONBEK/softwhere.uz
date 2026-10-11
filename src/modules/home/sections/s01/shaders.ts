/**
 * GLSL for the hero particle cloud. Everything is stateless on the GPU: the
 * wind is a short trail of recent pointer samples that age out, ripples are
 * expanding rings with a decay, the scroll dissolve is a function of one
 * progress uniform, so the CPU only uploads ~30 uniforms a frame no matter how
 * many particles there are. Loops and noise that are idle this frame are
 * skipped behind uniform flags (uCurlOn, uTrailOn, uRippleOn, uGatherOn).
 *
 * Coordinates are the mark's local space (unit square centred on 0).
 */

export const TRAIL_LENGTH = 12;
export const RIPPLE_COUNT = 4;
/** How fast a ripple's ring expands, in mark widths per second (the DOM shockwave reuses it). */
export const RIPPLE_SPEED = 1.3;

// Ashima Arts / Ian McEwan 3D simplex noise (MIT).
const SIMPLEX_3D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

export const VERTEX_SHADER = /* glsl */ `
#define TRAIL ${TRAIL_LENGTH}
#define RIPPLES ${RIPPLE_COUNT}
#define RIPPLE_SPEED ${RIPPLE_SPEED.toFixed(3)}
#define PI 3.141592653589793

uniform float uTime;
uniform float uMorph;
uniform float uDisperse;
uniform float uDissolve;
uniform vec2 uWind;
uniform vec2 uSweep;
uniform float uSize;
uniform float uDpr;
uniform float uCamDist;
uniform float uMaxPoint;
uniform float uDepthCap;
uniform float uAlpha;
uniform float uTwinkle;
uniform float uBreath;
uniform float uLight;
uniform float uScale;
uniform float uAspect;
uniform float uTanHalfFov;
uniform float uCurlOn;
uniform float uTrailOn;
uniform float uRippleOn;
uniform float uGatherOn;
uniform vec4 uGather;
uniform float uGatherSpin;
uniform vec3 uStarDepth;
uniform vec3 uPointer;
uniform vec4 uTrail[TRAIL];
uniform float uTrailAge[TRAIL];
uniform vec4 uRipple[RIPPLES];
uniform vec3 uInk;
uniform vec3 uAccent;
uniform vec3 uAccent2;

attribute vec3 aFrom;
attribute vec3 aTo;
attribute vec3 aStar;
attribute vec4 aSeed;
attribute vec2 aToneFrom;
attribute vec2 aTone;

varying vec3 vColor;
varying float vAlpha;

${SIMPLEX_3D}

void main() {
  float stagger = aSeed.z;
  bool isDust = aSeed.w > 0.5;

  // Static, spatially coherent noise per particle (neighbours curl alike, so
  // motion reads as streams, not spray). Only needed while something moves.
  vec3 curl = vec3(0.0);
  if (uCurlOn > 0.5) curl = vec3(snoise(aTo * 2.3 + 3.1), snoise(aTo * 2.3 + 7.7), snoise(aFrom * 2.3 + 1.3));

  // Logo change: every particle leaves on its own beat, curls out and lands.
  float m = clamp(uMorph * 1.6 - stagger * 0.6, 0.0, 1.0);
  float me = m * m * (3.0 - 2.0 * m);
  vec3 p = mix(aFrom, aTo, me) + curl * sin(me * PI) * 0.3;
  vec2 tone = mix(aToneFrom, aTone, me);

  if (isDust) {
    // Dust orbits slowly; on light grounds it hugs the mark (ink, not stars).
    float angle = uTime * (0.035 + 0.07 * aSeed.y);
    float c = cos(angle);
    float s = sin(angle);
    p.xy = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * mix(1.0, 0.8, uLight);
  }

  // Scroll dissolve: the wind strips the mark from its uSweep edge first.
  float k = 0.0;
  if (uDissolve > 0.0) {
    float lead = clamp(0.5 - dot(aTo.xy, uSweep) * 0.85, 0.0, 1.0);
    k = clamp((uDissolve - lead * 0.58 - stagger * 0.2) / 0.22, 0.0, 1.0);
  }
  float ke = k * k;

  // Breathing: slow 3D noise drift, turbulent once a particle is airborne.
  vec3 np = p * 2.1;
  float n1 = snoise(np + vec3(0.0, 0.0, uTime * 0.22));
  float n2 = snoise(np + vec3(19.1, 7.3, -uTime * 0.22));
  p += vec3(n1, n2, n1 * n2) * uBreath * (1.0 + k * 14.0);

  vec2 push = vec2(0.0);
  float lift = 0.0;
  float boost = 0.0;

  // Press and hold: a gravity well at the pointer (uGather: centre, charge,
  // reach). Nearby particles are drawn toward a tight, spinning core (the
  // inner ones turn faster, so spiral arms form) and heat up. The pull is a
  // blend toward that orbit, so letting go returns every particle straight
  // home, however long the core has spun, while the release ripple fires.
  if (uGatherOn > 0.5) {
    vec2 gv = p.xy - uGather.xy;
    float reach = uGather.w * (0.7 + aSeed.y * 0.6);
    float fall = exp(-dot(gv, gv) / (reach * reach));
    float gw = uGather.z * fall;
    float angle = uGatherSpin * (0.35 + fall) * (0.75 + aSeed.x * 0.4);
    float ca = cos(angle);
    float sa = sin(angle);
    vec2 orbit = vec2(ca * gv.x - sa * gv.y, sa * gv.x + ca * gv.y) * (0.12 + 0.2 * aSeed.y);
    p.xy = mix(p.xy, uGather.xy + orbit, gw * (2.0 - gw));
    p.z += gw * (aSeed.y - 0.2) * 0.3;
    boost += gw * 1.6;
  }

  // The pointer is a lens: particles part around it and light up.
  vec2 hv = p.xy - uPointer.xy;
  float hr2 = dot(hv, hv);
  float hf = exp(-hr2 / 0.009) * uPointer.z;
  push += hv * inversesqrt(hr2 + 1e-4) * hf * 0.055;
  boost += hf * 0.45;

  // Wind: recent pointer samples drag particles along and curl them.
  if (uTrailOn > 0.5) {
    for (int i = 0; i < TRAIL; i++) {
      float age = uTrailAge[i] - aSeed.y * 0.16;
      if (age <= 0.0 || age > 2.6) continue;
      vec4 tr = uTrail[i];
      vec2 dv = p.xy - tr.xy;
      float w = exp(-dot(dv, dv) / 0.018) * smoothstep(0.0, 0.07, age) * exp(-age * 2.1);
      push += tr.zw * w * 0.045;
      push += vec2(-dv.y, dv.x) * w * (aSeed.x - 1.0) * 1.4;
      lift += w * (aSeed.y - 0.5) * 0.12;
      boost += w * 0.25;
    }
  }

  // Ripples: an expanding ring of light that shoves particles out and up.
  if (uRippleOn > 0.5) {
    for (int j = 0; j < RIPPLES; j++) {
      vec4 rp = uRipple[j];
      if (rp.w <= 0.0) continue;
      vec2 dv = p.xy - rp.xy;
      float dist = length(dv);
      float band = exp(-pow((dist - rp.z * RIPPLE_SPEED) / 0.055, 2.0));
      float wave = band * exp(-rp.z * 1.5) * rp.w;
      // A charged pulse throws further, but lifts (and so enlarges) no more than a tap.
      float crest = min(wave, 1.0);
      push += dv / max(dist, 1e-3) * wave * 0.075;
      lift += crest * mix(0.24, 0.12, uLight);
      boost += wave * 2.0;
    }
  }

  p.xy += push;
  p.z += lift;

  // Dissolve flight: carried downwind along curling streams, rising toward
  // the viewer. Embers flare as they leave on dark grounds; on light ones the
  // pigment shrinks and washes out instead. Dark-ground dust stays as stars.
  if (k > 0.0) {
    float reach = isDust ? mix(0.35, 0.9, uLight) : 1.2 + aSeed.y * 1.5;
    p.xy += uWind * ke * reach + curl.xy * sin(k * 2.4) * 0.28 * (1.0 + aSeed.y);
    p.z += (curl.z + 0.35) * ke * 0.9;
    boost += sin(k * PI) * (1.0 - uLight) * 0.9;
  }

  // Intro: the mark condenses out of a starfield laid out in world space to
  // fill the view from the dollied-in camera.
  float d = smoothstep(stagger * 0.45, stagger * 0.45 + 0.55, uDisperse);
  float de = d * d * (3.0 - 2.0 * d);
  vec3 world = (modelMatrix * vec4(p, 1.0)).xyz;
  if (de > 0.0) {
    float starZ = mix(uStarDepth.y, uStarDepth.z, aStar.z);
    float halfH = (uStarDepth.x - starZ) * uTanHalfFov;
    vec3 starWorld = vec3(aStar.x * halfH * uAspect, aStar.y * halfH, starZ);
    world = mix(world, starWorld, de) + curl.yzx * sin(de * PI) * uScale * 0.35;
  }

  vec4 mv = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  float depthScale = min(uCamDist / max(-mv.z, 0.1), uDepthCap);
  // Heat swells a point of light; pigment barely (a splash of big dots reads as a stain).
  float swell = 1.0 + min(boost, 2.0) * mix(0.5, 0.18, uLight);
  float size = uSize * aSeed.x * mix(1.0, 0.8, de) * swell * mix(1.0, mix(0.85, 0.5, uLight), k);
  gl_PointSize = min(size * uDpr * depthScale, uMaxPoint * uDpr);

  vec3 color = mix(uInk, uAccent, tone.x);
  if (aSeed.w > 1.5) color = uAccent2;
  vec3 starColor = mix(uInk, uAccent2, step(0.62, aSeed.y));
  color = mix(color, starColor, de * 0.6);
  color = mix(color, uAccent, clamp(boost, 0.0, 1.0) * mix(0.3, 0.7, uLight));
  color = mix(color, mix(uAccent, uAccent2, step(0.6, aSeed.y)), k * uLight * 0.5);

  float twinkle = 1.0 - uTwinkle * 0.4 * (0.5 + 0.5 * sin(uTime * (1.2 + aSeed.x * 2.2) + aSeed.y * 6.2831));
  float alpha = uAlpha * mix(0.4, 1.0, tone.y) * twinkle;
  if (isDust) alpha *= mix(0.5, 0.3, uLight);
  // Ink stars on a pale ground read as dust: keep them faint.
  alpha *= mix(1.0, mix(1.0, 0.5, uLight), de);
  alpha *= 1.0 + min(boost, 2.0) * (1.0 - uLight) * 0.8;
  float keep = isDust ? 0.55 * (1.0 - uLight) : 0.0;
  alpha *= mix(1.0, keep, smoothstep(0.15, 1.0, k));

  vColor = color;
  vAlpha = alpha;
  // Faded out (dissolved): emit no fragments at all, so a blown-away mark costs no fill.
  if (alpha < 0.004) {
    gl_PointSize = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
uniform float uShape;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a;
  if (uShape < 0.5) {
    // Light: hot core with a soft halo (dark styles, additive).
    a = exp(-d * d * 40.0) + exp(-d * d * 9.0) * 0.2;
    a *= 1.0 - smoothstep(0.4, 0.5, d);
  } else if (uShape < 1.5) {
    // Pigment: a fine, slightly soft dot, like stipple engraving.
    a = 1.0 - smoothstep(0.3, 0.5, d);
  } else {
    // Print: a crisp halftone square.
    vec2 q = abs(c);
    a = 1.0 - smoothstep(0.36, 0.46, max(q.x, q.y));
  }
  gl_FragColor = vec4(vColor, a * vAlpha);
  #include <colorspace_fragment>
}
`;
