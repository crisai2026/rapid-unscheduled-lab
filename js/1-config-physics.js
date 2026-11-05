/* ================= CONFIG: tweak freely ================= */
const DEG=Math.PI/180;
const CONFIG={
  g0:9.81, earthRadius:6371000, seaLevelDensity:1.225, scaleHeight:8500,
  bodyDiameter:1.0,
  noNoseCd:1.0, finsCd:0.08, transonicBump:0.6, baseCd:1.1,
  fin:{span:0.9, chord:1.6},
  bodyLift:0.7, finStall:15*DEG,
  structuralLimit:45000,              // N of sideways air load before the rocket snaps
  crashSpeed:10,
  chute:{diameter:10, cd:1.5, inflate:2.0, limit:40000},
  gimbalMax:5*DEG, steerRate:12*DEG,
  autopilot:{kp:2.5, kd:1.3},
  physicsStep:0.005,
  countdownFrom:10,
  stageIgnitionDelay:1.0,             // s between separation and upper-stage ignition
  separationPush:1.5,                 // m/s springs push the stages apart
  safeStageQ:4000,                    // Pa: auto-stage waits for air this thin if the next stage is unstable
  maxStages:3,
  milestones:[[1000,'1 km'],[10000,'Airliner height · 10 km'],[50000,'Stratosphere top · 50 km'],[100000,'SPACE! Kármán line · 100 km']],
};
const PARTS={
  nose_blunt:{cat:'nose',name:'Blunt nose cone',mass:20,h:0.8,cd:0.75,desc:'Light, but draggy'},
  nose_ogive:{cat:'nose',name:'Pointed nose cone',mass:35,h:1.4,cd:0.30,desc:'Heavier, slices the air'},
  chute:     {cat:'chute',name:'Parachute bay',mass:30,h:0.5,desc:'10 m canopy · goes on the top stage'},
  probe:     {cat:'payload',name:'Instrument probe',mass:40,h:0.8,desc:'Your payload'},
  ballast:   {cat:'payload',name:'Lead ballast',mass:150,h:0.5,desc:'Pure weight, for experiments'},
  tank_s:    {cat:'tank',name:'Small fuel tank',mass:40,fuel:200,h:1.2,desc:'40 kg empty + 200 kg fuel'},
  tank_m:    {cat:'tank',name:'Medium fuel tank',mass:70,fuel:450,h:2.2,desc:'70 kg empty + 450 kg fuel'},
  tank_l:    {cat:'tank',name:'Large fuel tank',mass:120,fuel:900,h:3.8,desc:'120 kg empty + 900 kg fuel'},
  eng_spark: {cat:'engine',name:'Spark engine',mass:60,h:1.0,thrust:15000,ispSL:255,ispVac:310,desc:'15 kN · great in thin air'},
  eng_hornet:{cat:'engine',name:'Hornet engine',mass:120,h:1.4,thrust:30000,ispSL:250,ispVac:300,desc:'30 kN · all-rounder'},
  eng_bull:  {cat:'engine',name:'Bull engine',mass:220,h:1.8,thrust:60000,ispSL:235,ispVac:285,desc:'60 kN · thirsty'},
  fins:      {cat:'fins',name:'Fin set (4)',mass:15,h:0,desc:'Pulls the centre of pressure down'},
  decoupler: {cat:'decoupler',name:'Interstage',mass:25,h:0.3},
  srb:       {cat:'booster',name:'Solid booster',mass:60,fuel:240,h:3.2,r:0.28,thrust:22000,ispSL:220,ispVac:240},
};
const BOOSTER_OPTS=[[2,'2 solid boosters'],[4,'4 solid boosters']];
const CAT_LABEL={nose:'Nose cone (top of rocket)',chute:'Recovery',payload:'Payload',tank:'Fuel tanks',engine:'Engines (up to 3 per stage)',fins:'Fins',booster:'Side boosters (stage 1 only)'};
const CAT_COLOR={nose:'#d9e4ee',chute:'#ff5d5d',payload:'#9b8cff',tank:'#6db7ff',fuel:'#2f7fd1',engine:'#ff8a2a',fins:'#5fd38d',decoupler:'#f2c14e',booster:'#c9c9c9',bfuel:'#8d8d8d'};
const EXAMPLES={
  single:{label:'Single stage · 1 t',d:{nose:'nose_ogive',stages:[{middle:['chute','probe','tank_m','tank_s'],engines:['eng_hornet'],fins:true,boosters:0}]}},
  two:{label:'Two stage',d:{nose:'nose_ogive',stages:[{middle:['tank_m'],engines:['eng_hornet'],fins:true,boosters:0},{middle:['chute','probe','tank_s'],engines:['eng_spark'],fins:true,boosters:0}]}},
  boost:{label:'Two stage + boosters',d:{nose:'nose_ogive',stages:[{middle:['tank_l'],engines:['eng_hornet'],fins:true,boosters:2},{middle:['chute','probe','tank_s'],engines:['eng_spark'],fins:false,boosters:0}]}},
  three:{label:'Three stage',d:{nose:'nose_ogive',stages:[{middle:['tank_l'],engines:['eng_bull'],fins:true,boosters:0},{middle:['tank_m'],engines:['eng_hornet'],fins:true,boosters:0},{middle:['chute','probe','tank_s'],engines:['eng_spark'],fins:true,boosters:0}]}},
};
const clone=o=>JSON.parse(JSON.stringify(o));
let design=clone(EXAMPLES.boost.d), selStage=0;

