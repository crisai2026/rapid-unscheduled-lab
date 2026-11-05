/* ================= Vehicles ================= */
// Every flying object (the rocket, a dropped stage, a spent booster) is a Vehicle with the same physics.
let F=null,warp=1,steer=0,showForces=true;
function makeVehicle(vd,o={}){
  const P=prep(vd);
  const f=P.items.map(it=>{if(o.fuelMap&&o.fuelMap.has(it.uid))return o.fuelMap.get(it.uid);return it.fuelCap;});
  const mp=massOf(P,f);
  const th=o.th||0,sn=Math.sin(th),cs=Math.cos(th),B=o.bottom||{x:0,y:0};
  const V={vd,P,f,x:B.x+mp.zc*sn,y:B.y+mp.zc*cs,z:o.z||0,vx:o.vx||0,vy:o.vy||0,vz:o.vz||0,th,om:o.om||0,zc:mp.zc,m:mp.m,
    engine:false,spool:0,spoolTime:.6,throttle:1,held:false,left:!!o.left,broken:false,landed:false,rest:false,
    boostersLit:!!o.boostersLit,coreOut:false,T:0,Tc:0,gimbal:0,alpha:0,q:0,mach:0,Nload:0,aeroF:{x:0,y:0},wind:0,
    chute:o.chute||{state:P.hasChute?'packed':'none',infl:0},name:o.name||'Rocket',player:!!o.player,
    stageNo:o.stageNo||1,prevMach:o.left?9:0,mach:o.left?9:0};
  if(vd.stages&&vd.stages.length>1){const Pu=prep({nose:vd.nose,stages:vd.stages.slice(1),dropB:true});V.upperMargin=(massOf(Pu,Pu.items.map(i=>i.fuelCap)).zc-Pu.cp)/CONFIG.bodyDiameter;}
  const mesh=buildMesh(P);Object.assign(V,mesh);fly.scene.add(V.root);
  return V;
}
function fuelMapOf(V){const m=new Map();V.P.items.forEach((it,i)=>m.set(it.uid,V.f[i]));return m;}
function removeVehicle(V){fly.scene.remove(V.root);F.vehicles=F.vehicles.filter(x=>x!==V);}
function windAt(y,t){const base=+$('wind').value;const prof=Math.min(Math.max(y,0)/1000,1)*(y<12000?1+y/12000:Math.max(0,2-(y-12000)/8000));
  return base*(.25+.75*prof)*(1+.25*Math.sin(t*.7)+.15*Math.sin(t*2.3));}
function coreFuel(V){let s=0;for(const i of V.P.coreTanks)s+=V.f[i];return s;}
function boosterFuel(V){let s=0;for(const i of V.P.boosterIdx)s+=V.f[i];return s;}
function totalFuel(V){return V.f.reduce((a,b)=>a+b,0);}

