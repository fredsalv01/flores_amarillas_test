import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";

// ponytail: one flag drives every mobile tradeoff (counts, AA, shadow res, pixel ratio)
const MOBILE=matchMedia("(pointer:coarse)").matches&&Math.min(innerWidth,innerHeight)<900;

const canvas=document.querySelector("#scene");
const renderer=new THREE.WebGLRenderer({canvas,antialias:!MOBILE,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,MOBILE?1.5:1.75));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=MOBILE?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;

// ponytail: one speed knob covers prefers-reduced-motion for gsap + every wait()
const SPEED=matchMedia("(prefers-reduced-motion: reduce)").matches?4:1;
gsap.globalTimeline.timeScale(SPEED);
const o=ms=>new Promise(r=>setTimeout(r,ms/SPEED));
// avanzar tocando donde sea de la pantalla activa, o con Enter/espacio — no solo el botón
const clickOnce=sel=>new Promise(r=>{
 const btn=document.querySelector(sel);
 const zone=btn.closest(".screen,.letter-screen,.photo-moment")||btn;
 const done=()=>{zone.removeEventListener("pointerdown",tap);removeEventListener("keydown",key);r()};
 const tap=()=>done();
 const key=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();done()}};
 zone.addEventListener("pointerdown",tap);   // pointerdown, no click: ~100ms menos en táctil
 addEventListener("keydown",key);
});

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0d0b12);
scene.fog=new THREE.FogExp2(0x0d0b12,.035);

const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,200);
camera.position.set(0,3.2,13);
const camTarget=new THREE.Vector3(0,1.4,-2);

const clock=new THREE.Clock();
let t=0;
const world=new THREE.Group(); scene.add(world);
const tulips=new THREE.Group(); world.add(tulips);
const letters=new THREE.Group(); world.add(letters);
const girl=new THREE.Group(); world.add(girl);

const hemi=new THREE.HemisphereLight(0xffedc7,0x161b25,1.8); scene.add(hemi);
const keyLight=new THREE.DirectionalLight(0xffdf9c,3.2);
keyLight.position.set(-5,9,5); keyLight.castShadow=true;
keyLight.shadow.mapSize.setScalar(MOBILE?512:1024);
Object.assign(keyLight.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:45});
keyLight.shadow.camera.updateProjectionMatrix();
scene.add(keyLight);

const ground=new THREE.Mesh(
 new THREE.PlaneGeometry(220,220),
 new THREE.MeshStandardMaterial({color:0x121813,roughness:1})
);
ground.rotation.x=-Math.PI/2; ground.position.y=-1.05; ground.receiveShadow=true; world.add(ground);

// moon at night, sun at dawn — same sphere, retinted and repositioned
const moon=new THREE.Mesh(new THREE.SphereGeometry(1.35,32,32),new THREE.MeshBasicMaterial({color:0xffe9ae}));
moon.position.set(-6,7,-7); scene.add(moon);
const moonGlow=new THREE.PointLight(0xffd978,3,20); moonGlow.position.copy(moon.position); scene.add(moonGlow);

/* ---------- cielo y sol ---------- */
function gradTex(stops,radial){
 const c=document.createElement("canvas"); c.width=c.height=radial?128:2; if(!radial) c.height=256;
 const x=c.getContext("2d");
 const g=radial?x.createRadialGradient(64,64,0,64,64,64):x.createLinearGradient(0,0,0,256);
 for(const [p,col] of stops) g.addColorStop(p,col);
 x.fillStyle=g; x.fillRect(0,0,c.width,c.height);
 return new THREE.CanvasTexture(c);
}
// ponytail: el amanecer es un tinte sobre un degradado fijo, no un shader de cielo
const sky=new THREE.Mesh(
 new THREE.SphereGeometry(120,32,16),
 new THREE.MeshBasicMaterial({
   map:gradTex([[0,"#20386e"],[.42,"#7b5f93"],[.7,"#ff9a55"],[.88,"#ffd089"],[1,"#fff0c4"]]),
   side:THREE.BackSide,fog:false,depthWrite:false
 })
);
sky.material.color.setHex(0x14162a);   // de noche el degradado va casi apagado
scene.add(sky);

