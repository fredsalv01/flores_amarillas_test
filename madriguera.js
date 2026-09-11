import * as THREE from "three";

// ponytail: un flag decide todos los recortes de móvil
const MOBILE=matchMedia("(pointer:coarse)").matches&&Math.min(innerWidth,innerHeight)<900;

const canvas=document.querySelector("#scene");
const renderer=new THREE.WebGLRenderer({canvas,antialias:!MOBILE,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,MOBILE?1.5:1.75));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.18;
// ponytail: sin shadowMap. Dentro de un túnel no se leen, y la mancha bajo la
// ratoncita da el contacto con el suelo por 1 draw call en vez de un pase entero.

const SPEED=matchMedia("(prefers-reduced-motion: reduce)").matches?4:1;
gsap.globalTimeline.timeScale(SPEED);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x120b08);
scene.fog=new THREE.FogExp2(0x1c110b,.042);   // la niebla cálida es lo que hace que el túnel no sea una cueva
const camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.1,140);
const clock=new THREE.Clock();
let t=0;

const $=s=>document.querySelector(s);
const tex=new THREE.TextureLoader();
const UP=new THREE.Vector3(0,1,0);
const tmp=new THREE.Vector3(),tmp2=new THREE.Vector3();

/* ---------- la madriguera ----------
   Una curva, un tubo y un suelo plano. El tubo va centrado en y=0 y el suelo lo
   corta justo por la mitad: la mitad de abajo queda enterrada y arriba queda la
   bóveda. Dos mallas para todo el pasillo, y el suelo plano es además el blanco
   del raycast para caminar. */
const PATH=new THREE.CatmullRomCurve3([
 [0,0,8],[0,0,1],[-4.5,0,-8],[-2,0,-18],[4,0,-26],[3,0,-36],[-3.5,0,-45],[-1,0,-55],[0,0,-62]
].map(a=>new THREE.Vector3(...a)));
const LEN=PATH.getLength();
const R=4.2;   // más ancho: ahora entran objetos de 2.5 contra 1.6 de ratoncita

const tunnel=new THREE.Mesh(
 new THREE.TubeGeometry(PATH,MOBILE?110:190,R,MOBILE?10:14,false),
 new THREE.MeshStandardMaterial({color:0x6f4a31,roughness:1,side:THREE.BackSide,flatShading:true})
);
scene.add(tunnel);

const floor=new THREE.Mesh(
 new THREE.PlaneGeometry(90,170),
 new THREE.MeshStandardMaterial({color:0x4b3524,roughness:1})
);
floor.rotation.x=-Math.PI/2; floor.position.set(0,0,-27); scene.add(floor);

// raíces colgando: lo único que hace que la bóveda no parezca un tubo liso
const rootMat=new THREE.MeshStandardMaterial({color:0x3d2a1c,roughness:1});
const rootGeo=new THREE.CylinderGeometry(.02,.06,1,4);
const roots=new THREE.InstancedMesh(rootGeo,rootMat,MOBILE?60:120);
const dummy=new THREE.Object3D();
for(let i=0;i<roots.count;i++){
 const u=Math.random(),p=PATH.getPointAt(u),tan=PATH.getTangentAt(u);
 const side=tmp.crossVectors(tan,UP).normalize();
 const a=(Math.random()-.5)*1.9;                        // ángulo en la bóveda
 dummy.position.copy(p).addScaledVector(side,Math.sin(a)*R*.92).setY(Math.cos(a)*R*.92);
 dummy.rotation.set((Math.random()-.5)*.8,Math.random()*3,(Math.random()-.5)*.8);
 dummy.scale.set(1,.5+Math.random()*1.4,1);
 dummy.updateMatrix(); roots.setMatrixAt(i,dummy.matrix);
}
scene.add(roots);

