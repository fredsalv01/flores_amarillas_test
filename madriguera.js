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
const wait=ms=>new Promise(r=>setTimeout(r,ms/SPEED));

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
function makeMouse(o={}){
 const g=new THREE.Group();
 const fur=new THREE.MeshStandardMaterial({color:o.fur??0xbaa89b,roughness:.85});
 const skin=new THREE.MeshStandardMaterial({color:0xe9b4b9,roughness:.7});
 const dress=new THREE.MeshStandardMaterial({color:o.acc??0xd2718a,roughness:.85,side:THREE.DoubleSide});
 const dark=new THREE.MeshStandardMaterial({color:0x241a18,roughness:.5});

 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.26,.42,6,12),fur); body.position.y=.74; g.add(body);
 if(o.boy){                                    // pajarita en vez de falda: se distinguen de un vistazo
   for(const side of [-1,1]){
     const w=new THREE.Mesh(new THREE.ConeGeometry(.11,.17,7),dress);
     w.position.set(side*.12,.99,.23); w.rotation.z=side*Math.PI/2; g.add(w);
   }
   const knot=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),dress); knot.position.set(0,.99,.25); g.add(knot);
 }else{
   const skirt=new THREE.Mesh(new THREE.ConeGeometry(.42,.5,14,1,true),dress); skirt.position.y=.54; g.add(skirt);
 }
 // la cabeza en su propio grupo, con el pivote en el cuello: asi puede mirar
 // alrededor sin que el hocico se quede atras
 const headG=new THREE.Group(); headG.position.y=1.05; g.add(headG);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.3,16,12),fur); head.position.set(0,.15,.02); head.scale.set(1,.95,1.05); headG.add(head);
 const snout=new THREE.Mesh(new THREE.ConeGeometry(.14,.32,10),fur); snout.rotation.x=Math.PI/2; snout.position.set(0,.08,.3); headG.add(snout);
 const nose=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),skin); nose.position.set(0,.09,.45); headG.add(nose);
 const ears=[],eyes=[];
 for(const side of [-1,1]){
   const ear=new THREE.Mesh(new THREE.SphereGeometry(.17,12,10),fur); ear.scale.set(1,1,.35); ear.position.set(side*.22,.37,-.02); headG.add(ear); ears.push(ear);
   const inner=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),skin); inner.scale.set(1,1,.3); inner.position.set(side*.23,.37,.03); headG.add(inner);
   const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),dark); eye.position.set(side*.12,.19,.25); headG.add(eye); eyes.push(eye);
 }
 // cola: tubo fijo, el meneo es rotar el grupo entero
 const tailG=new THREE.Group(); tailG.position.set(0,.58,-.24); g.add(tailG);
 tailG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
   new THREE.Vector3(0,0,0),new THREE.Vector3(.05,.12,-.42),
   new THREE.Vector3(-.1,.42,-.62),new THREE.Vector3(.14,.68,-.42)
 ]),16,.045,6),skin));
 const legs=[],arms=[],hands=[];
 for(const side of [-1,1]){
   const hip=new THREE.Group(); hip.position.set(side*.13,.44,0); g.add(hip); legs.push(hip);
   const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.2,4,8),fur); leg.position.y=-.14; hip.add(leg);
   const foot=new THREE.Mesh(new THREE.SphereGeometry(.1,10,8),skin); foot.scale.set(1,.5,1.5); foot.position.set(0,-.3,.06); hip.add(foot);
   const sh=new THREE.Group(); sh.position.set(side*.28,.96,0); g.add(sh); arms.push(sh);
   const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.22,4,8),fur); arm.position.y=-.13; sh.add(arm);
   const hand=new THREE.Group(); hand.position.y=-.27; sh.add(hand); hands.push(hand);   // donde se agarra el ramo
 }
 return {g,legs,arms,hands,tailG,headG,body,ears,eyes};
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
const LAT_MAX=R*.17;   // carril central: andar de lado no aporta nada y la metia dentro de los trastos
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

const walker={u:.09,lat:0,walking:false,walkT:0,facing:0,armLift:0,p:1.7,prev:new THREE.Vector3()};
const boyS={u:0,lat:.85,walking:false,walkT:0,facing:0,armLift:0,p:4.3,prev:new THREE.Vector3()};
let paused=true,finaleOn=false,finalCam=null,introCam=true;
placeAt(walker.u,walker.lat,walker.prev);
mouse.position.copy(walker.prev);

