import * as THREE from "three";

/**
 * Shared building blocks for the thirteen destination worlds. Everything is
 * generated locally: no model, HDR, texture or font downloads.
 *
 * Worlds may not add their own lights. They configure the shared rig instead,
 * so the cabin's shaders never recompile when a world swaps in.
 */
export type RigConfig = {
  hemi: [sky: THREE.ColorRepresentation, ground: THREE.ColorRepresentation, intensity: number];
  key: { color: THREE.ColorRepresentation; intensity: number; position: [number, number, number] };
  accent: { color: THREE.ColorRepresentation; intensity: number; position: [number, number, number]; distance: number };
};
export type WorldState = {
  time: number;
  delta: number;
  reduced: boolean;
  aspect: number;
  pointer: { x: number; y: number };
  /** Seconds since the floor's interaction was last triggered (Infinity if never). */
  pulse: number;
  /** How many times the interaction has been triggered on this visit. */
  count: number;
  /** 0 while the doors are shut, 1 once the visitor is standing outside. */
  presence: number;
};
export type World = {
  group: THREE.Group;
  background: THREE.ColorRepresentation;
  fog: [THREE.ColorRepresentation, number];
  rig: RigConfig;
  exposure?: number;
  environment?: number;
  /** Colour the cabin light drifts toward when the doors open onto this world. */
  tint: THREE.ColorRepresentation;
  /** Reuse the shared planar reflector at ground level. */
  reflect?: THREE.ColorRepresentation;
  update(state: WorldState): void;
  dispose?(): void;
};
export type Kit = ReturnType<typeof createKit>;
export type Builder = (kit: Kit) => World | Promise<World>;

