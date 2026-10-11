/**
 * GLSL for the globe. Colors arrive as linear THREE.Colors; every fragment
 * shader ends with <colorspace_fragment> so the token hexes come out exact.
 */

export const RIPPLE_COUNT = 8;
/** Seconds a landing ripple lives, and its speed across the sphere (radians/s). */
export const RIPPLE_LIFE = 1.9;
export const RIPPLE_SPEED = 0.34;
export const MAX_PULSES = 3;

const RIPPLE_GLSL = /* glsl */ `
  uniform vec4 uRipples[${RIPPLE_COUNT}];
  float rippleAt(vec3 n) {
    float ripple = 0.0;
    for (int i = 0; i < ${RIPPLE_COUNT}; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.w;
      if (age > 0.0 && age < ${RIPPLE_LIFE.toFixed(2)}) {
        float d = acos(clamp(dot(n, r.xyz), -1.0, 1.0));
        float front = age * ${RIPPLE_SPEED.toFixed(2)};
        float width = 0.028 + age * 0.03;
        float k = exp(-pow((d - front) / width, 2.0)) * pow(1.0 - age / ${RIPPLE_LIFE.toFixed(2)}, 1.5);
        // The impact point itself flashes first.
        k = max(k, exp(-pow(d / 0.05, 2.0)) * exp(-age * 5.0));
        ripple = max(ripple, k);
      }
    }
    return ripple;
  }
`;

/** Land dots. Drawn twice: the far side (uSide = -1, under the body) and the near side. */
export const DOTS_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uPointSize;
  uniform float uCenterDistance;
  uniform float uSide;
  uniform float uShimmer;
  uniform vec3 uSun;
  uniform float uNight;
  uniform float uLit[7];
  attribute float aTag;
  varying float vAlpha;
  varying float vLit;
  varying float vRipple;
  ${RIPPLE_GLSL}

  void main() {
    vec3 n = normalize(position);
    float ripple = rippleAt(n);
    float lit = uLit[int(aTag + 0.5)];
    vec4 mv = modelViewMatrix * vec4(position * (1.0 + ripple * 0.045), 1.0);
    vec3 nv = normalize(normalMatrix * n);
    float facing = dot(nv, normalize(-mv.xyz)) * uSide;
    float limb = smoothstep(0.0, 0.42, facing);
    // A slow sheen drifting across the land, like light on glaze.
    float sheen = 1.0 + uShimmer * 0.22 * sin(dot(n, vec3(5.0, 2.0, -3.0)) * 2.2 - uTime * 0.55);
    // Live terminator: land on the night side dims; lit markets keep most of their light.
    float day = smoothstep(-0.1, 0.16, dot(n, uSun));
    vAlpha = limb * sheen * mix(mix(uNight, 1.0, day), 1.0, lit * 0.7);
    vLit = lit;
    vRipple = ripple;
    float size = uPointSize * (uCenterDistance / -mv.z) * mix(0.5, 1.0, limb);
    gl_PointSize = size * (1.0 + ripple * 0.9 + lit * 0.22);
    gl_Position = facing > 0.0 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

export const DOTS_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uLitColor;
  uniform vec3 uGlowColor;
  uniform float uOpacity;
  uniform float uLitOpacity;
  varying float vAlpha;
  varying float vLit;
  varying float vRipple;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.32, d);
    if (disc <= 0.0) discard;
    vec3 color = mix(mix(uColor, uLitColor, vLit), uGlowColor, vRipple);
    float alpha = mix(uOpacity, uLitOpacity, max(vLit, vRipple));
    gl_FragColor = vec4(color, disc * vAlpha * alpha);
    #include <colorspace_fragment>
  }
`;

/** The globe's body: a tinted sphere with a soft rim and limb shading. */
export const BODY_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vGlobeNormal;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vGlobeNormal = normal;
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const BODY_FRAGMENT = /* glsl */ `
  uniform vec3 uBody;
  uniform vec3 uRim;
  uniform float uOpacity;
  uniform float uRimStrength;
  uniform float uShade;
  uniform vec3 uSun;
  uniform float uNightShade;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vGlobeNormal;
  void main() {
    float f = 1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0);
    float day = smoothstep(-0.12, 0.2, dot(normalize(vGlobeNormal), uSun));
    vec3 color = uBody * (1.0 - uShade * f * f) * (1.0 - uNightShade * (1.0 - day));
    float rim = pow(f, 3.2) * uRimStrength;
    gl_FragColor = vec4(mix(color, uRim, rim), uOpacity);
    #include <colorspace_fragment>
  }
