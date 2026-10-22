/**
 * Dollhouse version of the illustrative floor plan used by the explorer. The
 * plan rises from flat to 3D the first time it is seen, each room has a
 * pendant light that follows the lighting state of the 2D version, and the
 * scenes add short stories: a trail of steps for "Llegar", a dim evening for
 * "Descansar" and a sequential shutdown with a perimeter pulse for "Salir".
 */
import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Raycaster,
  RepeatWrapping,
  RingGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
  type ColorRepresentation,
  type SpriteMaterial,
  type Texture,
} from 'three';
import {
  attachPointer,
  canvasTexture,
  easeInOutSine,
  easeOutBack,
  easeOutCubic,
  makeGlow,
  radialTexture,
  shot,
  Stage,
  type DegradeReason,
  type Projected,
  type SceneTier,
  type Shot,
} from './three-stage';

export type PlanRoom = 'sala' | 'dormitorio' | 'cocina' | 'entrada';
export type PlanScene = 'llegar' | 'descansar' | 'salir' | 'personalizada';
export type PlanState = { lights: ReadonlySet<PlanRoom>; scene: PlanScene };
export type PlanReason = 'init' | 'scene' | 'toggle';
export type PlanViewOptions = {
  tier: SceneTier;
  reducedMotion: boolean;
  lightButtons: Partial<Record<PlanRoom, HTMLElement>>;
  onTapRoom: (room: PlanRoom) => void;
  onDegrade: (reason: DegradeReason) => void;
};
export type PlanView = {
  apply: (state: PlanState, reason: PlanReason) => void;
  enter: () => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
};

// The SVG plan is 520 x 350 units; one unit is two centimetres here.
const U = 0.02;
const X = (value: number) => (value - 258) * U;
const Z = (value: number) => (value - 170) * U;
const FLOOR = 0.06;
const WALL = 1.15;
const THICK = 0.1;

type RoomSpec = {
  id: PlanRoom;
  label: string;
  rect: [number, number, number, number];
  lamp: [number, number];
};
const roomSpecs: RoomSpec[] = [
  { id: 'sala', label: 'SALA', rect: [48, 44, 272, 188], lamp: [160, 112] },
  {
    id: 'dormitorio',
    label: 'DORMITORIO',
    rect: [280, 44, 468, 188],
    lamp: [374, 112],
  },
  {
    id: 'cocina',
    label: 'COCINA',
    rect: [48, 196, 272, 298],
    lamp: [160, 245],
  },
  {
    id: 'entrada',
    label: 'ENTRADA',
    rect: [280, 196, 468, 298],
    lamp: [374, 245],
  },
];
type Segment = {
  kind: 'wall' | 'window';
  from: [number, number];
  to: [number, number];
};
const segments: Segment[] = [
  { kind: 'wall', from: [44, 40], to: [87, 40] },
  { kind: 'window', from: [87, 40], to: [174, 40] },
  { kind: 'wall', from: [174, 40], to: [331, 40] },
  { kind: 'window', from: [331, 40], to: [395, 40] },
  { kind: 'wall', from: [395, 40], to: [472, 40] },
  { kind: 'wall', from: [472, 40], to: [472, 232] },
  { kind: 'wall', from: [472, 264], to: [472, 300] },
  { kind: 'wall', from: [44, 300], to: [332, 300] },
  { kind: 'window', from: [332, 300], to: [418, 300] },
  { kind: 'wall', from: [418, 300], to: [472, 300] },
  { kind: 'wall', from: [44, 40], to: [44, 88] },
  { kind: 'window', from: [44, 88], to: [44, 143] },
  { kind: 'wall', from: [44, 143], to: [44, 300] },
  { kind: 'wall', from: [276, 40], to: [276, 159] },
  { kind: 'wall', from: [276, 191], to: [276, 230] },
  { kind: 'wall', from: [276, 262], to: [276, 300] },
  { kind: 'wall', from: [44, 192], to: [207, 192] },
  { kind: 'wall', from: [242, 192], to: [472, 192] },
];
type DoorSpec = {
  hinge: [number, number];
  length: number;
  closedAngle: number;
  openDelta: number;
  openness: number;
  animated?: boolean;
};
const doorSpecs: DoorSpec[] = [
  {
    hinge: [207, 192],
    length: 35,
    closedAngle: 0,
    openDelta: Math.PI / 2,
    openness: 0.72,
  },
  {
    hinge: [276, 159],
    length: 32,
    closedAngle: -Math.PI / 2,
    openDelta: Math.PI / 2,
    openness: 0.7,
  },
  {
    hinge: [276, 230],
    length: 32,
    closedAngle: -Math.PI / 2,
    openDelta: -Math.PI / 2,
    openness: 0.68,
  },
  {
    hinge: [472, 232],
    length: 32,
    closedAngle: -Math.PI / 2,
    openDelta: 1.45,
    openness: 0,
    animated: true,
  },
];
const trailPoints: Array<[number, number]> = [
  [490, 248],
  [462, 248],
  [432, 250],
  [400, 250],
  [366, 248],
  [330, 246],
  [296, 246],
  [262, 242],
  [228, 212],
  [226, 182],
  [196, 150],
];
const shots: Record<
  'flat' | 'lift' | 'overview' | 'llegar' | 'descansar',
  Shot
