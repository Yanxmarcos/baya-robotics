import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {GLTFExporter} from './vendor/GLTFExporter.js';
import {construirModelo} from './modelo.js';
import {alturaSegundoPiso, construirBaseMovil, construirPista, construirRiel, puntoDespacho} from './modelo-movil.js';
import {SeguidorDeLinea, estaciones} from './seguimiento.js';

const $=id=>document.getElementById(id), fmt=(n,d=2)=>Number(n).toLocaleString('es-PE',{maximumFractionDigits:d,minimumFractionDigits:d});
let estado=null,parametros=null,renderer,scene,camera,controls,modelo,base,clasificador,riel,selected=null,frutoSeleccionado=null;
let muestras=[],mallas=new Map(),labels=[],trayectoriaLinea,frames=0,fpsTime=performance.now(),currentView='follow';
const geometriaFruto=new THREE.SphereGeometry(1,12,9), materialesFruto=new Map();
const seguidor = new SeguidorDeLinea();
let tiempoVisual=0;
const escalaMovil = .205;
const centroCamara = new THREE.Vector3();
const centroEquipo = new THREE.Vector3(-.04, .67, .01);
const puntoProyectado = new THREE.Vector3();
const ejeVertical = new THREE.Vector3(0,1,0);
let giroCamara=0;
const datosPista = Object.fromEntries(['sensor-izq', 'sensor-der', 'vueltas', 'estacion'].map(id => [id, $(id)]));
const cicloInicial = {fase:'traslado',fase_s:0,estacion:null,movimiento_s:0,cestas:{},entregados:{},ultima_entrega:{}};
const fases = {
  traslado:['En ruta','El carrito sigue la línea. La banda termina de clasificar el lote a bordo.'],
  desplegar:['Abriendo el riel','El carrito se detiene y gira el riel hacia la estación.'],
  carga:['Recojo manual','Se cargan arándanos en el extremo del riel.'],
  replegar:['Cerrando el riel','El riel vuelve al segundo piso antes de avanzar.'],
  espera_despacho:['Esperando el despacho','El carrito espera a que termine la clasificación.'],
  descarga:['Retirando las cestas','Las cuatro cestas pasan a la mesa de despacho.'],
};
const cestasDespacho = new Map();
const etiquetaPieza = $('nombre-pieza');
function nombreComponente(pieza){
  return pieza.userData.etiqueta ?? pieza.name.replaceAll('_',' ');
}
async function api(path,data){const options=data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};const r=await fetch('/api/'+path,options);const j=await r.json();if(!r.ok)throw Error(j.error||'Error HTTP '+r.status);return j;}
function mensaje(text,error=false){$('mensaje').textContent=text;$('mensaje').style.color=error?'#8a3b29':'#006557';}
async function accion(path,data={}){try{const e=await api(path,data);if(e.contadores)actualizar(e);mensaje('');return e;}catch(e){mensaje(e.message,true);return null;}}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(a=>a.setAttribute('aria-selected',String(a===b)));document.querySelectorAll('.tab-panel').forEach(p=>p.hidden=p.id!==b.dataset.tab);if(b.dataset.tab==='resultados')metricas();});
$('iniciar').onclick=()=>accion('iniciar');$('pausar').onclick=()=>accion('pausar');$('paso').onclick=()=>accion('paso');
$('reiniciar').onclick=async()=>{
  if(!await accion('reiniciar'))return;
  selected=null;
  frutoSeleccionado=null;
  limpiarRecorrido();
  $('inspeccion').textContent='Recorrido y clasificación reiniciados. Selecciona un fruto o una pieza.';
};
$('reproduccion').onchange=()=>accion('configuracion',{reproduccion:Number($('reproduccion').value)});
$('aplicar').onclick=async()=>{const cambio={velocidad_m_s:Number($('velocidad').value),alimentacion_s:Number($('alimentacion').value)};if(Number($('semilla').value)!==estado?.configuracion.semilla)cambio.semilla=Number($('semilla').value);if(await accion('configuracion',cambio))mensaje('Parámetros aplicados.');};
$('aplicar-clase').onclick=async()=>{if(await accion('configuracion',{diametro_premium_mm:Number($('diametro').value),defecto_max:Number($('defecto').value),azul_min:Number($('azul').value),procesamiento_s:Number($('latencia').value),fallo_percepcion:Number($('fallo').value)}))mensaje('Se aplicarán a las próximas detecciones.');};
$('buscar').onclick=async()=>{try{const f=await api('frutos/'+Number($('buscar-fruto').value));selected=f.id;frutoSeleccionado=f;inspeccionarFruto(f);dibujarRecorrido(f);}catch(e){mensaje(e.message,true);}};
$('modo').onchange=()=>modelo?.vista($('modo').value);
$('cotas').onchange=()=>labels.filter(l=>l.cota).forEach(l=>l.el.hidden=!$('cotas').checked);
$('trayecto').onchange=()=>{if(trayectoriaLinea)trayectoriaLinea.visible=$('trayecto').checked;};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>vista(b.dataset.view));
$('actualizar-metricas').onclick=metricas;
async function metricas(){try{const r=await api('resultados');if(!r.evaluados){$('metricas').textContent='Aún no hay predicciones.';return;}$('metricas').replaceChildren();const p=document.createElement('p');p.textContent=`${r.evaluados} frutos con predicción · Exactitud sintética ${fmt(100*r.exactitud,1)} %. Sin predicción: ${r.sin_prediccion}.`;$('metricas').append(p);const table=document.createElement('table');const head=table.insertRow();['Ref. / Pred.','Rech.','Est.','Prem.'].forEach(t=>{const th=document.createElement('th');th.textContent=t;head.append(th);});r.matriz.forEach((row,i)=>{const tr=table.insertRow();[r.clases[i],...row].forEach(v=>tr.insertCell().textContent=v);});$('metricas').append(table);const note=document.createElement('p');note.className='help';note.textContent='Precisión, recall y F1 por clase disponibles en /api/resultados. Sólo datos sintéticos de este escenario.';$('metricas').append(note);}catch(e){mensaje(e.message,true);}}
const etapas=[
  ['Guiado: los dos sensores reflectivos leen la línea negra y corrigen el rumbo.','route'],
  ['Recojo: el carrito para en las estaciones naranjas y gira el riel para recibir la carga manual.','follow'],
  ['Transporte: los rodillos llevan cada fruto hacia la inspección.','top'],
  ['Inspección: el sistema genera mediciones sintéticas y asigna una clase.','front'],
  ['Despacho: se retiran las cuatro cestas en la estación celeste.','route'],
];
let etapa=0;
$('explicar').onclick=()=>{
  const [text,v]=etapas[etapa++%etapas.length];
  $('explicacion').textContent=text;
  vista(v);
  if(v==='front'){$('modo').value='interior';modelo?.vista('interior');}
};

