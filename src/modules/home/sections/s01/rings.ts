import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, NormalBlending, ShaderMaterial, Vector2 } from 'three';

/**
 * Shockwave rings: one thin annulus per ripple (plus one for the hold
 * charge), drawn in the mark's local space so a ring sits exactly on the band
 * of particles its ripple is shoving. Each ring is a strip of quads whose
 * inner and outer edges are placed by the vertex shader (radius ± half
 * width), so only the ring's own pixels are filled, however large it grows.
 */

const SEGMENTS = 160;

/** A unit annulus: (cos, sin, side) per vertex, side -1 inner / +1 outer. Shared by every ring. */
export function buildRingGeometry(): BufferGeometry {
  const vertices = new Float32Array((SEGMENTS + 1) * 6);
  const index: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const angle = (i / SEGMENTS) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    vertices.set([c, s, -1, c, s, 1], i * 6);
    if (i < SEGMENTS) {
      const k = i * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(vertices, 3));
  geometry.setIndex(index);
  return geometry;
}

const RING_VERTEX = /* glsl */ `
uniform vec2 uCenter;
uniform float uRadius;
uniform float uHalfWidth;
varying float vSide;

void main() {
  vSide = position.z;
  float r = max(0.0, uRadius + position.z * uHalfWidth);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(uCenter + position.xy * r, 0.0, 1.0);
}
`;

const RING_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vSide;

void main() {
  // A hairline core inside a soft bloom.
  float s = abs(vSide);
  float a = (1.0 - smoothstep(0.05, 0.16, s)) * 0.85 + exp(-s * s * 6.0) * 0.3;
  gl_FragColor = vec4(uColor, a * uAlpha);
  #include <colorspace_fragment>
}
`;

export function buildRingMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: RING_VERTEX,
    fragmentShader: RING_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uCenter: { value: new Vector2() },
      uRadius: { value: 0 },
      uHalfWidth: { value: 0.01 },
      uAlpha: { value: 0 },
      uColor: { value: new Color() },
    },
  });
}

/** Theme → ring colour and blending (glow on dark grounds, a fine ink line on light ones). */
export function paintRing(material: ShaderMaterial, color: string, isAdditive: boolean): void {
  (material.uniforms.uColor.value as Color).set(color);
  material.blending = isAdditive ? AdditiveBlending : NormalBlending;
  material.needsUpdate = true;
}
