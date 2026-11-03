/* El reloj y el motor viven en este Worker, separados de WebGL y los FPS. */
let dispatch,tick,bridge,previous=performance.now();
const progress=message=>postMessage({kind:'progress',message});
async function initialize(){
  progress('Cargando motor local…');
  importScripts('./runtime/pyodide/0.28.3/pyodide.js');
  const py=await loadPyodide({indexURL:new URL('./runtime/pyodide/0.28.3/',self.location.href).href});
  progress('Preparando simulación…');
  await py.loadPackage('numpy');
  py.FS.mkdirTree('/baya/configuracion');
  const names=['simulacion.py','clasificador.py','modelo_clasificadora.py','configuracion/parametros.json','puente_web.py'];
  for(const name of names){
    const response=await fetch('./motor/'+name);
    if(!response.ok)throw Error('Falta un archivo del motor: '+name);
    py.FS.writeFile('/baya/'+name,await response.text());
  }
  py.runPython("import sys\nsys.path.insert(0, '/baya')\nfrom puente_web import PuenteWeb\n_baya = PuenteWeb()");
  bridge=py.globals.get('_baya');dispatch=bridge.request_json;tick=bridge.tick;
  previous=performance.now();
  setInterval(()=>{
    const now=performance.now(),elapsed=(now-previous)/1000;previous=now;
    try{tick(elapsed);}catch(error){postMessage({kind:'fatal',error:String(error)});}
  },4);
  const versions=JSON.parse(py.runPython("__import__('json').dumps({'python': sys.version.split()[0], 'numpy': __import__('numpy').__version__, 'pyodide': __import__('pyodide').__version__})"));
  postMessage({kind:'ready',versions});
}
self.addEventListener('message',({data})=>{
  try{
    const raw=dispatch(data.path,data.data===undefined?'':JSON.stringify(data.data));
    const result=JSON.parse(raw);
    postMessage({id:data.id,...result});
  }catch(error){postMessage({id:data.id,error:String(error)});}
});
initialize().catch(error=>postMessage({kind:'fatal',error:'No se pudo cargar el motor: '+String(error)}));