// ponytail: un solo paso de animacion para las dos ratoncitas
function stepWalker(st,grp,r,dt){
 if(st.free) grp.position.copy(st.free);        // en la sala ya no hay curva que seguir
 else placeAt(st.u,st.lat,grp.position);
 const moved=tmp.subVectors(grp.position,st.prev);
 if(moved.lengthSq()>1e-6){
   const yaw=Math.atan2(moved.x,moved.z);
   st.facing+=Math.atan2(Math.sin(yaw-st.facing),Math.cos(yaw-st.facing))*Math.min(1,dt*8);
 }
 st.prev.copy(grp.position);
 if(st.faceYaw!==undefined)   // en el final se miran el uno al otro, no hacia donde andaban
   st.facing+=Math.atan2(Math.sin(st.faceYaw-st.facing),Math.cos(st.faceYaw-st.facing))*Math.min(1,dt*4);
 grp.rotation.y=st.facing;
 const w=st.walking?1:0;
 st.walkT+=dt*(st.walking?11:0);
 const swing=Math.sin(st.walkT)*w;
 r.legs[0].rotation.x=swing*.7; r.legs[1].rotation.x=-swing*.7;
 r.arms[0].rotation.x=-swing*.55+st.armLift; r.arms[1].rotation.x=swing*.55+st.armLift;
 r.tailG.rotation.y=Math.sin(t*3+st.walkT*.5)*.3;   // la cola se menea siempre, quieta o andando

 // parada no es muerta: las pausas de lectura son largas y es cuando se la mira
 const idle=1-w,br=Math.sin(t*1.5+st.p);
 r.g.position.y=Math.abs(Math.sin(st.walkT))*.05*w+br*.02*idle;
 r.body.scale.y=1+br*.035*idle;                                    // respira
 if(st.faceYaw===undefined) r.headG.rotation.y=Math.sin(t*.33+st.p)*.22*idle;   // mira alrededor
 const bk=(t*.9+st.p)%4.6,lid=bk<.14?Math.abs(bk/.07-1):1;         // parpadeo cada ~5s
 r.eyes[0].scale.y=r.eyes[1].scale.y=Math.max(.1,lid);
 const tw=Math.pow(Math.max(0,Math.sin(t*.62+st.p*2)),12);         // oreja: picos sueltos
 r.ears[0].rotation.z=tw*.3; r.ears[1].rotation.z=-tw*.3;
}

function walkTo(u,lat){
 const d=Math.abs(u-walker.u)*LEN+Math.abs(lat-walker.lat);
 if(d<.25) return;
 walker.walking=true;
 gsap.killTweensOf(walker);
 gsap.to(walker,{u,lat,duration:Math.min(d/2.7,9),ease:"power1.inOut",onComplete:()=>{walker.walking=false}});
}
// tween que se puede esperar: asi el guion del final se lee de arriba abajo
const tween=(o,v)=>new Promise(r=>gsap.to(o,{...v,onComplete:r}));

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
 obj.rotation.y=(Math.random()-.5)*.5;
 // se mide ANTES de emparentar: sin padre, la caja ya sale en el espacio del
 // grupo. El tope evita que un adorno fino (la hebra del carrete llega a 1.9)
 // empuje la foto hasta el medio del pasillo.
 const box=new THREE.Box3().setFromObject(obj);
 const pz=THREE.MathUtils.clamp(box.max.z+.3,.9,1.6);
 g.add(obj);

 const pol=new THREE.Group();
 pol.position.set((Math.random()-.5)*.3,POL_Y,pz);    // justo delante del objeto
 pol.rotation.set(-.13,(Math.random()-.5)*.35,(Math.random()-.5)*.1);
 g.add(pol);
 const frameMat=new THREE.MeshStandardMaterial({color:0xfbf6ea,roughness:.75,emissive:0xffbb66,emissiveIntensity:.14});
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
 polaroids.push({...m,g,pol,frameMat,pz,seen:false});
});
for(const u of (MOBILE?[.5]:[.08,.5,.92])) makeLantern(u,(Math.random()-.5)*1.4,1.7);

/* ---------- la sala del final ----------
   Una esfera a BackSide cortada por el mismo suelo plano, igual que el túnel.
   El arco tapa la juntura donde muere el tubo. */
const endPoint=PATH.getPointAt(1),endFwd=PATH.getTangentAt(1);
// el encuentro pasa en mitad del campo, no en la boca del tunel: si se quedan
// fuera de la esfera, la propia pared de la sala los tapa
const C=endPoint.clone().addScaledVector(endFwd,10); C.y=0;
const camDir=new THREE.Vector3().crossVectors(UP,endFwd).normalize()
 .multiplyScalar(.8).addScaledVector(endFwd,.6).normalize();      // plano de tres cuartos
