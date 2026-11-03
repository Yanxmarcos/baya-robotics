// Adaptador RPC: conserva los contratos que consume la interfaz original.
let serial=0,fatal=null;
const pending=new Map();
const worker=new Worker(new URL('./motor-worker.js',import.meta.url),{name:'baya-motor'});
let resolveReady,rejectReady;
const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
// La inicialización puede fallar antes de que la interfaz solicite estado.
ready.catch(()=>{});
function status(text){const el=document.getElementById('conexion');if(el)el.textContent=text;}
function fail(error){
  if(fatal)return;
  fatal=error;rejectReady(error);
  for(const {reject,timer}of pending.values()){clearTimeout(timer);reject(error);}
  pending.clear();status('Error del motor');
}
worker.addEventListener('message',({data})=>{
  if(data.kind==='progress'){status(data.message);return;}
  if(data.kind==='ready'){resolveReady(data.versions);return;}
  if(data.kind==='fatal'){fail(Error(data.error));return;}
  const request=pending.get(data.id);
  if(!request)return;
  pending.delete(data.id);clearTimeout(request.timer);
  if(data.error)request.reject(Error(data.error));else request.resolve(data.value);
});
worker.addEventListener('error',event=>fail(Error(event.message||'No se pudo iniciar el motor local.')));
worker.addEventListener('messageerror',()=>fail(Error('No se pudo leer una respuesta del motor.')));
const configuration=fetch(new URL('./motor/configuracion/parametros.json',import.meta.url)).then(async r=>{
  if(!r.ok)throw Error('No se pudieron cargar los parámetros del proyecto.');return r.json();
});
export async function api(path,data){
  if(path==='parametros'&&data===undefined)return structuredClone(await configuration);
  await ready;
  if(fatal)throw fatal;
  return new Promise((resolve,reject)=>{
    const id=++serial;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('El motor tardó demasiado. Recarga la página para reiniciar.'));},120000);
    pending.set(id,{resolve,reject,timer});
    worker.postMessage({id,path,data});
  });
}
export async function versiones(){return ready;}
export function instalarDescargas(){
  document.querySelectorAll('a[href^="/api/"][download]').forEach(link=>{
    link.addEventListener('click',async event=>{
      event.preventDefault();
      try{
        const csv=await api(link.getAttribute('href').slice(5));
        const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
        const a=document.createElement('a');a.href=url;a.download=link.download;a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      }catch(error){const el=document.getElementById('mensaje');el.textContent=error.message;el.style.color='#8a3b29';}
    });
  });
}
