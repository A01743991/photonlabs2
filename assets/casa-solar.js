'use strict';
const $=id=>document.getElementById(id), fmt=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(n);
const catalog=[{p:null,v:null,i:null,w:1,h:1.6},{p:20,v:18.5,i:1090,w:.350,h:.440},{p:115,v:19,i:6040,w:.668,h:1.030},{p:360,v:38.4,i:9380,w:1.002,h:1.980}];
const appliances=[['💡','Foco LED',10,false],['📺','Televisión',80,false],['📱','Cargar teléfono',15,false],['🚪','Portón eléctrico',500,true],['🥤','Licuadora',400,true],['💻','Laptop',65,false],['📶','Router',12,false],['🌀','Ventilador',50,true]];
const state = {time:'custom', orientation:'fixed', floors:2};
$('loads').innerHTML=appliances.map(([icon,name,w,motor],i)=>`<div class="device"><span class="icon" aria-hidden="true">${icon}</span><label><input id="use-${i}" type="checkbox">${name}</label><details><summary>Editar potencia del equipo</summary><div class="watts"><input id="watts-${i}" type="number" min="1" max="20000" value="${w}" aria-label="Potencia en watts: ${name}"><span>W</span></div></details><span id="status-${i}" class="status"></span>${motor?'<small class="small">Revisar pico de arranque</small>':''}</div>`).join('');
function number(id,min,max,integer=false){const x=Number($(id).value);const ok=$(id).value.trim()!==''&&Number.isFinite(x)&&x>=min&&x<=max&&(!integer||Number.isInteger(x));$(id).setCustomValidity(ok?'':`Ingresa ${integer?'un entero':'un valor'} entre ${min} y ${max}`);return ok?x:null;}
const radians = Math.PI / 180;
function daylight() {
  const minute = Number($('solar-hour').value);
  const stops = [[420,8,180], [540,30,700], [720,75,1000], [900,42,760], [1140,5,90]];
  const end = stops.findIndex((stop, i) => i > 0 && minute <= stop[0]);
  const [startMinute, startAltitude, startG] = stops[end - 1];
  const [endMinute, endAltitude, endG] = stops[end];
  const mix = (minute - startMinute) / (endMinute - startMinute);
  const altitude = startAltitude + mix * (endAltitude-startAltitude);
  const azimuth = (minute <= 720 ? (720-minute)/300 : (720-minute)/420) * 83 * radians;
  const angle = altitude * radians;
  return {minute, altitude, g:state.time === 'night' ? 0 : startG + mix*(endG-startG),
    direction:{x:Math.cos(angle)*Math.sin(azimuth), y:Math.sin(angle), z:Math.cos(angle)*Math.cos(azimuth)}};
}
function panelNormal(light) {
  if (state.orientation === 'optimal') return light.direction;
  if (state.orientation === 'down') return {x:0,y:-1,z:0};
  const tilt = state.orientation === 'fixed' ? Number($('tilt').value)*radians : 0;
  return {x:0,y:Math.cos(tilt),z:Math.sin(tilt)};
}
function solar(p,n,light,factor,inv) {
  const normal=panelNormal(light), sun=light.direction;
  const capture=Math.max(0, Math.min(1, normal.x*sun.x+normal.y*sun.y+normal.z*sun.z));
  const dc = p*n*light.g/1000*capture;
  return {dc,power:Math.min(dc*factor,inv)};
}
let renderer,scene,camera,building,panelGroup,sunLight,windows=[],ambient,panels=[];
const viewport=$('viewport');
let yaw=.64,pitch=.63,distance=25.5,target={x:0,y:1.7,z:0};
function buildHouse() {
  if (!scene) return;
  if (building) scene.remove(building);
  windows=[]; panels=[];
  building=arquitectura.house(scene,state.floors,windows);
  panelGroup=new THREE.Group();
  building.add(panelGroup);
}
function arrangement(n) {
  const cols=Math.min(6,Math.ceil(Math.sqrt(n*1.4))), rows=Math.ceil(n/cols);
  return {cols,rows,freeX:Math.max(0,3.9-((cols-1)*1.23+1.35)/2),
    freeZ:Math.max(0,2.96-((rows-1)*1.45+1.42)/2)};
}
function buildPanels(n,light) {
  if (!panelGroup) return;
  const layout=arrangement(n);
  while (panels.length<n) panels.push(arquitectura.panel(panelGroup));
  while (panels.length>n) panelGroup.remove(panels.pop().mount);
  panelGroup.position.set(Number($('offset-x').value)*layout.freeX/100,state.floors*2.8+.86,
    Number($('offset-z').value)*layout.freeZ/100);
  const normal=new THREE.Vector3().copy(panelNormal(light)), up=new THREE.Vector3(0,1,0);
  panels.forEach(({mount,face},i)=>{
    const row=Math.floor(i/layout.cols);
    const rowCount=Math.min(layout.cols,n-row*layout.cols);
    mount.position.set((i%layout.cols-(rowCount-1)/2)*1.23,0,(row-(layout.rows-1)/2)*1.45);
    face.quaternion.setFromUnitVectors(up,normal);
  });
}
function cameraUpdate(){if(!camera)return;camera.position.set(target.x+distance*Math.cos(pitch)*Math.sin(yaw),target.y+distance*Math.sin(pitch),target.z+distance*Math.cos(pitch)*Math.cos(yaw));camera.lookAt(target.x,target.y,target.z);renderer.render(scene,camera);}
function setup3D() {
  try {
    scene=new THREE.Scene();
    scene.background=new THREE.Color(0x182a33);
    camera=new THREE.PerspectiveCamera(38,1,.1,120);
    try { renderer=new THREE.WebGLRenderer({antialias:true,alpha:false}); }
    catch { renderer=softwareRenderer(); }
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.05;
    viewport.prepend(renderer.domElement);
    ambient=new THREE.HemisphereLight(0xebf4ff,0xa39a7e,1.65);
    scene.add(ambient);
    sunLight=new THREE.DirectionalLight(0xffefd4,2.7);
    sunLight.castShadow=true;
    sunLight.position.set(8,15,8);
    sunLight.shadow.mapSize.set(2048,2048);
    Object.assign(sunLight.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:.1,far:55});
    sunLight.shadow.camera.updateProjectionMatrix();
    sunLight.shadow.normalBias=.018;
    sunLight.shadow.bias=-.00018;
    scene.add(sunLight);
    arquitectura.landscape(scene);
    buildHouse();
    const resize=()=>{
      const w=viewport.clientWidth,h=viewport.clientHeight;
      if(!w || !h) return;
      renderer.setSize(w,h);
      camera.aspect=w/h;
      // Mantener el terreno en cuadro incluso en pantallas verticales.
      camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(19*radians)/Math.min(1,w/h)));
      camera.updateProjectionMatrix();
      cameraUpdate();
    };
    new ResizeObserver(resize).observe(viewport);
    resize();
  } catch(error) {
    console.error(error);
    scene=null; camera=null;
    const message=document.createElement('p');
    message.textContent='El visor no pudo iniciarse. Puedes seguir explorando las potencias y los equipos.';
    message.style.cssText='position:absolute;top:40%;padding:24px;color:white';
    viewport.append(message);
  }
}
let placing=false;
function setPlacement(active) {
  placing=active;
  viewport.classList.toggle('placing',active);
  $('place-array').setAttribute('aria-pressed',String(active));
  $('place-array').textContent=active?'Cancelar colocación':'Elegir punto en la azotea';
  $('placement-help').textContent=active?'Toca la azotea para centrar el grupo en ese punto.':'Elige un punto en el modelo o usa los dos ajustes.';
}
$('place-array').onclick=()=>{
  if (!scene) return;
  setPlacement(!placing);
  if(placing){cameraPreset('roof');viewport.focus();}
};
viewport.addEventListener('keydown',e=>{if(e.key==='Escape') setPlacement(false);});
function positionAt(event) {
  const rect=viewport.getBoundingClientRect();
  const pointer=new THREE.Vector2(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height);
  const ray=new THREE.Raycaster();
  ray.setFromCamera(pointer,camera);
  const roof=new THREE.Plane(new THREE.Vector3(0,1,0),-(state.floors*2.8+.18));
  const hit=ray.ray.intersectPlane(roof,new THREE.Vector3());
  if (!hit || Math.abs(hit.x)>4.16 || Math.abs(hit.z)>3.16) return;
  const {freeX,freeZ}=arrangement(panels.length||1);
  $('offset-x').value=freeX?Math.round(100*hit.x/freeX):0;
  $('offset-z').value=freeZ?Math.round(100*hit.z/freeZ):0;
  setPlacement(false);
  update();
}
let materialRedraw=0;
window.addEventListener('studio-material',()=>{cancelAnimationFrame(materialRedraw); materialRedraw=requestAnimationFrame(cameraUpdate);});
const pointers=new Map();let pinch=0;
viewport.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;if(placing){positionAt(e);return;}cancelAnimationFrame(cameraAnimation);viewport.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=0;});
viewport.addEventListener('pointermove',e=>{const last=pointers.get(e.pointerId);if(!last)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],gap=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)distance=Math.max(10,Math.min(40,distance*pinch/gap));pinch=gap;pan(dx/2,dy/2);}else if(e.shiftKey||e.buttons===2)pan(dx,dy);else{yaw-=dx*.007;pitch=Math.max(.12,Math.min(1.35,pitch+dy*.005));}cameraUpdate();});
function pan(dx,dy){target.x-=dx*.012*Math.cos(yaw);target.z+=dx*.012*Math.sin(yaw);target.y=Math.max(0,Math.min(8,target.y+dy*.012));target.x=Math.max(-8,Math.min(8,target.x));target.z=Math.max(-8,Math.min(8,target.z));}
for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,e=>{pointers.delete(e.pointerId);pinch=0;});viewport.addEventListener('contextmenu',e=>e.preventDefault());viewport.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(10,Math.min(40,distance+e.deltaY*.015));cameraUpdate();},{passive:false});
let cameraAnimation=0;
function cameraPreset(view){cancelAnimationFrame(cameraAnimation);const start={yaw,pitch,distance,target:{...target}},end={yaw:view==='roof'?.02:.64,pitch:view==='roof'?1.43:.63,distance:view==='roof'?17:25.5,target:{x:0,y:view==='roof'?state.floors*2.8:state.floors*.85,z:0}};const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const duration=reduced?0:550;let began;function frame(now){if(began===undefined)began=now;const t=duration?Math.min(1,(now-began)/duration):1,e=1-Math.pow(1-t,3);yaw=start.yaw+(end.yaw-start.yaw)*e;pitch=start.pitch+(end.pitch-start.pitch)*e;distance=start.distance+(end.distance-start.distance)*e;for(const key of ['x','y','z'])target[key]=start.target[key]+(end.target[key]-start.target[key])*e;cameraUpdate();if(t<1)cameraAnimation=requestAnimationFrame(frame);}cameraAnimation=requestAnimationFrame(frame);} $('reset').onclick=()=>cameraPreset('house');$('view-house').onclick=()=>cameraPreset('house');$('view-roof').onclick=()=>cameraPreset('roof');$('zoom-in').onclick=()=>{distance=Math.max(10,distance-2);cameraUpdate();};$('zoom-out').onclick=()=>{distance=Math.min(40,distance+2);cameraUpdate();};viewport.addEventListener('keydown',e=>{if(e.target!==viewport)return;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.1;if(e.key==='ArrowRight')yaw+=.1;if(e.key==='ArrowUp')pitch=Math.min(1.35,pitch+.1);if(e.key==='ArrowDown')pitch=Math.max(.12,pitch-.1);if(e.key==='+')distance=Math.max(10,distance-2);if(e.key==='-')distance=Math.min(40,distance+2);cameraUpdate();});
function update(){const index=Number($('panel').value),m=catalog[index],n=number('quantity',1,24,true),inv=number('inverter',1,100000),f=number('factor',1,100);$('base-input').hidden=index!==0;const p=index===0?number('base-watts',.1,1000):m.p;const light=daylight();const r=p!==null&&n!==null&&inv!==null&&f!==null?solar(p,n,light,f/100,inv):null;
$('specs').textContent=m.p?`${m.p} Wp · Vmp ${m.v} V · Imp ${fmt(m.i)} mA. Referencia de catálogo; modelo descatalogado.`:'Panel base · identidad y potencia nominal pendientes.';
$('fit').textContent=m.p&&n?`Área neta de módulos: ${fmt(n*m.w*m.h)} m². ${n*m.w*m.h>48*.7?'Supera el 70% de la azotea representada.':'Distribución visual ilustrativa; requiere revisión de separaciones.'}`:'Dimensiones del panel base pendientes. La escala visual es ilustrativa.';
const night=state.time==='night';
const clock=String(Math.floor(light.minute/60)).padStart(2,'0')+':'+String(light.minute%60).padStart(2,'0');
$('scene-time').textContent=night?'Escena nocturna':clock+' · Luz solar';
$('hour-readout').textContent=night?'Noche':clock;
$('solar-hour').setAttribute('aria-valuetext',clock);
$('scene-description').textContent=`Casa de ${state.floors} ${state.floors===1?'piso':'pisos'} · ${n??'—'} ${n===1?'módulo':'módulos'}`;
$('sun-note').textContent=night?'Sin radiación solar. Para encender equipos necesitas red o batería.':`Escenario ilustrativo con altura solar de ${fmt(light.altitude)}° e irradiancia directa de ${fmt(light.g)} W/m². Las sombras son una guía visual.`;
$('tilt-controls').hidden=state.orientation!=='fixed';
$('tilt-value').textContent=$('tilt').value+'°';
const notes={optimal:night?'El soporte conserva su última posición.':`Seguimiento ideal. El panel gira hacia el sol y se inclina ${fmt(90-light.altitude)}°.`,
  fixed:'La cara activa mira al sur del modelo. Desliza la hora para comparar la luz que recibe.',
  up:'La cara activa queda horizontal hacia el cielo.',down:'La cara activa mira hacia el suelo.'};
$('orientation-note').textContent=notes[state.orientation];
let demand=0,valid=true;appliances.forEach((a,i)=>{const w=number('watts-'+i,1,20000);if($('use-'+i).checked){if(w===null)valid=false;else demand+=w;}const enough=r&&w!==null&&r.power>=w;$('status-'+i).textContent=w===null?'Revisa la potencia':!r?'Pendiente de potencia nominal':enough?(a[3]?'Marcha posible · arranque sin validar':'Alcanza por separado'):'No alcanza por separado';});
$('instant').textContent=r?fmt(r.power)+' W':'Pendiente';$('demand').textContent=valid?fmt(demand)+' W':'Revisar';$('margin').textContent=r&&valid?(r.power-demand>=0?'+':'−')+fmt(Math.abs(r.power-demand))+' W':'—';
$('balance').textContent=!r?'Confirma los watts de tu panel o elige un modelo de catálogo para explorar cargas.':!valid?'Corrige la potencia de los equipos seleccionados.':night?'Generación solar: 0 W. No se incluye alimentación de red ni batería.':demand===0?'Selecciona aparatos para comparar su consumo simultáneo.':demand<=r.power?'La potencia de marcha alcanza para el conjunto seleccionado. Los motores necesitan validar su pico de arranque.':`Faltan ${fmt(demand-r.power)} W para el conjunto seleccionado; reduce cargas o aumenta la capacidad del sistema.`;
$('electrical').textContent=r&&m.v?`Referencia por módulo: ${m.v} Vmp · corriente equivalente DC a ese Vmp: ${fmt(r.dc/n/m.v*1000)} mA. No es una predicción del voltaje real. No conectes aparatos directamente al panel.`:'Las mediciones experimentales de abajo son independientes del escenario de la casa.';
if(scene) {
  buildPanels(n??0,light);
  sunLight.position.copy(light.direction).multiplyScalar(20);
  sunLight.intensity=night?0:1.65+light.g*.0015;
  sunLight.color.set(light.altitude<25?0xffce95:0xffeed6);
  ambient.intensity=night?.28:1.52;
  scene.background.set(night?0x101b29:0x22343e);
  scene.userData.shadowRevision=[state.floors,n,light.minute,night,state.orientation,$('tilt').value,$('offset-x').value,$('offset-z').value].join('/');
  const lit=r&&valid&&demand>0&&demand<=r.power;
  if(windows.length) {
    windows[0].material.emissive.set(lit?0xe3a954:0x000000);
    windows[0].material.emissiveIntensity=lit?.48:0;
  }
  cameraUpdate();
}}
function markTime() {
  document.querySelectorAll('[data-time]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.time===state.time)));
}
$('solar-hour').addEventListener('input',()=>{
  const minute=Number($('solar-hour').value);
  state.time=minute===540?'day':minute===720?'noon':'custom';
  markTime();
});
for(const button of document.querySelectorAll('[data-time],[data-orientation],[data-floors]')) {
  button.onclick=()=>{
    const key=Object.keys(button.dataset)[0],value=button.dataset[key];
    state[key]=key==='floors'?Number(value):value;
    if(key==='time' && value!=='night') $('solar-hour').value=value==='day'?540:720;
    for(const other of document.querySelectorAll('[data-'+key+']')) other.setAttribute('aria-pressed',String(other===button));
    if(key==='floors') buildHouse();
    update();
  };
}
for(const input of document.querySelectorAll('input,select'))input.addEventListener('input',update);
$('less').onclick=()=>{$('quantity').value=Math.max(1,Number($('quantity').value)-1);update();};$('more').onclick=()=>{$('quantity').value=Math.min(24,Number($('quantity').value)+1);update();};
for(const b of document.querySelectorAll('[data-pose]'))b.onclick=()=>{const readings=['Hacia abajo · 8.94 V · −2.22 mA','Hacia arriba · 19.83 V · 0.0269 mA','Perpendicular al sol · 19.34 V · 3.52 mA'];$('reading').textContent=readings[Number(b.dataset.pose)];for(const o of document.querySelectorAll('[data-pose]'))o.setAttribute('aria-pressed',String(o===b));};
$('reading').textContent='Hacia abajo · 8.94 V · −2.22 mA';setup3D();update();
