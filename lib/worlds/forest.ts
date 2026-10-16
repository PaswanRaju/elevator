import * as THREE from "three";
import { envelope, fbm, type Kit, type World } from "./kit";

// Floor 4: an ancient forest clearing under a low moon, mist pooling between the roots.
export default function forest(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;
  kit.sky(group, { top: "#030912", horizon: "#16304a", bottom: "#050a0a", sun: { direction: [-0.25, 0.22, 1], color: "#cfe4ff", size: 0.012, halo: 0.8 } });

  const moss = kit.canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#1d2b1a"; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(${random() > 0.6 ? "90,130,60" : "10,16,8"},${random() * 0.25})`; ctx.fillRect(random() * 256, random() * 256, 2, 3); }
  });
  moss.wrapS = moss.wrapT = THREE.RepeatWrapping; moss.repeat.set(16, 16);
  const height = (x: number, z: number) => fbm(x * 0.08, z * 0.08) * 2.2 - 1 + Math.max(0, Math.abs(x) - 4) * 0.08 - Math.max(0, 1 - Math.hypot(x / 3, (z - 8) / 5)) * 0.4;
  kit.ground(group, new THREE.MeshStandardMaterial({ map: moss, color: "#5f7a58", roughness: 0.95 }), [120, 120], [0, 45], kit.mobile ? 60 : 96, height);
  // A path of flat stones into the clearing.
  const stone = new THREE.MeshStandardMaterial({ color: "#5d6460", roughness: 0.85, flatShading: true });
  kit.instanced(group, new THREE.CylinderGeometry(0.4, 0.45, 0.12, 7), stone, Array.from({ length: 9 }, (_, i) => {
    const z = 3.6 + i * 1.1, x = Math.sin(i * 0.8) * 0.4;
    return [x, height(x, z) + 0.04, z, range(0.8, 1.2), 1, range(0.7, 1.1), random() * 3];
  }));

  // Trees: tapered trunks with dark canopies, leaving a clearing around the path.
  const trunks: number[][] = [], crowns: number[][] = [];
  for (let i = 0; i < (kit.mobile ? 70 : 110); i++) {
    const side = random() > 0.5 ? 1 : -1;
    const x = side * range(2.6, 26), z = range(3, 60);
    if (Math.abs(x) < 5 && z > 10 && z < 18) continue; // the glade itself
    const scale = range(0.7, 1.6), y = height(x, z);
    trunks.push([x, y + 4 * scale, z, scale, scale * 2, scale, random() * 6]);
    for (let c = 0; c < 3; c++) crowns.push([x + range(-1, 1) * scale, y + (7 + c * 1.6) * scale, z + range(-1, 1) * scale, scale * range(1.8, 2.8), scale * range(1.4, 2.2), scale * range(1.8, 2.8), random() * 6]);
  }
  const bark = kit.canvasTexture(64, 256, (ctx) => {
    ctx.fillStyle = "#2b2219"; ctx.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(${random() > 0.5 ? "80,66,50" : "8,6,4"},${random() * 0.5})`; ctx.fillRect(random() * 64, random() * 256, range(1, 3), range(10, 60)); }
  });
  kit.instanced(group, new THREE.CylinderGeometry(0.22, 0.42, 4, 8, 1), new THREE.MeshStandardMaterial({ map: bark, color: "#8a7a68", roughness: 0.9 }), trunks);
  kit.instanced(group, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: "#16301f", roughness: 0.9, flatShading: true }), crowns, ["#16301f", "#1c3a24", "#122818"]);
  // The great tree at the back of the glade, roots lit by mushrooms.
  const elder = new THREE.Group(); elder.position.set(-1.2, height(-1.2, 16), 16); group.add(elder);
  kit.mesh(elder, new THREE.CylinderGeometry(0.9, 1.8, 9, 12), new THREE.MeshStandardMaterial({ map: bark, color: "#9a8a72", roughness: 0.9 }), [0, 4.5, 0]);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    kit.mesh(elder, new THREE.CylinderGeometry(0.12, 0.45, 3, 6), new THREE.MeshStandardMaterial({ map: bark, color: "#8a7a68", roughness: 0.9 }), [Math.cos(angle) * 1.6, 0.4, Math.sin(angle) * 1.6], [Math.sin(angle) * 1.1, 0, -Math.cos(angle) * 1.1]);
  }
  kit.instanced(elder, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: "#1a3a26", roughness: 0.9, flatShading: true }), Array.from({ length: 9 }, () => [range(-4, 4), range(9, 13), range(-3, 3), range(2.5, 4), range(2, 3), range(2.5, 4)]));
  const shroom = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.8, 1.6) });
  const shrooms = kit.instanced(group, new THREE.SphereGeometry(0.09, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), shroom, Array.from({ length: 50 }, () => {
    const angle = random() * Math.PI * 2, r = range(1.6, 3.4), x = -1.2 + Math.cos(angle) * r, z = 16 + Math.sin(angle) * r;
    return [x, height(x, z) + 0.05, z, range(0.6, 1.6), range(0.6, 1.2), range(0.6, 1.6)];
  }));
  void shrooms;
  kit.glow(group, [-1.2, 0.6, 15], [8, 2.5], "#58ffe0", 0.3);
  // Rune stones ring the glade.
  const rune = kit.canvasTexture(64, 128, (ctx) => { ctx.strokeStyle = "#7fffe0"; ctx.lineWidth = 4; ctx.shadowColor = "#7fffe0"; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(32, 20); ctx.lineTo(32, 108); ctx.moveTo(32, 50); ctx.lineTo(14, 32); ctx.moveTo(32, 70); ctx.lineTo(50, 52); ctx.stroke(); });
  const runeMaterial = new THREE.MeshStandardMaterial({ color: "#4b524e", roughness: 0.8, emissiveMap: rune, emissive: "#7fffe0", emissiveIntensity: 0.6, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const angle = -0.4 + (i / 4) * 3.9, x = -1.2 + Math.cos(angle) * 5, z = 13 + Math.sin(angle) * 3.5;
    const monolith = kit.mesh(group, new THREE.BoxGeometry(0.6, range(1.4, 2.2), 0.3), runeMaterial, [x, height(x, z) + 0.8, z]);
    monolith.lookAt(0, monolith.position.y, 3);
  }

  // Moonbeams and drifting mist sheets.
  const beam = kit.canvasTexture(64, 256, (ctx) => { const g = ctx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "rgba(190,215,255,0.5)"); g.addColorStop(1, "rgba(190,215,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256); const h = ctx.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "#000"); h.addColorStop(0.5, "rgba(0,0,0,0)"); h.addColorStop(1, "#000"); ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = h; ctx.fillRect(0, 0, 64, 256); });
  for (let i = 0; i < 6; i++) kit.mesh(group, new THREE.PlaneGeometry(range(1.2, 2.6), 20), new THREE.MeshBasicMaterial({ map: beam, transparent: true, opacity: range(0.1, 0.22), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), [range(-6, 4), 8, range(10, 24)], [0, range(-0.4, 0.4), 0.35]);
  const mistTexture = kit.canvasTexture(256, 128, (ctx) => {
    for (let i = 0; i < 40; i++) { const x = random() * 256, y = 64 + (random() - 0.5) * 40, r = range(20, 60); const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(200,220,235,0.18)"); g.addColorStop(1, "rgba(200,220,235,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128); }
  });
  const mists = Array.from({ length: 7 }, (_, i) => kit.mesh(group, new THREE.PlaneGeometry(24, 4), new THREE.MeshBasicMaterial({ map: mistTexture, transparent: true, opacity: 0.55, depthWrite: false, fog: false }), [range(-4, 4), 0.6 + i * 0.12, 6 + i * 4], [0, Math.PI, 0]));

  const fireflies = kit.particles(group, { count: 320, min: [-9, 0.2, 4.5], max: [9, 4.5, 26], size: 0.09, color: "#d8ff7a", opacity: 0.9, mode: "wander", speed: 0.35, wander: 1.2, twinkle: 2.2 });
  kit.particles(group, { count: 200, min: [-6, 0, 4], max: [6, 6, 20], size: 0.025, color: "#c8d8ff", opacity: 0.35, mode: "fall", speed: 0.05, wander: 0.5 });

  return {
    group, background: "#050b12", fog: ["#0d1c26", 0.045], tint: "#9fe6c8", exposure: 1.3,
    rig: { hemi: ["#5d7fae", "#0c140c", 0.55], key: { color: "#bcd6ff", intensity: 1.5, position: [5, 12, 40] }, accent: { color: "#7affd8", intensity: 26, position: [-1.2, 1.2, 14], distance: 12 } },
    update({ time, reduced, pulse }) {
      const call = envelope(pulse, 7, 0.6);
      fireflies.uniforms.uAttract.value.set(0, 1.9, 6.5, call * 0.85);
      fireflies.uniforms.uBoost.value = call * 1.5;
      runeMaterial.emissiveIntensity = 0.5 + call * 1.5 + Math.sin(time * 0.8) * 0.15;
      if (!reduced) mists.forEach((mist, index) => { mist.position.x = Math.sin(time * 0.05 + index * 1.7) * 3; });
    },
  };
}
