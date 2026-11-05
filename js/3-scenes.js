/* ================= LAB scene ================= */
const lab={scene:new THREE.Scene(),cam:new THREE.PerspectiveCamera(40,1,.1,500)};
lab.scene.background=new THREE.Color('#0e2740');
lab.scene.add(new THREE.HemisphereLight('#cfe3ff','#1b2c3d',.9));
{const dl=new THREE.DirectionalLight('#ffffff',1.1);dl.position.set(6,12,8);lab.scene.add(dl);
 lab.scene.add(new THREE.GridHelper(30,30,'#3d6d96','#1d3c5a'));
 const stand=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2,.15,48),mat('#2a4660'));stand.position.y=-.075;lab.scene.add(stand);}
lab.cam.position.set(9,6,13);
let labRocket=null,labMesh=null,labExplode=false,labE=0;const STAGE_GAP=2.2;const labMarkers=new THREE.Group();lab.scene.add(labMarkers);
function markerSphere(c){const m=new THREE.Mesh(new THREE.SphereGeometry(.16,20,14),new THREE.MeshBasicMaterial({color:c,depthTest:false}));m.renderOrder=10;return m;}
function lineMarker(c){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(1.8,0,0)]),new THREE.LineBasicMaterial({color:c,depthTest:false}));l.renderOrder=10;return l;}
const comM=markerSphere('#f2c14e'),copM=markerSphere('#4fe0e0'),comL=lineMarker('#f2c14e'),copL=lineMarker('#4fe0e0');labMarkers.add(comM,copM,comL,copL);

/* ================= FLIGHT scene ================= */
const fly={scene:new THREE.Scene(),cam:new THREE.PerspectiveCamera(55,1,.3,3e6)};
const skyStops=[[0,'#8cc3ec'],[3000,'#609fda'],[12000,'#2f5fa6'],[30000,'#122650'],[60000,'#040812']].map(([h,c])=>[h,new THREE.Color(c)]);
function skyAt(h){if(h<=0)return skyStops[0][1].clone();for(let i=1;i<skyStops.length;i++)if(h<skyStops[i][0]){const t=(h-skyStops[i-1][0])/(skyStops[i][0]-skyStops[i-1][0]);return skyStops[i-1][1].clone().lerp(skyStops[i][1],t);}return skyStops[skyStops.length-1][1].clone();}
fly.scene.background=skyAt(0);
fly.scene.add(new THREE.HemisphereLight('#dbeaff','#3f5a35',.8));
{const sun=new THREE.DirectionalLight('#fff4e0',1.2);sun.position.set(-300,500,200);fly.scene.add(sun);}
const grassTex=canvasTex((x,w,h)=>{x.fillStyle='#4d7a45';x.fillRect(0,0,w,h);for(let i=0;i<900;i++){x.fillStyle=`rgba(${30+Math.random()*40|0},${70+Math.random()*60|0},${30+Math.random()*30|0},.5)`;x.fillRect(Math.random()*w,Math.random()*h,3,3);}x.strokeStyle='rgba(255,255,255,.08)';x.strokeRect(0,0,w,h);});
grassTex.encoding=THREE.sRGBEncoding;grassTex.wrapS=grassTex.wrapT=THREE.RepeatWrapping;grassTex.repeat.set(4000,4000);grassTex.anisotropy=8;
{const ground=new THREE.Mesh(new THREE.PlaneGeometry(400000,400000),new THREE.MeshStandardMaterial({map:grassTex,roughness:1}));ground.rotation.x=-Math.PI/2;fly.scene.add(ground);
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(400000,200000),new THREE.MeshStandardMaterial({color:'#1d5b8a',roughness:.4}));sea.rotation.x=-Math.PI/2;sea.position.set(0,.05,-110000);fly.scene.add(sea);
 const pad=new THREE.Mesh(new THREE.CylinderGeometry(9,10,.3,48),mat('#8d918f',{roughness:.9}));pad.position.y=-.14;fly.scene.add(pad);
 const n=700,geo=new THREE.ConeGeometry(2.5,9,7).translate(0,4.5,0),im=new THREE.InstancedMesh(geo,mat('#2f5a2c',{roughness:1}),n),m4=new THREE.Matrix4();
 for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,r=60+Math.pow(Math.random(),.6)*3000,s=.6+Math.random()*.9;m4.makeScale(s,s,s);m4.setPosition(Math.cos(a)*r,0,Math.sin(a)*r);im.setMatrixAt(i,m4);}fly.scene.add(im);}