`;

/**
 * Atmosphere: a back-faced shell. Glow is measured by the angle between the
 * fragment and the globe centre against the globe's angular radius, so the
 * halo hugs the true silhouette under perspective.
 */
export const HALO_VERTEX = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vCenter;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vPos = mv.xyz;
    vCenter = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

export const HALO_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uLineColor;
  uniform float uRadius;
  uniform float uStrength;
  uniform float uSpread;
  uniform float uLine;
  varying vec3 vPos;
  varying vec3 vCenter;
  void main() {
    float limb = asin(clamp(uRadius / length(vCenter), 0.0, 1.0));
    float angle = acos(clamp(dot(normalize(vPos), normalize(vCenter)), -1.0, 1.0));
    float t = angle / limb;
    float outside = exp(-max(t - 1.0, 0.0) / uSpread);
    float glow = t < 1.0 ? smoothstep(0.55, 1.0, t) : outside;
    float line = exp(-pow((t - 1.0) / 0.0045, 2.0)) * uLine;
    vec3 color = mix(uColor, uLineColor, line / max(glow * uStrength + line, 0.0001));
    gl_FragColor = vec4(color, clamp(glow * uStrength + line, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

/** Graticule lines: only the near side, fading at the limb. */
export const GRID_VERTEX = /* glsl */ `
  varying float vFacing;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 nv = normalize(normalMatrix * normalize(position));
    vFacing = dot(nv, normalize(-mv.xyz));
    gl_Position = projectionMatrix * mv;
  }
`;

export const GRID_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFacing;
  void main() {
    float a = smoothstep(0.0, 0.5, vFacing) * uOpacity;
    if (a <= 0.001) discard;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

/** Arcs: tubes whose uv.x runs along the flight. Draw-on, a quiet trail and travelling comets. */
export const ARC_VERTEX = /* glsl */ `
  varying float vT;
  varying float vEdge;
  void main() {
    vT = uv.x;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 nv = normalize(normalMatrix * normal);
    vEdge = abs(dot(nv, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

export const ARC_FRAGMENT = /* glsl */ `
  uniform float uDraw;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uOffset;
  uniform float uPulses;
  uniform float uTrail;
  uniform float uTail;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uHead;
  varying float vT;
  varying float vEdge;

  void main() {
    if (vT > uDraw) discard;
    float headFront = uDraw < 0.999 ? exp(-pow((uDraw - vT) / 0.05, 2.0)) : 0.0;
    float pulse = 0.0;
    if (uDraw >= 0.999) {
      for (int i = 0; i < ${MAX_PULSES}; i++) {
        if (float(i) >= uPulses) break;
        float phase = fract(uTime * uSpeed + uOffset + float(i) / uPulses);
        float d = phase - vT;
        if (d > 0.0 && d < uTail) pulse = max(pulse, pow(1.0 - d / uTail, 2.2));
      }
    }
    float glow = max(pulse, headFront);
    // Fade both ends into the surface.
    float ends = smoothstep(0.0, 0.035, vT) * smoothstep(1.0, 0.965, vT);
    float edge = mix(0.35, 1.0, smoothstep(0.0, 0.7, vEdge));
    vec3 color = mix(mix(uColorA, uColorB, vT), uHead, glow * 0.75);
    float alpha = (uTrail + glow * (1.0 - uTrail)) * edge * mix(0.4, 1.0, ends);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

/** Round sprites: comet heads and pin dots. aSize scales, aAlpha fades. */
export const SPRITE_VERTEX = /* glsl */ `
  uniform float uPointSize;
  uniform float uCenterDistance;
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vAlpha = aAlpha;
    gl_PointSize = uPointSize * aSize * (uCenterDistance / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

export const SPRITE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uCore;
  uniform float uSoftness;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(0.34, 0.18, d);
    float halo = pow(1.0 - d, 2.0) * uSoftness;
    vec3 color = mix(uColor, uCore, core);
    gl_FragColor = vec4(color, (core + halo) * vAlpha);
    #include <colorspace_fragment>
  }
`;

/** Pin rings: a plane tangent to the sphere drawing expanding rings around a solid centre. */
export const RING_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const RING_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uAlpha;
  uniform float uRings;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;
    float a = 0.0;
    for (int i = 0; i < 3; i++) {
      if (float(i) >= uRings) break;
      float phase = fract(uTime * uSpeed + float(i) / uRings);
      float radius = 0.12 + phase * 0.88;
      a = max(a, exp(-pow((r - radius) / 0.04, 2.0)) * pow(1.0 - phase, 1.4));
    }
    gl_FragColor = vec4(uColor, a * uAlpha);
    #include <colorspace_fragment>
  }
`;
