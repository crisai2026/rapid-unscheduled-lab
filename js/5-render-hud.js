/* ================= Rendering loop ================= */
const flyControls=new THREE.OrbitControls(fly.cam,renderer.domElement);flyControls.enableDamping=true;flyControls.maxDistance=4000;flyControls.minDistance=4;
const labControls=new THREE.OrbitControls(lab.cam,renderer.domElement);labControls.enableDamping=true;labControls.autoRotate=true;labControls.autoRotateSpeed=1.2;labControls.minDistance=3;labControls.maxDistance=50;
let view='lab',lastT=performance.now(),smokeAcc=0;
function vehicleFocus(V){
  if(!V)return new THREE.Vector3();
  if(V.broken){const ds=F.debris.filter(d=>d.owner===V);if(ds.length)return ds.reduce((b,c)=>c.m>b.m?c:b).obj.position.clone();}
  return new THREE.Vector3(V.x,V.y,V.z);
}
function focusPoint(){if(!F)return new THREE.Vector3();
  if($('camMode').value==='dropped'&&F.dropped.length)return vehicleFocus(F.dropped[F.dropped.length-1]);
  return vehicleFocus(F.player);}
function syncVehicle(V){
  if(V.broken)return;const r=V.root,sn=Math.sin(V.th),cs=Math.cos(V.th);
  r.rotation.z=-V.th;r.position.set(V.x-V.zc*sn,V.y-V.zc*cs,V.z);
  const vac=1-density(V.y)/RHO0;
  V.coreFlames.forEach(f=>{const on=V.Tc>0;f.visible=on;if(on){const fl=.85+Math.random()*.3,k=V.throttle*Math.max(.15,V.spool);f.scale.set(1+vac*1.8,k*fl*(1+vac*.8),1+vac*1.8);f.rotation.z=-V.gimbal;}});
  V.bFlames.forEach(b=>{const on=V.boostersLit&&V.f[b.idx]>0;b.f.visible=on;if(on){const fl=.85+Math.random()*.3;b.f.scale.set(1+vac,1.4*fl,1+vac);}});
}
function bottomOf(V){const sn=Math.sin(V.th),cs=Math.cos(V.th);return new THREE.Vector3(V.x-V.zc*sn-sn*1.5,V.y-V.zc*cs-cs*1.5,V.z);}
function frame(now){
  const rawDt=Math.min((now-lastT)/1000,.25),realDt=Math.min(rawDt,.05);lastT=now;
  if(view==='lab'){labE+=((labExplode?1:0)-labE)*Math.min(1,realDt*5);labStep();labControls.update();renderer.render(lab.scene,lab.cam);updateStageLabels();requestAnimationFrame(frame);return;}
  const S=F,V=S&&S.player;
  if(S&&S.countdown)tickCountdown(rawDt);
  if(V&&!V.broken&&V.left&&S.sas&&steer)V.target=clamp(V.target+steer*CONFIG.steerRate*realDt,-100*DEG,100*DEG);
  if(S&&S.launched&&!S.over){
    const dtSim=S.countdown?rawDt:realDt*warp,n=Math.round(dtSim/CONFIG.physicsStep);
    for(let i=0;i<n;i++){for(const v of S.vehicles)physStep(v,CONFIG.physicsStep);debrisStep(CONFIG.physicsStep);S.t+=CONFIG.physicsStep;automation();}
    S.vehicles.forEach(v=>{if(!v.player&&(v.broken||v.landed)&&!v._gone){v._gone=true;}});
  }
  if(S)S.vehicles.forEach(syncVehicle);
  const fp=focusPoint();
  // exhaust smoke: big ground cloud at liftoff, a trail in the air
  if(S){smokeAcc+=realDt;const rate=warp>1?.012:.022;
    while(smokeAcc>rate){smokeAcc-=rate;
      for(const v of S.vehicles){if(v.broken||v.T<=0)continue;const thick=density(v.y)/RHO0;if(thick<.02)continue;const b=bottomOf(v);
        if(v.y<40){for(let k=0;k<2;k++){const a=Math.random()*Math.PI*2,sp=8+Math.random()*14;emitSmoke(new THREE.Vector3(b.x,1,b.z),new THREE.Vector3(Math.cos(a)*sp,1+Math.random()*2,Math.sin(a)*sp),10,9,'#eef0f2',.6);}}
        else emitSmoke(b,new THREE.Vector3((Math.random()-.5)*2+v.wind*.3,(Math.random()-.5)*2,(Math.random()-.5)*2),3+6*(1-thick),6+6*thick);}
      if(S.venting&&V){const top=new THREE.Vector3(V.x+(Math.random()-.5)*.4,V.y+(Math.random()-.2)*V.P.L*.6,.6);if(Math.random()<.35)emitSmoke(top,new THREE.Vector3(1.5+Math.random(),-.6,(Math.random()-.5)),1.2,2,'#ffffff',.22);}
    }}
  smokePool.forEach(o=>{if(!o.s.visible)return;o.life+=realDt*Math.max(1,warp*.5);const t=o.life/o.max;if(t>=1){o.s.visible=false;return;}
    o.s.position.addScaledVector(o.v,realDt);o.v.multiplyScalar(1-realDt*.6);const s=1.5+o.grow*t*3;o.s.scale.set(s,s,1);o.s.material.opacity=o.op*(1-t);});
  firePool.forEach(o=>{if(!o.s.visible)return;o.life+=realDt;const t=o.life/o.max;if(t>=1){o.s.visible=false;return;}
    o.s.position.addScaledVector(o.v,realDt);const s=o.size*(.4+t);o.s.scale.set(s,s,1);o.s.material.opacity=.7*(1-t);o.s.material.color.setHSL(.09-.06*t,1,.6-.3*t);});
  flash.intensity*=.9;
  // parachute
  if(V&&V.chute.state==='open'&&!V.broken){chuteObj.visible=true;
    const top=new THREE.Vector3(V.x+(V.P.L-V.zc)*Math.sin(V.th),V.y+(V.P.L-V.zc)*Math.cos(V.th),V.z);
    let dir=new THREE.Vector3(-(V.vx-V.wind),-V.vy,0);if(V.landed||dir.length()<.5)dir.set(0,1,0);dir.normalize();
    const k=Math.max(.15,V.chute.infl);chuteObj.position.copy(top).addScaledVector(dir,14*k);chuteObj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);chuteObj.scale.setScalar(k);
    if(V.landed)chuteObj.position.y=Math.max(1,chuteObj.position.y-realDt*3);}
  else chuteObj.visible=false;
  // force arrows
  const showA=showForces&&V&&!V.broken&&!V.landed;Object.values(arrows).forEach(a=>a.visible=showA);
  if(showA){const W=V.m*gravity(V.y),unit=3/(V.m*g0),o=new THREE.Vector3(V.x,V.y,V.z);
    const setA=(a,fx,fy)=>{const L=Math.hypot(fx,fy)*unit;if(L<.3){a.visible=false;return;}a.position.copy(o);a.setDirection(new THREE.Vector3(fx,fy,0).normalize());const LL=Math.min(L,14);a.setLength(LL,Math.min(1.2,LL*.3),.6);};
    setA(arrows.thrust,V.Tc*Math.sin(V.th+V.gimbal)+V.Tb*Math.sin(V.th),V.Tc*Math.cos(V.th+V.gimbal)+V.Tb*Math.cos(V.th));setA(arrows.weight,0,-W);setA(arrows.aero,V.aeroF.x,V.aeroF.y);}
  // camera
  const camMode=$('camMode').value;
  if(camMode!=='ground'){flyControls.enabled=true;const d=fp.clone().sub(flyControls.target);fly.cam.position.add(d);flyControls.target.copy(fp);flyControls.update();fly.cam.fov=55;}
  else{flyControls.enabled=false;fly.cam.position.set(-180,3,140);fly.cam.lookAt(fp);fly.cam.fov=clamp(2*Math.atan(14/fly.cam.position.distanceTo(fp))/DEG,.05,60);}
  if(S&&V&&!V.broken&&V.T>0){const shake=clamp(V.T/30000*(density(V.y)/RHO0)*.06*(60/(fly.cam.position.distanceTo(fp)+20)),0,.25);fly.cam.position.x+=(Math.random()-.5)*shake;fly.cam.position.y+=(Math.random()-.5)*shake;}
  fly.cam.updateProjectionMatrix();
  const ch=fly.cam.position.y;fly.scene.background=skyAt(ch);stars.material.opacity=clamp((ch-20000)/30000,0,1);clouds.visible=ch<40000;
  renderer.render(fly.scene,fly.cam);
  if(S&&S.liftoffT!=null){const tt=S.t-S.liftoffT,V2=S.player,fp2=vehicleFocus(V2);
    if(!S.hist.length||tt-S.hist[S.hist.length-1][0]>=.5){let sp=Math.hypot(V2.vx,V2.vy);if(V2.broken){const ds=S.debris.filter(d=>d.owner===V2);sp=ds.length?ds.reduce((b,c)=>c.m>b.m?c:b).v.length():0;}
      S.hist.push([tt,Math.max(0,V2.broken?fp2.y:V2.y),sp]);}}
  if(S&&++S.chartTick%4===0)drawChart();
  if(S){updateSound(realDt);updateTele();
    if(S.overAt&&!S.over&&now>S.overAt){S.over=true;showSummary();}}
  requestAnimationFrame(frame);
}
function updateSound(dt){
  if(!SND.ctx)return;const S=F,V=S.player;
  while(S.events.length){const e=S.events.shift();if(e==='boom')sfx.boom();}
  const near=v=>clamp(80/(fly.cam.position.distanceTo(new THREE.Vector3(v.x,v.y,v.z))+30),.05,1.2);
  let eng=0,crk=0;
  for(const v of S.vehicles){if(v.broken||v.T<=0)continue;const air=.12+.88*density(v.y)/RHO0,k=Math.min(1.4,v.T/30000)*air*near(v);eng+=k;crk+=k*(.6+Math.random()*.8);}
  setG(SND.eng.g,Math.min(1.3,eng*.9));SND.eng.f.frequency.setTargetAtTime(220+eng*500,SND.ctx.currentTime,.1);
  setG(SND.crk.g,Math.min(.5,crk*.25),.03);setG(SND.rumbleG,Math.min(.6,eng*.4));
  const q=V&&!V.broken?V.q:0;setG(SND.wind.g,Math.min(.35,q/60000));SND.wind.f.frequency.setTargetAtTime(300+Math.min(1500,q/30),SND.ctx.currentTime,.2);
  setG(SND.vent.g,S.venting?.07:0,.3);
  // turbopump whine: spins up from T-6 and fades once the engine roars
  let pump=0;if(S.pumpStart&&V&&!V.broken){const t=(performance.now()-S.pumpStart)/1000;pump=t<8?Math.min(1,t/3):Math.max(0,1-(t-8)/3);SND.pumpO.frequency.setTargetAtTime(180+Math.min(1,t/4)*900,SND.ctx.currentTime,.3);}
  setG(SND.pumpG,pump*.06,.2);
}