function vista(v){
  if(!camera||!controls)return;
  currentView=v;
  document.querySelectorAll('[data-view]').forEach(button=>{
    const activa=button.dataset.view===v;
    button.classList.toggle('active',activa);
    button.setAttribute('aria-pressed',String(activa));
  });
  const offsets={
    follow:[1.65,1.16,2.05], route:[.001,12.0,.55],
    top:[.001,2.7,.025], front:[2.30,.63,.03], side:[0,.62,2.42],
  };
  const baseLocal = v==='route' ? centroCamara.set(0,0,0) : base.root.localToWorld(centroCamara.copy(centroEquipo));
  giroCamara=base.root.rotation.y;
  const ajuste = v==='route' ? Math.max(1,1.18/camera.aspect) : Math.max(.93,1.14/camera.aspect);
  const offset = new THREE.Vector3(...offsets[v]).multiplyScalar(ajuste);
  if(v!=='route')offset.applyQuaternion(base.root.quaternion);
  camera.position.copy(baseLocal).add(offset);
  controls.target.copy(baseLocal);
  controls.update();
}

function addLabel(text,position,cota=false,estacion=false){
  const el=document.createElement('span');
  el.className=estacion?'scene-label station-label':'scene-label';
  el.textContent=text;
  $('labels').append(el);
  labels.push({el,position,cota,estacion});
}

