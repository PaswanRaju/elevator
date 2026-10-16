import * as THREE from "three";
import { envelope, type Kit, type World } from "./kit";

// Floor 7: a forgotten library of impossible height. Tall windows, dust in the light, books that float.
export default function library(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;

  const planks = kit.canvasTexture(256, 256, (ctx) => {
    for (let x = 0; x < 256; x += 32) { ctx.fillStyle = `hsl(25, 35%, ${18 + random() * 8}%)`; ctx.fillRect(x, 0, 32, 256); ctx.fillStyle = "#120a06"; ctx.fillRect(x, 0, 1, 256); }
    for (let i = 0; i < 600; i++) { ctx.fillStyle = `rgba(0,0,0,${random() * 0.15})`; ctx.fillRect(random() * 256, random() * 256, 1, range(10, 50)); }
  });
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(4, 10);
  kit.ground(group, new THREE.MeshStandardMaterial({ map: planks, color: "#b08860", roughness: 0.45, metalness: 0.05 }), [20, 40], [0, 18]);
  // A long carpet runner to the lectern.
  kit.mesh(group, new THREE.PlaneGeometry(2.2, 12), new THREE.MeshStandardMaterial({ color: "#5a1416", roughness: 0.95 }), [0, 0.01, 9], [-Math.PI / 2, 0, 0]);

  // Book spines: one large canvas, reused across all shelves with varied offsets.
  const spines = kit.canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#1a0f08"; ctx.fillRect(0, 0, 512, 512);
    for (let shelf = 0; shelf < 8; shelf++) {
      let x = 0; const top = shelf * 64;
      while (x < 512) {
        const w = range(6, 16), h = range(40, 58);
        ctx.fillStyle = `hsl(${[0, 20, 35, 140, 210, 270][Math.floor(random() * 6)]}, ${range(25, 55)}%, ${range(14, 32)}%)`;
        ctx.fillRect(x, top + 62 - h, w - 1, h);
        ctx.fillStyle = "rgba(220,180,90,0.5)"; ctx.fillRect(x + 1, top + 62 - h + 6, w - 3, 2); ctx.fillRect(x + 1, top + 56, w - 3, 2);
        x += w;
      }
      ctx.fillStyle = "#2d1a0c"; ctx.fillRect(0, top + 62, 512, 4);
    }
  });
  spines.wrapS = spines.wrapT = THREE.RepeatWrapping;
  const shelfMaterial = new THREE.MeshStandardMaterial({ map: spines, color: "#e0d0c0", roughness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: "#3a2214", roughness: 0.55, metalness: 0.1 });
  // Three storeys of bookcases on each side, gallery walkways between them, and the far wall.
  const posts: number[][] = [], balusters: number[][] = [], walkways: number[][] = [];
  for (const side of [-1, 1]) {
    for (let level = 0; level < 3; level++) {
      const y = level * 4.6;
      const front = kit.mesh(group, new THREE.PlaneGeometry(24, 4.2), shelfMaterial.clone(), [side * 5.2, y + 2.1, 15], [0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]);
      const map = spines.clone(); map.repeat.set(6, 1.05); map.offset.set(random(), level * 0.33); kit.track(map);
      (front.material as THREE.MeshStandardMaterial).map = map;
      for (let z = 3; z <= 27; z += 3) posts.push([side * 5.1, y + 2.2, z, 0.3, 4.4, 0.25]);
      if (level > 0) {
        walkways.push([side * 4.5, y, 15, 1.4, 0.15, 24], [side * 3.85, y + 1, 15, 0.06, 0.06, 24]);
        for (let z = 3; z <= 27; z += 0.6) balusters.push([side * 3.85, y + 0.5, z]);
      }
    }
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  kit.instanced(group, unit, wood, [...posts, ...walkways]);
  kit.instanced(group, new THREE.CylinderGeometry(0.02, 0.02, 1, 5), wood, balusters);
  // Far wall: shelves around three tall arched windows full of cold daylight.
  const windowLight = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 2, 2.3) });
  for (const x of [-3, 0, 3]) {
    const shape = new THREE.Shape(); shape.moveTo(-0.8, 0); shape.lineTo(0.8, 0); shape.lineTo(0.8, 5); shape.absarc(0, 5, 0.8, 0, Math.PI, false); shape.lineTo(-0.8, 0);
    kit.mesh(group, new THREE.ShapeGeometry(shape, 12), windowLight, [x, 4, 27.9], [0, Math.PI, 0]);
    for (const dx of [-0.27, 0.27]) kit.mesh(group, new THREE.BoxGeometry(0.05, 5.8, 0.05), wood, [x + dx, 6.8, 27.85]);
    for (let y = 5; y < 10; y += 1.2) kit.mesh(group, new THREE.BoxGeometry(1.6, 0.05, 0.05), wood, [x, y, 27.85]);
  }
  kit.mesh(group, new THREE.PlaneGeometry(10.4, 14), new THREE.MeshStandardMaterial({ color: "#24150c", roughness: 0.8 }), [0, 7, 28], [0, Math.PI, 0]);
  // Light shafts slanting down from the windows.
  const shaft = kit.canvasTexture(64, 256, (ctx) => { const g = ctx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "rgba(220,235,255,0.45)"); g.addColorStop(1, "rgba(255,230,190,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256); const h = ctx.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "#000"); h.addColorStop(0.5, "rgba(0,0,0,0)"); h.addColorStop(1, "#000"); ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = h; ctx.fillRect(0, 0, 64, 256); });
  for (const x of [-3, 0, 3]) kit.mesh(group, new THREE.PlaneGeometry(1.8, 16), new THREE.MeshBasicMaterial({ map: shaft, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), [x * 0.8, 5, 20], [-0.75, 0, 0]);
  // Chandeliers: brass rings of candle flames.
  const flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.9, 0.8) });
  for (const z of [8, 17]) {
    const chandelier = new THREE.Group(); chandelier.position.set(0, 7.5, z); group.add(chandelier);
    kit.mesh(chandelier, new THREE.TorusGeometry(1.1, 0.04, 8, 40), new THREE.MeshStandardMaterial({ color: "#b08d4a", metalness: 0.9, roughness: 0.3 }), [0, 0, 0], [Math.PI / 2, 0, 0]);
    kit.mesh(chandelier, new THREE.CylinderGeometry(0.01, 0.01, 6, 4), wood, [0, 3, 0]);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; kit.mesh(chandelier, new THREE.SphereGeometry(0.035, 6, 6), flame, [Math.cos(a) * 1.1, 0.1, Math.sin(a) * 1.1]); }
    kit.glow(chandelier, [0, 0, 0], [5, 3], "#ffc27a", 0.35);
  }

  // Lectern with the forbidden book, open pages glowing.
  const lectern = new THREE.Group(); lectern.position.set(-0.4, 0, 11); group.add(lectern);
  kit.mesh(lectern, new THREE.CylinderGeometry(0.12, 0.3, 1.1, 8), wood, [0, 0.55, 0]);
  kit.mesh(lectern, new THREE.BoxGeometry(0.8, 0.06, 0.6), wood, [0, 1.15, 0], [-0.35, 0, 0]);
  const book = new THREE.Group(); book.position.set(0, 1.22, 0.02); book.rotation.x = -0.35; lectern.add(book);
  const pageTexture = kit.canvasTexture(128, 160, (ctx) => { ctx.fillStyle = "#f2e2bf"; ctx.fillRect(0, 0, 128, 160); ctx.fillStyle = "rgba(80,50,20,0.55)"; for (let y = 16; y < 150; y += 7) ctx.fillRect(12, y, range(70, 104), 2); ctx.strokeStyle = "#a8743a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(64, 70, 26, 0, Math.PI * 2); ctx.stroke(); });
  const pageMaterial = new THREE.MeshBasicMaterial({ map: pageTexture, color: new THREE.Color(1.1, 1.05, 0.95), side: THREE.DoubleSide });
  const leftPage = new THREE.Group(), rightPage = new THREE.Group(); book.add(leftPage, rightPage);
  kit.mesh(leftPage, new THREE.PlaneGeometry(0.32, 0.42), pageMaterial, [0.16, 0, 0], [-Math.PI / 2, 0, 0]);
  kit.mesh(rightPage, new THREE.PlaneGeometry(0.32, 0.42), pageMaterial, [-0.16, 0, 0], [-Math.PI / 2, 0, 0]);
  kit.mesh(book, new THREE.BoxGeometry(0.68, 0.03, 0.45), new THREE.MeshStandardMaterial({ color: "#4a1010", roughness: 0.6 }), [0, -0.02, 0]);
  const bookGlow = kit.glow(lectern, [0, 1.4, 0], [2, 2], "#ffd890", 0.2);

  // Floating books orbit slowly overhead.
  const covers = ["#6b1a1a", "#1a3a5a", "#2a4a1e", "#4a3410", "#3a1a4a"];
  const floating = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.06, 0.44), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 36);
  for (let i = 0; i < 36; i++) floating.setColorAt(i, new THREE.Color(covers[i % covers.length]));
  floating.frustumCulled = false; group.add(floating);
  const orbit = Array.from({ length: 36 }, () => ({ r: range(1.2, 3.6), y: range(2.2, 7), speed: range(0.08, 0.2) * (random() > 0.5 ? 1 : -1), phase: random() * Math.PI * 2, tilt: random() }));
  const dummy = new THREE.Object3D();
  const motes = kit.particles(group, { count: 500, min: [-4, 0.3, 6], max: [4, 9, 26], size: 0.03, color: "#ffe6b8", opacity: 0.55, mode: "wander", speed: 0.1, wander: 0.4, twinkle: 0.8 });
  const sparks = kit.particles(group, { count: 160, min: [-0.9, 1.2, 10.5], max: [0.1, 4.5, 11.5], size: 0.06, color: "#ffd27a", opacity: 0, mode: "rise", speed: 0.8, wander: 0.4 });

  return {
    group, background: "#120a06", fog: ["#1e140c", 0.04], tint: "#ffc890", exposure: 1.2,
    rig: { hemi: ["#d8c4a4", "#2a1a0e", 0.55], key: { color: "#dce8ff", intensity: 1.8, position: [0, 14, 34] }, accent: { color: "#ffbe6a", intensity: 24, position: [-0.4, 3, 10], distance: 12 } },
    update({ time, reduced, pulse }) {
      const open = envelope(pulse, 8, 0.8);
      leftPage.rotation.z = -open * 0.5; rightPage.rotation.z = open * 0.5;
      pageMaterial.color.setRGB(1.1 + open * 2, 1.05 + open * 1.6, 0.95 + open * 0.6);
      (bookGlow.material as THREE.SpriteMaterial).opacity = 0.2 + open * 0.7;
      sparks.uniforms.uOpacity.value = open * 0.9;
      motes.uniforms.uBoost.value = open;
      const pace = reduced ? 0.25 : 1 + open * 2;
      orbit.forEach((book, i) => {
        const angle = book.phase + time * book.speed * pace;
        dummy.position.set(-0.4 + Math.cos(angle) * book.r, book.y + Math.sin(time * 0.5 + i) * 0.15 + open * 0.6, 11 + Math.sin(angle) * book.r);
        dummy.rotation.set(Math.sin(time * 0.3 + i) * 0.4 * book.tilt, -angle, Math.cos(time * 0.4 + i) * 0.3);
        dummy.updateMatrix(); floating.setMatrixAt(i, dummy.matrix);
      });
      floating.instanceMatrix.needsUpdate = true;
    },
  };
}
