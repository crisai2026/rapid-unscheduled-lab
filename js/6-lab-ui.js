/* ================= LAB UI ================= */
function buildCatalogue(){
  const el=$('catalogue');el.innerHTML='';
  for(const cat of ['nose','chute','payload','tank','engine','fins','booster']){
    const g=document.createElement('div');g.className='catgroup';g.innerHTML=`<div class="label">${CAT_LABEL[cat]}</div>`;
    if(cat==='booster'){BOOSTER_OPTS.forEach(([n,l])=>{const b=document.createElement('button');b.className='part';b.id='add_srb'+n;
      b.innerHTML=`<b>${l}</b><span class="kg">${n*(PARTS.srb.mass+PARTS.srb.fuel)} kg</span><small>${n}× ${PARTS.srb.thrust/1000} kN · ~${fmt(PARTS.srb.fuel/SRB_MDOT)} s burn</small>`;b.onclick=()=>{design.stages[0].boosters=design.stages[0].boosters===n?0:n;refreshLab();};g.appendChild(b);});}
    else for(const [k,p] of Object.entries(PARTS)){if(p.cat!==cat||!p.desc)continue;
      const b=document.createElement('button');b.className='part';b.id='add_'+k;
      b.innerHTML=`<b>${p.name}</b><span class="kg">${p.mass+(p.fuel||0)} kg</span><small>${p.desc}</small>`;b.onclick=()=>addPart(k);g.appendChild(b);}
    el.appendChild(g);}
  const ex=$('examples');ex.innerHTML='';
  Object.entries(EXAMPLES).forEach(([k,e])=>{const b=document.createElement('button');b.textContent=e.label;b.onclick=()=>{design=clone(e.d);selStage=0;refreshLab();};ex.appendChild(b);});
}
let warnFlash='';function flashWarn(t){warnFlash=t;refreshLab();setTimeout(()=>{warnFlash='';refreshLab();},2500);}
function addPart(k){const p=PARTS[k],st=design.stages[selStage],top=design.stages[design.stages.length-1];
  if(p.cat==='nose')design.nose=design.nose===k?null:k;
  else if(p.cat==='fins')st.fins=!st.fins;
  else if(p.cat==='chute'){const has=design.stages.some(s=>s.middle.includes(k));design.stages.forEach(s=>{const i=s.middle.indexOf(k);if(i>=0)s.middle.splice(i,1);});if(!has)top.middle.unshift(k);}
  else if(p.cat==='engine'){if(st.engines.length<3)st.engines.push(k);else return flashWarn('Max 3 engines per stage.');}
  else if(st.middle.length>=8)return flashWarn('This stage is full.');
  else if(p.cat==='payload'){const i=st.middle[0]==='chute'?1:0;st.middle.splice(i,0,k);}
  else st.middle.push(k);
  refreshLab();}
function removeAt(where,i){const st=design.stages[selStage];if(where==='nose')design.nose=null;else if(where==='fins')st.fins=false;else if(where==='boosters')st.boosters=0;else st[where].splice(i,1);refreshLab();}
function addStage(){if(design.stages.length>=CONFIG.maxStages)return flashWarn(`Max ${CONFIG.maxStages} stages.`);
  // new stage goes on the bottom; it becomes stage 1
  design.stages.unshift({middle:['tank_m'],engines:['eng_hornet'],fins:true,boosters:design.stages[0].boosters});design.stages[1].boosters=0;selStage=0;refreshLab();}
function removeStage(){if(design.stages.length<2)return;const rm=design.stages.splice(selStage,1)[0];
  if(rm.middle.includes('chute'))design.stages[design.stages.length-1].middle.unshift('chute');
  if(selStage===0&&rm.boosters)design.stages[0].boosters=rm.boosters;selStage=Math.max(0,selStage-1);refreshLab();}
