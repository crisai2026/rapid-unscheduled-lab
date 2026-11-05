/* ================= SOUND (all generated, no files) ================= */
const SND={ctx:null,on:true};
function audioInit(){
  if(SND.ctx){if(SND.ctx.state==='suspended')SND.ctx.resume();return;}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const C=new AC();SND.ctx=C;
  const comp=C.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=6;comp.connect(C.destination);
  SND.master=C.createGain();SND.master.gain.value=SND.on?.8:0;SND.master.connect(comp);
  const mk=(sec,brown)=>{const b=C.createBuffer(1,C.sampleRate*sec,C.sampleRate),d=b.getChannelData(0);let last=0;
    for(let i=0;i<d.length;i++){const w=Math.random()*2-1;if(brown){last=(last+.02*w)/1.02;d[i]=last*3.5;}else d[i]=w;}return b;};
  SND.white=mk(2,false);SND.brown=mk(3,true);
  const loop=(buf,filterType,freq,q)=>{const s=C.createBufferSource();s.buffer=buf;s.loop=true;const f=C.createBiquadFilter();f.type=filterType;f.frequency.value=freq;f.Q.value=q||.7;const g=C.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(SND.master);s.start();return {f,g};};
  SND.eng=loop(SND.brown,'lowpass',500);           // deep engine roar
  SND.crk=loop(SND.white,'bandpass',1400,.9);      // crackle on top
  SND.wind=loop(SND.white,'bandpass',450,.6);      // air rushing past
  SND.vent=loop(SND.white,'highpass',3500);        // venting oxygen on the pad
  const ro=C.createOscillator();ro.type='sine';ro.frequency.value=42;SND.rumbleG=C.createGain();SND.rumbleG.gain.value=0;ro.connect(SND.rumbleG);SND.rumbleG.connect(SND.master);ro.start();
  const po=C.createOscillator();po.type='sawtooth';po.frequency.value=180;const pf=C.createBiquadFilter();pf.type='bandpass';pf.Q.value=6;pf.frequency.value=900;SND.pumpG=C.createGain();SND.pumpG.gain.value=0;po.connect(pf);pf.connect(SND.pumpG);SND.pumpG.connect(SND.master);po.start();SND.pumpO=po;
}
function setG(g,v,tc=.08){if(SND.ctx&&g)g.gain.setTargetAtTime(v,SND.ctx.currentTime,tc);}
function burst(dur,f0,f1,vol,type='lowpass'){const C=SND.ctx;if(!C)return;const s=C.createBufferSource();s.buffer=SND.white;const f=C.createBiquadFilter();f.type=type;const t=C.currentTime;
  f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);const g=C.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(SND.master);s.start(t);s.stop(t+dur+.05);}
function thump(freq,dur,vol){const C=SND.ctx;if(!C)return;const o=C.createOscillator(),g=C.createGain(),t=C.currentTime;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.4,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(SND.master);o.start(t);o.stop(t+dur+.05);}
function beep(f=880,d=.12,v=.12){const C=SND.ctx;if(!C)return;const o=C.createOscillator(),g=C.createGain(),t=C.currentTime;o.type='square';o.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(SND.master);o.start(t);o.stop(t+d+.02);}
const sfx={
  clunk(v=1){burst(.25,2500,200,.5*v);thump(90,.35,.6*v);},
  explosion(v=1){burst(2.8,1800,60,1.2*v);thump(55,1.6,1*v);setTimeout(()=>burst(1.5,600,50,.5*v),180);},
  boom(){thump(60,.5,.9);burst(.4,900,80,.7);setTimeout(()=>{thump(55,.5,.8);burst(.4,700,70,.5);},140);},
  chute(){burst(1.2,300,2500,.35,'bandpass');},
  crash(v=1){burst(.6,1200,100,.8*v);thump(70,.5,.7*v);},
};
let voice=null;
function pickVoice(){if(!('speechSynthesis' in window))return;const vs=speechSynthesis.getVoices();voice=vs.find(v=>/en(-|_)(US|GB)/i.test(v.lang)&&/male|daniel|alex|david|google uk english male/i.test(v.name))||vs.find(v=>/^en/i.test(v.lang))||null;}
if('speechSynthesis' in window){pickVoice();speechSynthesis.onvoiceschanged=pickVoice;}
function say(text){if(!SND.on||!('speechSynthesis' in window))return;try{const u=new SpeechSynthesisUtterance(text);if(voice)u.voice=voice;u.rate=1.05;u.pitch=.9;u.volume=1;speechSynthesis.speak(u);}catch(e){}}
function soundToggle(){SND.on=!SND.on;$('btnSound').innerHTML=(SND.on?'Sound on':'Sound off')+' <kbd>M</kbd>';$('btnSound').classList.toggle('on',false);if(SND.master)setG(SND.master,SND.on?.8:0,.05);if(!SND.on&&'speechSynthesis' in window)speechSynthesis.cancel();}