/* ================= HUD ================= */
function updateTele(){
  const S=F,V=S.player;let alt=V.y,Vel=Math.hypot(V.vx,V.vy),vy=V.vy;
  if(V.broken){const fp=vehicleFocus(V);alt=fp.y;const ds=S.debris.filter(d=>d.owner===V);if(ds.length){const d=ds.reduce((b,c)=>c.m>b.m?c:b);Vel=d.v.length();vy=d.v.y;}}
  const [v,u]=fmtAlt(Math.max(0,alt));$('tAlt').textContent=v;$('tAltU').textContent=u;
  $('altLabel').textContent=V.broken?'Altitude · biggest piece':'Altitude';
  $('goalFill').style.width=Math.min(100,S.maxH/1000)+'%';$('goalLabel').textContent=S.maxH>=100000?'Goal reached: you made it to space!':`Goal: space · 100 km (best ${fmtAlt(S.maxH).join(' ')})`;
  const cf=coreFuel(V),cc=V.P.coreTanks.reduce((a,i)=>a+V.P.items[i].fuelCap,0),bf=boosterFuel(V);
  $('tkv').innerHTML=`<dt>Time</dt><dd>${S.liftoffT==null?'on the pad':'T+'+fmt(S.t-S.liftoffT,1)+' s'}</dd>
   <dt>Speed</dt><dd>${fmt(Vel)} m/s</dd><dt>Climbing</dt><dd>${fmt(vy)} m/s</dd>
   <dt>Downrange</dt><dd>${fmtAlt(V.x).join(' ')}</dd>
   <dt>Tilt from vertical</dt><dd>${fmt(Math.round(V.th/DEG)+0)}°</dd>
   <dt>Angle to airflow</dt><dd class="${Math.abs(V.alpha)>10*DEG&&V.q>500?'warn':''}">${Math.hypot(V.vx-V.wind,V.vy)<5?'—':fmt(Math.round(Math.abs(V.alpha)/DEG))+'°'}</dd>
   <dt>Mach</dt><dd>${fmt(V.mach,2)}</dd><dt>Air pressure on nose</dt><dd>${fmt(V.q/1000,1)} kPa</dd>
   <dt>Mass now</dt><dd>${fmt(V.m)} kg</dd>
   <dt>Stage ${V.stageNo} fuel</dt><dd>${cc?fmt(cf/cc*100):0}%</dd>
   ${V.P.boosterIdx.length?`<dt>Booster fuel</dt><dd>${fmt(bf/(V.P.boosterIdx.length*PARTS.srb.fuel)*100)}%</dd>`:''}
   <dt>Highest</dt><dd>${fmtAlt(S.maxH).join(' ')}</dd>`;
  const pct=Math.min(1,V.Nload/CONFIG.structuralLimit);$('loadFill').style.width=(pct*100)+'%';$('loadFill').style.background=pct<.5?'var(--good)':pct<.8?'var(--warn)':'var(--bad)';
  const W=V.m*gravity(V.y),aero=Math.hypot(V.aeroF.x,V.aeroF.y);
  $('fkv').innerHTML=`<dt style="color:var(--thrust)">Thrust${V.Tb>0?' (core + boosters)':''}</dt><dd>${fmt(V.T/1000,1)} kN</dd>
   <dt style="color:var(--weight)">Weight</dt><dd>${fmt(W/1000,1)} kN</dd>
   <dt style="color:var(--drag)">Air (drag + side push)</dt><dd>${fmt(aero/1000,2)} kN</dd>
   <dt>Sideways air load</dt><dd>${fmt(V.Nload/1000,2)} kN</dd><dt>Engine gimbal</dt><dd>${fmt(V.gimbal/DEG+0,1)}°</dd>`;
  const total=V.vd.stages?V.vd.stages.length+V.stageNo-1:1;
  const ev=nextEvent(V);
  $('stageTag').innerHTML=`STAGE ${V.stageNo} OF ${total}${ev?`<br><span style="color:var(--muted)">next: ${ev==='boosters'?'drop boosters':'separate stage '+V.stageNo}</span>`:''}${S.dropped.length?`<br><span style="color:var(--muted)">${S.dropped.length} piece${S.dropped.length>1?'s':''} dropped</span>`:''}`;
  const hint=$('hint');
  if(!S.launched){hint.hidden=false;hint.textContent='Press Space to start the launch sequence. A / D steer. Space again drops boosters and stages.';}
  else if(V.left&&!V.broken&&!V.landed&&V.vy<0&&V.chute.state==='packed'&&V.y>200&&!nextEvent(V)){hint.hidden=false;hint.textContent='Falling. Press P to open the parachute.';}
  else if(V.coreOut&&nextEvent(V)==='stage'&&!V.broken&&V.upperMargin<0&&V.q>CONFIG.safeStageQ){hint.hidden=false;hint.textContent=`Coasting. Air is still thick (${fmt(V.q/1000,1)} kPa) and stage ${V.stageNo+1} has no fins. ${$('optAuto').checked?'It will separate when the air thins.':'Wait, or press Space anyway.'}`;}
  else if(V.coreOut&&nextEvent(V)==='stage'&&!$('optAuto').checked&&!V.broken){hint.hidden=false;hint.textContent='Tanks empty. Press Space to drop this stage!';}
  else hint.hidden=true;
}
function drawChart(){
  const c=$('chart');if(!c||!c.clientWidth)return;const dpr=window.devicePixelRatio||1,W=c.clientWidth,H=c.clientHeight;
  if(c.width!==Math.round(W*dpr)){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);}
  const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
  const h=F.hist,L=40,Rr=40,T=10,B=18;
  const tMax=Math.max(60,h.length?h[h.length-1][0]:0),aMax=Math.max(1000,...h.map(p=>p[1]))*1.1,vMax=Math.max(100,...h.map(p=>p[2]))*1.1;
  const X=t=>L+t/tMax*(W-L-Rr),YA=a=>H-B-a/aMax*(H-B-T),YV=v=>H-B-v/vMax*(H-B-T);
  x.strokeStyle='#2c5a80';x.lineWidth=1;x.beginPath();x.moveTo(L,T);x.lineTo(L,H-B);x.lineTo(W-Rr,H-B);x.lineTo(W-Rr,T);x.stroke();
  x.font='10px "IBM Plex Mono", monospace';x.textAlign='right';x.fillStyle='#5fd38d';x.fillText(fmtAlt(aMax).join(''),L-4,T+8);x.fillText('0',L-4,H-B);
  x.textAlign='left';x.fillStyle='#ff8a2a';x.fillText(fmt(vMax)+' m/s',W-Rr+4,T+8);x.fillStyle='#8eafcb';x.textAlign='right';x.fillText(fmt(tMax)+' s',W-Rr,H-4);
  if(aMax>100000){x.setLineDash([4,4]);x.strokeStyle='rgba(95,211,141,.5)';x.beginPath();x.moveTo(L,YA(100000));x.lineTo(W-Rr,YA(100000));x.stroke();x.setLineDash([]);x.fillStyle='#5fd38d';x.textAlign='left';x.fillText('space',L+4,YA(100000)-3);}
  F.marks.forEach(([t,l],k)=>{const xx=X(t);x.setLineDash([3,3]);x.strokeStyle='rgba(142,175,203,.6)';x.beginPath();x.moveTo(xx,T);x.lineTo(xx,H-B);x.stroke();x.setLineDash([]);x.fillStyle='#8eafcb';x.textAlign='center';x.fillText(l,xx,T+8+(k%2)*11);});
  const line=(i,Y,col)=>{if(h.length<2)return;x.strokeStyle=col;x.lineWidth=2;x.beginPath();h.forEach((p,k)=>k?x.lineTo(X(p[0]),Y(p[i])):x.moveTo(X(p[0]),Y(p[i])));x.stroke();x.lineWidth=1;};
  line(1,YA,'#5fd38d');line(2,YV,'#ff8a2a');
}
function showSummary(){
  const S=F,o=S.outcome||{type:'broke'},[ah,au]=fmtAlt(S.maxH);
  const title=o.type==='landed'?'Recovered! Safe landing.':o.type==='crash'?'Crashed.':'Broke apart in the air.';
  const el=$('summary');el.hidden=false;
  el.innerHTML=`<h2>${title} Highest point ${ah} ${au}</h2><div class="grid">
    <div><span class="label">Flight time</span><span>${fmt(S.t-(S.liftoffT||0),1)} s</span></div>
    <div><span class="label">Top speed</span><span>${fmt(S.maxV)} m/s</span></div>
    <div><span class="label">Max Q</span><span>${fmt(S.maxQ/1000,1)} kPa</span></div>
    <div><span class="label">Stages / boosters dropped</span><span>${S.dropped.length}</span></div>
    <div><span class="label">Worst side load</span><span class="${S.maxLoad>CONFIG.structuralLimit?'bad':''}">${fmt(S.maxLoad/1000,1)} kN</span></div>
    ${o.v!=null?`<div><span class="label">Touchdown</span><span class="${o.type==='landed'?'good':'bad'}">${fmt(o.v,1)} m/s</span></div>`:''}</div>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="primary" id="again">Fly again</button><button id="tolab">Back to the lab</button></div>`;
  $('again').onclick=()=>newFlight();$('tolab').onclick=()=>show('lab');
}
