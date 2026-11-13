// Pista y control diferencial en el plano XZ. El frente del chasis es +X.
export const pista = {semilargo: 3.45, semiancho: 1.95, radio: 1.10, anchoLinea: .20};
export const carrito = {velocidad: .70, entreRuedas: .96, radioRueda: .19, frenteSensor: .68, separacionSensor: .17};
export const estaciones = [
  {nombre: 'Carga A', x: -.80, z: -pista.semiancho, sentido: 1},
  {nombre: 'Carga B', x: 1.55, z: -pista.semiancho, sentido: 1},
  {nombre: 'Entrega', x: .15, z: pista.semiancho, sentido: -1},
];
const salida = {x: -1.90, z: -pista.semiancho, sentido: 1};
const paso = .01;
const limitar = (valor, min, max) => Math.max(min, Math.min(max, valor));

// Distancia con signo a la línea central del rectángulo de esquinas redondas.
export function distanciaPista(x, z) {
  const dx = Math.abs(x) - (pista.semilargo - pista.radio);
  const dz = Math.abs(z) - (pista.semiancho - pista.radio);
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - pista.radio;
}

export function puntoSensor({x, z, rumbo}, lado) {
  const lateral = lado * carrito.separacionSensor / 2;
  const cos = Math.cos(rumbo), sin = Math.sin(rumbo);
  return [x + carrito.frenteSensor * cos - lateral * sin, z + carrito.frenteSensor * sin + lateral * cos];
}

function leerSensor(pose, lado) {
  const distancia = Math.abs(distanciaPista(...puntoSensor(pose, lado)));
  const borde = pista.anchoLinea / 2;
  return limitar((borde + .04 - distancia) / .08, 0, 1);
}

function pasaPor(antes, despues, punto) {
  return (antes.x - punto.x) * punto.sentido < 0 && (despues.x - punto.x) * punto.sentido >= 0
    && Math.abs(despues.z - punto.z) < .32;
}

export class SeguidorDeLinea {
  constructor() { this.reiniciar(); }

  reiniciar() {
    this.pasos = 0;
    this.ultimoGiro = 0;
    this.pose = {x: salida.x, z: salida.z, rumbo: 0, giroIzq: 0, giroDer: 0, vueltas: 0, siguiente: 0};
    this.leerPista();
  }

  leerPista() {
    this.pose.izq = leerSensor(this.pose, -1);
    this.pose.der = leerSensor(this.pose, 1);
  }

  avanzarHasta(tiempo) {
    const objetivo = Math.round(tiempo / paso);
    if (objetivo < this.pasos) this.reiniciar();
    while (this.pasos < objetivo) {
      this.avanzar();
      this.pasos++;
    }
    return {...this.pose};
  }

  avanzar() {
    const antes = this.pose;
    const error = antes.der - antes.izq;
    if (Math.abs(error) > .02) this.ultimoGiro = Math.sign(error);
    const detecta = Math.max(antes.izq, antes.der) > .02;
    const giro = detecta ? limitar(error * 2.1, -1.40, 1.40) : this.ultimoGiro * 1.15;
    const velocidad = detecta ? carrito.velocidad * (1 - .25 * Math.min(1, Math.abs(giro))) : 0;
    const izquierda = velocidad - giro * carrito.entreRuedas / 2;
    const derecha = velocidad + giro * carrito.entreRuedas / 2;
    const rumboMedio = antes.rumbo + giro * paso / 2;
    this.pose = {
      x: antes.x + velocidad * Math.cos(rumboMedio) * paso,
      z: antes.z + velocidad * Math.sin(rumboMedio) * paso,
      rumbo: antes.rumbo + giro * paso,
      giroIzq: antes.giroIzq + izquierda * paso / carrito.radioRueda,
      giroDer: antes.giroDer + derecha * paso / carrito.radioRueda,
      vueltas: antes.vueltas, siguiente: antes.siguiente,
    };
    const punto = estaciones[antes.siguiente] ?? salida;
    if (pasaPor(antes, this.pose, punto)) {
      this.pose.siguiente = (antes.siguiente + 1) % (estaciones.length + 1);
      if (punto === salida) this.pose.vueltas++;
    }
    this.leerPista();
  }
}