function refreshLab(){
  const a=analyse(),st=design.stages[selStage];
  for(const k of Object.keys(PARTS)){const b=$('add_'+k);if(!b)continue;b.classList.toggle('sel',k===design.nose||(k==='fins'&&st.fins)||st.middle.includes(k)||st.engines.includes(k)||(k==='chute'&&design.stages.some(s=>s.middle.includes('chute'))));}
  BOOSTER_OPTS.forEach(([n])=>$('add_srb'+n).classList.toggle('sel',design.stages[0].boosters===n));
  // stage selector
  const sb=$('stagebar');sb.innerHTML='<span class="label">Editing</span>';
  {const ex=document.createElement('button');ex.textContent=labExplode?'Put stages together':'Pull stages apart';ex.classList.toggle('on',labExplode);ex.onclick=()=>{labExplode=!labExplode;refreshLab();};sb.appendChild(ex);}
  for(let i=design.stages.length-1;i>=0;i--){const b=document.createElement('button');b.textContent=`Stage ${i+1}${i===0?' · bottom':i===design.stages.length-1?' · top':''}`;b.classList.toggle('on',i===selStage);b.onclick=()=>{selStage=i;refreshLab();};sb.appendChild(b);}
  const add=document.createElement('button');add.textContent='+ Add stage below';add.onclick=addStage;add.disabled=design.stages.length>=CONFIG.maxStages;sb.appendChild(add);
  if(design.stages.length>1){const rm=document.createElement('button');rm.textContent=`Remove stage ${selStage+1}`;rm.onclick=removeStage;sb.appendChild(rm);}
  const kb=$('stackbar');kb.innerHTML='';
  const chip=(name,where,i)=>{const c=document.createElement('span');c.className='chip';c.innerHTML=`${name}<button aria-label="Remove ${name}">✕</button>`;c.querySelector('button').onclick=()=>removeAt(where,i);kb.appendChild(c);};
  if(selStage===design.stages.length-1&&design.nose)chip(PARTS[design.nose].name,'nose');
  st.middle.forEach((k,i)=>chip(PARTS[k].name,'middle',i));st.engines.forEach((k,i)=>chip(PARTS[k].name,'engines',i));
  if(st.fins)chip('Fin set','fins');if(selStage===0&&st.boosters)chip(st.boosters+' solid boosters','boosters');
  if(!st.middle.length&&!st.engines.length)kb.innerHTML='<span class="label">This stage is empty. Add parts from the left.</span>';
  // numbers
  $('sMass').textContent=fmt(a.wet);
  const segs=[['nose','Nose'],['chute','Chute'],['payload','Payload'],['tank','Tanks'],['fuel','Fuel'],['engine','Engines'],['fins','Fins'],['decoupler','Interstages'],['booster','Boosters'],['bfuel','Booster fuel']].filter(([c])=>a.byCat[c]>0);
  $('massbar').innerHTML=segs.map(([c])=>`<div style="width:${a.byCat[c]/a.wet*100}%;background:${CAT_COLOR[c]}"></div>`).join('');
  $('massLegend').innerHTML=segs.map(([c,l])=>`<span><i style="background:${CAT_COLOR[c]}"></i>${l} ${fmt(a.byCat[c])}</span>`).join('');
  const twC=t=>t<1?'bad':t<1.3?'warn':'good';
  $('stageTable').innerHTML=`<tr><th>Stage</th><th>Mass at start</th><th>Δv</th><th>Burn</th><th>T/W</th></tr>`+
    a.rows.map((r,i)=>`<tr><td>${i+1}${i===0&&design.stages[0].boosters?' +B':''}</td><td>${fmt(r.m0)} kg</td><td>${fmt(r.dv)} m/s</td><td>${fmt(r.t)} s</td><td class="${i===0?twC(r.tw):r.tw<.5?'warn':''}">${fmt(r.tw,2)}</td></tr>`).join('')+
    `<tr class="total"><td>Total</td><td></td><td>${fmt(a.dv)} m/s</td><td></td><td></td></tr>`;
  const stab=m=>m<0?['bad','unstable, will flip']:m<1?['warn','wobbly']:['good','stable'];
  const s1=stab(a.marginFull),s2=stab(a.marginEmpty);
  $('kv').innerHTML=`<dt>Thrust ÷ weight at liftoff</dt><dd><span class="pill ${twC(a.twr)}">${fmt(a.twr,2)}</span></dd>
   <dt>Stability, full</dt><dd><span class="pill ${s1[0]}">${fmt(a.marginFull,1)} cal · ${s1[1]}</span></dd>
   <dt>Stability, stage 1 empty</dt><dd><span class="pill ${s2[0]}">${fmt(a.marginEmpty,1)} cal · ${s2[1]}</span></dd>
   <dt>Height</dt><dd>${fmt(a.height,1)} m</dd>`;
  const w=[];
  design.stages.forEach((s,i)=>{if(!s.engines.length)w.push(['bad',`Stage ${i+1} has no engine.`]);if(!s.middle.some(k=>PARTS[k].fuel))w.push(['bad',`Stage ${i+1} has no fuel tank.`]);});
  if(a.twr<1)w.push(['bad','Not enough thrust to leave the pad. Add engines or boosters.']);
  if(a.marginFull<0||a.marginEmpty<0)w.push(['bad','Centre of pressure is above the centre of mass. Expect it to flip. Add fins to stage 1.']);
  a.rows.forEach((r,i)=>{if(i>0&&r.margin<0)w.push(['warn',`Stage ${i+1} on its own is unstable (no fins). Fine in thin air, risky if it separates low and fast.`]);});
  if(!a.P.hasChute)w.push(['warn','No parachute: the top stage can only come down the hard way.']);
  if(warnFlash)w.push(['warn',warnFlash]);
  $('warns').innerHTML=w.map(([c,t])=>`<li class="${c}">${t}</li>`).join('');
  $('tabLaunch').disabled=design.stages.some(s=>!s.engines.length||!s.middle.some(k=>PARTS[k].fuel))||a.twr<1;
  // 3D model, editing stage glows
  if(labRocket)lab.scene.remove(labRocket);
  const mesh=buildMesh(a.P);labRocket=mesh.root;lab.scene.add(labRocket);labMesh={mesh,P:a.P};mesh.pieces.forEach(p=>p.userData.base=p.position.clone());
  mesh.pieces.forEach(p=>{const it=a.P.items[p.userData.idx];if(it.stage===selStage&&it.cat!=='nose')p.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.emissive=new THREE.Color('#5a2a00');}});});
  comM.position.set(0,a.zcFull,0);copM.position.set(0,a.P.cp,0);comL.position.set(0,a.zcFull,0);copL.position.set(0,a.P.cp,0);comL.rotation.y=copL.rotation.y=-Math.PI/4;
  labControls.target.set(0,a.height/2,0);
}