export function createKit(options: { mobile: boolean; anisotropy: number; glowTexture: THREE.Texture; pixelScale: { value: number } }) {
  const textures: THREE.Texture[] = [];
  let seed = 9103;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a: number, b: number) => a + (b - a) * random();
  const time = { value: 0 };

  function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, color = true) {
    const element = document.createElement("canvas");
    element.width = width; element.height = height;
    const ctx = element.getContext("2d")!;
    paint(ctx, width, height);
    const map = new THREE.CanvasTexture(element);
    if (color) map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = options.anisotropy;
    textures.push(map);
    return Object.assign(map, { ctx, element });
  }
  function track<T extends THREE.Texture>(map: T) { textures.push(map); return map; }

  function glow(parent: THREE.Object3D, position: [number, number, number], scale: [number, number], color: THREE.ColorRepresentation = "#ffe3ae", opacity = 0.5) {
    const material = new THREE.SpriteMaterial({ map: options.glowTexture, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity, fog: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(...position); sprite.scale.set(scale[0], scale[1], 1); parent.add(sprite);
    return sprite;
  }

  /** Atmospheric sky dome: three-stop gradient, sun disc and halo, no textures. */
  function sky(parent: THREE.Object3D, config: { top: string; horizon: string; bottom?: string; sun?: { direction: [number, number, number]; color: string; size?: number; halo?: number }; radius?: number }) {
    const uniforms = {
      top: { value: new THREE.Color(config.top) }, horizon: { value: new THREE.Color(config.horizon) }, bottom: { value: new THREE.Color(config.bottom ?? config.horizon) },
      sunDir: { value: new THREE.Vector3(...(config.sun?.direction ?? [0, -1, 0])).normalize() }, sunColor: { value: new THREE.Color(config.sun?.color ?? "#000") },
      sunSize: { value: config.sun?.size ?? 0.02 }, halo: { value: config.sun?.halo ?? 0.6 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: "varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 top, horizon, bottom, sunDir, sunColor; uniform float sunSize, halo; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = d.y;
          vec3 col = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.85, h), 0.55)) : mix(horizon, bottom, smoothstep(0.0, -0.25, h));
          float s = max(dot(d, sunDir), 0.0);
          col += sunColor * (smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.6, s) * 2.0 + pow(s, 12.0) * halo * 0.6 + pow(s, 120.0) * halo);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(config.radius ?? 220, 32, 18), material);
    mesh.frustumCulled = false; mesh.renderOrder = -10; parent.add(mesh);
    return Object.assign(mesh, { uniforms });
  }

  type ParticleMode = "fall" | "rise" | "wander" | "still";
  /** GPU-animated soft particles: one draw call, no per-frame CPU work. */
  function particles(parent: THREE.Object3D, config: {
    count: number; min: [number, number, number]; max: [number, number, number]; size: number; color: THREE.ColorRepresentation;
    opacity?: number; mode?: ParticleMode; speed?: number; wander?: number; twinkle?: number; streak?: number; additive?: boolean;
  }) {
    const count = Math.round(config.count * (options.mobile ? 0.6 : 1));
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = random();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 4));
    const min = new THREE.Vector3(...config.min), max = new THREE.Vector3(...config.max);
    geometry.boundingSphere = new THREE.Sphere(min.clone().add(max).multiplyScalar(0.5), min.distanceTo(max) / 2 + (config.wander ?? 0) * 2);
    const uniforms = {
      uTime: time, uScale: options.pixelScale, uSize: { value: config.size }, uMin: { value: min }, uRange: { value: max.clone().sub(min) },
      uSpeed: { value: config.speed ?? 1 }, uWander: { value: config.wander ?? 0 }, uTwinkle: { value: config.twinkle ?? 0 },
      uMode: { value: ["fall", "rise", "wander", "still"].indexOf(config.mode ?? "still") }, uStreak: { value: config.streak ?? 0 },
      uColor: { value: new THREE.Color(config.color) }, uOpacity: { value: config.opacity ?? 0.8 }, uBoost: { value: 0 }, uAttract: { value: new THREE.Vector4(0, 0, 0, 0) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: false,
      blending: config.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: `uniform float uTime, uScale, uSize, uSpeed, uWander, uTwinkle, uStreak, uBoost; uniform int uMode; uniform vec3 uMin, uRange; uniform vec4 uAttract;
        attribute vec4 seed; varying float vAlpha;
        void main(){
          vec3 p = seed.xyz; float r = seed.w;
          if (uMode == 0) p.y = fract(p.y - uTime * uSpeed * (0.6 + 0.8 * r) / uRange.y);
          if (uMode == 1) p.y = fract(p.y + uTime * uSpeed * (0.6 + 0.8 * r) / uRange.y);
          vec3 world = uMin + p * uRange;
          if (uMode == 2 || uWander > 0.0) world += vec3(sin(uTime * uSpeed * (0.4 + r) + r * 31.0), sin(uTime * uSpeed * 0.6 * (0.4 + r) + r * 17.0) * 0.6, cos(uTime * uSpeed * (0.35 + r) + r * 11.0)) * uWander;
          world = mix(world, uAttract.xyz + (seed.xyz - 0.5) * 1.6, uAttract.w * (0.5 + 0.5 * r));
          vec4 mv = modelViewMatrix * vec4(world, 1.0);
          gl_PointSize = uSize * (0.5 + r) * (1.0 + uBoost * 0.6) * uScale / max(0.2, -mv.z);
          gl_Position = projectionMatrix * mv;
          float edge = (uMode == 0 || uMode == 1) ? smoothstep(0.0, 0.08, p.y) * smoothstep(1.0, 0.92, p.y) : 1.0;
          vAlpha = edge * (uTwinkle > 0.0 ? 0.45 + 0.55 * sin(uTime * (0.8 + r * 2.5) * uTwinkle + r * 40.0) : 1.0);
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uStreak, uBoost; varying float vAlpha;
        void main(){ vec2 c = gl_PointCoord - 0.5; c.x *= 1.0 + uStreak * 7.0; float d = dot(c, c); if (d > 0.25) discard;
          gl_FragColor = vec4(uColor * (1.0 + uBoost), smoothstep(0.25, 0.0, d) * uOpacity * vAlpha); }`,
    });
    const points = new THREE.Points(geometry, material);
    parent.add(points);
    return Object.assign(points, { uniforms });
  }

  /** One draw call for many copies of a mesh. Transforms: [x, y, z, sx, sy, sz, rotY?, rotX?, rotZ?]. */
  function instanced(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, transforms: number[][], colors?: THREE.ColorRepresentation[]) {
    const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
    const dummy = new THREE.Object3D();
    transforms.forEach(([x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0], index) => {
      dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(rx, ry, rz); dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (colors) mesh.setColorAt(index, new THREE.Color(colors[index % colors.length]));
    });
    mesh.computeBoundingSphere(); parent.add(mesh);
    return mesh;
  }

  function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number] = [0, 0, 0], rotation: [number, number, number] = [0, 0, 0]) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position); object.rotation.set(...rotation); parent.add(object);
    return object;
  }

  /** Ground plane with optional per-vertex height for terrain. */
  function ground(parent: THREE.Object3D, material: THREE.Material, size: [number, number], center: [number, number] = [0, 20], segments = 1, height?: (x: number, z: number) => number) {
    const geometry = new THREE.PlaneGeometry(size[0], size[1], segments, segments);
    geometry.rotateX(-Math.PI / 2);
    if (height) {
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) position.setY(i, height(position.getX(i) + center[0], position.getZ(i) + center[1]));
      geometry.computeVertexNormals();
    }
    geometry.translate(center[0], 0, center[1]);
    return mesh(parent, geometry, material);
  }

  /** Glowing text on a transparent canvas, for neon signs, screens and spines. */
  function sign(text: string, config: { width?: number; height?: number; color: string; font?: string; background?: string; glow?: number; vertical?: boolean }) {
    const width = config.width ?? 512, height = config.height ?? 128;
    return canvasTexture(width, height, (ctx) => {
      if (config.background) { ctx.fillStyle = config.background; ctx.fillRect(0, 0, width, height); }
      ctx.fillStyle = config.color; ctx.shadowColor = config.color; ctx.shadowBlur = config.glow ?? 18;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const size = config.vertical ? width * 0.62 : height * 0.62;
      ctx.font = config.font ?? `600 ${size}px "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif`;
      const draw = () => {
        if (config.vertical) {
          const chars = [...text];
          chars.forEach((char, index) => ctx.fillText(char, width / 2, (index + 0.5) * (height / chars.length)));
        } else ctx.fillText(text, width / 2, height * 0.54);
      };
      // A blurred pass for the gas glow, then a crisp pass for the tube itself.
      draw(); ctx.shadowBlur = 0; draw();
    });
  }

  function dispose(group: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse((object) => {
      const drawable = object as THREE.Mesh;
      if (drawable.geometry) geometries.add(drawable.geometry);
      if (drawable.material) (Array.isArray(drawable.material) ? drawable.material : [drawable.material]).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((map) => map.dispose());
    textures.length = 0;
  }

  return { THREE, mobile: options.mobile, random, range, time, canvasTexture, track, glow, sky, particles, instanced, mesh, ground, sign, dispose, glowTexture: options.glowTexture, anisotropy: options.anisotropy };
}

/** Value noise in [0, 1], for terrain and procedural textures. */
export function noise2(x: number, y: number) {
  const hash = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, octaves = 4) {
  let value = 0, amplitude = 0.5, frequency = 1;
  for (let i = 0; i < octaves; i++) { value += noise2(x * frequency, y * frequency) * amplitude; amplitude *= 0.5; frequency *= 2; }
  return value;
}
export const lerp = THREE.MathUtils.lerp;
export const clamp = THREE.MathUtils.clamp;
export function ease(a: number, b: number, value: number) {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
/** 0 → 1 → 0 envelope after an interaction, lasting `length` seconds. */
export function envelope(pulse: number, length: number, attack = 0.25) {
  if (!Number.isFinite(pulse) || pulse > length) return 0;
  return ease(0, attack, pulse) * (1 - ease(length * 0.45, length, pulse));
}
