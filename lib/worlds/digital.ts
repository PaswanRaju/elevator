import * as THREE from "three";
import { envelope, lerp, type Kit, type World } from "./kit";

// Floor 13: inside the machine. An infinite neon grid, falling code, unstable geometry and a portal.
export default function digital(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;
  kit.sky(group, { top: "#02000c", horizon: "#2a0a52", bottom: "#000000" });

  // The grid: anti-aliased lines from world position, a pulse ring that spreads on stabilisation.
  const gridUniforms = { uTime: kit.time, uGlitch: { value: 1 }, uRing: { value: -1 } };
  const grid = new THREE.PlaneGeometry(400, 400, 1, 1); grid.rotateX(-Math.PI / 2); grid.translate(0, 0, 150);
  kit.mesh(group, grid, new THREE.ShaderMaterial({
    uniforms: gridUniforms, transparent: true, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `uniform float uTime, uGlitch, uRing; varying vec3 vW;
      float line(float v){ float d = abs(fract(v - 0.5) - 0.5) / fwidth(v); return 1.0 - min(d, 1.0); }
      void main(){ vec2 p = vW.xz;
        float shift = uGlitch * step(0.92, fract(sin(floor(p.y * 0.5) * 91.7 + floor(uTime * 8.0)) * 437.5)) * 0.6;
        float g = max(line(p.x + shift), line(p.y - uTime * 1.2));
        float major = max(line(p.x * 0.2), line((p.y - uTime * 1.2) * 0.2));
        float dist = length(p - vec2(0.0, 3.0));
        float ring = uRing > 0.0 ? exp(-pow(dist - uRing * 14.0, 2.0) * 0.4) * exp(-uRing * 0.5) : 0.0;
        vec3 cyan = vec3(0.1, 0.9, 1.0), magenta = vec3(1.0, 0.2, 0.9);
        vec3 col = mix(cyan, magenta, smoothstep(10.0, 90.0, dist)) * (g * 0.7 + major * 0.8) + vec3(0.8, 1.0, 1.0) * ring * 2.0;
        float fade = 1.0 - smoothstep(30.0, 170.0, dist);
        gl_FragColor = vec4(col * 1.4, (g * 0.6 + major * 0.8 + ring) * fade + 0.04 * fade);
      }`,
  }));
  // A dark mirror slab under the grid lines, so the reflector shows the neon.
  kit.ground(group, new THREE.MeshStandardMaterial({ color: "#05030c", roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0.55, depthWrite: false }), [60, 60], [0, 25]);

  // Code walls: columns of glyphs that scroll on both sides.
  const glyphs = "01アイウエオカキクケコｱｲｳｴｵ<>/{}#$%=+*";
  const codeMap = kit.canvasTexture(512, 1024, (ctx) => {
    ctx.fillStyle = "rgba(0,0,0,0)"; ctx.fillRect(0, 0, 512, 1024);
    ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
    for (let col = 0; col < 24; col++) for (let row = 0; row < 46; row++) {
      if (random() > 0.62) continue;
      ctx.fillStyle = random() > 0.9 ? "#e8ffff" : random() > 0.5 ? "#33f0ff" : "#2a9cff";
      ctx.globalAlpha = 0.25 + random() * 0.75;
      ctx.fillText(glyphs[Math.floor(random() * glyphs.length)], col * 21 + 11, row * 22 + 20);
    }
    ctx.globalAlpha = 1;
  });
  codeMap.wrapS = codeMap.wrapT = THREE.RepeatWrapping; codeMap.repeat.set(2, 1);
  const codeMaterial = new THREE.MeshBasicMaterial({ map: codeMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, color: new THREE.Color(1.4, 1.4, 1.4) });
  for (const side of [-1, 1]) kit.mesh(group, new THREE.PlaneGeometry(40, 18), codeMaterial, [side * 9, 9, 22], [0, side * -Math.PI / 2, 0]);

  // Data streams rising in thin columns.
  const streams = Array.from({ length: 8 }, (_, i) => {
    const x = (i - 3.5) * 3.2 + range(-0.6, 0.6), z = range(10, 34);
    return kit.particles(group, { count: 70, min: [x - 0.08, 0, z - 0.08], max: [x + 0.08, 14, z + 0.08], size: 0.12, color: i % 2 ? "#ff3df0" : "#3df8ff", opacity: 0.9, mode: "rise", speed: range(2, 4), streak: 0.2 });
  });

  // Unstable geometry: wireframe solids that jitter until the grid is stabilised, then align in a ring.
  const shapes = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.TorusKnotGeometry(0.7, 0.2, 80, 10), new THREE.DodecahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1.1, 0), new THREE.BoxGeometry(1.4, 1.4, 1.4)];
  const solids = shapes.map((geometry, i) => {
    const root = new THREE.Group(); group.add(root);
    const color = new THREE.Color(i % 2 ? "#ff3df0" : "#3df8ff");
    root.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.8), wireframe: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
    root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: "#07040f", metalness: 0.9, roughness: 0.2, emissive: color, emissiveIntensity: 0.08 })));
    root.scale.setScalar(0.96);
    const chaos = new THREE.Vector3(range(-7, 7), range(1.5, 6), range(9, 22));
    const a = (i / shapes.length) * Math.PI * 2;
    const order = new THREE.Vector3(Math.cos(a) * 4, 3.4 + Math.sin(a) * 2.2, 20);
    root.position.copy(chaos);
    kit.glow(root, [0, 0, 0], [3.5, 3.5], `#${color.getHexString()}`, 0.25);
    return { root, chaos, order, spin: range(0.2, 0.6) };
  });

  // The portal at the end of the grid.
  const portalUniforms = { uTime: kit.time, uCalm: { value: 0 } };
  kit.mesh(group, new THREE.CircleGeometry(3.2, 64), new THREE.ShaderMaterial({
    uniforms: portalUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uTime, uCalm; varying vec2 vUv;
      void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
        float swirl = sin(a * 6.0 + r * 18.0 - uTime * (3.0 - uCalm * 2.0)) * 0.5 + 0.5;
        vec3 col = mix(vec3(1.0, 0.2, 0.9), vec3(0.2, 0.95, 1.0), swirl) * (1.0 - r) * 1.8 + vec3(1.0) * pow(1.0 - r, 6.0);
        gl_FragColor = vec4(col, (1.0 - smoothstep(0.85, 1.0, r)) * (0.5 + swirl * 0.5)); }`,
  }), [0, 3.4, 20], [0, Math.PI, 0]);
  kit.mesh(group, new THREE.TorusGeometry(3.3, 0.08, 12, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 2.8) }), [0, 3.4, 20]);
  kit.glow(group, [0, 3.4, 19.6], [12, 12], "#8a5cff", 0.35);

  const bits = kit.particles(group, { count: 500, min: [-12, 0.2, 4], max: [12, 10, 34], size: 0.05, color: "#9ff8ff", opacity: 0.7, mode: "wander", speed: 0.4, wander: 0.6, twinkle: 5 });

  let calm = 0;
  return {
    group, background: "#02000a", fog: ["#08021a", 0.022], tint: "#8af0ff", reflect: "#2a2a6a", exposure: 1.1,
    rig: { hemi: ["#6a3aff", "#000010", 0.5], key: { color: "#3df8ff", intensity: 1.2, position: [-8, 14, 10] }, accent: { color: "#ff3df0", intensity: 30, position: [0, 4, 16], distance: 18 } },
    update({ time, reduced, pulse }) {
      // Stabilising holds order for a while, then the dimension slowly slips back into glitches.
      const target = Number.isFinite(pulse) && pulse < 12 ? 1 - Math.max(0, pulse - 8) / 4 : 0;
      calm = reduced ? target : lerp(calm, target, 0.04);
      gridUniforms.uGlitch.value = 1 - calm;
      gridUniforms.uRing.value = Number.isFinite(pulse) && pulse < 6 ? pulse : -1;
      portalUniforms.uCalm.value = calm;
      codeMap.offset.y = reduced ? 0 : -time * 0.05;
      const flicker = !reduced && calm < 0.5 && Math.sin(time * 41) > 0.93;
      codeMaterial.opacity = flicker ? 0.3 : 1;
      solids.forEach(({ root, chaos, order, spin }, i) => {
        const jitter = reduced ? 0 : (1 - calm) * (Math.sin(time * 53 + i * 7) > 0.96 ? 0.35 : 0);
        root.position.set(lerp(chaos.x, order.x, calm) + jitter, lerp(chaos.y, order.y, calm) + Math.sin(time * 0.8 + i) * 0.2, lerp(chaos.z, order.z, calm));
        root.rotation.set(time * spin * (reduced ? 0.2 : 1), time * spin * 0.7 * (reduced ? 0.2 : 1), 0);
      });
      streams.forEach((stream) => { stream.uniforms.uBoost.value = envelope(pulse, 3, 0.1); });
      bits.uniforms.uBoost.value = envelope(pulse, 3, 0.1) * 2;
    },
  };
}
