import test from 'node:test';
import assert from 'node:assert/strict';
import {distanciaPista, SeguidorDeLinea} from '../interfaz/seguimiento.js';

test('Los dos sensores guían tres vueltas con correcciones y pasos por las estaciones', () => {
  const robot = new SeguidorDeLinea();
  const visitados = new Set();
  let vioCorreccion = false;
  let pose;
  for (let i = 0; i <= 1000; i++) {
    pose = robot.avanzarHasta(i / 10);
    visitados.add(pose.siguiente);
    vioCorreccion ||= Math.abs(pose.izq - pose.der) > .1;
    assert.ok(Math.abs(distanciaPista(pose.x, pose.z)) < .23, 'el eje se mantiene cerca de la pista');
  }
  assert.ok(vioCorreccion);
  assert.equal(pose.vueltas, 3);
  assert.deepEqual([...visitados], [0, 1, 2, 3]);
  assert.notEqual(pose.giroIzq, pose.giroDer);
});

test('El carrito sigue el tiempo de simulación y se puede reiniciar', () => {
  const robot = new SeguidorDeLinea();
  const inicio = robot.avanzarHasta(0);
  assert.notEqual(robot.avanzarHasta(.01).x, inicio.x);
  const pose = robot.avanzarHasta(34.6);
  assert.deepEqual(robot.avanzarHasta(34.6), pose);
  assert.deepEqual(robot.avanzarHasta(0), inicio);
  assert.deepEqual(robot.avanzarHasta(34.6), pose);
});