/* ---------- luz ---------- */
scene.add(new THREE.HemisphereLight(0xffd9a8,0x2a1a10,.35));
// farol que va con ella: dentro de un túnel, si la protagonista no se ve, no hay historia
const lamp=new THREE.PointLight(0xffc885,2.6,14,1.6); scene.add(lamp);
const endGlow=new THREE.PointLight(0xffd85e,3.4,26,1.4);   // el amarillo del final, asomando
endGlow.position.copy(PATH.getPointAt(1)).setY(1.6); scene.add(endGlow);

/* ---------- la ratoncita ---------- */
function makeMouse(){
 const g=new THREE.Group();
 const fur=new THREE.MeshStandardMaterial({color:0xbaa89b,roughness:.85});
 const skin=new THREE.MeshStandardMaterial({color:0xe9b4b9,roughness:.7});
 const dress=new THREE.MeshStandardMaterial({color:0xd2718a,roughness:.85,side:THREE.DoubleSide});
 const dark=new THREE.MeshStandardMaterial({color:0x241a18,roughness:.5});

 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.26,.42,6,12),fur); body.position.y=.74; g.add(body);
 const skirt=new THREE.Mesh(new THREE.ConeGeometry(.42,.5,14,1,true),dress); skirt.position.y=.54; g.add(skirt);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.3,16,12),fur); head.position.set(0,1.2,.02); head.scale.set(1,.95,1.05); g.add(head);
 const snout=new THREE.Mesh(new THREE.ConeGeometry(.14,.32,10),fur); snout.rotation.x=Math.PI/2; snout.position.set(0,1.13,.3); g.add(snout);
 const nose=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),skin); nose.position.set(0,1.14,.45); g.add(nose);
 for(const side of [-1,1]){
   const ear=new THREE.Mesh(new THREE.SphereGeometry(.17,12,10),fur); ear.scale.set(1,1,.35); ear.position.set(side*.22,1.42,-.02); g.add(ear);
   const inner=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),skin); inner.scale.set(1,1,.3); inner.position.set(side*.23,1.42,.03); g.add(inner);
   const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),dark); eye.position.set(side*.12,1.24,.25); g.add(eye);
 }
 // cola: tubo fijo, el meneo es rotar el grupo entero
 const tailG=new THREE.Group(); tailG.position.set(0,.58,-.24); g.add(tailG);
 tailG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
   new THREE.Vector3(0,0,0),new THREE.Vector3(.05,.12,-.42),
   new THREE.Vector3(-.1,.42,-.62),new THREE.Vector3(.14,.68,-.42)
 ]),16,.045,6),skin));
 const legs=[],arms=[];
 for(const side of [-1,1]){
   const hip=new THREE.Group(); hip.position.set(side*.13,.44,0); g.add(hip); legs.push(hip);
   const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.2,4,8),fur); leg.position.y=-.14; hip.add(leg);
   const foot=new THREE.Mesh(new THREE.SphereGeometry(.1,10,8),skin); foot.scale.set(1,.5,1.5); foot.position.set(0,-.3,.06); hip.add(foot);
   const sh=new THREE.Group(); sh.position.set(side*.28,.96,0); g.add(sh); arms.push(sh);
   const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.22,4,8),fur); arm.position.y=-.13; sh.add(arm);
 }
 return {g,legs,arms,tailG};
}
const rig=makeMouse();
const mouse=new THREE.Group(); mouse.add(rig.g); scene.add(mouse);

// mancha de contacto: más barata y más legible que una sombra real aquí
function radialTex(inner,outer){
 const c=document.createElement("canvas"); c.width=c.height=128;
 const x=c.getContext("2d"),g=x.createRadialGradient(64,64,0,64,64,64);
 g.addColorStop(0,inner); g.addColorStop(1,outer);
 x.fillStyle=g; x.fillRect(0,0,128,128);
 return new THREE.CanvasTexture(c);
}
const blob=new THREE.Mesh(
 new THREE.PlaneGeometry(1.5,1.5),
 new THREE.MeshBasicMaterial({map:radialTex("rgba(0,0,0,.5)","rgba(0,0,0,0)"),transparent:true,depthWrite:false})
);
blob.rotation.x=-Math.PI/2; blob.position.y=.02; scene.add(blob);