// el sol nace bajo el suelo: el plano del piso le corta la mitad de abajo al salir
const sun=new THREE.Mesh(new THREE.SphereGeometry(3.4,32,20),new THREE.MeshBasicMaterial({color:0xfff2cc}));
sun.position.set(-2,-8.5,-64); sun.scale.set(1,.93,1); scene.add(sun);   // achatado, como el sol real en el horizonte
const sunGlow=new THREE.Mesh(
 new THREE.PlaneGeometry(34,34),
 new THREE.MeshBasicMaterial({
   map:gradTex([[0,"rgba(255,228,164,.95)"],[.22,"rgba(255,186,96,.5)"],[.55,"rgba(255,140,70,.16)"],[1,"rgba(255,120,60,0)"]],true),
   transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false
 })
);
sunGlow.position.z=4; sun.add(sunGlow);   // hijo del sol: el suelo también le corta el resplandor

/* ---------- tulips: hero flowers near the path ----------
   Eran 95 grupos de 9 mallas: ~850 draw calls, y otros tantos en el pase de sombras.
   Ahora es una geometría fusionada por tinte con los colores horneados en los
   vértices, instanciada: 3 draw calls en total. */
const dummy=new THREE.Object3D();
function tulipGeo(petalHex){
 const parts=[];
 const put=(geo,hex,pos,rot,scl)=>{
   dummy.position.set(...pos);
   dummy.rotation.set(...(rot||[0,0,0]));
   dummy.scale.set(...(scl||[1,1,1]));
   dummy.updateMatrix(); geo.applyMatrix4(dummy.matrix);
   const c=new THREE.Color(hex),n=geo.attributes.position.count,a=new Float32Array(n*3);
   for(let i=0;i<n;i++) c.toArray(a,i*3);
   geo.setAttribute("color",new THREE.BufferAttribute(a,3));
   geo.deleteAttribute("uv");   // no se usa y hay que igualar atributos para fusionar
   parts.push(geo);
 };
 put(new THREE.CylinderGeometry(.035,.055,2.2,8),0x52713e,[0,1,0]);
 for(let i=0;i<6;i++){         // seis pétalos estilizados forman la copa
   const a=i*Math.PI/3;
   put(new THREE.SphereGeometry(.34,12,8),petalHex,[Math.sin(a)*.24,2.12,Math.cos(a)*.24],[-.18,a,0],[.7,.95,.32]);
 }
 put(new THREE.SphereGeometry(.17,10,6),0x593b12,[0,2.13,0]);
 for(const side of [-1,1]) put(new THREE.SphereGeometry(.42,10,8),0x476537,[side*.27,.55,0],[-.35,0,side*.7],[.25,.7,.9]);
 return mergeGeometries(parts);
}
const tulipMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65});
const tulipData=[[],[],[]];
for(let i=0;i<(MOBILE?48:95);i++){
 tulipData[i%7===0?1:(i%3===0?0:2)].push({
   x:(Math.random()-.5)*22, z:-Math.random()*18-1,
   s:.32+Math.random()*.3, r:Math.random()*Math.PI, p:Math.random()*7
 });
}
const tulipMeshes=[0xffdc55,0xf2a1a7,0xf0c33c].map((hex,k)=>{
 const m=new THREE.InstancedMesh(tulipGeo(hex),tulipMat,tulipData[k].length);
 m.castShadow=true; m.frustumCulled=false;
 m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 tulips.add(m); return m;
});
function tulipSway(){
 for(let k=0;k<3;k++){
   const arr=tulipData[k],m=tulipMeshes[k];
   for(let i=0;i<arr.length;i++){
     const d=arr[i];
     dummy.position.set(d.x,-1,d.z);
     dummy.rotation.set(0,d.r,Math.sin(t*.9+d.x*.3+d.p)*.06);
     dummy.scale.setScalar(d.s);
     dummy.updateMatrix(); m.setMatrixAt(i,dummy.matrix);
   }
   m.instanceMatrix.needsUpdate=true;
 }
}