const FINAL_CAM=C.clone().addScaledVector(camDir,5.9); FINAL_CAM.y=2.4;
const across=new THREE.Vector3().crossVectors(camDir,UP).normalize();   // el eje ancho de la pantalla
const herEnd=C.clone().addScaledVector(across,-.95);
const hisEnd=C.clone().addScaledVector(across,.95);
const midEnd=C.clone(); midEnd.y=1.95;
const yawTo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const chamber=new THREE.Mesh(
 new THREE.SphereGeometry(13,32,20),
 new THREE.MeshStandardMaterial({color:0x745034,roughness:1,side:THREE.BackSide,flatShading:true})
);
chamber.position.copy(C); scene.add(chamber);
const arch=new THREE.Mesh(
 new THREE.TorusGeometry(R,.55,8,26),
 new THREE.MeshStandardMaterial({color:0x5c3d29,roughness:1,flatShading:true})
);
arch.position.copy(endPoint); arch.lookAt(tmp.copy(endPoint).add(endFwd)); scene.add(arch);

// flores amarillas por toda la sala, en un anillo que deja libre el centro
const FL=MOBILE?110:240;
const flStem=new THREE.CylinderGeometry(.03,.045,1.5,5); flStem.translate(0,.75,0);
const flBud=new THREE.SphereGeometry(.24,8,7); flBud.scale(.9,1.15,.9); flBud.translate(0,1.62,0);
const flowers=new THREE.Group();
const fStems=new THREE.InstancedMesh(flStem,new THREE.MeshStandardMaterial({color:0x55763f,roughness:.9}),FL);
const fBuds=new THREE.InstancedMesh(flBud,new THREE.MeshStandardMaterial({roughness:.55}),FL);
flowers.add(fStems,fBuds); scene.add(flowers);
const flData=[];
const budTints=[0xffd54a,0xffc21f,0xf6b93b,0xffe27a];
// el pasillo entre la camara final y los dos se deja despejado, o las flores tapan el final
const shotA=FINAL_CAM.clone().setY(0),shotAB=midEnd.clone().setY(0).sub(shotA),shotL=shotAB.lengthSq();
const inShot=(x,z)=>{
 const p=new THREE.Vector3(x,0,z).sub(shotA);
 const k=THREE.MathUtils.clamp(p.dot(shotAB)/shotL,0,1);
 return p.distanceTo(tmp.copy(shotAB).multiplyScalar(k))<2.7;
};
for(let i=0;i<FL;i++){
 let x,z,tries=0;
 do{
   const a=Math.random()*Math.PI*2,rad=2.6+Math.random()*9;
   x=C.x+Math.cos(a)*rad; z=C.z+Math.sin(a)*rad;
 }while(inShot(x,z)&&++tries<14);
 flData.push({x,z,s:.45+Math.random()*.5,r:Math.random()*Math.PI,p:Math.random()*7});
 fBuds.setColorAt(i,new THREE.Color(budTints[i%budTints.length]));
}
fBuds.instanceColor.needsUpdate=true;
for(const m of [fStems,fBuds]){ m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled=false; }
function flowerWind(){
 for(let i=0;i<FL;i++){
   const d=flData[i];
   dummy.position.set(d.x,0,d.z);
   dummy.rotation.set(0,d.r,Math.sin(t*1.1+d.x*.3+d.p)*.08);
   dummy.scale.setScalar(d.s);
   dummy.updateMatrix(); fStems.setMatrixAt(i,dummy.matrix); fBuds.setMatrixAt(i,dummy.matrix);
 }
 fStems.instanceMatrix.needsUpdate=true; fBuds.instanceMatrix.needsUpdate=true;
}
const chamberLight=new THREE.PointLight(0xffd07a,3.4,34,1.3);
chamberLight.position.copy(C).setY(7); scene.add(chamberLight);

/* ---------- el ratoncito y el ramo ---------- */
const boyRig=makeMouse({fur:0x8f7c6e,acc:0x5b7fa6,boy:true});
const boy=new THREE.Group(); boy.add(boyRig.g); boy.scale.setScalar(1.07); boy.visible=false; scene.add(boy);