/* ================= Physics model ================= */
const g0=CONFIG.g0, R0=CONFIG.bodyDiameter/2, RHO0=CONFIG.seaLevelDensity;
const density=h=>RHO0*Math.exp(-Math.max(h,0)/CONFIG.scaleHeight);
const gravity=h=>g0*(CONFIG.earthRadius/(CONFIG.earthRadius+Math.max(h,0)))**2;
const soundSpeed=h=>340-45*Math.min(Math.max(h,0)/11000,1);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function finCNa(){const {span:s,chord:c}=CONFIG.fin,d=CONFIG.bodyDiameter,lf=Math.hypot(s,c/2);return (16*(s/d)**2)/(1+Math.sqrt(1+(2*lf/c)**2))*(1+R0/(s+R0));}
function engineOffsets(n){if(n===1)return[[0,0]];if(n===2)return[[-.26,0],[.26,0]];return[0,1,2].map(i=>[.29*Math.cos(i*2.094),.29*Math.sin(i*2.094)]);}
function boosterOffsets(n){const lx=R0+PARTS.srb.r+.02;return n===4?[[lx,0],[-lx,0],[0,lx],[0,-lx]]:[[lx,0],[-lx,0]];}
const SRB_MDOT=PARTS.srb.thrust/(PARTS.srb.ispSL*g0);
/* Vehicle description: {nose, stages:[bottom→top], dropB} or {solo:'srb', uid} */
function fullVd(){return {nose:design.nose,stages:design.stages.map((s,i)=>Object.assign(s,{gi:i})),dropB:false};}
function prep(vd){
  const P={items:[],stageTop:[],normals:[],coreTanks:[],boosterIdx:[],core:{thrust:0,mdot:0,ispSL:0,ispVac:0},vd};
  const push=it=>{P.items.push(it);return P.items.length-1;};
  let vac=0;
  if(vd.solo){
    const p=PARTS.srb;P.R=p.r;P.aref=Math.PI*p.r*p.r;
    P.boosterIdx.push(push({key:'srb',cat:'booster',z0:0,h:p.h,zm:p.h*.45,dry:p.mass,fuelCap:p.fuel,lat:[0,0],uid:vd.uid,stage:0}));
    P.L=p.h;P.cd=0.5;P.normals.push({k:'nose',z:p.h-.3},{k:'body',K:CONFIG.bodyLift*p.h*2*p.r/P.aref,z:p.h/2});
  } else {
    P.R=R0;P.aref=Math.PI*R0*R0;let z=0,finSets=0,nb=0;const ns=vd.stages.length;
    vd.stages.forEach((st,si)=>{
      const n=st.engines.length,engH=n?Math.max(...st.engines.map(k=>PARTS[k].h)):0,offs=n?engineOffsets(n):[],base=z;
      st.engines.forEach((k,j)=>{const p=PARTS[k];push({key:k,cat:'engine',z0:base,h:p.h,zm:base+p.h/2,dry:p.mass,fuelCap:0,off:offs[j],n,stage:si,uid:st.gi+':e'+j});
        if(si===0){P.core.thrust+=p.thrust;P.core.mdot+=p.thrust/(p.ispSL*g0);vac+=p.thrust*p.ispVac/p.ispSL;}});
      z+=engH;
      for(let j=st.middle.length-1;j>=0;j--){const k=st.middle[j],p=PARTS[k];const i=push({key:k,cat:p.cat,z0:z,h:p.h,zm:z+p.h/2,dry:p.mass,fuelCap:p.fuel||0,stage:si,uid:st.gi+':m'+j});if(si===0&&p.fuel)P.coreTanks.push(i);z+=p.h;}
      if(st.fins){finSets++;const fb=base; // upper-stage fins sit beside its engine and stick out through slots in the interstage
        push({key:'fins',cat:'fins',z0:fb,h:CONFIG.fin.chord,zm:fb+CONFIG.fin.chord/3,dry:PARTS.fins.mass,fuelCap:0,stage:si,uid:st.gi+':f'});
        P.normals.push({k:'fin',cna:finCNa(),flat:1.2*1.41*CONFIG.fin.span*CONFIG.fin.chord/P.aref,z:fb+CONFIG.fin.chord/3});}
      if(si===0&&st.boosters&&!vd.dropB){nb=st.boosters;const p=PARTS.srb;
        boosterOffsets(nb).forEach((o,b)=>P.boosterIdx.push(push({key:'srb',cat:'booster',z0:base,h:p.h,zm:base+p.h*.45,dry:p.mass,fuelCap:p.fuel,lat:o,stage:0,uid:'b'+b})));
        P.normals.push({k:'body',K:CONFIG.bodyLift*2*p.h*2*p.r/P.aref,z:base+p.h/2});}
      // interstage: a shell that hides the next stage's engine; it stays with this (lower) stage
      const nx=si<ns-1?vd.stages[si+1]:(vd.interFor||null);
      if(nx){const nEngH=nx.engines.length?Math.max(...nx.engines.map(k=>PARTS[k].h)):0,ih=.3+nEngH;
        push({key:'decoupler',cat:'decoupler',z0:z,h:ih,zm:z+ih/2,dry:PARTS.decoupler.mass+12*nEngH,fuelCap:0,stage:si,uid:st.gi+':d'});
        if(si<ns-1){P.stageTop[si]=z+.3;z+=.3;}else{z+=ih;P.stageTop[si]=z;}}
      else P.stageTop[si]=z;
    });
    let zNose=z;
    if(vd.nose){const p=PARTS[vd.nose];push({key:vd.nose,cat:'nose',z0:z,h:p.h,zm:z+p.h*.35,dry:p.mass,fuelCap:0,stage:ns-1,uid:'nose'});zNose=vd.nose==='nose_ogive'?z+p.h*(1-.466):z+p.h*.4;z+=p.h;}
    P.L=Math.max(z,.1);
    P.normals.unshift({k:'nose',z:zNose},{k:'body',K:CONFIG.bodyLift*P.L*2*R0/P.aref,z:P.L/2});
    P.cd=(vd.nose?PARTS[vd.nose].cd:CONFIG.noNoseCd)+finSets*CONFIG.finsCd+nb*.16;
  }
  if(P.core.mdot){P.core.ispSL=P.core.thrust/(P.core.mdot*g0);P.core.ispVac=vac/(P.core.mdot*g0);}
  let cs=0,cz=0;for(const nn of P.normals){const c=nn.k==='nose'?2:nn.k==='fin'?nn.cna:0;cs+=c;cz+=c*nn.z;}P.cp=cs?cz/cs:P.L/2;
  P.hasChute=P.items.some(i=>i.key==='chute');
  return P;
}
function massOf(P,f){let m=0,s=0;const it=P.items;for(let i=0;i<it.length;i++){const mm=it[i].dry+f[i];m+=mm;s+=mm*it[i].zm;}
  const zc=m?s/m:0;let I=0;for(let i=0;i<it.length;i++){const mm=it[i].dry+f[i],lx=it[i].lat?it[i].lat[0]:0,r=it[i].cat==='booster'?.28:R0;I+=mm*((it[i].zm-zc)**2+lx*lx+(it[i].h*it[i].h+3*r*r)/12);}
  return {m,zc,I};}