/* ---------- the big field: 2 instanced meshes instead of 1600 groups ---------- */
const FIELD_N=MOBILE?700:1600;
const stemGeo=new THREE.CylinderGeometry(.026,.04,1.9,5); stemGeo.translate(0,.95,0);
const budGeo=new THREE.SphereGeometry(.26,7,6); budGeo.scale(.85,1.2,.85); budGeo.translate(0,2.02,0);
const stems=new THREE.InstancedMesh(stemGeo,new THREE.MeshStandardMaterial({color:0x51703c,roughness:.9}),FIELD_N);
const buds=new THREE.InstancedMesh(budGeo,new THREE.MeshStandardMaterial({roughness:.55}),FIELD_N);
const field=new THREE.Group(); field.add(stems,buds); field.visible=false; world.add(field);
const budTints=[0xffd54a,0xffc21f,0xf6b93b,0xffe27a,0xf2a1a7];
const fieldData=[];
for(let i=0;i<FIELD_N;i++){
 fieldData.push({
   x:(Math.random()-.5)*95,
   z:-Math.random()*60-3,
   s:.3+Math.random()*.42,
   r:Math.random()*Math.PI,
   p:Math.random()*7,
   d:Math.random()          // growth delay so the field blooms outward
 });
 buds.setColorAt(i,new THREE.Color(budTints[i%budTints.length]));
}
buds.instanceColor.needsUpdate=true;
for(const m of [stems,buds]){ m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled=false; }
const fieldState={growth:0};
function windUpdate(){
 for(let i=0;i<FIELD_N;i++){
   const d=fieldData[i];
   const gust=Math.sin(t*1.15+d.x*.28+d.z*.16)*.11+Math.sin(t*2.3+d.p)*.035;
   dummy.position.set(d.x,-1,d.z);
   dummy.rotation.set(gust*.55,d.r,gust);
   dummy.scale.setScalar(d.s*THREE.MathUtils.clamp(fieldState.growth*2.2-d.d,0,1));
   dummy.updateMatrix();
   stems.setMatrixAt(i,dummy.matrix); buds.setMatrixAt(i,dummy.matrix);
 }
 stems.instanceMatrix.needsUpdate=true; buds.instanceMatrix.needsUpdate=true;
}

/* ---------- letters ---------- */
const SPOTS=[{x:-3.4,z:-3.5},{x:2.9,z:-6.5},{x:-.8,z:-10}];
const W=.95,DP=.68;   // medio ancho / medio fondo del sobre
function makeLetter(){
 const g=new THREE.Group();
 const paperMat=new THREE.MeshStandardMaterial({color:0xf6e8c8,roughness:.85});
 const foldMat=new THREE.MeshStandardMaterial({color:0xe9d5a9,roughness:.95,side:THREE.DoubleSide});

 const body=new THREE.Mesh(new THREE.BoxGeometry(W*2,.06,DP*2),paperMat);
 body.castShadow=body.receiveShadow=true; g.add(body);

 // ponytail: los tres dobleces son triángulos planos, no papel simulado. Coords (x, -z)
 const fold=(...pts)=>{
   const s=new THREE.Shape(); s.moveTo(...pts[0]); for(const p of pts.slice(1)) s.lineTo(...p);
   const m=new THREE.Mesh(new THREE.ShapeGeometry(s),foldMat);
   m.rotation.x=-Math.PI/2; m.position.y=.034; m.receiveShadow=true; g.add(m); return m;
 };
 fold([-W,DP],[-W,-DP],[-.03,0]);          // solapa izquierda
 fold([W,-DP],[W,DP],[.03,0]);             // solapa derecha
 fold([-W,-DP],[W,-DP],[0,-.02]);          // solapa inferior, la que cierra en V

 const hinge=new THREE.Group(); hinge.position.set(0,.036,-DP); g.add(hinge);
 const flapShape=new THREE.Shape(); flapShape.moveTo(-W,0); flapShape.lineTo(W,0); flapShape.lineTo(0,-DP*1.45);
 const flap=new THREE.Mesh(new THREE.ShapeGeometry(flapShape),new THREE.MeshStandardMaterial({color:0xefdcb4,roughness:.9,side:THREE.DoubleSide}));
 flap.rotation.x=-Math.PI/2; flap.castShadow=true; hinge.add(flap);

 const seal=new THREE.Mesh(new THREE.SphereGeometry(.15,18,12),new THREE.MeshStandardMaterial({color:0xb8465a,roughness:.35,metalness:.08}));
 seal.scale.set(1,.34,1); seal.position.set(0,.055,DP*.42); seal.castShadow=true; g.add(seal);

 const note=new THREE.Mesh(
   new THREE.PlaneGeometry(1.5,1.05),
   new THREE.MeshStandardMaterial({color:0xfffaf0,roughness:.95,side:THREE.DoubleSide,transparent:true})
 );
 note.rotation.x=-Math.PI/2; note.position.y=.06; note.visible=false; g.add(note);
 g.userData={hinge,note,seal};
 return g;
}
for(const s of SPOTS){
 const l=makeLetter();
 l.position.set(s.x,-1.035,s.z);   // apoyado en el suelo, no flotando
 l.scale.setScalar(.5);
 l.rotation.y=(Math.random()-.5)*.8;
 letters.add(l);
}
function openLetter(l){
 const {hinge,note,seal}=l.userData;
 gsap.to(seal.scale,{x:0,y:0,z:0,duration:.35,ease:"back.in(2)"});
 gsap.to(hinge.rotation,{x:-2.3,duration:.9,delay:.2,ease:"back.out(1.4)"});
 note.visible=true; note.scale.setScalar(.55); note.material.opacity=1;
 gsap.timeline({delay:.55})
   .to(note.position,{y:1.6,duration:1.4,ease:"power2.out"},0)
   .to(note.rotation,{x:-.35,duration:1.4,ease:"power2.out"},0)
   .to(note.scale,{x:1.15,y:1.15,duration:1.4,ease:"power2.out"},0)
   .to(note.material,{opacity:0,duration:.5},1)
   .set(note,{visible:false});
}

