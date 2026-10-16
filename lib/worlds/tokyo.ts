import * as THREE from "three";
import { envelope, type Kit, type World } from "./kit";

// Floor 1: a rain-soaked Shinjuku side street at 2am, an elevated line crossing overhead.
export default function tokyo(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;
  kit.sky(group, { top: "#04050c", horizon: "#2a1030", bottom: "#05060c" });

  // Wet asphalt sits over the shared planar reflector, so neon really reflects.
  const asphalt = kit.canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#3a3c44"; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(${random() > 0.5 ? "255,255,255" : "0,0,0"},${random() * 0.08})`; ctx.fillRect(random() * 256, random() * 256, 1.5, 1.5); }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.repeat.set(6, 20);
  kit.ground(group, new THREE.MeshStandardMaterial({ map: asphalt, color: "#5d6070", roughness: 0.32, metalness: 0.4, transparent: true, opacity: 0.62, depthWrite: false }), [16, 80], [0, 38]);
  const paint = new THREE.MeshBasicMaterial({ color: "#d8d6c8" });
  for (let z = 5; z < 60; z += 4) kit.mesh(group, new THREE.PlaneGeometry(0.14, 1.6), paint, [0, 0.012, z], [-Math.PI / 2, 0, 0]);
  const curb = new THREE.MeshStandardMaterial({ color: "#2a2b30", roughness: 0.7 });
  for (const side of [-1, 1]) kit.mesh(group, new THREE.BoxGeometry(1.4, 0.16, 80), curb, [side * 4.3, 0.08, 38]);

  // Facades: lit windows baked into an emissive map, three variants.
  const facades = [0, 1, 2].map((variant) => kit.canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = ["#14141c", "#1a1620", "#121820"][variant]; ctx.fillRect(0, 0, 128, 256);
    for (let y = 6; y < 250; y += 12) for (let x = 6; x < 122; x += 14) {
      const lit = random();
      ctx.fillStyle = lit > 0.62 ? (lit > 0.9 ? "#ffd9a0" : lit > 0.8 ? "#9fd8ff" : "#ffb0d0") : "#07080c";
      ctx.globalAlpha = lit > 0.62 ? 0.5 + random() * 0.5 : 1; ctx.fillRect(x, y, 9, 7);
    }
    ctx.globalAlpha = 1;
  }));
  const buildingMaterials = facades.map((map) => new THREE.MeshStandardMaterial({ color: "#3a3d48", map, emissiveMap: map, emissive: "#ffffff", emissiveIntensity: 0.9, roughness: 0.6, metalness: 0.3 }));
  const box = new THREE.BoxGeometry(1, 1, 1);
  const lots: number[][][] = [[], [], []];
  for (const side of [-1, 1]) {
    let z = 4;
    while (z < 70) {
      const depth = range(4, 7), height = range(8, 26), width = range(5, 8);
      lots[Math.floor(random() * 3)].push([side * (5 + width / 2), height / 2, z + depth / 2, width, height, depth]);
      z += depth + 0.3;
    }
  }
  lots.forEach((transforms, index) => kit.instanced(group, box, buildingMaterials[index], transforms));
  // Distant towers close the street.
  kit.instanced(group, box, buildingMaterials[1], Array.from({ length: 9 }, (_, i) => [(i - 4) * 9 + range(-2, 2), 20, 85 + range(0, 10), 7, range(30, 60), 7]));

  // Neon: vertical blade signs perpendicular to the street, horizontal signs facing it.
  const neonColors = ["#ff3d8b", "#33e1ff", "#ffb547", "#a46bff", "#ff5b4a", "#4dff9d"];
  const blades = ["ラーメン", "居酒屋", "カラオケ", "喫茶", "ホテル", "東京", "夜明け", "寿司"];
  const flicker: { material: THREE.MeshBasicMaterial; base: number; seed: number }[] = [];
  const edge = new THREE.MeshStandardMaterial({ color: "#16161c", metalness: 0.6, roughness: 0.4 });
  blades.forEach((text, index) => {
    const side = index % 2 ? -1 : 1;
    const color = neonColors[index % neonColors.length];
    const map = kit.sign(text, { width: 128, height: 128 * [...text].length, color, vertical: true, background: "#08060c", glow: 22 });
    const material = new THREE.MeshBasicMaterial({ map, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) });
    const height = 0.9 * [...text].length;
    const z = 6 + index * 4.2;
    // A blade projecting from the facade: its broad faces look up and down the street.
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.95, height, 0.12), [edge, edge, edge, edge, material, material]);
    sign.position.set(side * 4.55, 4 + height / 2 + random() * 3, z); group.add(sign);
    kit.glow(group, [side * 4.55, sign.position.y, z - 0.3], [2.6, height * 1.5], color, 0.35);
    flicker.push({ material, base: 1.6, seed: random() * 100 });
  });
  for (const [text, x, y, z, color] of [["24H", 4.2, 3.2, 11, "#33e1ff"], ["OPEN", -4.2, 2.8, 15, "#ff3d8b"], ["新宿", -4.3, 3.6, 24, "#ffb547"], ["BAR", 4.25, 2.6, 27, "#a46bff"]] as const) {
    const map = kit.sign(text, { width: 512, height: 160, color, glow: 30 });
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8), depthWrite: false });
    kit.mesh(group, new THREE.PlaneGeometry(2.4, 0.75), material, [x, y, z], [0, x > 0 ? -Math.PI / 2 + 0.25 : Math.PI / 2 - 0.25, 0]);
    flicker.push({ material, base: 1.8, seed: random() * 100 });
  }
  // Paper lanterns and a glowing vending machine at street level.
  const lantern = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.5, 0.35) });
  kit.instanced(group, new THREE.SphereGeometry(0.22, 12, 8), lantern, Array.from({ length: 10 }, (_, i) => [4.05, 2.6, 5 + i * 0.6, 1, 1.35, 1]));
  kit.glow(group, [4, 2.6, 7.7], [3, 1.5], "#ff6a4a", 0.35);
  const vending = kit.canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = "#e9f4ff"; ctx.fillRect(0, 0, 128, 256);
    for (let y = 20; y < 150; y += 30) for (let x = 10; x < 118; x += 22) { ctx.fillStyle = neonColors[Math.floor(random() * 6)]; ctx.fillRect(x, y, 14, 22); }
    ctx.fillStyle = "#1a2a40"; ctx.fillRect(10, 170, 108, 70);
  });
  kit.mesh(group, new THREE.BoxGeometry(0.9, 1.9, 0.8), new THREE.MeshStandardMaterial({ color: "#cfd8e8", emissiveMap: vending, emissive: "#ffffff", emissiveIntensity: 1.1, map: vending }), [-3.9, 0.95, 6.2], [0, Math.PI / 2, 0]);
  kit.glow(group, [-3.5, 1, 6.2], [2.5, 3], "#bfe6ff", 0.3);

  // Overhead cables and the elevated railway.
  const cable = new THREE.LineBasicMaterial({ color: "#05060a" });
  for (let i = 0; i < 7; i++) {
    const z = 5 + i * 5, sag = range(0.3, 0.7), y = range(5.5, 7.5);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-5, y, z), new THREE.Vector3(0, y - sag, z + range(-1, 1)), new THREE.Vector3(5, y, z + range(-1, 1)));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(16)), cable));
  }
  const steel = new THREE.MeshStandardMaterial({ color: "#1c1f26", metalness: 0.7, roughness: 0.45 });
  kit.mesh(group, new THREE.BoxGeometry(80, 0.9, 3.2), steel, [0, 7.4, 34]);
  kit.mesh(group, new THREE.BoxGeometry(80, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2) }), [0, 6.9, 32.35]);
  for (const x of [-12, -4, 4, 12]) kit.mesh(group, new THREE.BoxGeometry(0.8, 7.4, 0.8), steel, [x, 3.7, 34]);
  const train = new THREE.Group(); group.add(train);
  const carMaterial = new THREE.MeshStandardMaterial({ color: "#c9ced8", metalness: 0.8, roughness: 0.3 });
  const windowStrip = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.7) });
  for (let i = 0; i < 6; i++) {
    kit.mesh(train, new THREE.BoxGeometry(5.6, 1.9, 2.6), carMaterial, [i * 5.9, 8.9, 34]);
    kit.mesh(train, new THREE.BoxGeometry(5.2, 0.55, 0.02), windowStrip, [i * 5.9, 9.1, 32.69]);
    kit.mesh(train, new THREE.BoxGeometry(5.6, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.8, 0.6) }), [i * 5.9, 8.3, 32.69]);
  }
  const trainGlow = kit.glow(train, [15, 9, 32], [36, 4], "#ffeccc", 0.18);

  // Rain streaks, splash mist and steam from a grate.
  const rain = kit.particles(group, { count: 1800, min: [-7, 0, 3.5], max: [7, 12, 34], size: 0.05, color: "#a9c4ea", opacity: 0.42, mode: "fall", speed: 11, streak: 1 });
  kit.particles(group, { count: 260, min: [-4, 0.02, 4], max: [4, 0.25, 30], size: 0.05, color: "#cfdfff", opacity: 0.25, twinkle: 6 });
  kit.particles(group, { count: 90, min: [1.5, 0, 9], max: [2.5, 3, 10], size: 0.55, color: "#7c7f96", opacity: 0.08, mode: "rise", speed: 0.5, wander: 0.3, additive: false });

  let trainStart = -100;
  let lastPulse = Infinity;
  return {
    group, background: "#06060d", fog: ["#0d0a18", 0.03], tint: "#ff8fc2", reflect: "#666a86",
    rig: { hemi: ["#5a5aa0", "#120a14", 0.45], key: { color: "#ff4f9a", intensity: 1.1, position: [6, 9, 14] }, accent: { color: "#3ad8ff", intensity: 55, position: [-2.5, 4, 9], distance: 26 } },
    update({ time, reduced, pulse }) {
      // A train passes every 18 seconds, or right away when the visitor chases it.
      if (pulse < lastPulse) trainStart = time;
      lastPulse = pulse;
      if (time - trainStart > 18) trainStart = time + 4;
      const run = time - trainStart;
      train.position.x = run >= 0 && run < 7 ? 52 - run * 15 : 90;
      (trainGlow.material as THREE.SpriteMaterial).opacity = run >= 0 && run < 7 ? 0.22 : 0;
      for (const sign of flicker) {
        const stutter = reduced ? 1 : Math.sin(time * 37 + sign.seed) > 0.985 ? 0.25 : 1;
        sign.material.color.setScalar(sign.base * stutter * (1 + envelope(pulse, 3) * 0.4));
      }
      rain.uniforms.uSpeed.value = reduced ? 3 : 11;
    },
  };
}
