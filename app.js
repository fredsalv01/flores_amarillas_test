import * as THREE from "three";

// ponytail: one flag drives every mobile tradeoff (counts, AA, shadow res, pixel ratio)
const MOBILE=matchMedia("(pointer:coarse)").matches&&Math.min(innerWidth,innerHeight)<900;

const canvas=document.querySelector("#scene");
const renderer=new THREE.WebGLRenderer({canvas,antialias:!MOBILE});
renderer.setPixelRatio(Math.min(devicePixelRatio,MOBILE?1.5:2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=MOBILE?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;

// ponytail: one speed knob covers prefers-reduced-motion for gsap + every wait()
const SPEED=matchMedia("(prefers-reduced-motion: reduce)").matches?4:1;
gsap.globalTimeline.timeScale(SPEED);
const wait=ms=>new Promise(r=>setTimeout(r,ms/SPEED));
const clickOnce=sel=>new Promise(r=>document.querySelector(sel).addEventListener("click",r,{once:true}));

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

/* ---------- tulips: hero flowers near the path ---------- */
function makeTulip(color=0xf4c642){
 const g=new THREE.Group();
 const stem=new THREE.Mesh(new THREE.CylinderGeometry(.035,.055,2.2,8),new THREE.MeshStandardMaterial({color:0x52713e,roughness:.8}));
 stem.position.y=1.0; stem.castShadow=true; g.add(stem);
 const petalMat=new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.02});
 // six stylized petals form a tulip cup
 for(let i=0;i<6;i++){
   const a=i*Math.PI/3;
   const petal=new THREE.Mesh(new THREE.SphereGeometry(.34,14,10),petalMat);
   petal.scale.set(.7,.95,.32);
   petal.position.set(Math.sin(a)*.24,2.12,Math.cos(a)*.24);
   petal.rotation.x=-.18; petal.rotation.y=a; petal.castShadow=true; g.add(petal);
 }
 const center=new THREE.Mesh(new THREE.SphereGeometry(.17,12,8),new THREE.MeshStandardMaterial({color:0x593b12,roughness:1}));
 center.position.y=2.13; g.add(center);
 const leafMat=new THREE.MeshStandardMaterial({color:0x476537,roughness:.8});
 for(const side of [-1,1]){
   const leaf=new THREE.Mesh(new THREE.SphereGeometry(.42,12,8),leafMat);
   leaf.scale.set(.25,.7,.9); leaf.position.set(side*.27,.55,0); leaf.rotation.z=side*.7; leaf.rotation.x=-.35; g.add(leaf);
 }
 return g;
}
for(let i=0;i<(MOBILE?48:95);i++){
 const tu=makeTulip(i%5===0?0xffdc55:(i%3===0?0xf2a1a7:0xf0c33c));
 tu.position.set((Math.random()-.5)*22,-1,-Math.random()*18-1);
 tu.scale.setScalar(.32+Math.random()*.3);
 tu.rotation.y=Math.random()*Math.PI; tu.userData.phase=Math.random()*7;
 tulips.add(tu);
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
const dummy=new THREE.Object3D();
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
function makeLetter(){
 const g=new THREE.Group();
 const paper=new THREE.Mesh(new THREE.BoxGeometry(1.9,.08,1.35),new THREE.MeshStandardMaterial({color:0xf4e4bd,roughness:.9}));
 paper.castShadow=true; paper.receiveShadow=true; g.add(paper);
 const hinge=new THREE.Group(); hinge.position.set(0,.05,-.6); g.add(hinge);
 const flap=new THREE.Mesh(new THREE.ConeGeometry(1.05,1.1,4,1),new THREE.MeshStandardMaterial({color:0xe5cfa0,roughness:1}));
 flap.rotation.x=Math.PI/2; flap.rotation.z=Math.PI/4; flap.scale.z=.62; flap.position.z=.42;
 flap.castShadow=true; hinge.add(flap);
 const seal=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.05,16),new THREE.MeshStandardMaterial({color:0xb8465a,roughness:.4}));
 seal.position.set(0,.09,.06); g.add(seal);
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
 l.position.set(s.x,-1.0,s.z);
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
const hide=el=>el.classList.remove("show");
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

const dawnColor=(c,hex,dur)=>{const k=new THREE.Color(hex);gsap.to(c,{r:k.r,g:k.g,b:k.b,duration:dur,ease:"power2.inOut"})};
async function dawnSequence(){
 document.body.classList.add("dawn");
 say("");
 const D=7;
 // camera lifts off the path and turns to the horizon
 cameraTo({x:0,y:6.2,z:8.5},{x:0,y:2.6,z:-14},D);
 gsap.to(girl.rotation,{y:Math.PI,duration:2,ease:"power2.inOut"});
 gsap.to(girl.position,{x:0,z:-7,duration:D*.6,ease:"power1.inOut"});

 dawnColor(scene.background,0xffc79a,D);
 dawnColor(scene.fog.color,0xffbf95,D);
 gsap.to(scene.fog,{density:.012,duration:D,ease:"power2.inOut"});
 dawnColor(hemi.color,0xfff0d8,D); dawnColor(hemi.groundColor,0x8d9a5e,D);
 gsap.to(hemi,{intensity:2.6,duration:D});
 dawnColor(keyLight.color,0xfff1cf,D); gsap.to(keyLight,{intensity:4.4,duration:D});
 gsap.to(keyLight.position,{x:7,y:11,z:-6,duration:D,ease:"power2.inOut"});
 dawnColor(ground.material.color,0x33502c,D);
 dawnColor(moon.material.color,0xfff4d2,D); dawnColor(moonGlow.color,0xffc98a,D);
 gsap.to(moon.position,{x:9,y:5.5,z:-26,duration:D,ease:"power2.inOut"});
 gsap.to(moon.scale,{x:2.1,y:2.1,z:2.1,duration:D,ease:"power2.inOut"});
 gsap.to(moonGlow,{intensity:5,distance:60,duration:D});
 dawnColor(particles.material.color,0xfff6dd,D);
 gsap.to(renderer,{toneMappingExposure:1.32,duration:D});

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
}
story();

$("#replay").addEventListener("click",()=>location.reload());
// al rotar el teléfono se reencuadra el plano actual, no solo el aspect
window.addEventListener("resize",()=>{
 fitCamera();
 cameraTo(lastShot.p,lastShot.look,.5);
});

function animate(){
 requestAnimationFrame(animate);
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
 tulips.children.forEach(o=>{o.rotation.z=Math.sin(t*.9+o.position.x*.3+o.userData.phase)*.06});
 if(field.visible) windUpdate();

 camera.lookAt(camTarget);
 renderer.render(scene,camera);
}
animate();

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
