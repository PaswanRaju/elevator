import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { smooth, type Stage, type journeyFrame } from "./journey";
import { cameraPose } from "./camera";

type Frame = ReturnType<typeof journeyFrame>;
export type ElevatorWorld = {
  mobile: boolean;
  update: (stage: Stage, frame: Frame, time: number, reduced: boolean, pointer: { x: number; y: number }) => { x: number; y: number; portal: { left: number; right: number; top: number; bottom: number } };
  setButtonHover: (hovered: boolean) => void;
  dispose: () => void;
};

// All geometry, materials and textures are local. No model, HDR or font requests.
export async function createWorld(host: HTMLElement, onContextLost: () => void): Promise<ElevatorWorld> {
  const mobile = matchMedia("(pointer: coarse)").matches || host.clientWidth < 760;
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: false, powerPreference: "low-power" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.35 : 1.75));
  renderer.domElement.setAttribute("aria-label", "A three-dimensional elevator and nighttime city");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#080b10");
  scene.fog = new THREE.FogExp2("#080b10", 0.025);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 400);
  const hall = new THREE.Group();
  const cabin = new THREE.Group();
  const roof = new THREE.Group();
  scene.add(hall, cabin, roof);
  roof.visible = false;
  const textures: THREE.Texture[] = [];
  const extras: { dispose: () => void }[] = [];
  let seed = 7319;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const canvas = (width: number, height: number) => {
    const element = document.createElement("canvas");
    element.width = width; element.height = height;
    return { element, ctx: element.getContext("2d")! };
  };
  function texture(element: HTMLCanvasElement) {
    const map = new THREE.CanvasTexture(element);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
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
  const cool = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.65, 1.9, 2.5), toneMapped: true });
  const rose = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 0.5, 0.8), toneMapped: true });
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
  function mesh(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
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
  function glow(group: THREE.Group, x: number, y: number, z: number, sx: number, sy: number, color = "#ffe3ae", opacity = 0.45) {
    const material = new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z); sprite.scale.set(sx, sy, 1); group.add(sprite);
    return sprite;
  }
  function light(group: THREE.Group, color: string, intensity: number, x: number, y: number, z: number, distance: number) {
    const source = new THREE.PointLight(color, intensity, distance, 2);
    source.position.set(x, y, z); group.add(source); return source;
  }
  scene.add(new THREE.HemisphereLight("#b7c6dd", "#25201b", 0.42));
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
  const cityLight = light(roof, "#7fbbdf", 65, 0, 6, 8, 30);
  cityLight.visible = true;

  // Hallway: full depth, recessed joints, portal mouldings and light coves.
  for (const side of [-1, 1]) {
    box(hall, stone, side * 3.6, 1.95, -0.15, 4.5, 3.9, 0.3);
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
  const backMirror = new THREE.MeshStandardMaterial({ color: "#616663", metalness: 1, roughness: 0.09, envMapIntensity: 0.9 });
  mesh(cabin, new RoundedBoxGeometry(2.9, 1.9, 0.025, 2, 0.01), backMirror, 0, 2.13, -4.12);
  box(cabin, brass, 0, 3.37, -0.06, 4, 0.14, 0.18);
  box(cabin, black, 0, 3.37, -2.1, 2.8, 0.025, 1.9);
  for (const x of [-1.38, 1.38]) box(cabin, warm, x, 3.35, -2.1, 0.035, 0.025, 1.9);
  for (const z of [-3.03, -1.17]) box(cabin, warm, 0, 3.35, z, 2.8, 0.025, 0.035);
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
  const panel = mesh(cabin, new RoundedBoxGeometry(0.43, 1.16, 0.07, 2, 0.025), doorMetal, -1.65, 1.48, -0.2);
  const panelInset = mesh(cabin, new THREE.PlaneGeometry(0.36, 1.07), black, -1.65, 1.48, -0.238);
  panelInset.rotation.y = Math.PI;
  const buttonPosition = new THREE.Vector3(-1.65, 1.35, -0.27);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: "#b69b68" });
  const ring = mesh(cabin, new THREE.TorusGeometry(0.139, 0.009, 8, 40), ringMaterial, buttonPosition.x, buttonPosition.y, buttonPosition.z);
  ring.rotation.y = Math.PI;
  const buttonFace = mesh(cabin, new THREE.CylinderGeometry(0.13, 0.13, 0.025, 32), doorMetal, buttonPosition.x, buttonPosition.y, buttonPosition.z);
  buttonFace.rotation.x = Math.PI / 2;
  panel.name = "Floor 13 panel";
  const buttonGlow = glow(cabin, -1.65, 1.35, -0.3, 0.6, 0.6, "#f7d7a1", 0.25);

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
  const innerDisplay = mesh(cabin, new THREE.PlaneGeometry(0.33, 0.165), displayMaterial, -1.65, 1.82, -0.242);
  innerDisplay.rotation.y = Math.PI;
  box(cabin, darkMetal, 0, 3.07, -0.12, 0.7, 0.27, 0.08);
  const lintelDisplay = mesh(cabin, new THREE.PlaneGeometry(0.62, 0.23), displayMaterial, 0, 3.07, -0.17);
  lintelDisplay.rotation.y = Math.PI;
  const plate = label("13", 128, 128);
  const number = mesh(cabin, new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshBasicMaterial({ map: plate.map }), -1.65, 1.35, -0.287);
  number.rotation.y = Math.PI;
  const monogram = label("XIII", 512, 256);
  mesh(cabin, new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshBasicMaterial({ map: monogram.map }), 0, 2.1, -4.09);
  const hallMark = label("XIII", 512, 256);
  mesh(hall, new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: hallMark.map }), -3.3, 1.95, 0.02);

  // Rooftop: fog-separated city layers with thousands of instanced window lights.
  const roofStone = new THREE.MeshStandardMaterial({ map: stoneMap, color: "#303e4d", metalness: 0.4, roughness: 0.25 });
  box(roof, roofStone, 0, -0.17, 6.8, 19, 0.3, 14);
  const wetTerrace = mesh(roof, new THREE.PlaneGeometry(18, 14), new THREE.MeshStandardMaterial({ map: stoneMap, color: "#647a8d", transparent: true, opacity: 0.58, roughness: 0.3, metalness: 0.4, depthWrite: false }), 0, 0.008, 7);
  wetTerrace.rotation.x = -Math.PI / 2;
  box(roof, darkMetal, 0, 0.05, 13.8, 19, 0.12, 0.18);
  box(roof, cool, 0, 0.11, 13.7, 18.5, 0.018, 0.025);
  for (const x of [-9, 9]) {
    box(roof, darkMetal, x, 0.48, 7, 0.06, 0.96, 13);
    box(roof, cool, x, 0.12, 7, 0.025, 0.018, 13);
  }
  const glass = new THREE.MeshStandardMaterial({ color: "#6d9cab", transparent: true, opacity: 0.12, roughness: 0.12, metalness: 0.7, side: THREE.DoubleSide, depthWrite: false });
  mesh(roof, new THREE.PlaneGeometry(18, 0.9), glass, 0, 0.55, 13.75);
  box(roof, darkMetal, 0, 1, 13.75, 18.5, 0.035, 0.05);
  for (let x = -9; x <= 9; x += 3) box(roof, darkMetal, x, 0.53, 13.75, 0.025, 0.94, 0.035);
  for (let x = -8; x <= 8; x += 2) box(roof, darkMetal, x, 0.001, 7, 0.015, 0.012, 13);
  for (let z = 2; z < 14; z += 2) box(roof, darkMetal, 0, 0.002, z, 18, 0.012, 0.015);
  // Low architectural seating keeps the foreground spatial without cluttering the view.
  for (const x of [-6, 6]) {
    box(roof, black, x, 0.22, 8.8, 2.8, 0.45, 1.1);
    box(roof, darkMetal, x, 0.48, 8.8, 3, 0.12, 1.25);
    box(roof, warm, x, 0.08, 8.18, 2.6, 0.02, 0.02);
    glow(roof, x, 0.2, 8, 3, 0.8, "#9ecbdb", 0.2);
  }
  const buildingMaterial = new THREE.MeshStandardMaterial({ color: "#172c43", metalness: 0.65, roughness: 0.38, envMapIntensity: 0.45 });
  const windowsMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const windowMatrices: THREE.Matrix4[] = [];
  const windowColors: THREE.Color[] = [];
  const towerTops: { x: number; y: number; z: number }[] = [];
  for (let row = 0; row < 4; row++) {
    const count = mobile ? 17 : 23;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * (row ? 7 : 6.4) + (random() - 0.5) * 3;
      const z = 29 + row * 24 + random() * 9;
      const w = 2.4 + random() * 3.1;
      const d = 3 + random() * 4;
      let h = 7 + random() * 23 + (row > 1 ? 10 : 0);
      if (Math.abs(x + 7.2) < 4 && z < 56) h = Math.min(h, 12);
      const base = -15;
      box(roof, buildingMaterial, x, base + h / 2, z, w, h, d);
      // Setback crowns and vertical mullions give the towers distinct silhouettes.
      if (i % 4 === 0) {
        box(roof, buildingMaterial, x, base + h + 1.2, z + 0.2, w * 0.72, 2.4, d * 0.7);
        box(roof, cool, x, base + h + 2.4, z - d * 0.35 + 0.18, w * 0.72, 0.035, 0.035);
      }
      if (row < 2) for (const offset of [-0.44, 0, 0.44]) {
        box(roof, darkMetal, x + w * offset, base + h / 2, z - d / 2 - 0.03, 0.045, h, 0.07);
      }
      if (i % 3 === 0) {
        box(roof, darkMetal, x, base + h + 0.4, z, w * 0.5, 0.8, d * 0.55);
        box(roof, i % 2 ? cool : rose, x, base + h, z - d / 2 - 0.02, w, 0.055, 0.05);
        towerTops.push({ x, y: base + h + 1, z });
      }
      // Front and side windows make the skyline read as volumes, not billboards.
      for (let level = 0.8; level < h - 0.4; level += 0.72) {
        for (let column = -w / 2 + 0.32; column < w / 2 - 0.15; column += 0.52) {
          if (random() < 0.47) continue;
          transform.position.set(x + column, base + level, z - d / 2 - 0.015);
          transform.rotation.set(0, 0, 0); transform.scale.set(0.14 + random() * 0.14, 0.27, 1); transform.updateMatrix();
          windowMatrices.push(transform.matrix.clone());
          windowColors.push(new THREE.Color().setHSL(random() < 0.25 ? 0.1 : 0.54, 0.35, 0.28 + random() * 0.45));
        }
        if (level % 2 < 1) for (let column = -d / 2 + 0.5; column < d / 2; column += 0.8) {
          if (random() < 0.5) continue;
          transform.position.set(x - w / 2 - 0.015, base + level, z + column);
          transform.rotation.set(0, Math.PI / 2, 0); transform.scale.set(0.18, 0.25, 1); transform.updateMatrix();
          windowMatrices.push(transform.matrix.clone()); windowColors.push(new THREE.Color("#638c9b"));
        }
      }
    }
  }
  const windowGeometry = new THREE.PlaneGeometry(1, 1);
  // Instance colors are multiplied by a white base; no per-vertex color attribute is required.
  windowsMaterial.vertexColors = false;
  windowsMaterial.side = THREE.DoubleSide;
  const windows = new THREE.InstancedMesh(windowGeometry, windowsMaterial, windowMatrices.length);
  windowMatrices.forEach((matrix, index) => { windows.setMatrixAt(index, matrix); windows.setColorAt(index, windowColors[index]); });
  windows.computeBoundingSphere(); roof.add(windows);

  // A single sculptural landmark, with a luminous crown and needle.
  const landmark = new THREE.Group(); landmark.position.set(-7.2, -15, 56); landmark.scale.y = 0.65; roof.add(landmark);
  const core = mesh(landmark, new THREE.CylinderGeometry(1.2, 2.7, 42, 6), buildingMaterial, 0, 21, 0);
  core.rotation.y = Math.PI / 6;
  const lineGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = i / 6 * Math.PI * 2;
    const line = new THREE.CylinderGeometry(0.028, 0.028, 39, 3);
    line.translate(Math.cos(angle) * 1.5, 22, Math.sin(angle) * 1.5);
    lineGeometries.push(line);
  }
  const merged = mergeGeometries(lineGeometries);
  if (merged) mesh(landmark, merged, cool, 0, 0, 0);
  lineGeometries.forEach((geometry) => geometry.dispose());
  mesh(landmark, new THREE.ConeGeometry(1.22, 6, 6), darkMetal, 0, 45, 0);
  mesh(landmark, new THREE.CylinderGeometry(0.035, 0.08, 9, 6), cool, 0, 49, 0);
  const crown = mesh(landmark, new THREE.TorusGeometry(1.5, 0.045, 6, 40), cool, 0, 41.7, 0);
  crown.rotation.x = Math.PI / 2;
  for (let y = 3; y < 42; y += 1.5) {
    const band = mesh(landmark, new THREE.TorusGeometry(2.7 - y / 42 * 1.5, 0.018, 3, 6), y > 35 ? cool : brass, 0, y, 0);
    band.rotation.x = Math.PI / 2; band.rotation.z = Math.PI / 6;
  }
  glow(roof, -7.2, 19.6, 56, 8, 8, "#87d9ff", 0.3);
  // Connected twin towers form a second landmark with a real occupied skybridge.
  for (const x of [14, 21]) {
    mesh(roof, new RoundedBoxGeometry(3.5, 31, 4.5, 1, 0.25), buildingMaterial, x, 0.5, 48);
    for (let y = -12; y < 16; y += 1.1) {
      box(roof, cool, x, y, 45.72, 3.15, 0.045, 0.025);
      box(roof, darkMetal, x, y + 0.13, 45.68, 3.5, 0.06, 0.1);
    }
    box(roof, brass, x, 16.15, 48, 3.6, 0.3, 4.6);
  }
  box(roof, darkMetal, 17.5, 8.3, 48, 7, 1.15, 2.3);
  box(roof, warm, 17.5, 8.3, 46.83, 7, 0.38, 0.035);
  for (let x = 14.5; x < 21; x += 0.5) box(roof, darkMetal, x, 8.3, 46.8, 0.035, 0.5, 0.06);
  const avenue = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-38, -9, 25), new THREE.Vector3(-14, -9, 39),
    new THREE.Vector3(12, -9, 72), new THREE.Vector3(48, -9, 105),
  ]);
  mesh(roof, new THREE.TubeGeometry(avenue, 48, 0.09, 4, false), warm, 0, 0, 0);
  // Sky shader: smooth atmospheric scattering, a low violet horizon, no large sky asset.
  const sky = mesh(roof, new THREE.SphereGeometry(210, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: "varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "varying vec3 vPosition; void main(){vec3 d=normalize(vPosition);float h=smoothstep(-0.1,0.5,d.y);vec3 col=mix(vec3(0.10,0.13,0.22),vec3(0.008,0.018,0.046),h);float glow=exp(-pow((d.y-0.035)*7.0,2.0))*exp(-pow((d.x+0.25)*1.7,2.0));col+=vec3(0.10,0.035,0.07)*glow;gl_FragColor=vec4(col,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
  }), 0, 0, 0);
  sky.frustumCulled = false;
  const moon = mesh(roof, new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: "#e3e8e6", fog: false }), -44, 49, 145);
  moon.name = "Moon";
  glow(roof, -44, 49, 144, 18, 18, "#b4d6ff", 0.2);
  const starPositions = new Float32Array(450 * 3);
  for (let i = 0; i < 450; i++) {
    starPositions[i * 3] = (random() - 0.5) * 280;
    starPositions[i * 3 + 1] = 22 + random() * 100;
    starPositions[i * 3 + 2] = 100 + random() * 60;
  }
  const starsGeometry = new THREE.BufferGeometry(); starsGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  roof.add(new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: "#a7c7e2", size: 0.14, transparent: true, opacity: 0.6, depthWrite: false, fog: false })));
  const beacons = towerTops.slice(0, 12).map((point) => glow(roof, point.x, point.y, point.z, 0.8, 0.8, "#ff6684", 0.45));
  const flights = [glow(roof, 0, 10, 42, 0.6, 0.2, "#a7efff", 0.7), glow(roof, 0, 16, 78, 0.5, 0.18, "#ffd8af", 0.6)];
  // Floor 13 portrait: Raju's original photo behind glass in a floating gold frame.
  const portraitRoot = new THREE.Group(); roof.add(portraitRoot);
  const portraitBody = new THREE.Group(); portraitRoot.add(portraitBody);
  const frameRing = new THREE.Shape();
  frameRing.moveTo(-0.57, -0.57); frameRing.lineTo(0.57, -0.57); frameRing.lineTo(0.57, 0.57); frameRing.lineTo(-0.57, 0.57); frameRing.closePath();
  const frameHole = new THREE.Path();
  frameHole.moveTo(-0.5, -0.5); frameHole.lineTo(-0.5, 0.5); frameHole.lineTo(0.5, 0.5); frameHole.lineTo(0.5, -0.5); frameHole.closePath();
  frameRing.holes.push(frameHole);
  const frameGeometry = new THREE.ExtrudeGeometry(frameRing, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.014, bevelSegments: 3, curveSegments: 1 });
  frameGeometry.translate(0, 0, -0.02);
  // A faint warm emissive keeps the gold reading as gold against the cool night environment.
  const portraitGold = new THREE.MeshPhysicalMaterial({ map: brushed, color: "#e3c07c", emissive: "#5a3f15", emissiveIntensity: 0.55, metalness: 0.9, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.8, transparent: true });
  const portraitBacking = new THREE.MeshStandardMaterial({ color: "#07090d", metalness: 0.6, roughness: 0.45, transparent: true });
  const portraitGlass = new THREE.MeshStandardMaterial({ color: "#000000", metalness: 1, roughness: 0.06, envMapIntensity: 1.1, transparent: true, opacity: 0, depthWrite: false });
  const photoUniforms = { map: { value: null as THREE.Texture | null }, opacity: { value: 0 }, sweep: { value: -1 }, emerge: { value: 0 } };
  // No tone mapping: the photo keeps its original colors under the night grade.
  // `emerge` lifts it out of shadow; at 1 the darkening and vignette are gone and the photo is shown as-is.
  const photoMaterial = new THREE.ShaderMaterial({
    uniforms: photoUniforms, transparent: true, fog: false,
    vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "uniform sampler2D map; uniform float opacity; uniform float sweep; uniform float emerge; varying vec2 vUv; void main(){vec4 c=texture2D(map,vUv);vec2 q=vUv-0.5;float shade=mix(0.06,1.0,emerge)*(1.0-dot(q,q)*1.6*(1.0-emerge));float band=exp(-pow((vUv.x+vUv.y*0.45-sweep)*8.0,2.0));gl_FragColor=vec4(c.rgb*shade+vec3(1.0,0.86,0.62)*band*0.2,opacity);\n#include <colorspace_fragment>\n}",
  });
  mesh(portraitBody, new RoundedBoxGeometry(1.2, 1.2, 0.06, 2, 0.02), portraitBacking, 0, 0, -0.05);
  mesh(portraitBody, frameGeometry, portraitGold, 0, 0, 0);
  // Stays in the scene so its shader compiles with the rest; opacity holds it hidden until the photo loads.
  mesh(portraitBody, new THREE.PlaneGeometry(1, 1), photoMaterial, 0, 0, 0.004);
  let photoReady = false;
  mesh(portraitBody, new THREE.PlaneGeometry(1, 1), portraitGlass, 0, 0, 0.012);
  const portraitHalo = glow(portraitBody, 0, 0, -0.12, 2.6, 2.6, "#e8c78c", 0);
  const poolMaterial = new THREE.MeshBasicMaterial({ map: glowTexture, color: "#f1cf94", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const portraitPool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMaterial);
  portraitPool.rotation.x = -Math.PI / 2; roof.add(portraitPool);
  // An optimized WebP of the 1.9 MB PNG; the PNG itself is the fallback.
  const portraitWidth = mobile ? 750 : 1080;
  const loader = new THREE.TextureLoader();
  const applyPhoto = (map: THREE.Texture) => {
    if (disposed) { map.dispose(); return; }
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.push(map); photoUniforms.map.value = map; photoReady = true;
  };
  loader.load(`/_next/image?url=%2Fraju.png&w=${portraitWidth}&q=75`, applyPhoto, undefined, () => loader.load("/raju.png", applyPhoto));
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
      instances.castShadow = group !== roof; instances.receiveShadow = true;
    }
    instances.computeBoundingSphere(); group.add(instances);
  }
  batch.clear();
  let width = 1, height = 1;
  let lastFloor = -1;
  let oldFloor = 0;
  let digitChangedAt = 0;
  let previousDoors = -1;
  let buttonHovered = false;
  let lost = false;
  let disposed = false;
  let pointerX = 0, pointerY = 0;
  let samples = 0, slowFrames = 0, previousRender = performance.now();
  const look = new THREE.Vector3();
  const projected = new THREE.Vector3();
  function aim(target: THREE.PerspectiveCamera, pose: ReturnType<typeof cameraPose>) {
    look.set(Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch), -Math.cos(pose.yaw) * Math.cos(pose.pitch)).add(target.position);
    target.lookAt(look); target.rotateZ(pose.roll);
    target.fov = pose.fov; target.updateProjectionMatrix(); target.updateMatrixWorld();
  }
  // Frames the portrait from the final reveal viewpoint: beside the copy in landscape, beneath it in portrait.
  const framing = new THREE.PerspectiveCamera();
  const portraitHome = new THREE.Vector3();
  function placePortrait() {
    const aspect = width / height;
    const pose = cameraPose("reveal", 0, aspect);
    framing.aspect = aspect; framing.position.fromArray(pose.position); aim(framing, pose);
    const portrait = aspect <= 1;
    const distance = 4.6;
    const visible = 2 * distance * Math.tan(THREE.MathUtils.degToRad(pose.fov / 2));
    // Squat phones (320×568) have less room between the copy and the guide, so the portrait shrinks there.
    const compact = portrait && aspect > 0.5;
    const size = Math.min(visible * (portrait ? compact ? 0.21 : 0.25 : 0.4), visible * aspect * (portrait ? 0.56 : 0.27));
    projected.set(portrait ? 0 : 0.47, portrait ? compact ? -0.25 : -0.2 : 0.03, 0.5).unproject(framing).sub(framing.position).normalize();
    portraitHome.copy(framing.position).addScaledVector(projected, distance);
    portraitRoot.position.copy(portraitHome);
    portraitRoot.scale.setScalar(size / 1.14);
    portraitRoot.lookAt(framing.position);
    portraitPool.position.set(portraitHome.x, 0.03, portraitHome.z);
    portraitPool.scale.set(size * 2.2, size * 1.3, 1);
  }
  const resize = () => {
    width = host.clientWidth; height = host.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
    placePortrait();
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function contextLost(event: Event) { event.preventDefault(); lost = true; renderer.domElement.style.display = "none"; onContextLost(); }
  renderer.domElement.addEventListener("webglcontextlost", contextLost);

  const result: ElevatorWorld = {
    mobile,
    setButtonHover(hovered) { buttonHovered = hovered; },
    update(stage, frame, total, reduced, pointer) {
      if (lost || disposed) return { x: width * 0.75, y: height * 0.55, portal: { left: width * 0.45, right: width * 0.85, top: height * 0.2, bottom: height * 0.8 } };
      const t = frame.time;
      hall.visible = !frame.rooftop;
      roof.visible = frame.rooftop;
      const outdoors = frame.rooftop;
      (scene.fog as THREE.FogExp2).color.set(outdoors ? "#182235" : "#080b10");
      (scene.fog as THREE.FogExp2).density = outdoors ? 0.009 : 0.025;
      (scene.background as THREE.Color).set(outdoors ? "#0a1224" : "#080b10");
      leftDoor.position.x = -0.655 - frame.doors * 1.32;
      rightDoor.position.x = 0.655 + frame.doors * 1.32;
      if (previousDoors !== frame.doors) { renderer.shadowMap.needsUpdate = true; previousDoors = frame.doors; }
      const pose = cameraPose(stage, t, width / height, reduced);
      camera.position.fromArray(pose.position);
      pointerX = THREE.MathUtils.lerp(pointerX, pointer.x, 0.035); pointerY = THREE.MathUtils.lerp(pointerY, pointer.y, 0.035);
      if (!reduced && (stage === "arrival" || stage === "reveal")) {
        const settle = stage === "reveal" ? smooth(0, 2, t) : 1;
        camera.position.x += (Math.sin(total * 0.14) * 0.035 + pointerX * 0.05) * settle;
        camera.position.y += (Math.sin(total * 0.22) * 0.012 - pointerY * 0.015) * settle;
      }
      aim(camera, pose);
      // Portrait entrance begins as the doors part, so it is settling while the camera steps out.
      const since = stage === "reveal" ? 3.4 + t : stage === "ride" ? t - 9 : -1;
      portraitRoot.visible = since > 0;
      if (since > 0) {
        const appear = smooth(0, 2.2, since);
        const settle = reduced ? 1 : smooth(0, 3, since);
        const idle = reduced ? 0 : smooth(2.5, 4.5, since);
        portraitBody.position.set(0, (1 - settle) * -0.45 + Math.sin(total * 0.7) * 0.035 * idle, (1 - settle) * -0.8);
        portraitBody.rotation.set(
          (-pointerY * 0.09 + Math.sin(total * 0.45) * 0.015) * idle,
          (1 - settle) * -0.55 + (pointerX * 0.16 + Math.sin(total * 0.3) * 0.03) * idle,
          0,
        );
        portraitBody.scale.setScalar(0.92 + settle * 0.08);
        portraitGold.opacity = portraitBacking.opacity = appear;
        photoUniforms.opacity.value = photoReady ? smooth(0.4, 2.4, since) : 0;
        photoUniforms.sweep.value = reduced ? -1 : -0.6 + smooth(2.2, 3.8, since) * 2.6;
        photoUniforms.emerge.value = reduced ? 1 : smooth(0.9, 3.4, since);
        portraitGlass.opacity = appear * 0.07;
        (portraitHalo.material as THREE.SpriteMaterial).opacity = appear * (0.3 + Math.sin(total * 0.8) * 0.04 * idle);
        poolMaterial.opacity = appear * 0.22;
      }
      cabinLight.intensity = stage === "ride" && t > 1.5 && t < 7.5 ? 17 + Math.sin(t * 4) * 0.35 : 20;
      const moving = stage === "ride" && t > 1.6 && t < 7.7;
      passingLight.intensity = moving && !reduced ? Math.pow(Math.max(0, Math.sin(t * 5.6)), 8) * 3 : 0;
      passingLight.position.y = 3.1 - ((t * 1.8) % 2.5);
      const selected = stage === "ride" || stage === "reveal";
      ringMaterial.color.set(selected || buttonHovered ? "#ffe0a0" : "#b69b68");
      (buttonGlow.material as THREE.SpriteMaterial).opacity = selected ? 0.65 : buttonHovered ? 0.5 : 0.22;
      const press = stage === "ride" ? Math.sin(smooth(0, 0.35, t) * Math.PI) * 0.012 : 0;
      buttonFace.position.z = buttonPosition.z + press;
      number.position.z = -0.287 + press;
      reflection.visible = stage === "arrival" || stage === "entering" || (outdoors && frame.doors > 0);
      reflection.position.z = outdoors ? 7 : 5.5;
      if (!reduced) {
        dust.rotation.y = Math.sin(total * 0.08) * 0.035;
        beacons.forEach((beacon, index) => { (beacon.material as THREE.SpriteMaterial).opacity = 0.3 + Math.sin(total * 1.5 + index) * 0.15; });
        flights.forEach((flight, index) => { flight.position.x = Math.sin(total * 0.022 + index * 2) * 60; });
      }
      dust.visible = !reduced;
      if (lastFloor !== frame.floor) {
        oldFloor = Math.max(0, lastFloor); digitChangedAt = total;
        lastFloor = frame.floor;
      }
      if (total - digitChangedAt < 0.35) {
        const travel = reduced ? 1 : smooth(0, 0.22, total - digitChangedAt);
        const ctx = display.ctx;
        ctx.fillStyle = "#070b0d"; ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = "#e6c491"; ctx.font = "300 146px monospace";
        if (travel < 1 && frame.floor > 0) ctx.fillText(oldFloor === 0 ? "G" : String(oldFloor).padStart(2, "0"), 282, 139 - travel * 256);
        ctx.fillText(frame.floor === 0 ? "G" : String(frame.floor).padStart(2, "0"), 282, 139 + (frame.floor > 0 ? (1 - travel) * 256 : 0));
        ctx.strokeStyle = "#e6c491"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(56, 124); ctx.lineTo(78, 102); ctx.lineTo(100, 124); ctx.stroke();
        ctx.globalAlpha = 0.18; ctx.fillStyle = "#000";
        for (let y = 0; y < 256; y += 4) ctx.fillRect(0, y, 512, 1);
        ctx.globalAlpha = 1;
        display.map.needsUpdate = true;
      }
      renderer.render(scene, camera);
      // Downshift once if sustained frame intervals show a struggling device.
      const now = performance.now();
      if (now - previousRender > (mobile ? 48 : 30)) slowFrames++;
      previousRender = now;
      if (++samples === 120 && slowFrames > 65) renderer.setPixelRatio(1);
      projected.copy(buttonPosition).project(camera);
      const anchor = { x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height };
      const corners = [[-1.6, 0, 0.4], [1.6, 0, 0.4], [-1.6, 3.6, 0.4], [1.6, 3.6, 0.4]].map(([x, y, z]) => {
        projected.set(x, y, z).project(camera);
        return { x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height };
      });
      const portal = { left: Math.min(...corners.map((p) => p.x)), right: Math.max(...corners.map((p) => p.x)), top: Math.min(...corners.map((p) => p.y)), bottom: Math.max(...corners.map((p) => p.y)) };
      return { ...anchor, portal };
    },
    dispose() {
      disposed = true; observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
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
  // Compile both lighting environments while the loading control is visible.
  camera.position.set(0, 1.7, 7); camera.lookAt(0, 1.7, 0);
  try {
    await renderer.compileAsync(scene, camera);
    hall.visible = false; roof.visible = true;
    await renderer.compileAsync(scene, camera);
    hall.visible = true; roof.visible = false;
  } catch (error) { result.dispose(); throw error; }
  return result;
}
