import * as THREE from "three";
import { envelope, fbm, type Kit, type World } from "./kit";

// Floor 2: an acrylic observation tunnel on the sea floor, 800 metres down.
export default function ocean(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;
  kit.sky(group, { top: "#0a3a5c", horizon: "#032234", bottom: "#010a12", sun: { direction: [0.2, 1, 0.4], color: "#2c8db8", size: 0.12, halo: 0.9 } });

  // Walkway and tunnel ribs: the visitor stands in a dry bubble looking out.
  const deck = new THREE.MeshStandardMaterial({ color: "#1f2a30", metalness: 0.75, roughness: 0.35 });
  kit.mesh(group, new THREE.BoxGeometry(3.2, 0.1, 13), deck, [0, -0.05, 7.5]);
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 2.2) });
  for (const side of [-1, 1]) kit.mesh(group, new THREE.BoxGeometry(0.04, 0.03, 13), strip, [side * 1.55, 0.02, 7.5]);
  const rib = new THREE.MeshStandardMaterial({ color: "#2a3940", metalness: 0.9, roughness: 0.3 });
  const ribGeometry = new THREE.TorusGeometry(3.4, 0.07, 8, 48, Math.PI);
  for (let z = 4; z <= 13; z += 3) kit.mesh(group, ribGeometry, rib, [0, -0.6, z]);
  const glass = new THREE.MeshPhysicalMaterial({ color: "#7fd0ff", metalness: 0, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false });
  const tube = new THREE.CylinderGeometry(3.38, 3.38, 9, 40, 1, true, -Math.PI / 2, Math.PI);
  tube.rotateX(Math.PI / 2);
  kit.mesh(group, tube, glass, [0, -0.6, 8.5]);

  // Sand terrain falls away into the dark, with rocks and coral heads.
  const sand = kit.canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#8b8a72"; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6000; i++) { ctx.fillStyle = `rgba(${random() > 0.5 ? "255,250,220" : "40,40,30"},${random() * 0.15})`; ctx.fillRect(random() * 256, random() * 256, 2, 2); }
  });
  sand.wrapS = sand.wrapT = THREE.RepeatWrapping; sand.repeat.set(12, 12);
  kit.ground(group, new THREE.MeshStandardMaterial({ map: sand, color: "#5f7d86", roughness: 0.95 }), [140, 140], [0, 50], kit.mobile ? 60 : 90, (x, z) => {
    const near = Math.max(0, 1 - Math.hypot(x / 4, (z - 7) / 9));
    return -1.2 + fbm(x * 0.06, z * 0.06) * 6 - near * 0.8 - Math.max(0, z - 30) * 0.08;
  });
  const rock = new THREE.MeshStandardMaterial({ color: "#3a4a4c", roughness: 0.9, flatShading: true });
  kit.instanced(group, new THREE.DodecahedronGeometry(1, 0), rock, Array.from({ length: 26 }, () => {
    const side = random() > 0.5 ? 1 : -1;
    return [side * range(4, 18), range(-1.2, 0.4), range(6, 45), range(0.6, 2.6), range(0.4, 1.6), range(0.6, 2.2), random() * 6];
  }));
  const coral = new THREE.MeshStandardMaterial({ color: "#ff6f8e", emissive: "#5a0f2a", emissiveIntensity: 0.6, roughness: 0.6 });
  kit.instanced(group, new THREE.IcosahedronGeometry(0.4, 1), coral, Array.from({ length: 40 }, () => [range(-14, 14) || 4, range(-0.9, 0.2), range(6, 30), range(0.5, 1.4), range(0.6, 1.8), range(0.5, 1.4)]).filter(([x]) => Math.abs(x) > 3.8), ["#ff6f8e", "#ffa45c", "#c86bff", "#5be1c8"]);
  // Kelp: tall ribbons whose sway is computed in the vertex shader.
  const kelpMaterial = new THREE.MeshStandardMaterial({ color: "#2e6b3e", roughness: 0.7, side: THREE.DoubleSide });
  kelpMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = kit.time;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nfloat h = position.y + 0.5; vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.); transformed.x += sin(uTime * 0.9 + wp.x * 0.7 + h * 2.0) * 0.18 * h * h; transformed.z += cos(uTime * 0.7 + wp.z) * 0.1 * h * h;");
  };
  const kelpGeometry = new THREE.PlaneGeometry(0.35, 1, 1, 8);
  kit.instanced(group, kelpGeometry, kelpMaterial, Array.from({ length: 70 }, () => {
    const side = random() > 0.5 ? 1 : -1;
    const height = range(3, 8);
    return [side * range(3.8, 16), height / 2 - 1.2, range(5, 34), 1, height, 1, random() * Math.PI];
  }));

  // Shafts of light from the surface.
  const rayTexture = kit.canvasTexture(64, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "rgba(160,230,255,0.55)"); g.addColorStop(1, "rgba(160,230,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
    const h = ctx.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(0.5, "rgba(0,0,0,0)"); h.addColorStop(1, "rgba(0,0,0,1)");
    ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = h; ctx.fillRect(0, 0, 64, 256);
  });
  const rays: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const material = new THREE.MeshBasicMaterial({ map: rayTexture, transparent: true, opacity: range(0.12, 0.3), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const ray = kit.mesh(group, new THREE.PlaneGeometry(range(1.5, 4), 26), material, [range(-12, 12), 10, range(9, 40)], [0, range(-0.5, 0.5), range(-0.25, 0.25)]);
    rays.push(ray);
  }

  // Jellyfish: translucent fresnel bells with trailing tentacles.
  const jellyMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: kit.time, uBoost: { value: 0 }, uColor: { value: new THREE.Color("#ff9ce6") } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: "varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 uColor; uniform float uBoost, uTime; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float band = 0.6 + 0.4 * sin(vY * 30.0 - uTime * 3.0); gl_FragColor = vec4(uColor * (0.25 + f * 1.6 + uBoost * 1.5) * band, 0.35 + f * 0.6); }",
  });
  const bellGeometry = new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const tentacleMaterial = new THREE.LineBasicMaterial({ color: "#ffc4f0", transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const jellies = Array.from({ length: 8 }, (_, index) => {
    const jelly = new THREE.Group();
    const material = jellyMaterial.clone();
    material.uniforms.uTime = kit.time;
    material.uniforms.uColor.value = new THREE.Color(["#ff9ce6", "#8fe6ff", "#c6a0ff", "#9effd9"][index % 4]);
    const bell = new THREE.Mesh(bellGeometry, material); jelly.add(bell);
    const points: THREE.Vector3[] = [];
    for (let t = 0; t < 12; t++) {
      const angle = (t / 12) * Math.PI * 2, r = 0.38;
      for (let s = 0; s < 6; s++) {
        points.push(new THREE.Vector3(Math.cos(angle) * r * (1 - s * 0.08), -s * 0.32 + 0.1, Math.sin(angle) * r * (1 - s * 0.08)));
        points.push(new THREE.Vector3(Math.cos(angle) * r * (1 - (s + 1) * 0.08), -(s + 1) * 0.32 + 0.1, Math.sin(angle) * r * (1 - (s + 1) * 0.08)));
      }
    }
    jelly.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), tentacleMaterial));
    const scale = range(0.7, 1.5);
    jelly.scale.setScalar(scale);
    const home = new THREE.Vector3(index === 0 ? -1.2 : range(-7, 7), index === 0 ? 3.4 : range(1.5, 7), index === 0 ? 9 : range(8, 22));
    jelly.position.copy(home); group.add(jelly);
    kit.glow(jelly, [0, 0.1, 0], [2.2, 2.2], `#${material.uniforms.uColor.value.getHexString()}`, 0.25);
    return { jelly, bell, material, home, phase: random() * 10 };
  });

  // A school of fish circling the tunnel: one instanced mesh updated per frame.
  const fishGeometry = new THREE.ConeGeometry(0.06, 0.32, 5); fishGeometry.rotateZ(-Math.PI / 2);
  const fishCount = kit.mobile ? 70 : 140;
  const fish = new THREE.InstancedMesh(fishGeometry, new THREE.MeshStandardMaterial({ color: "#b8d8e8", metalness: 0.9, roughness: 0.25, envMapIntensity: 1.2 }), fishCount);
  fish.frustumCulled = false; group.add(fish);
  const fishSeeds = Array.from({ length: fishCount }, () => [random(), random(), random()]);
  const dummy = new THREE.Object3D();

  kit.particles(group, { count: 900, min: [-12, -1, 3.5], max: [12, 10, 36], size: 0.035, color: "#cfefff", opacity: 0.5, mode: "fall", speed: 0.12, wander: 0.4 });
  const plankton = kit.particles(group, { count: 300, min: [-8, 0, 5], max: [8, 6, 22], size: 0.06, color: "#58fff0", opacity: 0.5, mode: "wander", speed: 0.25, wander: 0.8, twinkle: 1.5 });

  return {
    group, background: "#021522", fog: ["#04263a", 0.055], tint: "#6fd6ff", exposure: 1.25,
    rig: { hemi: ["#3fb3e6", "#062030", 0.9], key: { color: "#7fd8ff", intensity: 1.6, position: [3, 20, 10] }, accent: { color: "#3affd2", intensity: 30, position: [0, 3, 7], distance: 14 } },
    update({ time, reduced, pulse }) {
      const wake = envelope(pulse, 6, 0.4);
      jellies.forEach(({ jelly, bell, material, home, phase }) => {
        const beat = reduced ? 0 : Math.max(0, Math.sin(time * 1.6 + phase));
        bell.scale.set(1 + beat * 0.12, 1 - beat * 0.18, 1 + beat * 0.12);
        jelly.position.set(home.x + Math.sin(time * 0.13 + phase) * 0.8, home.y + Math.sin(time * 0.3 + phase) * 0.5 + wake * 1.2, home.z + Math.cos(time * 0.11 + phase) * 0.6);
        jelly.rotation.z = Math.sin(time * 0.4 + phase) * 0.15;
        material.uniforms.uBoost.value = wake;
      });
      plankton.uniforms.uBoost.value = wake * 2;
      for (let i = 0; i < fishCount; i++) {
        const [a, b, c] = fishSeeds[i];
        const angle = time * (0.16 + a * 0.05) * (reduced ? 0.3 : 1) + b * Math.PI * 2 * 0.25 + i * 0.02;
        const radius = 6 + c * 2.5 + Math.sin(time * 0.5 + i) * 0.3;
        dummy.position.set(Math.cos(angle) * radius, 3 + b * 2.2 + Math.sin(angle * 3 + a * 9) * 0.4, 16 + Math.sin(angle) * radius * 0.7);
        dummy.rotation.set(0, -angle - Math.PI / 2, Math.sin(time * 6 + i) * 0.1);
        dummy.updateMatrix(); fish.setMatrixAt(i, dummy.matrix);
      }
      fish.instanceMatrix.needsUpdate = true;
      rays.forEach((ray, index) => { ray.rotation.z = Math.sin(time * 0.15 + index) * 0.12; (ray.material as THREE.MeshBasicMaterial).opacity = 0.14 + Math.sin(time * 0.4 + index * 2) * 0.07; });
    },
  };
}