/* ---------- moverse por el túnel ----------
   La ratoncita no vive en (x,z) sino en (u a lo largo de la curva, lat a los
   lados). Así nunca puede atravesar una pared por mucho que toques fuera: el
   destino se convierte a ese espacio y se recorta, y no hace falta colisión. */
const SEG=260,SAMP=[];
for(let i=0;i<=SEG;i++){
 const u=i/SEG,p=PATH.getPointAt(u),tan=PATH.getTangentAt(u);
 SAMP.push({u,p,side:new THREE.Vector3().crossVectors(tan,UP).normalize()});
}
const LAT_MAX=R*.44;   // el pasillo caminable, más estrecho que el túnel: no entra en los objetos
function toPath(point){
 let best=SAMP[0],bd=Infinity;
 for(const s of SAMP){ const d=s.p.distanceToSquared(point); if(d<bd){bd=d;best=s} }
 const lat=THREE.MathUtils.clamp(tmp.subVectors(point,best.p).dot(best.side),-LAT_MAX,LAT_MAX);
 return {u:best.u,lat};
}
function placeAt(u,lat,out){
 const p=PATH.getPointAt(THREE.MathUtils.clamp(u,0,1));
 const tan=PATH.getTangentAt(THREE.MathUtils.clamp(u,0,1));
 return out.copy(p).addScaledVector(tmp2.crossVectors(tan,UP).normalize(),lat);
}

const walker={u:.03,lat:0};
let walking=false,walkT=0,facing=0,paused=true;
const prevPos=new THREE.Vector3();
placeAt(walker.u,walker.lat,prevPos);
mouse.position.copy(prevPos);

function walkTo(u,lat){
 const d=Math.abs(u-walker.u)*LEN+Math.abs(lat-walker.lat);
 if(d<.25) return;
 walking=true;
 gsap.killTweensOf(walker);
 gsap.to(walker,{u,lat,duration:Math.min(d/2.7,9),ease:"power1.inOut",onComplete:()=>{walking=false}});
}

// marca de destino: sin esto no sabes si el toque registró
const ring=new THREE.Mesh(new THREE.RingGeometry(.28,.38,24),new THREE.MeshBasicMaterial({color:0xffc885,transparent:true,opacity:0,depthWrite:false}));
ring.rotation.x=-Math.PI/2; scene.add(ring);
function pingAt(p){
 ring.position.copy(p).setY(.03); ring.scale.setScalar(.6);
 gsap.killTweensOf([ring.scale,ring.material]);
 gsap.fromTo(ring.material,{opacity:.9},{opacity:0,duration:.75,ease:"power2.out"});
 gsap.to(ring.scale,{x:1.6,y:1.6,duration:.75,ease:"power2.out"});
}

/* ---------- farolitos colgados de la bóveda ---------- */
const lanterns=[];
function makeLantern(u,lat,power=2.1){
 const g=new THREE.Group();
 placeAt(u,lat,g.position);
 const top=Math.sqrt(Math.max(R*R-lat*lat,1))-.06;   // el punto de la bóveda justo encima
 g.position.y=top;
 const drop=top-2.5;
 const dark=new THREE.MeshStandardMaterial({color:0x33241a,roughness:.7,metalness:.25});
 const cord=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,drop,5),new THREE.MeshStandardMaterial({color:0x2b1d15,roughness:1}));
 cord.position.y=-drop/2; g.add(cord);
 const cap=new THREE.Mesh(new THREE.ConeGeometry(.21,.2,8),dark); cap.position.y=-drop-.04; g.add(cap);
 const glass=new THREE.Mesh(new THREE.SphereGeometry(.2,12,10),new THREE.MeshBasicMaterial({color:0xffd79a}));
 glass.position.y=-drop-.28; g.add(glass);
 const foot=new THREE.Mesh(new THREE.CylinderGeometry(.09,.14,.12,8),dark); foot.position.y=-drop-.5; g.add(foot);
 const light=new THREE.PointLight(0xffb974,power,13,1.5);
 light.position.y=-drop-.28; g.add(light);
 g.userData.p=Math.random()*7;                       // cada uno se mece a su ritmo
 scene.add(g); lanterns.push(g);
}

