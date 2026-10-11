import Matter from 'matter-js';

/**
 * The matter.js world behind 17 · Stack Physics. Framework-free: the section
 * owns the DOM and asks this class where each block is. Units are CSS pixels
 * of the section box (origin top-left), stepped at a fixed 60 Hz.
 *
 * Blocks live in one of four ways:
 * - in the tower: placed exactly on their slots and asleep (no motion, no cost);
 * - free: real rigid bodies (falling, dragged, thrown, tipped by tilt);
 * - flying: scripted back to their slot (the entrance drop and the rebuild),
 *   colliding with nothing until they land;
 * - parked: pulled out of the stage by a knock (the foundation), waiting
 *   off-screen for the rebuild to slide them back in.
 *
 * Nothing ever rises above `ceiling`: it is a real wall, so the copy above
 * the stage is never covered by a block.
 */

const { Bodies, Body, Composite, Constraint, Engine, Events, Sleeping } = Matter;
type MatterBody = Matter.Body;
type MatterConstraint = Matter.Constraint;
type Point = { x: number; y: number };

// Stepping
const STEP_MS = 1000 / 60;
const STEP_SQUARED = STEP_MS * STEP_MS;
const GRAVITY_SCALE = 0.001;
const GRAVITY_PER_STEP = GRAVITY_SCALE * STEP_SQUARED; // px per step², matter's g at |g| = 1
const MAX_STEPS_PER_TICK = 4;
const MAX_SPEED = 40; // px per step: walls are far thicker, so nothing tunnels.

// Stage walls (static, far outside the box)
const WALL = 2000;
const WALL_SPAN = 40000;

// Collision categories
const CATEGORY_TILE = 0x0002;
const MASK_SOLID = 0x0001 | CATEGORY_TILE;
const MASK_GHOST = 0;

// Block material. matter's friction is a per-step velocity impulse, not ∝
// load: at this scale anything above ~0.12 pins blocks even on a 45° tilt.
const TILE_FRICTION = 0.1;
const TILE_FRICTION_STATIC = 0.35;
const INERTIA_BOOST = 2.6; // slabs resist spinning, so heaps settle flat and readable
const SLEEP_FRAMES = 36;
const FRICTION_AIR = 0.012;
const FRICTION_AIR_HELD = 0.05;

// Keel: a moving block is nudged toward upright (as if bottom-weighted), so
// heaps land with readable names. Never applied to resting blocks.
const KEEL_GAIN = 0.0011;
const KEEL_MIN_SPEED = 1.2;

// Gravity and impacts. A tilt wakes the pile only once it has turned ~2° since the last wake
// (sensors stream ~60 Hz of tiny jitter; waking on each would keep the engine stepping).
const GRAVITY_WAKE_DELTA = 0.035;
const IMPACT_SPEED = 7;
const IMPACT_COOLDOWN_MS = 260;

// The knock: the foundation row is pulled out sideways, the rest of the
// tower hangs for a beat (the cartoon moment before the fall), then drops.
const YANK_BASE_MS = 170;
const YANK_PER_PX = 0.22;
const YANK_MAX_MS = 360;
const HANG_MS = 150;
const FOUNDATION_RETURN_MS = 460;

// Floor impacts strong enough for a shockwave
const FLOOR_IMPACT_SPEED = 3.2;
const FLOOR_IMPACT_COOLDOWN_MS = 60;

// Flights
const DROP_ACCEL = 0.0027; // px/ms², the entrance fall (a touch faster than the world's g)
const DROP_FADE = 0.3; // share of a drop spent fading in
const RETURN_BASE_MS = 340;
const RETURN_PER_PX = 0.55;
const RETURN_MAX_MS = 1050;
const RETURN_ROW_DELAY = 95;
const RETURN_COL_DELAY = 40;

// The desktop cursor as a solid ball
const CURSOR_RADIUS = 22;
const CURSOR_WAKE_MARGIN = 40;
const CURSOR_MAX_SPEED = 18;
const PARKED: Point = { x: -WALL_SPAN, y: -WALL_SPAN };

export type TowerState = 'building' | 'tower' | 'free';