function physStep(V,dt){
  if(V.broken||V.landed||V.rest)return;
  const P=V.P,rho=density(V.y),g=gravity(V.y),pr=rho/RHO0;
  // core engines burn the tanks of the bottom stage
  let Tc=0,Tb=0;
  if(V.engine&&P.core.mdot>0){
    V.spool=Math.min(1,V.spool+dt/V.spoolTime);const tot=coreFuel(V);
    if(tot>0){const mdot=P.core.mdot*V.throttle*V.spool,burn=Math.min(tot,mdot*dt);
      if(burn>0){const isp=P.core.ispVac-(P.core.ispVac-P.core.ispSL)*pr;Tc=burn/dt*isp*g0;for(const i of P.coreTanks)V.f[i]-=burn*V.f[i]/tot;}
      if(tot-burn<=1e-6)V.coreOut=true;}
    else V.coreOut=true;
  } else V.spool=Math.max(0,V.spool-dt*3);
  // solid boosters: once lit they burn to the end
  if(V.boostersLit)for(const i of P.boosterIdx)if(V.f[i]>0){const b=Math.min(V.f[i],SRB_MDOT*dt);Tb+=b/dt*(PARTS.srb.ispVac-(PARTS.srb.ispVac-PARTS.srb.ispSL)*pr)*g0;V.f[i]-=b;}
  const mp=massOf(P,V.f),sn=Math.sin(V.th),cs=Math.cos(V.th);
  V.x+=(mp.zc-V.zc)*sn;V.y+=(mp.zc-V.zc)*cs;V.zc=mp.zc;
  const m=mp.m,I=mp.I,ax=[sn,cs],nx=[cs,-sn];
  const wind=windAt(V.y,F.t);V.wind=wind;
  const vr=[V.vx-wind,V.vy],Vel=Math.hypot(vr[0],vr[1]);
  const va=vr[0]*ax[0]+vr[1]*ax[1],vn=vr[0]*nx[0]+vr[1]*nx[1];
  const al=Math.atan2(vn,va),q=.5*rho*Vel*Vel,M=Vel/soundSpeed(V.y);
  V.alpha=al;V.q=q;V.prevMach=V.mach;V.mach=M;
  let Fx=0,Fy=-m*g,tau=0;
  const add=(fx,fy,z)=>{Fx+=fx;Fy+=fy;const r=z-V.zc;tau+=r*ax[0]*fy-r*ax[1]*fx;};
  let gim=0;
  if(Tc>0&&V.player){
    if(F.sas){/* load relief: in thick, fast air the autopilot points the nose into the airflow */const w=clamp(V.q/15000,0,.85);const err=(1-w)*(V.target-V.th)+w*V.alpha;gim=-clamp(CONFIG.autopilot.kp*err-CONFIG.autopilot.kd*V.om,-1,1)*CONFIG.gimbalMax;}
    else gim=-steer*CONFIG.gimbalMax;}
  if(Tc>0)add(Tc*Math.sin(V.th+gim),Tc*Math.cos(V.th+gim),0);
  if(Tb>0)add(Tb*sn,Tb*cs,0);
  V.gimbal=gim;V.Tc=Tc;V.Tb=Tb;V.T=Tc+Tb;
  const cd0=P.cd*(1+CONFIG.transonicBump*Math.exp(-(((M-1.1)/.35)**2)));
  const cdAx=Math.cos(al)>=0?cd0:CONFIG.baseCd;
  const FA=-q*P.aref*cdAx*Math.cos(al)*Math.abs(Math.cos(al));
  let aex=FA*ax[0],aey=FA*ax[1];add(aex,aey,V.zc);
  const sa=Math.sin(al),as=Math.abs(sa),fwd=Math.cos(al)>=0?1:.3;let Nsum=0,dampK=0;
  for(const nn of P.normals){let cn;
    if(nn.k==='nose'){cn=2*sa*fwd;dampK+=2*(nn.z-V.zc)**2;}
    else if(nn.k==='body'){cn=nn.K*sa*as;dampK+=.1*nn.K*(nn.z-V.zc)**2;}
    else{cn=Math.sign(sa)*Math.max(Math.min(nn.cna*as,nn.cna*Math.sin(CONFIG.finStall)),nn.flat*as);dampK+=nn.cna*(nn.z-V.zc)**2;}
    const f=-q*P.aref*cn;Nsum+=f;add(f*nx[0],f*nx[1],nn.z);aex+=f*nx[0];aey+=f*nx[1];}
  V.Nload=Math.abs(Nsum);V.aeroF={x:aex,y:aey};
  const ch=V.chute;
  if(ch.state==='open'){ch.infl=Math.min(1,ch.infl+dt/CONFIG.chute.inflate);
    const fc=q*CONFIG.chute.cd*Math.PI*(CONFIG.chute.diameter/2)**2*ch.infl*ch.infl;
    if(Vel>.01){add(-fc*vr[0]/Vel,-fc*vr[1]/Vel,P.L);V.aeroF.x-=fc*vr[0]/Vel;V.aeroF.y-=fc*vr[1]/Vel;}
    if(fc>CONFIG.chute.limit){ch.state='ripped';log(`Parachute ripped: ${fmt(fc/1000,1)} kN pull, limit ${CONFIG.chute.limit/1000} kN. Open it when slower.`);toast('Parachute ripped!');}}
  const damp=.5*rho*Vel*P.aref*dampK;
  if(!V.left){if(!V.held&&Fy>0&&V.T>0){V.left=true;if(V.player){F.liftoffT=F.t;log('Liftoff!');}}else{V.m=m;return;}}
  const omDot=(-tau-damp*V.om)/I;
  V.vx+=Fx/m*dt;V.vy+=Fy/m*dt;V.om+=omDot*dt;
  V.x+=V.vx*dt;V.y+=V.vy*dt;V.z+=V.vz*dt;V.vz*=1-.3*dt*pr;V.th+=V.om*dt;
  if(V.th>Math.PI)V.th-=2*Math.PI;if(V.th<-Math.PI)V.th+=2*Math.PI;
  V.m=m;
  if(V.player)playerRecords(V,Vel,q,al);
  if(V.Nload>CONFIG.structuralLimit){if(!V.player){log(`${V.name} tumbled and broke up in the airstream.`);breakup(V,'aero');return;}log(`${V.name} broke apart: sideways air load ${fmt(V.Nload/1000,1)} kN, limit ${CONFIG.structuralLimit/1000} kN. Angle to the airflow was ${fmt(Math.abs(al)/DEG)}°.`);breakup(V,'aero');return;}
  const yBot=V.y-V.zc*cs,yTop=V.y+(P.L-V.zc)*cs;
  if(Math.min(yBot,yTop)<=0&&V.vy<0){
    const v=Math.hypot(V.vx,V.vy);
    if(v<CONFIG.crashSpeed&&Math.abs(V.th)<25*DEG){V.landed=true;V.vx=V.vy=V.om=0;V.y=V.zc*cs;V.engine=false;
      log(`${V.name} touched down at ${fmt(v,1)} m/s.`);if(V.player){F.outcome={type:'landed',v};toast('Landed safely!');endSoon();}}
    else{if(V.player)F.outcome={type:'crash',v};log(`${V.name} hit the ground at ${fmt(v)} m/s.`);breakup(V,'ground');}
  }
}
function playerRecords(V,Vel,q,al){
  F.maxH=Math.max(F.maxH,V.y);F.maxV=Math.max(F.maxV,Vel);F.maxLoad=Math.max(F.maxLoad,V.Nload);
  if(q>F.maxQ)F.maxQ=q;else if(!F.maxQlogged&&F.maxQ>2000&&q<F.maxQ*.9){F.maxQlogged=true;log(`Max Q: ${fmt(F.maxQ/1000,1)} kPa of air pressure.`);}
  if(V.prevMach<1&&V.mach>=1&&V.y<25000){F.events.push('boom');log('Mach 1. Sonic boom!');}
  if(!F.apogee&&V.left&&V.vy<0&&V.y>50){F.apogee=true;log(`Top of the flight (apogee): ${fmtAlt(V.y).join(' ')}.`);mark('top');}
  while(F.milestone<CONFIG.milestones.length&&V.y>=CONFIG.milestones[F.milestone][0]){toast(CONFIG.milestones[F.milestone][1]);log('Passed '+CONFIG.milestones[F.milestone][1]+'.');F.milestone++;}
}
function mark(l){if(F&&F.liftoffT!=null)F.marks.push([F.t-F.liftoffT,l]);}
function endSoon(){if(!F.overAt)F.overAt=performance.now()+2500;}
const _wp=new THREE.Vector3();
function breakup(V,reason){
  V.broken=true;V.engine=false;V.boostersLit=false;
  V.coreFlames.forEach(f=>f.visible=false);V.bFlames.forEach(b=>b.f.visible=false);
  if(V.chute.state==='open')V.chute.state='ripped';
  if(V.player&&!F.outcome)F.outcome={type:'broke'};
  V.root.updateMatrixWorld(true);
  const center=new THREE.Vector3(V.x,V.y,V.z),fuelLeft=totalFuel(V);
  V.pieces.forEach(p=>{
    const it=V.P.items[p.userData.idx];fly.scene.attach(p);p.getWorldPosition(_wp);
    const r=_wp.clone().sub(center),kick=reason==='ground'?6:3;
    const v=new THREE.Vector3(V.vx+V.om*r.y,V.vy-V.om*r.x,V.vz).add(new THREE.Vector3((Math.random()-.5)*kick*2,Math.random()*kick+(reason==='ground'?Math.abs(V.vy)*.25:0),(Math.random()-.5)*kick*2));
    const fu=V.f[p.userData.idx]/p.userData.share;
    F.debris.push({obj:p,v,w:new THREE.Vector3((Math.random()-.5)*6,(Math.random()-.5)*6,(Math.random()-.5)*6),m:it.dry/p.userData.share+fu,cda:it.cat==='fins'?.6:it.h*.9+.3,r:it.cat==='fins'?.15:.45,rest:false,fuel:fu,owner:V});
  });
  const dist=fly.cam.position.distanceTo(center),vol=clamp(250/(dist+60),.08,1);
  if(fuelLeft>15){
    const big=Math.min(22,6+fuelLeft/40);
    F.debris.filter(d=>d.owner===V&&d.fuel>5).forEach(d=>{const p=d.obj.getWorldPosition(new THREE.Vector3());
      for(let i=0;i<9;i++)emitFire(p.clone().add(new THREE.Vector3((Math.random()-.5)*4,(Math.random()-.2)*4,(Math.random()-.5)*4)),big*(.5+Math.random()*.7),new THREE.Vector3((Math.random()-.5)*8,Math.random()*6,(Math.random()-.5)*8).add(new THREE.Vector3(V.vx,Math.max(V.vy,-5),0).multiplyScalar(.6)));
      for(let i=0;i<10;i++)emitSmoke(p.clone(),new THREE.Vector3((Math.random()-.5)*5,2+Math.random()*4,(Math.random()-.5)*5),big*1.4,14,'#4a4a4a',.6);});
    F.debris.filter(d=>d.owner===V).forEach(d=>{const dir=d.obj.getWorldPosition(new THREE.Vector3()).sub(center).normalize();d.v.addScaledVector(dir,10+Math.random()*15);d.v.y+=Math.random()*8;});
    flash.position.copy(center);flash.intensity=2.5;sfx.explosion(vol);
    log(`${fmt(fuelLeft)} kg of leftover fuel exploded.`);
  } else sfx.crash(vol);
  if(V.player)toast(reason==='aero'?'The air tore it apart!':'Crash!');
  fly.scene.remove(V.root);
}
const _q=new THREE.Quaternion(),_e=new THREE.Euler();
function debrisStep(dt){
  for(const d of F.debris){
    if(d.rest)continue;const p=d.obj.position,rho=density(p.y),V=d.v.length();
    d.v.y-=gravity(p.y)*dt;if(V>0)d.v.addScaledVector(d.v,-.5*rho*V*d.cda/d.m*dt);
    p.addScaledVector(d.v,dt);_e.set(d.w.x*dt,d.w.y*dt,d.w.z*dt);_q.setFromEuler(_e);d.obj.quaternion.premultiply(_q);
    if(p.y<d.r){p.y=d.r;if(d.v.y<0){if(d.v.y<-15&&d.fuel>5){for(let i=0;i<6;i++)emitFire(p.clone(),Math.min(18,8+d.fuel/30));d.fuel=0;}
      d.v.y=-d.v.y*.25;d.v.x*=.55;d.v.z*=.55;d.w.multiplyScalar(.6);}
      if(d.v.length()<.8){d.rest=true;d.v.set(0,0,0);}}
  }
}