/* ================= Three.js setup ================= */
const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputEncoding=THREE.sRGBEncoding;
function canvasTex(draw,w=128,h=128){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return new THREE.CanvasTexture(c);}
const softTex=canvasTex((x,w,h)=>{const g=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.5,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
const hazardTex=canvasTex((x,w,h)=>{x.fillStyle='#1c1f24';x.fillRect(0,0,w,h);x.fillStyle='#f2c14e';for(let i=-h;i<w;i+=32){x.beginPath();x.moveTo(i,h);x.lineTo(i+16,h);x.lineTo(i+16+h,0);x.lineTo(i+h,0);x.fill();}},256,32);
hazardTex.wrapS=THREE.RepeatWrapping;hazardTex.repeat.set(3,1);hazardTex.encoding=THREE.sRGBEncoding;
const srbTex=canvasTex((x,w,h)=>{x.fillStyle='#e9e9e6';x.fillRect(0,0,w,h);x.fillStyle='#1d1d1d';for(let i=0;i<4;i++)x.fillRect(0,h*(.12+i*.25),w,h*.05);x.fillRect(0,0,w*.12,h);},128,256);srbTex.encoding=THREE.sRGBEncoding;
const mat=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,metalness:.25,roughness:.55},o));

function partMesh(it){
  const p=PARTS[it.key],g=new THREE.Group(),h=it.h;
  if(it.cat==='tank'){
    const body=new THREE.Mesh(new THREE.CylinderGeometry(R0,R0,h,32),mat('#e9eef3'));body.position.y=h/2;g.add(body);
    const band=new THREE.Mesh(new THREE.CylinderGeometry(R0+.006,R0+.006,Math.min(.35,h*.25),32),mat('#2f7fd1'));band.position.y=h*.55;g.add(band);
    for(const yy of [.02,h-.02]){const r=new THREE.Mesh(new THREE.CylinderGeometry(R0+.01,R0+.01,.04,32),mat('#55606b'));r.position.y=yy;g.add(r);}
  } else if(it.cat==='payload'){
    const body=new THREE.Mesh(new THREE.CylinderGeometry(R0,R0,h,32),mat(it.key==='ballast'?'#59626d':'#f2f2f2',{metalness:it.key==='ballast'?.7:.2}));body.position.y=h/2;g.add(body);
    if(it.key==='probe'){const w=new THREE.Mesh(new THREE.CircleGeometry(.16,24),mat('#9b8cff',{emissive:'#3a2f99'}));w.position.set(0,h/2,R0+.005);g.add(w);}
  } else if(it.cat==='chute'){
    const body=new THREE.Mesh(new THREE.CylinderGeometry(R0,R0,h,32),mat('#d94a3d'));body.position.y=h/2;g.add(body);
  } else if(it.cat==='decoupler'){
    const shell=new THREE.Mesh(new THREE.CylinderGeometry(R0+.012,R0+.012,h,32,1,true),mat('#c9d1d9',{metalness:.5,roughness:.4,side:THREE.DoubleSide}));shell.position.y=h/2;g.add(shell);
    const band=new THREE.Mesh(new THREE.CylinderGeometry(R0+.02,R0+.02,.14,32,1,true),mat('#ffffff',{map:hazardTex,metalness:.4,side:THREE.DoubleSide}));band.position.y=h-.07;g.add(band);
    const cap=new THREE.Mesh(new THREE.CircleGeometry(R0,32),mat('#2a2f36'));cap.rotation.x=-Math.PI/2;cap.position.y=.02;g.add(cap);
  } else if(it.cat==='nose'){
    let geo;
    if(it.key==='nose_ogive'){const pts=[];for(let i=0;i<=24;i++){const t=i/24;pts.push(new THREE.Vector2(R0*Math.pow(1-t*t,.75),t*h));}geo=new THREE.LatheGeometry(pts,32);}
    else geo=new THREE.CylinderGeometry(R0*.35,R0,h,32).translate(0,h/2,0);
    g.add(new THREE.Mesh(geo,mat('#e8eef4')));
  } else if(it.cat==='engine'){
    const rb=it.n===1?.42:.24;
    g.add(new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(rb,0),new THREE.Vector2(rb*.72,h*.22),new THREE.Vector2(rb*.38,h*.5),new THREE.Vector2(rb*.3,h*.6)],28),mat('#c46a2b',{metalness:.7,roughness:.35,side:THREE.DoubleSide})));
    const hs=new THREE.Mesh(new THREE.CylinderGeometry(it.n===1?R0:.2,it.n===1?R0*.8:.2,h*.42,24),mat('#3d4a57',{metalness:.6}));hs.position.y=h*.79;g.add(hs);
  } else if(it.cat==='booster'){
    const r=PARTS.srb.r;
    const body=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h-.75,24),mat('#ffffff',{map:srbTex}));body.position.y=.35+(h-.75)/2;g.add(body);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(r,.4,24),mat('#e9e9e6'));nose.position.y=h-.2;g.add(nose);
    const noz=new THREE.Mesh(new THREE.CylinderGeometry(r*.55,r*.85,.35,20,1,true),mat('#3a3a3a',{metalness:.6,side:THREE.DoubleSide}));noz.position.y=.175;g.add(noz);
  }
  const off=it.off||it.lat||[0,0];g.position.set(off[0],it.z0,off[1]);
  return g;
}
function finMeshes(){
  const {span,chord}=CONFIG.fin;const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(span,0);sh.lineTo(0,chord);sh.lineTo(0,0);
  const geo=new THREE.ExtrudeGeometry(sh,{depth:.05,bevelEnabled:false}).translate(0,0,-.025);
  return [0,1,2,3].map(i=>{const g=new THREE.Group();const m=new THREE.Mesh(geo,mat('#5fd38d'));m.position.x=R0-.02;g.add(m);g.rotation.y=i*Math.PI/2+Math.PI/4;return g;});
}
function makeFlame(rb,off,z0){
  const f=new THREE.Group();
  const outer=new THREE.Mesh(new THREE.ConeGeometry(rb*.95,4,20,1,true),new THREE.MeshBasicMaterial({color:'#ff8a2a',transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false}));outer.rotation.x=Math.PI;outer.position.y=-2;f.add(outer);
  const inner=new THREE.Mesh(new THREE.ConeGeometry(rb*.6,2.2,20,1,true),new THREE.MeshBasicMaterial({color:'#fff3c4',transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));inner.rotation.x=Math.PI;inner.position.y=-1.1;f.add(inner);
  f.position.set(off[0],z0,off[1]);f.visible=false;return f;
}
function buildMesh(P){
  const root=new THREE.Group(),pieces=[],coreFlames=[],bFlames=[];
  P.items.forEach((it,i)=>{
    if(it.cat==='fins'){finMeshes().forEach(f=>{f.position.y=it.z0;f.userData.idx=i;f.userData.share=4;root.add(f);pieces.push(f);});return;}
    const m=partMesh(it);m.userData.idx=i;m.userData.share=1;root.add(m);pieces.push(m);
    if(it.cat==='engine'&&it.stage===0){const fl=makeFlame(it.n===1?.42:.24,it.off,it.z0);root.add(fl);coreFlames.push(fl);}
    if(it.cat==='booster'){const fl=makeFlame(.24,it.lat,it.z0);root.add(fl);bFlames.push({idx:i,f:fl});}
  });
  return {root,pieces,coreFlames,bFlames};
}
