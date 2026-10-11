/**
 * Warp shaders. Both draw in screen space with their own projection (see
 * engine.ts) instead of the R3F camera, so the DOM name stream and the CSS
 * glow can use exactly the same math.
 */

const PROJECT = /* glsl */ `
  uniform float uF;
  uniform float uAspect;
  uniform vec2 uCenter;
  uniform float uDepth;

  // NDC of a point at polar xy and depth d (> 0) in front of the camera.
  vec2 project(vec2 xy, float d) {
    return vec2(xy.x / uAspect, xy.y) * uF / d + uCenter * smoothstep(0.0, uDepth, d);
  }
`;

/**
 * Clear zones: rectangles (the lead-in, the heading and deck) the light keeps
 * off, so text never sits on streaks. Same falloff as zoneFade() in engine.ts.
 * Needs uRes and uDpr declared before it.
 */
const ZONES = /* glsl */ `
  uniform vec4 uZoneA;   // centre xy, half size zw — stage CSS px, y down
  uniform vec4 uZoneB;
  uniform vec2 uZoneK;   // strength of A, B
  uniform float uFeather;

  float zoneFade(vec4 zone, float k, vec2 p) {
    if (k <= 0.001) return 1.0;
    vec2 q = abs(p - zone.xy) - zone.zw;
    float outside = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    return 1.0 - k * (1.0 - smoothstep(-0.25 * uFeather, uFeather, outside));
  }

  float clearZones() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
    return zoneFade(uZoneA, uZoneK.x, p) * zoneFade(uZoneB, uZoneK.y, p);
  }
`;

/**
 * One instanced quad per star, stretched from its head to a tail that lies
 * `uStreak` world units further away. At cruise speed the streak is shorter
 * than it is wide (a round dot); at warp it becomes a long radial line,
 * clamped to `uMaxLen` px so the peak never floods the screen.
 */
export const STREAK_VERTEX = /* glsl */ `
  attribute vec2 corner;  // x: side (-1 / 1), y: 0 head, 1 tail
  attribute vec4 aSeed;   // angle, radius, depth phase, size/tint

  uniform float uTravel;
  uniform float uStreak;
  uniform float uSpin;
  uniform float uNear;
  uniform float uRMin;
  uniform float uRMax;
  uniform vec2 uRes;
  uniform float uWidth;
  uniform float uDpr;
  uniform float uFar;
  uniform float uMaxLen;

  varying float vAlong;
  varying float vSide;
  varying float vLen;
  varying float vWidth;
  varying float vFade;
  varying float vTint;
  varying float vHash;

  ${PROJECT}

  void main() {
    float angle = aSeed.x * 6.28318530718 + uSpin;
    float radius = mix(uRMin, uRMax, sqrt(aSeed.y));
    vec2 xy = vec2(cos(angle), sin(angle)) * radius;

    float d = max(uDepth - mod(aSeed.z * uDepth + uTravel, uDepth), uNear);
    float len = uStreak * (0.7 + 0.6 * aSeed.w);

    vec2 head = project(xy, d) * 0.5 * uRes;
    vec2 tail = project(xy, d + len) * 0.5 * uRes;
    vec2 dir = head - tail;
    float pxLen = length(dir);
    vec2 axis = pxLen > 0.001 ? dir / pxLen : normalize(head + vec2(0.0001, 0.0));
    if (pxLen > uMaxLen) {
      tail = head - axis * uMaxLen;
      pxLen = uMaxLen;
    }
    vec2 normal = vec2(-axis.y, axis.x);

    float width = uWidth * uDpr * (0.55 + 0.9 * aSeed.w) * clamp(9.0 / d, 0.75, 2.8);
    // Extend both ends by half a width: short streaks stay round.
    vec2 a = head + axis * width * 0.5;
    vec2 b = tail - axis * width * 0.5;
    vec2 p = mix(a, b, corner.y) + normal * corner.x * width * 0.5;

    gl_Position = vec4(p / (0.5 * uRes), 0.0, 1.0);
    vAlong = corner.y;
    vSide = corner.x;
    vLen = pxLen + width;
    vWidth = width;
    vFade = smoothstep(uDepth, uDepth * uFar, d) * smoothstep(uNear, uNear + 1.8, d);
    vTint = aSeed.w;
    vHash = fract(sin(dot(aSeed.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }
`;