/* ---- staging ---- */
function nextEvent(V){if(!V||V.broken||V.landed)return null;
  if(V.P.boosterIdx.length)return 'boosters';
  if(V.vd.stages&&V.vd.stages.length>1)return 'stage';return null;}
function dropBoosters(V,auto){
  const P=V.P;if(!P.boosterIdx.length)return;
  const sn=Math.sin(V.th),cs=Math.cos(V.th),B={x:V.x-V.zc*sn,y:V.y-V.zc*cs},fm=fuelMapOf(V);
  P.boosterIdx.forEach((i,k)=>{const it=P.items[i],lx=it.lat[0],lz=it.lat[1],side=Math.sign(lx)||0;
    const bv=makeVehicle({solo:'srb',uid:it.uid},{fuelMap:new Map([[it.uid,V.f[i]]]),bottom:{x:B.x+cs*lx,y:B.y-sn*lx},z:V.z+lz,th:V.th+side*4*DEG,om:V.om+side*.35,
      vx:V.vx+cs*side*3,vy:V.vy-sn*side*3,vz:V.vz+Math.sign(lz)*3,left:true,boostersLit:V.f[i]>0,name:'Booster '+(k+1)});
    F.vehicles.push(bv);F.dropped.push(bv);
    emitPuff(new THREE.Vector3(bv.x,bv.y,bv.z));});
  rebuildPlayer(V,Object.assign({},V.vd,{dropB:true}));
  sfx.clunk(.8);log(auto?'Boosters burned out and dropped away.':'Boosters released.');toast('Booster separation');mark('B');
}
function separateStage(){
  const V=F.player;if(!V.vd.stages||V.vd.stages.length<2)return;
  if(V.P.boosterIdx.length){dropBoosters(V,false);return;}
  const sn=Math.sin(V.th),cs=Math.cos(V.th),B={x:V.x-V.zc*sn,y:V.y-V.zc*cs},top0=V.P.stageTop[0],fm=fuelMapOf(V),push=CONFIG.separationPush;
  const lower=makeVehicle({nose:null,stages:[V.vd.stages[0]],dropB:true,interFor:V.vd.stages[1]},{fuelMap:fm,bottom:B,z:V.z,th:V.th,om:V.om*.9,vx:V.vx-sn*push,vy:V.vy-cs*push,vz:V.vz,left:true,name:'Stage '+V.stageNo});
  const upper=makeVehicle({nose:V.vd.nose,stages:V.vd.stages.slice(1),dropB:true},{fuelMap:fm,bottom:{x:B.x+top0*sn,y:B.y+top0*cs},z:V.z,th:V.th,om:V.om,vx:V.vx+sn*push,vy:V.vy+cs*push,vz:V.vz,left:true,chute:V.chute,player:true,name:'Rocket',stageNo:V.stageNo+1});
  upper.target=V.target;upper.throttle=V.throttle;upper.spoolTime=.8;
  F.vehicles=F.vehicles.filter(x=>x!==V);fly.scene.remove(V.root);
  F.vehicles.push(lower,upper);F.dropped.push(lower);F.player=upper;
  F.igniteAt=F.t+CONFIG.stageIgnitionDelay;
  emitPuff(new THREE.Vector3(B.x+top0*sn,B.y+top0*cs,V.z));sfx.clunk(1);
  log(`Stage ${V.stageNo} separated with ${fmt(coreFuel(lower))} kg of fuel left in it.`);toast(`Stage ${V.stageNo} separation`);mark('S'+V.stageNo);
}
function rebuildPlayer(V,vd){
  const fm=fuelMapOf(V),sn=Math.sin(V.th),cs=Math.cos(V.th),B={x:V.x-V.zc*sn,y:V.y-V.zc*cs};
  const nv=makeVehicle(vd,{fuelMap:fm,bottom:B,z:V.z,th:V.th,om:V.om,vx:V.vx,vy:V.vy,vz:V.vz,left:V.left,chute:V.chute,player:true,name:'Rocket',stageNo:V.stageNo});
  for(const k of ['engine','spool','throttle','target','boostersLit','held'])nv[k]=V[k];
  fly.scene.remove(V.root);F.vehicles[F.vehicles.indexOf(V)]=nv;F.player=nv;
}
function emitPuff(p){for(let i=0;i<14;i++)emitSmoke(p,new THREE.Vector3((Math.random()-.5)*6,(Math.random()-.5)*6,(Math.random()-.5)*6),3,3,'#f4f6f8',.7);}

