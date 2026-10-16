import * as THREE from "three";
import { envelope, fbm, type Kit, type World } from "./kit";

// Floor 11: a tropical shore at golden hour. Glittering sea, palms in silhouette, a pier into the sun.
export default function sunset(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;
  const sun = new THREE.Vector3(0.05, 0.07, 1).normalize();
  kit.sky(group, { top: "#28306e", horizon: "#ff9452", bottom: "#ff8a52", sun: { direction: [sun.x, sun.y, sun.z], color: "#ffd690", size: 0.035, halo: 1.8 } });

  // The sea: rolling swell in the vertex shader, sky reflection and a glitter path toward the sun.
  const SHORE = 13;
  const seaUniforms = { uTime: kit.time, uSun: { value: sun }, uWave: { value: -10 } };
  const sea = new THREE.PlaneGeometry(400, 260, kit.mobile ? 120 : 200, kit.mobile ? 80 : 130); sea.rotateX(-Math.PI / 2); sea.translate(0, 0, SHORE + 130);
  kit.mesh(group, sea, new THREE.ShaderMaterial({
    uniforms: seaUniforms, fog: false,
    vertexShader: `uniform float uTime, uWave; varying vec3 vW; varying float vCrest;
      float swell(vec2 p){ return sin(p.y * 0.35 + uTime * 1.1) * 0.12 + sin(p.y * 0.8 + p.x * 0.3 + uTime * 1.7) * 0.05 + sin(p.x * 0.5 - uTime * 0.9) * 0.04; }
      void main(){ vec3 p = position; float big = uWave > 0.0 ? exp(-pow(p.z - (${SHORE.toFixed(1)} + 34.0 - uWave * 9.0), 2.0) * 0.08) * smoothstep(9.0, 0.0, uWave) * 0.9 : 0.0;
        float fade = smoothstep(${SHORE.toFixed(1)}, ${SHORE.toFixed(1)} + 6.0, p.z) * 0.8 + 0.2;
        p.y += swell(p.xz) * fade + big; vCrest = big;
        vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun; varying vec3 vW; varying float vCrest;
      void main(){ vec3 view = normalize(cameraPosition - vW);
        vec2 q = vW.xz; float r = sin(q.x * 3.1 + uTime * 2.0) * sin(q.y * 2.3 - uTime * 1.6) + sin(q.x * 7.3 - q.y * 5.1 + uTime * 3.0) * 0.5;
        vec3 n = normalize(vec3(r * 0.06, 1.0, r * 0.08));
        float fres = pow(1.0 - max(dot(n, view), 0.0), 4.0);
        vec3 deep = vec3(0.12, 0.1, 0.28), sky = vec3(1.0, 0.55, 0.35);
        float glitter = pow(max(dot(reflect(-uSun, n), view), 0.0), 160.0) * 6.0 + pow(max(dot(reflect(-uSun, n), view), 0.0), 18.0) * 0.6;
        vec3 col = mix(deep, sky, 0.35 + fres * 0.65) + vec3(1.0, 0.8, 0.5) * glitter + vCrest * vec3(0.9, 0.85, 0.8);
        float haze = smoothstep(40.0, 200.0, length(vW.xz)); col = mix(col, vec3(1.0, 0.62, 0.42), haze);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));

  // Sand slopes gently into the water; a darker wet band at the waterline.
  const sandMap = kit.canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#d9a679"; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(${random() > 0.5 ? "255,240,210" : "120,80,50"},${random() * 0.18})`; ctx.fillRect(random() * 256, random() * 256, 1.5, 1.5); }
  });
  sandMap.wrapS = sandMap.wrapT = THREE.RepeatWrapping; sandMap.repeat.set(16, 12);
  kit.ground(group, new THREE.MeshStandardMaterial({ map: sandMap, color: "#e8b48a", roughness: 0.95 }), [120, 40], [0, 6], kit.mobile ? 50 : 80, (x, z) => 0.05 + fbm(x * 0.1, z * 0.1) * 0.25 - Math.max(0, z - 9) * 0.16 + Math.max(0, Math.abs(x) - 12) * 0.05);
  const foamUniforms = { uTime: kit.time, uBoost: { value: 0 } };
  const foam = new THREE.PlaneGeometry(140, 3, 1, 1); foam.rotateX(-Math.PI / 2);
  kit.mesh(group, foam, new THREE.ShaderMaterial({
    uniforms: foamUniforms, transparent: true, depthWrite: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uTime, uBoost; varying vec2 vUv;
      void main(){ float edge = 0.5 + 0.3 * sin(uTime * 0.7) + 0.08 * sin(vUv.x * 300.0 + uTime) + uBoost * 0.3;
        float lace = smoothstep(edge - 0.08, edge, vUv.y) * smoothstep(edge + 0.25, edge, vUv.y);
        float bubbles = 0.6 + 0.4 * sin(vUv.x * 900.0) * sin(vUv.y * 60.0 + uTime * 2.0);
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.9), lace * bubbles * (0.7 + uBoost * 0.3)); }`,
  }), [0, 0.02, SHORE - 0.6]);

  // Palms: curved trunks with drooping fronds, silhouetted against the sun.
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#4a3326", roughness: 0.9 });
  const frondMaterial = new THREE.MeshStandardMaterial({ color: "#2f4a26", roughness: 0.8, side: THREE.DoubleSide });
  const frondGeometry = new THREE.PlaneGeometry(0.5, 3.2, 1, 10); frondGeometry.translate(0, 1.6, 0);
  const fp = frondGeometry.attributes.position;
  for (let i = 0; i < fp.count; i++) { const y = fp.getY(i); fp.setX(i, fp.getX(i) * Math.sin((y / 3.2) * Math.PI) * 1.4); fp.setZ(i, -Math.pow(y / 3.2, 2) * 1.6); }
  frondGeometry.computeVertexNormals();
  const crowns: THREE.Group[] = [];
  for (const [x, z, h, lean] of [[-5.5, 5, 6.5, 0.6], [-8, 9, 8, 0.4], [6.5, 6, 7, -0.5], [10, 3, 5.5, -0.3], [-13, 4, 7.2, 0.2]] as const) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0, z), new THREE.Vector3(x + lean * 0.5, h * 0.4, z + 0.3), new THREE.Vector3(x + lean * 1.6, h * 0.8, z + 0.6), new THREE.Vector3(x + lean * 2.2, h, z + 0.8)]);
    kit.mesh(group, new THREE.TubeGeometry(curve, 20, 0.18, 7, false), trunkMaterial);
    const top = curve.getPoint(1);
    const crown = new THREE.Group(); crown.position.copy(top); group.add(crown); crowns.push(crown);
    for (let f = 0; f < 9; f++) { const frond = new THREE.Mesh(frondGeometry, frondMaterial); frond.rotation.set(range(0.9, 1.4), (f / 9) * Math.PI * 2, 0, "YXZ"); crown.add(frond); }
    kit.instanced(crown, new THREE.SphereGeometry(0.16, 8, 6), trunkMaterial, [[0.15, -0.2, 0], [-0.1, -0.25, 0.12], [0, -0.22, -0.15]]);
  }

  // A weathered pier walking out into the glitter.
  const wood = new THREE.MeshStandardMaterial({ color: "#6a4a36", roughness: 0.85 });
  kit.instanced(group, new THREE.BoxGeometry(1, 1, 1), wood, Array.from({ length: 50 }, (_, i) => [4, 0.6, 9 + i * 0.6, 2.4, 0.08, 0.45]));
  kit.instanced(group, new THREE.CylinderGeometry(0.1, 0.12, 1, 8), wood, Array.from({ length: 22 }, (_, i) => [4 + (i % 2 ? 1.1 : -1.1), -0.4, 9 + Math.floor(i / 2) * 2.8, 1, 2.4, 1]));
  // Tiki torches along the sand.
  for (const [x, z] of [[-2.6, 6], [2.4, 7.5], [-3.6, 10]] as const) {
    kit.mesh(group, new THREE.CylinderGeometry(0.05, 0.07, 1.8, 8), wood, [x, 0.9, z]);
    kit.mesh(group, new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.4) }), [x, 1.9, z]);
    kit.glow(group, [x, 1.95, z], [1.2, 1.6], "#ff9a40", 0.55);
  }

  // Seabirds gliding across the sun.
  const birdGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 0.1, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0.1, 0)]);
  const birds = Array.from({ length: 7 }, (_, i) => { const bird = new THREE.LineSegments(birdGeometry, new THREE.LineBasicMaterial({ color: "#2a1a2a" })); bird.position.set(range(-30, 30), range(10, 18), range(50, 80)); bird.scale.setScalar(range(0.8, 1.5)); bird.userData.seed = i; group.add(bird); return bird; });

  kit.particles(group, { count: 260, min: [-14, 0.3, 4], max: [14, 6, 30], size: 0.05, color: "#ffe2b0", opacity: 0.55, mode: "wander", speed: 0.15, wander: 0.6, twinkle: 1.4 });

  return {
    group, background: "#ff9a6a", fog: ["#f2a07c", 0.01], tint: "#ffb38a", exposure: 1.1,
    rig: { hemi: ["#ffb48a", "#4a2a4a", 1.0], key: { color: "#ffb070", intensity: 2.6, position: [sun.x * 40, 6, 60] }, accent: { color: "#ff8a3a", intensity: 12, position: [0, 2.2, 7], distance: 12 } },
    update({ time, reduced, pulse }) {
      seaUniforms.uWave.value = Number.isFinite(pulse) && pulse < 9 ? pulse : -10;
      const arrive = envelope(pulse - 3.4, 3, 0.3);
      foamUniforms.uBoost.value = arrive;
      crowns.forEach((crown, i) => { crown.rotation.z = reduced ? 0 : Math.sin(time * 0.9 + i) * 0.05; crown.rotation.x = reduced ? 0 : Math.sin(time * 0.7 + i * 2) * 0.04; });
      birds.forEach((bird) => {
        const s = bird.userData.seed as number;
        bird.position.x = ((time * (1.2 + s * 0.15) + s * 13) % 70) - 35;
        bird.scale.y = 1 + (reduced ? 0 : Math.sin(time * 4 + s) * 0.8);
      });
    },
  };
}
