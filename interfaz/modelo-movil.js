import * as THREE from 'three';
import {carrito, estaciones, pista} from './seguimiento.js';

export const separacionPisos = 1.50 * 8.5 / 21;
export const alturaSegundoPiso = .318 + separacionPisos;
const posicionBoca = .69;
const largoBoca = .19;
const grosorBoca = .052;
const alturaBoca = .002;
const desfasePivote = .17;
const profundidadMesa = .34;
const grosorTablero = .052;

export function construirPista({alturaRiel, entradaX, entradaZ, centroCestas}) {
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

  let puntoDespacho;
  const labels = estaciones.map(({nombre, x, z, sentido}) => {
    const despacho = nombre === 'Despacho';
    const mesaX = x + sentido * (despacho ? centroCestas : entradaX);
    // El riel desplegado apunta hacia -Z cuando el carrito está orientado a +X.
    const bordeBoca = entradaZ - desfasePivote - posicionBoca - largoBoca / 2;
    const mesaZ = z + (despacho ? -.84 : bordeBoca - profundidadMesa / 2 - .008);
    const alto = despacho ? .79 : alturaRiel + alturaBoca + (grosorBoca - grosorTablero) / 2;
    if (despacho) puntoDespacho = new THREE.Vector3(mesaX, alto + grosorTablero / 2, mesaZ);
    const plataforma = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, .023, .61),
      new THREE.MeshStandardMaterial({color: despacho ? 0x2c9cc1 : 0xbf7928, roughness: .9}),
    );
    plataforma.position.set(mesaX, .01, mesaZ);
    plataforma.receiveShadow = true;
    root.add(plataforma);
    const borde = new THREE.Mesh(new THREE.BoxGeometry(.88, .005, .065), new THREE.MeshBasicMaterial({color: 0xf7e4b8}));
    borde.position.set(mesaX, .026, mesaZ + (despacho ? .24 : .25));
    root.add(borde);
    const mesa = new THREE.Group();
    mesa.name = nombre;
    const materialMesa = plataforma.material;
    const tablero = new THREE.Mesh(new THREE.BoxGeometry(.97, grosorTablero, profundidadMesa), materialMesa);
    tablero.name = despacho ? 'Mesa_de_despacho' : 'Mesa_de_recojo';
    tablero.position.set(mesaX, alto, mesaZ);
    tablero.castShadow = tablero.receiveShadow = true;
    mesa.add(tablero);
    for (const dx of [-.39, .39]) {
      for (const dz of [-.13, .13]) {
        const pata = new THREE.Mesh(new THREE.BoxGeometry(.042, alto, .042), materialMesa);
        pata.position.set(mesaX + dx, alto / 2, mesaZ + dz);
        pata.castShadow = true;
        mesa.add(pata);
      }
    }
    root.add(mesa);
    return {text: nombre, position: new THREE.Vector3(mesaX, alto + .07, mesaZ + (despacho ? -.25 : .48))};
  });
  return {root, labels, puntoDespacho};
}