/* ---- flight lifecycle ---- */
function newFlight(){
  if(F){F.vehicles.forEach(v=>fly.scene.remove(v.root));F.debris.forEach(d=>fly.scene.remove(d.obj));}
  if('speechSynthesis' in window)speechSynthesis.cancel();
  const a=analyse();buildTower(a.height);
  F={t:0,hist:[],marks:[],apogee:false,chartTick:0,vehicles:[],dropped:[],debris:[],player:null,sas:$('btnSas').classList.contains('on'),
    maxH:0,maxV:0,maxQ:0,maxLoad:0,milestone:0,maxQlogged:false,outcome:null,overAt:0,over:false,
    countdown:null,igniteAt:null,stageAt:null,events:[],liftoffT:null,launched:false};
  const V=makeVehicle(fullVd(),{player:true,name:'Rocket'});V.target=0;V.throttle=+$('throttle').value/100;
  F.vehicles.push(V);F.player=V;
  chuteObj.visible=false;smokePool.forEach(o=>o.s.visible=false);firePool.forEach(o=>o.s.visible=false);
  $('summary').hidden=true;$('count').hidden=true;$('log').innerHTML='';
  $('btnChute').disabled=!V.P.hasChute;
  fly.cam.position.set(20,6,16);flyControls.target.set(0,V.zc,0);
  log(`On the pad. ${design.stages.length} stage${design.stages.length>1?'s':''}, ${fmt(a.wet)} kg.`);
  updateLaunchBtn();
}
function log(msg){if(!F)return;const li=document.createElement('li');const tl=F.liftoffT!=null?'T+'+fmt(F.t-F.liftoffT,1)+'s':F.countdown?'T−'+Math.max(0,Math.ceil(F.countdown.t-1)):'pad';li.innerHTML=`<span>${tl}</span>${msg}`;$('log').prepend(li);}
let toastTimer;function toast(t){const el=$('toast');el.textContent=t;el.style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.style.opacity=0,2600);}