/* ---------- los objetos: todo primitivas, ~2.5 de alto contra 1.6 de ratoncita ---------- */
function makeSpool(){                                 // carrete de hilo
 const g=new THREE.Group();
 const wood=new THREE.MeshStandardMaterial({color:0xbb8c52,roughness:.85,flatShading:true});
 const yarn=new THREE.MeshStandardMaterial({color:0xd2718a,roughness:.95});
 for(const y of [.09,2.36]){
   const f=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,.18,22),wood); f.position.y=y; g.add(f);
 }
 const core=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,2.3,14),wood); core.position.y=1.22; g.add(core);
 const wound=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1.9,20),yarn); wound.position.y=1.22; g.add(wound);
 for(const y of [.62,1.22,1.82]){                     // vueltas sueltas, para que se vea hilo y no un cilindro
   const w=new THREE.Mesh(new THREE.TorusGeometry(1.01,.055,6,20),yarn);
   w.rotation.x=Math.PI/2; w.position.y=y; g.add(w);
 }
 // la hebra que se escapa hasta el suelo
 const strand=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
   new THREE.Vector3(.98,1.5,.1),new THREE.Vector3(1.5,1,.5),
   new THREE.Vector3(1.4,.12,1.2),new THREE.Vector3(.6,.05,1.9)
 ]),20,.05,5),yarn);
 g.add(strand);
 return g;
}
function makeStrawberries(){                          // fresas
 const g=new THREE.Group();
 const prof=[[0,0],[.28,.16],[.5,.42],[.62,.75],[.56,1.02],[.3,1.14],[.06,1.18]].map(a=>new THREE.Vector2(...a));
 const berryGeo=new THREE.LatheGeometry(prof,16);
 const red=new THREE.MeshStandardMaterial({color:0xd8342f,roughness:.45});
 const leaf=new THREE.MeshStandardMaterial({color:0x4c8b3a,roughness:.8,side:THREE.DoubleSide});
 const seedGeo=new THREE.SphereGeometry(.032,6,5);
 const seeds=new THREE.InstancedMesh(seedGeo,new THREE.MeshStandardMaterial({color:0xf7e08a,roughness:.6}),54);
 let sn=0;
 // se reparten a lo largo del túnel, no hacia la pared: así el grupo no se ancha
 [[0,0,2.1],[-1.15,.1,1.5],[1.2,-.15,1.25]].forEach(([x,z,s])=>{
   const b=new THREE.Mesh(berryGeo,red);
   b.position.set(x,0,z); b.scale.setScalar(s); b.rotation.y=Math.random()*3; g.add(b);
   for(let i=0;i<18&&sn<seeds.count;i++,sn++){        // pepitas pegadas al perfil de la fresa
     const f=.12+Math.random()*.75,k=f*(prof.length-1),j=Math.floor(k),p0=prof[j],p1=prof[Math.min(j+1,prof.length-1)],l=k-j;
     const r=(p0.x+(p1.x-p0.x)*l)*.97,y=(p0.y+(p1.y-p0.y)*l),a=Math.random()*Math.PI*2;
     dummy.position.set(x+Math.cos(a)*r*s,y*s,z+Math.sin(a)*r*s);
     dummy.rotation.set(0,0,0); dummy.scale.setScalar(s);
     dummy.updateMatrix(); seeds.setMatrixAt(sn,dummy.matrix);
   }
   for(let i=0;i<5;i++){                              // corona: lo que hace que se lea "fresa"
     const l=new THREE.Mesh(new THREE.ConeGeometry(.16,.42,4),leaf);
     l.position.set(x,1.1*s,z); l.rotation.set(-1.15,i*1.257,0); l.scale.setScalar(s); g.add(l);
   }
   const stem=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.3,6),leaf);
   stem.position.set(x,1.26*s,z); stem.scale.setScalar(s); g.add(stem);
 });
 seeds.count=sn; g.add(seeds);
 return g;
}
function makeCheese(){                                // trozo de queso
 const s=new THREE.Shape();
 s.moveTo(-1.2,0); s.lineTo(1.2,0); s.lineTo(-1.2,2.05); s.closePath();
 // los agujeros pasantes del extruido son literalmente los agujeros del queso
 for(const [x,y,r] of [[-.4,.4,.28],[.3,.3,.2],[-.68,1,.2],[-.15,.82,.14],[-.82,1.5,.13]])
   s.holes.push(new THREE.Path().absarc(x,y,r,0,Math.PI*2,true));
 const geo=new THREE.ExtrudeGeometry(s,{depth:1,bevelEnabled:true,bevelSize:.05,bevelThickness:.05,bevelSegments:1});
 geo.translate(0,0,-.5);
 const g=new THREE.Group();
 g.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xf2c04a,roughness:.7})));
 return g;
}
function makeApple(){                                 // manzana
 const g=new THREE.Group();
 const prof=[[0,.1],[.55,0],[1.05,.3],[1.25,.95],[1.05,1.62],[.5,1.9],[.15,1.74],[0,1.78]].map(a=>new THREE.Vector2(...a));
 g.add(new THREE.Mesh(new THREE.LatheGeometry(prof,20),new THREE.MeshStandardMaterial({color:0xc5332e,roughness:.35})));
 const stem=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.52,6),new THREE.MeshStandardMaterial({color:0x5a3a22,roughness:.9}));
 stem.position.set(.05,2,0); stem.rotation.z=-.18; g.add(stem);
 const leaf=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),new THREE.MeshStandardMaterial({color:0x4c8b3a,roughness:.8}));
 leaf.scale.set(1,.14,.55); leaf.position.set(.42,2.12,.05); leaf.rotation.z=.35; g.add(leaf);
 return g;
}

