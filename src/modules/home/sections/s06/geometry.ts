import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, ShapeGeometry } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * toCreasedNormals hashes positions at 0.01 precision; our devices are ~1 unit
 * tall with 0.02 bevels, so slabs are built 10x larger and scaled down.
 */
const BUILD_SCALE = 10;
const CREASE_ANGLE = 0.5;

/** Rounded rectangle centred on the origin. */
export function roundedRectShape(width: number, height: number, radius: number): Shape {
  const r = Math.min(radius, width / 2, height / 2);
  const x = -width / 2;
  const y = -height / 2;
  const shape = new Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/**
 * Replace the shape-space UVs three generates for caps with 0..1 UVs over
 * the footprint, so a canvas texture maps once across the slab face.
 */
function normaliseUvs(geometry: BufferGeometry, width: number, height: number): void {
  const position = geometry.getAttribute('position');
  const uvs = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uvs[i * 2] = position.getX(i) / width + 0.5;
    uvs[i * 2 + 1] = position.getY(i) / height + 0.5;
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
}

interface SlabOptions {
  width: number;
  height: number;
  depth: number;
  /** Corner radius in plan. */
  radius: number;
  /** Edge roundover (bevel), ≤ depth / 2. */
  bevel: number;
  /** Curve segments per corner / bevel (tier-dependent). */
  segments: number;
}

/**
 * Phone- or laptop-like slab: rounded corners in plan, softly bevelled edges,
 * centred, depth along z. Material groups: 0 = front/back caps, 1 = sides.
 */
export function slabGeometry({ width, height, depth, radius, bevel, segments }: SlabOptions): BufferGeometry {
  const k = BUILD_SCALE;
  const b = Math.min(bevel, depth / 2 - 0.0005) * k;
  const shape = roundedRectShape(width * k - b * 2, height * k - b * 2, Math.max(0.001, radius * k - b));
  const extruded = new ExtrudeGeometry(shape, {
    depth: Math.max(0.005, depth * k - b * 2),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: Math.max(1, Math.round(segments / 2)),
    curveSegments: segments,
  });
  extruded.center();
  const geometry = toCreasedNormals(extruded, CREASE_ANGLE);
  geometry.scale(1 / k, 1 / k, 1 / k);
  normaliseUvs(geometry, width, height);
  return geometry;
}

/** Flat rounded rectangle with 0..1 UVs (z = 0, facing +z). */
export function roundedPlaneGeometry(width: number, height: number, radius: number, segments: number): ShapeGeometry {
  const geometry = new ShapeGeometry(roundedRectShape(width, height, radius), segments);
  normaliseUvs(geometry, width, height);
  return geometry;
}

/** Rounded frame (outer rect minus inner rect): the black print around a phone's cover glass. */
export function roundedRingGeometry(width: number, height: number, radius: number, inset: number, segments: number): ShapeGeometry {
  const outer = roundedRectShape(width, height, radius);
  outer.holes.push(roundedRectShape(width - inset * 2, height - inset * 2, Math.max(0.001, radius - inset)));
  return new ShapeGeometry(outer, segments);
}