/* countdown script: seconds before liftoff → what happens */
const SCRIPT={10:['T minus ten','Terminal count'],9:['nine'],8:['eight'],7:['seven','Venting oxygen'],6:['six','Turbopumps spinning up'],5:['five'],4:['four'],3:['three','Ignition'],2:['two','Engines at full thrust'],1:['one','Hold-down clamps ready'],0:['Liftoff!','Liftoff']};
function launchPressed(){
  audioInit();const V=F.player;
  if(!F.launched){
    F.launched=true;
    if($('optCount').checked){F.countdown={t:CONFIG.countdownFrom+.95,last:CONFIG.countdownFrom+1};V.held=true;F.venting=true;}
    else{igniteAll(V,true);V.spoolTime=.6;}
    updateLaunchBtn();return;}
  if(F.countdown){abort();return;}
  // in flight: stage, or re-ignite
  const ev=nextEvent(V);
  if(ev==='boosters')dropBoosters(V,false);
  else if(ev==='stage')separateStage();
  else if(!V.engine&&coreFuel(V)>0){V.engine=true;log('Engine re-ignited.');}
  updateLaunchBtn();
}
function igniteAll(V,release){V.engine=true;if(V.P.boosterIdx.length)V.boostersLit=true;if(release)V.held=false;}
function abort(){F.countdown=null;F.launched=false;F.venting=false;const V=F.player;V.engine=false;V.held=false;$('count').hidden=true;log('Countdown aborted.');if('speechSynthesis' in window)speechSynthesis.cancel();say('Hold, hold, hold');updateLaunchBtn();}
function tickCountdown(dt){
  const C=F.countdown,V=F.player;C.t-=dt;const n=Math.ceil(C.t-1);
  if(n<C.last&&n>=0){C.last=n;const s=SCRIPT[n]||[String(n)];say(s[0]);beep(n===0?1320:880,.08,.05);
    if(s[1]&&n!==0)log(s[1]+'.');
    if(n===6)F.pumpStart=performance.now();
    if(n===3){V.engine=true;V.spoolTime=2.6;}
    if(n===0){V.held=false;if(V.P.boosterIdx.length)V.boostersLit=true;F.countdown=null;F.venting=false;$('count').hidden=true;updateLaunchBtn();return;}
    $('count').hidden=false;$('count').innerHTML=`T−${n}${s[1]?`<small>${s[1]}</small>`:''}`;}
}
function updateLaunchBtn(){
  const b=$('btnLaunch'),V=F&&F.player;if(!V)return;
  b.className='primary';b.disabled=false;
  if(!F.launched){b.innerHTML='Launch <kbd>Space</kbd>';return;}
  if(F.countdown){b.className='danger';b.innerHTML='Abort <kbd>Space</kbd>';return;}
  const ev=nextEvent(V);
  if(ev==='boosters')b.innerHTML='Drop boosters <kbd>Space</kbd>';
  else if(ev==='stage')b.innerHTML=`Separate stage ${V.stageNo} <kbd>Space</kbd>`;
  else if(!V.engine&&coreFuel(V)>0&&!V.broken)b.innerHTML='Re-ignite <kbd>Space</kbd>';
  else {b.innerHTML='No more stages';b.disabled=true;}
}
function cut(){const V=F&&F.player;if(V&&V.engine&&!F.countdown){V.engine=false;log(V.boostersLit&&boosterFuel(V)>0?'Main engine cut. The solid boosters keep burning: they can’t be switched off!':'Engine cut.');updateLaunchBtn();}}
function chute(){const V=F&&F.player;if(!V||V.chute.state!=='packed'||!V.left||V.broken)return;V.chute.state='open';V.chute.infl=0;sfx.chute();log(`Parachute opening at ${fmt(Math.hypot(V.vx,V.vy))} m/s.`);}

