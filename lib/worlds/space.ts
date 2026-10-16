import * as THREE from "three";
import { envelope, type Kit, type World } from "./kit";

// Floor 3: the observation deck of an orbital station, a ringed gas giant filling the glass.
export default function space(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;
  const sunDirection = new THREE.Vector3(0.75, 0.35, 0.55).normalize();
  kit.sky(group, { top: "#010208", horizon: "#03040c", sun: { direction: [sunDirection.x, sunDirection.y, sunDirection.z], color: "#fff1d6", size: 0.004, halo: 0.5 } });

  // Deck: grated floor, glowing edge, a frame of window mullions arching overhead.
  const grate = kit.canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = "#2a2e34"; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#14171b"; for (let i = 0; i < 128; i += 8) { ctx.fillRect(i, 0, 3, 128); ctx.fillRect(0, i, 128, 3); }
  });
  grate.wrapS = grate.wrapT = THREE.RepeatWrapping; grate.repeat.set(5, 4);
  const deckMaterial = new THREE.MeshStandardMaterial({ map: grate, color: "#8a919c", metalness: 0.85, roughness: 0.35 });
  kit.mesh(group, new THREE.BoxGeometry(10, 0.12, 8), deckMaterial, [0, -0.06, 5]);
  const edgeLight = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.4, 2.6) });
  kit.mesh(group, new THREE.BoxGeometry(10, 0.03, 0.05), edgeLight, [0, 0.02, 8.98]);
  const frame = new THREE.MeshStandardMaterial({ color: "#1a1e24", metalness: 0.8, roughness: 0.3 });
  const arch = new THREE.TorusGeometry(5.2, 0.09, 8, 60, Math.PI);
  for (const z of [3, 6, 9]) kit.mesh(group, arch, frame, [0, -0.4, z]);
  for (const x of [-4.6, 4.6]) kit.mesh(group, new THREE.BoxGeometry(0.12, 0.12, 6.5), frame, [x, 2.1, 6]);
  kit.mesh(group, new THREE.BoxGeometry(0.12, 0.12, 6.5), frame, [0, 4.8, 6]);
  // Railing with a glass balustrade.
  kit.mesh(group, new THREE.BoxGeometry(10, 0.05, 0.05), frame, [0, 1.05, 8.9]);
  kit.mesh(group, new THREE.PlaneGeometry(10, 1), new THREE.MeshStandardMaterial({ color: "#9cc7ff", transparent: true, opacity: 0.08, metalness: 0.5, roughness: 0.1, depthWrite: false }), [0, 0.52, 8.9]);
  // Console with holographic readouts beside the railing.
  kit.mesh(group, new THREE.BoxGeometry(1.2, 0.9, 0.5), frame, [2.6, 0.45, 8.3]);
  const holo = kit.canvasTexture(256, 128, (ctx) => {
    ctx.strokeStyle = "#62e6ff"; ctx.lineWidth = 2; ctx.strokeRect(4, 4, 248, 120);
    ctx.fillStyle = "#62e6ff"; ctx.font = "14px monospace"; ctx.fillText("ORBIT 41 · KEPLER-XIII", 14, 26); ctx.fillText("ALT 412 KM   v 7.66 KM/S", 14, 48);
    for (let i = 0; i < 20; i++) ctx.fillRect(14 + i * 11, 110 - random() * 40, 7, 40);
  });
  const holoMaterial = new THREE.MeshBasicMaterial({ map: holo, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  kit.mesh(group, new THREE.PlaneGeometry(1.1, 0.55), holoMaterial, [2.6, 1.3, 8.3], [-0.2, Math.PI, 0]);

  // Stars at three depths and a nebula veil.
  kit.particles(group, { count: 2600, min: [-200, -80, 60], max: [200, 160, 230], size: 0.9, color: "#e8f0ff", opacity: 0.9, twinkle: 1.2 });
  kit.particles(group, { count: 400, min: [-120, -40, 60], max: [120, 100, 200], size: 1.8, color: "#ffd9b0", opacity: 0.7, twinkle: 0.6 });
  const nebula = kit.canvasTexture(512, 256, (ctx) => {
    for (let i = 0; i < 70; i++) {
      const x = 256 + (random() - 0.5) * 420, y = 128 + (random() - 0.5) * 140 + (x - 256) * 0.2, r = range(30, 110);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const color = random() > 0.5 ? "140,90,255" : random() > 0.5 ? "255,90,170" : "70,170,255";
      g.addColorStop(0, `rgba(${color},0.12)`); g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
    }
  });
  kit.mesh(group, new THREE.PlaneGeometry(420, 210), new THREE.MeshBasicMaterial({ map: nebula, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.9 }), [30, 40, 210], [0, Math.PI, -0.35]);

  // The planet: banded atmosphere, terminator lighting, a thin blue rim and a scanning line.
  const planetUniforms = { uTime: kit.time, uSun: { value: sunDirection }, uScan: { value: -2 } };
  const planet = kit.mesh(group, new THREE.SphereGeometry(34, 96, 64), new THREE.ShaderMaterial({
    uniforms: planetUniforms, fog: false,
    vertexShader: "varying vec3 vN; varying vec3 vP; varying vec3 vView; void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position / 34.0; vec4 w = modelMatrix * vec4(position,1.0); vView = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `uniform float uTime, uScan; uniform vec3 uSun; varying vec3 vN; varying vec3 vP; varying vec3 vView;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      float noise(vec3 x){ vec3 p = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); float n = p.x + p.y*57.0 + 113.0*p.z;
        return mix(mix(mix(h(n), h(n+1.0), f.x), mix(h(n+57.0), h(n+58.0), f.x), f.y), mix(mix(h(n+113.0), h(n+114.0), f.x), mix(h(n+170.0), h(n+171.0), f.x), f.y), f.z); }
      void main(){
        float lat = vP.y; float swirl = noise(vP * 6.0 + vec3(uTime * 0.02, 0.0, 0.0)) * 0.6 + noise(vP * 18.0) * 0.2;
        float bands = sin(lat * 26.0 + swirl * 3.0) * 0.5 + 0.5;
        vec3 col = mix(vec3(0.62, 0.43, 0.30), vec3(0.93, 0.80, 0.62), bands);
        col = mix(col, vec3(0.75, 0.32, 0.20), smoothstep(0.55, 0.9, noise(vP * 4.0 + 3.0)) * smoothstep(0.3, 0.0, abs(lat + 0.25)));
        float light = smoothstep(-0.15, 0.6, dot(vN, uSun));
        float rim = pow(1.0 - max(dot(vN, vView), 0.0), 3.0);
        col = col * (0.03 + light * 1.1) + vec3(0.35, 0.6, 1.0) * rim * (0.25 + light) ;
        float scan = exp(-pow((lat - uScan) * 40.0, 2.0)); col += vec3(0.3, 0.95, 1.0) * scan * 1.4;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), [-20, 6, 120]);
  planet.rotation.z = 0.35;
  // Rings: a banded strip, shadowed by the planet on the far side.
  const ringTexture = kit.canvasTexture(512, 8, (ctx) => {
    for (let x = 0; x < 512; x++) { const v = 0.4 + Math.sin(x * 0.11) * 0.2 + random() * 0.3; ctx.fillStyle = `rgba(230,205,170,${x < 20 || x > 500 ? 0 : v * (x > 300 && x < 330 ? 0.1 : 1)})`; ctx.fillRect(x, 0, 1, 8); }
  });
  const ringGeometry = new THREE.RingGeometry(44, 78, 128, 1);
  const position = ringGeometry.attributes.position, uv = ringGeometry.attributes.uv;
  for (let i = 0; i < position.count; i++) { const r = Math.hypot(position.getX(i), position.getY(i)); uv.setXY(i, (r - 44) / 34, 0.5); }
  const rings = kit.mesh(group, ringGeometry, new THREE.MeshBasicMaterial({ map: ringTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, color: "#d8c4a4" }), [-20, 6, 120], [-1.25, 0.2, 0.35]);
  const moon = kit.mesh(group, new THREE.SphereGeometry(3, 32, 24), new THREE.MeshStandardMaterial({ color: "#9a9a9a", roughness: 0.9 }), [28, 22, 95]);
  kit.glow(group, [sunDirection.x * 200, sunDirection.y * 200, sunDirection.z * 200], [60, 60], "#fff2d6", 0.6);

  // A small craft drifts past now and then, navigation lights blinking.
  const craft = new THREE.Group(); group.add(craft);
  kit.mesh(craft, new THREE.CylinderGeometry(0.5, 0.7, 4, 12), new THREE.MeshStandardMaterial({ color: "#d6d9de", metalness: 0.7, roughness: 0.3 }), [0, 0, 0], [0, 0, Math.PI / 2]);
  kit.mesh(craft, new THREE.BoxGeometry(1.2, 0.05, 5), new THREE.MeshStandardMaterial({ color: "#1d3b6a", metalness: 0.5, roughness: 0.3 }), [0, 0, 0]);
  const blink = kit.glow(craft, [-2.2, 0, 0], [1.4, 1.4], "#ff4040", 0.8);
  kit.glow(craft, [2.3, 0, 0], [2.4, 1.2], "#9fd8ff", 0.7);

  // Scan HUD: a ring that sweeps outward from the deck toward the planet.
  const scanRing = kit.mesh(group, new THREE.RingGeometry(0.98, 1, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), [-20, 6, 120]);

  return {
    group, background: "#010207", fog: ["#010207", 0.0005], tint: "#bcd7ff", exposure: 1.1, environment: 0.6,
    rig: { hemi: ["#5c6f9c", "#0a0a10", 0.35], key: { color: "#fff0d8", intensity: 2.6, position: [sunDirection.x * 30, sunDirection.y * 30, sunDirection.z * 30] }, accent: { color: "#5fd4ff", intensity: 12, position: [2.6, 1.6, 7.8], distance: 6 } },
    update({ time, reduced, pulse }) {
      planet.rotation.y = time * (reduced ? 0.002 : 0.01);
      rings.rotation.z = time * 0.002;
      moon.position.set(28 + Math.cos(time * 0.02) * 6, 22, 95 + Math.sin(time * 0.02) * 6);
      const scan = envelope(pulse, 5, 0.2);
      planetUniforms.uScan.value = Number.isFinite(pulse) && pulse < 5 ? 1.1 - (pulse / 5) * 2.2 : -2;
      const sweep = Math.min(1, (Number.isFinite(pulse) ? pulse : 9) / 1.4);
      scanRing.scale.setScalar(4 + sweep * 34);
      (scanRing.material as THREE.MeshBasicMaterial).opacity = scan * (1 - sweep * 0.6);
      scanRing.lookAt(0, 1.65, 3);
      holoMaterial.opacity = 0.6 + scan * 0.4 + Math.sin(time * 3) * 0.05;
      const pass = (time % 40) / 40;
      craft.position.set(60 - pass * 120, 9 + Math.sin(pass * 3) * 2, 45);
      craft.rotation.y = 0.15;
      (blink.material as THREE.SpriteMaterial).opacity = Math.sin(time * 4) > 0.7 ? 0.9 : 0.05;
    },
  };
}