function makeBouquet(){
 const g=new THREE.Group();
 const stem=new THREE.MeshStandardMaterial({color:0x55763f,roughness:.9});
 const petal=new THREE.MeshStandardMaterial({color:0xffd23f,roughness:.5});
 const heartWrap=new THREE.MeshStandardMaterial({color:0xf6ecd6,roughness:.9,side:THREE.DoubleSide});
 for(let i=0;i<7;i++){
   const a=i/7*Math.PI*2,lean=.12+Math.random()*.1;
   const s=new THREE.Mesh(new THREE.CylinderGeometry(.018,.024,.62,5),stem);
   s.position.set(Math.cos(a)*.06,.31,Math.sin(a)*.06);
   s.rotation.set(Math.sin(a)*lean,0,-Math.cos(a)*lean); g.add(s);
   const head=new THREE.Group();
   head.position.set(Math.cos(a)*.19,.62,Math.sin(a)*.19); g.add(head);
   for(let k=0;k<5;k++){
     const p=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),petal);
     p.scale.set(1,.45,.6); p.position.set(Math.cos(k/5*6.28)*.07,0,Math.sin(k/5*6.28)*.07);
     head.add(p);
   }
 }
 const wrap=new THREE.Mesh(new THREE.ConeGeometry(.2,.42,10,1,true),heartWrap);
 wrap.position.y=.2; g.add(wrap);
 return g;
}
const bouquet=makeBouquet();
bouquet.position.set(0,-.28,.12); bouquet.rotation.x=.5;
boyRig.hands[0].add(bouquet);

/* ---------- el corazón ---------- */
function heartGeo(){
 const s=new THREE.Shape();
 s.moveTo(.5,.5);
 s.bezierCurveTo(.5,.5,.4,0,0,0);
 s.bezierCurveTo(-.6,0,-.6,.7,-.6,.7);
 s.bezierCurveTo(-.6,1.1,-.3,1.54,.5,1.9);
 s.bezierCurveTo(1.2,1.54,1.6,1.1,1.6,.7);
 s.bezierCurveTo(1.6,.7,1.6,0,1,0);
 s.bezierCurveTo(.7,0,.5,.5,.5,.5);
 const g=new THREE.ExtrudeGeometry(s,{depth:.3,bevelEnabled:true,bevelSize:.08,bevelThickness:.06,bevelSegments:2});
 g.center(); g.rotateZ(Math.PI);          // el perfil clásico nace del revés
 return g;
}
const HEART=heartGeo();
const heartMat=new THREE.MeshStandardMaterial({color:0xff8bb5,roughness:.35,emissive:0xff4f8b,emissiveIntensity:.75});
const heartG=new THREE.Group(); heartG.visible=false; scene.add(heartG);
const heart=new THREE.Mesh(HEART,heartMat); heart.scale.setScalar(.5); heartG.add(heart);
const heartLight=new THREE.PointLight(0xff6fa5,0,9,1.6); heartG.add(heartLight);
// corazoncitos que suben alrededor
const motes=new THREE.InstancedMesh(HEART,new THREE.MeshStandardMaterial({color:0xffa6c6,emissive:0xff5f97,emissiveIntensity:.6,transparent:true,opacity:.9}),14);
motes.frustumCulled=false; motes.visible=false; scene.add(motes);
const moteData=[...Array(14)].map(()=>({a:Math.random()*6.28,r:.5+Math.random()*1.3,p:Math.random()*4,s:.05+Math.random()*.05}));

/* ---------- puestas en escena del final ---------- */
heartG.position.copy(midEnd);
motes.position.copy(midEnd);

/* ---------- UI ---------- */
const intro=$("#intro"),memoryScreen=$("#memory"),hint=$("#hint");
const dots=[...document.querySelectorAll("#progress i")];
const show=el=>el.classList.add("show");
const hide=el=>el.classList.remove("show","active");
const say=txt=>{ if(txt) hint.textContent=txt; hint.classList.toggle("show",!!txt) };
let seen=0,near=-1,focus=null,lastHint="";
const behind=()=>polaroids.some(m=>!m.seen&&m.u<walker.u-.005);