/* ---------- los recuerdos: objeto detrás, polaroid apoyada delante ---------- */
const MEMORIES=[
 {u:.17,side:-1,lat:2.55,shape:makeSpool,photo:"assets/photos/foto1.jpeg",
  text:"Lo primero que encontró fue esto. Y pensó que si algo merecía guardarse, era justo ese día."},
 {u:.38,side:1,lat:2.5,shape:makeStrawberries,photo:"assets/photos/foto2.jpeg",
  text:"Hay risas que uno se lleva puestas mucho después. Esta es una de esas."},
 {u:.62,side:-1,lat:2.5,shape:makeCheese,photo:"assets/photos/foto3.jpeg",
  text:"Incluso cuando estuvimos lejos, esto seguía aquí abajo, esperándote intacto."},
 {u:.83,side:1,lat:2.35,shape:makeApple,photo:"assets/photos/foto4.jpeg",
  text:"Y todavía nos queda muchísimo por meter en esta madriguera."}
];
const POL_Y=.72;                                      // la polaroid se apoya en el suelo, no sobre el objeto
const polaroids=[];
MEMORIES.forEach(m=>{
 const g=new THREE.Group();
 placeAt(m.u,m.side*m.lat,g.position);                // fuera del pasillo caminable
 g.lookAt(placeAt(m.u,0,tmp2.clone()));               // +Z mira al centro del túnel
 const obj=m.shape();
 obj.rotation.y=(Math.random()-.5)*.5; g.add(obj);

 const pol=new THREE.Group();
 pol.position.set((Math.random()-.5)*.3,POL_Y,1.15);  // delante del objeto
 pol.rotation.set(-.13,(Math.random()-.5)*.35,(Math.random()-.5)*.1);
 g.add(pol);
 const frameMat=new THREE.MeshStandardMaterial({color:0xfbf6ea,roughness:.75,emissive:0xffbb66,emissiveIntensity:0});
 pol.add(new THREE.Mesh(new THREE.BoxGeometry(1.15,1.35,.04),frameMat));
 // la foto va arriba: el borde gordo de abajo es lo que hace que se lea "polaroid"
 const photoMat=new THREE.MeshStandardMaterial({color:0x2a2320,roughness:.6});
 tex.load(m.photo,tx=>{
   tx.colorSpace=THREE.SRGBColorSpace;
   const a=tx.image.width/tx.image.height;            // recorte tipo cover en un cuadrado
   if(a>1){ tx.repeat.set(1/a,1); tx.offset.x=(1-1/a)/2 } else { tx.repeat.set(1,a); tx.offset.y=(1-a)/2 }
   photoMat.map=tx; photoMat.color.set(0xffffff); photoMat.needsUpdate=true;
 },null,()=>{});                                       // si la foto aún no existe, queda el papel vacío
 const photo=new THREE.Mesh(new THREE.PlaneGeometry(.96,.96),photoMat);
 photo.position.set(0,.14,.025); pol.add(photo);

 scene.add(g);
 makeLantern(m.u,m.side*1.15,2.4);                     // cada recuerdo tiene su farol encima
 polaroids.push({...m,g,pol,frameMat,seen:false});
});
for(const u of (MOBILE?[.5]:[.06,.28,.5,.73,.95])) makeLantern(u,(Math.random()-.5)*1.4,1.7);