function labStep(){if(!labMesh)return;const {mesh,P}=labMesh;
  mesh.pieces.forEach(p=>{const it=P.items[p.userData.idx];const b=p.userData.base;p.position.set(b.x,b.y+it.stage*STAGE_GAP*labE,b.z);
    if(it.cat==='booster'){p.position.x=b.x+Math.sign(b.x)*1.2*labE;p.position.z=b.z+Math.sign(b.z)*1.2*labE;}});
  const n=design.stages.length;labControls.target.y=(P.L+(n-1)*STAGE_GAP*labE)/2;
  labMarkers.visible=labE<.05;}
const _v3=new THREE.Vector3(),_right=new THREE.Vector3();
function updateStageLabels(){
  const el=$('stageLabels');if(!labMesh)return;const {P}=labMesh,n=design.stages.length,host=$('labView'),W=host.clientWidth,H=host.clientHeight;
  _right.set(1,0,0).applyQuaternion(lab.cam.quaternion);
  const proj=(y)=>{_v3.set(0,y,0).addScaledVector(_right,R0+1.25);_v3.project(lab.cam);return [(_v3.x+1)/2*W,(1-_v3.y)/2*H];};
  let html='';
  for(let i=0;i<n;i++){const its=P.items.filter(it=>it.stage===i&&it.cat!=='booster');if(!its.length)continue;
    const lo=Math.min(...its.map(it=>it.z0))+i*STAGE_GAP*labE,hi=Math.max(...its.map(it=>it.z0+it.h))+i*STAGE_GAP*labE;
    const [x1,y1]=proj(lo),[x2,y2]=proj(hi),top=Math.min(y1,y2),hgt=Math.abs(y1-y2);
    const name=`Stage ${i+1}${i===0&&design.stages[0].boosters?' + boosters':''}${n>1?(i===0?' · fires first':i===n-1?' · fires last':''):''}`;
    html+=`<div class="brk ${i===selStage?'':'dim'}" style="left:${Math.max(x1,x2)}px;top:${top}px;height:${Math.max(8,hgt-4)}px"><span>${name}</span></div>`;}
  el.innerHTML=html;}

