/**
 * Living room diorama for the home experience dialog. It mirrors the state of
 * the 2D simulator (light, tone, curtains, alarm, scene) and adds cinematic
 * camera moves: the first visit flies in through the door, "Cine" settles
 * behind the sofa while the screen lights the room, "Salir" rises to a watch
 * view while the alarm perimeter arms.
 */
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  RepeatWrapping,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  type ColorRepresentation,
  type Texture,
} from 'three';
import {
  attachPointer,
  canvasTexture,
  easeInOutSine,
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

export type RoomScene = 'welcome' | 'cinema' | 'away';
export type RoomTone = 'warm' | 'neutral' | 'cool';
export type RoomState = {
  light: number;
  curtains: number;
  armed: boolean;
  tone: RoomTone;
  scene: RoomScene;
  custom: boolean;
};
export type ApplyReason = 'init' | 'scene' | 'custom';
export type RoomViewOptions = {
  tier: SceneTier;
  reducedMotion: boolean;
  hotspots: { light: HTMLElement; curtains: HTMLElement };
  onTapLight: () => void;
  onTapCurtains: () => void;
  onDegrade: (reason: DegradeReason) => void;
};

export type RoomView = {
  apply: (state: RoomState, reason: ApplyReason) => void;
  enter: () => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
};

const WIDTH = 5;
const DEPTH = 4.2;
const HEIGHT = 2.8;
const THICK = 0.12;
const LAMP = new Vector3(-0.85, 1.98, -0.2);
const WINDOW = { x1: 0.25, x2: 2.05, y1: 0.95, y2: 2.25 };
const DOOR = { z1: 0.85, z2: 1.75, height: 2.1 };
const tones: Record<RoomTone, number> = {
  warm: 0xffd18d,
  neutral: 0xfff5df,
  cool: 0xc2e3ff,
};
const shots: Record<RoomScene, Shot> = {
  welcome: shot([3.7, 2.05, 4.5], [-0.35, 0.95, -0.25]),
  cinema: shot([2.55, 1.3, 1.85], [-2.3, 1.45, -0.45]),
  away: shot([5.3, 5.1, 5.5], [0, 0.5, -0.1]),
};
const introPath: Shot[] = [
  shot([-6.4, 1.5, 1.3], [1.6, 1, -0.2]),
  shot([-2.6, 1.55, 1.3], [1.2, 1, -0.4]),
  shot([0.7, 1.85, 2.7], [0.1, 1, -0.3]),
  shots.welcome,
];
type Mood = {
  hemi: number;
  sky: number;
  ground: number;
  fill: number;
  fillColor: number;
  exposure: number;
};
// Hemisphere and fill values follow three.js physical light units.
const moods: Record<RoomScene, Mood> = {
  welcome: {
    hemi: 1.7,
    sky: 0xa3bcc3,
    ground: 0x3a332c,
    fill: 3,
    fillColor: 0xd9e4e6,
    exposure: 1.08,
  },
  cinema: {
    hemi: 0.62,
    sky: 0x5c7f92,
    ground: 0x1f2a2e,
    fill: 1.6,
    fillColor: 0x9fb9c9,
    exposure: 1,
  },
  away: {
    hemi: 1.3,
    sky: 0x6a8aa0,
    ground: 0x1f2a30,
    fill: 11,
    fillColor: 0x8fb4d0,
    exposure: 0.98,
  },
};

const standard = (
  color: ColorRepresentation,
  roughness = 0.85,
  extra: Partial<MeshStandardMaterial> = {},
) => new MeshStandardMaterial({ color, roughness, metalness: 0.02, ...extra });

function block(
  width: number,
  height: number,
  depth: number,
  material: MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  shadows: boolean,
) {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y + height / 2, z);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}

