import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sampleJourney, smooth, type JourneyFrame } from './journey';

type Options = {
  canvas: HTMLCanvasElement;
  floorControl: HTMLButtonElement;
  getFrame: () => JourneyFrame;
  onContextLost: () => void;
};
const lerp=THREE.MathUtils.lerp;
function seeded(seed:number){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function texture(width:number,height:number,paint:(ctx:CanvasRenderingContext2D)=>void){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');paint(ctx);
  const result=new THREE.CanvasTexture(canvas);result.colorSpace=THREE.SRGBColorSpace;return result;
}
export function createCinematic({canvas,floorControl,getFrame,onContextLost}:Options){
  const narrow=()=>canvas.clientWidth/canvas.clientHeight<.85;
  const lightDevice=navigator.hardwareConcurrency<=4;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:!lightDevice,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lightDevice?1:narrow()?1.25:1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#080c0d');scene.fog=new THREE.FogExp2('#080c0d',.018);
  const camera=new THREE.PerspectiveCamera(52,1,.05,250);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.55;
  room.dispose();pmrem.dispose();
  const textures:THREE.Texture[]=[];
  const track=(value:THREE.Texture)=>{textures.push(value);return value};
  const random=seeded(13013);
  const brushed=track(texture(128,256,ctx=>{
    ctx.fillStyle='#b6b7af';ctx.fillRect(0,0,128,256);
    for(let i=0;i<1600;i++){ctx.fillStyle=`rgba(${random()>.5?'255,255,255':'0,0,0'},${random()*.09})`;ctx.fillRect(0,random()*256,128,random()*.7+.2)}
  }));
  const stone=track(texture(256,256,ctx=>{
    ctx.fillStyle='#9b9a90';ctx.fillRect(0,0,256,256);
    for(let i=0;i<18000;i++){ctx.fillStyle=`rgba(${random()>.5?'255,255,255':'0,0,0'},${random()*.055})`;ctx.fillRect(random()*256,random()*256,random()*3+.5,random()*2+.5)}
    ctx.strokeStyle='#75786b22';ctx.lineWidth=.6;for(let i=0;i<14;i++){ctx.beginPath();ctx.moveTo(random()*256,0);ctx.bezierCurveTo(random()*256,70,random()*256,150,random()*256,256);ctx.stroke()}
  }));
  stone.wrapS=stone.wrapT=THREE.RepeatWrapping;stone.repeat.set(2,2);
  const glowMap=track(texture(128,128,ctx=>{const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#fff5db80');g.addColorStop(.12,'#ffe3ac35');g.addColorStop(.4,'#ffcf7a0b');g.addColorStop(1,'#ffc97800');ctx.fillStyle=g;ctx.fillRect(0,0,128,128)}));
  const wall=new THREE.MeshStandardMaterial({color:'#57574e',map:stone,roughness:.86,metalness:.06});
  const recess=new THREE.MeshStandardMaterial({color:'#0f1616',roughness:.7,metalness:.3});
  const bronze=new THREE.MeshStandardMaterial({color:'#a48c60',metalness:.86,roughness:.25});
  const steel=new THREE.MeshStandardMaterial({color:'#737b73',map:brushed,metalness:.94,roughness:.25});
  const blackMetal=new THREE.MeshStandardMaterial({color:'#192120',metalness:.85,roughness:.3});
  const warm=new THREE.MeshBasicMaterial({color:new THREE.Color(2.7,1.9,.95)});
  const cool=new THREE.MeshBasicMaterial({color:new THREE.Color(.5,1.8,2.2)});
  const unitBox=new THREE.BoxGeometry(1,1,1);
  function box(parent:THREE.Object3D,material:THREE.Material,size:number[],position:number[]){const mesh=new THREE.Mesh(unitBox,material);mesh.scale.set(...size as [number,number,number]);mesh.position.set(...position as [number,number,number]);parent.add(mesh);return mesh}
  function glow(parent:THREE.Object3D,position:number[],scale:number[],color='#ffe1a6'){
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.55}));
    sprite.position.set(...position as [number,number,number]);sprite.scale.set(...scale as [number,number,number]);parent.add(sprite);return sprite;
  }
  const hall=new THREE.Group(),cabin=new THREE.Group(),doors=new THREE.Group(),city=new THREE.Group();
  scene.add(hall,cabin,doors,city);city.visible=false;
  scene.add(new THREE.HemisphereLight('#c5d8dc','#171a16',.65));
  const ceilingLight=new THREE.PointLight('#ffe2b2',55,22,2);ceilingLight.position.set(0,4.1,3);hall.add(ceilingLight);
  const cabinLight=new THREE.PointLight('#fff0cc',26,9,2);cabinLight.position.set(0,3,-2);cabin.add(cabinLight);
  const skyLight=new THREE.DirectionalLight('#a6cfe6',1.3);skyLight.position.set(-18,35,22);city.add(skyLight);
  const skylineFill=new THREE.PointLight('#8fe8ed',30,35,2);skylineFill.position.set(-5,6,16);city.add(skylineFill);

  // An actual reflected camera pass; small targets keep mobile GPU work bounded.
  const reflector=new Reflector(new THREE.PlaneGeometry(18,40),{textureWidth:narrow()||lightDevice?256:512,textureHeight:narrow()||lightDevice?256:512,color:0x777b79,clipBias:.003});
  reflector.rotation.x=-Math.PI/2;reflector.position.set(0,-.025,2);scene.add(reflector);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(18,40),new THREE.MeshStandardMaterial({color:'#151c1c',roughness:.3,metalness:.65,transparent:true,opacity:.48}));
  floor.rotation.x=-Math.PI/2;floor.position.set(0,-.015,2);scene.add(floor);
  for(let z=-4;z<19;z+=1.8)box(scene,blackMetal,[18,.005,.012],[0,-.008,z]);
  for(const x of [-6,-3,0,3,6])box(scene,blackMetal,[.012,.005,40],[x,-.008,2]);

  // Hallway: coffered ceiling, recessed stone bays, bronze reveals and grazing lights.
  for(const side of [-1,1]){
    box(hall,wall,[.25,4.8,19],[side*3.4,2.4,6]);
    box(hall,blackMetal,[.2,.25,19],[side*3.28,.125,6]);
    box(hall,bronze,[.025,.035,18],[side*3.12,.035,6]);
    box(hall,warm,[.018,.018,17],[side*3.10,.06,6]);
    for(const z of [1,4.5,8,11.5,15]){
      box(hall,recess,[.17,4.55,.40],[side*3.22,2.3,z]);
      box(hall,bronze,[.06,4.5,.025],[side*3.10,2.28,z+.22]);
      box(hall,blackMetal,[.20,1.6,.23],[side*3.05,2.3,z+.65]);
      box(hall,warm,[.06,1.45,.025],[side*2.94,2.3,z+.78]);
      glow(hall,[side*2.90,2.3,z+.78],[1.2,3.8,1]);
    }
    box(hall,wall,[2.05,4.8,.5],[side*2.28,2.4,0]);
    box(hall,bronze,[.025,3.9,.025],[side*1.45,1.95,.28]);
  }
  box(hall,wall,[6.8,1.7,.5],[0,3.95,0]);
  box(hall,recess,[7,.18,20],[0,4.8,6]);
  for(const z of [1.8,5.3,8.8,12.3]){
    box(hall,blackMetal,[6.7,.16,.2],[0,4.65,z]);
    for(const x of [-2.8,2.8])box(hall,warm,[.025,.018,3.1],[x,4.56,z+1.4]);
  }
  // Door leaves have real thickness and bronze edges on both sides.
  const leaves=[new THREE.Group(),new THREE.Group()];
  leaves.forEach((leaf,i)=>{
    box(leaf,steel,[1.19,3.05,.115],[0,1.525,0]);
    for(const x of [-.586,.586])box(leaf,bronze,[.012,3.05,.12],[x,1.525,0]);
    box(leaf,blackMetal,[1.14,.018,.123],[0,.08,0]);
    leaf.position.set(i===0?-.6:.6,0,.05);doors.add(leaf);
  });
  for(const x of [-1.28,1.28]){box(cabin,blackMetal,[.16,3.35,.42],[x,1.675,0]);box(cabin,bronze,[.035,3.32,.44],[x-Math.sign(x)*.05,1.66,0]);}
  box(cabin,blackMetal,[2.72,.15,.45],[0,3.25,0]);
  box(cabin,warm,[2.38,.025,.04],[0,3.12,.13]);
  box(cabin,warm,[2.38,.025,.04],[0,3.12,-.18]);
  box(cabin,bronze,[2.6,.015,.5],[0,.008,0]);
  for(const side of [-1,1]){
    box(cabin,recess,[.14,3.6,4.6],[side*1.84,1.8,-2.3]);
    box(cabin,blackMetal,[2.2,3.6,.20],[side*2.4,1.8,-.12]);
    for(const z of [-.6,-2.15,-3.7]){
      box(cabin,steel,[.018,3.2,1.42],[side*1.756,1.75,z]);
      box(cabin,bronze,[.025,3.2,.025],[side*1.73,1.75,z+.72]);
    }
    box(cabin,bronze,[.055,.055,3.7],[side*1.62,.95,-2.2]);
    box(cabin,warm,[.02,.025,4.2],[side*1.65,3.30,-2.2]);
  }
  box(cabin,steel,[3.7,3.6,.15],[0,1.8,-4.55]);
  box(cabin,bronze,[3.4,.05,.05],[0,.95,-4.43]);
  box(cabin,recess,[3.7,.14,4.7],[0,3.6,-2.3]);
  box(cabin,warm,[2.6,.018,2.5],[0,3.48,-2.2]);
  box(cabin,blackMetal,[.38,.78,.06],[-1.48,1.38,-.25]);
  box(cabin,bronze,[.32,.72,.065],[-1.48,1.38,-.28]);
  const buttonPoint=new THREE.Vector3(-1.48,1.4,-.34);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.105,.009,8,32),warm);ring.position.copy(buttonPoint);cabin.add(ring);
  const buttonFace=new THREE.Mesh(new THREE.CircleGeometry(.092,32),blackMetal);buttonFace.position.copy(buttonPoint);buttonFace.rotation.y=Math.PI;cabin.add(buttonFace);

  const displayCanvas=document.createElement('canvas');displayCanvas.width=256;displayCanvas.height=100;
  const displayContext=displayCanvas.getContext('2d')!;
  const displayTexture=track(new THREE.CanvasTexture(displayCanvas));displayTexture.colorSpace=THREE.SRGBColorSpace;
  const displayMaterial=new THREE.MeshBasicMaterial({map:displayTexture,toneMapped:false});
  for(const outside of [true,false]){
    const group=outside?hall:cabin;
    box(group,blackMetal,[.76,.29,.07],[0,outside?3.58:2.88,outside?.29:-.28]);
    const display=new THREE.Mesh(new THREE.PlaneGeometry(.69,.26),displayMaterial);display.position.set(0,outside?3.58:2.88,outside?.335:-.325);if(!outside)display.rotation.y=Math.PI;group.add(display);
  }
  let lastFloor=-1;
  function indicator(value:number){if(value===lastFloor)return;lastFloor=value;displayContext.fillStyle='#080f0e';displayContext.fillRect(0,0,256,100);displayContext.fillStyle='#d6ba81';displayContext.font='42px monospace';displayContext.textAlign='center';displayContext.fillText(`↑ ${String(value).padStart(2,'0')}`,128,65);displayTexture.needsUpdate=true;}

  // A procedural night sky and instanced city: no downloaded models or textures.
  const sky=new THREE.Mesh(new THREE.SphereGeometry(180,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec3 vPosition;
    void main(){vec3 direction=normalize(vPosition);float h=max(0.0,direction.y);vec3 horizon=vec3(.075,.15,.18);vec3 zenith=vec3(.006,.016,.037);vec3 color=mix(horizon,zenith,smoothstep(0.,.65,h));float glow=pow(max(0.,dot(direction,normalize(vec3(-.28,.13,.9)))),20.);color+=glow*vec3(.08,.065,.035);gl_FragColor=vec4(color,1.);}` }));city.add(sky);
  const starPositions=new Float32Array(220*3);
  for(let i=0;i<220;i++){const az=random()*Math.PI*2,elevation=random()*.8+.12;starPositions.set([Math.cos(az)*130,Math.sin(elevation)*120,Math.sin(az)*130],i*3)}
  const starsGeometry=new THREE.BufferGeometry();starsGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
  const stars=new THREE.Points(starsGeometry,new THREE.PointsMaterial({color:'#d3e5ec',size:.12,transparent:true,opacity:.7,depthWrite:false}));city.add(stars);
  const moon=new THREE.Mesh(new THREE.SphereGeometry(3.9,32,20),new THREE.MeshBasicMaterial({color:'#d4d6c1',fog:false}));moon.position.set(24,28,95);city.add(moon);glow(city,[24,28,94],[23,23,1],'#a6c6d2');
  box(city,new THREE.MeshStandardMaterial({color:'#07151b',roughness:.8}),[180,.3,150],[0,-10.5,75]);
  const buildings:THREE.InstancedMesh[]=[];
  for(let variant=0;variant<3;variant++){
    const facade=track(texture(128,256,ctx=>{
      ctx.fillStyle=['#10212b','#14252d','#18252b'][variant];ctx.fillRect(0,0,128,256);
      for(let y=3;y<254;y+=8){for(let x=4;x<124;x+=8){const lit=random();ctx.fillStyle=lit>.50?(lit>.87?'#e8bf81':variant===1?'#699da9':'#99bcc4'):'#1c333e';ctx.globalAlpha=lit>.5?.35+random()*.6:1;ctx.fillRect(x,y,3,4)}ctx.globalAlpha=1;ctx.fillStyle='#050e1760';ctx.fillRect(0,y+5,128,1)}
      for(let x=0;x<128;x+=32){ctx.fillStyle='#51738180';ctx.fillRect(x,0,1,256)}
    }));
    const material=new THREE.MeshStandardMaterial({color:'#8ca4af',map:facade,emissiveMap:facade,emissive:'#9ac3d6',emissiveIntensity:1.25,roughness:.35,metalness:.6});
    const mesh=new THREE.InstancedMesh(unitBox,material,38),dummy=new THREE.Object3D();
    for(let i=0;i<38;i++){
      const row=Math.floor(i/10),column=i%10;
      const x=(column-4.5)*9+(random()-.5)*4;
      const z=31+row*23+variant*3+random()*8;
      const height=7+random()*25+(row>1?random()*12:0);
      dummy.position.set(x,height/2-10,z);dummy.scale.set(2.5+random()*4,height,2.5+random()*5);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;city.add(mesh);buildings.push(mesh);
  }
  const heroMaterial=buildings[1].material;
  box(city,heroMaterial,[6.5,35,7],[-9,7.5,46]);
  box(city,heroMaterial,[4.8,7,5.5],[-9,28.5,46]);
  box(city,blackMetal,[2.8,2,3],[-9,33,46]);
  box(city,cool,[.055,39,.055],[-12.3,9.5,42.45]);box(city,cool,[.055,39,.055],[-5.7,9.5,42.45]);
  box(city,cool,[6.7,.09,7.2],[-9,25,46]);
  box(city,bronze,[.09,8,.09],[-9,37,46]);glow(city,[-9,40.7,46],[2,2,1],'#91e3e8');
  for(const z of [32,56,80])box(city,cool,[100,.025,.12],[0,-9.8,z]);
  for(const x of [-30,-14,8,27])box(city,warm,[.1,.025,100],[x,-9.8,65]);
  // Rooftop glazing catches the skyline and retains an unobstructed view.
  const glass=new THREE.MeshStandardMaterial({color:'#97c9d2',transparent:true,opacity:.12,metalness:.7,roughness:.2,depthWrite:false});
  box(city,glass,[16,1.05,.035],[0,.55,16]);
  box(city,blackMetal,[16,.045,.055],[0,1.10,16]);
  for(const x of [-8,-4,0,4,8])box(city,blackMetal,[.035,1.1,.05],[x,.55,16]);
  box(city,warm,[16,.02,.04],[0,.03,15.9]);
  for(const x of [-7.5,7.5]){box(city,blackMetal,[.08,.35,17],[x,.17,8]);box(city,warm,[.018,.025,16],[x,.36,8]);}
  // Distant moving traffic is one instanced draw call.
  const traffic=new THREE.InstancedMesh(new THREE.SphereGeometry(.09,4,4),warm,24);
  const trafficDummy=new THREE.Object3D();city.add(traffic);
  const projected=new THREE.Vector3(),look=new THREE.Vector3();
  let width=0,height=0,disposed=false,lost=false,raf=0,previousTime=0,frames=0,slowFrames=0;
  let pointerX=0,pointerY=0,currentX=0,currentY=0;
  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix()}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function pointer(event:PointerEvent){if(event.pointerType!=='mouse')return;pointerX=(event.clientX/width-.5)*2;pointerY=(event.clientY/height-.5)*2;}
  function leave(){pointerX=pointerY=0}
  window.addEventListener('pointermove',pointer,{passive:true});document.addEventListener('pointerleave',leave);
  function contextLost(event:Event){event.preventDefault();lost=true;cancelAnimationFrame(raf);onContextLost()}
  canvas.addEventListener('webglcontextlost',contextLost);
  function render(time:number){
    if(disposed||lost)return;
    raf=requestAnimationFrame(render);
    if(document.hidden)return;
    const delta=time-previousTime;if(delta<(narrow()||lightDevice?30:15))return;previousTime=time;
    const frame=getFrame(),sample=sampleJourney(frame),seconds=time/1000;
    const mobile=narrow(),resting=frame.phase==='arrival'||frame.phase==='reveal';
    currentX=lerp(currentX,frame.reduced?0:pointerX,.035);currentY=lerp(currentY,frame.reduced?0:pointerY,.035);
    const ambient=frame.reduced?0:Math.sin(seconds*.32)*.06;
    const cabinZ=mobile?-3.9:-2.9;
    const cameraZ=lerp(mobile?7.4:8.8,cabinZ,sample.entry);
    camera.position.set(lerp(.25,0,sample.entry),1.62,cameraZ);
    camera.position.z=lerp(camera.position.z,6.8,sample.exit);
    camera.position.x+=sample.exit*-.7;
    if(resting){camera.position.x+=currentX*.16+ambient;camera.position.y-=currentY*.05;}
    if(!frame.reduced){camera.position.y+=Math.sin(seconds*16)*sample.shake*.008;camera.position.x+=Math.sin(seconds*9)*sample.shake*.005;}
    let yaw=lerp(mobile?0:-.075,Math.PI,sample.turn);
    yaw+=sample.exit*.025;
    const pitch=lerp(mobile?.06:0,0,sample.entry)+sample.exit*.11;
    look.set(camera.position.x+Math.sin(yaw)*10,camera.position.y+pitch*10,camera.position.z-Math.cos(yaw)*10);camera.lookAt(look);
    camera.fov=lerp(mobile?49:50,mobile?82:62,sample.entry);camera.fov=lerp(camera.fov,mobile?67:57,sample.exit);camera.updateProjectionMatrix();
    leaves[0].position.x=-.6-sample.doors*1.24;leaves[1].position.x=.6+sample.doors*1.24;
    hall.visible=!sample.city;city.visible=sample.city;skyLight.intensity=sample.city?1.1:0;
    scene.fog=new THREE.FogExp2(sample.city?'#10202b':'#080c0d',sample.city?.007:.018);
    scene.environmentIntensity=sample.city?.35:.55;
    cabinLight.intensity=frame.phase==='riding'?20+Math.sin(seconds*4)*sample.shake*1.2:26;
    ring.material=frame.phase==='boarding'||frame.phase==='riding'?warm:bronze;
    indicator(sample.floor);
    if(frame.phase==='boarding'){
      projected.copy(buttonPoint).project(camera);
      floorControl.style.left=`${Math.max(38,Math.min(width-38,(projected.x*.5+.5)*width))}px`;
      floorControl.style.top=`${Math.max(110,Math.min(height-130,(-projected.y*.5+.5)*height))}px`;
    }
    if(sample.city){
      for(let i=0;i<24;i++){trafficDummy.position.set(((i*7+(frame.reduced?0:seconds*.8))%70)-35,-9.55,32+(i%3)*24);trafficDummy.scale.set(1,1,1);trafficDummy.updateMatrix();traffic.setMatrixAt(i,trafficDummy.matrix)}traffic.instanceMatrix.needsUpdate=true;
    }
    renderer.render(scene,camera);frames++;
    if(delta>55)slowFrames++;
    if(frames===90&&slowFrames>35&&renderer.getPixelRatio()>1){renderer.setPixelRatio(1);resize()}
    if(frames%30===0){canvas.dataset.frames=String(frames);canvas.dataset.drawCalls=String(renderer.info.render.calls)}
  }
  render(performance.now());canvas.dataset.engine='ready';
  return {
    dispose(){
      disposed=true;cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('pointermove',pointer);document.removeEventListener('pointerleave',leave);canvas.removeEventListener('webglcontextlost',contextLost);
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
      scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Points||object instanceof THREE.Sprite){if('geometry' in object)geometries.add(object.geometry);const material=object.material;(Array.isArray(material)?material:[material]).forEach(m=>materials.add(m))}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());reflector.getRenderTarget().dispose();environment.dispose();renderer.dispose();
    },
  };
}
