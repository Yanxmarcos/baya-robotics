import * as THREE from 'three';
import {carrito, estaciones, pista} from './seguimiento.js';

export function construirPista() {
  const root = new THREE.Group();
  root.name = 'Pista_de_poscosecha';
  const posiciones = [], indices = [];
  for (let esquina = 0; esquina < 4; esquina++) {
    const centroX = (esquina === 0 || esquina === 3 ? 1 : -1) * (pista.semilargo - pista.radio);
    const centroZ = (esquina < 2 ? 1 : -1) * (pista.semiancho - pista.radio);
    for (let i = 0; i <= 20; i++) {
      const angulo = (esquina + i / 20) * Math.PI / 2;
      for (const borde of [pista.anchoLinea / 2, -pista.anchoLinea / 2]) {
        const r = pista.radio + borde;
        posiciones.push(centroX + r * Math.cos(angulo), .004, centroZ + r * Math.sin(angulo));
      }
    }
  }
  for (let i = 0; i < posiciones.length / 6; i++) {
    const a = i * 2, b = (a + 2) % (posiciones.length / 3);
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const cinta = new THREE.BufferGeometry();
  cinta.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  cinta.setIndex(indices);
  cinta.computeVertexNormals();
  const linea = new THREE.Mesh(cinta, new THREE.MeshStandardMaterial({color: 0x19262c, roughness: .96}));
  linea.receiveShadow = true;
  root.add(linea);

  const labels = estaciones.map(({nombre, x, z}) => {
    const lado = Math.sign(z), entrega = nombre === 'Entrega';
    const plataforma = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, .023, .61),
      new THREE.MeshStandardMaterial({color: entrega ? 0x267876 : 0x8f6529, roughness: .9}),
    );
    plataforma.position.set(x, .01, z + lado * .57);
    plataforma.receiveShadow = true;
    root.add(plataforma);
    const borde = new THREE.Mesh(new THREE.BoxGeometry(.88, .005, .065), new THREE.MeshBasicMaterial({color: 0xf7e4b8}));
    borde.position.set(x, .026, z + lado * .39);
    root.add(borde);
    return {text: nombre, position: new THREE.Vector3(x, .04, z + lado * .60)};
  });
  return {root, labels};
}

