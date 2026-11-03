import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist');
const cache=path.join(root,'.cache-pyodide','0.28.3');
const origin='https://cdn.jsdelivr.net/pyodide/v0.28.3/full/';
const hash=data=>createHash('sha256').update(data).digest('hex');
const expectedRuntime=JSON.parse(await fs.readFile(path.join(root,'runtime-integridad.json'),'utf8'));
await fs.mkdir(cache,{recursive:true});
await fs.mkdir(output,{recursive:true});

async function download(name,expected){
  expected=expected||expectedRuntime[name];
  if(path.basename(name)!==name)throw Error('Nombre de recurso inválido');
  const dest=path.join(cache,name);
  try{
    const data=await fs.readFile(dest);
    if(data.length&&(!expected||hash(data)===expected))return data;
  }catch{}
  let error;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(origin+name,{signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw Error(`Descarga ${name}: HTTP ${response.status}`);
      const data=Buffer.from(await response.arrayBuffer());
      if(expected&&hash(data)!==expected)throw Error(`Checksum incorrecto: ${name}`);
      await fs.writeFile(dest,data);
      console.log(`Runtime: ${name} (${data.length} bytes)`);
      return data;
    }catch(e){error=e;}
  }
  throw error;
}

const lockData=await download('pyodide-lock.json');
const lock=JSON.parse(lockData);
const packages=new Set();
function include(name){
  if(packages.has(name))return;
  const pkg=lock.packages[name];
  if(!pkg)throw Error(`Paquete desconocido: ${name}`);
  packages.add(name);
  for(const dep of pkg.depends)include(dep);
}
include('numpy');
const runtime=path.join(output,'runtime','pyodide','0.28.3');
await fs.mkdir(runtime,{recursive:true});
const files=new Map([['pyodide-lock.json',lockData]]);
for(const name of ['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip'])files.set(name,await download(name));
for(const name of packages){
  const pkg=lock.packages[name];
  files.set(pkg.file_name,await download(pkg.file_name,pkg.sha256));
}
for(const [name,data]of files)await fs.writeFile(path.join(runtime,name),data);

await fs.cp(path.join(root,'interfaz'),output,{recursive:true});
await fs.cp(path.join(root,'web'),output,{recursive:true});
await fs.cp(path.join(root,'licencias'),path.join(output,'licencias'),{recursive:true});
await fs.cp(path.join(root,'motor'),path.join(output,'motor'),{recursive:true,filter:source=>!source.includes('__pycache__')&&!source.endsWith('.pyc')});

// Única adaptación de la aplicación: transporte de datos y descargas.
// No se regeneran el HTML, CSS, geometría, materiales, cámaras ni controles.
let app=await fs.readFile(path.join(root,'interfaz','app.js'),'utf8');
const oldApi="async function api(path,data){const options=data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};const r=await fetch('/api/'+path,options);const j=await r.json();if(!r.ok)throw Error(j.error||'Error HTTP '+r.status);return j;}";
if(!app.includes(oldApi))throw Error('Cambió el contrato de app.js; revisar la adaptación antes de construir.');
app="import {api, instalarDescargas} from './motor-cliente.js';\n"+app.replace(oldApi,'');
app=app.replace("'Servidor local conectado'","'Motor local conectado'")
       .replace("'Comprueba que servidor.py continúa abierto.'","'Recarga la página si el motor no responde.'")
       .replace('Precisión, recall y F1 por clase disponibles en /api/resultados.','Precisión, recall y F1 por clase calculados por el motor local.');
app=app.replace("try{parametros=await api('parametros');","instalarDescargas();\ntry{parametros=await api('parametros');");
await fs.writeFile(path.join(output,'app.js'),app);
const manifest={pyodide:'0.28.3',python:lock.info.python,numpy:lock.packages.numpy.version,
  runtime:Object.fromEntries([...files].map(([n,d])=>[n,hash(d)])),
  preserved:{},motor:{}};
for(const name of ['index.html','estilos.css','modelo.js'])manifest.preserved[name]=hash(await fs.readFile(path.join(output,name)));
for(const name of ['simulacion.py','clasificador.py','modelo_clasificadora.py','configuracion/parametros.json'])manifest.motor[name]=hash(await fs.readFile(path.join(output,'motor',name)));
await fs.writeFile(path.join(output,'compilacion.json'),JSON.stringify(manifest,null,2));
console.log(`BAYA listo en dist. Python ${manifest.python}, NumPy ${manifest.numpy}.`);
