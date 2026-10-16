import * as THREE from "three";
import { envelope, type Kit, type World } from "./kit";

// Floor 5: a hidden after-hours arcade. Rows of cabinets, neon tubes, a playable star catcher.
export default function arcade(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;

  // Room shell: dark walls, a glossy floor with a neon inlay grid over the reflector.
  const floorTexture = kit.canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#0b0812"; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#ff3fb0"; ctx.lineWidth = 2; ctx.shadowColor = "#ff3fb0"; ctx.shadowBlur = 6; ctx.strokeRect(1, 1, 254, 254);
    ctx.strokeStyle = "#2ee6ff"; ctx.shadowColor = "#2ee6ff"; ctx.strokeRect(64, 64, 128, 128);
  });
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping; floorTexture.repeat.set(5, 12);
  kit.ground(group, new THREE.MeshStandardMaterial({ map: floorTexture, emissiveMap: floorTexture, emissive: "#ffffff", emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.4, transparent: true, opacity: 0.7, depthWrite: false }), [12, 30], [0, 15]);
  const wall = new THREE.MeshStandardMaterial({ color: "#120e1c", roughness: 0.8 });
  for (const side of [-1, 1]) kit.mesh(group, new THREE.BoxGeometry(0.2, 5, 30), wall, [side * 6, 2.5, 15]);
  kit.mesh(group, new THREE.BoxGeometry(12, 5, 0.2), wall, [0, 2.5, 26]);
  kit.mesh(group, new THREE.BoxGeometry(12, 0.2, 30), wall, [0, 5, 15]);
  // Ceiling neon tubes.
  const tubes = [new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.5, 1.6) }), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 2.6) })];
  for (let z = 4; z < 26; z += 3.2) {
    kit.mesh(group, new THREE.CylinderGeometry(0.035, 0.035, 9, 8), tubes[Math.round(z) % 2], [0, 4.7, z], [0, 0, Math.PI / 2]);
  }
  for (const side of [-1, 1]) kit.mesh(group, new THREE.CylinderGeometry(0.035, 0.035, 22, 8), tubes[side > 0 ? 0 : 1], [side * 5.85, 4.2, 15], [Math.PI / 2, 0, 0]);
  // "ARCADE" neon on the back wall.
  const marquee = kit.sign("SECRET ARCADE", { width: 1024, height: 160, color: "#ff4fc0", font: "700 96px 'Courier New', monospace", glow: 30 });
  const marqueeMaterial = new THREE.MeshBasicMaterial({ map: marquee, transparent: true, toneMapped: false, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6) });
  kit.mesh(group, new THREE.PlaneGeometry(7, 1.1), marqueeMaterial, [0, 3.9, 25.85], [0, Math.PI, 0]);

  // Cabinets: body, angled screen, marquee and control deck. Screens share a few looping textures.
  const screenTextures = [0, 1, 2, 3].map((variant) => kit.canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = "#050510"; ctx.fillRect(0, 0, 128, 128);
    const palette = [["#ffe14d", "#ff4d6d"], ["#4dffb8", "#4d8bff"], ["#ff8a3d", "#c04dff"], ["#ffffff", "#2ee6ff"]][variant];
    for (let i = 0; i < 30; i++) { ctx.fillStyle = palette[i % 2]; const s = range(4, 10); ctx.fillRect(Math.floor(random() * 12) * 10 + 4, Math.floor(random() * 12) * 10 + 4, s, s); }
    ctx.fillStyle = "rgba(0,0,0,0.35)"; for (let y = 0; y < 128; y += 3) ctx.fillRect(0, y, 128, 1);
  }));
  screenTextures.forEach((map) => { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.magFilter = THREE.NearestFilter; });
  const bodyColors = ["#1b1036", "#2a0f1e", "#0f2230", "#251a0a"];
  const screens: THREE.MeshBasicMaterial[] = [];
  function cabinet(x: number, z: number, facing: number, variant: number) {
    const unit = new THREE.Group(); unit.position.set(x, 0, z); unit.rotation.y = facing; group.add(unit);
    const body = new THREE.MeshStandardMaterial({ color: bodyColors[variant], roughness: 0.5, metalness: 0.3 });
    kit.mesh(unit, new THREE.BoxGeometry(0.85, 1.9, 0.8), body, [0, 0.95, 0]);
    kit.mesh(unit, new THREE.BoxGeometry(0.9, 0.12, 0.5), body, [0, 1.05, -0.45], [0.35, 0, 0]);
    const screen = new THREE.MeshBasicMaterial({ map: screenTextures[variant], color: new THREE.Color(1.4, 1.4, 1.4) });
    screens.push(screen);
    kit.mesh(unit, new THREE.PlaneGeometry(0.66, 0.55), screen, [0, 1.5, -0.41], [-0.18, Math.PI, 0]);
    const top = kit.sign(["BLASTER", "NEON RUN", "DRAGON", "PIXEL"][variant], { width: 256, height: 64, color: ["#ffe14d", "#4dffb8", "#ff8a3d", "#2ee6ff"][variant], background: "#0a0a12", font: "700 40px 'Courier New', monospace" });
    kit.mesh(unit, new THREE.PlaneGeometry(0.8, 0.2), new THREE.MeshBasicMaterial({ map: top, color: new THREE.Color(1.5, 1.5, 1.5) }), [0, 1.98, -0.41], [0, Math.PI, 0]);
    kit.glow(unit, [0, 1.5, -0.6], [1.4, 1.2], ["#ffe14d", "#4dffb8", "#ff8a3d", "#2ee6ff"][variant], 0.22);
  }
  for (let i = 0; i < 6; i++) {
    cabinet(4.9, 5 + i * 2.6, -Math.PI / 2, i % 4);
    cabinet(-4.9, 5 + i * 2.6, Math.PI / 2, (i + 2) % 4);
  }

  // The hero cabinet: STAR CATCHER, its screen a live canvas game.
  const hero = new THREE.Group(); hero.position.set(-0.6, 0, 12); hero.rotation.y = Math.PI + 0.12; group.add(hero);
  const heroBody = new THREE.MeshStandardMaterial({ color: "#2b0b40", roughness: 0.4, metalness: 0.4 });
  kit.mesh(hero, new THREE.BoxGeometry(1.4, 2.4, 1), heroBody, [0, 1.2, 0]);
  kit.mesh(hero, new THREE.BoxGeometry(1.5, 0.15, 0.6), heroBody, [0, 1.15, 0.55], [-0.35, 0, 0]);
  for (const x of [-0.72, 0.72]) kit.mesh(hero, new THREE.BoxGeometry(0.03, 2.4, 1.02), tubes[0], [x, 1.2, 0]);
  const game = kit.canvasTexture(256, 320, () => {});
  game.magFilter = THREE.NearestFilter;
  const gameScreen = kit.mesh(hero, new THREE.PlaneGeometry(1.1, 1.0), new THREE.MeshBasicMaterial({ map: game, color: new THREE.Color(1.35, 1.35, 1.35) }), [0, 1.8, 0.51]);
  void gameScreen;
  const heroMarquee = kit.sign("★ STAR CATCHER ★", { width: 512, height: 96, color: "#ffe14d", background: "#14061e", font: "700 52px 'Courier New', monospace", glow: 20 });
  kit.mesh(hero, new THREE.PlaneGeometry(1.35, 0.26), new THREE.MeshBasicMaterial({ map: heroMarquee, color: new THREE.Color(1.6, 1.6, 1.6) }), [0, 2.48, 0.51]);
  for (const [x, color] of [[-0.3, "#ff3b5c"], [0, "#ffe14d"], [0.3, "#2ee6ff"]] as const) kit.mesh(hero, new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.8) }), [x, 1.26, 0.72]);
  kit.glow(hero, [0, 1.8, 0.9], [3, 2.6], "#b04dff", 0.35);
  const burst = kit.particles(group, { count: 140, min: [-1.4, 1.3, 11], max: [0.2, 2.6, 11.6], size: 0.08, color: "#ffe14d", opacity: 0, mode: "wander", speed: 2, wander: 0.6, twinkle: 6 });
  kit.particles(group, { count: 220, min: [-5, 0.2, 4], max: [5, 4.5, 25], size: 0.03, color: "#d6b8ff", opacity: 0.25, mode: "wander", speed: 0.2, wander: 0.4 });

  // Star catcher simulation: stars fall, the paddle chases the nearest, each catch adds 100.
  const stars = Array.from({ length: 7 }, () => ({ x: random() * 220 + 18, y: -random() * 300, speed: range(40, 90) }));
  let paddle = 128, last = 0, flash = 0;
  function drawGame(time: number, score: number, reduced: boolean) {
    const ctx = game.ctx, dt = Math.min(0.1, time - last); last = time;
    ctx.fillStyle = "#06020e"; ctx.fillRect(0, 0, 256, 320);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = "#2a2a55"; ctx.fillRect((i * 53) % 256, (i * 97 + time * 20) % 320, 2, 2); }
    const target = stars.reduce((best, star) => (star.y > best.y && star.y < 300 ? star : best), stars[0]);
    paddle += Math.max(-180 * dt, Math.min(180 * dt, target.x - paddle));
    for (const star of stars) {
      star.y += star.speed * dt * (reduced ? 0.4 : 1);
      if (star.y > 280 && Math.abs(star.x - paddle) < 26) { star.y = -20; star.x = random() * 220 + 18; flash = 0.25; }
      if (star.y > 330) { star.y = -20; star.x = random() * 220 + 18; }
      ctx.fillStyle = "#ffe14d"; ctx.save(); ctx.translate(star.x, star.y); ctx.rotate(time * 2);
      ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 4 : 9; ctx.lineTo(Math.cos((k * Math.PI) / 5) * r, Math.sin((k * Math.PI) / 5) * r); } ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = flash > 0 ? "#ffffff" : "#2ee6ff"; ctx.fillRect(paddle - 24, 292, 48, 8);
    flash = Math.max(0, flash - dt);
    ctx.fillStyle = "#ff4fc0"; ctx.font = "bold 20px 'Courier New', monospace"; ctx.fillText(`SCORE ${String(score).padStart(5, "0")}`, 12, 26);
    ctx.fillStyle = "#4dffb8"; ctx.fillText("HI 13000", 150, 26);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; for (let y = 0; y < 320; y += 3) ctx.fillRect(0, y, 256, 1);
    game.needsUpdate = true;
  }

  return {
    group, background: "#07040c", fog: ["#0c0614", 0.04], tint: "#d38bff", reflect: "#6a4a8a", exposure: 1.1,
    rig: { hemi: ["#7a4ab0", "#120818", 0.5], key: { color: "#ff6ad5", intensity: 0.8, position: [3, 4.5, 4] }, accent: { color: "#2ee6ff", intensity: 30, position: [-0.6, 3.2, 10], distance: 14 } },
    update({ time, reduced, pulse, count }) {
      drawGame(time, count * 100 + Math.floor(time * 3) * 10, reduced);
      const pop = envelope(pulse, 2.2, 0.08);
      burst.uniforms.uOpacity.value = pop;
      burst.uniforms.uBoost.value = pop * 2;
      screenTextures.forEach((map, index) => { map.offset.y = reduced ? 0 : Math.floor(time * (3 + index)) / 12; });
      screens.forEach((screen, index) => screen.color.setScalar(1.2 + Math.sin(time * 9 + index) * 0.08));
      marqueeMaterial.color.setScalar(reduced ? 1.6 : Math.sin(time * 41) > 0.97 ? 0.6 : 1.6 + pop);
    },
  };
}