> = {
  flat: shot([0, 12.4, 0.9], [0, 0, 0.2]),
  lift: shot([0.6, 10.6, 3.6], [0, 0, 0.25]),
  overview: shot([1, 8.6, 6.8], [0, 0, 0.3]),
  llegar: shot([8.6, 3.7, 6.3], [2, 0.3, 1.1]),
  descansar: shot([6.9, 4, -4.7], [1.5, 0.3, -0.7]),
};
const sceneLevels: Record<PlanScene, number> = {
  llegar: 1,
  descansar: 0.62,
  salir: 0,
  personalizada: 0.9,
};
// Ambient values follow three.js physical light units.
const moods: Record<
  PlanScene,
  { hemi: number; sky: number; moon: number } | null
> = {
  llegar: { hemi: 1.8, sky: 0xa9bcc2, moon: 1.6 },
  descansar: { hemi: 0.95, sky: 0x6f8ea3, moon: 2.2 },
  salir: { hemi: 1.3, sky: 0x7f99a6, moon: 1.8 },
  personalizada: null,
};

const standard = (
  color: ColorRepresentation,
  roughness = 0.85,
  extra: Partial<MeshStandardMaterial> = {},
) => new MeshStandardMaterial({ color, roughness, metalness: 0.02, ...extra });

/** Box whose geometry sits on its base, so scale.y grows it from the floor. */
function rise(
  width: number,
  height: number,
  depth: number,
  material: MeshStandardMaterial,
  x: number,
  base: number,
  z: number,
  shadows: boolean,
) {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.translate(0, height / 2, 0);
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, base, z);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}