function openMemory(i){
 const m=polaroids[i];
 if(m.seen) return;
 m.seen=true; paused=true; focus=m; say("");
 gsap.killTweensOf(walker); walker.walking=false;
 gsap.to(m.pol.position,{y:1.62,z:m.pz+.75,duration:.9,ease:"back.out(1.5)"});
 gsap.to(m.frameMat,{emissiveIntensity:.55,duration:.6});
 $("#memoryPhoto").src=m.photo;
 $("#memoryText").textContent=m.text;
 setTimeout(()=>show(memoryScreen),700/SPEED);
 music.duck(true);
 dots[i].classList.add("on");
 seen++;
}
$("#memory .memory-next").addEventListener("click",()=>{
 hide(memoryScreen);
 gsap.to(focus.pol.position,{y:POL_Y,z:focus.pz,duration:.7,ease:"power2.inOut"});
 gsap.to(focus.frameMat,{emissiveIntensity:0,duration:.6});   // ya visto: deja de llamar
 focus=null; paused=false; music.duck(false);
 say(seen<polaroids.length?"Sigue caminando":"Al fondo hay algo amarillo...");
});

/* ---------- el final: a partir de aqui manda la historia, no el usuario ---------- */
const goTo=(st,to,dur)=>{                        // caminar en linea recta, ya sin curva
 st.walking=true;
 return tween(st.free,{x:to.x,z:to.z,duration:dur,ease:"power1.inOut"}).then(()=>{st.walking=false});
};
async function finale(){
 finaleOn=true; paused=true; say(""); music.brighten();
 gsap.killTweensOf(walker);

 // 1. sale del tunel y se adentra en el campo de flores
 walker.walking=true;
 await tween(walker,{u:1,lat:0,duration:1.6,ease:"power1.inOut"});
 walker.free=new THREE.Vector3().copy(mouse.position);
 finalCam=FINAL_CAM;
 await goTo(walker,herEnd,3.4);
 await wait(900);

 // 2. el la alcanza, con el ramo
 boyS.free=endPoint.clone().addScaledVector(across,.6);
 placeAt(1,0,boyS.prev); boy.visible=true;
 await goTo(boyS,hisEnd,3.2);

 // 3. se miran
 walker.faceYaw=yawTo(herEnd,hisEnd);
 boyS.faceYaw=yawTo(hisEnd,herEnd);
 await wait(1200);

 // 4. le da las flores
 await tween(boyS,{armLift:-1.15,duration:.7,ease:"power2.out"});
 await wait(400);
 const to=new THREE.Vector3(); rig.hands[0].getWorldPosition(to);
 scene.attach(bouquet);                          // attach conserva la pose en el mundo al cambiar de padre
 gsap.to(walker,{armLift:-1,duration:.7,ease:"power2.out"});
 await tween(bouquet.position,{x:to.x,y:to.y,z:to.z,duration:.9,ease:"power2.inOut"});
 rig.hands[0].attach(bouquet);
 gsap.to(boyS,{armLift:-.35,duration:.8,ease:"power2.inOut"});
 await wait(1000);

 // 5. y le dice algo
 music.duck(true);
 show($("#finalMsg"));
}

// el abrazo: lo unico que queda en manos de quien lo lee
$("#finalBtn").addEventListener("click",async()=>{
 hide($("#finalMsg")); music.duck(false);
 gsap.to(walker.free,{x:midEnd.x-across.x*.42,z:midEnd.z-across.z*.42,duration:1.4,ease:"power2.inOut"});
 gsap.to(boyS.free,{x:midEnd.x+across.x*.42,z:midEnd.z+across.z*.42,duration:1.4,ease:"power2.inOut"});
 gsap.to(walker,{armLift:-.95,duration:1.2,ease:"power2.inOut"});
 gsap.to(boyS,{armLift:-.95,duration:1.2,ease:"power2.inOut"});
 await wait(1500);
 heartG.visible=true; heartG.scale.setScalar(0);
 gsap.to(heartG.scale,{x:1,y:1,z:1,duration:1.2,ease:"back.out(1.7)"});
 gsap.to(heartLight,{intensity:2.6,duration:1.4});
 gsap.to(renderer,{toneMappingExposure:1.32,duration:2});
 motes.visible=true;
 await wait(1700);
 show($("#restart"));
});
$("#restartBtn").addEventListener("click",()=>location.reload());

/* ---------- caminar y mirar ----------
   Un toque manda a la ratoncita ahi. Un arrastre gira la camara a su
   alrededor. Se distinguen por cuanto se movio el dedo: sin esto no se
   puede volver sobre los pasos, porque solo se puede tocar lo que se ve. */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
const CAM_D=2.9;                     // radio al que orbita la camara
let camA=0,camAim=0,camPrevU=walker.u,drag=null;

