/**
 * Shared Three.js scaffolding for the two interactive scenes: renderer with
 * visibility-aware loop, cinematic camera rig, tweens, pointer handling and
 * small texture helpers. Nothing here knows about rooms or floor plans.
 */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  CanvasTexture,
  CatmullRomCurve3,
  Material,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  Points,
  Scene,
  Spherical,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  type ColorRepresentation,
} from 'three';

export type Ease = (t: number) => number;
export const linear: Ease = (t) => t;
export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic: Ease = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeInOutSine: Ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack: Ease = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export type SceneTier = 'full' | 'lite';
export type DegradeReason = 'performance' | 'context';

type TweenOptions = {
  key?: string;
  from: number;
  to: number;
  duration: number;
  delay?: number;
  ease?: Ease;
  onUpdate: (value: number, progress: number) => void;
  onComplete?: () => void;
};

type TweenItem = TweenOptions & { elapsed: number; done: boolean };

/** Minimal keyed tweens: adding a key replaces the running tween of that key. */
export class Tweens {
  private items: TweenItem[] = [];

  add(options: TweenOptions) {
    if (options.key) this.cancel(options.key);
    const item: TweenItem = { ...options, elapsed: 0, done: false };
    if (item.duration <= 0 && !item.delay) {
      item.onUpdate(item.to, 1);
      item.done = true;
      item.onComplete?.();
      return item;
    }
    this.items.push(item);
    return item;
  }

  cancel(key: string) {
    this.items = this.items.filter((item) => item.key !== key);
  }

  get active() {
    return this.items.length > 0;
  }

  clear() {
    this.items = [];
  }

  update(dt: number) {
    if (!this.items.length) return;
    for (const item of this.items) {
      item.elapsed += dt;
      const local = item.elapsed - (item.delay ?? 0);
      if (local < 0) continue;
      const progress = item.duration > 0 ? clamp01(local / item.duration) : 1;
      const eased = (item.ease ?? easeInOutCubic)(progress);
      item.onUpdate(item.from + (item.to - item.from) * eased, progress);
      if (progress >= 1) {
        item.done = true;
        item.onComplete?.();
      }
    }
    this.items = this.items.filter((item) => !item.done);
  }
}

export type Shot = { position: Vector3; target: Vector3 };
export const shot = (
  position: [number, number, number],
  target: [number, number, number],
): Shot => ({
  position: new Vector3(...position),
  target: new Vector3(...target),
});

const up = new Vector3(0, 1, 0);

/**
 * Keeps a base shot (position + look target) and layers user orbit offsets,
 * pointer parallax and an idle sway on top, so cinematic moves and user input
 * never fight for the camera.
 */
export class CameraRig {
  readonly position = new Vector3();
  readonly target = new Vector3();
  yaw = 0;
  pitch = 0;
  yawLimit = 1.05;
  pitchLimit: [number, number] = [-0.32, 0.42];
  motion = true;
  sway = 0.03;
  parallaxStrength = 1;
  distanceScale = 1;
  private readonly parallax = new Vector2();
  private readonly parallaxTarget = new Vector2();
  private readonly fromPosition = new Vector3();
  private readonly fromTarget = new Vector3();
  private readonly toPosition = new Vector3();
  private readonly toTarget = new Vector3();
  private pathPosition: CatmullRomCurve3 | null = null;
  private pathTarget: CatmullRomCurve3 | null = null;
  private t = 1;
  private duration = 0;
  private arc = 0;
  private yawStart = 0;
  private pitchStart = 0;
  private ease: Ease = easeInOutCubic;
  private onArrive?: () => void;
  private readonly offset = new Vector3();
  private readonly spherical = new Spherical();
  private readonly right = new Vector3();
  private readonly final = new Vector3();

  constructor(readonly camera: PerspectiveCamera) {}

  get moving() {
    return this.t < 1;
  }

  jumpTo(target: Shot) {
    this.position.copy(target.position);
    this.target.copy(target.target);
    this.pathPosition = this.pathTarget = null;
    this.yaw = this.pitch = 0;
    this.t = 1;
  }

