import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { cameraPose } from "./camera";
import { floorLabel, smooth, type Context, type Frame, type Stage } from "./journey";
import { createKit, type Kit, type World } from "./worlds/kit";
import { loadWorld } from "./worlds";

export type Anchor = { x: number; y: number; r: number };
export type WorldInput = {
  stage: Stage;
  time: number;
  total: number;
  frame: Frame;
  ctx: Context;
  pointer: { x: number; y: number };
  hover: number | null;
  pulse: number;
  count: number;
};
export type ElevatorWorld = {
  mobile: boolean;
  update: (input: WorldInput) => { call: Anchor; buttons: Anchor[] };
  /** Starts building a floor's world; resolves once it can be shown. */
  prepare: (floor: number) => Promise<void>;
  isReady: (floor: number) => boolean;
  dispose: () => void;
};

// All geometry, materials and textures are local. No model, HDR or font requests.
export async function createWorld(host: HTMLElement, onContextLost: () => void): Promise<ElevatorWorld> {
  const mobile = matchMedia("(pointer: coarse)").matches || host.clientWidth < 760;
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#080b10");
  scene.fog = new THREE.FogExp2("#080b10", 0.025);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 500);
  const hall = new THREE.Group();
  const cabin = new THREE.Group();
  scene.add(hall, cabin);
  const textures: THREE.Texture[] = [];
  const extras: { dispose: () => void }[] = [];
  let seed = 7319;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const canvas = (width: number, height: number) => {
    const element = document.createElement("canvas");
    element.width = width; element.height = height;
    return { element, ctx: element.getContext("2d")! };
  };
  const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  function texture(element: HTMLCanvasElement) {
    const map = new THREE.CanvasTexture(element);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = anisotropy;
    textures.push(map);
    return map;
  }

  // A small studio environment gives the brass real view-dependent reflections.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color("#44484b");
  const envPanelGeometry = new THREE.PlaneGeometry(1, 1);
  const envMaterials: THREE.MeshBasicMaterial[] = [];
  for (const [x, y, z, width, height, color] of [
    [-4, 2, 1, 2, 5, "#fff1d2"], [4, 1, -2, 1, 7, "#d2dcf0"],
    [0, 5, 0, 5, 4, "#fff0db"], [0, 1, 5, 0.5, 5, "#c4aa79"],
  ] as const) {
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(envPanelGeometry, material);
    envMaterials.push(material);
    panel.position.set(x, y, z); panel.scale.set(width, height, 1); panel.lookAt(0, 1, 0);
    studio.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0.08, 0.1, 30);
  scene.environment = environment.texture;
  extras.push(environment);
  pmrem.dispose(); envPanelGeometry.dispose(); envMaterials.forEach((m) => m.dispose());

  const metalCanvas = canvas(256, 256);
  metalCanvas.ctx.fillStyle = "#b9b8b5"; metalCanvas.ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    metalCanvas.ctx.fillStyle = `rgba(${random() > 0.5 ? "255,247,219" : "18,23,26"},${random() * 0.065})`;
    metalCanvas.ctx.fillRect(0, random() * 256, 256, random() * 0.65 + 0.2);
  }
  const brushed = texture(metalCanvas.element);
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  brushed.repeat.set(1, 2);
  const metalDetail = brushed.clone();
  metalDetail.colorSpace = THREE.NoColorSpace;
  textures.push(metalDetail);
  const stoneCanvas = canvas(512, 512);
  const pixels = stoneCanvas.ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const vein = Math.pow(Math.abs(Math.sin(x * 0.018 + y * 0.022 + Math.sin(y * 0.018) * 2.6 + Math.sin(x * 0.03) * 0.6)), 45);
    const value = 28 + random() * 9 + vein * 25;
    const i = (y * 512 + x) * 4;
    pixels.data[i] = value; pixels.data[i + 1] = value + 2; pixels.data[i + 2] = value + 3; pixels.data[i + 3] = 255;
  }
  stoneCanvas.ctx.putImageData(pixels, 0, 0);
  const stoneMap = texture(stoneCanvas.element);
  stoneMap.wrapS = stoneMap.wrapT = THREE.RepeatWrapping;
  stoneMap.repeat.set(2, 2);
  const brass = new THREE.MeshStandardMaterial({ map: brushed, color: "#a9987b", metalness: 0.88, roughness: 0.3, envMapIntensity: 1.3 });
  const doorMetal = new THREE.MeshPhysicalMaterial({ map: brushed, color: "#b9aa90", metalness: 1, roughness: 0.36, roughnessMap: metalDetail, bumpMap: metalDetail, bumpScale: 0.003, anisotropy: mobile ? 0 : 0.65, anisotropyRotation: Math.PI / 2, envMapIntensity: 1.5 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: "#262b2b", metalness: 0.82, roughness: 0.35 });
  const stone = new THREE.MeshStandardMaterial({ map: stoneMap, color: "#9c9c97", roughness: 0.38, metalness: 0.18 });
  const black = new THREE.MeshStandardMaterial({ color: "#090d10", roughness: 0.75 });
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 2.5, 1.4), toneMapped: true });
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const batch = new Map<THREE.Group, Map<THREE.Material, THREE.Matrix4[]>>();
  const transform = new THREE.Object3D();
  function box(group: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
    if (!batch.has(group)) batch.set(group, new Map());
    const materials = batch.get(group)!;
    if (!materials.has(material)) materials.set(material, []);
    transform.position.set(x, y, z); transform.rotation.set(0, 0, 0); transform.scale.set(w, h, d); transform.updateMatrix();
    materials.get(material)!.push(transform.matrix.clone());
  }
  function mesh(group: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
    const object = new THREE.Mesh(geometry, material);
    if (material instanceof THREE.MeshStandardMaterial && !material.transparent) {
      object.castShadow = true; object.receiveShadow = true;
    }
    object.position.set(x, y, z); group.add(object);
    return object;
  }

  const glowCanvas = canvas(128, 128);
  const gradient = glowCanvas.ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,235,196,0.6)"); gradient.addColorStop(0.13, "rgba(255,213,146,0.18)"); gradient.addColorStop(1, "rgba(255,190,100,0)");
  glowCanvas.ctx.fillStyle = gradient; glowCanvas.ctx.fillRect(0, 0, 128, 128);
  const glowTexture = texture(glowCanvas.element);
  function glow(group: THREE.Object3D, x: number, y: number, z: number, sx: number, sy: number, color = "#ffe3ae", opacity = 0.45) {
    const material = new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z); sprite.scale.set(sx, sy, 1); group.add(sprite);
    return sprite;
  }
  function light(group: THREE.Group, color: string, intensity: number, x: number, y: number, z: number, distance: number) {
    const source = new THREE.PointLight(color, intensity, distance, 2);
    source.position.set(x, y, z); group.add(source); return source;
  }
  const hemisphere = new THREE.HemisphereLight("#b7c6dd", "#25201b", 0.42);
  scene.add(hemisphere);
  light(hall, "#ffe2b1", 14, 0, 3.3, 2.8, 16);
  light(hall, "#d3b383", 22, -4, 2.4, 6, 12);
  const portalLight = new THREE.SpotLight("#ffe2b5", 95, 16, 0.8, 0.8, 2);
  portalLight.position.set(1.2, 3.4, 3.5);
  portalLight.target.position.set(0, 1.2, -0.1);
  portalLight.castShadow = true;
  portalLight.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  portalLight.shadow.camera.near = 0.2;
  portalLight.shadow.camera.far = 16;
  portalLight.shadow.normalBias = 0.025;
  portalLight.shadow.bias = -0.00015;
  hall.add(portalLight, portalLight.target);
  const cabinLight = light(cabin, "#ffe6bf", 20, 0, 3.25, -2.1, 8);
  const passingLight = light(cabin, "#9ab9d4", 0, 0.8, 2.4, -0.8, 5);
  // The destination rig: every world lights itself with these two, so shaders never recompile on arrival.
  const rig = new THREE.Group(); scene.add(rig); rig.visible = false;
  const keyLight = new THREE.DirectionalLight("#ffffff", 1);
  const accentLight = new THREE.PointLight("#ffffff", 0, 20, 2);
  rig.add(keyLight, keyLight.target, accentLight);

  // Hallway: full depth, recessed joints, portal mouldings and light coves.
  for (const side of [-1, 1]) {
    // Front face at z = 0; kept thin so it never hides the car's operating panel just behind it.
    box(hall, stone, side * 3.6, 1.95, -0.06, 4.5, 3.9, 0.12);
    box(hall, stone, side * 5.9, 1.95, 7, 0.25, 3.9, 14);
    box(hall, brass, side * 5.72, 0.12, 7, 0.035, 0.075, 14);
    for (const z of [1.3, 4.1, 6.9, 9.7, 12.5]) {
      box(hall, black, side * 5.72, 1.95, z, 0.05, 3.9, 0.045);
      box(hall, brass, side * 5.68, 1.95, z + 0.1, 0.06, 3.9, 0.025);
    }
    for (const x of [2.8, 4.5]) box(hall, black, side * x, 1.95, 0.012, 0.024, 3.9, 0.018);
    box(hall, brass, side * 1.42, 1.75, 0.12, 0.13, 3.5, 0.3);
    mesh(hall, new RoundedBoxGeometry(0.2, 3.58, 0.5, 2, 0.025), doorMetal, side * 1.45, 1.78, 0.16);
    box(hall, darkMetal, side * 1.335, 1.7, 0.08, 0.035, 3.38, 0.38);
    box(hall, stone, side * 1.91, 1.85, 0.07, 0.58, 3.7, 0.27);
    box(hall, black, side * 1.55, 1.78, 0.09, 0.06, 3.56, 0.32);
    box(hall, warm, side * 1.59, 1.75, 0.18, 0.014, 3.5, 0.015);
    box(hall, brass, side * 2.32, 1.9, 0.19, 0.16, 1.5, 0.17);
    box(hall, warm, side * 2.32, 1.9, 0.29, 0.037, 1.42, 0.035);
    glow(hall, side * 2.32, 1.9, 0.32, 1.2, 3.3);
  }
  box(hall, stone, 0, 3.72, 7, 12, 0.28, 14);
  for (const x of [-4.5, 4.5]) box(hall, warm, x, 3.56, 7, 0.04, 0.025, 14);
  for (const z of [2, 5, 8, 11]) {
    box(hall, darkMetal, 0, 3.54, z, 11.5, 0.1, 0.14);
    box(hall, warm, 0, 3.48, z, 3.5, 0.02, 0.04);
  }
  box(hall, brass, 0, 3.47, 0.13, 2.97, 0.16, 0.3);
  mesh(hall, new RoundedBoxGeometry(3.1, 0.2, 0.5, 2, 0.025), doorMetal, 0, 3.48, 0.16);
  box(hall, brass, 0, 0.012, 0.12, 2.9, 0.022, 0.5);
  for (let z = -0.1; z < 0.38; z += 0.065) box(cabin, darkMetal, 0, 0.027, z, 2.63, 0.012, 0.018);
  // Floor slabs sit over the reflection with enough transparency to retain the reflected architecture.
  const floorMaterial = new THREE.MeshStandardMaterial({ map: stoneMap, color: "#757b7c", roughness: 0.36, metalness: 0.35, transparent: true, opacity: 0.65, depthWrite: false });
  const floor = mesh(hall, new THREE.PlaneGeometry(12, 19), floorMaterial, 0, 0.009, 5);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  for (const x of [-4.4, -2.2, 0, 2.2, 4.4]) box(hall, darkMetal, x, 0.012, 5, 0.012, 0.005, 19);
  for (let z = -3; z < 15; z += 2.2) box(hall, darkMetal, 0, 0.013, z, 12, 0.005, 0.012);
  for (const x of [-1.8, 1.8]) box(hall, brass, x, 0.014, 5.5, 0.015, 0.005, 11);

  const reflection = new Reflector(new THREE.PlaneGeometry(12, 21), {
    color: new THREE.Color("#444a50"), textureWidth: mobile ? 384 : 768, textureHeight: mobile ? 384 : 768, clipBias: 0.003, multisample: mobile ? 0 : 2,
  });
  reflection.rotation.x = -Math.PI / 2;
  reflection.position.set(0, -0.005, 5.5);
  scene.add(reflection); extras.push(reflection);
  const reflectionColor = (reflection.material as THREE.ShaderMaterial).uniforms.color.value as THREE.Color;

  // Hall call station on the right-hand pillar: one illuminated ▲ button behind brass.
  const callPosition = new THREE.Vector3(1.9, 1.22, 0.255);
  mesh(hall, new RoundedBoxGeometry(0.2, 0.42, 0.04, 2, 0.012), doorMetal, 1.9, 1.24, 0.218);
  mesh(hall, new THREE.PlaneGeometry(0.15, 0.36), black, 1.9, 1.24, 0.2395);
  const callRingMaterial = new THREE.MeshBasicMaterial({ color: "#b69b68" });
  mesh(hall, new THREE.TorusGeometry(0.052, 0.007, 8, 36), callRingMaterial, callPosition.x, callPosition.y, callPosition.z - 0.008);
  const callFace = mesh(hall, new THREE.CylinderGeometry(0.046, 0.046, 0.022, 32), doorMetal, callPosition.x, callPosition.y, callPosition.z - 0.012);
  callFace.rotation.x = Math.PI / 2;
  const arrowCanvas = canvas(64, 64);
  arrowCanvas.ctx.fillStyle = "#fff"; arrowCanvas.ctx.beginPath(); arrowCanvas.ctx.moveTo(32, 16); arrowCanvas.ctx.lineTo(48, 42); arrowCanvas.ctx.lineTo(16, 42); arrowCanvas.ctx.closePath(); arrowCanvas.ctx.fill();
  const callArrowMaterial = new THREE.MeshBasicMaterial({ map: texture(arrowCanvas.element), transparent: true, color: new THREE.Color(1.6, 1.15, 0.6), depthWrite: false });
  const callArrow = mesh(hall, new THREE.PlaneGeometry(0.06, 0.06), callArrowMaterial, callPosition.x, callPosition.y, callPosition.z + 0.001);
  const callGlow = glow(hall, callPosition.x, callPosition.y, callPosition.z + 0.02, 0.38, 0.38, "#ffd59a", 0.3);

  // Cabin, with a front aperture and two independent solid sliding door leaves.
  box(cabin, darkMetal, 0, 3.5, -2.1, 4.2, 0.17, 4.4);
  box(cabin, black, 0, 1.7, -4.3, 4.2, 3.4, 0.14);
  for (const side of [-1, 1]) {
    box(cabin, darkMetal, side * 2.05, 1.7, -2.1, 0.16, 3.4, 4.3);
    box(cabin, stone, side * 1.955, 0.44, -2.1, 0.035, 0.85, 4.05);
    box(cabin, brass, side * 1.75, 1.7, -0.09, 0.9, 3.4, 0.14);
    box(cabin, darkMetal, side * 1.32, 1.7, -0.16, 0.055, 3.4, 0.09);
    box(cabin, warm, side * 1.95, 3.36, -2.1, 0.026, 0.025, 3.9);
    box(cabin, darkMetal, side * 1.98, 0.96, -2.1, 0.07, 0.045, 3.8);
    for (const z of [-0.65, -1.75, -2.85, -3.95]) {
      box(cabin, brass, side * 1.95, 1.74, z, 0.045, 3.25, 0.025);
      if (z > -3.9) box(cabin, brass, side * 1.98, 2.2, z - 0.5, 0.024, 2.1, 0.96);
    }
  }
  for (const x of [-1.3, -0.65, 0, 0.65, 1.3]) {
    box(cabin, brass, x, 1.7, -4.19, 0.63, 3.35, 0.05);
  }
  box(cabin, darkMetal, 0, 0.96, -4.08, 3.9, 0.045, 0.07);
  const handrail = mesh(cabin, new THREE.CylinderGeometry(0.025, 0.025, 3.65, 12), doorMetal, 0, 1.02, -3.98);
  handrail.rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    const sideRail = mesh(cabin, new THREE.CylinderGeometry(0.025, 0.025, 3.2, 12), doorMetal, side * 1.9, 1.02, -2.25);
    sideRail.rotation.x = Math.PI / 2;
  }
  const backMirror = new THREE.MeshStandardMaterial({ color: "#616663", metalness: 1, roughness: 0.09, envMapIntensity: 0.9 });
  mesh(cabin, new RoundedBoxGeometry(2.9, 1.9, 0.025, 2, 0.01), backMirror, 0, 2.13, -4.12);
  box(cabin, brass, 0, 3.37, -0.06, 4, 0.14, 0.18);
  box(cabin, black, 0, 3.37, -2.1, 2.8, 0.025, 1.9);
  for (const x of [-1.38, 1.38]) box(cabin, warm, x, 3.35, -2.1, 0.035, 0.025, 1.9);
  for (const z of [-3.03, -1.17]) box(cabin, warm, 0, 3.35, z, 2.8, 0.025, 0.035);
  // A diffuser panel and downlights give the ceiling its glow.
  const ceilingGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.3, 1.05) });
  mesh(cabin, new THREE.PlaneGeometry(2.6, 1.7), ceilingGlow, 0, 3.355, -2.1).rotation.x = Math.PI / 2;
  box(cabin, darkMetal, 0, 0, -2.1, 4.2, 0.02, 4.3);
  const cabinFloor = mesh(cabin, new THREE.PlaneGeometry(3.9, 4), new THREE.MeshStandardMaterial({ map: stoneMap, color: "#69706c", metalness: 0.65, roughness: 0.2 }), 0, 0.016, -2.1);
  cabinFloor.rotation.x = -Math.PI / 2;
  const leftDoor = mesh(cabin, new RoundedBoxGeometry(1.3, 3.3, 0.14, 2, 0.018), doorMetal, -0.655, 1.67, 0.04);
  const rightDoor = mesh(cabin, new RoundedBoxGeometry(1.3, 3.3, 0.14, 2, 0.018), doorMetal, 0.655, 1.67, 0.04);
  // Small etched grooves move with the leaves.
  for (const door of [leftDoor, rightDoor]) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.009, 3.27, 0.145), darkMetal);
    groove.position.x = door === leftDoor ? 0.58 : -0.58; door.add(groove);
  }

  function label(text: string, width = 256, height = 128) {
    const surface = canvas(width, height);
    surface.ctx.fillStyle = "#0c1112"; surface.ctx.fillRect(0, 0, width, height);
    surface.ctx.fillStyle = "#edc98d"; surface.ctx.font = `300 ${height * 0.61}px Georgia`;
    surface.ctx.textAlign = "center"; surface.ctx.textBaseline = "middle";
    surface.ctx.fillText(text, width / 2, height * 0.54);
    return { ...surface, map: texture(surface.element) };
  }
  const display = label("G", 512, 256);
  const displayMaterial = new THREE.MeshBasicMaterial({ map: display.map });
  mesh(hall, new THREE.PlaneGeometry(0.48, 0.24), displayMaterial, 0, 3.74, 0.025);
  box(cabin, darkMetal, 0, 3.07, -0.12, 0.7, 0.27, 0.08);
  const lintelDisplay = mesh(cabin, new THREE.PlaneGeometry(0.62, 0.23), displayMaterial, 0, 3.07, -0.17);
  lintelDisplay.rotation.y = Math.PI;
  const monogram = label("XIII", 512, 256);
  mesh(cabin, new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshBasicMaterial({ map: monogram.map }), 0, 2.1, -4.09);
  const hallMark = label("XIII", 512, 256);
  mesh(hall, new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: hallMark.map }), 3.55, 1.95, 0.02);

  // The car operating panel: brushed plate, glass inset, indicator and thirteen lit buttons.
  // Viewed from inside the car (looking down +z), screen-left is +x, so odd floors sit at +x.
  const PANEL_X = -1.65, PANEL_FACE = -0.236;
  const panelGroup = new THREE.Group(); cabin.add(panelGroup);
  mesh(panelGroup, new RoundedBoxGeometry(0.46, 1.52, 0.05, 2, 0.02), doorMetal, PANEL_X, 1.3, -0.2);
  const inset = mesh(panelGroup, new RoundedBoxGeometry(0.38, 1.38, 0.006, 2, 0.01), new THREE.MeshStandardMaterial({ color: "#07090b", metalness: 0.6, roughness: 0.18, envMapIntensity: 0.8 }), PANEL_X, 1.31, PANEL_FACE + 0.006);
  inset.receiveShadow = false;
  const innerDisplay = mesh(panelGroup, new THREE.PlaneGeometry(0.28, 0.14), displayMaterial, PANEL_X, 1.86, PANEL_FACE - 0.001);
  innerDisplay.rotation.y = Math.PI;
  const ringMaterial = new THREE.MeshStandardMaterial({ map: brushed, color: "#c8ad78", metalness: 0.95, roughness: 0.25, envMapIntensity: 1.6 });
  const faceMaterial = new THREE.MeshPhysicalMaterial({ map: brushed, color: "#9d9283", metalness: 1, roughness: 0.3, clearcoat: 0.4, envMapIntensity: 1.4 });
  const ringGeometry = new THREE.TorusGeometry(0.047, 0.0075, 10, 40);
  const faceGeometry = new THREE.CylinderGeometry(0.041, 0.041, 0.016, 36);
  const numberGeometry = new THREE.PlaneGeometry(0.058, 0.058);
  type PanelButton = { floor: number; position: THREE.Vector3; face: THREE.Mesh; number: THREE.Mesh; numberMaterial: THREE.MeshBasicMaterial; halo: THREE.Mesh; haloMaterial: THREE.MeshBasicMaterial; glow: THREE.Sprite; press: number; light: number };
  const panelButtons: PanelButton[] = [];
  const haloGeometry = new THREE.RingGeometry(0.041, 0.054, 40);
  for (let floor = 1; floor <= 13; floor++) {
    const row = Math.floor((floor - 1) / 2);
    const column = floor === 13 ? 0 : floor % 2 ? 1 : -1;
    const position = new THREE.Vector3(PANEL_X + column * 0.088, 0.83 + row * 0.142, PANEL_FACE - 0.004);
    mesh(panelGroup, ringGeometry, ringMaterial, position.x, position.y, position.z);
    const face = mesh(panelGroup, faceGeometry, faceMaterial, position.x, position.y, position.z);
    face.rotation.x = Math.PI / 2;
    const haloMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.85), transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide });
    const halo = mesh(panelGroup, haloGeometry, haloMaterial, position.x, position.y, position.z - 0.0085);
    const digits = canvas(128, 128);
    digits.ctx.fillStyle = "#fff"; digits.ctx.font = `500 ${floor > 9 ? 64 : 76}px Georgia`; digits.ctx.textAlign = "center"; digits.ctx.textBaseline = "middle";
    digits.ctx.fillText(String(floor), 64, 70);
    const numberMaterial = new THREE.MeshBasicMaterial({ map: texture(digits.element), transparent: true, depthWrite: false, color: new THREE.Color(0.9, 0.78, 0.55) });
    const number = mesh(panelGroup, numberGeometry, numberMaterial, position.x, position.y, position.z - 0.0095);
    number.rotation.y = Math.PI;
    const light = glow(panelGroup, position.x, position.y, position.z - 0.03, 0.2, 0.2, "#ffcf8a", 0);
    panelButtons.push({ floor, position, face, number, numberMaterial, halo, haloMaterial, glow: light, press: 0, light: 0 });
  }
  // Door open / close and alarm keys complete the panel; they are decorative.
  for (const [index, glyph] of ["◀▶", "▶◀", "🔔"].entries()) {
    const x = PANEL_X + (1 - index) * 0.1, y = 0.66;
    mesh(panelGroup, new THREE.TorusGeometry(0.03, 0.005, 8, 28), ringMaterial, x, y, PANEL_FACE - 0.004);
    const key = mesh(panelGroup, new THREE.CylinderGeometry(0.026, 0.026, 0.012, 24), faceMaterial, x, y, PANEL_FACE - 0.004);
    key.rotation.x = Math.PI / 2;
    const surface = canvas(64, 64);
    surface.ctx.fillStyle = index === 2 ? "#d9a35b" : "#c9b48a"; surface.ctx.font = "26px sans-serif"; surface.ctx.textAlign = "center"; surface.ctx.textBaseline = "middle"; surface.ctx.fillText(glyph, 32, 34);
    const symbol = mesh(panelGroup, new THREE.PlaneGeometry(0.04, 0.04), new THREE.MeshBasicMaterial({ map: texture(surface.element), transparent: true, depthWrite: false }), x, y, PANEL_FACE - 0.012);
    symbol.rotation.y = Math.PI;
  }
  const panelSpot = new THREE.PointLight("#ffe7c4", 1.4, 1.6, 2);
  panelSpot.position.set(PANEL_X + 0.15, 1.95, -0.7); cabin.add(panelSpot);

  const dustGeometry = new THREE.BufferGeometry();
  const dustPoints = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) { dustPoints[i * 3] = (random() - 0.5) * 10; dustPoints[i * 3 + 1] = random() * 3.5; dustPoints[i * 3 + 2] = random() * 13; }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPoints, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ size: 0.015, color: "#eed3a6", opacity: 0.35, transparent: true, depthWrite: false })); hall.add(dust);

  // One draw call per shared structural material; no object-per-window overhead.
  for (const [group, materials] of batch) for (const [material, matrices] of materials) {
    const instances = new THREE.InstancedMesh(boxGeometry, material, matrices.length);
    matrices.forEach((matrix, index) => instances.setMatrixAt(index, matrix));
    if (material instanceof THREE.MeshStandardMaterial && !material.transparent) {
      instances.castShadow = true; instances.receiveShadow = true;
    }
    instances.computeBoundingSphere(); group.add(instances);
  }
  batch.clear();

  // Destination worlds: built on demand while the doors are shut, disposed after leaving.
  const pixelScale = { value: 400 };
  type Loaded = { floor: number; world: World; kit: Kit; compiled: boolean; born: number };
  const loaded = new Map<number, Loaded>();
  const pending = new Map<number, Promise<void>>();
  let active: Loaded | null = null;
  function prepare(floor: number) {
    if (floor <= 0 || loaded.has(floor)) return Promise.resolve();
    if (pending.has(floor)) return pending.get(floor)!;
    const job = (async () => {
      const kit = createKit({ mobile, anisotropy, glowTexture, pixelScale });
      const world = await loadWorld(floor, kit);
      if (disposed) { kit.dispose(world.group); world.dispose?.(); return; }
      world.group.visible = false;
      scene.add(world.group);
      loaded.set(floor, { floor, world, kit, compiled: false, born: performance.now() });
    })().finally(() => pending.delete(floor));
    pending.set(floor, job);
    return job;
  }
  function release(entry: Loaded) {
    scene.remove(entry.world.group);
    entry.kit.dispose(entry.world.group); entry.world.dispose?.();
    loaded.delete(entry.floor);
  }
  const defaultExposure = renderer.toneMappingExposure;
  let currentScene = -1;
  function showScene(index: number) {
    if (index === currentScene) return;
    const target = index > 0 ? loaded.get(index) : null;
    if (index > 0 && !target) return; // Not built yet; the clock holds the doors until it is.
    const previous = active;
    active = target ?? null;
    currentScene = index;
    hall.visible = index === 0;
    rig.visible = index !== 0;
    if (previous && previous !== active) release(previous);
    const fog = scene.fog as THREE.FogExp2;
    if (active) {
      const { world } = active;
      world.group.visible = true;
      (scene.background as THREE.Color).set(world.background);
      fog.color.set(world.fog[0]); fog.density = world.fog[1];
      hemisphere.color.set(world.rig.hemi[0]); hemisphere.groundColor.set(world.rig.hemi[1]); hemisphere.intensity = world.rig.hemi[2];
      keyLight.color.set(world.rig.key.color); keyLight.intensity = world.rig.key.intensity; keyLight.position.set(...world.rig.key.position); keyLight.target.position.set(0, 0, 12);
      accentLight.color.set(world.rig.accent.color); accentLight.intensity = world.rig.accent.intensity; accentLight.position.set(...world.rig.accent.position); accentLight.distance = world.rig.accent.distance;
      renderer.toneMappingExposure = world.exposure ?? defaultExposure;
      scene.environmentIntensity = world.environment ?? 1;
      if (world.reflect) reflectionColor.set(world.reflect);
      if (!active.compiled) { renderer.compile(scene, camera); active.compiled = true; }
    } else {
      (scene.background as THREE.Color).set("#080b10");
      fog.color.set("#080b10"); fog.density = 0.025;
      hemisphere.color.set("#b7c6dd"); hemisphere.groundColor.set("#25201b"); hemisphere.intensity = 0.42;
      renderer.toneMappingExposure = defaultExposure;
      scene.environmentIntensity = 1;
      reflectionColor.set("#444a50");
    }
    renderer.shadowMap.needsUpdate = true;
  }

  let width = 1, height = 1;
  let shownDisplay = "G", oldDisplay = "G", drawnDisplay = "";
  let digitChangedAt = -10;
  let previousDoors = -1;
  let lost = false;
  let disposed = false;
  let pointerX = 0, pointerY = 0;
  let samples = 0, slowFrames = 0, previousRender = performance.now();
  const look = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const tint = new THREE.Color();
  const baseCabin = new THREE.Color("#ffe6bf");
  function aim(target: THREE.PerspectiveCamera, pose: ReturnType<typeof cameraPose>) {
    look.set(Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch), -Math.cos(pose.yaw) * Math.cos(pose.pitch)).add(target.position);
    target.lookAt(look); target.rotateZ(pose.roll);
    target.fov = pose.fov; target.updateProjectionMatrix(); target.updateMatrixWorld();
  }
  const resize = () => {
    width = host.clientWidth; height = host.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function contextLost(event: Event) { event.preventDefault(); lost = true; renderer.domElement.style.display = "none"; onContextLost(); }
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  function anchor(point: THREE.Vector3, radius: number): Anchor {
    projected.copy(point).project(camera);
    edge.copy(point); edge.y += radius; edge.project(camera);
    const x = (projected.x * 0.5 + 0.5) * width, y = (-projected.y * 0.5 + 0.5) * height;
    const behind = projected.z > 1;
    return { x: behind ? -999 : x, y: behind ? -999 : y, r: Math.abs((-edge.y * 0.5 + 0.5) * height - y) };
  }
  // Digits roll in the direction of travel, like a mechanical-style LED indicator.
  function drawDisplay(frame: Frame, total: number, reduced: boolean) {
    const text = floorLabel(frame.floor);
    if (text !== shownDisplay) { oldDisplay = shownDisplay; shownDisplay = text; digitChangedAt = total; }
    const since = total - digitChangedAt;
    const key = `${text}${frame.direction}`;
    if (since > 0.4 && drawnDisplay === key) return;
    const travel = reduced ? 1 : smooth(0, 0.22, since);
    const ctx = display.ctx;
    ctx.fillStyle = "#070b0d"; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#e6c491"; ctx.font = "300 146px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const sign = frame.direction || 1;
    if (travel < 1 && oldDisplay !== text) ctx.fillText(oldDisplay, 290, 136 - travel * 256 * sign);
    ctx.fillText(text, 290, 136 + (oldDisplay !== text ? (1 - travel) * 256 * sign : 0));
    if (frame.direction) {
      ctx.strokeStyle = "#e6c491"; ctx.lineWidth = 7; ctx.beginPath();
      if (frame.direction > 0) { ctx.moveTo(52, 140); ctx.lineTo(80, 108); ctx.lineTo(108, 140); } else { ctx.moveTo(52, 112); ctx.lineTo(80, 144); ctx.lineTo(108, 112); }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.18; ctx.fillStyle = "#000";
    for (let y = 0; y < 256; y += 4) ctx.fillRect(0, y, 512, 1);
    ctx.globalAlpha = 1;
    display.map.needsUpdate = true;
    drawnDisplay = since > 0.4 ? key : "";
  }

  const offscreen: Anchor = { x: -999, y: -999, r: 0 };
  const result: ElevatorWorld = {
    mobile,
    prepare,
    isReady: (floor) => floor <= 0 || loaded.has(floor),
    update({ stage, time, total, frame, ctx, pointer, hover, pulse, count }) {
      if (lost || disposed) return { call: offscreen, buttons: [] };
      const { reduced } = ctx;
      showScene(frame.world);
      const outdoors = frame.world > 0;
      leftDoor.position.x = -0.655 - frame.doors * 1.32;
      rightDoor.position.x = 0.655 + frame.doors * 1.32;
      if (previousDoors !== frame.doors && !outdoors) { renderer.shadowMap.needsUpdate = true; }
      previousDoors = frame.doors;
      const aspect = width / height;
      const pose = cameraPose(stage, time, aspect, ctx);
      camera.position.fromArray(pose.position);
      pointerX = THREE.MathUtils.lerp(pointerX, pointer.x, 0.035); pointerY = THREE.MathUtils.lerp(pointerY, pointer.y, 0.035);
      if (!reduced && (stage === "arrival" || stage === "open" || stage === "destination")) {
        const settle = stage === "destination" ? smooth(0, 2, time) : 1;
        camera.position.x += (Math.sin(total * 0.14) * 0.035 - pointerX * 0.06) * settle;
        camera.position.y += (Math.sin(total * 0.22) * 0.012 - pointerY * 0.02) * settle;
      }
      aim(camera, pose);
      pixelScale.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));

      // Hall call button: lit from press until the car arrives, warm hover otherwise.
      const callHot = frame.callLit || (stage === "arrival" && hover === 0);
      callRingMaterial.color.set(callHot ? "#ffe2a6" : "#b69b68");
      if (frame.callLit) callArrowMaterial.color.setRGB(3.2, 2.2, 1.1);
      else if (stage === "arrival") callArrowMaterial.color.setRGB(1.3 + Math.sin(total * 2.4) * 0.25, 0.95, 0.5);
      else callArrowMaterial.color.setRGB(0.7, 0.55, 0.35);
      (callGlow.material as THREE.SpriteMaterial).opacity = frame.callLit ? 0.8 : stage === "arrival" ? 0.28 + Math.sin(total * 2.4) * 0.08 : 0.1;
      const callPress = stage === "calling" && !reduced ? Math.sin(smooth(0, 0.3, time) * Math.PI) * 0.006 : 0;
      callFace.position.z = callPosition.z - 0.012 - callPress; callArrow.position.z = callPosition.z + 0.001 - callPress;

      // Floor buttons: hover warms, press sinks the face, the selected floor glows until arrival.
      const panelVisible = stage !== "arrival" && stage !== "calling" && stage !== "open";
      for (const button of panelButtons) {
        const selected = frame.lit === button.floor;
        const hovered = hover === button.floor && (stage === "cabin" || stage === "destination");
        button.light = THREE.MathUtils.lerp(button.light, selected ? 1 : hovered ? 0.45 : 0, reduced ? 1 : 0.18);
        const pressing = selected && stage === "ride" ? Math.sin(smooth(0, 0.32, time) * Math.PI) : 0;
        button.press = reduced ? 0 : pressing;
        button.face.position.z = button.position.z + button.press * 0.006;
        button.number.position.z = button.position.z - 0.0095 + button.press * 0.006;
        const lift = 0.9 + button.light * 2.4;
        button.numberMaterial.color.setRGB(lift, lift * 0.78, lift * 0.5);
        button.haloMaterial.opacity = 0.12 + button.light * 0.85;
        (button.glow.material as THREE.SpriteMaterial).opacity = button.light * 0.55;
      }
      panelSpot.intensity = panelVisible ? 1.4 : 0;

      // The cabin breathes with the journey: dims slightly in motion, takes on the destination's colour on arrival.
      tint.copy(baseCabin);
      if (active && frame.doors > 0) tint.lerp(new THREE.Color(active.world.tint), 0.35 * frame.doors);
      cabinLight.color.copy(tint);
      cabinLight.intensity = 20 - frame.speed * 3.5 + (reduced ? 0 : Math.sin(total * 4) * 0.3 * frame.speed);
      const moving = frame.speed > 0.05 && !reduced;
      passingLight.intensity = moving ? Math.pow(Math.max(0, Math.sin(time * (3 + frame.speed * 4))), 8) * 3.2 * frame.speed : 0;
      passingLight.position.y = frame.direction >= 0 ? 3.1 - ((time * 2.2) % 2.6) : 0.5 + ((time * 2.2) % 2.6);
      reflection.visible = (!outdoors && (stage === "arrival" || stage === "calling" || stage === "open" || stage === "entering")) || (outdoors && !!active?.world.reflect && frame.doors > 0);
      reflection.position.z = outdoors ? 18 : 5.5;
      reflection.scale.set(outdoors ? 2.5 : 1, outdoors ? 2 : 1, 1);
      dust.visible = !reduced && !outdoors;
      if (!reduced) dust.rotation.y = Math.sin(total * 0.08) * 0.035;
      drawDisplay(frame, total, reduced);

      if (active) {
        const presence = stage === "destination" ? 1 : stage === "ride" ? frame.doors : stage === "returning" || stage === "cabin" ? 1 : 0;
        const worldTime = (performance.now() - active.born) / 1000;
        // Shared shader clock: particles, water and sky shaders all read it.
        active.kit.time.value = reduced ? worldTime * 0.35 : worldTime;
        active.world.update({ time: worldTime, delta: 0, reduced, aspect, pointer: { x: pointerX, y: pointerY }, pulse, count, presence });
      }
      renderer.render(scene, camera);
      // Downshift once if sustained frame intervals show a struggling device.
      const now = performance.now();
      if (now - previousRender > (mobile ? 48 : 30)) slowFrames++;
      previousRender = now;
      if (++samples === 120 && slowFrames > 65) { renderer.setPixelRatio(1); resize(); }

      const call = stage === "arrival" || stage === "calling" ? anchor(callPosition, 0.052) : offscreen;
      const buttons = panelButtons.map((button) => (panelVisible ? anchor(button.position, 0.047) : offscreen));
      return { call, buttons };
    },
    dispose() {
      disposed = true; observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      for (const entry of [...loaded.values()]) release(entry);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        const drawable = object as THREE.Mesh;
        if (drawable.geometry) geometries.add(drawable.geometry);
        if (drawable.material) (Array.isArray(drawable.material) ? drawable.material : [drawable.material]).forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
      textures.forEach((map) => map.dispose()); extras.forEach((extra) => extra.dispose());
      portalLight.shadow.dispose();
      renderer.dispose(); renderer.domElement.remove();
    },
  };
  // Compile both lighting configurations (hallway and destination rig) while the loading view is up.
  camera.position.set(0, 1.7, 7); camera.lookAt(0, 1.7, 0);
  try {
    await renderer.compileAsync(scene, camera);
    hall.visible = false; rig.visible = true;
    await renderer.compileAsync(scene, camera);
    hall.visible = true; rig.visible = false;
  } catch (error) { result.dispose(); throw error; }
  currentScene = 0;
  return result;
}