// ideal (vacuum) Δv for each stage, worked out by burning fuel in small steps
function stageReport(){
  const rows=[];
  for(let i=0;i<design.stages.length;i++){
    const vd={nose:design.nose,stages:design.stages.slice(i),dropB:i>0};const P=prep(vd);
    const f=P.items.map(it=>it.fuelCap);let m=massOf(P,f).m;const m0=m;
    const tw=(P.core.thrust+P.boosterIdx.length*PARTS.srb.thrust)/(m0*g0);
    let dv=0,t=0,att=P.boosterIdx.length>0,guard=0;const dt=.05;
    const cf=()=>P.coreTanks.reduce((a,j)=>a+f[j],0);
    while(guard++<100000){let T=0,dm=0;const c=cf();
      if(c>0&&P.core.mdot>0){const b=Math.min(c,P.core.mdot*dt);T+=b/dt*P.core.ispVac*g0;dm+=b;P.coreTanks.forEach(j=>f[j]-=b*f[j]/c);}
      if(att)for(const j of P.boosterIdx)if(f[j]>0){const b=Math.min(f[j],SRB_MDOT*dt);T+=b/dt*PARTS.srb.ispVac*g0;dm+=b;f[j]-=b;}
      if(T<=0)break;dv+=T/m*dt;m-=dm;t+=dt;
      if(att&&P.boosterIdx.every(j=>f[j]<=0)){m-=P.boosterIdx.length*PARTS.srb.mass;att=false;}}
    rows.push({m0,dv,t,tw,margin:(massOf(P,P.items.map(it=>it.fuelCap)).zc-P.cp)/CONFIG.bodyDiameter});
  }
  return rows;
}
function analyse(){
  const P=prep(fullVd()),full=P.items.map(it=>it.fuelCap),empty=P.items.map(()=>0);
  const mf=massOf(P,full),me=massOf(P,empty);
  const byCat={};P.items.forEach((it,i)=>{const c=it.cat==='booster'?'booster':it.cat;byCat[c]=(byCat[c]||0)+it.dry;if(it.fuelCap)byCat[it.cat==='booster'?'bfuel':'fuel']=(byCat[it.cat==='booster'?'bfuel':'fuel']||0)+it.fuelCap;});
  const rows=stageReport();
  return {P,wet:mf.m,dry:me.m,byCat,rows,dv:rows.reduce((a,r)=>a+r.dv,0),twr:rows[0]?rows[0].tw:0,
    marginFull:(mf.zc-P.cp)/CONFIG.bodyDiameter,marginEmpty:(me.zc-P.cp)/CONFIG.bodyDiameter,height:P.L,zcFull:mf.zc};
}
const fmt=(n,dd=0)=>(+n).toLocaleString('en-NZ',{maximumFractionDigits:dd,minimumFractionDigits:dd});
const fmtAlt=h=>Math.abs(h)>=10000?[fmt(h/1000,1),'km']:[fmt(h),'m'];
const $=id=>document.getElementById(id);