  moveTo(
    target: Shot,
    duration: number,
    options: { ease?: Ease; arc?: number; onArrive?: () => void } = {},
  ) {
    if (duration <= 0) {
      this.jumpTo(target);
      options.onArrive?.();
      return;
    }
    this.fromPosition.copy(this.position);
    this.fromTarget.copy(this.target);
    this.toPosition.copy(target.position);
    this.toTarget.copy(target.target);
    this.pathPosition = this.pathTarget = null;
    this.beginTransition(duration, options);
  }

  flyThrough(
    waypoints: Shot[],
    duration: number,
    options: { ease?: Ease; onArrive?: () => void } = {},
  ) {
    const last = waypoints[waypoints.length - 1];
    if (!last) return;
    if (duration <= 0 || waypoints.length < 2) {
      this.jumpTo(last);
      options.onArrive?.();
      return;
    }
    this.pathPosition = new CatmullRomCurve3(
      waypoints.map((point) => point.position.clone()),
      false,
      'centripetal',
    );
    this.pathTarget = new CatmullRomCurve3(
      waypoints.map((point) => point.target.clone()),
      false,
      'centripetal',
    );
    this.beginTransition(duration, { ...options, arc: 0 });
  }

  private beginTransition(
    duration: number,
    options: { ease?: Ease; arc?: number; onArrive?: () => void },
  ) {
    this.duration = duration;
    this.t = 0;
    this.arc = options.arc ?? 0;
    this.ease = options.ease ?? easeInOutCubic;
    this.onArrive = options.onArrive;
    this.yawStart = this.yaw;
    this.pitchStart = this.pitch;
  }

  orbitBy(dx: number, dy: number) {
    this.yaw = Math.max(
      -this.yawLimit,
      Math.min(this.yawLimit, this.yaw - dx * 0.0052),
    );
    this.pitch = Math.max(
      this.pitchLimit[0],
      Math.min(this.pitchLimit[1], this.pitch + dy * 0.0042),
    );
  }

  setParallax(x: number, y: number) {
    this.parallaxTarget.set(x, y);
  }

  update(dt: number, elapsed: number) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.duration);
      const k = this.ease(this.t);
      if (this.pathPosition && this.pathTarget) {
        this.pathPosition.getPoint(k, this.position);
        this.pathTarget.getPoint(k, this.target);
      } else {
        this.position.lerpVectors(this.fromPosition, this.toPosition, k);
        this.position.y += Math.sin(k * Math.PI) * this.arc;
        this.target.lerpVectors(this.fromTarget, this.toTarget, k);
      }
      // Scene changes gently undo the orbit the visitor applied earlier.
      this.yaw = this.yawStart * (1 - k);
      this.pitch = this.pitchStart * (1 - k);
      if (this.t >= 1) {
        this.pathPosition = this.pathTarget = null;
        const arrive = this.onArrive;
        this.onArrive = undefined;
        arrive?.();
      }
    }
    this.parallax.lerp(this.parallaxTarget, 1 - Math.pow(0.002, dt));
    this.offset.copy(this.position).sub(this.target);
    this.spherical.setFromVector3(this.offset);
    this.spherical.theta += this.yaw;
    this.spherical.phi = Math.max(
      0.14,
      Math.min(Math.PI / 2 - 0.05, this.spherical.phi - this.pitch),
    );
    this.spherical.radius *= this.distanceScale;
    this.offset.setFromSpherical(this.spherical);
    this.final.copy(this.target).add(this.offset);
    if (this.motion) {
      this.right.crossVectors(up, this.offset).normalize();
      const radius = this.spherical.radius;
      this.final.addScaledVector(
        this.right,
        this.parallax.x * this.parallaxStrength * radius * 0.06,
      );
      this.final.y += this.parallax.y * this.parallaxStrength * radius * 0.04;
      this.final.addScaledVector(
        this.right,
        Math.sin(elapsed * 0.33) * this.sway,
      );
      this.final.y += Math.sin(elapsed * 0.47 + 1.2) * this.sway * 0.6;
    }
    this.camera.position.copy(this.final);
    this.camera.lookAt(this.target);
  }
}

