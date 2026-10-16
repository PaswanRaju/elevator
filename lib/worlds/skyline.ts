import * as THREE from "three";
import { envelope, type Kit, type World } from "./kit";

// Floor 12: a rooftop terrace above a city that never sleeps. String lights, glass rail, a long drop.
export default function skyline(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;
  kit.sky(group, { top: "#02040f", horizon: "#22305e", bottom: "#0b1226", sun: { direction: [0.45, 0.32, 1], color: "#dfe8ff", size: 0.012, halo: 0.5 } });
  kit.particles(group, { count: 1200, min: [-200, 40, 80], max: [200, 160, 220], size: 0.6, color: "#e6eeff", opacity: 0.7, twinkle: 1.2 });

  // The deck: warm timber, planters, a fire table and low sofas.
  const planks = kit.canvasTexture(256, 256, (ctx) => {
    for (let y = 0; y < 256; y += 16) { ctx.fillStyle = `hsl(24, 28%, ${18 + random() * 8}%)`; ctx.fillRect(0, y, 256, 15); ctx.fillStyle = "#0a0806"; ctx.fillRect(0, y + 15, 256, 1); }
    for (let i = 0; i < 3000; i++) { ctx.fillStyle = `rgba(0,0,0,${random() * 0.15})`; ctx.fillRect(random() * 256, random() * 256, range(4, 30), 1); }
  });
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(4, 6);
  kit.ground(group, new THREE.MeshStandardMaterial({ map: planks, color: "#9a7a62", roughness: 0.55, metalness: 0.1 }), [14, 11], [0, 5]);
  const concrete = new THREE.MeshStandardMaterial({ color: "#2a2c33", roughness: 0.8 });
  kit.mesh(group, new THREE.BoxGeometry(14.4, 1.2, 11.4), concrete, [0, -0.61, 5]);
  // Glass balustrade with a brushed rail.
  const glass = new THREE.MeshPhysicalMaterial({ color: "#9fc6ff", roughness: 0.05, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
  const steel = new THREE.MeshStandardMaterial({ color: "#c6ccd6", metalness: 0.95, roughness: 0.25 });
  kit.mesh(group, new THREE.PlaneGeometry(14, 1.1), glass, [0, 0.55, 10.4]);
  kit.mesh(group, new THREE.BoxGeometry(14, 0.05, 0.08), steel, [0, 1.12, 10.4]);
  for (const side of [-1, 1]) { kit.mesh(group, new THREE.PlaneGeometry(10.4, 1.1), glass, [side * 7, 0.55, 5.2], [0, Math.PI / 2, 0]); kit.mesh(group, new THREE.BoxGeometry(0.08, 0.05, 10.4), steel, [side * 7, 1.12, 5.2]); }
  const fabric = new THREE.MeshStandardMaterial({ color: "#d8d2c6", roughness: 0.9 });
  kit.instanced(group, new THREE.BoxGeometry(1, 1, 1), fabric, [[-4.6, 0.25, 6.5, 0.9, 0.5, 2.6], [-5, 0.6, 6.5, 0.25, 0.8, 2.6], [4.6, 0.25, 6.5, 0.9, 0.5, 2.6], [5, 0.6, 6.5, 0.25, 0.8, 2.6]]);
  kit.mesh(group, new THREE.CylinderGeometry(0.7, 0.75, 0.45, 32), concrete, [0, 0.22, 6.5]);
  const flame = kit.glow(group, [0, 0.62, 6.5], [1.6, 1.2], "#ff9a40", 0.7);
  kit.particles(group, { count: 60, min: [-0.4, 0.45, 6.1], max: [0.4, 1.2, 6.9], size: 0.08, color: "#ffb860", opacity: 0.8, mode: "rise", speed: 0.6, wander: 0.08 });
  kit.instanced(group, new THREE.BoxGeometry(1, 1, 1), concrete, [[-6.4, 0.35, 2, 0.8, 0.7, 0.8], [6.4, 0.35, 2, 0.8, 0.7, 0.8], [-6.4, 0.35, 9.6, 0.8, 0.7, 0.8], [6.4, 0.35, 9.6, 0.8, 0.7, 0.8]]);
  kit.instanced(group, new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshStandardMaterial({ color: "#2f5a3a", roughness: 0.9, flatShading: true }), [[-6.4, 1.1, 2], [6.4, 1.1, 2], [-6.4, 1.1, 9.6], [6.4, 1.1, 9.6]]);

  // Festoon lights strung across the terrace.
  const bulbs: number[][] = [];
  for (const z of [3, 6, 9]) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-6.6, 3.2, z), new THREE.Vector3(0, 2.2, z + 0.3), new THREE.Vector3(6.6, 3.2, z));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), new THREE.LineBasicMaterial({ color: "#111" })));
    for (let i = 1; i < 18; i++) { const p = curve.getPoint(i / 18); bulbs.push([p.x, p.y - 0.08, p.z]); }
  }
  const bulbMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2) });
  kit.instanced(group, new THREE.SphereGeometry(0.05, 8, 6), bulbMaterial, bulbs);
  for (const z of [3, 6, 9]) kit.glow(group, [0, 2.6, z], [14, 1.6], "#ffcf8a", 0.18);
  for (const x of [-6.6, 6.6]) kit.mesh(group, new THREE.CylinderGeometry(0.04, 0.04, 3.3, 8), steel, [x, 1.65, 6]);

  // The city below: rings of towers, each ring with its own material so the light-up can sweep outward.
  const windowsMap = (tone: string) => kit.canvasTexture(64, 128, (ctx) => {
    ctx.fillStyle = "#0a0d16"; ctx.fillRect(0, 0, 64, 128);
    for (let y = 3; y < 125; y += 6) for (let x = 3; x < 61; x += 6) if (random() > 0.45) { ctx.fillStyle = random() > 0.85 ? "#9fd0ff" : tone; ctx.globalAlpha = 0.4 + random() * 0.6; ctx.fillRect(x, y, 3.5, 3.5); }
    ctx.globalAlpha = 1;
  });
  const tones = ["#ffd9a0", "#ffe8c0", "#ffcf90", "#fff0d8"];
  const rings = [0, 1, 2, 3].map((ring) => {
    const map = windowsMap(tones[ring]);
    const material = new THREE.MeshStandardMaterial({ color: "#1a1f2c", map, emissiveMap: map, emissive: "#ffffff", emissiveIntensity: 0.8, roughness: 0.6, metalness: 0.4 });
    const towers: number[][] = [];
    const inner = 30 + ring * 45, outer = inner + 45;
    for (let i = 0; i < (kit.mobile ? 70 : 120); i++) {
      const angle = range(-1.3, 1.3), radius = range(inner, outer);
      const x = Math.sin(angle) * radius, z = 10 + Math.cos(angle) * radius;
      const h = range(15, 55) * (ring === 0 && Math.abs(x) < 12 ? 0.6 : 1) * (random() > 0.93 ? 1.8 : 1);
      const w = range(4, 9);
      towers.push([x, -70 + h / 2, z, w, h, w * range(0.7, 1.3)]);
    }
    kit.instanced(group, new THREE.BoxGeometry(1, 1, 1), material, towers);
    return material;
  });
  // Street grid glowing far below, and aircraft beacons on the tallest spires.
  const street = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.9, 0.35), fog: true });
  for (let i = -6; i <= 6; i++) { kit.mesh(group, new THREE.PlaneGeometry(0.8, 260), street, [i * 18, -69.8, 130], [-Math.PI / 2, 0, 0]); kit.mesh(group, new THREE.PlaneGeometry(260, 0.8), street, [0, -69.8, 30 + (i + 6) * 18], [-Math.PI / 2, 0, 0]); }
  kit.particles(group, { count: 900, min: [-120, -69.5, 20], max: [120, -69, 240], size: 1.2, color: "#ffcf8a", opacity: 0.6, twinkle: 2 });
  const beacons = [[-30, -10, 70], [22, -2, 95], [-6, 5, 140], [48, -14, 120], [-60, -6, 160]].map(([x, y, z]) => {
    kit.mesh(group, new THREE.CylinderGeometry(0.2, 2.6, y + 70, 6), rings[1], [x, (y - 70) / 2, z]);
    return kit.glow(group, [x, y + 0.5, z], [5, 5], "#ff3030", 0.8);
  });
  const heli = kit.glow(group, [0, 25, 90], [3, 3], "#ffffff", 0.8);

  // Fireworks: three bursts that bloom when the skyline lights up.
  const bursts = ["#ff5fa2", "#7fd8ff", "#ffd36a"].map((color, i) => {
    const burst = kit.particles(group, { count: 180, min: [-6, -6, -6], max: [6, 6, 6], size: 0.9, color, opacity: 0, mode: "wander", speed: 0.6, wander: 0.4, twinkle: 4 });
    burst.position.set((i - 1) * 28, 28 + i * 6, 110 + i * 15);
    return burst;
  });

  return {
    group, background: "#050916", fog: ["#0e1630", 0.0055], tint: "#ffd2a0", exposure: 1.15,
    rig: { hemi: ["#5a6aa8", "#120c08", 0.55], key: { color: "#cdd8ff", intensity: 0.9, position: [18, 30, 60] }, accent: { color: "#ffb35c", intensity: 16, position: [0, 2.6, 6], distance: 12 } },
    update({ time, reduced, pulse }) {
      rings.forEach((material, ring) => { material.emissiveIntensity = 0.8 + envelope(pulse - ring * 0.45, 4, 0.3) * 2.6; });
      beacons.forEach((beacon, i) => { (beacon.material as THREE.SpriteMaterial).opacity = Math.sin(time * 2.2 + i * 1.3) > 0.6 ? 0.9 : 0.1; });
      heli.position.set(Math.sin(time * 0.06) * 80, 25 + Math.sin(time * 0.3) * 2, 90 + Math.cos(time * 0.06) * 30);
      (heli.material as THREE.SpriteMaterial).opacity = Math.sin(time * 6) > 0.7 ? 0.9 : 0.25;
      (flame.material as THREE.SpriteMaterial).opacity = 0.6 + (reduced ? 0 : Math.sin(time * 9) * 0.06 + Math.sin(time * 23) * 0.04);
      bulbMaterial.color.setRGB(3 + envelope(pulse, 2, 0.1) * 2, 2.2, 1.2);
      bursts.forEach((burst, i) => {
        const t = Number.isFinite(pulse) ? pulse - 0.8 - i * 0.6 : -1;
        const bloom = t > 0 && t < 3 ? t / 3 : 0;
        burst.scale.setScalar(0.1 + Math.sqrt(bloom) * 1.6);
        burst.uniforms.uOpacity.value = bloom > 0 ? (1 - bloom) * 0.95 : 0;
      });
    },
  };
}
