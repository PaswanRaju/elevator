import * as THREE from "three";
import { envelope, fbm, type Kit, type World } from "./kit";

// Floor 6: a Kyoto temple garden at golden hour: raked gravel, koi pond, torii, falling blossom.
export default function garden(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;
  const sun = new THREE.Vector3(0.55, 0.16, 1).normalize();
  kit.sky(group, { top: "#6f98c8", horizon: "#f7cf9c", bottom: "#c9a27a", sun: { direction: [sun.x, sun.y, sun.z], color: "#fff0c8", size: 0.01, halo: 1.2 } });

  // Raked gravel: concentric and parallel lines baked into a canvas.
  const gravel = kit.canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#cfc6b4"; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14000; i++) { ctx.fillStyle = `rgba(${random() > 0.5 ? "255,255,250" : "90,80,70"},${random() * 0.25})`; ctx.fillRect(random() * 512, random() * 512, 2, 2); }
    ctx.strokeStyle = "rgba(90,80,64,0.35)"; ctx.lineWidth = 3;
    for (let y = 6; y < 512; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  });
  gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping; gravel.repeat.set(10, 10);
  kit.ground(group, new THREE.MeshStandardMaterial({ map: gravel, color: "#e8dcc6", roughness: 0.95 }), [60, 60], [0, 25]);
  // Moss mounds and a stone border.
  const moss = new THREE.MeshStandardMaterial({ color: "#4f6a2f", roughness: 0.95 });
  kit.instanced(group, new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), moss, [[4.5, 0, 6, 1.6, 0.5, 1.2], [-5.5, 0, 9, 2.2, 0.6, 1.6], [3.8, 0, 14, 1.4, 0.45, 1.1], [-3.4, 0, 18, 1.8, 0.5, 1.3]]);
  const rock = new THREE.MeshStandardMaterial({ color: "#76736b", roughness: 0.9, flatShading: true });
  kit.instanced(group, new THREE.DodecahedronGeometry(0.5, 0), rock, [[4.6, 0.3, 6.2, 1.2, 1.4, 1], [-5.2, 0.3, 9.4, 1.6, 1, 1.2], [-1, 0.15, 7, 0.7, 0.5, 0.6], [2.6, 0.2, 12.4, 1, 0.7, 0.8]]);

  // Koi pond with a rippling water shader; ripples spread from wherever the bell was rung.
  const pondUniforms = { uTime: kit.time, uRipple: { value: -10 }, uSun: { value: sun } };
  const pond = kit.mesh(group, new THREE.CircleGeometry(1, 64), new THREE.ShaderMaterial({
    uniforms: pondUniforms, transparent: true,
    vertexShader: "varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `uniform float uTime, uRipple; uniform vec3 uSun; varying vec2 vUv; varying vec3 vW;
      void main(){ vec2 p = vUv - 0.5; float d = length(p);
        float waves = sin(vW.x * 3.0 + uTime * 0.8) * 0.5 + sin(vW.z * 4.0 - uTime * 0.6) * 0.5;
        float ring = uRipple > 0.0 ? sin((d - uRipple * 0.12) * 90.0) * exp(-abs(d - uRipple * 0.12) * 30.0) * exp(-uRipple * 0.3) : 0.0;
        vec3 view = normalize(cameraPosition - vW); vec3 n = normalize(vec3(waves * 0.05 + ring * 0.5 * p.x, 1.0, waves * 0.05 + ring * 0.5 * p.y));
        float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);
        vec3 deep = vec3(0.07, 0.18, 0.16), sky = vec3(0.98, 0.82, 0.62);
        float spec = pow(max(dot(reflect(-uSun, n), view), 0.0), 120.0);
        vec3 col = mix(deep, sky, 0.25 + fres * 0.6) + spec * vec3(1.0, 0.9, 0.7) * 2.0 + ring * 0.08;
        gl_FragColor = vec4(col, smoothstep(0.5, 0.47, d) * 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), [-0.8, 0.02, 10.5], [-Math.PI / 2, 0, 0]);
  pond.scale.set(4.2, 3, 1);
  kit.instanced(group, new THREE.DodecahedronGeometry(0.3, 0), rock, Array.from({ length: 26 }, (_, i) => { const a = (i / 26) * Math.PI * 2; return [-0.8 + Math.cos(a) * 2.15, 0.08, 10.5 + Math.sin(a) * 1.55, range(0.7, 1.3), 0.5, range(0.7, 1.2), random() * 3]; }));
  // Koi gliding just under the surface.
  const koiGeometry = new THREE.SphereGeometry(0.12, 12, 8); koiGeometry.scale(1, 0.4, 2.6);
  const koi = new THREE.InstancedMesh(koiGeometry, new THREE.MeshStandardMaterial({ roughness: 0.4 }), 7);
  ["#ff6a2a", "#ffffff", "#ffb02a", "#ff4a1a", "#ffffff", "#ff8a3a", "#f6f0e0"].forEach((color, i) => koi.setColorAt(i, new THREE.Color(color)));
  koi.frustumCulled = false; group.add(koi);
  const dummy = new THREE.Object3D();
  // Stepping stones across the pond.
  kit.instanced(group, new THREE.CylinderGeometry(0.32, 0.36, 0.12, 9), rock, [[-0.5, 0.06, 9.2, 1, 1, 0.8], [0.3, 0.06, 10.2, 1, 1, 0.9], [-0.2, 0.06, 11.4, 0.9, 1, 1]]);

  // Torii: two pillars, a curved kasagi and a tie beam, vermilion with black caps.
  const vermilion = new THREE.MeshStandardMaterial({ color: "#c8341f", roughness: 0.55 });
  const blackLacquer = new THREE.MeshStandardMaterial({ color: "#151210", roughness: 0.4 });
  const torii = new THREE.Group(); torii.position.set(-0.8, 0, 17); group.add(torii);
  for (const x of [-1.9, 1.9]) { kit.mesh(torii, new THREE.CylinderGeometry(0.17, 0.2, 4.4, 16), vermilion, [x, 2.2, 0]); kit.mesh(torii, new THREE.CylinderGeometry(0.24, 0.24, 0.3, 16), blackLacquer, [x, 0.15, 0]); }
  kit.mesh(torii, new THREE.BoxGeometry(4.8, 0.28, 0.32), vermilion, [0, 3.55, 0]);
  const kasagi = new THREE.BoxGeometry(6, 0.3, 0.5, 24, 1, 1);
  const kp = kasagi.attributes.position;
  for (let i = 0; i < kp.count; i++) kp.setY(i, kp.getY(i) + Math.pow(kp.getX(i) / 3, 2) * 0.35);
  kasagi.computeVertexNormals();
  kit.mesh(torii, kasagi, blackLacquer, [0, 4.45, 0]);
  kit.mesh(torii, new THREE.BoxGeometry(5.6, 0.22, 0.42), vermilion, [0, 4.2, 0]);
  kit.mesh(torii, new THREE.BoxGeometry(0.25, 0.6, 0.2), blackLacquer, [0, 3.85, 0]);
  // Stone lantern beside the pond, glowing softly.
  const lantern = new THREE.Group(); lantern.position.set(2.5, 0, 9); group.add(lantern);
  const granite = new THREE.MeshStandardMaterial({ color: "#8b877d", roughness: 0.9 });
  kit.mesh(lantern, new THREE.CylinderGeometry(0.35, 0.45, 0.25, 6), granite, [0, 0.12, 0]);
  kit.mesh(lantern, new THREE.CylinderGeometry(0.1, 0.12, 1, 8), granite, [0, 0.75, 0]);
  kit.mesh(lantern, new THREE.CylinderGeometry(0.28, 0.32, 0.12, 6), granite, [0, 1.3, 0]);
  const fireMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.6, 0.6) });
  kit.mesh(lantern, new THREE.BoxGeometry(0.34, 0.3, 0.34), fireMaterial, [0, 1.52, 0]);
  kit.mesh(lantern, new THREE.ConeGeometry(0.55, 0.4, 6), granite, [0, 1.88, 0]);
  kit.mesh(lantern, new THREE.SphereGeometry(0.09, 8, 6), granite, [0, 2.12, 0]);
  const lanternGlow = kit.glow(lantern, [0, 1.52, 0], [1.6, 1.6], "#ffc070", 0.4);

  // Cherry trees: curved trunks, blossom clouds of instanced spheres.
  const bark = new THREE.MeshStandardMaterial({ color: "#3b2a24", roughness: 0.9 });
  const blossomTransforms: number[][] = [];
  for (const [x, z, s] of [[5.5, 11, 1.2], [-6.5, 14, 1.4], [7, 20, 1.1], [-4.5, 24, 1], [3.2, 26, 0.9]] as const) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0, z), new THREE.Vector3(x + 0.3 * s, 1.5 * s, z), new THREE.Vector3(x - 0.4 * s, 2.8 * s, z + 0.3), new THREE.Vector3(x + 0.2 * s, 3.6 * s, z)]);
    kit.mesh(group, new THREE.TubeGeometry(curve, 16, 0.16 * s, 7, false), bark);
    for (let b = 0; b < 3; b++) {
      const branch = new THREE.CatmullRomCurve3([curve.getPoint(0.6 + b * 0.12), new THREE.Vector3(x + (b - 1) * 1.6 * s, (3.2 + b * 0.3) * s, z + range(-1, 1))]);
      kit.mesh(group, new THREE.TubeGeometry(branch, 6, 0.06 * s, 5, false), bark);
    }
    for (let i = 0; i < 46; i++) blossomTransforms.push([x + range(-2.2, 2.2) * s, (3.4 + range(-0.6, 1.2)) * s, z + range(-1.8, 1.8) * s, range(0.4, 0.8) * s, range(0.35, 0.6) * s, range(0.4, 0.8) * s]);
  }
  kit.instanced(group, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: "#f6b8c8", roughness: 0.8, emissive: "#5a2030", emissiveIntensity: 0.25, flatShading: true }), blossomTransforms, ["#f6b8c8", "#ffd0dc", "#efa2b8", "#fbe0e8"]);
  // Bamboo grove on the right edge.
  kit.instanced(group, new THREE.CylinderGeometry(0.06, 0.07, 1, 6), new THREE.MeshStandardMaterial({ color: "#6d8f3a", roughness: 0.6 }), Array.from({ length: 40 }, () => { const h = range(5, 9); return [-range(7, 11), h / 2, range(4, 22), 1, h, 1]; }));
  // Distant mountains, three silhouettes fading into haze.
  [["#8f8fa8", 60, 9], ["#a59cab", 80, 13], ["#c1b0b0", 100, 17]].forEach(([color, z, peak], layer) => {
    const shape = new THREE.Shape(); shape.moveTo(-120, -5);
    for (let x = -120; x <= 120; x += 4) shape.lineTo(x, (peak as number) * (0.4 + fbm(x * 0.02 + layer * 10, layer) * 0.9));
    shape.lineTo(120, -5);
    kit.mesh(group, new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: color as string, fog: true }), [0, 0, z as number], [0, Math.PI, 0]);
  });

  const petals = kit.particles(group, { count: 420, min: [-9, 0, 4], max: [9, 7, 26], size: 0.07, color: "#ffc6d6", opacity: 0.9, mode: "fall", speed: 0.45, wander: 0.9, additive: false });
  kit.particles(group, { count: 160, min: [-8, 0.5, 5], max: [8, 5, 24], size: 0.04, color: "#fff2c8", opacity: 0.5, mode: "wander", speed: 0.2, wander: 0.5, twinkle: 1 });

  return {
    group, background: "#e9c79c", fog: ["#e8c9a6", 0.022], tint: "#ffd7a8", exposure: 1.05,
    rig: { hemi: ["#cfe0ff", "#8a6a4a", 1.1], key: { color: "#ffd8a0", intensity: 2.4, position: [sun.x * 30, sun.y * 30 + 6, sun.z * 30] }, accent: { color: "#ffb060", intensity: 6, position: [2.5, 1.6, 8.6], distance: 5 } },
    update({ time, reduced, pulse }) {
      pondUniforms.uRipple.value = Number.isFinite(pulse) && pulse < 10 ? pulse * 2 : -10;
      const gust = envelope(pulse, 6, 0.3);
      petals.uniforms.uSpeed.value = reduced ? 0.15 : 0.45 + gust * 1.2;
      petals.uniforms.uWander.value = 0.9 + gust * 2;
      fireMaterial.color.setRGB(2.6 + gust * 2, 1.6 + gust, 0.6);
      (lanternGlow.material as THREE.SpriteMaterial).opacity = 0.35 + gust * 0.4 + Math.sin(time * 7) * 0.03;
      for (let i = 0; i < 7; i++) {
        const angle = time * (reduced ? 0.05 : 0.18) * (i % 2 ? 1 : -1) + i * 0.9;
        const rx = 1.4 - (i % 3) * 0.3, rz = 0.9 - (i % 3) * 0.2;
        dummy.position.set(-0.8 + Math.cos(angle) * rx, -0.04, 10.5 + Math.sin(angle) * rz);
        dummy.rotation.set(0, -angle + (i % 2 ? 0 : Math.PI), Math.sin(time * 3 + i) * 0.15);
        dummy.updateMatrix(); koi.setMatrixAt(i, dummy.matrix);
      }
      koi.instanceMatrix.needsUpdate = true;
    },
  };
}
