'use strict';
const el = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat('es-MX',{maximumFractionDigits:4}).format(n);
const catalog = [
 {name:'Tu panel experimental',p:null,v:null,i:null,area:null,ref:'Potencia nominal pendiente de identificar'},
 {name:'Victron BlueSolar · 20 W',p:20,v:18.5,i:1090,area:.440*.350,ref:'SPM040201200 · 440 × 350 mm'},
 {name:'Victron BlueSolar · 115 W',p:115,v:19,i:6040,area:1.030*.668,ref:'SPM041151202 · 1,030 × 668 mm'},
 {name:'Victron BlueSolar · 360 W',p:360,v:38.4,i:9380,area:1.980*1.002,ref:'SPM043602402 · 1,980 × 1,002 mm'},
];
const appliances = [['Iluminación LED',10,5,true],['Router',12,8,false],['Laptop',65,4,false],['Televisión',80,4,false],['Ventilador',50,6,false],['Aire acondicionado',900,4,false]];
el('loads').innerHTML = appliances.map(([name,w,h,on],i) => '<div class="device"><input type="checkbox" id="use-'+i+'" aria-label="Encender '+name+'" '+(on?'checked':'')+'><label for="use-'+i+'">'+name+'</label><input type="number" min="0.1" max="20000" step="any" value="'+w+'" aria-label="Potencia en W de '+name+'"><input type="number" min="0" max="24" step="any" value="'+h+'" aria-label="Horas al día de '+name+'"></div>').join('');
let pose = 0;
function numeric(id,min,max,fallback) {
 const input=el(id); const raw=input.value.trim(); const x=Number(raw);
 if(raw===''||!Number.isFinite(x)||x<min||x>max){input.setCustomValidity('Usa un valor entre '+min+' y '+max);return fallback;}
 input.setCustomValidity(''); return x;
}
function calculateSolar(p,n,g,angle,factor,hsp,inverter) {
 const c=angle>=90?0:Math.max(0,Math.cos(angle*Math.PI/180));
 const dc=p*n*(g/1000)*c;
 const available=Math.min(dc*factor,inverter);
 const daily=Math.min(p*n*c*factor,inverter)*hsp/1000;
 return {dc,available,daily};
}
function update() {
 const index=Number(el('panel').value),model=catalog[index];
 el('panel-index').textContent=(index+1)+' / 4'; el('panel-name').textContent=model.name;
 el('base-input').hidden=index!==0;
 let p=model.p;
 if(index===0 && el('base-watts').value.trim()) p=numeric('base-watts',.1,1000,null);
 const n=Number(el('quantity').value),a=Number(el('angle').value),g=Number(el('irradiance').value),f=Number(el('factor').value)/100;
 const h=numeric('hsp',0,12,null),inv=numeric('inverter',1,100000,null),area=numeric('area',1,1000,null);
 el('roof').style.setProperty('--panel-tilt',a+'deg');document.querySelector('.sun').style.opacity=.2+.8*g/1000;el('quantity-out').textContent=n;el('angle-out').textContent=a+'°';el('irradiance-out').textContent=g+' W/m²';el('factor-out').textContent=fmt(f*100)+'%';
 el('specs').innerHTML=model.p ? '<span class="pill">'+model.p+' Wp · ficha técnica STC</span><p class="small">Vmp '+model.v+' V · Imp '+fmt(model.i)+' mA<br>'+model.ref+'</p>' : '<span class="pill">Panel base · modelo pendiente</span><p class="small">Mayor voltaje registrado: 19.83 V. Corriente perpendicular: 3.52 mA. '+(p?'Potencia de '+fmt(p)+' W ingresada por el visitante.':'Confirma Pmax para estimar cargas.')+'</p>';
 el('fit').textContent=model.area && area!==null ? 'Capacidad preliminar de azotea: '+Math.floor(area*.7/model.area)+' módulos. '+(n*model.area>area*.7?'La cantidad elegida supera el área considerada.':'Cantidad dentro del área considerada.') : 'Dimensiones del panel base pendientes; capacidad de azotea no disponible.';
 el('roof').innerHTML=Array.from({length:Math.min(n,24)},()=>'<div class="pv '+(pose===0&&index===0?'down':'')+'"></div>').join('');
 let demand=0,energy=0,valid=true;
 for(const device of document.querySelectorAll('.device:has(input[type=checkbox])')) {
  const [enabled,w,hours]=device.querySelectorAll('input');if(!enabled.checked)continue;
  if(w.value===''||hours.value===''||!w.checkValidity()||!hours.checkValidity()){valid=false;continue;}
  demand+=Number(w.value);energy+=Number(w.value)*Number(hours.value)/1000;
 }
 el('demand').textContent=valid?fmt(energy)+' kWh':'Revisa los equipos';
 if(!p||h===null||inv===null||area===null||!valid) {
  el('instant').textContent='Pendiente';el('daily').textContent='Pendiente';el('house').classList.remove('lit');
  el('balance').textContent='Selecciona un panel de catálogo o ingresa Pmax de tu panel para estimar los equipos. Completa los parámetros válidos del escenario.';
  el('electrical').textContent='Las lecturas experimentales se consultan abajo y se conservan como registro independiente.';return;
 }
 const r=calculateSolar(p,n,g,a,f,h,inv),excess=Math.max(0,demand-r.available),energyGap=Math.max(0,energy-r.daily);
 const fits=model.area===null||n*model.area<=area*.7;
 el('instant').textContent=fmt(r.available)+' W';el('daily').textContent=fmt(r.daily)+' kWh';
 el('balance').innerHTML='<strong>'+fmt(demand)+' W seleccionados</strong><p>'+(excess>0?'Faltan '+fmt(excess)+' W en este instante.':'La potencia calculada alcanza para la carga simultánea seleccionada.')+'</p><p>'+(energyGap>0?'Déficit diario estimado de '+fmt(energyGap)+' kWh.':'La energía diaria calculada cubre el consumo seleccionado; revisa horarios y almacenamiento.')+'</p>'+(fits?'':'<p>La cantidad supera el área disponible para módulos. Ajusta el escenario de azotea.</p>');
 el('house').classList.toggle('lit',demand>0&&excess===0);
 el('electrical').textContent=model.v ? 'Por módulo: Vmp de catálogo '+model.v+' V; corriente equivalente del modelo a ese Vmp '+fmt(r.dc/n/model.v*1000)+' mA. La tensión total depende de las conexiones y la compatibilidad del inversor.' : 'Potencia hipotética definida por el visitante. Vmp e Imp del panel base pendientes.';
}
function showPose(index){pose=index;const readings=['Hacia abajo · 8.94 V · −2.22 mA','Hacia arriba · 19.83 V · 0.0269 mA','Perpendicular al sol · 19.34 V · 3.52 mA'];el('reading').textContent=readings[index];for(const b of document.querySelectorAll('[data-pose]'))b.setAttribute('aria-pressed',String(Number(b.dataset.pose)===index));update();}
for(const input of document.querySelectorAll('input'))input.addEventListener('input',update);
function floors(two){el('house').classList.toggle('two',two);el('one').setAttribute('aria-pressed',String(!two));el('two').setAttribute('aria-pressed',String(two));el('floor-note').textContent=(two?'Dos pisos':'Un piso')+' · Se mantienen el área de azotea y los equipos elegidos. Agrega cargas si tu segundo piso tiene más aparatos.';}
el('one').addEventListener('click',()=>floors(false));el('two').addEventListener('click',()=>floors(true));
el('orbit').addEventListener('input',()=>{const a=Number(el('orbit').value);el('scene').style.transform='translate(-50%,-50%) rotateX(-20deg) rotateY('+a+'deg)';el('orbit-out').textContent=a+'°';});
for(const b of document.querySelectorAll('[data-pose]'))b.addEventListener('click',()=>showPose(Number(b.dataset.pose)));
showPose(0);