function init3D(){
 const host=$('escena');
 scene=new THREE.Scene();
 scene.background=new THREE.Color(0xe8edf0);
 camera=new THREE.PerspectiveCamera(38,1,.01,100);
 renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.2;
 host.prepend(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','Carrito seguidor de línea con clasificador de arándanos en 3D');
 renderer.domElement.tabIndex=0;

 scene.add(new THREE.HemisphereLight(0xe6f7ff,0x6f777c,2.6));
 const light=new THREE.DirectionalLight(0xfff6e9,3.2);
 light.position.set(2,7,5);
 light.castShadow=true;
 light.shadow.mapSize.set(2048,2048);
 Object.assign(light.shadow.camera,{left:-6,right:6,top:6,bottom:-6});
 light.shadow.bias=-.0004;
 scene.add(light);
 const fill=new THREE.DirectionalLight(0xd1e8ff,1.8);
 fill.position.set(0,4,-5);
 scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xdbe3e7,roughness:.9}));
 floor.rotation.x=-Math.PI/2;
 floor.position.y=-.008;
 floor.receiveShadow=true;
 scene.add(floor);

 const escenario=construirPista();
 scene.add(escenario.root);
 for(const l of escenario.labels)addLabel(l.text,l.position,false,true);
 base=construirBaseMovil();
 scene.add(base.root);
 clasificador=new THREE.Group();
 clasificador.name='Clasificador_compacto';
 clasificador.scale.setScalar(escalaMovil);
 clasificador.position.set(-parametros.geometria.largo_m*escalaMovil/2-.045,alturaSegundoPiso,-.04);
 base.root.add(clasificador);
 modelo=construirModelo(parametros);
 clasificador.add(modelo.root);
 riel=construirRiel(alturaSegundoPiso+parametros.geometria.altura_banda_m*escalaMovil,clasificador.position.x,clasificador.position.z);
 base.root.add(riel.root);
 for(const [i,[clase,{cesta,contenido}]] of Object.entries(modelo.cestas).entries()){
   const mesa=cesta.clone();
   const punto=puntoDespacho.clone().add(new THREE.Vector3((i-1.5)*.165,0,0));
   mesa.position.copy(punto);
   mesa.scale.setScalar(escalaMovil);
   mesa.visible=false;
   scene.add(mesa);
   cestasDespacho.set(clase,{mesa,punto,contenido:mesa.children.slice(-contenido.length)});
 }
 for(const l of modelo.labels)addLabel(l.text,l.position);
 addLabel('Segundo piso · separación ≈ 8,5 cm',new THREE.Vector3(2.5,.04,-1.55),true);
 actualizarCarrito(0);
 controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;
 controls.maxDistance=52;
 controls.minDistance=.45;
 controls.maxPolarAngle=Math.PI*.499;
 const resize=()=>{
   const w=host.clientWidth,h=host.clientHeight;
   if(!w||!h)return;
   renderer.setSize(w,h,false);
   camera.aspect=w/h;
   camera.updateProjectionMatrix();
   vista(currentView);
 };
 new ResizeObserver(resize).observe(host);
 resize();

 const canvas=renderer.domElement;
 const piezas=[...modelo.pickables,...base.pickables,...riel.pickables];
 const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
 function objetoEn(e){
   const rect=canvas.getBoundingClientRect();
   mouse.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);
   ray.setFromCamera(mouse,camera);
   return ray.intersectObjects([...mallas.values(),...piezas],false).find(h=>{
     let o=h.object;
     while(o){if(!o.visible)return false;o=o.parent;}
     return true;
   })?.object;
 }
 function componente(o){
   while(o.parent&&!o.userData.funcion)o=o.parent;
   return o;
 }
 let down=null;
 function ocultarNombre(){etiquetaPieza.hidden=true;canvas.style.cursor='';}
 canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];ocultarNombre();});
 canvas.addEventListener('pointermove',e=>{
   if(e.pointerType==='touch'||e.buttons)return;
   const o=objetoEn(e);
   if(!o){ocultarNombre();return;}
   etiquetaPieza.textContent=o.userData.fruto?`Fruto #${o.userData.fruto}`:nombreComponente(componente(o));
   etiquetaPieza.hidden=false;
   const rect=host.getBoundingClientRect();
   const x=e.clientX-rect.left,y=e.clientY-rect.top;
   etiquetaPieza.style.left=`${Math.max(6,Math.min(x+14,rect.width-etiquetaPieza.offsetWidth-6))}px`;
   etiquetaPieza.style.top=`${y+etiquetaPieza.offsetHeight+14>rect.height?y-etiquetaPieza.offsetHeight-10:y+12}px`;
   canvas.style.cursor='pointer';
 });
 canvas.addEventListener('pointerleave',ocultarNombre);
 canvas.addEventListener('pointercancel',()=>{down=null;ocultarNombre();});
 canvas.addEventListener('wheel',ocultarNombre,{passive:true});
 canvas.addEventListener('pointerup',e=>{
   const inicio=down;
   down=null;
   if(!inicio||Math.hypot(e.clientX-inicio[0],e.clientY-inicio[1])>5)return;
   const o=objetoEn(e);
   if(!o)return;
   $('detalle-inspeccion').open=true;
   if(o.userData.fruto){
     selected=o.userData.fruto;
     const f=estado?.frutos.find(f=>f.id===selected);
     if(f){inspeccionarFruto(f);dibujarRecorrido(f);}
   }else{
     selected=null;
     frutoSeleccionado=null;
     const pieza=componente(o);
     inspeccionarPieza(pieza,pieza.userData);
   }
 });
 requestAnimationFrame(animar);
}
function textPair(dl,label,value){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);}
function inspeccionarPieza(o,data){$('inspeccion').replaceChildren();const h=document.createElement('h2');h.textContent=nombreComponente(o);const p=document.createElement('p');p.textContent=data.funcion||'Pieza del conjunto';const note=document.createElement('p');note.className='help';note.textContent=data.evidencia||'Geometría académica estimada';$('inspeccion').append(h,p,note);if(trayectoriaLinea)trayectoriaLinea.visible=false;}
function inspeccionarFruto(f){frutoSeleccionado=f;$('inspeccion').replaceChildren();const h=document.createElement('h2');h.textContent='Fruto #'+f.id;const dl=document.createElement('dl');textPair(dl,'Canal · estado',`${f.canal+1} · ${f.estado}`);textPair(dl,'Diámetro de referencia',fmt(f.diametro_mm,1)+' mm');textPair(dl,'Etiqueta de evaluación',f.referencia);textPair(dl,'Medición recibida',f.mediciones?`${fmt(f.mediciones.diametro_mm,1)} mm · azul ${fmt(f.mediciones.azul)} · defecto ${fmt(f.mediciones.defecto)}`:'Pendiente de inspección');textPair(dl,'Predicción · destino',`${f.prediccion||'pendiente'} · ${f.destino||'pendiente'}`);for(const [k,label]of [['t_deteccion','Detección'],['t_decision','Decisión disponible'],['t_actuacion','Actuación']])textPair(dl,label,f[k]==null?'Pendiente':fmt(f[k],3)+' s');if(f.fallo)textPair(dl,'Contingencia',f.fallo);$('inspeccion').append(h,dl);}
function limpiarRecorrido(){
  if(!trayectoriaLinea)return;
  clasificador.remove(trayectoriaLinea);
  trayectoriaLinea.geometry.dispose();
  trayectoriaLinea.material.dispose();
  trayectoriaLinea=undefined;
}
function dibujarRecorrido(f){
  if(!clasificador)return;
  limpiarRecorrido();
  const g=parametros.geometria,z=(f.canal-(g.canales-1)/2)*g.paso_canal_m,h=g.altura_banda_m+.06,x=f.x_salida_m||g.largo_m;
  const points=[new THREE.Vector3(0,h,z),new THREE.Vector3(x,h,z),new THREE.Vector3(x,h-.42,.94)];
  trayectoriaLinea=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xd88700}));
  clasificador.add(trayectoriaLinea);
  trayectoriaLinea.visible=$('trayecto').checked;
}
function actualizarCarrito(tiempo,ciclo=cicloInicial){
  const pose=seguidor.avanzarHasta(tiempo);
  base.actualizar(pose);
  const punto=estaciones[ciclo.estacion ?? pose.siguiente]?.nombre ?? 'Inicio de vuelta';
  const valores={'sensor-izq':pose.izq>=.5?'Línea':'Piso','sensor-der':pose.der>=.5?'Línea':'Piso','vueltas':String(pose.vueltas),'estacion':punto};
  for(const [id, valor] of Object.entries(valores)){
    if(datosPista[id].textContent!==valor)datosPista[id].textContent=valor;
  }
}
function actualizarCestas(ciclo){
  const enDespacho=ciclo.fase==='descarga';
  const entregados=Object.values(ciclo.entregados).some(Boolean);
  for(const [i,[clase,{cesta,contenido,origen}]] of Object.entries(modelo.cestas).entries()){
    const {mesa,punto,contenido:contenidoMesa}=cestasDespacho.get(clase);
    cesta.position.copy(origen);
    if(enDespacho){
      const u=THREE.MathUtils.clamp((ciclo.fase_s-i*.29)/1.5,0,1);
      const destino=cesta.parent.worldToLocal(punto.clone());
      cesta.position.lerp(destino,u*u*(3-2*u));
      cesta.position.y+=Math.sin(u*Math.PI)*.92;
    }
    mesa.visible=entregados&&!enDespacho;
    contenido.forEach((fruto,j)=>{fruto.visible=j<(ciclo.cestas[clase]??0);});
    contenidoMesa.forEach((fruto,j)=>{fruto.visible=j<(ciclo.ultima_entrega[clase]??0);});
  }
}
function seguirCarrito(){
  if(currentView==='route')return;
  const nuevoCentro=base.root.localToWorld(centroEquipo.clone());
  const giro=base.root.rotation.y;
  for(const posicion of [camera.position,controls.target]){
    posicion.sub(centroCamara);
    if(currentView!=='follow')posicion.applyAxisAngle(ejeVertical,giro-giroCamara);
    posicion.add(nuevoCentro);
  }
  giroCamara=giro;
  centroCamara.copy(nuevoCentro);
}
function proyectarEtiquetas(){
  const w=$('escena').clientWidth,h=$('escena').clientHeight;
  const espacios=[];
  for(const l of labels){
    const visible=l.estacion ? currentView==='route' : currentView!=='route' && $(l.cota?'cotas':'etiquetas').checked;
    if(!visible){l.el.style.display='none';continue;}
    puntoProyectado.copy(l.position);
    if(!l.estacion)clasificador.localToWorld(puntoProyectado);
    const v=puntoProyectado.project(camera);
    const x=(v.x+1)/2*w,y=(1-v.y)/2*h;
    l.el.style.display='block';
    const mitad=l.ancho??=l.el.offsetWidth/2;
    const alto=l.alto??=l.el.offsetHeight;
    const caja={izq:x-mitad,der:x+mitad,arriba:y-alto,abajo:y};
    const dentro=v.z>-1&&v.z<1&&caja.izq>6&&caja.der<w-6&&caja.arriba>25&&caja.abajo<h-6;
    const superpuesta=espacios.some(o=>caja.izq<o.der+5&&caja.der>o.izq-5&&caja.arriba<o.abajo+5&&caja.abajo>o.arriba-5);
    if(!dentro||superpuesta){l.el.style.display='none';continue;}
    espacios.push(caja);
    l.el.style.left=x+'px';
    l.el.style.top=y+'px';
  }
}
function actualizar(e){
  if(estado&&e.t_s<estado.t_s){muestras=[];tiempoVisual=0;seguidor.reiniciar();}
  estado=e;
  muestras.push({e,real:performance.now()});
  if(muestras.length>4)muestras.shift();
  const ciclo=e.ciclo ?? cicloInicial;
  const aBordo=Object.values(ciclo.cestas).reduce((a,b)=>a+b,0);
  const entregados=Object.values(ciclo.entregados).reduce((a,b)=>a+b,0);
  const {ingresados,en_proceso}=e.contadores;
  for(const [id, valor] of Object.entries({ingresados,en_proceso,salidos:aBordo,entregados})){
    $(id).textContent=valor;
  }
  $('balance').textContent=`${ingresados} = ${en_proceso} + ${aBordo} + ${entregados}`;
  const [titulo,detalle]=e.t_s===0&&!e.activa
    ? ['Preparado','Pulsa Iniciar para llegar al primer punto de recojo.']
    : fases[ciclo.fase];
  if($('fase').textContent!==titulo)$('fase').textContent=titulo;
  if($('fase-detalle').textContent!==detalle)$('fase-detalle').textContent=detalle;
  $('tiempo').textContent=fmt(e.t_s)+' s';
  $('modo-reloj').textContent=e.activa?'En marcha':'Pausado';
  $('iniciar').textContent=e.t_s?'Reanudar':'Iniciar';
  $('iniciar').disabled=e.activa;
  $('pausar').disabled=!e.activa;
  $('paso').disabled=e.activa;
  $('reiniciar').disabled=false;
  $('conexion').textContent=e.error_motor?'Error del motor':'Simulación lista';
  if(e.error_motor)mensaje(e.error_motor,true);
  if(e.limite_alcanzado)mensaje('Límite de 5000 frutos: alimentación detenida. Reinicia para otro escenario.');
  for(const clase of ['premium','estandar','rechazo','revision'])$('cesta-'+clase).textContent=ciclo.cestas[clase]??0;
  const eventos=e.eventos.slice(-10).reverse().map(evt=>[`${fmt(evt.t_s)} s`,evt.tipo,(evt.id?'#'+evt.id+' · ':'')+evt.detalle]);
  const registro=$('eventos');
  const firma=JSON.stringify(eventos);
  if(registro.dataset.firma!==firma){
    registro.dataset.firma=firma;
    registro.replaceChildren(...eventos.map(fila=>{
      const row=document.createElement('div');
      row.className='event';
      for(const value of fila){
        const span=document.createElement('span');
        span.textContent=value;
        row.append(span);
      }
      return row;
    }));
  }
  const f=e.frutos.find(f=>f.id===selected);
  if(f){
    const cambio=frutoSeleccionado?.id!==f.id||frutoSeleccionado?.destino!==f.destino;
    inspeccionarFruto(f);
    if(cambio||!trayectoriaLinea)dibujarRecorrido(f);
  }else if(selected&&frutoSeleccionado?.estado!=='salida'){
    api('frutos/'+selected).then(f=>{if(f.id===selected)inspeccionarFruto(f);}).catch(()=>{});
  }
}
function animar(now){
 requestAnimationFrame(animar);
 frames++;
 if(now-fpsTime>=1000){
   $('fps').textContent=Math.round(frames*1000/(now-fpsTime))+' FPS';
   frames=0;
   fpsTime=now;
 }
 if(estado){
   const latest=muestras.at(-1),prev=muestras.at(-2);
   let alpha=1;
   if(prev&&estado.activa&&latest.e.t_s>prev.e.t_s){
     const duration=latest.real-prev.real;
     alpha=THREE.MathUtils.clamp((now-latest.real)/Math.max(duration,1),0,1);
   }
   const ciclo=estado.ciclo??cicloInicial;
   const anterior=prev?.e.ciclo??ciclo;
   const t=THREE.MathUtils.lerp(anterior.movimiento_s,ciclo.movimiento_s,alpha);
   tiempoVisual=Math.max(tiempoVisual,t);
   const fase_s=anterior.fase===ciclo.fase ? THREE.MathUtils.lerp(anterior.fase_s,ciclo.fase_s,alpha) : ciclo.fase_s;
   const faseVisual={...ciclo,fase_s};
   actualizarCarrito(tiempoVisual,faseVisual);
   riel.actualizar(faseVisual);
   actualizarCestas(faseVisual);
   seguirCarrito();
   const old=new Map(prev?.e.frutos.map(f=>[f.id,f])||[]),active=new Set();
   for(const f of estado.frutos){
     active.add(f.id);
     let mesh=mallas.get(f.id);
     if(!mesh){
       const key=Math.round(f.apariencia.azul*10);
       if(!materialesFruto.has(key))materialesFruto.set(key,new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.64,.56,.24+key*.013),roughness:.54}));
       mesh=new THREE.Mesh(geometriaFruto,materialesFruto.get(key));
       mesh.userData.fruto=f.id;
       mesh.name='Fruto_'+f.id;
       mesh.castShadow=true;
       clasificador.add(mesh);
       mallas.set(f.id,mesh);
     }
     const of=old.get(f.id);
     mesh.position.fromArray(f.posicion_m);
     if(of&&estado.activa)mesh.position.lerp(new THREE.Vector3(...of.posicion_m),1-alpha);
     mesh.rotation.z=-estado.desplazamiento_m/(f.diametro_mm/2000);
     // Aumenta la legibilidad del fruto sobre la maqueta. Las medidas del motor son las originales.
     const r=f.diametro_mm/2000*(f.id===selected?3.3:2.4);
     mesh.scale.set(r,r*.94,r);
     if(f.id===selected&&$('seguir').checked&&currentView!=='route'){
       controls.target.lerp(clasificador.localToWorld(mesh.position.clone()),.12);
     }
   }
   for(const [id,mesh] of mallas){
     if(!active.has(id)){clasificador.remove(mesh);mallas.delete(id);}
   }
   for(const r of modelo.rotors)r.rotation.y=-estado.desplazamiento_m/parametros.geometria.radio_rodillo_m;
 }
 controls.update();
 camera.updateMatrixWorld();
 proyectarEtiquetas();
 renderer.render(scene,camera);
}
$('exportar').onclick=async()=>{
 if(!base)return;
 $('exportar').disabled=true;
 try{
   const copy=base.root.clone(true);
   copy.position.set(0,0,0);
   copy.rotation.set(0,0,0);
   const compacto=copy.getObjectByName(clasificador.name);
   for(const node of [...compacto.children])if(node.name!==modelo.root.name)compacto.remove(node);
   for(const a of compacto.getObjectByName(modelo.root.name).children)a.position.set(0,0,0);
   for(const [clase,{origen}] of Object.entries(modelo.cestas))copy.getObjectByName('Cesta_'+clase).position.copy(origen);
   copy.getObjectByName(riel.root.name).children[0].rotation.y=0;
   const temporales=[];
   copy.traverse(o=>{
     if(['Contenido_simulado','Arandano_en_recojo'].includes(o.name))temporales.push(o);
     else o.visible=true;
   });
   temporales.forEach(o=>o.removeFromParent());
   const result=await new GLTFExporter().parseAsync(copy,{binary:true,onlyVisible:true});
   const blob=new Blob([result],{type:'model/gltf-binary'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;
   a.download='BAYA_Movil.glb';
   a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   mensaje('GLB de BAYA Móvil exportado. Maqueta visual.');
 }catch(e){
   mensaje('No se pudo exportar: '+e.message,true);
 }finally{
   $('exportar').disabled=false;
 }
};
async function poll(){try{actualizar(await api('estado'));}catch(e){$('conexion').textContent='Sin conexión · reintentando';mensaje('Comprueba que servidor.py continúa abierto.',true);}setTimeout(poll,100);}
try{parametros=await api('parametros');init3D();poll();}catch(e){$('scene-error').hidden=false;$('scene-error').textContent='No se pudo iniciar la escena: '+e.message+'. Comprueba WebGL y los recursos locales.';$('conexion').textContent='Error de inicialización';console.error(e);}