/* ---------- UI ---------- */
const intro=$("#intro"),memoryScreen=$("#memory"),hint=$("#hint");
const dots=[...document.querySelectorAll("#progress i")];
const show=el=>el.classList.add("show");
const hide=el=>el.classList.remove("show","active");
const say=txt=>{ if(txt) hint.textContent=txt; hint.classList.toggle("show",!!txt) };
let seen=0,near=-1,focus=null;

function openMemory(i){
 const m=polaroids[i];
 if(m.seen) return;
 m.seen=true; paused=true; focus=m; say("");
 gsap.killTweensOf(walker); walking=false;
 gsap.to(m.pol.position,{y:1.65,duration:.9,ease:"back.out(1.5)"});
 gsap.to(m.frameMat,{emissiveIntensity:.55,duration:.6});
 $("#memoryPhoto").src=m.photo;
 $("#memoryText").textContent=m.text;
 setTimeout(()=>show(memoryScreen),700/SPEED);
 dots[i].classList.add("on");
 seen++;
}
$(".memory-next").addEventListener("click",()=>{
 hide(memoryScreen);
 gsap.to(focus.pol.position,{y:POL_Y,duration:.7,ease:"power2.inOut"});
 gsap.to(focus.frameMat,{emissiveIntensity:0,duration:.6});
 focus=null; paused=false;
 say(seen<polaroids.length?"Sigue caminando":"Al fondo hay algo amarillo...");
});

/* ---------- tocar el suelo para caminar ---------- */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
addEventListener("pointerdown",e=>{
 if(paused||e.target!==canvas) return;
 if(near>=0){ openMemory(near); return }      // si está al lado de un recuerdo, el toque lo abre
 ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);
 ray.setFromCamera(ndc,camera);
 const hit=ray.intersectObject(floor)[0];
 if(!hit) return;
 const to=toPath(hit.point);
 pingAt(placeAt(to.u,to.lat,tmp2.clone()));
 walkTo(to.u,to.lat);
});