export function construirRiel(altura, entradaX, entradaZ) {
  const root = new THREE.Group(), brazo = new THREE.Group(), pickables = [];
  root.name = 'Riel_lateral_de_recojo';
  root.position.set(entradaX, altura, entradaZ-desfasePivote);
  root.userData = {etiqueta:'Riel lateral de recojo',funcion: 'Gira hacia la izquierda para recibir arándanos cargados a mano y conducirlos a la banda.',
    evidencia: 'Riel y accionamiento conceptuales del segundo piso.'};
  root.add(brazo);
  const naranja = new THREE.MeshStandardMaterial({color:0xc45c17,roughness:.52});
  const banda = new THREE.MeshStandardMaterial({color:0x38464d,roughness:.76});
  function pieza(name, geometria, mat, x, y, z) {
    const m = new THREE.Mesh(geometria, mat);
    m.name = name;
    m.position.set(x,y,z);
    m.castShadow = m.receiveShadow = true;
    brazo.add(m);
    pickables.push(m);
    return m;
  }
  pieza('Banda_del_riel',new THREE.BoxGeometry(.68,.044,.17),banda,.34,0,0);
  for (const z of [-.094,.094]) pieza('Guía_del_riel',new THREE.BoxGeometry(.68,.07,.023),naranja,.34,.023,z);
  pieza('Boca_de_carga',new THREE.BoxGeometry(largoBoca,grosorBoca,.25),naranja,posicionBoca,alturaBoca,0);
  root.add(pieza('Puente_a_la_banda',new THREE.BoxGeometry(.15,.032,.18),banda,-.008,-.017,.09));
  const rodillos=[];
  for (let i=1;i<=9;i++) {
    const r=pieza('Rodillo_de_carga',new THREE.CylinderGeometry(.015,.015,.164,10),naranja,.069*i,.026,0);
    r.rotation.x=Math.PI/2;
    rodillos.push(r);
  }
  const baya = new THREE.SphereGeometry(.021,12,8);
  const morado = new THREE.MeshStandardMaterial({color:0x222f67,roughness:.49});
  const frutos=Array.from({length:5},()=>{
    const fruto=new THREE.Mesh(baya,morado);
    fruto.name='Arandano_en_recojo';
    fruto.castShadow=true;
    brazo.add(fruto);
    return fruto;
  });
  function actualizar(ciclo) {
    const {fase, fase_s:t} = ciclo;
    const apertura=fase==='desplegar'?Math.min(1,t/.85):fase==='carga'?1:fase==='replegar'?Math.max(0,1-t/.85):0;
    const suave=apertura*apertura*(3-2*apertura);
    brazo.rotation.y=suave*Math.PI/2;
    for(const [i,fruto] of frutos.entries()){
      fruto.visible=fase==='carga' && ciclo.alimentando && t>=i*.14;
      const avance=((t*1.65-i*.23)%1+1)%1;
      fruto.position.set(.71-avance*.66,.062,(i%2-.5)*.056);
    }
    for(const r of rodillos)r.rotation.y=fase==='carga'?t*8:0;
  }
  actualizar({fase:'traslado',fase_s:0});
  return {root,pickables,actualizar};
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
  const superior = conjunto('Segundo piso', 'Plataforma simulada a unos 8,5 cm del primer piso en el modelo de 21 cm.');
  caja(superior, 'Plataforma_superior', madera, -.075, alturaSegundoPiso-.022, 0, 1.22, .044, .72);
  for (const x of [-.60, .46]) {
    for (const z of [-.31, .31]) {
      cilindro(superior, 'Separador_de_pisos', acero, x, .318+separacionPisos/2, z, .026, separacionPisos, 'y');
      cilindro(superior, 'Tornillo_superior', acero, x, alturaSegundoPiso+.006, z, .024, .012, 'y');
    }
  }

  const ruedas = [-1, 1].map(lado => {
    const rueda = conjunto(lado < 0 ? 'Motor y rueda izquierdos' : 'Motor y rueda derechos', 'El controlador regula la velocidad de este motor para corregir el rumbo.');
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
    const nombre = lado < 0 ? 'Flying-Fish · sensor izquierdo' : 'Flying-Fish · sensor derecho';
    const sensor = conjunto(nombre, 'Módulo de reflectancia MH Sensor Series Flying-Fish. Lee el contraste entre piso y cinta.');
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

  const ultrasonido = conjunto('HC-SR04 y servomotor', 'Módulo ultrasónico de distancia montado sobre el servo del prototipo.');
  caja(ultrasonido, 'Carcasa_del_servo', azul, .586, .384, 0, .13, .126, .18);
  cilindro(ultrasonido, 'Eje_del_servo', blanco, .595, .458, 0, .063, .022, 'y');
  caja(ultrasonido, 'Placa_del_ultrasonido', azul, .647, .509, 0, .028, .146, .272);
  for (const z of [-.076, .076]) {
    cilindro(ultrasonido, 'Transductor', acero, .672, .512, z, .057, .045, 'x');
    cilindro(ultrasonido, 'Rejilla_del_transductor', negro, .696, .512, z, .044, .008, 'x');
  }

  const control = conjunto('Driver dual L298N', 'Controla los dos motores y permite corregir el rumbo variando su velocidad.');
  caja(control, 'Driver_dual_L298N', rojo, .17, .335, -.34, .17, .029, .14);
  for (let i = 0; i < 4; i++) caja(control, 'Disipador', negro, .125 + i * .025, .369, -.34, .012, .042, .08);
  const arduino = conjunto('Arduino Uno', 'Procesa las lecturas de línea y envía órdenes al controlador de los motores.');
  caja(arduino, 'Arduino_Uno', azul, -.36, .332, -.33, .23, .023, .123);
  caja(arduino, 'Conector_USB', acero, -.445, .355, -.332, .062, .043, .057);
  caja(arduino, 'Microcontrolador', negro, -.32, .355, -.33, .08, .028, .037);
  const regulador = conjunto('Regulador LM259S', 'Módulo regulador de tensión LM259S según el inventario del grupo.');
  caja(regulador, 'Regulador_LM259S', azul, -.49, .333, .15, .17, .025, .10);
  cilindro(regulador, 'Inductor', negro, -.48, .36, .14, .027, .035, 'y');
  const protoboard = conjunto('Protoboard', 'Punto de distribución de energía y conexiones en el primer piso.');
  caja(protoboard, 'Protoboard', blanco, -.23, .342, .344, .27, .043, .115);
  const condensador = conjunto('Condensador', 'Componente observado en la protoboard. Su función específica en este montaje está por confirmar.');
  cilindro(condensador, 'Condensador_en_protoboard', negro, -.17, .41, .33, .028, .085, 'y');
  cilindro(condensador, 'Tapa_metálica', acero, -.17, .454, .33, .026, .005, 'y');
  caja(protoboard, 'Interruptor', negro, -.62, .345, .32, .095, .056, .079);
  const cables = conjunto('Cableado', 'Conexiones representativas entre la alimentación, el control, los sensores y los motores.');
  for (const [i, color] of [0xc43a32, 0x263238, 0xd8a02b, 0x2870a2, 0x398f70].entries()) {
    const z = (i-2)*.033;
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.52, .35, .16+z), new THREE.Vector3(-.30, .48, .14+z),
      new THREE.Vector3(-.03, .37, -.10+z), new THREE.Vector3(.19, .36, -.29+z),
    ]);
    pieza(cables, 'Cable', new THREE.TubeGeometry(curva, 14, .008, 5, false), material(color,.78), 0, 0, 0);
  }
  const energia = conjunto('Portapilas y pilas', 'Alimentación del prototipo. Aquí se representa el conjunto de dos pilas.');
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