/* ---------- the girl, rigged just enough to walk and crouch ---------- */
function makeGirl(){
 const g=new THREE.Group();
 const skin=new THREE.MeshStandardMaterial({color:0xe0a27d,roughness:.8});
 const hair=new THREE.MeshStandardMaterial({color:0x2b1b18,roughness:.9});
 const dress=new THREE.MeshStandardMaterial({color:0x7c506b,roughness:.9});
 const shoes=new THREE.MeshStandardMaterial({color:0x211c25,roughness:.8});
 const head=new THREE.Mesh(new THREE.SphereGeometry(.36,16,12),skin); head.position.y=2.25; head.scale.y=1.1; head.castShadow=true; g.add(head);
 const haircap=new THREE.Mesh(new THREE.SphereGeometry(.39,16,12),hair); haircap.position.set(0,2.39,-.03); haircap.scale.set(1.03,.9,1.03); g.add(haircap);
 const bun=new THREE.Mesh(new THREE.SphereGeometry(.2,12,10),hair); bun.position.set(0,2.18,-.34); bun.scale.set(1,1.5,.9); g.add(bun);
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.31,.72,8,12),dress); body.position.y=1.38; body.castShadow=true; g.add(body);
 const skirt=new THREE.Mesh(new THREE.ConeGeometry(.52,.7,16,1,true),dress); skirt.position.y=1.14; skirt.material.side=THREE.DoubleSide; skirt.castShadow=true; g.add(skirt);
 const legs=[],arms=[];
 for(const side of [-1,1]){
   const hip=new THREE.Group(); hip.position.set(side*.13,1.05,0); g.add(hip); legs.push(hip);
   const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.65,6,8),skin); leg.position.y=-.33; hip.add(leg);
   const shoe=new THREE.Mesh(new THREE.SphereGeometry(.14,10,8),shoes); shoe.scale.set(1.25,.55,1.7); shoe.position.set(0,-.74,.06); hip.add(shoe);
   const sh=new THREE.Group(); sh.position.set(side*.36,1.72,0); g.add(sh); arms.push(sh);
   const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.52,6,8),skin); arm.position.y=-.27; arm.rotation.z=side*.2; sh.add(arm);
 }
 return {g,legs,arms};
}
const rig=makeGirl();
girl.add(rig.g); girl.position.set(0,-1,5.5); girl.rotation.y=Math.PI; girl.scale.setScalar(.8); girl.visible=false;