export function construirBaseMovil() {
  const root = new THREE.Group(), pickables = [];
  root.name = 'BAYA_Movil';
  const madera = material(0xb67a42, .84), canto = material(0x694426, .9);
  const goma = material(0x1c2326, .96), relieve = material(0x313a3d, .93);
  const amarillo = material(0xf4bd18, .6), acero = material(0xa8b6bc, .37, .53);
  const blanco = material(0xe5edf0, .63), negro = material(0x13252c, .72);
  const azul = material(0x174c75, .57), rojo = material(0x9b392e, .7);

  function material(color, roughness, metalness = 0) {
    return new THREE.MeshStandardMaterial({color, roughness, metalness});
  }
  function conjunto(nombre, funcion) {
    const group = new THREE.Group();
    group.name = nombre;
    group.userData = {funcion, evidencia: 'Representación 3D aproximada basada en las fotos del carrito.'};
    root.add(group);
    return group;
  }
  function pieza(parent, nombre, geometria, mat, x, y, z) {
    const mesh = new THREE.Mesh(geometria, mat);
    mesh.name = nombre;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    pickables.push(mesh);
    return mesh;
  }
  function caja(parent, nombre, mat, x, y, z, largo, alto, ancho) {
    return pieza(parent, nombre, new THREE.BoxGeometry(largo, alto, ancho), mat, x, y, z);
  }
  function cilindro(parent, nombre, mat, x, y, z, r, largo, eje = 'z') {
    const mesh = pieza(parent, nombre, new THREE.CylinderGeometry(r, r, largo, 24), mat, x, y, z);
    if (eje === 'z') mesh.rotation.x = Math.PI / 2;
    if (eje === 'x') mesh.rotation.z = Math.PI / 2;
    return mesh;
  }

  const chasis = conjunto('Chasis', 'Placa de madera que soporta el conjunto y la carga.');
  const contorno = new THREE.Shape();
  contorno.moveTo(-.74, -.33);
  contorno.quadraticCurveTo(-.74, -.42, -.63, -.43);
  contorno.lineTo(.50, -.43);
  contorno.quadraticCurveTo(.74, -.35, .76, 0);
  contorno.quadraticCurveTo(.74, .35, .50, .43);
  contorno.lineTo(-.63, .43);
  contorno.quadraticCurveTo(-.74, .42, -.74, .33);
  contorno.closePath();
  const tabla = pieza(chasis, 'Placa_de_madera', new THREE.ExtrudeGeometry(contorno, {depth: .043, bevelEnabled: false}), [madera, canto], 0, .275, 0);
  tabla.rotation.x = -Math.PI / 2;
  for (const x of [-.64, -.49, .40, .57]) {
    for (const z of [-.34, .34]) cilindro(chasis, 'Tornillo', acero, x, .322, z, .023, .011, 'y');
  }
  for (const z of [-.135, .055]) caja(chasis, 'Soporte_del_clasificador', acero, -.045, .355, z, 1.14, .075, .056);

  const ruedas = [-1, 1].map(lado => {
    const rueda = conjunto(lado < 0 ? 'Tracción izquierda' : 'Tracción derecha', 'El controlador regula la velocidad de este motor para corregir el rumbo.');
    const z = lado * carrito.entreRuedas / 2;
    caja(rueda, 'Motor_reductor', amarillo, -.035, .213, lado * .32, .29, .115, .115);
    cilindro(rueda, 'Cuerpo_del_motor', acero, -.19, .21, lado * .32, .049, .11, 'x');
    const eje = new THREE.Group();
    eje.position.set(0, carrito.radioRueda, z);
    rueda.add(eje);
    cilindro(eje, 'Neumático', goma, 0, 0, 0, carrito.radioRueda, .135);
    cilindro(eje, 'Aro_amarillo', amarillo, 0, 0, lado * .071, .132, .027);
    cilindro(eje, 'Cubo', acero, 0, 0, lado * .09, .036, .018);
    for (let i = 0; i < 14; i++) {
      const a = i * Math.PI / 7;
      const taco = caja(eje, 'Banda_de_rodadura', relieve, .183 * Math.cos(a), .183 * Math.sin(a), 0, .016, .045, .124);
      taco.rotation.z = a;
    }
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      const hueco = caja(eje, 'Ranura_del_aro', goma, .088 * Math.cos(a), .088 * Math.sin(a), lado * .087, .062, .035, .005);
      hueco.rotation.z = a;
    }
    return eje;
  });

  const ruedaLoca = conjunto('Rueda loca', 'Tercer apoyo. Gira libremente con el movimiento del chasis.');
  ruedaLoca.position.set(.62, 0, 0);
  caja(ruedaLoca, 'Placa_del_soporte', acero, 0, .247, 0, .21, .032, .20);
  cilindro(ruedaLoca, 'Pivote', acero, 0, .196, 0, .067, .066, 'y');
  for (const z of [-.069, .069]) caja(ruedaLoca, 'Horquilla', acero, -.025, .135, z, .095, .105, .025);
  const ejeLibre = new THREE.Group();
  ejeLibre.position.set(-.025, .095, 0);
  ruedaLoca.add(ejeLibre);
  cilindro(ejeLibre, 'Rueda_de_nailon', blanco, 0, 0, 0, .095, .111);
  caja(ejeLibre, 'Marca_del_giro', acero, .052, 0, .057, .048, .014, .006);

  const sensores = [-1, 1].map(lado => {
    const nombre = lado < 0 ? 'Sensor izquierdo' : 'Sensor derecho';
    const sensor = conjunto(nombre, 'Mide el contraste entre el piso y la cinta para guiar el carrito.');
    const z = lado * carrito.separacionSensor / 2;
    caja(sensor, 'Módulo_reflectivo', azul, carrito.frenteSensor, .151, z, .138, .027, .072);
    for (const dx of [-.027, .027]) cilindro(sensor, 'Lente', dx < 0 ? blanco : negro, carrito.frenteSensor + dx, .119, z, .017, .035, 'y');
    const mat = new THREE.MeshBasicMaterial({color: 0x3eb7a0});
    caja(sensor, 'Indicador_de_lectura', mat, carrito.frenteSensor + .037, .17, z, .038, .014, .037);
    const punto = new THREE.Mesh(new THREE.CircleGeometry(.035, 16), mat);
    punto.rotation.x = -Math.PI / 2;
    punto.position.set(carrito.frenteSensor, .013, z);
    sensor.add(punto);
    return mat;
  });

  const ultrasonido = conjunto('Ultrasonido y servo', 'El prototipo incluye un sensor de distancia sobre un servo. Se representa como referencia del montaje.');
  caja(ultrasonido, 'Carcasa_del_servo', azul, .586, .384, 0, .13, .126, .18);
  cilindro(ultrasonido, 'Eje_del_servo', blanco, .595, .458, 0, .063, .022, 'y');
  caja(ultrasonido, 'Placa_del_ultrasonido', azul, .647, .509, 0, .028, .146, .272);
  for (const z of [-.076, .076]) {
    cilindro(ultrasonido, 'Transductor', acero, .672, .512, z, .057, .045, 'x');
    cilindro(ultrasonido, 'Rejilla_del_transductor', negro, .696, .512, z, .044, .008, 'x');
  }

  const control = conjunto('Electrónica de control', 'El Arduino procesa las lecturas. La placa roja acciona los dos motores del carrito.');
  caja(control, 'Controlador_de_motores', rojo, .17, .335, -.34, .17, .029, .14);
  for (let i = 0; i < 4; i++) caja(control, 'Disipador', negro, .125 + i * .025, .369, -.34, .012, .042, .08);
  caja(control, 'Arduino', azul, -.36, .332, -.33, .23, .023, .123);
  caja(control, 'Conector_USB', acero, -.445, .355, -.332, .062, .043, .057);
  caja(control, 'Protoboard', blanco, -.23, .342, .344, .27, .043, .115);
  caja(control, 'Interruptor', negro, -.62, .345, .32, .095, .056, .079);
  const energia = conjunto('Portapilas', 'Alimentación del prototipo. Aquí se representa el conjunto de dos pilas.');
  const verde = material(0x628039, .63);
  caja(energia, 'Soporte_de_pilas', negro, -.59, .202, 0, .235, .10, .31);
  for (const z of [-.069, .069]) cilindro(energia, 'Pila', verde, -.592, .174, z, .051, .197, 'x');

  function actualizar(pose) {
    root.position.set(pose.x, 0, pose.z);
    root.rotation.y = -pose.rumbo;
    ruedas[0].rotation.z = -pose.giroIzq;
    ruedas[1].rotation.z = -pose.giroDer;
    ejeLibre.rotation.z = -(pose.giroIzq + pose.giroDer) * carrito.radioRueda / (2 * .095);
    sensores.forEach((mat, i) => mat.color.set((i ? pose.der : pose.izq) >= .5 ? 0x12b698 : 0xc48225));
  }
  return {root, pickables, actualizar};
}
