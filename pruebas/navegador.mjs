// Prueba de aceptación: ejecución real de WebAssembly, UI original y descargas.
// Requiere Playwright + pixelmatch + pngjs (sólo desarrollo).
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(process.env.RUNTIME_NODE_MODULES?path.join(process.env.RUNTIME_NODE_MODULES,'_baya.cjs'):import.meta.url);
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const pm=require('pixelmatch');const pixelmatch=pm.default||pm;
const base=process.env.BAYA_URL||'http://127.0.0.1:4173';
const original=process.env.BAYA_ORIGINAL_URL;
const out=process.env.BAYA_QA_DIR||path.join(root,'pruebas','salidas');
await fs.mkdir(out,{recursive:true});
const report={errores:[],solicitudes_externas:[],comparacion_visual:[],pruebas:[]};
const browser=await chromium.launch({headless:true,channel:process.env.BAYA_BROWSER_CHANNEL||'msedge',args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.route('**/*',route=>{
  const url=route.request().url();
  return url.startsWith(base+'/')||(original&&url.startsWith(original+'/'))||url.startsWith('blob:')||url.startsWith('data:')?route.continue():route.abort();
});
const page=await context.newPage();
page.on('pageerror',e=>report.errores.push(e.message));
page.on('request',r=>{if(!r.url().startsWith(base+'/')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))report.solicitudes_externas.push(r.url());});
const api=(p,d)=>page.evaluate(async({p,d})=>(await import('/motor-cliente.js')).api(p,d),{p,d});
try{
  await page.goto(base);
  await page.waitForSelector('canvas',{timeout:30000});
  await page.waitForFunction(()=>document.getElementById('conexion').textContent==='Motor local conectado',null,{timeout:120000});
  report.versiones=await page.evaluate(async()=>(await import('/motor-cliente.js')).versiones());
  report.pruebas.push('Carga del runtime y escena WebGL sin backend');

  // Comparar cálculos con fixtures generados por el motor CPython original.
  const cases=JSON.parse(await fs.readFile(path.join(root,'pruebas/referencia.json'),'utf8'));
  const actual=await page.evaluate(async({cases,base})=>{
    const source=`importScripts(${JSON.stringify(base+'/runtime/pyodide/0.28.3/pyodide.js')});
      self.onmessage=async({data})=>{try{
        const py=await loadPyodide({indexURL:${JSON.stringify(base+'/runtime/pyodide/0.28.3/')}});
        await py.loadPackage('numpy');py.FS.mkdirTree('/baya/configuracion');
        for(const n of ['simulacion.py','clasificador.py','modelo_clasificadora.py','configuracion/parametros.json']){const r=await fetch(${JSON.stringify(base+'/motor/')}+n);py.FS.writeFile('/baya/'+n,await r.text());}
        py.FS.writeFile('/baya/casos.json',JSON.stringify(data));
        const result=py.runPython(\`import sys, json
sys.path.insert(0, '/baya')
from simulacion import Simulacion
_resultados = []
for _caso in json.load(open('/baya/casos.json')):
    _sim = Simulacion()
    for _accion, _valor in _caso['acciones']:
        if _accion == 'avanzar':
            for _ in range(round(_valor / _sim.p['proceso']['paso_s'])):
                _sim.paso()
        else:
            getattr(_sim, _accion)(_valor)
    _resultados.append({'estado': _sim.estado(), 'resultados': _sim.resultados(), 'frutos': _sim.frutos})
json.dumps(_resultados, ensure_ascii=False, allow_nan=False)\`);
        self.postMessage({value:JSON.parse(result)});
      }catch(e){self.postMessage({error:String(e)})}};`;
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
      const w=new Worker(url);const timer=setTimeout(()=>{w.terminate();URL.revokeObjectURL(url);reject(Error('Tiempo de comparación agotado'));},180000);
      w.onmessage=({data})=>{clearTimeout(timer);w.terminate();URL.revokeObjectURL(url);data.error?reject(Error(data.error)):resolve(data.value);};
      w.onerror=e=>{clearTimeout(timer);w.terminate();URL.revokeObjectURL(url);reject(Error(e.message));};
      w.postMessage(cases.map(({acciones})=>({acciones})));
    });
  },{cases,base});
  function compare(a,b,at=''){
    if(typeof a==='number'&&typeof b==='number')assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${at}: ${a} != ${b}`);
    else if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'){
      assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),at);
      for(const key of Object.keys(a))compare(a[key],b[key],at+'.'+key);
    }else assert.equal(a,b,at);
  }
  cases.forEach((c,i)=>compare(actual[i],c.esperado,c.nombre));
  report.paridad={escenarios:cases.map(c=>c.nombre),tolerancia:1e-9,base:actual[0].estado.contadores,matriz:actual[0].resultados.matriz};
  report.pruebas.push('Paridad de nueve escenarios CPython / WebAssembly, incluyendo semillas y todos los frutos');

  // Comparación visual con el programa original, en el mismo navegador y hardware.
  if(original){
    const baseline=await context.newPage();await baseline.goto(original);
    await baseline.waitForFunction(()=>document.getElementById('conexion').textContent.includes('conectado'));
    for(const p of [baseline,page])await p.getByRole('button',{name:'Reiniciar',exact:true}).click();
    for(const [name,view,mode]of [['isometrica','iso','exterior'],['superior','top','exterior'],['frontal','front','exterior'],['lateral','side','exterior'],['interior','iso','interior'],['explotada','iso','explotada']]){
      const images=[];
      for(const [i,p]of [baseline,page].entries()){
        await p.getByRole('tab',{name:'Modelo 3D',exact:true}).click();
        await p.locator('#modo').selectOption(mode);
        await p.locator(`[data-view="${view}"]`).click();
        await p.waitForTimeout(600);
        const file=path.join(out,`${i?'web':'python'}_${name}.png`);
        images.push(await p.screenshot({path:file,fullPage:true,mask:[p.locator('#conexion'),p.locator('#fps')]}));
      }
      const a=PNG.sync.read(images[0]),b=PNG.sync.read(images[1]);
      assert.equal(a.width,b.width);assert.equal(a.height,b.height);
      const diff=new PNG({width:a.width,height:a.height});const pixels=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:.1});
      const ratio=pixels/(a.width*a.height);await fs.writeFile(path.join(out,`diferencia_${name}.png`),PNG.sync.write(diff));
      const rect=await page.locator('#escena').boundingBox();
      const sw=Math.floor(rect.width),sh=Math.floor(rect.height),sx=Math.floor(rect.x),sy=Math.floor(rect.y);
      const sceneA=new PNG({width:sw,height:sh}),sceneB=new PNG({width:sw,height:sh});
      PNG.bitblt(a,sceneA,sx,sy,sw,sh,0,0);PNG.bitblt(b,sceneB,sx,sy,sw,sh,0,0);
      const sceneDiff=pixelmatch(sceneA.data,sceneB.data,null,sw,sh,{threshold:.1});
      report.comparacion_visual.push({vista:name,pixeles_diferentes:pixels,proporcion:ratio,pixeles_escena_diferentes:sceneDiff});
      assert.ok(sceneDiff<100,`Cambió la escena 3D ${name}: ${sceneDiff} píxeles`);
      assert.ok(ratio<.002,`Cambió la vista ${name}: ${(ratio*100).toFixed(3)} %`);
    }
    await baseline.close();report.pruebas.push('Seis vistas comparadas visualmente con la aplicación original');
  }
  await page.getByRole('tab',{name:'Proceso',exact:true}).click();
  await api('reiniciar',{});
  await page.locator('#velocidad').fill('0.8');await page.locator('#alimentacion').fill('6');await page.locator('#semilla').fill('42');await page.locator('#aplicar').click();
  await page.waitForFunction(()=>document.getElementById('mensaje').textContent==='Parámetros aplicados.');
  let state=await api('estado');assert.equal(state.configuracion.velocidad_m_s,.8);assert.equal(state.configuracion.semilla,42);
  await page.locator('#iniciar').click();await page.locator('#reproduccion').selectOption('8');
  await page.waitForFunction(()=>Number(document.getElementById('salidos').textContent)>=12,null,{timeout:30000});
  await page.locator('#pausar').click();await page.waitForFunction(()=>document.getElementById('modo-reloj').textContent==='Pausado');
  const paused=await api('estado');await page.waitForTimeout(300);assert.equal((await api('estado')).t_s,paused.t_s);
  await page.locator('#paso').click();await page.waitForTimeout(120);assert.equal((await api('estado')).pasos,paused.pasos+1);
  assert.ok((await api('estado')).conservacion);report.pruebas.push('Velocidad, alimentación, semilla, reproducción, inicio, pausa y paso manual');
  await page.locator('#buscar-fruto').fill('1');await page.locator('#buscar').click();
  await page.waitForFunction(()=>document.getElementById('inspeccion').textContent.includes('Fruto #1'));
  await page.locator('#seguir').check();
  await page.getByRole('tab',{name:'Clasificación',exact:true}).click();
  for(const [id,value]of [['diametro','19'],['defecto','.2'],['azul','.6'],['latencia','6'],['fallo','1']])await page.locator('#'+id).fill(value);
  await page.locator('#aplicar-clase').click();await page.waitForFunction(()=>document.getElementById('mensaje').textContent.includes('próximas detecciones'));
  state=await api('estado');assert.equal(state.configuracion.procesamiento_s,6);assert.equal(state.configuracion.fallo_percepcion,1);
  await page.getByRole('tab',{name:'Proceso',exact:true}).click();
  for(let i=0;i<5;i++)await page.locator('#explicar').click();
  assert.ok((await page.locator('#explicacion').textContent()).includes('Actuación'));
  await page.getByRole('tab',{name:'Modelo 3D',exact:true}).click();
  await page.locator('#etiquetas').uncheck();await page.locator('#cotas').check();await page.locator('#trayecto').uncheck();
  await page.locator('#modo').selectOption('explotada');
  const glbPromise=page.waitForEvent('download');await page.locator('#exportar').click();const glb=await glbPromise;
  const glbFile=path.join(out,'BAYA_modelo.glb');await glb.saveAs(glbFile);const bytes=await fs.readFile(glbFile);
  assert.equal(bytes.subarray(0,4).toString(),'glTF');assert.equal(bytes.readUInt32LE(4),2);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());report.glb={bytes:bytes.length,nodos:gltf.nodes.length,mallas:gltf.meshes.length};
  report.pruebas.push('Inspector, seguimiento, explicación de etapas, etiquetas, cotas, recorrido y exportación GLB');
  await page.getByRole('tab',{name:'Resultados',exact:true}).click();await page.locator('#actualizar-metricas').click();await page.waitForSelector('#metricas table');
  const counts=await api('estado');
  for(const [label,file,rows]of [['Descargar frutos CSV','frutos.csv',counts.contadores.ingresados],['Descargar eventos CSV','eventos.csv',null]]){
    const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:label,exact:true}).click();const download=await downloadPromise;
    const dest=path.join(out,file);await download.saveAs(dest);const text=await fs.readFile(dest,'utf8');assert.ok(text.startsWith('\ufeff'));
    if(rows!==null)assert.equal(text.trim().split(/\r?\n/).length,rows+1);
  }
  report.pruebas.push('Matriz de confusión, CSV de frutos y CSV de eventos');
  const other=await context.newPage();await other.goto(base);await other.waitForFunction(()=>document.getElementById('conexion').textContent==='Motor local conectado',null,{timeout:120000});
  assert.equal(await other.locator('#ingresados').textContent(),'0');assert.equal((await api('estado')).contadores.ingresados,counts.contadores.ingresados);await other.close();
  report.pruebas.push('Sesiones independientes por pestaña');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'movil.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.pruebas.push('Vista móvil sin desbordamiento horizontal');
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(out,'final.png'),fullPage:true});
  const beforeResume=await api('estado');await api('iniciar',{});await page.waitForTimeout(150);await api('pausar',{});
  assert.ok((await api('estado')).t_s>beforeResume.t_s);
  await api('reiniciar',{});assert.equal((await api('estado')).contadores.ingresados,0);
  const cover=await context.newPage();await cover.goto(base);await cover.waitForFunction(()=>document.getElementById('conexion').textContent==='Motor local conectado',null,{timeout:120000});
  await cover.screenshot({path:path.join(out,'proyecto_web.png'),fullPage:true});await cover.close();
  assert.deepEqual(report.errores,[]);assert.deepEqual(report.solicitudes_externas,[]);
  report.ok=true;
}finally{
  await fs.writeFile(path.join(out,'navegador.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));await browser.close();
}