const pose={crouch:0,walk:0};
let walkT=0,walking=false;
function walkTo(x,z,dur){
 gsap.to(girl.rotation,{y:Math.atan2(x-girl.position.x,z-girl.position.z),duration:.5,ease:"power2.out"});
 walking=true;
 gsap.to(girl.position,{x,z,duration:dur,ease:"power1.inOut",onComplete:()=>{walking=false}});
 return wait(dur*1000);
}
function faceTo(x,z){ gsap.to(girl.rotation,{y:Math.atan2(x-girl.position.x,z-girl.position.z),duration:.5,ease:"power2.out"}) }
function crouch(down){
 gsap.to(pose,{crouch:down?1:0,duration:.75,ease:"power2.inOut"});
 return wait(750);
}

/* ---------- floating pollen ---------- */
const particles=new THREE.Points(
 new THREE.BufferGeometry(),
 new THREE.PointsMaterial({color:0xffdf72,size:.035,transparent:true,opacity:.7,depthWrite:false})
);
const pos=[]; for(let i=0;i<(MOBILE?320:650);i++) pos.push((Math.random()-.5)*40,Math.random()*14-1,-Math.random()*40-4);
particles.geometry.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
scene.add(particles);

/* ---------- UI ---------- */
const $=s=>document.querySelector(s);
const intro=$("#intro"), letter=$("#letter"), photoMoment=$("#photoMoment"), final=$("#final");
const dots=[...document.querySelectorAll("#progress i")];
const hint=$("#hint");
const show=el=>el.classList.add("show");
const hide=el=>el.classList.remove("show","active");   // el intro usa .active, no .show
const setProgress=n=>dots.forEach((d,i)=>d.classList.toggle("on",i<n));
const say=txt=>{ if(txt) hint.textContent=txt; hint.classList.toggle("show",!!txt) };

const letterTexts=[
 "Fernandita, hoy te quiero hacer presente este detalle para decirte gracias por estar ahí para mí, sacarme unas risas y hacerme olvidar mis problemas en una noche.",
 "Se que últimamente hemos estado alejados a tal punto que no hablemos por días, pero eso no ha hecho que te deje de querer ni de considerarte, siempre habrá esa conexión y cariño.",
 "Estos casi 8 meses me he sentido muy bien contigo, ha habido desacuerdos y al inicio distanciamiento, pero siempre lo hemos sabido superar, te quiero mucho Fernandita y no lo digo jugando, te quiero como no tienes idea."
];
function setLetter(i){
 $("#letterText").textContent=letterTexts[i];
 $(".letter-number").textContent=`0${i+1}`;
}

/* Framing: en vertical el fov horizontal se estrecha muchísimo, así que en vez de
   encoger la niña y las flores, se abre el lente y la cámara da un paso atrás.
   FRAME escala cada plano respecto a su punto de mira, así todos los planos
   (general, close-up y lectura) se reencuadran con un solo número. */
let FRAME=1,lastShot={p:{x:0,y:3.2,z:13},look:{x:0,y:1.4,z:-2}};
function fitCamera(){
 camera.aspect=innerWidth/innerHeight;
 const portrait=camera.aspect<1;
 camera.fov=portrait?54:42;
 FRAME=portrait?1.3:1;
 camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
}
function cameraTo(p,look,dur=1.5){
 const c=look||camTarget;
 lastShot={p,look:{x:c.x,y:c.y,z:c.z}};
 gsap.to(camera.position,{
   x:c.x+(p.x-c.x)*FRAME, y:c.y+(p.y-c.y)*FRAME, z:c.z+(p.z-c.z)*FRAME,
   duration:dur,ease:"power3.inOut"
 });
 if(look) gsap.to(camTarget,{...look,duration:dur,ease:"power3.inOut"});
}
fitCamera(); cameraTo(lastShot.p,lastShot.look,0);