addEventListener("pointerdown",e=>{
 if(paused||e.target!==canvas) return;
 drag={x:e.clientX,y:e.clientY,a:camA,moved:0};
});
addEventListener("pointermove",e=>{
 if(!drag) return;
 const dx=e.clientX-drag.x;
 drag.moved=Math.max(drag.moved,Math.abs(dx)+Math.abs(e.clientY-drag.y));
 camA=drag.a-dx*.007;
 camAim=camA;                        // mirar a mano manda sobre el encuadre automatico
});
addEventListener("pointerup",()=>{
 const d=drag; drag=null;
 if(!d||paused) return;
 if(d.moved>10) return;              // fue un giro de camara, no un destino
 if(near>=0){ openMemory(near); return }
 ndc.set(d.x/innerWidth*2-1,-(d.y/innerHeight)*2+1);
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

const camPos=new THREE.Vector3(),camLook=new THREE.Vector3(),lookAt=new THREE.Vector3(),fv=new THREE.Vector3();
placeAt(walker.u-.05,0,camPos); camPos.y=2.4;
camera.position.copy(camPos);
lookAt.copy(mouse.position).setY(1.1); camera.lookAt(lookAt);

function animate(){
 const dt=Math.min(clock.getDelta(),.05); t+=dt;

 stepWalker(walker,mouse,rig,dt);
 if(boy.visible) stepWalker(boyS,boy,boyRig,dt);
 blob.position.set(mouse.position.x,.02,mouse.position.z);
 lamp.position.set(mouse.position.x,2.3,mouse.position.z);
 flowerWind();
 if(heartG.visible){
   heart.rotation.y=Math.sin(t*.9)*.25;
   heart.scale.setScalar(.5*(1+Math.sin(t*2.6)*.06));        // late
 }
 if(motes.visible){
   for(let i=0;i<moteData.length;i++){
     const d=moteData[i],k=(t*.35+d.p/4)%1;
     dummy.position.set(Math.cos(d.a+k*1.4)*d.r,k*3.4-.6,Math.sin(d.a+k*1.4)*d.r);
     dummy.rotation.set(0,t*.8+d.p,Math.sin(t+d.p)*.3);
     dummy.scale.setScalar(d.s*Math.sin(k*Math.PI));         // nacen y se deshacen
     dummy.updateMatrix(); motes.setMatrixAt(i,dummy.matrix);
   }
   motes.instanceMatrix.needsUpdate=true;
 }
 // no se remata la historia con recuerdos sin abrir: se avisa y se espera
 if(!finaleOn&&walker.u>.9&&seen>=polaroids.length) finale();
 for(const l of lanterns) l.rotation.z=Math.sin(t*.62+l.userData.p)*.045;

 // ¿hay un recuerdo al alcance?
 let n=-1;
 for(let i=0;i<polaroids.length;i++){
   const m=polaroids[i];
   if(!m.seen&&Math.abs(walker.u-m.u)*LEN<2.6) n=i;
 }
 if(finaleOn) n=-1;
 if(n!==near&&!paused){
   if(n>=0) gsap.to(polaroids[n].frameMat,{emissiveIntensity:.5,duration:.5});
   near=n;
 }
 if(!paused&&!finaleOn){
   const h=near>=0?"Toca para ver el recuerdo"
     :behind()?"Te dejaste un recuerdo atrás — arrastra para mirar"
     :"Toca el suelo para caminar";
   if(h!==lastHint){ lastHint=h; say(h) }
 }
 if(near>=0&&polaroids[near]&&!polaroids[near].seen)
   polaroids[near].pol.position.y=POL_Y+Math.sin(t*2.4)*.035;   // late, para que se note que es tocable

 // cámara: detrás de ella sobre la propia curva, así nunca entra en una pared
 if(finalCam){
   camPos.copy(finalCam); camLook.copy(midEnd);
 }else if(focus){
   focus.pol.getWorldPosition(camLook);          // sigue a la foto mientras se levanta
   placeAt(focus.u,0,fv);                        // la polaroid mira al centro del tunel: ahi va la camara
   camPos.copy(camLook).addScaledVector(tmp.subVectors(fv,camLook).setY(0).normalize(),2.7).setY(camLook.y+.5);
 }else if(introCam){
   const a=Math.sin(t*.15)*.4;                  // deriva lenta: un plano quieto parece colgado
   placeAt(walker.u-Math.cos(a)*5.2/LEN,THREE.MathUtils.clamp(Math.sin(a)*5.2,-R*.7,R*.7),camPos);
   camPos.y=3.4;
   camLook.copy(mouse.position).setY(1.15);
 }else{
   // se recoloca detras de su direccion de marcha: al volver sobre sus pasos
   // la camara rodea por el lado en vez de cruzarla por encima
   if(walker.walking&&!drag){
     const du=walker.u-camPrevU;
     if(Math.abs(du)>1e-5) camAim=du>0?0:Math.PI;
   }
   camPrevU=walker.u;
   camA+=Math.atan2(Math.sin(camAim-camA),Math.cos(camAim-camA))*(1-Math.exp(-dt*1.3));
   const c=Math.cos(camA),sn=Math.sin(camA);
   placeAt(walker.u-c*CAM_D/LEN,THREE.MathUtils.clamp(walker.lat*.6+sn*CAM_D,-R*.72,R*.72),camPos);
   camPos.y=2.5;
   camLook.copy(mouse.position).setY(1.1);
 }
 camera.position.lerp(camPos,1-Math.exp(-dt*(finalCam?1.6:focus?3.2:2.4)));
 lookAt.lerp(camLook,1-Math.exp(-dt*4.5));
 camera.lookAt(lookAt);

 renderer.render(scene,camera);
}
gsap.ticker.add(animate);   // un solo reloj para tweens y render


/* ---------- piano: aditiva + martillo + reverb, sin un solo sample ----------
   Generativo a proposito: la experiencia no dura lo mismo dos veces, asi que
   una cancion grabada se desincroniza siempre. Esto dura lo que ella tarde,
   baja cuando hay algo que leer y se abre al llegar al final. */
const music=(()=>{
 const VOL=.3;
 const SEMI={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
 const hz=n=>440*Math.pow(2,(SEMI[n[0]]+(n[1]==="#"?1:0)+(+n.slice(-1)+1)*12-69)/12);

 // vuelta menor, lenta y con aire: el animo de un tunel con farolitos
 const PROG=[
  ["A1",["A2","C3","E3","A3"]],    // Am
  ["G1",["G2","B2","E3","G3"]],    // Em/G
  ["F1",["F2","A2","C3","F3"]],    // F
  ["C2",["C3","E3","G3","C4"]],    // C
  ["D2",["D3","F3","A3","D4"]],    // Dm
  ["C2",["C3","E3","A3","C4"]],    // Am/C
  ["E1",["E2","G#2","B2","E3"]],   // E: el acorde que duele
  ["A1",["A2","C3","E3","A3"]]     // Am
 ];
 const ARP=[0,1,2,3,2,1,3,2];       // ocho corcheas, mano izquierda
 const MEL=[                        // melodia escrita y con silencios, no notas al azar
  [[0,"A4",2],[2.5,"C5",1.5]],
  [[0,"B4",1.5],[1.5,"E5",2.5]],
  [[0,"C5",2],[2.5,"A4",1.5]],
  [[0,"G4",3]],
  [[0,"F4",1.5],[1.5,"A4",1],[2.5,"D5",1.5]],
  [[0,"E5",2],[2.5,"C5",1.5]],
  [[0,"B4",1.5],[1.5,"G#4",2.5]],
  [[0,"A4",3.5]]
 ];

 let ctx,master,tone,dry,wet,noiseBuf,bar=0,next=0,tempo=52;
 let bright=false,on=true,ducked=false;
 const level=()=>on?(ducked?VOL*.4:VOL):0;
 const applyGain=()=>{ if(ctx) master.gain.linearRampToValueAtTime(level(),ctx.currentTime+.45) };

 function impulse(sec,decay){
   const len=ctx.sampleRate*sec,buf=ctx.createBuffer(2,len,ctx.sampleRate);
   for(let c=0;c<2;c++){
     const d=buf.getChannelData(c);
     for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
   }
   return buf;
 }
 // cuerpo de la nota: parciales con afinacion estirada = timbre de piano
 const PARTIALS=[[1,1],[2,.4],[3,.17],[4,.08],[5,.04],[6,.02]].slice(0,MOBILE?4:6);
 function piano(note,at,beats,vel){
   const f=hz(note),beat=60/tempo,dur=beats*beat;
   const env=ctx.createGain(); env.connect(tone);
   env.gain.setValueAtTime(.0001,at);
   env.gain.exponentialRampToValueAtTime(vel,at+.008);
   env.gain.exponentialRampToValueAtTime(vel*.3,at+.4);        // caida del golpe
   env.gain.exponentialRampToValueAtTime(.0001,at+dur+1.8);    // cola con pedal
   for(const [h,a] of PARTIALS){
     if(f*h>12000) break;
     const o=ctx.createOscillator(),g=ctx.createGain();
     o.type=h===1?"triangle":"sine";
     o.frequency.value=f*h*(1+.0006*h*h);   // inarmonicidad: sin esto suena a organo
     g.gain.value=a;
     o.connect(g); g.connect(env); o.start(at); o.stop(at+dur+2);
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
   piano(bass,t0,4,.18*swell);
   ARP.forEach((k,i)=>piano(chord[k],t0+i*beat*.5,.5,(i%2?.05:.07)*swell));
   for(const [off,n,d] of MEL[b]){
     piano(n,t0+off*beat,d,.12*swell);
     if(bright) piano(n.slice(0,-1)+(+n.slice(-1)-1),t0+off*beat,d,.05*swell);   // octava grave al final
   }
   bar++; next=t0+barLen;
   setTimeout(scheduleBar,Math.max(30,(next-ctx.currentTime-.25)*1000));
 }

 return {
   start(){
     const Ctx=window.AudioContext||window.webkitAudioContext;
     if(!Ctx||ctx) return;
     ctx=new Ctx();
     ctx.resume();   // iOS arranca suspendido aunque venga de un toque

     noiseBuf=impulse(.12,1);
     master=ctx.createGain(); master.gain.value=VOL;
     const comp=ctx.createDynamicsCompressor();   // red por si coinciden muchas colas
     master.connect(comp); comp.connect(ctx.destination);

     tone=ctx.createBiquadFilter(); tone.type="lowpass"; tone.frequency.value=2200; tone.Q.value=.4;
     const rev=ctx.createConvolver(); rev.buffer=impulse(3.6,2.2);   // cola larga: suena a bajo tierra
     dry=ctx.createGain(); dry.gain.value=.78;
     wet=ctx.createGain(); wet.gain.value=.5;
     tone.connect(dry); dry.connect(master);
     tone.connect(rev); rev.connect(wet); wet.connect(master);

     addEventListener("visibilitychange",()=>{document.hidden?ctx.suspend():ctx.resume()});
     next=ctx.currentTime+.4;
     scheduleBar();
   },
   duck(d){ ducked=d; applyGain() },                 // baja cuando hay algo que leer
   brighten(){                                       // el final: mas luz y algo mas de paso
     if(!ctx) return;
     bright=true; tempo=62;
     tone.frequency.linearRampToValueAtTime(3800,ctx.currentTime+7);
     wet.gain.linearRampToValueAtTime(.6,ctx.currentTime+7);
   },
   toggle(){ on=!on; applyGain(); return on }
 };
})();
$("#sound").addEventListener("click",()=>{
 const isOn=music.toggle();
 $("#sound").classList.toggle("off",!isOn);
 $("#sound b").textContent=isOn?"on":"off";
});

/* ---------- la historia, antes de soltarle el control ---------- */
const STORY=[
 {k:"Esta mañana",
  t:"Se despertó y él no estaba. En su sitio había una nota doblada con demasiado cuidado, de esas que tardan más en doblarse que en escribirse."},
 {k:"La nota decía",
  t:"«Hoy te tengo una sorpresa. Baja a la madriguera y camina hasta el fondo: te fui dejando cosas por el camino. Nuestras cosas.»"},
 {k:"Así que bajó a buscarlo",
  t:"Cogió su farolito y se metió en el túnel. Cuatro recuerdos la esperaban en la oscuridad, y él al final de todos.",
  c:"Toca el suelo para caminar · Arrastra para mirar"}
];
const storyScreen=$("#story");
let beat=0;
function showBeat(){
 const b=STORY[beat];
 $("#storyKicker").textContent=b.k;
 $("#storyText").textContent=b.t;
 const ctrl=$("#storyControls");
 ctrl.textContent=b.c||""; ctrl.hidden=!b.c;
 $("#storyNext").textContent=beat<STORY.length-1?"Seguir →":"Entrar en la madriguera →";
 show(storyScreen);
}
// ponytail: un solo listener en el contenedor. El clic del boton burbujea hasta
// aqui, asi que sirve tocar donde sea sin duplicar manejadores
storyScreen.addEventListener("pointerdown",()=>{
 if(++beat<STORY.length) return showBeat();
 hide(storyScreen);
 introCam=false; paused=false;
 $("#progress").classList.add("show");
});

/* ---------- arranque ---------- */
$("#begin").addEventListener("click",()=>{
 hide(intro);
 music.start();          // tiene que nacer de un gesto: iOS no arranca audio solo
 beat=0; showBeat();
});
setTimeout(()=>{$("#loading").style.opacity=0;setTimeout(()=>$("#loading").remove(),800)},700);
