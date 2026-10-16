import * as THREE from "three";
import { envelope, lerp, type Kit, type World } from "./kit";

// Floor 9: a pastel sky where islands float, waterfalls pour into clouds and gravity is optional.
export default function dream(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;
  kit.sky(group, { top: "#7f8cff", horizon: "#ffc6e6", bottom: "#fff0f6", sun: { direction: [0.3, 0.35, 1], color: "#fff6e0", size: 0.03, halo: 1.4 } });

  // A sea of cloud below and around: soft instanced puffs.
  const cloud = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, emissive: "#ffd6ec", emissiveIntensity: 0.35 });
  const puff = new THREE.IcosahedronGeometry(1, 2);
  kit.instanced(group, puff, cloud, Array.from({ length: kit.mobile ? 90 : 150 }, () => {
    const x = range(-60, 60), z = range(-4, 90);
    const near = Math.abs(x) < 4 && z < 9;
    const s = range(2.5, 6);
    return [x, near ? -4 : range(-3.5, -1.2), z, s * 1.4, s * 0.6, s];
  }), ["#ffffff", "#ffe6f3", "#efe8ff", "#fff3e6"]);
  // High drifting clouds.
  const drifting = new THREE.Group(); group.add(drifting);
  kit.instanced(drifting, puff, cloud, Array.from({ length: 26 }, () => [range(-50, 50), range(14, 30), range(30, 90), range(3, 7), range(1.2, 2.4), range(2, 4)]));

  // The marble terrace the doors open onto, with a gilded rim.
  const marble = kit.canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#f4eef6"; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(190,160,210,0.4)";
    for (let i = 0; i < 14; i++) { ctx.lineWidth = range(0.5, 2); ctx.beginPath(); let x = random() * 256, y = 0; ctx.moveTo(x, y); while (y < 256) { x += range(-20, 20); y += range(10, 30); ctx.lineTo(x, y); } ctx.stroke(); }
  });
  const terrace = new THREE.MeshStandardMaterial({ map: marble, roughness: 0.25, metalness: 0.05 });
  const gold = new THREE.MeshStandardMaterial({ color: "#e8c27a", metalness: 0.9, roughness: 0.25 });
  kit.mesh(group, new THREE.CylinderGeometry(4.2, 3.6, 0.5, 48), terrace, [0, -0.25, 4.6]);
  kit.mesh(group, new THREE.TorusGeometry(4.2, 0.06, 8, 64), gold, [0, 0, 4.6], [Math.PI / 2, 0, 0]);
  kit.mesh(group, new THREE.ConeGeometry(3.6, 4, 24), new THREE.MeshStandardMaterial({ color: "#b49ac8", roughness: 0.9, flatShading: true }), [0, -2.5, 4.6], [Math.PI, 0, 0]);
  // Stepping stones float onward from the terrace.
  const stones: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) stones.push(kit.mesh(group, new THREE.CylinderGeometry(0.7, 0.55, 0.25, 20), terrace, [Math.sin(i * 0.9) * 1.6, -0.1 + i * 0.35, 9.5 + i * 1.8]));

  // Floating islands: rocky underside, grassy top, pastel trees, a waterfall pouring off the edge.
  const earth = new THREE.MeshStandardMaterial({ color: "#a98fb8", roughness: 0.95, flatShading: true });
  const grass = new THREE.MeshStandardMaterial({ color: "#9fe0b8", roughness: 0.8 });
  const crown = new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true });
  const fallUniforms = { uTime: kit.time, uBoost: { value: 0 } };
  const fallMaterial = new THREE.ShaderMaterial({
    uniforms: fallUniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uTime, uBoost; varying vec2 vUv;
      void main(){ float s = 0.6 + 0.4 * sin(vUv.x * 40.0) * sin(vUv.y * 12.0 + uTime * 6.0);
        float a = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x) * smoothstep(0.0, 0.5, vUv.y);
        gl_FragColor = vec4(vec3(0.85, 0.95, 1.0) * (1.0 + uBoost), a * s * 0.8); }`,
  });
  function island(x: number, y: number, z: number, s: number) {
    const root = new THREE.Group(); root.position.set(x, y, z); root.scale.setScalar(s); group.add(root);
    kit.mesh(root, new THREE.ConeGeometry(2, 3.4, 9), earth, [0, -1.8, 0], [Math.PI, random() * 3, 0]);
    kit.mesh(root, new THREE.CylinderGeometry(2.05, 2, 0.3, 20), grass, [0, 0, 0]);
    for (let t = 0; t < 3; t++) {
      const a = random() * Math.PI * 2, r = range(0.3, 1.3), h = range(0.9, 1.6);
      kit.mesh(root, new THREE.CylinderGeometry(0.07, 0.1, h, 6), earth, [Math.cos(a) * r, h / 2, Math.sin(a) * r]);
      const leaves = kit.mesh(root, new THREE.IcosahedronGeometry(range(0.5, 0.8), 0), crown.clone(), [Math.cos(a) * r, h + 0.3, Math.sin(a) * r]);
      (leaves.material as THREE.MeshStandardMaterial).color.set(["#ffb3d1", "#c7a7ff", "#ffd59e", "#a5e6ff"][Math.floor(random() * 4)]);
    }
    kit.mesh(root, new THREE.PlaneGeometry(0.7, 6), fallMaterial, [1.6, -3, 1.2], [0, -0.7, 0]);
    kit.glow(root, [1.6, -6, 1.2], [3, 1.5], "#ffffff", 0.4);
    return root;
  }
  const islands = [island(-6, 3.5, 16, 1.2), island(7, 6, 24, 1.5), island(-12, 9, 34, 2), island(14, 2, 40, 1.8), island(0, 13, 52, 2.6)];
  const hero = island(3.2, 2.6, 12, 0.9);
  const heroSpots = [new THREE.Vector3(3.2, 2.6, 12), new THREE.Vector3(-2.8, 4.4, 13), new THREE.Vector3(0.6, 6.2, 15), new THREE.Vector3(4.6, 1.4, 10.5)];
  const heroTarget = heroSpots[0].clone();

  // A spiral stair to nowhere, and a ringed moon resting in the sky.
  kit.instanced(group, new THREE.BoxGeometry(1.4, 0.15, 0.6), terrace, Array.from({ length: 26 }, (_, i) => { const a = i * 0.45; return [-9 + Math.cos(a) * 2, 1 + i * 0.45, 22 + Math.sin(a) * 2, 1, 1, 1, -a]; }));
  const moon = kit.mesh(group, new THREE.SphereGeometry(9, 40, 24), new THREE.MeshStandardMaterial({ color: "#e6d8ff", emissive: "#b8a0ff", emissiveIntensity: 0.6, roughness: 1 }), [-30, 34, 110]);
  kit.mesh(group, new THREE.RingGeometry(12, 17, 64), new THREE.MeshBasicMaterial({ color: "#ffd8f0", transparent: true, opacity: 0.45, side: THREE.DoubleSide, fog: false }), [-30, 34, 110], [1.2, 0.3, 0]);

  const bubbles = kit.particles(group, { count: 140, min: [-10, 0, 5], max: [10, 9, 30], size: 0.5, color: "#ffffff", opacity: 0.35, mode: "rise", speed: 0.35, wander: 0.8, twinkle: 0.8 });
  const sparkles = kit.particles(group, { count: 360, min: [-14, 0, 4], max: [14, 14, 40], size: 0.06, color: "#fff2b8", opacity: 0.8, mode: "wander", speed: 0.2, wander: 0.8, twinkle: 2 });

  let lastCount = 0;
  return {
    group, background: "#ffd6ec", fog: ["#ffd9ef", 0.013], tint: "#ffc6f0", exposure: 1.0,
    rig: { hemi: ["#fff0fb", "#9aa6ff", 1.25], key: { color: "#fff2e0", intensity: 2.2, position: [12, 24, 6] }, accent: { color: "#ff9ad5", intensity: 18, position: [0, 3, 9], distance: 18 } },
    update({ time, reduced, pulse, count }) {
      // Each interaction sends the hero island to its next resting place.
      if (count !== lastCount) { heroTarget.copy(heroSpots[count % heroSpots.length]); lastCount = count; }
      const glide = reduced ? 1 : 0.025;
      hero.position.set(lerp(hero.position.x, heroTarget.x, glide), lerp(hero.position.y, heroTarget.y, glide) + (reduced ? 0 : Math.sin(time * 0.8) * 0.004), lerp(hero.position.z, heroTarget.z, glide));
      const lift = envelope(pulse, 4, 0.3);
      hero.rotation.y = time * (reduced ? 0 : 0.08) + lift * 0.6;
      islands.forEach((root, i) => { root.position.y += reduced ? 0 : Math.sin(time * 0.4 + i * 1.7) * 0.003; root.rotation.y = Math.sin(time * 0.05 + i) * 0.3; });
      stones.forEach((stone, i) => { stone.position.y = -0.1 + i * 0.35 + (reduced ? 0 : Math.sin(time * 0.9 + i) * 0.12); });
      drifting.position.x = reduced ? 0 : Math.sin(time * 0.02) * 6;
      moon.rotation.y = time * 0.02;
      fallUniforms.uBoost.value = lift;
      bubbles.uniforms.uBoost.value = lift * 2;
      sparkles.uniforms.uBoost.value = lift;
    },
  };
}