/* ---------- the story ---------- */
async function collect(i){
 const l=letters.children[i];
 say("Caminando hacia la carta...");
 cameraTo({x:l.position.x+1.7,y:1.4,z:l.position.z+2.7},{x:l.position.x,y:.4,z:l.position.z},2.4);
 await walkTo(l.position.x+.45,l.position.z+.75,2.6);
 say("");
 faceTo(l.position.x,l.position.z);
 await wait(400);
 cameraTo({x:l.position.x+.85,y:.75,z:l.position.z+1.35},{x:l.position.x,y:.2,z:l.position.z},1.4); // close-up
 await crouch(true);
 openLetter(l);
 await wait(1200);
 await crouch(false);
 setLetter(i);
 cameraTo({x:l.position.x+1.6,y:1.8,z:l.position.z+3.2},{x:l.position.x,y:.9,z:l.position.z},1.6);
 show(letter);
 await clickOnce(".next-letter");
 hide(letter);
 setProgress(i+1);
}

const dawnColor=(c,hex,dur,delay=0)=>{const k=new THREE.Color(hex);gsap.to(c,{r:k.r,g:k.g,b:k.b,duration:dur,delay,ease:"power2.inOut"})};
async function dawnSequence(){
 document.body.classList.add("dawn");
 say("");
 const D=9;
 // la cámara se despega del camino y se gira al horizonte, donde va a salir el sol
 cameraTo({x:0,y:5.6,z:9},{x:0,y:1.9,z:-16},D);
 gsap.to(girl.rotation,{y:Math.PI,duration:2,ease:"power2.inOut"});
 gsap.to(girl.position,{x:0,z:-7,duration:D*.6,ease:"power1.inOut"});

 // 1. la noche se despinta: primero el violeta del alba, luego el degradado entero
 dawnColor(sky.material.color,0x554d70,D*.34);
 dawnColor(sky.material.color,0xffffff,D*.6,D*.34);
 dawnColor(scene.fog.color,0xffbf95,D);
 gsap.to(scene.fog,{density:.012,duration:D,ease:"power2.inOut"});

 // 2. la luna se pone mientras tanto
 moon.material.transparent=true;
 gsap.to(moon.position,{x:-13,y:-2,duration:D*.55,ease:"power1.in"});
 gsap.to(moon.material,{opacity:0,duration:D*.45,ease:"power2.in"});
 gsap.to(moonGlow,{intensity:0,duration:D*.4});

 // 3. el sol rompe el horizonte y se queda cortado por el suelo
 gsap.to(sun.position,{y:-.9,duration:D*.78,delay:D*.16,ease:"sine.out"});
 gsap.to(sunGlow.material,{opacity:.9,duration:D*.55,delay:D*.2});
 gsap.to(renderer,{toneMappingExposure:1.45,duration:D*.5,delay:D*.34});

 // 4. y recién entonces la luz del sol inunda el campo, rasante y de frente
 dawnColor(hemi.color,0xfff0d8,D); dawnColor(hemi.groundColor,0x8d9a5e,D);
 gsap.to(hemi,{intensity:2.6,duration:D});
 dawnColor(keyLight.color,0xffd9a0,D); gsap.to(keyLight,{intensity:4.2,duration:D});
 gsap.to(keyLight.position,{x:-3,y:5.5,z:-22,duration:D,ease:"power2.inOut"});   // contraluz: sombras largas hacia la cámara
 dawnColor(ground.material.color,0x33502c,D);
 dawnColor(particles.material.color,0xfff6dd,D);

 await wait(1800);
 field.visible=true;
 gsap.to(fieldState,{growth:1,duration:D-1,ease:"power2.out"});   // blooms outward
 gsap.to(tulips.scale,{x:1.15,y:1.15,z:1.15,duration:D,ease:"power2.out"});
 music.brighten();
 await wait((D-1)*1000);
}

async function story(){
 await clickOnce("#begin");
 music.start();
 hide(intro);
 girl.visible=true;
 $("#progress").classList.add("show");
 cameraTo({x:2.6,y:2.5,z:8.5},{x:0,y:1.1,z:2},2);
 await wait(600);
 for(let i=0;i<3;i++) await collect(i);
 await dawnSequence();
 show(photoMoment);
 await clickOnce(".memory-next");
 hide(photoMoment);
 cameraTo({x:0,y:2.6,z:2},{x:0,y:1.6,z:-16},2.6);   // flight into the field
 await wait(1900);
 show(final);
 $("#progress").classList.remove("show");
 // slow living drift so the final screen never feels like a static image
 gsap.to(camera.position,{x:5,z:6,duration:38,ease:"sine.inOut",yoyo:true,repeat:-1});
 gsap.to(sun.position,{y:2.2,duration:70,ease:"sine.inOut"});   // el sol sigue subiendo mientras lee
}
story();