export interface TileSpec {
  width: number;
  height: number;
  /** Corner radius of the block, so the collision shape matches the DOM box. */
  chamfer: number;
  /** Center of its slot in the tower. */
  slot: Point;
}

export interface WorldOptions {
  width: number;
  /** The floor line (bodies rest on it). */
  floor: number;
  /** No knock throws a block above this line (the header lives there). */
  ceiling: number;
  /**
   * The left wall (default 0). Wide screens fence the tower into its own
   * column, so a heap never slides under the copy beside it.
   */
  fenceLeft?: number;
  tiles: readonly TileSpec[];
  /** Tile indices per tower row, bottom row first. */
  rows: readonly (readonly number[])[];
  seed: number;
}

export interface TilePose {
  x: number;
  y: number;
  angle: number;
  /** 0..1, below 1 only while a block fades in on the entrance drop. */
  alpha: number;
  isResting: boolean;
}

interface Pose {
  x: number;
  y: number;
  angle: number;
}

interface Flight {
  kind: 'drop' | 'return' | 'yank';
  from: Pose;
  to: Pose;
  /** Sim time the flight starts / lasts (ms). */
  start: number;
  duration: number;
  /** Arc height of a return flight (px). */
  lift: number;
  /** Highest center line the block may reach (keeps arcs under the ceiling). */
  minY?: number;
}

interface Drag {
  body: MatterBody;
  constraint: MatterConstraint;
}