function gridTexture() {
  const texture = canvasTexture(256, 256, (context, width, height) => {
    context.fillStyle = '#162329';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(184,201,203,0.085)';
    context.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const offset = (i * width) / 4 + 0.5;
      context.beginPath();
      context.moveTo(offset, 0);
      context.lineTo(offset, height);
      context.moveTo(0, offset);
      context.lineTo(width, offset);
      context.stroke();
    }
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(10, 7);
  return texture;
}

function dashTexture() {
  const texture = canvasTexture(64, 8, (context) => {
    context.fillStyle = 'rgba(255,255,255,1)';
    context.fillRect(0, 0, 34, 8);
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

export function createPlanView(
  mount: HTMLElement,
  options: PlanViewOptions,
): PlanView {
  const stage = new Stage(mount, {
    tier: options.tier,
    reducedMotion: options.reducedMotion,
    fov: 36,
    near: 0.2,
    far: 80,
    exposure: 1.05,
    onDegrade: options.onDegrade,
  });
  const { scene, shadows, tweens, rig } = stage;
  const reducedMotion = options.reducedMotion;
  rig.sway = 0.02;
  rig.pitchLimit = [-0.35, 0.3];

  const wallMaterial = standard(0xb5c3c2, 0.9);
  const glassMaterial = new MeshStandardMaterial({
    color: 0xbdebd1,
    emissive: 0x7fd9a8,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.4,
    roughness: 0.2,
    depthWrite: false,
  });
  const woodMaterial = standard(0x9a8c74, 0.8);
  const furnitureDark = standard(0x3a4e54, 0.85);
  const furnitureMid = standard(0x56706b, 0.9);
  const furnitureLight = standard(0xa2b1a6, 0.92);
  const fabricMaterial = standard(0xc9c2ad, 0.95);
  const pillowMaterial = standard(0xe8e2cf, 0.95);
  const blanketMaterial = standard(0x6f8a84, 0.95);
  const counterTop = standard(0xb4c0bb, 0.6);
  const potMaterial = standard(0x8f8a7c, 0.9);
  const leafMaterial = standard(0x4e8a6c, 0.9, { flatShading: true });
  const trunkMaterial = standard(0x4b4034, 0.9);

  // Ground and terrace ---------------------------------------------------------------
  const ground = new Mesh(
    new PlaneGeometry(18, 12.5),
    standard(0xffffff, 0.95, { map: gridTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = shadows;
  scene.add(ground);
  const terrace = rise(
    8,
    0.04,
    0.8,
    standard(0x24404a, 0.9),
    X(260),
    0,
    Z(326),
    false,
  );
  terrace.receiveShadow = shadows;
  scene.add(terrace);

  // Rooms: floor slabs, lights, pools, ripples -----------------------------------------------
  type RoomRuntime = {
    spec: RoomSpec;
    slab: Mesh<BoxGeometry, MeshStandardMaterial>;
    light: PointLight;
    bulb: MeshStandardMaterial;
    glow: SpriteMaterial;
    pool: MeshBasicMaterial;
    ripple: Mesh<RingGeometry, MeshBasicMaterial>;
    lampGroup: Group;
    anchor: Vector3;
    level: number;
    target: number;
  };
  const offColor = new Color(0x203137);
  const onColor = new Color(0x655d3b);
  const warmEmissive = new Color(0xffb864);
  const poolTexture = radialTexture([
    [0, 0.8],
    [0.4, 0.35],
    [1, 0],
  ]);
  const rooms: RoomRuntime[] = roomSpecs.map((spec) => {
    const [x1, y1, x2, y2] = spec.rect;
    const slab = rise(
      (x2 - x1) * U,
      FLOOR,
      (y2 - y1) * U,
      standard(offColor, 0.92, {
        emissive: warmEmissive,
        emissiveIntensity: 0,
      }),
      X((x1 + x2) / 2),
      0,
      Z((y1 + y2) / 2),
      shadows,
    );
    slab.castShadow = false;
    slab.userData.room = spec.id;
    scene.add(slab);
    const lampX = X(spec.lamp[0]);
    const lampZ = Z(spec.lamp[1]);
    const lampGroup = new Group();
    lampGroup.position.set(lampX, 0, lampZ);
    const cord = new Mesh(
      new CylinderGeometry(0.008, 0.008, 0.46, 6),
      standard(0xd8d2c0, 0.8),
    );
    cord.position.y = 1.36;
    const shade = new Mesh(
      new CylinderGeometry(0.045, 0.2, 0.18, 20, 1, true),
      new MeshStandardMaterial({
        color: 0xcfc2a0,
        roughness: 0.8,
        side: DoubleSide,
      }),
    );
    shade.position.y = 1.07;
    shade.castShadow = shadows;
    const bulb = new MeshStandardMaterial({
      color: 0x3a3730,
      emissive: 0xffd18d,
      emissiveIntensity: 0,
      roughness: 0.4,
    });
    const bulbMesh = new Mesh(new SphereGeometry(0.045, 12, 8), bulb);
    bulbMesh.position.y = 0.99;
    const glowSprite = makeGlow(0xffd18d, 0.75, 0);
    glowSprite.position.y = 0.99;
    const light = new PointLight(0xffd18d, 0, 4.4, 2);
    light.position.y = 0.92;
    lampGroup.add(cord, shade, bulbMesh, glowSprite, light);
    scene.add(lampGroup);
    const pool = new MeshBasicMaterial({
      map: poolTexture,
      color: 0xffc98a,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const poolMesh = new Mesh(new PlaneGeometry(2.8, 2.8), pool);
    poolMesh.rotation.x = -Math.PI / 2;
    poolMesh.position.set(lampX, FLOOR + 0.004, lampZ);
    scene.add(poolMesh);
    const ripple = new Mesh(
      new RingGeometry(0.1, 0.16, 36),
      new MeshBasicMaterial({
        color: 0xead09a,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(lampX, FLOOR + 0.008, lampZ);
    scene.add(ripple);
    return {
      spec,
      slab,
      light,
      bulb,
      glow: glowSprite.material,
      pool,
      ripple,
      lampGroup,
      anchor: new Vector3(lampX, 1.02, lampZ),
      level: 0,
      target: 0,
    };
  });
  const lampMax = options.tier === 'full' ? 11 : 9;
  const slabColor = new Color();
  const setRoomLevel = (room: RoomRuntime, level: number) => {
    room.level = level;
    room.light.intensity = level * lampMax;
    room.bulb.emissiveIntensity = 0.15 + level * 1.8;
    room.glow.opacity = level * 0.85;
    room.pool.opacity = level * 0.34;
    room.slab.material.color.copy(
      slabColor.copy(offColor).lerp(onColor, level),
    );
    room.slab.material.emissiveIntensity = level * 0.22;
  };
  rooms.forEach((room) => setRoomLevel(room, 0));

  // Walls, windows and doors -------------------------------------------------------------
  const wallMeshes: Mesh[] = [];
  segments.forEach((segment) => {
    const horizontal = segment.from[1] === segment.to[1];
    const length =
      Math.abs(
        horizontal
          ? segment.to[0] - segment.from[0]
          : segment.to[1] - segment.from[1],
      ) *
        U +
      THICK;
    const cx = X((segment.from[0] + segment.to[0]) / 2);
    const cz = Z((segment.from[1] + segment.to[1]) / 2);
    const width = horizontal ? length : THICK;
    const depth = horizontal ? THICK : length;
    if (segment.kind === 'wall') {
      wallMeshes.push(
        rise(width, WALL, depth, wallMaterial, cx, FLOOR, cz, shadows),
      );
      return;
    }
    const sill = rise(width, 0.42, depth, wallMaterial, cx, FLOOR, cz, shadows);
    const glass = rise(
      width,
      0.5,
      depth * 0.6,
      glassMaterial,
      cx,
      FLOOR + 0.42,
      cz,
      false,
    );
    const header = rise(
      width,
      WALL - 0.92,
      depth,
      wallMaterial,
      cx,
      FLOOR + 0.92,
      cz,
      shadows,
    );
    wallMeshes.push(sill, glass, header);
  });
  wallMeshes.forEach((mesh) => scene.add(mesh));
  type DoorRuntime = { group: Group; spec: DoorSpec; leaf: Mesh };
  const doors: DoorRuntime[] = doorSpecs.map((spec) => {
    const group = new Group();
    group.position.set(X(spec.hinge[0]), FLOOR, Z(spec.hinge[1]));
    const length = spec.length * U;
    const geometry = new BoxGeometry(length, WALL - 0.12, 0.04);
    geometry.translate(length / 2, (WALL - 0.12) / 2, 0);
    const leaf = new Mesh(geometry, woodMaterial);
    leaf.castShadow = shadows;
    group.add(leaf);
    group.rotation.y = spec.closedAngle + spec.openDelta * spec.openness;
    scene.add(group);
    return { group, spec, leaf };
  });
  const entranceDoor = doors[doors.length - 1]!;
  const setEntrance = (openness: number) => {
    entranceDoor.group.rotation.y =
      entranceDoor.spec.closedAngle + entranceDoor.spec.openDelta * openness;
  };

  // Furniture ------------------------------------------------------------------------------------
  const furniture: Group[] = [];
  const group = (x: number, z: number) => {
    const item = new Group();
    item.position.set(x, FLOOR, z);
    furniture.push(item);
    scene.add(item);
    return item;
  };
  const sofa = group(X(149), Z(151.5));
  sofa.add(
    rise(2.8, 0.4, 0.58, furnitureMid, 0, 0, 0, shadows),
    rise(2.8, 0.68, 0.16, furnitureDark, 0, 0, 0.21, shadows),
    rise(0.14, 0.55, 0.58, furnitureDark, -1.33, 0, 0, shadows),
    rise(0.14, 0.55, 0.58, furnitureDark, 1.33, 0, 0, shadows),
    rise(1.2, 0.1, 0.4, furnitureLight, -0.68, 0.4, -0.05, shadows),
    rise(1.2, 0.1, 0.4, furnitureLight, 0.68, 0.4, -0.05, shadows),
  );
  const coffee = group(X(138), Z(100));
  const coffeeTop = new Mesh(
    new CylinderGeometry(1, 1, 0.06, 28),
    standard(0xdec6a5, 0.75),
  );
  coffeeTop.scale.set(0.52, 1, 0.24);
  coffeeTop.position.y = 0.4;
  coffeeTop.castShadow = coffeeTop.receiveShadow = shadows;
  const pedestal = new Mesh(
    new CylinderGeometry(0.06, 0.08, 0.38, 12),
    furnitureDark,
  );
  pedestal.position.y = 0.19;
  coffee.add(coffeeTop, pedestal);
  const bed = group(X(381), Z(115));
  bed.add(
    rise(1.92, 0.3, 1.6, furnitureDark, 0, 0, 0, shadows),
    rise(1.8, 0.18, 1.5, fabricMaterial, 0, 0.3, 0, shadows),
    rise(1.96, 0.78, 0.08, woodMaterial, 0, 0, -0.78, shadows),
    rise(0.62, 0.1, 0.24, pillowMaterial, -0.49, 0.48, -0.55, shadows),
    rise(0.74, 0.1, 0.24, pillowMaterial, 0.39, 0.48, -0.55, shadows),
    rise(1.84, 0.08, 0.92, blanketMaterial, 0, 0.48, 0.22, shadows),
  );
  const kitchen = group(X(100), Z(255));
  kitchen.add(
    rise(
      0.62,
      0.85,
      1.26,
      furnitureDark,
      X(84.5) - X(100),
      0,
      Z(247.5) - Z(255),
      shadows,
    ),
    rise(
      0.64,
      0.03,
      1.28,
      counterTop,
      X(84.5) - X(100),
      0.85,
      Z(247.5) - Z(255),
      false,
    ),
    rise(
      2.3,
      0.85,
      0.48,
      furnitureDark,
      X(157.5) - X(100),
      0,
      Z(267) - Z(255),
      shadows,
    ),
    rise(
      2.32,
      0.03,
      0.5,
      counterTop,
      X(157.5) - X(100),
      0.85,
      Z(267) - Z(255),
      false,
    ),
  );
  [231, 249].forEach((y) => {
    const burner = new Mesh(
      new CylinderGeometry(0.12, 0.12, 0.02, 18),
      standard(0x2b3b40, 0.5),
    );
    burner.position.set(X(82) - X(100), 0.89, Z(y) - Z(255));
    kitchen.add(burner);
  });
  const kitchenTable = group(X(152.5), Z(222.5));
  kitchenTable.add(
    rise(1.26, 0.04, 0.56, standard(0xcdb48f, 0.7), 0, 0.7, 0, shadows),
  );
  [
    [-0.56, -0.22],
    [0.56, -0.22],
    [-0.56, 0.22],
    [0.56, 0.22],
  ].forEach(([lx, lz]) =>
    kitchenTable.add(
      rise(0.05, 0.7, 0.05, furnitureDark, lx ?? 0, 0, lz ?? 0, false),
    ),
  );
  const closet = group(X(427), Z(244.5));
  closet.add(
    rise(0.68, 1, 1.18, furnitureDark, 0, 0, 0, shadows),
    rise(0.02, 0.9, 1.1, furnitureLight, 0.345, 0.05, 0, false),
  );
  const makePlant = (x: number, z: number, radius: number, base = 0) => {
    const plant = group(x, z);
    plant.position.y = base;
    const trunk = new Mesh(
      new CylinderGeometry(radius * 0.15, radius * 0.2, radius, 8),
      trunkMaterial,
    );
    trunk.position.y = radius / 2;
    const crown = new Mesh(new SphereGeometry(radius, 9, 7), leafMaterial);
    crown.scale.set(1, 0.8, 1);
    crown.position.y = radius * 1.25;
    crown.castShadow = shadows;
    plant.add(trunk, crown);
    return plant;
  };
  const hallPlant = group(X(433), Z(287));
  const pot = new Mesh(new CylinderGeometry(0.11, 0.08, 0.2, 12), potMaterial);
  pot.position.y = 0.1;
  const hallLeaf = new Mesh(new SphereGeometry(0.17, 9, 7), leafMaterial);
  hallLeaf.scale.set(1, 0.75, 1);
  hallLeaf.position.y = 0.34;
  hallLeaf.castShadow = shadows;
  hallPlant.add(pot, hallLeaf);
  makePlant(X(24), Z(64), 0.3, -0.02);
  makePlant(X(19), Z(87), 0.2, -0.02);
  makePlant(X(496), Z(254), 0.26, -0.02);
  makePlant(X(496), Z(278), 0.34, -0.02);

  // Footstep trail and perimeter pulse ----------------------------------------------------------
  const trail = trailPoints.map(([sx, sz]) => {
    const material = new MeshBasicMaterial({
      color: 0xffd9a0,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const disc = new Mesh(new CircleGeometry(0.1, 20), material);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(X(sx), FLOOR + 0.012, Z(sz));
    scene.add(disc);
    return material;
  });
  const dash = dashTexture();
  const perimeterMaterials: MeshBasicMaterial[] = [];
  const perimeterTextures: Texture[] = [];
  const edge = (length: number, x: number, z: number, rotated: boolean) => {
    const texture = dash.clone();
    texture.needsUpdate = true;
    texture.repeat.set(length / 0.34, 1);
    perimeterTextures.push(texture);
    const material = new MeshBasicMaterial({
      map: texture,
      color: 0xc7f4d8,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    perimeterMaterials.push(material);
    const strip = new Mesh(new PlaneGeometry(length, 0.06), material);
    strip.rotation.x = -Math.PI / 2;
    if (rotated) strip.rotation.z = Math.PI / 2;
    strip.position.set(x, 0.014, z);
    scene.add(strip);
  };
  const px1 = X(44) - 0.3;
  const px2 = X(472) + 0.3;
  const pz1 = Z(40) - 0.3;
  const pz2 = Z(300) + 0.3;
  edge(px2 - px1, (px1 + px2) / 2, pz1, false);
  edge(px2 - px1, (px1 + px2) / 2, pz2, false);
  edge(pz2 - pz1, px1, (pz1 + pz2) / 2, true);
  edge(pz2 - pz1, px2, (pz1 + pz2) / 2, true);
  let perimeterLevel = 0;
  const setPerimeter = (level: number) => {
    perimeterLevel = level;
    perimeterMaterials.forEach((material) => (material.opacity = level));
  };

  // Lighting rig ---------------------------------------------------------------------------------------
  const hemi = new HemisphereLight(0xa9bcc2, 0x1b262b, 1.8);
  scene.add(hemi);
  const moon = new DirectionalLight(0xc5d8e4, 1.6);
  moon.position.set(-5, 9.5, 5.5);
  moon.target.position.set(0, 0, 0);
  if (shadows) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -6.5;
    moon.shadow.camera.right = 6.5;
    moon.shadow.camera.top = 6.5;
    moon.shadow.camera.bottom = -6.5;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 24;
    moon.shadow.bias = -0.001;
  }
  scene.add(moon, moon.target);

  // Overlay labels and light buttons track the 3D anchors -------------------------------------------
  const overlay = document.createElement('div');
  overlay.className = 'view-3d-labels';
  overlay.setAttribute('aria-hidden', 'true');
  mount.append(overlay);
  type Label = { element: HTMLElement; anchor: Vector3 };
  const labels: Label[] = [];
  const addLabel = (text: string, anchor: Vector3, muted = false) => {
    const element = document.createElement('span');
    element.className = muted ? 'view-3d-label is-muted' : 'view-3d-label';
    element.textContent = text;
    overlay.append(element);
    labels.push({ element, anchor });
  };
  roomSpecs.forEach((spec) =>
    addLabel(
      spec.label,
      new Vector3(
        X(spec.rect[0] + 30),
        FLOOR + WALL + 0.16,
        Z(spec.rect[1] + 16),
      ),
    ),
  );
  addLabel('JARDÍN', new Vector3(X(10), 0.08, Z(207)), true);
  addLabel('TERRAZA', new Vector3(X(260), 0.12, Z(330)), true);
  const projected: Projected = { x: 0, y: 0, visible: true };
  const place = (element: HTMLElement, anchor: Vector3) => {
    stage.project(anchor, projected);
    element.style.setProperty(
      '--hx',
      `${(projected.x + mount.offsetLeft).toFixed(1)}px`,
    );
    element.style.setProperty(
      '--hy',
      `${(projected.y + mount.offsetTop).toFixed(1)}px`,
    );
    element.style.setProperty('--x', `${projected.x.toFixed(1)}px`);
    element.style.setProperty('--y', `${projected.y.toFixed(1)}px`);
    element.dataset.visible = String(projected.visible);
  };
  const eye = new Vector3();
  stage.onFrame.push((dt) => {
    if (perimeterLevel > 0.01)
      perimeterTextures.forEach((texture) => (texture.offset.x -= dt * 0.4));
    // Room names belong to the map view; low, cinematic angles hide them.
    if (built) {
      eye.copy(stage.camera.position).sub(rig.target);
      const elevation = Math.atan2(eye.y, Math.hypot(eye.x, eye.z));
      overlay.dataset.hidden = String(elevation < 0.6);
    }
    labels.forEach((label) => place(label.element, label.anchor));
    rooms.forEach((room) => {
      const button = options.lightButtons[room.spec.id];
      if (button) place(button, room.anchor);
    });
  });

  // Taps on a room toggle its light through the same path as the buttons --------------------------
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const slabs = rooms.map((room) => room.slab);
  attachPointer(stage, {
    onTap: (x, y) => {
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, stage.camera);
      const hit = raycaster.intersectObjects(slabs, false)[0];
      const room = hit?.object.userData.room as PlanRoom | undefined;
      if (room) options.onTapRoom(room);
    },
  });

  // Scene helpers ------------------------------------------------------------------------------------------
  const ripple = (room: RoomRuntime) => {
    if (reducedMotion) return;
    tweens.add({
      key: `ripple-${room.spec.id}`,
      from: 0,
      to: 1,
      duration: 0.8,
      ease: easeOutCubic,
      onUpdate: (value) => {
        const scale = 1 + value * 9;
        room.ripple.scale.set(scale, scale, 1);
        room.ripple.material.opacity = (1 - value) * 0.75;
      },
      onComplete: () => {
        room.ripple.material.opacity = 0;
      },
    });
  };
  const runTrail = () => {
    trail.forEach((material, index) => {
      tweens.add({
        key: `trail-${index}`,
        from: 0,
        to: 1,
        duration: 0.55,
        delay: 0.2 + index * 0.09,
        onUpdate: (value) => {
          material.opacity = Math.sin(value * Math.PI) * 0.9;
        },
        onComplete: () => {
          material.opacity = 0;
        },
      });
    });
  };
  const applyMood = (sceneName: PlanScene, duration: number) => {
    const mood = moods[sceneName];
    if (!mood) return;
    const skyFrom = hemi.color.clone();
    const skyTo = new Color(mood.sky);
    const hemiFrom = hemi.intensity;
    const moonFrom = moon.intensity;
    tweens.add({
      key: 'mood',
      from: 0,
      to: 1,
      duration,
      onUpdate: (value) => {
        hemi.color.copy(skyFrom).lerp(skyTo, value);
        hemi.intensity = hemiFrom + (mood.hemi - hemiFrom) * value;
        moon.intensity = moonFrom + (mood.moon - moonFrom) * value;
      },
    });
  };
  const lightDelays = (sceneName: PlanScene, room: PlanRoom, on: boolean) => {
    if (sceneName === 'llegar')
      return on ? (room === 'entrada' ? 0.35 : 1.05) : 0;
    if (sceneName === 'descansar')
      return on ? (room === 'sala' ? 0.2 : 0.55) : 0;
    if (sceneName === 'salir')
      return { cocina: 0.1, dormitorio: 0.32, sala: 0.54, entrada: 0.78 }[room];
    return 0;
  };

  let lastState: PlanState | null = null;
  let entered = false;
  let built = true;

  const applyLights = (state: PlanState, reason: PlanReason, intro = false) => {
    const level = sceneLevels[state.scene];
    rooms.forEach((room) => {
      const on = state.lights.has(room.spec.id);
      const target = on ? level : 0;
      const changed = Math.abs(target - room.target) > 0.001;
      room.target = target;
      const instant = reason === 'init' && !intro;
      const duration = instant
        ? 0
        : reducedMotion
          ? 0.2
          : reason === 'toggle'
            ? 0.45
            : 0.9;
      const delay =
        instant || reducedMotion || reason === 'toggle'
          ? 0
          : lightDelays(state.scene, room.spec.id, on) + (intro ? 1.9 : 0);
      tweens.add({
        key: `light-${room.spec.id}`,
        from: room.level,
        to: target,
        duration,
        delay,
        ease: easeOutCubic,
        onUpdate: (value) => setRoomLevel(room, value),
      });
      if (reason === 'toggle' && changed) ripple(room);
    });
  };

  const apply = (state: PlanState, reason: PlanReason) => {
    lastState = { lights: new Set(state.lights), scene: state.scene };
    if (!built) return;
    applyLights(state, reason);
    if (reason === 'toggle') return;
    const instant = reason === 'init' || reducedMotion;
    const duration = instant ? 0 : 1.1;
    if (state.scene === 'llegar') {
      tweens.add({
        key: 'door',
        from: entranceDoor.spec.openness,
        to: 1,
        duration,
        ease: easeInOutSine,
        onUpdate: (value) => {
          entranceDoor.spec.openness = value;
          setEntrance(value);
        },
      });
      if (!instant) runTrail();
    } else if (state.scene !== 'personalizada') {
      tweens.add({
        key: 'door',
        from: entranceDoor.spec.openness,
        to: 0,
        duration,
        delay: instant ? 0 : 0.6,
        ease: easeInOutSine,
        onUpdate: (value) => {
          entranceDoor.spec.openness = value;
          setEntrance(value);
        },
      });
    }
    if (state.scene === 'salir') {
      tweens.add({
        key: 'perimeter',
        from: perimeterLevel,
        to: 0.42,
        duration: instant ? 0 : 1.2,
        delay: instant ? 0 : 0.9,
        onUpdate: (value, progress) =>
          setPerimeter(
            instant ? value : value + Math.sin(progress * Math.PI) * 0.5,
          ),
      });
    } else if (state.scene !== 'personalizada') {
      tweens.add({
        key: 'perimeter',
        from: perimeterLevel,
        to: 0,
        duration: instant ? 0 : 0.5,
        onUpdate: setPerimeter,
      });
    }
    applyMood(state.scene, instant ? 0 : 1.3);
    if (reason === 'init') {
      rig.jumpTo(shots.overview);
      return;
    }
    const target =
      state.scene === 'llegar'
        ? shots.llegar
        : state.scene === 'descansar'
          ? shots.descansar
          : state.scene === 'salir'
            ? shots.overview
            : null;
    if (target) rig.moveTo(target, reducedMotion ? 0 : 2, { arc: 0.5 });
  };

  const enter = () => {
    if (entered) return;
    entered = true;
    stage.start();
    const state = lastState;
    if (reducedMotion || !state) {
      rig.jumpTo(shots.overview);
      return;
    }
    // Flatten the model, then let the plan rise while the camera tilts into the dollhouse.
    built = false;
    const risers = [...wallMeshes, ...doors.map((door) => door.group)];
    risers.forEach((object) => (object.scale.y = 0.001));
    furniture.forEach((item) => (item.scale.y = 0.001));
    rooms.forEach((room) => (room.lampGroup.position.y = 2.4));
    overlay.dataset.hidden = 'true';
    rig.jumpTo(shots.flat);
    rig.flyThrough([shots.flat, shots.lift, shots.overview], 2.8, {
      ease: easeInOutSine,
    });
    risers.forEach((object, index) => {
      tweens.add({
        key: `rise-${index}`,
        from: 0.001,
        to: 1,
        duration: 0.75,
        delay: 0.35 + (index % 9) * 0.07,
        ease: easeOutCubic,
        onUpdate: (value) => (object.scale.y = value),
      });
    });
    furniture.forEach((item, index) => {
      tweens.add({
        key: `furniture-${index}`,
        from: 0.001,
        to: 1,
        duration: 0.6,
        delay: 1 + (index % 6) * 0.08,
        ease: easeOutBack,
        onUpdate: (value) => (item.scale.y = value),
      });
    });
    rooms.forEach((room, index) => {
      tweens.add({
        key: `lamp-${index}`,
        from: 2.4,
        to: 0,
        duration: 0.8,
        delay: 1.4 + index * 0.1,
        ease: easeOutCubic,
        onUpdate: (value) => (room.lampGroup.position.y = value),
        onComplete: () => undefined,
      });
    });
    tweens.add({
      key: 'built',
      from: 0,
      to: 1,
      duration: 0.01,
      delay: 1.9,
      onUpdate: () => undefined,
      onComplete: () => {
        built = true;
      },
    });
    applyLights(state, 'init', true);
    applyMood(state.scene, 1.5);
  };

  return {
    apply,
    enter,
    setVisible: (visible) => {
      stage.setVisible(visible);
      if (visible) stage.start();
    },
    dispose: () => {
      overlay.remove();
      stage.dispose();
    },
  };
}