export type StageOptions = {
  tier: SceneTier;
  reducedMotion: boolean;
  fov?: number;
  near?: number;
  far?: number;
  exposure?: number;
  onDegrade?: (reason: DegradeReason) => void;
};

export type Projected = { x: number; y: number; visible: boolean };

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  readonly tweens = new Tweens();
  readonly rig: CameraRig;
  readonly tier: SceneTier;
  readonly reducedMotion: boolean;
  readonly shadows: boolean;
  width = 1;
  height = 1;
  elapsed = 0;
  readonly onFrame: Array<(dt: number, elapsed: number) => void> = [];
  private frame = 0;
  private running = false;
  private visible = true;
  private pageVisible = !document.hidden;
  private last = 0;
  private accumulated = 0;
  private degraded = false;
  private warmup = 0;
  private samples: number[] = [];
  private slowWindows = 0;
  private dirty = 2;
  private readonly projection = new Vector3();
  private readonly onVisibility = () => {
    this.pageVisible = !document.hidden;
    this.sync();
  };
  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    this.fail('context');
  };

  constructor(
    readonly mount: HTMLElement,
    private readonly options: StageOptions,
  ) {
    this.tier = options.tier;
    this.reducedMotion = options.reducedMotion;
    this.shadows = options.tier === 'full';
    this.canvas = document.createElement('canvas');
    mount.append(this.canvas);
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: options.tier === 'full',
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, options.tier === 'full' ? 2 : 1.5),
    );
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = options.exposure ?? 1.05;
    this.renderer.setClearColor(0x000000, 0);
    if (this.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFShadowMap;
    }
    this.camera = new PerspectiveCamera(
      options.fov ?? 38,
      1,
      options.near ?? 0.1,
      options.far ?? 80,
    );
    this.rig = new CameraRig(this.camera);
    this.rig.motion = !options.reducedMotion;
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
  }

  get active() {
    return this.frame !== 0;
  }

  resize() {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    if (!width || !height) return;
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.dirty = 2;
    // Narrow mounts pull the camera back so the whole scene stays framed.
    this.rig.distanceScale =
      this.camera.aspect < 1.45 ? Math.pow(1.45 / this.camera.aspect, 0.72) : 1;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.dirty = 2;
    this.sync();
  }

  /** Ask for a couple of frames even when nothing is animating (reduced motion). */
  invalidate() {
    this.dirty = 2;
  }

  start() {
    this.running = true;
    this.sync();
  }

  stop() {
    this.running = false;
    this.sync();
  }

  /** Screen position (in mount pixels) of a world point. */
  project(point: Vector3, out: Projected): Projected {
    this.projection.copy(point).project(this.camera);
    out.x = ((this.projection.x + 1) / 2) * this.width;
    out.y = ((1 - this.projection.y) / 2) * this.height;
    out.visible =
      this.projection.z < 1 &&
      this.projection.z > -1 &&
      out.x > -40 &&
      out.x < this.width + 40 &&
      out.y > -40 &&
      out.y < this.height + 40;
    return out;
  }

  dispose() {
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.tweens.clear();
    this.onFrame.length = 0;
    const materials = new Set<Material>();
    this.scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof Points) {
        object.geometry.dispose();
      }
      const material = (object as { material?: Material | Material[] })
        .material;
      if (Array.isArray(material)) material.forEach((m) => materials.add(m));
      else if (material) materials.add(material);
    });
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof Texture && !value.userData.shared) value.dispose();
      });
      material.dispose();
    });
    this.scene.clear();
    this.renderer.dispose();
    this.canvas.remove();
  }

  private sync() {
    const should =
      this.running && this.visible && this.pageVisible && !this.degraded;
    if (should && !this.frame) {
      this.last = performance.now();
      this.accumulated = 0;
      this.frame = requestAnimationFrame(this.loop);
    } else if (!should && this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  private readonly loop = (now: number) => {
    this.frame = 0;
    let dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.tier === 'lite') {
      // Lighter devices render at about 30 frames per second.
      this.accumulated += dt;
      if (this.accumulated < 1 / 31) {
        this.frame = requestAnimationFrame(this.loop);
        return;
      }
      dt = this.accumulated;
      this.accumulated = 0;
    }
    this.resize();
    this.elapsed += dt;
    this.tweens.update(dt);
    this.rig.update(dt, this.elapsed);
    for (const callback of this.onFrame) callback(dt, this.elapsed);
    // With reduced motion nothing moves on its own: render only while something changes.
    const animating = this.tweens.active || this.rig.moving || this.dirty > 0;
    if (!this.reducedMotion || animating) {
      if (this.dirty > 0) this.dirty--;
      this.renderer.render(this.scene, this.camera);
      this.monitor(dt);
    }
    if (!this.degraded) this.frame = requestAnimationFrame(this.loop);
  };

  /** Three slow windows in a row (median under ~18 fps) hand over to the 2D view. */
  private monitor(dt: number) {
    if (this.warmup < 90) {
      this.warmup++;
      return;
    }
    this.samples.push(dt);
    if (this.samples.length < 40) return;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    this.samples = [];
    this.slowWindows = median > 0.056 ? this.slowWindows + 1 : 0;
    if (this.slowWindows >= 3) this.fail('performance');
  }

  private fail(reason: DegradeReason) {
    if (this.degraded) return;
    this.degraded = true;
    this.stop();
    this.options.onDegrade?.(reason);
  }
}