/* ---------- encuadre ---------- */
function fitCamera(){
 camera.aspect=innerWidth/innerHeight;
 camera.fov=camera.aspect<1?58:46;            // en vertical el lente se abre o no cabe el túnel
 camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
}
fitCamera();
addEventListener("resize",fitCamera);

const camPos=new THREE.Vector3(),camLook=new THREE.Vector3(),lookAt=new THREE.Vector3();
placeAt(walker.u-.05,0,camPos); camPos.y=2.4;
camera.position.copy(camPos);
lookAt.copy(mouse.position).setY(1.1); camera.lookAt(lookAt);

function animate(){
 const dt=Math.min(clock.getDelta(),.05); t+=dt;

 // colocar a la ratoncita en el túnel y orientarla según hacia dónde se movió
 placeAt(walker.u,walker.lat,mouse.position);
 const moved=tmp.subVectors(mouse.position,prevPos);
 if(moved.lengthSq()>1e-6){
   const yaw=Math.atan2(moved.x,moved.z);
   facing+=Math.atan2(Math.sin(yaw-facing),Math.cos(yaw-facing))*Math.min(1,dt*8);
 }
 prevPos.copy(mouse.position);
 mouse.rotation.y=facing;
 blob.position.set(mouse.position.x,.02,mouse.position.z);

 // ciclo de caminado
 const w=walking?1:0;
 walkT+=dt*(walking?11:0);
 const swing=Math.sin(walkT)*w;
 rig.legs[0].rotation.x=swing*.7; rig.legs[1].rotation.x=-swing*.7;
 rig.arms[0].rotation.x=-swing*.55; rig.arms[1].rotation.x=swing*.55;
 rig.g.position.y=Math.abs(Math.sin(walkT))*.05*w;
 rig.tailG.rotation.y=Math.sin(t*3+walkT*.5)*.3;   // la cola se menea siempre, quieta o andando
 lamp.position.set(mouse.position.x,2.3,mouse.position.z);
 for(const l of lanterns) l.rotation.z=Math.sin(t*.62+l.userData.p)*.045;

 // ¿hay un recuerdo al alcance?
 let n=-1;
 for(let i=0;i<polaroids.length;i++){
   const m=polaroids[i];
   if(!m.seen&&Math.abs(walker.u-m.u)*LEN<2.6) n=i;
 }
 if(n!==near&&!paused){
   near=n;
   if(n>=0){ gsap.to(polaroids[n].frameMat,{emissiveIntensity:.3,duration:.5}); say("Toca para ver el recuerdo") }
   else say("Toca el suelo para caminar");
 }
 if(near>=0&&polaroids[near]&&!polaroids[near].seen)
   polaroids[near].pol.position.y=POL_Y+Math.sin(t*2.4)*.035;   // late, para que se note que es tocable

 // cámara: detrás de ella sobre la propia curva, así nunca entra en una pared
 if(focus){
   focus.g.getWorldPosition(camLook); camLook.y+=1.15;
   camPos.copy(camLook).addScaledVector(tmp.subVectors(mouse.position,camLook).setY(0).normalize(),2.4).setY(1.9);
 }else{
   placeAt(walker.u-2.6/LEN,walker.lat*.5,camPos); camPos.y=2.5;
   camLook.copy(mouse.position).setY(1.1);
 }
 camera.position.lerp(camPos,1-Math.exp(-dt*(focus?3.2:2.4)));
 lookAt.lerp(camLook,1-Math.exp(-dt*4.5));
 camera.lookAt(lookAt);

 renderer.render(scene,camera);
}
gsap.ticker.add(animate);   // un solo reloj para tweens y render

/* ---------- arranque ---------- */
$("#begin").addEventListener("click",()=>{
 hide(intro);
 paused=false;
 $("#progress").classList.add("show");
 say("Toca el suelo para caminar");
});
setTimeout(()=>{$("#loading").style.opacity=0;setTimeout(()=>$("#loading").remove(),800)},700);