function plankTexture() {
  const texture = canvasTexture(256, 256, (context, width, height) => {
    context.fillStyle = '#5b5548';
    context.fillRect(0, 0, width, height);
    const rows = 6;
    for (let row = 0; row < rows; row++) {
      const y = (row * height) / rows;
      const tone = 84 + ((row * 37) % 5) * 4;
      context.fillStyle = `rgb(${tone + 6},${tone},${tone - 14})`;
      context.fillRect(0, y, width, height / rows - 2);
      context.fillStyle = '#3f3a31';
      context.fillRect(0, y + height / rows - 2, width, 2);
      context.fillRect(((row * 97) % width) + 0, y, 2, height / rows - 2);
    }
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(3, 2.6);
  return texture;
}

function skyTexture() {
  return canvasTexture(256, 192, (context, width, height) => {
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#8b8d9c');
    sky.addColorStop(0.55, '#d0b4a0');
    sky.addColorStop(0.72, '#c3a58f');
    sky.addColorStop(1, '#5a7a6f');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#ffe7c0';
    context.beginPath();
    context.arc(width * 0.62, height * 0.5, 16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#41665c';
    context.beginPath();
    context.moveTo(0, height * 0.78);
    context.lineTo(width * 0.2, height * 0.58);
    context.lineTo(width * 0.38, height * 0.7);
    context.lineTo(width * 0.55, height * 0.54);
    context.lineTo(width * 0.75, height * 0.7);
    context.lineTo(width, height * 0.6);
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.fill();
    context.fillStyle = '#294c44';
    context.beginPath();
    context.moveTo(0, height * 0.86);
    context.lineTo(width * 0.25, height * 0.74);
    context.lineTo(width * 0.5, height * 0.84);
    context.lineTo(width * 0.7, height * 0.72);
    context.lineTo(width, height * 0.82);
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.fill();
  });
}

function dashTexture() {
  const texture = canvasTexture(64, 8, (context) => {
    context.fillStyle = 'rgba(255,255,255,1)';
    context.fillRect(0, 0, 36, 8);
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

function shieldTexture() {
  return canvasTexture(128, 128, (context) => {
    context.strokeStyle = '#c7f4d8';
    context.fillStyle = 'rgba(25,62,53,0.85)';
    context.lineWidth = 6;
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(64, 14);
    context.lineTo(108, 32);
    context.lineTo(108, 64);
    context.bezierCurveTo(108, 92, 84, 108, 64, 116);
    context.bezierCurveTo(44, 108, 20, 92, 20, 64);
    context.lineTo(20, 32);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(44, 64);
    context.lineTo(58, 78);
    context.lineTo(86, 48);
    context.stroke();
  });
}

function pleatedPanel(anchorLeft: boolean) {
  const geometry = new PlaneGeometry(1, 1.58, 30, 1);
  const positions = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    positions.setZ(i, Math.sin((x + 0.5) * Math.PI * 9) * 0.026);
  }
  geometry.computeVertexNormals();
  geometry.translate(anchorLeft ? 0.5 : -0.5, 0, 0);
  return geometry;
}

export function createRoomView(
  mount: HTMLElement,
  options: RoomViewOptions,
): RoomView {
  const stage = new Stage(mount, {
    tier: options.tier,
    reducedMotion: options.reducedMotion,
    fov: 38,
    near: 0.08,
    far: 60,
    exposure: 1.05,
    onDegrade: options.onDegrade,
  });
  const { scene, shadows, tweens, rig } = stage;
  const sceneRoot = new Group();
  scene.add(sceneRoot);

  // Materials ---------------------------------------------------------------
  const wallMaterial = standard(0x30454a, 0.94);
  const floorMaterial = standard(0x8a8272, 0.9, { map: plankTexture() });
  const sandMaterial = standard(0xdec6a5, 0.8);
  const darkMaterial = standard(0x2a3e40, 0.7);
  const sofaBase = standard(0x566e69, 0.9);
  const sofaSeat = standard(0x9aa79a, 0.92);
  const sofaTop = standard(0xb8bdb0, 0.92);
  const pillowA = standard(0xded4b9, 0.95);
  const pillowB = standard(0x7c8a76, 0.95);
  const woodMaterial = standard(0x8f8572, 0.75);
  const frameMaterial = standard(0xabb6b1, 0.6, { metalness: 0.2 });
  const leafMaterial = standard(0x739b7c, 0.9, { flatShading: true });
  const potMaterial = standard(0xb4a997, 0.85);

  // Floor, walls and the ground shadow ----------------------------------------
  const floor = block(WIDTH, 0.14, DEPTH, floorMaterial, 0, -0.14, 0, shadows);
  floor.castShadow = false;
  sceneRoot.add(floor);
  const contact = new Mesh(
    new PlaneGeometry(WIDTH + 2.8, DEPTH + 2.6),
    new MeshBasicMaterial({
      map: radialTexture([
        [0, 0.7],
        [0.45, 0.35],
        [1, 0],
      ]),
      color: 0x000000,
      transparent: true,
      depthWrite: false,
    }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -0.17;
  sceneRoot.add(contact);

  const backZ = -DEPTH / 2 + THICK / 2;
  const leftX = -WIDTH / 2 + THICK / 2;
  const walls = [
    // Back wall around the window.
    block(
      WINDOW.x1 + WIDTH / 2,
      HEIGHT,
      THICK,
      wallMaterial,
      (-WIDTH / 2 + WINDOW.x1) / 2,
      0,
      backZ,
      shadows,
    ),
    block(
      WIDTH / 2 - WINDOW.x2,
      HEIGHT,
      THICK,
      wallMaterial,
      (WINDOW.x2 + WIDTH / 2) / 2,
      0,
      backZ,
      shadows,
    ),
    block(
      WINDOW.x2 - WINDOW.x1,
      WINDOW.y1,
      THICK,
      wallMaterial,
      (WINDOW.x1 + WINDOW.x2) / 2,
      0,
      backZ,
      shadows,
    ),
    block(
      WINDOW.x2 - WINDOW.x1,
      HEIGHT - WINDOW.y2,
      THICK,
      wallMaterial,
      (WINDOW.x1 + WINDOW.x2) / 2,
      WINDOW.y2,
      backZ,
      shadows,
    ),
    // Left wall around the door.
    block(
      THICK,
      HEIGHT,
      DOOR.z1 + DEPTH / 2,
      wallMaterial,
      leftX,
      0,
      (-DEPTH / 2 + DOOR.z1) / 2,
      shadows,
    ),
    block(
      THICK,
      HEIGHT,
      DEPTH / 2 - DOOR.z2,
      wallMaterial,
      leftX,
      0,
      (DOOR.z2 + DEPTH / 2) / 2,
      shadows,
    ),
    block(
      THICK,
      HEIGHT - DOOR.height,
      DOOR.z2 - DOOR.z1,
      wallMaterial,
      leftX,
      DOOR.height,
      (DOOR.z1 + DOOR.z2) / 2,
      shadows,
    ),
  ];
  walls.forEach((wall) => {
    wall.castShadow = false;
    sceneRoot.add(wall);
  });
  // Baseboard line gives the cutaway edges a crisp finish.
  const trim = standard(0xb7cac3, 0.6);
  sceneRoot.add(
    block(WIDTH, 0.08, 0.03, trim, 0, 0, -DEPTH / 2 + THICK + 0.015, false),
    block(0.03, 0.08, DEPTH, trim, -WIDTH / 2 + THICK + 0.015, 0, 0, false),
  );

  // Rug ------------------------------------------------------------------------
  const rug = new Mesh(new PlaneGeometry(2.5, 2.3), standard(0x8d8878, 0.95));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-0.3, 0.006, -0.2);
  rug.receiveShadow = shadows;
  const rugInner = new Mesh(
    new PlaneGeometry(2.1, 1.9),
    standard(0xa09b8a, 0.95),
  );
  rugInner.rotation.x = -Math.PI / 2;
  rugInner.position.set(-0.3, 0.011, -0.2);
  rugInner.receiveShadow = shadows;
  sceneRoot.add(rug, rugInner);

  // Sofa facing the screen on the left wall -------------------------------------
  const sofa = new Group();
  sofa.position.set(0.5, 0, -0.2);
  sofa.add(
    block(0.9, 0.42, 2, sofaBase, 0, 0.08, 0, shadows),
    block(0.72, 0.14, 0.92, sofaSeat, -0.06, 0.5, -0.49, shadows),
    block(0.72, 0.14, 0.92, sofaSeat, -0.06, 0.5, 0.49, shadows),
    block(0.24, 0.58, 2, sofaTop, 0.33, 0.5, 0, shadows),
    block(0.9, 0.62, 0.22, sofaSeat, 0, 0.08, -0.89, shadows),
    block(0.9, 0.62, 0.22, sofaSeat, 0, 0.08, 0.89, shadows),
  );
  const pillowOne = block(
    0.12,
    0.42,
    0.42,
    pillowA,
    0.15,
    0.64,
    -0.55,
    shadows,
  );
  pillowOne.rotation.z = -0.25;
  const pillowTwo = block(0.12, 0.4, 0.4, pillowB, 0.15, 0.64, 0.3, shadows);
  pillowTwo.rotation.z = -0.3;
  pillowTwo.rotation.y = 0.2;
  sofa.add(pillowOne, pillowTwo);
  [-0.38, 0.38].forEach((x) =>
    [-0.92, 0.92].forEach((z) => {
      const leg = new Mesh(
        new CylinderGeometry(0.03, 0.03, 0.1, 10),
        darkMaterial,
      );
      leg.position.set(x, 0.05, z);
      sofa.add(leg);
    }),
  );
  sceneRoot.add(sofa);

  // Coffee table with tray and cup --------------------------------------------
  const table = new Group();
  table.position.set(-0.85, 0, -0.2);
  const top = new Mesh(
    new CylinderGeometry(0.55, 0.55, 0.05, 36),
    sandMaterial,
  );
  top.position.y = 0.4;
  top.castShadow = top.receiveShadow = shadows;
  table.add(top);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new Mesh(
      new CylinderGeometry(0.025, 0.025, 0.38, 10),
      darkMaterial,
    );
    leg.position.set(Math.cos(angle) * 0.38, 0.19, Math.sin(angle) * 0.38);
    table.add(leg);
  }
  table.add(
    block(
      0.32,
      0.03,
      0.22,
      standard(0x4c6760, 0.7),
      -0.08,
      0.425,
      0.05,
      shadows,
    ),
  );
  const cup = new Mesh(
    new CylinderGeometry(0.04, 0.035, 0.08, 14),
    standard(0xf0ece0, 0.5),
  );
  cup.position.set(0.22, 0.465, -0.12);
  cup.castShadow = shadows;
  table.add(cup);
  sceneRoot.add(table);

  // Plant in the back corner -----------------------------------------------------
  const plant = new Group();
  plant.position.set(1.95, 0, -1.65);
  const pot = new Mesh(new CylinderGeometry(0.17, 0.13, 0.32, 18), potMaterial);
  pot.position.y = 0.16;
  pot.castShadow = pot.receiveShadow = shadows;
  plant.add(pot);
  const stem = new Mesh(
    new CylinderGeometry(0.02, 0.025, 0.5, 8),
    standard(0x4f6f52, 0.9),
  );
  stem.position.y = 0.55;
  plant.add(stem);
  const leaves: Array<[number, number, number, number]> = [
    [0, 0.98, 0, 0.3],
    [0.17, 0.8, 0.1, 0.24],
    [-0.16, 0.74, -0.12, 0.22],
    [0.04, 0.68, 0.2, 0.2],
  ];
  leaves.forEach(([x, y, z, r]) => {
    const leaf = new Mesh(new SphereGeometry(r, 9, 6), leafMaterial);
    leaf.scale.set(1, 0.55, 1);
    leaf.position.set(x, y, z);
    leaf.castShadow = shadows;
    plant.add(leaf);
  });
  sceneRoot.add(plant);

  // Window, view outside, curtains ---------------------------------------------------
  const windowGroup = new Group();
  const windowCenterX = (WINDOW.x1 + WINDOW.x2) / 2;
  const windowWidth = WINDOW.x2 - WINDOW.x1;
  const windowHeight = WINDOW.y2 - WINDOW.y1;
  const frameDepth = THICK + 0.04;
  windowGroup.add(
    block(
      windowWidth + 0.12,
      0.06,
      frameDepth,
      frameMaterial,
      windowCenterX,
      WINDOW.y1 - 0.06,
      backZ,
      false,
    ),
    block(
      windowWidth + 0.12,
      0.06,
      frameDepth,
      frameMaterial,
      windowCenterX,
      WINDOW.y2,
      backZ,
      false,
    ),
    block(
      0.06,
      windowHeight,
      frameDepth,
      frameMaterial,
      WINDOW.x1 - 0.03,
      WINDOW.y1,
      backZ,
      false,
    ),
    block(
      0.06,
      windowHeight,
      frameDepth,
      frameMaterial,
      WINDOW.x2 + 0.03,
      WINDOW.y1,
      backZ,
      false,
    ),
    block(
      0.04,
      windowHeight,
      frameDepth,
      frameMaterial,
      windowCenterX,
      WINDOW.y1,
      backZ,
      false,
    ),
  );
  const glass = new Mesh(
    new PlaneGeometry(windowWidth, windowHeight),
    new MeshStandardMaterial({
      color: 0xd5e7ee,
      transparent: true,
      opacity: 0.16,
      roughness: 0.1,
      metalness: 0.3,
      depthWrite: false,
    }),
  );
  glass.position.set(
    windowCenterX,
    WINDOW.y1 + windowHeight / 2,
    -DEPTH / 2 + 0.02,
  );
  glass.userData.hotspot = 'curtains';
  windowGroup.add(glass);
  // A light box behind the window keeps the view outside from leaking past the cutaway walls.
  const boxDepth = 0.45;
  const lightBox = new Mesh(
    new BoxGeometry(3.4, 2.2, boxDepth),
    new MeshBasicMaterial({ color: 0x1c2a31, side: BackSide }),
  );
  lightBox.position.set(windowCenterX, 1.6, -DEPTH / 2 - boxDepth / 2 + 0.02);
  windowGroup.add(lightBox);
  const outside = new Mesh(
    new PlaneGeometry(3.3, 2.1),
    new MeshBasicMaterial({ map: skyTexture() }),
  );
  outside.position.set(windowCenterX, 1.6, -DEPTH / 2 - boxDepth + 0.04);
  windowGroup.add(outside);
  const sunGlow = makeGlow(0xffe2b8, 1.3, 0.85);
  sunGlow.position.set(windowCenterX + 0.5, 1.95, -DEPTH / 2 - boxDepth + 0.1);
  windowGroup.add(sunGlow);
  const rod = new Mesh(
    new CylinderGeometry(0.016, 0.016, windowWidth + 0.5, 10),
    frameMaterial,
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(windowCenterX, 2.4, -DEPTH / 2 + 0.26);
  windowGroup.add(rod);
  const curtainMaterial = standard(0xc6bfae, 0.95, { side: DoubleSide });
  const curtainLeft = new Mesh(pleatedPanel(true), curtainMaterial);
  curtainLeft.position.set(WINDOW.x1 - 0.1, 1.58, -DEPTH / 2 + 0.26);
  const curtainRight = new Mesh(pleatedPanel(false), curtainMaterial);
  curtainRight.position.set(WINDOW.x2 + 0.1, 1.58, -DEPTH / 2 + 0.26);
  [curtainLeft, curtainRight].forEach((panel) => {
    panel.castShadow = shadows;
    panel.userData.hotspot = 'curtains';
    windowGroup.add(panel);
  });
  sceneRoot.add(windowGroup);

  // Door on the left wall, opening into the room ----------------------------------
  const doorCenterZ = (DOOR.z1 + DOOR.z2) / 2;
  const doorWidth = DOOR.z2 - DOOR.z1;
  sceneRoot.add(
    block(
      THICK + 0.04,
      0.06,
      doorWidth + 0.12,
      frameMaterial,
      leftX,
      DOOR.height,
      doorCenterZ,
      false,
    ),
    block(
      THICK + 0.04,
      DOOR.height,
      0.06,
      frameMaterial,
      leftX,
      0,
      DOOR.z1 - 0.03,
      false,
    ),
    block(
      THICK + 0.04,
      DOOR.height,
      0.06,
      frameMaterial,
      leftX,
      0,
      DOOR.z2 + 0.03,
      false,
    ),
  );
  const doorHinge = new Group();
  doorHinge.position.set(-WIDTH / 2 + THICK - 0.02, 0, DOOR.z2);
  const doorLeaf = new Mesh(
    new BoxGeometry(0.05, DOOR.height - 0.04, doorWidth - 0.02),
    woodMaterial,
  );
  doorLeaf.geometry.translate(
    0,
    (DOOR.height - 0.04) / 2,
    -(doorWidth - 0.02) / 2,
  );
  doorLeaf.castShadow = shadows;
  doorHinge.add(doorLeaf);
  const handle = new Mesh(new SphereGeometry(0.03, 8, 8), frameMaterial);
  handle.position.set(0.05, 1.02, -doorWidth + 0.12);
  doorHinge.add(handle);
  sceneRoot.add(doorHinge);
  const doorLight = new PointLight(0xffd7ab, 0, 6, 2);
  doorLight.position.set(-WIDTH / 2 - 0.5, 1.5, doorCenterZ);
  sceneRoot.add(doorLight);
  const doorWedge = new Mesh(
    new PlaneGeometry(1.7, 1.4),
    new MeshBasicMaterial({
      map: radialTexture([
        [0, 0.9],
        [0.5, 0.3],
        [1, 0],
      ]),
      color: 0xffd3a0,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  doorWedge.rotation.x = -Math.PI / 2;
  doorWedge.position.set(-WIDTH / 2 + 0.7, 0.014, doorCenterZ);
  sceneRoot.add(doorWedge);

  // Screen on the left wall ----------------------------------------------------
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 160;
  screenCanvas.height = 90;
  const screenContext = screenCanvas.getContext('2d');
  const screenTexture = canvasTexture(2, 2, () => undefined);
  screenTexture.image = screenCanvas;
  const screenMaterial = new MeshStandardMaterial({
    color: 0x070d12,
    roughness: 0.25,
    metalness: 0.3,
    emissive: 0xffffff,
    emissiveMap: screenTexture,
    emissiveIntensity: 0,
  });
  const tvGroup = new Group();
  const tvX = -WIDTH / 2 + THICK + 0.035;
  tvGroup.add(
    block(
      0.07,
      0.9,
      1.55,
      standard(0x172b32, 0.5, { metalness: 0.2 }),
      tvX,
      1.05,
      -0.45,
      false,
    ),
  );
  const screenMesh = new Mesh(new PlaneGeometry(1.44, 0.81), screenMaterial);
  screenMesh.rotation.y = Math.PI / 2;
  screenMesh.position.set(tvX + 0.036, 1.5, -0.45);
  tvGroup.add(screenMesh);
  const tvLight = new PointLight(0x7fb7ff, 0, 7, 2);
  tvLight.position.set(tvX + 0.5, 1.45, -0.45);
  tvGroup.add(tvLight);
  const tvGlow = makeGlow(0x8fc2ff, 2.4, 0);
  tvGlow.position.set(tvX + 0.12, 1.5, -0.45);
  tvGroup.add(tvGlow);
  sceneRoot.add(tvGroup);

  // Pendant lamp with light beam, bulb glow and dust ----------------------------------
  const lampGroup = new Group();
  const cord = new Mesh(
    new CylinderGeometry(0.008, 0.008, 0.48, 6),
    standard(0xc0b698, 0.8),
  );
  cord.position.set(LAMP.x, 2.56, LAMP.z);
  const shadeMaterial = new MeshStandardMaterial({
    color: 0xb6a684,
    roughness: 0.8,
    side: DoubleSide,
    emissive: 0xffc27a,
    emissiveIntensity: 0,
  });
  const shade = new Mesh(
    new CylinderGeometry(0.07, 0.34, 0.3, 28, 1, true),
    shadeMaterial,
  );
  shade.position.set(LAMP.x, 2.17, LAMP.z);
  shade.castShadow = shadows;
  shade.userData.hotspot = 'light';
  const bulbMaterial = new MeshStandardMaterial({
    color: 0x2b2a24,
    emissive: tones.warm,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const bulb = new Mesh(new SphereGeometry(0.055, 14, 10), bulbMaterial);
  bulb.position.set(LAMP.x, 2.06, LAMP.z);
  bulb.userData.hotspot = 'light';
  const lampGlow = makeGlow(tones.warm, 1.1, 0);
  lampGlow.position.set(LAMP.x, 2.04, LAMP.z);
  const beamMaterial = new MeshBasicMaterial({
    color: tones.warm,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  const beam = new Mesh(
    new CylinderGeometry(0.3, 1.45, 2.02, 32, 1, true),
    beamMaterial,
  );
  beam.position.set(LAMP.x, 1.01, LAMP.z);
  const lampLight = new PointLight(tones.warm, 0, 9, 2);
  lampLight.position.copy(LAMP);
  if (shadows) {
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(512, 512);
    lampLight.shadow.bias = -0.004;
  }
  const dustCount = options.tier === 'full' ? 110 : 42;
  const dustGeometry = new BufferGeometry();
  const dustPositions = new Float32Array(dustCount * 3);
  const dust = Array.from({ length: dustCount }, () => ({
    angle: Math.random() * Math.PI * 2,
    radius: Math.pow(Math.random(), 0.6),
    y: Math.random() * 1.9,
    speed: 0.05 + Math.random() * 0.09,
    phase: Math.random() * Math.PI * 2,
  }));
  dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3));
  const dustMaterial = new PointsMaterial({
    color: tones.warm,
    size: 0.03,
    map: radialTexture(),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const dustPoints = new Points(dustGeometry, dustMaterial);
  lampGroup.add(cord, shade, bulb, lampGlow, beam, lampLight, dustPoints);
  sceneRoot.add(lampGroup);

  // Alarm: dashed perimeter, floating shield and a one-off scan sweep -------------------
  const perimeterGroup = new Group();
  const dash = dashTexture();
  const perimeterMaterials: MeshBasicMaterial[] = [];
  const perimeterTextures: Texture[] = [];
  const edge = (length: number, x: number, z: number, rotated: boolean) => {
    const texture = dash.clone();
    texture.needsUpdate = true;
    texture.repeat.set(length / 0.3, 1);
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
    const strip = new Mesh(new PlaneGeometry(length, 0.05), material);
    strip.rotation.x = -Math.PI / 2;
    if (rotated) strip.rotation.z = Math.PI / 2;
    strip.position.set(x, 0.016, z);
    return strip;
  };
  perimeterGroup.add(
    edge(WIDTH - 0.3, 0, -DEPTH / 2 + 0.2, false),
    edge(WIDTH - 0.3, 0, DEPTH / 2 - 0.2, false),
    edge(DEPTH - 0.3, -WIDTH / 2 + 0.2, 0, true),
    edge(DEPTH - 0.3, WIDTH / 2 - 0.2, 0, true),
  );
  sceneRoot.add(perimeterGroup);
  const shieldMaterial = new SpriteMaterial({
    map: shieldTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const shield = new Sprite(shieldMaterial);
  shield.scale.set(0.6, 0.6, 1);
  shield.position.set(1.35, 2.3, 0.85);
  sceneRoot.add(shield);
  const shieldGlow = makeGlow(0xc7f4d8, 1.4, 0);
  shieldGlow.position.copy(shield.position);
  sceneRoot.add(shieldGlow);
  const scanMaterial = new MeshBasicMaterial({
    color: 0xc7f4d8,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  const scan = new Mesh(
    new PlaneGeometry(WIDTH + 0.2, HEIGHT + 0.1),
    scanMaterial,
  );
  scan.position.set(0, HEIGHT / 2, -DEPTH / 2 - 0.2);
  sceneRoot.add(scan);

  // Lighting rig -------------------------------------------------------------------------
  const hemi = new HemisphereLight(
    moods.welcome.sky,
    moods.welcome.ground,
    moods.welcome.hemi,
  );
  scene.add(hemi);
  const sun = new DirectionalLight(0xffc9a0, 0);
  sun.position.set(2.2, 3.6, -5.2);
  sun.target.position.set(0.2, 0.4, 0.4);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -4;
    sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 4;
    sun.shadow.camera.bottom = -4;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 16;
    sun.shadow.bias = -0.0008;
  }
  scene.add(sun, sun.target);
  const fill = new PointLight(
    moods.welcome.fillColor,
    moods.welcome.fill,
    14,
    2,
  );
  fill.position.set(3.4, 4, 3.6);
  scene.add(fill);

  // Animated values -------------------------------------------------------------------------
  const current = {
    lamp: 0,
    curtains: 0,
    door: 0,
    tv: 0,
    armed: 0,
    tone: new Color(tones.warm),
  };
  const lampMax = options.tier === 'full' ? 26 : 22;
  const applyLamp = (level: number) => {
    current.lamp = level;
    lampLight.intensity = level * lampMax;
    bulbMaterial.emissiveIntensity = 0.2 + level * 1.8;
    shadeMaterial.emissiveIntensity = level * 0.5;
    (lampGlow.material as SpriteMaterial).opacity = level * 0.9;
    const scale = 0.7 + level * 0.9;
    lampGlow.scale.set(scale, scale, 1);
    beamMaterial.opacity = level * 0.14;
    dustMaterial.opacity = level * 0.6;
  };
  const applyTone = (color: Color) => {
    current.tone.copy(color);
    lampLight.color.copy(color);
    bulbMaterial.emissive.copy(color);
    (lampGlow.material as SpriteMaterial).color.copy(color);
    beamMaterial.color.copy(color);
    dustMaterial.color.copy(color);
  };
  const applyCurtains = (openness: number) => {
    current.curtains = openness;
    const bunch = 1 - openness * 0.72;
    curtainLeft.scale.x = bunch;
    curtainRight.scale.x = bunch;
    sun.intensity = openness * 1.9;
    (sunGlow.material as SpriteMaterial).opacity = 0.3 + openness * 0.6;
  };
  const applyDoor = (openness: number) => {
    current.door = openness;
    doorHinge.rotation.y = -1.32 * openness;
    doorLight.intensity = openness * 9;
    (doorWedge.material as MeshBasicMaterial).opacity = openness * 0.5;
  };
  const applyTv = (level: number) => {
    current.tv = level;
    screenMaterial.emissiveIntensity = level * 1.25;
    tvLight.intensity = level * 7;
    (tvGlow.material as SpriteMaterial).opacity = level * 0.5;
  };
  const applyArmed = (level: number) => {
    current.armed = level;
    perimeterMaterials.forEach((material) => (material.opacity = level * 0.85));
    shieldMaterial.opacity = level;
    (shieldGlow.material as SpriteMaterial).opacity = level * 0.55;
    const scale = 0.35 + level * 0.25;
    shield.scale.set(scale, scale, 1);
  };
  applyLamp(0);
  applyCurtains(0);
  applyDoor(0);
  applyTv(0);
  applyArmed(0);

  const toneColor = new Color();
  const toneFrom = new Color();
  const toneTo = new Color();

  let screenClock = 0;
  const tvTint = new Color();
  const tvPart = new Color();
  const blobColors = [
    new Color(0x3f7fb0),
    new Color(0xd4a265),
    new Color(0x67b3a3),
  ];
  const drawScreen = (time: number) => {
    if (!screenContext) return;
    const { width, height } = screenCanvas;
    screenContext.fillStyle = '#050b11';
    screenContext.fillRect(0, 0, width, height);
    tvTint.setRGB(0, 0, 0);
    blobColors.forEach((color, index) => {
      const phase = time * (0.35 + index * 0.12) + index * 2.1;
      const x = width * (0.5 + Math.sin(phase) * 0.32);
      const y = height * (0.5 + Math.cos(phase * 0.8) * 0.3);
      const radius = width * (0.28 + Math.sin(phase * 1.7) * 0.08);
      const gradient = screenContext.createRadialGradient(
        x,
        y,
        0,
        x,
        y,
        radius,
      );
      gradient.addColorStop(0, `#${color.getHexString()}`);
      gradient.addColorStop(1, 'rgba(5,11,17,0)');
      screenContext.fillStyle = gradient;
      screenContext.fillRect(0, 0, width, height);
      tvTint.add(
        tvPart.copy(color).multiplyScalar(0.33 + Math.sin(phase) * 0.12),
      );
    });
    screenContext.fillStyle = '#02050a';
    screenContext.fillRect(0, 0, width, 8);
    screenContext.fillRect(0, height - 8, width, 8);
    screenTexture.needsUpdate = true;
    tvLight.color.copy(tvTint.multiplyScalar(0.85));
    (tvGlow.material as SpriteMaterial).color.copy(tvTint);
  };
  drawScreen(0);

  // Per-frame work: dust, perimeter march, shield bob, screen refresh, overlays -------
  const hotspotLight = options.hotspots.light;
  const hotspotCurtains = options.hotspots.curtains;
  const lampAnchor = new Vector3(LAMP.x, 2.12, LAMP.z);
  const curtainAnchor = new Vector3(windowCenterX, 1.72, -DEPTH / 2 + 0.3);
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
    element.dataset.visible = String(projected.visible);
  };
  stage.onFrame.push((dt, elapsed) => {
    if (current.lamp > 0.01) {
      for (let i = 0; i < dustCount; i++) {
        const mote = dust[i]!;
        mote.y += mote.speed * dt;
        if (mote.y > 1.95) mote.y = 0.05;
        const radius = (0.15 + (1 - mote.y / 1.95) * 1.2) * mote.radius;
        const angle =
          mote.angle +
          elapsed * 0.12 +
          Math.sin(elapsed * 0.6 + mote.phase) * 0.2;
        dustPositions[i * 3] = LAMP.x + Math.cos(angle) * radius;
        dustPositions[i * 3 + 1] = mote.y;
        dustPositions[i * 3 + 2] = LAMP.z + Math.sin(angle) * radius;
      }
      (dustGeometry.attributes.position as BufferAttribute).needsUpdate = true;
    }
    if (current.armed > 0.01) {
      perimeterTextures.forEach((texture) => (texture.offset.x -= dt * 0.45));
      shield.position.y = 2.3 + Math.sin(elapsed * 1.6) * 0.05;
      shieldGlow.position.y = shield.position.y;
      const pulse = 1.2 + Math.sin(elapsed * 2.2) * 0.25;
      shieldGlow.scale.set(pulse, pulse, 1);
    }
    if (current.tv > 0.01) {
      screenClock += dt;
      if (screenClock > 0.1) {
        screenClock = 0;
        drawScreen(elapsed);
      }
    }
    place(hotspotLight, lampAnchor);
    place(hotspotCurtains, curtainAnchor);
  });

  // Taps on the lamp or the window mirror the hotspot buttons ----------------------------
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const tappable: Object3D[] = [shade, bulb, glass, curtainLeft, curtainRight];
  attachPointer(stage, {
    onTap: (x, y) => {
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, stage.camera);
      const hit = raycaster.intersectObjects(tappable, false)[0];
      if (!hit) return;
      if (hit.object.userData.hotspot === 'light') options.onTapLight();
      else if (hit.object.userData.hotspot === 'curtains')
        options.onTapCurtains();
    },
  });

  // State application -------------------------------------------------------------------------
  let lastState: RoomState | null = null;
  let entered = false;
  const reducedMotion = options.reducedMotion;

  const runScan = () => {
    if (reducedMotion) return;
    scanMaterial.opacity = 0.14;
    tweens.add({
      key: 'scan',
      from: -DEPTH / 2 - 0.2,
      to: DEPTH / 2 + 0.3,
      duration: 1.5,
      ease: easeInOutSine,
      onUpdate: (z, progress) => {
        scan.position.z = z;
        scanMaterial.opacity = 0.14 * Math.sin(progress * Math.PI);
      },
      onComplete: () => {
        scanMaterial.opacity = 0;
      },
    });
  };

  type Timing = {
    lamp: number;
    curtains: number;
    door: number;
    tv: number;
    armed: number;
    mood: number;
    delay: Partial<Record<'lamp' | 'curtains' | 'door' | 'armed', number>>;
  };
  const applyTargets = (state: RoomState, timing: Timing) => {
    const lampTarget = state.light / 100;
    const wake = current.lamp < 0.02 && lampTarget > 0.02 && !reducedMotion;
    tweens.add({
      key: 'lamp',
      from: current.lamp,
      to: lampTarget,
      duration: timing.lamp,
      delay: timing.delay.lamp,
      ease: easeOutCubic,
      onUpdate: (value, progress) => {
        const flicker =
          wake && progress < 0.4 ? 0.45 + Math.random() * 0.55 : 1;
        applyLamp(value * flicker);
      },
    });
    toneFrom.copy(current.tone);
    toneTo.set(tones[state.tone]);
    tweens.add({
      key: 'tone',
      from: 0,
      to: 1,
      duration: timing.lamp * 0.8,
      delay: timing.delay.lamp,
      onUpdate: (value) =>
        applyTone(toneColor.copy(toneFrom).lerp(toneTo, value)),
    });
    tweens.add({
      key: 'curtains',
      from: current.curtains,
      to: state.curtains / 100,
      duration: timing.curtains,
      delay: timing.delay.curtains,
      ease: easeInOutSine,
      onUpdate: applyCurtains,
    });
    const armedTarget = state.armed ? 1 : 0;
    if (armedTarget > current.armed && timing.armed > 0) {
      tweens.add({
        key: 'scan-delay',
        from: 0,
        to: 1,
        duration: 0.01,
        delay: timing.delay.armed,
        onUpdate: () => undefined,
        onComplete: runScan,
      });
    }
    tweens.add({
      key: 'armed',
      from: current.armed,
      to: armedTarget,
      duration: timing.armed,
      delay: timing.delay.armed,
      onUpdate: applyArmed,
    });
    if (timing.door >= 0) {
      tweens.add({
        key: 'door',
        from: current.door,
        to: state.scene === 'welcome' && !state.custom ? 1 : 0,
        duration: timing.door,
        delay: timing.delay.door,
        ease: easeInOutSine,
        onUpdate: applyDoor,
      });
    }
    if (timing.tv >= 0) {
      tweens.add({
        key: 'tv',
        from: current.tv,
        to: state.scene === 'cinema' && !state.custom ? 1 : 0,
        duration: timing.tv,
        onUpdate: applyTv,
      });
    }
    if (timing.mood >= 0) {
      const mood = moods[state.scene];
      const skyFrom = hemi.color.clone();
      const groundFrom = hemi.groundColor.clone();
      const skyTo = new Color(mood.sky);
      const groundTo = new Color(mood.ground);
      const hemiFrom = hemi.intensity;
      const fillFrom = fill.intensity;
      const fillColorFrom = fill.color.clone();
      const fillColorTo = new Color(mood.fillColor);
      const exposureFrom = stage.renderer.toneMappingExposure;
      tweens.add({
        key: 'mood',
        from: 0,
        to: 1,
        duration: timing.mood,
        onUpdate: (value) => {
          hemi.color.copy(skyFrom).lerp(skyTo, value);
          hemi.groundColor.copy(groundFrom).lerp(groundTo, value);
          hemi.intensity = hemiFrom + (mood.hemi - hemiFrom) * value;
          fill.intensity = fillFrom + (mood.fill - fillFrom) * value;
          fill.color.copy(fillColorFrom).lerp(fillColorTo, value);
          stage.renderer.toneMappingExposure =
            exposureFrom + (mood.exposure - exposureFrom) * value;
        },
      });
    }
  };

  const apply = (state: RoomState, reason: ApplyReason) => {
    lastState = { ...state };
    if (reason === 'init') {
      applyTargets(state, {
        lamp: 0,
        curtains: 0,
        door: 0,
        tv: 0,
        armed: 0,
        mood: 0,
        delay: {},
      });
      rig.jumpTo(shots[state.scene]);
      return;
    }
    if (reason === 'custom' || reducedMotion) {
      const quick = reducedMotion ? 0.2 : 0.4;
      applyTargets(state, {
        lamp: quick,
        curtains: reducedMotion ? 0.2 : 0.6,
        door: reason === 'custom' ? -1 : quick,
        tv: reason === 'custom' ? -1 : quick,
        armed: quick,
        mood: reason === 'custom' ? -1 : quick,
        delay: {},
      });
      if (reason === 'scene') rig.jumpTo(shots[state.scene]);
      return;
    }
    applyTargets(state, {
      lamp: 1.2,
      curtains: 1.7,
      door: 1.1,
      tv: 0.9,
      armed: 0.8,
      mood: 1.4,
      delay: { armed: 0.5, lamp: state.light > 0 ? 0.25 : 0 },
    });
    rig.moveTo(shots[state.scene], 1.9, { arc: 0.6 });
  };

  const enter = () => {
    if (entered) return;
    entered = true;
    stage.start();
    const state = lastState;
    if (!state) return;
    if (reducedMotion) {
      rig.jumpTo(shots[state.scene]);
      return;
    }
    // Everything starts dark and closed; the welcome scene wakes up around the visitor.
    applyLamp(0);
    applyCurtains(0);
    applyDoor(0);
    applyTv(0);
    applyArmed(0);
    const start = introPath[0]!;
    rig.jumpTo(start);
    rig.flyThrough(introPath, 3.6, { ease: easeInOutSine });
    applyTargets(state, {
      lamp: 1.3,
      curtains: 1.9,
      door: 1.1,
      tv: 0.8,
      armed: 0.8,
      mood: 0.5,
      delay: { door: 0.15, lamp: 1.7, curtains: 2.1, armed: 2.5 },
    });
  };

  return {
    apply,
    enter,
    setVisible: (visible) => {
      stage.setVisible(visible);
      if (visible) stage.start();
    },
    dispose: () => stage.dispose(),
  };
}