$("#replay").addEventListener("click",()=>location.reload());
// al rotar el teléfono se reencuadra el plano actual, no solo el aspect
window.addEventListener("resize",()=>{
 fitCamera();
 cameraTo(lastShot.p,lastShot.look,.5);
});

function animate(){
 const dt=Math.min(clock.getDelta(),.05); t+=dt;

 pose.walk+=((walking?1:0)-pose.walk)*Math.min(1,dt*7);
 if(pose.walk>.001) walkT+=dt*9.5;
 const swing=Math.sin(walkT)*pose.walk*(1-pose.crouch);
 rig.legs[0].rotation.x=swing*.6; rig.legs[1].rotation.x=-swing*.6;
 rig.arms[0].rotation.x=-swing*.5-pose.crouch*1.15;
 rig.arms[1].rotation.x=swing*.5-pose.crouch*1.15;
 rig.g.position.y=Math.abs(Math.sin(walkT))*.06*pose.walk-pose.crouch*.45;
 rig.g.rotation.x=pose.crouch*.6;
 girl.rotation.z=Math.sin(walkT*.5)*.02*pose.walk;

 particles.rotation.y=t*.008;
 tulipSway();
 if(field.visible) windUpdate();

 camera.lookAt(camTarget);
 renderer.render(scene,camera);
}
// un solo reloj para tweens y render: nada se pinta a mitad de un tween, y gsap
// trae lagSmoothing, así que un frame perdido no da un salto
gsap.ticker.add(animate);

