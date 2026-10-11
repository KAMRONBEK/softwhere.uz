import { Color, ShaderMaterial, Texture, Vector2, Vector3 } from 'three';

/**
 * A device display: one plane, one shader. It shows real app screens inside
 * a rounded display, changes between two of them the way the app does (a
 * navigation push or a tab crossfade), draws a finger tap, scrolls a tall
 * capture through the display window (the laptop's website), powers on/off
 * and punches the camera hole. Unlit and not tone-mapped: screens emit their
 * own true colors.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uA;
  uniform sampler2D uB;
  uniform float uHasA;
  uniform float uHasB;
  uniform vec3 uFillA;
  uniform vec3 uFillB;
  uniform float uMix;
  uniform float uPush;
  // Visible window of the textures: x = top offset, y = height (fractions of the image).
  uniform vec2 uWindow;
  uniform sampler2D uChrome;
  uniform float uChromeH;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uPower;
  uniform vec3 uOff;
  uniform float uHole;
  uniform vec2 uHolePos;
  uniform float uSheen;
  // x, y (0..1, y from the top), progress 0..1.
  uniform vec3 uTap;
  varying vec2 vUv;

  float roundBox(vec2 p, vec2 halfSize, float r) {
    vec2 q = abs(p) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  vec3 screenAt(sampler2D tex, float has, vec3 fill, vec2 uv) {
    vec2 st = vec2(uv.x, 1.0 - (uWindow.x + (1.0 - uv.y) * uWindow.y));
    return mix(fill, texture2D(tex, st).rgb, has);
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float d = roundBox(p, uSize * 0.5, uRadius);
    float aa = max(fwidth(d), 1e-4);
    if (d > aa) discard;
    float edge = 1.0 - smoothstep(-aa, aa, d);

    // Content area (below the browser bar, if any).
    float contentTop = 1.0 - uChromeH;
    vec2 uv = vec2(vUv.x, vUv.y / max(contentTop, 1e-4));
    vec3 color;
    float m = uMix;
    if (uPush > 0.5) {
      // Navigation push: B slides in from the right over A, A drifts left and dims.
      float split = 1.0 - m;
      if (uv.x >= split) {
        color = screenAt(uB, uHasB, uFillB, vec2(uv.x - split, uv.y));
      } else {
        color = screenAt(uA, uHasA, uFillA, vec2(uv.x + m * 0.3, uv.y));
        color *= 1.0 - 0.28 * m;
        color *= 1.0 - 0.22 * m * smoothstep(0.1, 0.0, split - uv.x);
      }
    } else {
      // Tab switch: crossfade, the new tab settling from 98%.
      vec2 grow = (uv - 0.5) / (0.98 + 0.02 * m) + 0.5;
      color = mix(screenAt(uA, uHasA, uFillA, uv), screenAt(uB, uHasB, uFillB, grow), m);
    }

    // Finger tap: a soft grey disc that swells and fades, like a screen recording's touch.
    if (uTap.z > 0.0 && uTap.z < 1.0) {
      vec2 tp = vec2(uTap.x, 1.0 - uTap.y);
      vec2 dp = (vUv - tp) * vec2(uSize.x / uSize.y, 1.0);
      float r = mix(0.018, 0.034, smoothstep(0.0, 0.6, uTap.z));
      float alpha = smoothstep(0.0, 0.18, uTap.z) * (1.0 - smoothstep(0.55, 1.0, uTap.z));
      float disc = 1.0 - smoothstep(r - 0.003, r + 0.003, length(dp));
      float ring = (1.0 - smoothstep(0.0, 0.004, abs(length(dp) - r))) * 0.6;
      color = mix(color, vec3(0.55), disc * alpha * 0.55);
      color = mix(color, vec3(1.0), ring * alpha * 0.5);
    }

    if (uChromeH > 0.0 && vUv.y > contentTop) {
      color = texture2D(uChrome, vec2(vUv.x, (vUv.y - contentTop) / uChromeH)).rgb;
    }

    color = mix(uOff, color, uPower);

    float hole = 1.0 - smoothstep(uHole - aa, uHole + aa, length(p - uHolePos));
    color = mix(color, vec3(0.0), hole * step(1e-4, uHole));

    // A faint moving glare, so the glass reads as glass when it turns.
    float band = (p.x * 0.55 + p.y) / uSize.y - uSheen;
    color += (1.0 - smoothstep(0.0, 0.22, abs(band))) * 0.05;

    gl_FragColor = vec4(color * edge, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface ScreenUniforms {
  [uniform: string]: { value: unknown };
  uA: { value: Texture | null };
  uB: { value: Texture | null };
  uHasA: { value: number };
  uHasB: { value: number };
  uFillA: { value: Color };
  uFillB: { value: Color };
  uMix: { value: number };
  uPush: { value: number };
  uWindow: { value: Vector2 };
  uChrome: { value: Texture | null };
  uChromeH: { value: number };
  uSize: { value: Vector2 };
  uRadius: { value: number };
  uPower: { value: number };
  uOff: { value: Color };
  uHole: { value: number };
  uHolePos: { value: Vector2 };
  uSheen: { value: number };
  uTap: { value: Vector3 };
}

export type ScreenMaterial = ShaderMaterial & { uniforms: ScreenUniforms };

interface ScreenOptions {
  width: number;
  height: number;
  radius: number;
  /** Camera punch-hole radius (0 = none) and its centre relative to the screen centre. */
  hole?: number;
  holeY?: number;
}

/** Display switched off: black glass with a hint of blue. */
const SCREEN_OFF = '#030406';

export function createScreenMaterial({ width, height, radius, hole = 0, holeY = 0 }: ScreenOptions): ScreenMaterial {
  const uniforms: ScreenUniforms = {
    uA: { value: null },
    uB: { value: null },
    uHasA: { value: 0 },
    uHasB: { value: 0 },
    uFillA: { value: new Color('#101014') },
    uFillB: { value: new Color('#101014') },
    uMix: { value: 0 },
    uPush: { value: 1 },
    uWindow: { value: new Vector2(0, 1) },
    uChrome: { value: null },
    uChromeH: { value: 0 },
    uSize: { value: new Vector2(width, height) },
    uRadius: { value: radius },
    uPower: { value: 1 },
    uOff: { value: new Color(SCREEN_OFF) },
    uHole: { value: hole },
    uHolePos: { value: new Vector2(0, holeY) },
    uSheen: { value: -1 },
    uTap: { value: new Vector3(0.5, 0.5, 0) },
  };
  const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, toneMapped: false });
  return material as ScreenMaterial;
}

/** Bind a (possibly not yet loaded) texture to slot A or B. */
export function bindScreen(material: ScreenMaterial, slot: 'A' | 'B', texture: Texture | null, fill: string): void {
  const uniforms = material.uniforms;
  if (slot === 'A') {
    uniforms.uA.value = texture;
    uniforms.uHasA.value = texture ? 1 : 0;
    uniforms.uFillA.value.set(fill);
  } else {
    uniforms.uB.value = texture;
    uniforms.uHasB.value = texture ? 1 : 0;
    uniforms.uFillB.value.set(fill);
  }
}

/** Point the display's browser bar at a (re)painted chrome texture. */
export function setChrome(material: ScreenMaterial, texture: Texture | null): void {
  material.uniforms.uChrome.value = texture;
}
