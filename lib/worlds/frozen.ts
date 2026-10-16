import * as THREE from "three";
import { envelope, fbm, type Kit, type World } from "./kit";

// Floor 8: a frozen lake under the aurora, a lone timber cabin glowing at the treeline.
export default function frozen(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;
  kit.sky(group, { top: "#020617", horizon: "#123052", bottom: "#0a1626", sun: { direction: [-0.4, 0.5, 1], color: "#cfe6ff", size: 0.006, halo: 0.35 } });
  kit.particles(group, { count: 1800, min: [-160, 30, 60], max: [160, 140, 200], size: 0.7, color: "#eaf3ff", opacity: 0.85, twinkle: 1.4 });

  // Aurora: three curtains of light, folded and animated in the vertex shader.
  const auroraUniforms = { uTime: kit.time, uBoost: { value: 0 } };
  const auroraMaterial = new THREE.ShaderMaterial({
    uniforms: auroraUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `uniform float uTime; varying vec2 vUv; varying float vFold;
      void main(){ vUv = uv; vec3 p = position;
        float fold = sin(p.x * 0.05 + uTime * 0.12) * 9.0 + sin(p.x * 0.13 - uTime * 0.2) * 3.0;
        p.z += fold; vFold = fold;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uTime, uBoost; varying vec2 vUv; varying float vFold;
      void main(){
        float rays = 0.55 + 0.45 * sin(vUv.x * 160.0 + uTime * 0.6 + sin(vUv.x * 30.0) * 2.0);
        float base = smoothstep(0.0, 0.12, vUv.y) * pow(1.0 - vUv.y, 1.6);
        vec3 green = vec3(0.15, 1.0, 0.55), violet = vec3(0.65, 0.25, 1.0);
        vec3 col = mix(green, violet, smoothstep(0.25, 0.95, vUv.y));
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        float a = base * rays * edge * (0.55 + 0.25 * sin(vFold * 0.3 + uTime * 0.4)) * (1.0 + uBoost * 1.4);
        gl_FragColor = vec4(col * a * 1.6, a);
      }`,
  });
  for (const [z, y, tilt, width] of [[70, 20, 0.12, 170], [95, 28, -0.08, 210], [120, 36, 0.05, 240]] as const) {
    kit.mesh(group, new THREE.PlaneGeometry(width, 34, 160, 1), auroraMaterial, [range(-10, 10), y, z], [0, tilt, 0]);
  }

  // Frozen lake over the shared reflector, so the aurora and cabin lights mirror in the ice.
  const ice = kit.canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#9fbad6"; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      ctx.beginPath(); let x = random() * 512, y = random() * 512; ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += range(-50, 50); y += range(-50, 50); ctx.lineTo(x, y); }
      ctx.stroke();
    }
    for (let i = 0; i < 5000; i++) { ctx.fillStyle = `rgba(255,255,255,${random() * 0.12})`; ctx.fillRect(random() * 512, random() * 512, 2, 2); }
  });
  ice.wrapS = ice.wrapT = THREE.RepeatWrapping; ice.repeat.set(4, 6);
  kit.ground(group, new THREE.MeshStandardMaterial({ map: ice, color: "#a8c4e4", roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.5, depthWrite: false }), [26, 40], [0, 20]);

  // Snowfields rise around the lake, with drifts shaped by noise.
  const snow = new THREE.MeshStandardMaterial({ color: "#e8f0ff", roughness: 0.85 });
  kit.ground(group, snow, [180, 160], [0, 60], kit.mobile ? 70 : 110, (x, z) => {
    const lake = Math.max(Math.abs(x) / 13, Math.abs(z - 20) / 20);
    return lake < 1 ? -0.4 : Math.min(6, (lake - 1) * 3) + fbm(x * 0.08, z * 0.08) * 1.6 - 0.4;
  });
  // A short boardwalk from the doors onto the ice.
  const timber = new THREE.MeshStandardMaterial({ color: "#5a4030", roughness: 0.8 });
  kit.instanced(group, new THREE.BoxGeometry(1, 1, 1), timber, Array.from({ length: 12 }, (_, i) => [0, 0.05, 0.6 + i * 0.5, 2.2, 0.08, 0.38]));

  // Mountains: faceted peaks with snow caps, layered into the haze.
  const rock = new THREE.MeshStandardMaterial({ color: "#3d4a63", roughness: 0.9, flatShading: true });
  const cap = new THREE.MeshStandardMaterial({ color: "#f2f6ff", roughness: 0.7, flatShading: true });
  const peaks = Array.from({ length: 14 }, (_, i) => { const h = range(18, 40); return [(i - 6.5) * 18 + range(-6, 6), h / 2 - 2, range(70, 110), range(14, 22), h, range(14, 22), random() * 3]; });
  kit.instanced(group, new THREE.ConeGeometry(1, 1, 6), rock, peaks);
  kit.instanced(group, new THREE.ConeGeometry(1, 1, 6), cap, peaks.map(([x, y, z, sx, h, sz, r]) => [x, y + h * 0.32, z, sx * 0.38, h * 0.36, sz * 0.38, r]));

  // Snow-laden pines along both shores.
  const pines: number[][] = [], trunks: number[][] = [];
  for (let i = 0; i < 70; i++) {
    const side = random() > 0.5 ? 1 : -1, x = side * range(13.5, 30), z = range(4, 46), s = range(0.8, 1.6);
    trunks.push([x, 0.6 * s, z, 0.25 * s, 1.2 * s, 0.25 * s]);
    for (let tier = 0; tier < 3; tier++) pines.push([x, (1.4 + tier * 1.1) * s, z, (1.5 - tier * 0.4) * s, 1.8 * s, (1.5 - tier * 0.4) * s, random() * 3]);
  }
  kit.instanced(group, new THREE.CylinderGeometry(1, 1, 1, 6), timber, trunks);
  kit.instanced(group, new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), pines, ["#1d3a35", "#dfe9f5", "#24453f", "#eef4fb"]);

  // The cabin: log walls, steep roof, warm windows and a chimney.
  const cabin = new THREE.Group(); cabin.position.set(-9, 0, 17); cabin.rotation.y = 0.5; group.add(cabin);
  kit.mesh(cabin, new THREE.BoxGeometry(4.2, 2.6, 3.4), new THREE.MeshStandardMaterial({ color: "#4a3022", roughness: 0.85 }), [0, 1.3, 0]);
  const roof = kit.mesh(cabin, new THREE.ConeGeometry(3.4, 2.2, 4), cap, [0, 3.7, 0]); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.85);
  kit.mesh(cabin, new THREE.BoxGeometry(0.5, 1.6, 0.5), rock, [1.1, 4.2, 0.4]);
  const windowMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.5, 0.6) });
  for (const x of [-1.1, 1.1]) kit.mesh(cabin, new THREE.PlaneGeometry(0.8, 0.9), windowMaterial, [x, 1.5, -1.71], [0, Math.PI, 0]);
  kit.mesh(cabin, new THREE.PlaneGeometry(0.9, 1.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.8, 0.35) }), [2.11, 0.85, 0], [0, Math.PI / 2, 0]);
  const cabinGlow = kit.glow(group, [-8.2, 1.5, 15.6], [7, 4], "#ffb766", 0.35);
  const smoke = kit.particles(group, { count: 120, min: [-8.6, 4.8, 17.2], max: [-7.8, 11, 18], size: 0.9, color: "#9aa6bb", opacity: 0.08, mode: "rise", speed: 0.6, wander: 0.6, additive: false });

  // Ice crystals catching the light at the lake edge.
  kit.instanced(group, new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshPhysicalMaterial({ color: "#bfe6ff", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.75, emissive: "#3a7fbf", emissiveIntensity: 0.35 }),
    Array.from({ length: 22 }, () => { const side = random() > 0.5 ? 1 : -1; return [side * range(6, 12.5), range(0.2, 0.8), range(5, 32), range(0.3, 0.8), range(1, 3.2), range(0.3, 0.8), random() * 3, range(-0.3, 0.3)]; }));

  const flakes = kit.particles(group, { count: 1400, min: [-14, 0, 3.5], max: [14, 12, 36], size: 0.06, color: "#ffffff", opacity: 0.8, mode: "fall", speed: 0.7, wander: 0.5, additive: false });
  const glints = kit.particles(group, { count: 300, min: [-12, 0.02, 4], max: [12, 0.1, 36], size: 0.05, color: "#dff2ff", opacity: 0.6, twinkle: 3 });

  return {
    group, background: "#050b18", fog: ["#0c1a30", 0.016], tint: "#9fe8ff", reflect: "#7d9cc4", exposure: 1.15,
    rig: { hemi: ["#8fb8ff", "#1a2238", 0.85], key: { color: "#bcd8ff", intensity: 1.4, position: [-12, 22, 30] }, accent: { color: "#ffaa55", intensity: 20, position: [-7.5, 2.2, 14.5], distance: 14 } },
    update({ time, reduced, pulse }) {
      const warm = envelope(pulse, 7, 0.5);
      auroraUniforms.uBoost.value = warm * 0.8 + (reduced ? 0 : Math.sin(time * 0.25) * 0.15);
      windowMaterial.color.setRGB(2.6 + warm * 3, 1.5 + warm * 1.6, 0.6 + warm * 0.4);
      (cabinGlow.material as THREE.SpriteMaterial).opacity = 0.35 + warm * 0.5 + Math.sin(time * 6) * 0.02;
      smoke.uniforms.uOpacity.value = 0.08 + warm * 0.1;
      flakes.uniforms.uSpeed.value = reduced ? 0.2 : 0.7;
      glints.uniforms.uBoost.value = warm;
    },
  };
}