/** Small deterministic PRNG, so the same visit plays the same way. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Shortest signed turn from `angle` to 0, so an upside-down block rights itself the short way. */
function unwind(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export class StackWorld {
  /** A block was hit hard enough to deserve a flash. */
  onImpact: ((index: number, strength: number) => void) | null = null;
  /** A flying block reached its slot. */
  onLand: ((index: number, kind: 'drop' | 'return') => void) | null = null;
  /** A block hit the floor (x in stage px, relative speed in px per step). */
  onFloorImpact: ((x: number, strength: number) => void) | null = null;

  private readonly engine: Matter.Engine;
  private readonly bodies: MatterBody[];
  private readonly specs: readonly TileSpec[];
  private readonly rows: readonly (readonly number[])[];
  private readonly indexById = new Map<number, number>();
  private readonly flights = new Map<number, Flight>();
  /** Foundation blocks on their way out of the stage. */
  private readonly yanks = new Map<number, Flight>();
  /** Off-stage blocks waiting for the rebuild. */
  private readonly parked = new Set<number>();
  private readonly lastImpact: number[];
  private readonly random: () => number;
  private readonly walls: { floor: MatterBody; left: MatterBody; right: MatterBody; ceiling: MatterBody };
  private readonly cursor: MatterBody;
  private readonly drags = new Map<number, Drag>();
  private readonly width: number;
  private readonly fenceLeft: number;
  private readonly floor: number;
  private readonly ceiling: number;
  private simTime = 0;
  private accumulator = 0;
  /** Sim time the hanging tower drops after a knock (Infinity: nothing hangs). */
  private releaseAt = Infinity;
  private releaseSide = 0;
  private lastFloorImpact = -Infinity;
  private isTower = false;
  private isShown = false;
  private isCursorLive = false;
  private gravity: Point = { x: 0, y: 1 };
  private gravityAtWake: Point = { x: 0, y: 1 };

  constructor({ width, floor, ceiling, fenceLeft = 0, tiles, rows, seed }: WorldOptions) {
    this.width = width;
    this.fenceLeft = fenceLeft;
    this.floor = floor;
    this.ceiling = ceiling;
    this.specs = tiles;
    this.rows = rows;
    this.random = mulberry32(seed);
    this.engine = Engine.create({
      enableSleeping: true,
      positionIterations: 10,
      velocityIterations: 8,
      gravity: { x: 0, y: 1, scale: GRAVITY_SCALE },
    });

    this.walls = {
      floor: Bodies.rectangle(width / 2, floor + WALL / 2, WALL_SPAN, WALL, { isStatic: true, friction: 0.8 }),
      left: Bodies.rectangle(fenceLeft - WALL / 2, 0, WALL, WALL_SPAN, { isStatic: true, friction: 0.2 }),
      right: Bodies.rectangle(width + WALL / 2, 0, WALL, WALL_SPAN, { isStatic: true, friction: 0.2 }),
      ceiling: Bodies.rectangle(width / 2, ceiling - WALL / 2, WALL_SPAN, WALL, { isStatic: true, friction: 0.2 }),
    };
    this.cursor = Bodies.circle(PARKED.x, PARKED.y, CURSOR_RADIUS, { isStatic: true });
    Composite.add(this.engine.world, [this.walls.floor, this.walls.left, this.walls.right, this.walls.ceiling, this.cursor]);

    this.bodies = tiles.map((tile, index) => {
      const body = Bodies.rectangle(tile.slot.x, tile.slot.y, tile.width, tile.height, {
        chamfer: { radius: Math.max(0, Math.min(tile.chamfer, tile.height / 2 - 0.5, tile.width / 2 - 0.5)) },
        restitution: 0.12,
        friction: TILE_FRICTION,
        frictionStatic: TILE_FRICTION_STATIC,
        frictionAir: FRICTION_AIR,
        density: 0.0012,
        sleepThreshold: SLEEP_FRAMES,
        label: `tile:${index}`,
        collisionFilter: { category: CATEGORY_TILE, mask: MASK_SOLID },
      });
      Body.setInertia(body, body.inertia * INERTIA_BOOST);
      this.indexById.set(body.id, index);
      return body;
    });
    Composite.add(this.engine.world, this.bodies);
    this.lastImpact = new Array<number>(tiles.length).fill(-Infinity);
    Events.on(this.engine, 'collisionStart', this.handleCollisions);
  }

  // ---------- the tower ----------

  /** The finished tower, instantly (reduced motion, low tier, re-layouts). */
  placeAll(): void {
    this.clearKnock();
    this.flights.clear();
    this.bodies.forEach((body, index) => this.settleOnSlot(body, index));
    this.isTower = true;
    this.isShown = true;
  }

  /** Entrance: blocks fade in above their slots (under the ceiling) and drop into place, row by row from the floor up. */
  build(maxDrop: number, rowDelayMs: number, colDelayMs: number): void {
    this.releaseAll();
    this.clearKnock();
    this.flights.clear();
    this.isTower = false;
    this.isShown = true;
    this.rows.forEach((row, rowIndex) => {
      row.forEach((index, column) => {
        const { slot, height } = this.specs[index];
        // Never from above the ceiling: the header lives there.
        const drop = Math.max(24, Math.min(maxDrop, slot.y - height / 2 - this.ceiling));
        const tilt = (this.random() - 0.5) * 0.16;
        this.fly(index, {
          kind: 'drop',
          from: { x: slot.x, y: slot.y - drop, angle: tilt },
          to: { x: slot.x, y: slot.y, angle: 0 },
          start: this.simTime + rowIndex * rowDelayMs + column * colDelayMs + this.random() * 30,
          duration: Math.sqrt((2 * drop) / DROP_ACCEL),
          lift: 0,
        });
      });
    });
  }

  /** Every block flies back to its slot from wherever it is, the foundation first. */
  rebuild(): void {
    this.releaseAll();
    this.moveCursor(null);
    this.finishYanks();
    this.dropHanging();
    this.isTower = false;
    // Pulled-out foundation blocks slide straight back in first; the rest
    // arc over the heap once there is something to land on.
    const hasParked = this.parked.size > 0;
    let order = 0;
    this.rows.forEach((row, rowIndex) => {
      row.forEach((index, column) => {
        const body = this.bodies[index];
        const { slot } = this.specs[index];
        const from = { x: body.position.x, y: body.position.y, angle: unwind(body.angle) };
        const distance = Math.hypot(slot.x - from.x, slot.y - from.y);
        const isParked = this.parked.has(index);
        const isClose = !isParked && distance < 24 && Math.abs(from.angle) < 0.2;
        const delay = isParked
          ? column * RETURN_COL_DELAY
          : (hasParked ? FOUNDATION_RETURN_MS * 0.55 : 0) + rowIndex * RETURN_ROW_DELAY + column * RETURN_COL_DELAY;
        this.fly(index, {
          kind: 'return',
          from: isParked ? { x: from.x, y: slot.y, angle: 0 } : from,
          to: { x: slot.x, y: slot.y, angle: 0 },
          start: this.simTime + (isClose ? order * 12 : delay),
          duration: isParked ? FOUNDATION_RETURN_MS : isClose ? 260 : Math.min(RETURN_MAX_MS, RETURN_BASE_MS + distance * RETURN_PER_PX),
          lift: isParked || isClose ? 0 : 40 + Math.min(140, distance * 0.22),
        });
        order++;
      });
    });
    this.parked.clear();
  }

  /** Lands every flight at once (scrolled away mid-build). */
  finishFlights(): void {
    this.flights.forEach((_, index) => this.land(index));
    this.flights.clear();
    this.isTower = true;
  }

  /**
   * Knock the tower down by pulling its foundation: the bottom row shoots out
   * of the stage sideways, the rest hangs for a beat, then falls. With room
   * beside it the tower also topples toward the open side; boxed in
   * (phones) it collapses onto its own footprint. Nothing is thrown upward,
   * so the copy above the stage stays clear.
   */
  knock(): void {
    if (this.flights.size > 0) this.finishFlights();
    this.releaseAll();
    this.moveCursor(null);
    this.dropHanging();
    const tower = this.towerBounds();
    const roomLeft = tower.left - this.fenceLeft;
    const roomRight = this.width - tower.right;
    const canTopple = Math.max(roomLeft, roomRight) > (tower.right - tower.left) * 0.45;
    const side = canTopple ? (roomLeft > roomRight ? -1 : 1) : 0;
    const center = (tower.left + tower.right) / 2;
    const isFenced = this.fenceLeft > 0;
    const wasStanding = this.isTower;
    this.isTower = false;
    (this.rows[0] ?? []).forEach((index, column) => {
      const body = this.bodies[index];
      const spec = this.specs[index];
      // A toppling tower loses its footing on the far side; a boxed one is pulled apart from the
      // middle (a fenced one out to the right: the copy lives on the left).
      const direction = side !== 0 ? -side : isFenced || body.position.x >= center ? 1 : -1;
      const exitX = direction < 0 ? -spec.width * 0.6 - 40 : this.width + spec.width * 0.6 + 40;
      const distance = Math.abs(exitX - body.position.x);
      body.collisionFilter.mask = MASK_GHOST;
      Sleeping.set(body, false);
      this.yanks.set(index, {
        kind: 'yank',
        from: { x: body.position.x, y: body.position.y, angle: unwind(body.angle) },
        to: { x: exitX, y: body.position.y, angle: 0 },
        start: this.simTime + column * 24,
        duration: Math.min(YANK_MAX_MS, YANK_BASE_MS + distance * YANK_PER_PX),
        lift: 0,
      });
    });
    this.releaseSide = side;
    if (wasStanding) {
      // Still asleep: the tower hangs in the air until the beat is over.
      this.releaseAt = this.simTime + HANG_MS;
    } else {
      this.releaseAt = this.simTime;
    }
  }

  /** A hard phone shake: everything on the stage jumps (never above the ceiling). */
  shake(): void {
    this.interrupt();
    const height = Math.max(1, this.floor - this.towerBounds().top);
    this.bodies.forEach((body, index) => {
      if (this.parked.has(index) || this.yanks.has(index)) return;
      Sleeping.set(body, false);
      Body.setVelocity(body, { x: (this.random() - 0.5) * 12, y: -this.launchSpeed(body, (0.3 + 0.5 * this.random()) * height) });
      Body.setAngularVelocity(body, (this.random() - 0.5) * 0.14);
    });
  }

  state(): TowerState {
    if (this.flights.size > 0) return 'building';
    return this.isTower ? 'tower' : 'free';
  }

  // ---------- simulation ----------

  /** Advances the simulation by real time; returns whether anything still moves. */
  tick(deltaMs: number): boolean {
    this.accumulator += Math.min(deltaMs, 100);
    let steps = 0;
    while (this.accumulator >= STEP_MS && steps < MAX_STEPS_PER_TICK) {
      this.step();
      this.accumulator -= STEP_MS;
      steps++;
    }
    if (steps === MAX_STEPS_PER_TICK) this.accumulator = 0;
    return this.isActive();
  }

  isActive(): boolean {
    if (this.flights.size > 0 || this.yanks.size > 0 || this.drags.size > 0 || this.isCursorLive) return true;
    if (this.releaseAt !== Infinity) return true;
    return this.bodies.some((body, index) => !body.isSleeping && !this.parked.has(index));
  }

  pose(index: number): TilePose | null {
    if (!this.isShown) return null;
    const body = this.bodies[index];
    const flight = this.flights.get(index);
    let alpha = 1;
    if (flight?.kind === 'drop') alpha = Math.min(1, Math.max(0, (this.simTime - flight.start) / (flight.duration * DROP_FADE)));
    if (this.parked.has(index)) alpha = 0;
    const isMoving = Boolean(flight) || this.yanks.has(index);
    return { x: body.position.x, y: body.position.y, angle: body.angle, alpha, isResting: body.isSleeping && !isMoving };
  }

  // ---------- input ----------

  grab(pointerId: number, index: number, point: Point): boolean {
    const body = this.bodies[index];
    if (!body || this.parked.has(index) || this.yanks.has(index)) return false;
    this.release(pointerId);
    this.interrupt();
    const constraint = Constraint.create({
      pointA: { ...point },
      bodyB: body,
      pointB: { x: point.x - body.position.x, y: point.y - body.position.y },
      length: 0,
      stiffness: 0.16,
      damping: 0.06,
    });
    body.frictionAir = FRICTION_AIR_HELD;
    Composite.add(this.engine.world, constraint);
    this.drags.set(pointerId, { body, constraint });
    return true;
  }

  moveGrab(pointerId: number, point: Point): void {
    const drag = this.drags.get(pointerId);
    if (!drag) return;
    drag.constraint.pointA.x = point.x;
    drag.constraint.pointA.y = point.y;
    Sleeping.set(drag.body, false);
  }

  release(pointerId: number): void {
    const drag = this.drags.get(pointerId);
    if (!drag) return;
    Composite.remove(this.engine.world, drag.constraint);
    drag.body.frictionAir = FRICTION_AIR;
    this.drags.delete(pointerId);
  }

  isHeld(index: number): boolean {
    const body = this.bodies[index];
    for (const drag of this.drags.values()) if (drag.body === body) return true;
    return false;
  }

  /** A fast-moving desktop cursor becomes a solid ball that knocks blocks; null parks it. */
  moveCursor(point: Point | null): void {
    if (!point) {
      if (this.isCursorLive) Body.setPosition(this.cursor, PARKED);
      this.isCursorLive = false;
      return;
    }
    if (this.flights.size > 0) return;
    const from = this.cursor.position;
    const dx = point.x - from.x;
    const dy = point.y - from.y;
    const reachOfMove = Math.hypot(dx, dy);
    Body.setPosition(this.cursor, point);
    if (this.isCursorLive && reachOfMove > 0) {
      // The cursor's speed is what blocks feel; cap it so a wild flick knocks, not launches.
      const scale = Math.min(1, CURSOR_MAX_SPEED / reachOfMove);
      Body.setVelocity(this.cursor, { x: dx * scale, y: dy * scale });
    }
    this.isCursorLive = true;
    // matter skips static-vs-sleeping pairs, so wake whatever the cursor is about to hit
    // (the whole tower, if it is still standing: it is one structure).
    const reach = CURSOR_RADIUS + CURSOR_WAKE_MARGIN;
    const isNear = (body: MatterBody) => {
      const { min, max } = body.bounds;
      return point.x > min.x - reach && point.x < max.x + reach && point.y > min.y - reach && point.y < max.y + reach;
    };
    const hits = this.bodies.filter((body, index) => body.isSleeping && !this.parked.has(index) && isNear(body));
    if (hits.length === 0) return;
    if (this.isTower) this.interrupt();
    else hits.forEach(body => Sleeping.set(body, false));
  }

  /**
   * Gravity direction in stage space (device tilt); |g| ≈ 1 is normal.
   * Returns true when the change was big enough to wake the pile (the caller
   * then restarts its loop); smaller ones only steer bodies already moving.
   */
  setGravity(x: number, y: number): boolean {
    this.gravity = { x, y };
    this.engine.gravity.x = x;
    this.engine.gravity.y = y;
    // Measured from the last wake, so a slow, smoothed tilt still wakes the pile.
    if (Math.hypot(x - this.gravityAtWake.x, y - this.gravityAtWake.y) <= GRAVITY_WAKE_DELTA) return false;
    this.gravityAtWake = { x, y };
    if (this.flights.size === 0) this.interrupt();
    return true;
  }

  dispose(): void {
    Events.off(this.engine, 'collisionStart', this.handleCollisions);
    this.onImpact = null;
    this.onLand = null;
    this.onFloorImpact = null;
    this.drags.clear();
    this.flights.clear();
    this.clearKnock();
    Composite.clear(this.engine.world, false, true);
    Engine.clear(this.engine);
  }

  // ---------- internals ----------

  /** Any disturbance turns the standing tower into loose blocks (all of them: it is one structure). */
  private interrupt(): void {
    if (this.flights.size > 0) this.cancelFlights();
    if (this.releaseAt !== Infinity) this.dropHanging();
    if (!this.isTower) return;
    this.isTower = false;
    this.bodies.forEach((body, index) => {
      if (!this.parked.has(index) && !this.yanks.has(index)) Sleeping.set(body, false);
    });
  }

  /** The hanging tower falls: every block still standing wakes with a small, seeded nudge. */
  private dropHanging(): void {
    if (this.releaseAt === Infinity) return;
    this.releaseAt = Infinity;
    const side = this.releaseSide;
    const tower = this.towerBounds();
    const height = Math.max(1, this.floor - tower.top);
    const center = (tower.left + tower.right) / 2;
    this.bodies.forEach((body, index) => {
      if (this.parked.has(index) || this.yanks.has(index) || this.isHeld(index)) return;
      const lift = Math.min(1, Math.max(0, (this.floor - body.position.y) / height));
      Sleeping.set(body, false);
      if (side !== 0) {
        // Toppling: the top swings out farthest, like a wall falling from its base.
        Body.setVelocity(body, { x: side * (0.6 + 7.5 * lift + this.random() * 1.6), y: -this.random() * 1.2 });
        Body.setAngularVelocity(body, side * (0.01 + 0.04 * lift * this.random()));
        return;
      }
      // Collapsing in place: the higher a block, the harder it slumps outward and the more it spins.
      const outward = Math.sign(body.position.x - center) || (this.random() < 0.5 ? -1 : 1);
      Body.setVelocity(body, {
        x: outward * (0.5 + 3.6 * lift * (0.5 + this.random())) + (this.random() - 0.5) * 1.8,
        y: -this.random() * 0.8,
      });
      Body.setAngularVelocity(body, (this.random() - 0.5) * 0.09 + outward * (0.02 + 0.05 * lift * this.random()));
    });
  }

  /** Yanked blocks reach the edge and park off-stage. */
  private finishYanks(): void {
    this.yanks.forEach((flight, index) => this.park(index, flight.to));
    this.yanks.clear();
  }

  private park(index: number, pose: Pose): void {
    const body = this.bodies[index];
    body.collisionFilter.mask = MASK_GHOST;
    this.holdAt(body, pose);
    Sleeping.set(body, true);
    this.parked.add(index);
  }

  private clearKnock(): void {
    this.yanks.clear();
    this.releaseAt = Infinity;
    this.parked.forEach(index => {
      this.bodies[index].collisionFilter.mask = MASK_SOLID;
    });
    this.parked.clear();
  }

  /** Flying blocks become real bodies where they are, keeping their momentum. */
  private cancelFlights(): void {
    this.flights.forEach((flight, index) => {
      const body = this.bodies[index];
      const t = (this.simTime - flight.start) / flight.duration;
      body.collisionFilter.mask = MASK_SOLID;
      Sleeping.set(body, false);
      if (t > 0 && t < 1) {
        const ahead = this.flightPose(flight, Math.min(1, t + STEP_MS / flight.duration));
        Body.setVelocity(body, { x: ahead.x - body.position.x, y: ahead.y - body.position.y });
      }
    });
    this.flights.clear();
    this.isTower = false;
    this.isShown = true;
  }

  private fly(index: number, flight: Flight): void {
    const body = this.bodies[index];
    body.collisionFilter.mask = MASK_GHOST;
    Sleeping.set(body, false);
    this.parked.delete(index);
    this.flights.set(index, { ...flight, minY: this.ceiling + this.specs[index].height / 2 + 2 });
    this.holdAt(body, flight.from);
  }

  private step(): void {
    this.simTime += STEP_MS;
    if (this.simTime >= this.releaseAt) this.dropHanging();
    if (this.flights.size === 0) this.applyKeel();
    Engine.update(this.engine, STEP_MS);
    if (this.flights.size > 0) this.advanceFlights();
    if (this.yanks.size > 0) this.advanceYanks();
    for (let index = 0; index < this.bodies.length; index++) {
      if (this.parked.has(index) || this.yanks.has(index) || this.flights.has(index)) continue;
      this.constrain(this.bodies[index]);
    }
  }

  private advanceYanks(): void {
    const done: number[] = [];
    this.yanks.forEach((flight, index) => {
      const t = (this.simTime - flight.start) / flight.duration;
      if (t >= 1) done.push(index);
      else this.holdAt(this.bodies[index], t <= 0 ? flight.from : this.flightPose(flight, t));
    });
    done.forEach(index => {
      const flight = this.yanks.get(index);
      this.yanks.delete(index);
      if (flight) this.park(index, flight.to);
    });
  }

  private advanceFlights(): void {
    const landed: number[] = [];
    this.flights.forEach((flight, index) => {
      const t = (this.simTime - flight.start) / flight.duration;
      if (t >= 1) landed.push(index);
      else this.holdAt(this.bodies[index], t <= 0 ? flight.from : this.flightPose(flight, t));
    });
    landed.forEach(index => {
      const flight = this.flights.get(index);
      this.flights.delete(index);
      this.land(index);
      if (flight && flight.kind !== 'yank') this.onLand?.(index, flight.kind);
    });
    if (landed.length > 0 && this.flights.size === 0) this.isTower = true;
  }

  private flightPose(flight: Flight, t: number): Pose {
    const { from, to } = flight;
    if (flight.kind === 'drop') {
      const fall = t * t; // free fall: accelerating all the way down, then a hard stop on the slot
      return { x: from.x, y: from.y + (to.y - from.y) * fall, angle: from.angle * (1 - t) ** 2 };
    }
    if (flight.kind === 'yank') {
      // Whipped out: a quick start that keeps accelerating to the edge.
      const pull = t * (0.35 + 0.65 * t);
      return { x: from.x + (to.x - from.x) * pull, y: from.y, angle: from.angle * (1 - t) };
    }
    const glide = easeInOutCubic(t);
    const arcY = from.y + (to.y - from.y) * glide - flight.lift * Math.sin(Math.PI * t);
    return {
      x: from.x + (to.x - from.x) * glide,
      // The arc lifts the block clear of the heap and brings it down onto its slot from
      // above, never higher than the ceiling.
      y: Math.max(arcY, Math.min(to.y, from.y, flight.minY ?? -Infinity)),
      angle: from.angle * (1 - easeOutCubic(Math.min(1, t * 1.35))),
    };
  }

  private holdAt(body: MatterBody, pose: Pose): void {
    Body.setPosition(body, { x: pose.x, y: pose.y });
    Body.setAngle(body, pose.angle);
    Body.setVelocity(body, { x: 0, y: 0 });
    Body.setAngularVelocity(body, 0);
  }

  private land(index: number): void {
    this.settleOnSlot(this.bodies[index], index);
  }

  private settleOnSlot(body: MatterBody, index: number): void {
    const { slot } = this.specs[index];
    body.collisionFilter.mask = MASK_SOLID;
    body.frictionAir = FRICTION_AIR;
    this.holdAt(body, { x: slot.x, y: slot.y, angle: 0 });
    Sleeping.set(body, true);
  }

  private releaseAll(): void {
    [...this.drags.keys()].forEach(pointerId => this.release(pointerId));
  }

  /** The tower's footprint, from the slots. */
  private towerBounds(): { left: number; right: number; top: number } {
    return this.specs.reduce(
      (box, spec) => ({
        left: Math.min(box.left, spec.slot.x - spec.width / 2),
        right: Math.max(box.right, spec.slot.x + spec.width / 2),
        top: Math.min(box.top, spec.slot.y - spec.height / 2),
      }),
      { left: Infinity, right: -Infinity, top: Infinity }
    );
  }

  /** Upward speed (px per step) that lifts `body` by `rise`, capped so it stays under the ceiling. */
  private launchSpeed(body: MatterBody, rise: number): number {
    const room = Math.max(0, body.bounds.min.y - this.ceiling);
    const height = Math.min(rise, room * 0.9);
    return Math.sqrt(2 * GRAVITY_PER_STEP * Math.max(0, height));
  }

  private applyKeel(): void {
    const { x, y } = this.gravity;
    if (Math.hypot(x, y) < 0.2) return;
    // "Upright" = the block's bottom edge faces gravity (tilted phones too).
    const upright = Math.atan2(-x, y);
    for (let index = 0; index < this.bodies.length; index++) {
      const body = this.bodies[index];
      if (body.isSleeping || body.speed < KEEL_MIN_SPEED || this.isHeld(index)) continue;
      const tilt = Math.atan2(Math.sin(body.angle - upright), Math.cos(body.angle - upright));
      // torque → angular acceleration per step: torque / inertia * dt².
      body.torque -= (KEEL_GAIN * tilt * body.inertia) / STEP_SQUARED;
    }
  }

  private constrain(body: MatterBody): void {
    const { x: vx, y: vy } = body.velocity;
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_SPEED) Body.setVelocity(body, { x: (vx / speed) * MAX_SPEED, y: (vy / speed) * MAX_SPEED });
    this.keepInside(body);
  }

  private keepInside(body: MatterBody): void {
    const { x, y } = body.position;
    const margin = 160;
    if (x > this.fenceLeft - margin && x < this.width + margin && y > -margin && y < this.floor + margin) return;
    const halfWidth = (body.bounds.max.x - body.bounds.min.x) / 2;
    const minX = this.fenceLeft + halfWidth;
    Body.setPosition(body, {
      x: Math.min(Math.max(x, minX), Math.max(minX, this.width - halfWidth)),
      y: Math.min(Math.max(y, margin), this.floor * 0.5),
    });
    Body.setVelocity(body, { x: 0, y: 0 });
  }

  private readonly handleCollisions = (event: Matter.IEventCollision<Matter.Engine>): void => {
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const strength = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (a === this.walls.floor || b === this.walls.floor) {
        this.floorImpact(a === this.walls.floor ? b : a);
        continue;
      }
      if (!this.onImpact || strength < IMPACT_SPEED) continue;
      this.flash(a, strength);
      this.flash(b, strength);
    }
  };

  private floorImpact(body: MatterBody): void {
    const speed = Math.abs(body.velocity.y);
    if (!this.onFloorImpact || speed < FLOOR_IMPACT_SPEED || this.simTime - this.lastFloorImpact < FLOOR_IMPACT_COOLDOWN_MS) return;
    this.lastFloorImpact = this.simTime;
    this.onFloorImpact(body.position.x, speed);
  }

  private flash(body: MatterBody, strength: number): void {
    const index = this.indexById.get(body.parent?.id ?? body.id);
    if (index === undefined || this.simTime - this.lastImpact[index] < IMPACT_COOLDOWN_MS) return;
    this.lastImpact[index] = this.simTime;
    this.onImpact?.(index, strength);
  }
}