/* ---------- music: same little WebAudio box, now toggleable ---------- */
/* ---------- piano: síntesis aditiva + martillo + reverb, sin samples ---------- */
const music=(()=>{
 const VOL=.32;
 const SEMI={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
 // "C#4" -> Hz
 const hz=n=>440*Math.pow(2,(SEMI[n[0]]+(n[1]==="#"?1:0)+(+n.slice(-1)+1)*12-69)/12);

 // Descenso tipo Canon: la progresión romántica por excelencia
 const PROG=[
  ["C2",["C3","E3","G3","C4"]],
  ["B1",["B2","D3","G3","B3"]],
  ["A1",["A2","C3","E3","A3"]],
  ["G1",["G2","C3","E3","G3"]],
  ["F1",["F2","A2","C3","F3"]],
  ["E1",["E2","G2","C3","E3"]],
  ["D2",["D3","F3","A3","C4"]],
  ["G1",["G2","B2","D3","F3"]]
 ];
 const ARP=[0,1,2,3,2,1,3,2];                    // ocho corcheas, mano izquierda
 const MEL=[                                     // melodía escrita, no notas al azar
  [[0,"E5",1.5],[1.5,"G5",.5],[2,"C6",2]],
  [[0,"B5",1],[1,"A5",1],[2,"G5",2]],
  [[0,"A5",1.5],[1.5,"C6",.5],[2,"E6",2]],
  [[0,"D6",1],[1,"C6",1],[2,"B5",2]],
  [[0,"A5",1.5],[1.5,"F5",.5],[2,"G5",2]],
  [[0,"E5",1],[1,"G5",1],[2,"C6",2]],
  [[0,"D6",1],[1,"C6",1],[2,"A5",1],[3,"F5",1]],
  [[0,"G5",2],[2,"B5",1],[3,"D6",1]]
 ];

 let ctx,master,tone,dry,wet,noiseBuf,bar=0,next=0,tempo=64,bright=false,on=true;

 function impulse(sec,decay){
   const len=ctx.sampleRate*sec,buf=ctx.createBuffer(2,len,ctx.sampleRate);
   for(let c=0;c<2;c++){
     const d=buf.getChannelData(c);
     for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
   }
   return buf;
 }
 // cuerpo de la nota: parciales con afinación estirada = timbre de piano
 const PARTIALS=[[1,1],[2,.4],[3,.17],[4,.08],[5,.04],[6,.02]].slice(0,MOBILE?4:6);
 function piano(note,at,beats,vel){
   const f=hz(note),beat=60/tempo,dur=beats*beat;
   const env=ctx.createGain(); env.connect(tone);
   env.gain.setValueAtTime(.0001,at);
   env.gain.exponentialRampToValueAtTime(vel,at+.008);
   env.gain.exponentialRampToValueAtTime(vel*.3,at+.4);       // caída del golpe
   env.gain.exponentialRampToValueAtTime(.0001,at+dur+1.6);   // cola con pedal
   for(const [h,a] of PARTIALS){
     if(f*h>12000) break;
     const o=ctx.createOscillator(),g=ctx.createGain();
     o.type=h===1?"triangle":"sine";
     o.frequency.value=f*h*(1+.0006*h*h);   // inarmonicidad: sin esto suena a órgano
     g.gain.value=a;
     o.connect(g); g.connect(env); o.start(at); o.stop(at+dur+1.8);
   }
   const thud=ctx.createBufferSource(),tg=ctx.createGain(),tf=ctx.createBiquadFilter();
   thud.buffer=noiseBuf; tf.type="bandpass"; tf.frequency.value=f*2.2; tf.Q.value=.7;
   tg.gain.setValueAtTime(vel*.5,at); tg.gain.exponentialRampToValueAtTime(.0001,at+.09);
   thud.connect(tf); tf.connect(tg); tg.connect(env); thud.start(at); thud.stop(at+.1);
 }

 function scheduleBar(){
   const beat=60/tempo,barLen=beat*4,b=bar%8,[bass,chord]=PROG[b],swell=.85+.15*Math.sin(bar*.6);
   if(next<ctx.currentTime) next=ctx.currentTime+.06;   // volver de segundo plano sin avalancha
   const t0=next;
   piano(bass,t0,4,.19*swell);
   ARP.forEach((k,i)=>piano(chord[k],t0+i*beat*.5,.5,(i%2?.055:.075)*swell));
   for(const [off,n,d] of MEL[b]){
     piano(n,t0+off*beat,d,.13*swell);
     if(bright) piano(n.slice(0,-1)+(+n.slice(-1)-1),t0+off*beat,d,.05*swell);  // octava grave al amanecer
   }
   bar++; next=t0+barLen;
   setTimeout(scheduleBar,Math.max(30,(next-ctx.currentTime-.25)*1000));
 }

 return {
   start(){
     const Ctx=window.AudioContext||window.webkitAudioContext;
     if(!Ctx||ctx)return;
     ctx=new Ctx();
     ctx.resume();   // iOS arranca el contexto suspendido aunque venga de un tap

     noiseBuf=impulse(.12,1);
     master=ctx.createGain(); master.gain.value=VOL;
     const comp=ctx.createDynamicsCompressor();   // red por si coinciden muchas colas
     master.connect(comp); comp.connect(ctx.destination);

     tone=ctx.createBiquadFilter(); tone.type="lowpass"; tone.frequency.value=2600; tone.Q.value=.4;
     const rev=ctx.createConvolver(); rev.buffer=impulse(3.2,2.4);
     dry=ctx.createGain(); dry.gain.value=.8;
     wet=ctx.createGain(); wet.gain.value=.42;
     tone.connect(dry); dry.connect(master);
     tone.connect(rev); rev.connect(wet); wet.connect(master);

     addEventListener("visibilitychange",()=>{document.hidden?ctx.suspend():ctx.resume()});
     next=ctx.currentTime+.3;
     scheduleBar();
   },
   // amanecer: más luz, un poco más de aire y algo más de movimiento
   brighten(){
     if(!ctx)return;
     bright=true; tempo=72;
     tone.frequency.linearRampToValueAtTime(4200,ctx.currentTime+6);
     wet.gain.linearRampToValueAtTime(.55,ctx.currentTime+6);
   },
   toggle(){ if(!ctx)return on; on=!on; master.gain.linearRampToValueAtTime(on?VOL:0,ctx.currentTime+.5); return on }
 };
})();
$("#sound").addEventListener("click",()=>{
 const on=music.toggle();
 $("#sound").classList.toggle("off",!on);
 $("#sound b").textContent=on?"on":"off";
});

setTimeout(()=>{$("#loading").style.opacity=0;setTimeout(()=>$("#loading").remove(),800)},700);