/* per-substep automation */
function automation(){
  const V=F.player;
  if(F.igniteAt!=null&&F.t>=F.igniteAt){F.igniteAt=null;if(!V.broken&&coreFuel(V)>0){V.engine=true;V.spool=0;log(`Stage ${V.stageNo} ignition.`);}updateLaunchBtn();}
  // boosters drop by themselves when empty
  for(const v of [V])if(v.P.boosterIdx.length&&v.boostersLit&&boosterFuel(v)<=0&&!v.broken){dropBoosters(v,true);updateLaunchBtn();}
  const P=F.player;
  if(P.coreOut&&P.engine&&!P._outLogged){P._outLogged=true;log(`Stage ${P.stageNo} burnout.`);mark('end'+P.stageNo);updateLaunchBtn();}
  if($('optAuto').checked&&P.coreOut&&P.vd.stages&&P.vd.stages.length>1&&F.stageAt==null&&!P.broken){
    if(P.upperMargin<0&&P.q>CONFIG.safeStageQ&&P.vy>0){if(!P._coastLogged){P._coastLogged=true;log(`Coasting up: stage ${P.stageNo+1} has no fins, so the flight computer waits for thinner air before separating.`);}}
    else F.stageAt=F.t+.4;}
  if(F.stageAt!=null&&F.t>=F.stageAt){F.stageAt=null;separateStage();updateLaunchBtn();}
}