export const STREAK_FRAGMENT = /* glsl */ `
  uniform vec2 uRes;
  uniform float uDpr;
  uniform vec3 uInk;
  uniform vec3 uAccent;
  uniform vec3 uAccent2;
  uniform float uColorMix;
  uniform float uAccentShare;
  uniform float uAlpha;
  uniform float uDim;
  uniform float uTaper;

  varying float vAlong;
  varying float vSide;
  varying float vLen;
  varying float vWidth;
  varying float vFade;
  varying float vTint;
  varying float vHash;

  ${ZONES}

  void main() {
    // Once the streak is clearly a line it tapers toward its tail (a wedge).
    float isLine = smoothstep(3.0 * vWidth, 14.0 * vWidth, vLen);
    float halfW = vWidth * 0.5;
    float localW = halfW * mix(1.0, uTaper, vAlong * isLine);
    // Capsule distance in px: across = side × local half width, along = past either cap.
    float along = vAlong * vLen;
    float past = max(0.0, max(halfW - along, along - (vLen - halfW)));
    float dist = length(vec2(vSide * halfW, past));
    float edge = 1.0 - smoothstep(localW - 0.75, localW + 0.35, dist);

    // Bright head, fading tail.
    float trail = 1.0 - vAlong * isLine * 0.92;

    // Only a share of the streaks takes the accent at warp (all of them on dark,
    // one in ten on the light styles, where the rest stay graphite ink).
    vec3 hot = vTint > 0.74 ? uAccent2 : uAccent;
    float tint = uColorMix * step(1.0 - uAccentShare, vHash);
    vec3 color = mix(uInk, hot, tint);

    float a = edge * trail * vFade * uAlpha * uDim;
    if (a < 0.003) discard;
    a *= clearZones();
    if (a < 0.003) discard;
    gl_FragColor = vec4(color, a);
  }
`;

/** Full-screen pass: the tunnel's ribs rushing past at warp, plus the drop-out ring. */
export const GATE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Gate outline per style (uShape): 0 circle (Silk), 1 square (Concrete's
 * lattice), 2 octagon (Observatory), 3 eight-point star (Pomegranate's girih).
 */
export const GATE_FRAGMENT = /* glsl */ `
  #define GATES __GATES__
  uniform vec2 uRes;
  uniform float uDpr;
  uniform float uGateTravel;
  uniform float uSpacing;
  uniform float uRadius;
  uniform float uSpin;
  uniform float uGateAlpha;
  uniform vec3 uGateA;
  uniform vec3 uGateB;
  uniform float uShape;
  uniform vec2 uRing;     // phase 0..1, alpha
  uniform vec3 uRingColor;

  varying vec2 vUv;

  ${PROJECT}
  ${ZONES}

  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  float sdOctagon(vec2 p, float r) {
    const vec3 k = vec3(-0.9238795325, 0.3826834323, 0.4142135623);
    p = abs(p);
    p -= 2.0 * min(dot(vec2(k.x, k.y), p), 0.0) * vec2(k.x, k.y);
    p -= 2.0 * min(dot(vec2(-k.x, k.y), p), 0.0) * vec2(-k.x, k.y);
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
  }

  mat2 rotate(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
  }

  float shape(vec2 p, float r) {
    if (uShape < 0.5) return length(p) - r;
    if (uShape < 1.5) return sdBox(p, vec2(r));
    if (uShape < 2.5) return sdOctagon(p, r);
    // Two squares, one turned 45°: the eight-point star of girih tiling.
    float s = r * 0.84;
    return min(sdBox(p, vec2(s)), sdBox(rotate(0.7853981634) * p, vec2(s)));
  }

  void main() {
    vec2 frag = (vUv - 0.5) * uRes;
    float total = float(GATES) * uSpacing;
    vec3 color = vec3(0.0);
    float coverage = 0.0;
    if (uGateAlpha > 0.002) {
      for (int i = 0; i < GATES; i++) {
        float fi = float(i);
        float d = total - mod(fi * uSpacing + uGateTravel, total);
        vec2 centre = uCenter * smoothstep(0.0, uDepth, d) * 0.5 * uRes;
        float r = uRadius * uF / d * 0.5 * uRes.y;
        vec2 p = rotate(uSpin * 0.5 + fi * 0.3927) * (frag - centre);
        float sd = abs(shape(p, r));
        float w = uDpr * mix(0.7, 2.4, smoothstep(total * 0.7, 3.0, d));
        float line = 1.0 - smoothstep(w * 0.5, w * 0.5 + uDpr, sd);
        float fade = smoothstep(total, total * 0.55, d) * smoothstep(1.2, 7.0, d);
        float a = line * fade * uGateAlpha;
        color += (mod(fi, 2.0) < 0.5 ? uGateA : uGateB) * a;
        coverage += a;
      }
    }
    if (uRing.y > 0.002) {
      // The drop-out shockwave: one gate-shaped ring racing out of the vanishing point.
      float r = mix(0.02, 0.95, uRing.x) * length(uRes);
      vec2 p = rotate(uSpin * 0.5) * (frag - uCenter * 0.5 * uRes);
      float sd = abs(shape(p, r));
      float w = uDpr * mix(3.2, 1.2, uRing.x);
      float line = 1.0 - smoothstep(w * 0.5, w * 0.5 + 1.5 * uDpr, sd);
      float glow = (1.0 - smoothstep(0.0, 26.0 * uDpr, sd)) * 0.22;
      float a = (line + glow) * uRing.y;
      color += uRingColor * a;
      coverage += a;
    }
    float alpha = min(coverage, 1.0) * clearZones();
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(color / max(coverage, 0.0001), alpha);
  }
`;
