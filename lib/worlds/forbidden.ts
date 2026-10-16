import * as THREE from "three";
import { envelope, ease, type Kit, type World } from "./kit";

// Floor 10: a hidden velvet gallery. Curtains part on arrival to reveal a doorway of gold light,
// the stage for the personal portrait shown over the scene.
export default function forbidden(kit: Kit): World {
  const group = new THREE.Group();
  const { random, range } = kit;

  // Black marble over the shared reflector.
  const marble = kit.canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#141014"; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(${random() > 0.6 ? "214,180,120" : "140,120,130"},${range(0.08, 0.3)})`; ctx.lineWidth = range(0.4, 2.2);
      ctx.beginPath(); let x = random() * 512, y = -10; ctx.moveTo(x, y);
      while (y < 520) { x += range(-30, 30); y += range(10, 40); ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  marble.wrapS = marble.wrapT = THREE.RepeatWrapping; marble.repeat.set(3, 5);
  kit.ground(group, new THREE.MeshStandardMaterial({ map: marble, color: "#8a7f88", roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.7, depthWrite: false }), [12, 30], [0, 12]);
  const gold = new THREE.MeshStandardMaterial({ color: "#d4a85a", metalness: 0.95, roughness: 0.28 });
  // A gold inlay leads from the doors to the stage.
  for (const x of [-0.9, 0.9]) kit.mesh(group, new THREE.BoxGeometry(0.04, 0.01, 10), gold, [x, 0.006, 6]);

  // Dark panelled walls, gilded mouldings and columns with lit capitals.
  const wall = new THREE.MeshStandardMaterial({ color: "#1a1016", roughness: 0.7 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  kit.instanced(group, box, wall, [[-5.2, 3.5, 12, 0.3, 7, 26], [5.2, 3.5, 12, 0.3, 7, 26], [0, 7, 12, 10.6, 0.3, 26], [0, 3.5, 22, 10.6, 7, 0.3]]);
  const columns: number[][] = [], capitals: number[][] = [];
  for (const side of [-1, 1]) for (let z = 3; z <= 17; z += 3.5) { columns.push([side * 4.4, 3.2, z, 1, 6.4, 1]); capitals.push([side * 4.4, 6.5, z, 1.4, 0.25, 1.4]); }
  kit.instanced(group, new THREE.CylinderGeometry(0.28, 0.32, 1, 20), new THREE.MeshStandardMaterial({ color: "#2a1e24", roughness: 0.35, metalness: 0.2 }), columns);
  kit.instanced(group, new THREE.CylinderGeometry(0.3, 0.3, 1, 20), gold, capitals);
  for (const side of [-1, 1]) for (let z = 4.75; z <= 15.25; z += 3.5) {
    kit.mesh(group, new THREE.BoxGeometry(0.05, 3, 1.8), gold, [side * 5.03, 3.2, z]);
    kit.mesh(group, new THREE.BoxGeometry(0.06, 2.8, 1.6), wall, [side * 5.0, 3.2, z]);
    kit.glow(group, [side * 4.5, 5.2, z], [1.4, 2], "#ffcf8a", 0.22);
  }

  // The stage: a raised plinth, a glowing doorway of light framed in gold.
  kit.mesh(group, new THREE.BoxGeometry(5, 0.3, 3), new THREE.MeshStandardMaterial({ color: "#20161b", roughness: 0.3, metalness: 0.4 }), [0, 0.15, 17.5]);
  kit.mesh(group, new THREE.BoxGeometry(5.1, 0.04, 3.1), gold, [0, 0.31, 17.5]);
  const doorway = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.9) });
  const arch = new THREE.Shape(); arch.moveTo(-1.1, 0); arch.lineTo(-1.1, 2.6); arch.absarc(0, 2.6, 1.1, Math.PI, 0, true); arch.lineTo(1.1, 0); arch.lineTo(-1.1, 0);
  kit.mesh(group, new THREE.ShapeGeometry(arch, 24), doorway, [0, 0.32, 21.8], [0, Math.PI, 0]);
  const frame = new THREE.Shape(); frame.moveTo(-1.4, 0); frame.lineTo(-1.4, 2.6); frame.absarc(0, 2.6, 1.4, Math.PI, 0, true); frame.lineTo(1.4, 0); frame.lineTo(-1.4, 0);
  frame.holes.push(new THREE.Path().moveTo(-1.1, 0).lineTo(1.1, 0).lineTo(1.1, 2.6).absarc(0, 2.6, 1.1, 0, Math.PI, false).lineTo(-1.1, 0));
  kit.mesh(group, new THREE.ExtrudeGeometry(frame, { depth: 0.2, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 24 }), gold, [0, 0.32, 21.75], [0, Math.PI, 0]);
  const archGlow = kit.glow(group, [0, 2.4, 21.4], [7, 7], "#ffc777", 0.55);

  // Volumetric shaft of light falling on the stage.
  const beamUniforms = { uTime: kit.time, uBoost: { value: 0 } };
  kit.mesh(group, new THREE.CylinderGeometry(0.6, 2.6, 6.6, 32, 1, true), new THREE.ShaderMaterial({
    uniforms: beamUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: "varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: `uniform float uTime, uBoost; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float rim = pow(abs(dot(vN, vV)), 1.5); float dust = 0.85 + 0.15 * sin(vUv.y * 40.0 + uTime * 0.8 + vUv.x * 20.0);
        float a = rim * smoothstep(0.0, 0.6, vUv.y) * 0.12 * dust * (1.0 + uBoost * 2.0);
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * a, a); }`,
  }), [0, 3.6, 17.5]);

  // Velvet curtains: folded planes with sheen, drawn aside as the visitor steps out.
  const velvet = new THREE.MeshPhysicalMaterial({ color: "#5c0b18", roughness: 0.75, sheen: 1, sheenColor: new THREE.Color("#ff6a7a"), sheenRoughness: 0.4, side: THREE.DoubleSide });
  const curtainGeometry = new THREE.PlaneGeometry(3.2, 6.8, 64, 1);
  const cp = curtainGeometry.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 9) * 0.12 + Math.sin(cp.getX(i) * 23) * 0.03);
  curtainGeometry.computeVertexNormals();
  const curtains = [-1, 1].map((side) => kit.mesh(group, curtainGeometry, velvet, [side * 1.6, 3.4, 16], [0, Math.PI, 0]));
  kit.mesh(group, new THREE.BoxGeometry(8, 0.7, 0.4), velvet, [0, 6.7, 15.9]);
  kit.mesh(group, new THREE.BoxGeometry(8.1, 0.06, 0.45), gold, [0, 6.32, 15.9]);

  // A chandelier ring of warm points overhead.
  const bulbs = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.1, 1.1) });
  kit.instanced(group, new THREE.SphereGeometry(0.05, 8, 6), bulbs, Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [Math.cos(a) * 1.2, 5.6 + Math.sin(i * 1.3) * 0.08, 8 + Math.sin(a) * 1.2]; }));
  kit.mesh(group, new THREE.TorusGeometry(1.25, 0.03, 8, 64), gold, [0, 5.62, 8], [Math.PI / 2, 0, 0]);
  kit.glow(group, [0, 5.6, 8], [5, 3], "#ffd59a", 0.35);

  const dust = kit.particles(group, { count: 420, min: [-3, 0.3, 4], max: [3, 6.5, 20], size: 0.05, color: "#ffd88a", opacity: 0.7, mode: "wander", speed: 0.15, wander: 0.5, twinkle: 1.6 });

  let opened = 0;
  return {
    group, background: "#07040a", fog: ["#140912", 0.035], tint: "#ffc98a", reflect: "#4a3038", exposure: 1.2,
    rig: { hemi: ["#6a3a50", "#100608", 0.4], key: { color: "#ffd9a8", intensity: 1.6, position: [0, 14, 4] }, accent: { color: "#ffb35c", intensity: 30, position: [0, 3, 18.5], distance: 14 } },
    update({ time, reduced, pulse, presence }) {
      // Curtains wait for the doors, then draw slowly aside.
      opened = reduced ? presence : Math.min(presence, opened + 0.004);
      const part = ease(0, 1, opened);
      curtains.forEach((curtain, i) => { const side = i ? 1 : -1; curtain.position.x = side * (1.6 + part * 2.4); curtain.scale.x = 1 - part * 0.45; });
      const look = envelope(pulse, 5, 0.4);
      beamUniforms.uBoost.value = look + (reduced ? 0 : Math.sin(time * 0.7) * 0.1);
      doorway.color.setRGB(2.4 + look * 2.4, 1.7 + look * 1.5, 0.9 + look * 0.6);
      (archGlow.material as THREE.SpriteMaterial).opacity = 0.45 + part * 0.2 + look * 0.35;
      dust.uniforms.uBoost.value = look * 2.5;
      dust.uniforms.uWander.value = 0.5 + look * 1.5;
    },
  };
}