let tower=new THREE.Group();fly.scene.add(tower);
function buildTower(L){fly.scene.remove(tower);tower=new THREE.Group();const H=L+3,mm=mat('#b04a2f',{metalness:.5});
  for(const [x,z] of [[-2.6,-.6],[-2.6,.6],[-3.8,-.6],[-3.8,.6]]){const c=new THREE.Mesh(new THREE.BoxGeometry(.12,H,.12),mm);c.position.set(x,H/2,z);tower.add(c);}
  for(let y=1;y<H;y+=1.2){const b=new THREE.Mesh(new THREE.BoxGeometry(1.3,.08,1.3),mm);b.position.set(-3.2,y,0);tower.add(b);}
  fly.scene.add(tower);}
const clouds=new THREE.Group();fly.scene.add(clouds);
for(let i=0;i<60;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:softTex,color:'#ffffff',transparent:true,opacity:.55,depthWrite:false}));const w=250+Math.random()*500;s.scale.set(w,w*.35,1);s.position.set((Math.random()-.5)*12000,1400+Math.random()*2400,(Math.random()-.5)*12000);clouds.add(s);}
const stars=(()=>{const g=new THREE.BufferGeometry(),sp=[];for(let i=0;i<1500;i++){const v=new THREE.Vector3(Math.random()-.5,Math.random()*.6,Math.random()-.5).normalize().multiplyScalar(1.5e6);sp.push(v.x,v.y,v.z);}g.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
  const p=new THREE.Points(g,new THREE.PointsMaterial({color:'#ffffff',size:1.6,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false}));fly.scene.add(p);return p;})();
const arrows={thrust:new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),1,0xff8a2a),weight:new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),1,0x6db7ff),aero:new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),1,0xff6fa3)};
Object.values(arrows).forEach(a=>{a.traverse(o=>{if(o.material){o.material.depthTest=false;o.material.transparent=true;}});a.renderOrder=20;fly.scene.add(a);});
const chuteObj=new THREE.Group();
{const D=CONFIG.chute.diameter;const can=new THREE.Mesh(new THREE.SphereGeometry(D/2,28,12,0,Math.PI*2,0,Math.PI/2.2),new THREE.MeshStandardMaterial({color:'#ff5d3d',side:THREE.DoubleSide,roughness:.8}));can.scale.y=.6;chuteObj.add(can);
 const lp=[];for(let i=0;i<12;i++){const a=i/12*Math.PI*2;lp.push(Math.cos(a)*D/2*.97,D*.06,Math.sin(a)*D/2*.97,0,-14,0);}
 const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));chuteObj.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:'#e7eff7'})));}
chuteObj.visible=false;fly.scene.add(chuteObj);
const smokePool=[],firePool=[];
for(let i=0;i<500;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:softTex,color:'#dfe3e8',transparent:true,opacity:0,depthWrite:false}));s.visible=false;fly.scene.add(s);smokePool.push({s,life:0,max:1,v:new THREE.Vector3(),grow:1,op:.55});}
for(let i=0;i<90;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:softTex,color:'#ffb347',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));s.visible=false;fly.scene.add(s);firePool.push({s,life:0,max:1,size:1,v:new THREE.Vector3()});}
let smokeIdx=0,fireIdx=0;
function emitSmoke(p,v,size,life,color,op){const o=smokePool[smokeIdx++%smokePool.length];o.s.position.copy(p);o.v.copy(v);o.life=0;o.max=life;o.grow=size;o.op=op||.55;o.s.visible=true;o.s.material.color.set(color||'#dfe3e8');}
function emitFire(p,size,v){const o=firePool[fireIdx++%firePool.length];o.s.position.copy(p);o.v.copy(v||new THREE.Vector3());o.life=0;o.max=.9+Math.random()*.6;o.size=size;o.s.visible=true;}
const flash=new THREE.PointLight('#ffb050',0,400);fly.scene.add(flash);