type PointerHandlers = {
  onTap?: (ndcX: number, ndcY: number) => void;
};

/** Drag to orbit, hover for parallax, short press to tap. Vertical touch pans keep scrolling the page. */
export function attachPointer(stage: Stage, handlers: PointerHandlers = {}) {
  const canvas = stage.canvas;
  let active: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let startTime = 0;
  let moved = false;
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    active = event.pointerId;
    startX = lastX = event.clientX;
    startY = lastY = event.clientY;
    startTime = performance.now();
    moved = false;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* Capture is optional. */
    }
  };
  const move = (event: PointerEvent) => {
    if (active === event.pointerId) {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      if (
        Math.abs(event.clientX - startX) > 6 ||
        Math.abs(event.clientY - startY) > 6
      ) {
        if (!moved) stage.mount.classList.add('is-dragging', 'has-dragged');
        moved = true;
      }
      if (moved) {
        stage.rig.orbitBy(dx, dy);
        stage.invalidate();
      }
      return;
    }
    if (event.pointerType !== 'mouse' || stage.reducedMotion) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    stage.rig.setParallax(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
  };
  const finish = (event: PointerEvent, tap: boolean) => {
    if (active !== event.pointerId) return;
    active = null;
    stage.mount.classList.remove('is-dragging');
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      /* Nothing to release. */
    }
    if (tap && !moved && performance.now() - startTime < 450) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      handlers.onTap?.(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
    }
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', (event) => finish(event, true));
  canvas.addEventListener('pointercancel', (event) => finish(event, false));
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') stage.rig.setParallax(0, 0);
  });
}

export function canvasTexture(
  width: number,
  height: number,
  draw: (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) draw(context, width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Soft radial falloff, white in the center; tint it through the material color. */
export function radialTexture(
  stops: Array<[number, number]> = [
    [0, 1],
    [0.3, 0.5],
    [0.65, 0.12],
    [1, 0],
  ],
  size = 128,
) {
  return canvasTexture(size, size, (context) => {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    stops.forEach(([offset, alpha]) =>
      gradient.addColorStop(offset, `rgba(255,255,255,${alpha})`),
    );
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });
}

let sharedGlow: CanvasTexture | null = null;

export function makeGlow(
  color: ColorRepresentation,
  size: number,
  opacity = 1,
) {
  if (!sharedGlow) {
    sharedGlow = radialTexture();
    sharedGlow.userData.shared = true;
  }
  const material = new SpriteMaterial({
    map: sharedGlow,
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new Sprite(material);
  sprite.scale.set(size, size, 1);
  return sprite;
}
