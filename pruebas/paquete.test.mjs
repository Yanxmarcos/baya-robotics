import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=data=>createHash('sha256').update(data).digest('hex');
test('HTML, CSS, geometría y bibliotecas 3D conservan sus bytes',async()=>{
  for(const file of ['index.html','estilos.css','modelo.js','modelo-movil.js','seguimiento.js','vendor/three.module.js','vendor/OrbitControls.js','vendor/GLTFExporter.js','vendor/BufferGeometryUtils.js']){
    assert.equal(digest(await fs.readFile(path.join(root,'interfaz',file))),digest(await fs.readFile(path.join(root,'dist',file))),file);
  }
});
test('El motor publicado es el mismo motor fuente',async()=>{
  for(const file of ['simulacion.py','clasificador.py','modelo_clasificadora.py','configuracion/parametros.json']){
    assert.equal(digest(await fs.readFile(path.join(root,'motor',file))),digest(await fs.readFile(path.join(root,'dist/motor',file))),file);
  }
});
test('Los recursos del runtime están completos y conservan sus checksums',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(root,'dist/compilacion.json'),'utf8'));
  assert.equal(manifest.pyodide,'0.28.3');assert.equal(manifest.numpy,'2.2.5');
  for(const [file,hash]of Object.entries(manifest.runtime))assert.equal(digest(await fs.readFile(path.join(root,'dist/runtime/pyodide/0.28.3',file))),hash,file);
});
test('Vercel publica sólo dist y la app no requiere endpoints de servidor',async()=>{
  const config=JSON.parse(await fs.readFile(path.join(root,'vercel.json'),'utf8'));
  assert.equal(config.outputDirectory,'dist');assert.equal(config.framework,null);
  const app=await fs.readFile(path.join(root,'dist/app.js'),'utf8');
  assert.ok(app.includes("from './motor-cliente.js'"));assert.ok(!app.includes("fetch('/api/'"));
  await assert.rejects(fs.stat(path.join(root,'dist/servidor.py')));
  await assert.rejects(fs.stat(path.join(root,'dist/.venv')));
});