/* ================= Wiring ================= */
function mountRenderer(id){$(id).prepend(renderer.domElement);resize();}
function resize(){const host=renderer.domElement.parentElement;if(!host)return;const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);for(const c of [lab.cam,fly.cam]){c.aspect=w/h;c.updateProjectionMatrix();}}
function show(v){view=v;const isLab=v==='lab';$('viewLab').hidden=!isLab;$('viewLaunch').hidden=isLab;
  $('tabLab').classList.toggle('on',isLab);$('tabLaunch').classList.toggle('on',!isLab);labControls.enabled=isLab;flyControls.enabled=!isLab;
  if(isLab){if(F){setG(SND.eng&&SND.eng.g,0);setG(SND.crk&&SND.crk.g,0);setG(SND.rumbleG,0);setG(SND.wind&&SND.wind.g,0);setG(SND.vent&&SND.vent.g,0);setG(SND.pumpG,0);if('speechSynthesis' in window)speechSynthesis.cancel();}mountRenderer('labView');refreshLab();}
  else{audioInit();mountRenderer('flyView');newFlight();}}
$('tabLab').onclick=()=>show('lab');$('tabLaunch').onclick=()=>show('launch');
$('btnSound').onclick=()=>{audioInit();soundToggle();};
$('btnLaunch').onclick=launchPressed;$('btnCut').onclick=cut;$('btnChute').onclick=chute;$('btnReset').onclick=()=>newFlight();
$('btnSas').onclick=()=>{const on=!$('btnSas').classList.contains('on');$('btnSas').classList.toggle('on',on);if(F){F.sas=on;F.player.target=F.player.th;}};
$('btnForces').onclick=()=>{showForces=!showForces;$('btnForces').classList.toggle('on',showForces);};
$('throttle').oninput=e=>{const v=+e.target.value;$('thrVal').textContent=v+'%';if(F)F.player.throttle=v/100;};
$('wind').oninput=e=>$('windVal').textContent=e.target.value;
document.querySelectorAll('[data-warp]').forEach(b=>b.onclick=()=>{warp=+b.dataset.warp;document.querySelectorAll('[data-warp]').forEach(x=>x.classList.toggle('on',x===b));});
for(const [id,dir] of [['btnLeft',-1],['btnRight',1]]){const b=$(id);b.addEventListener('pointerdown',()=>steer=dir);for(const ev of ['pointerup','pointerleave','pointercancel'])b.addEventListener(ev,()=>{if(steer===dir)steer=0;});}
const keys={};
document.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();if(k==='m'){audioInit();soundToggle();return;}
  if(view!=='launch'||e.repeat&&e.code==='Space')return;
  if(e.code==='Space'){e.preventDefault();launchPressed();}
  if(k==='x')cut();if(k==='p')chute();if(k==='t')$('btnSas').click();
  if(k==='z'){$('throttle').value=100;$('throttle').dispatchEvent(new Event('input'));}
  if(k==='a'||e.key==='ArrowLeft'){steer=-1;keys.l=1;}if(k==='d'||e.key==='ArrowRight'){steer=1;keys.r=1;}});
document.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='a'||e.key==='ArrowLeft')keys.l=0;if(k==='d'||e.key==='ArrowRight')keys.r=0;steer=keys.r?1:keys.l?-1:0;});
window.addEventListener('resize',resize);

buildCatalogue();show('lab');requestAnimationFrame(frame);
window.__rl={get F(){return F},physStep,debrisStep,automation,launchPressed,separateStage,chute,newFlight,setDesign:d=>{design=clone(d);},EXAMPLES,analyse,stageReport};
