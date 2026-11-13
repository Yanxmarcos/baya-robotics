"""Mismos contratos y reloj del servidor original, sin sockets ni cambios al motor."""
import csv
import io
import json
from simulacion import Simulacion


DESTINOS = ('rechazo', 'estandar', 'premium', 'revision')


class CicloRecojo:
    NOMBRES = ('Recojo A', 'Recojo B', 'Despacho')
    MAXIMO_LOTE = 12
    TIEMPO_RECOJO_S = 6

    def __init__(self, avanzar_carrito):
        self.avanzar_carrito = avanzar_carrito
        self.reiniciar()

    def reiniciar(self):
        self.fase = 'traslado'
        self.estacion = None
        self.inicio = 0
        self.pasos_carrito = 0
        self.limite_lote = 0
        self.entregados = dict.fromkeys(DESTINOS, 0)
        self.ultima_entrega = dict.fromkeys(DESTINOS, 0)
        self.avanzar_carrito(0)

    def cambiar_fase(self, sim, fase, detalle):
        self.fase = fase
        self.inicio = sim.pasos
        sim.evento(fase, None, detalle, sim.t)

    def paso(self, sim):
        limite = len(sim.frutos)
        duracion = (sim.pasos - self.inicio) * sim.p['proceso']['paso_s']
        if self.fase == 'traslado':
            self.pasos_carrito += 1
            llegada = self.avanzar_carrito(self.pasos_carrito)
            if llegada >= 0:
                self.estacion = llegada
                fase = 'desplegar' if llegada < 2 else 'espera_despacho'
                self.cambiar_fase(sim, fase, f'Parada en {self.NOMBRES[llegada]}')
        elif self.fase == 'desplegar' and duracion >= .85:
            self.limite_lote = len(sim.frutos) + self.MAXIMO_LOTE
            self.cambiar_fase(sim, 'carga', 'Carga manual simulada en el riel lateral')
        elif self.fase == 'carga':
            if duracion >= self.TIEMPO_RECOJO_S or len(sim.frutos) >= self.limite_lote:
                self.cambiar_fase(sim, 'replegar', 'Riel replegándose antes de continuar')
            else:
                limite = self.limite_lote
        elif self.fase == 'replegar' and duracion >= .85:
            self.estacion = None
            self.cambiar_fase(sim, 'traslado', 'Carrito en ruta; la banda sigue clasificando')
        elif self.fase == 'espera_despacho' and len(sim.frutos) == sum(sim.contadores.values()):
            self.cambiar_fase(sim, 'descarga', 'Retiro de las cuatro cestas en Despacho')
        elif self.fase == 'descarga' and duracion >= 3:
            self.ultima_entrega = self.cestas(sim)
            for clase, cantidad in self.ultima_entrega.items():
                self.entregados[clase] += cantidad
            self.estacion = None
            self.cambiar_fase(sim, 'traslado', f'Despacho completo: {sum(self.ultima_entrega.values())} arándanos entregados')
        sim.paso(limite_lote=limite)

    def cestas(self, sim):
        return {clase: sim.contadores[clase] - self.entregados[clase] for clase in DESTINOS}

    def estado(self, sim):
        return dict(fase=self.fase, estacion=self.estacion, movimiento_s=self.pasos_carrito * sim.p['proceso']['paso_s'],
                    fase_s=(sim.pasos - self.inicio) * sim.p['proceso']['paso_s'],
                    cestas=self.cestas(sim), entregados=self.entregados,
                    ultima_entrega=self.ultima_entrega, maximo_lote=self.MAXIMO_LOTE,
                    alimentando=self.fase == 'carga' and sim.p['proceso']['alimentacion_s'] > 0 and
                    len(sim.frutos) < sim.p['proceso']['max_frutos'])


class PuenteWeb:
    def __init__(self, avanzar_carrito=None):
        self.sim = Simulacion()
        self.ciclo = CicloRecojo(avanzar_carrito) if avanzar_carrito is not None else None
        self.error = None
        self.acumulado = 0.0
        self.revision_reloj = 0
        self.revision = -1

    def tick(self, transcurrido):
        if self.revision != self.revision_reloj:
            self.revision = self.revision_reloj
            self.acumulado = transcurrido = 0.0
        if not self.sim.activa:
            self.acumulado = 0.0
            return
        self.acumulado += transcurrido * self.sim.p['proceso']['reproduccion']
        dt = self.sim.p['proceso']['paso_s']
        try:
            for _ in range(min(200, int((self.acumulado + 1e-12) / dt))):
                self.paso()
                self.acumulado -= dt
        except Exception as exc:
            self.error = str(exc)
            self.sim.activa = False

    def estado(self):
        data = self.sim.estado()
        data['error_motor'] = self.error
        if self.ciclo:
            data['ciclo'] = self.ciclo.estado(self.sim)
        return data

    def paso(self):
        if self.ciclo:
            self.ciclo.paso(self.sim)
        else:
            self.sim.paso()

    def request_json(self, path, body):
        try:
            return json.dumps({'value': self.request(path, None if not body else json.loads(body))}, ensure_ascii=False, allow_nan=False)
        except (ValueError, TypeError) as exc:
            return json.dumps({'error': str(exc)}, ensure_ascii=False)

    def request(self, path, data=None):
        if data is None:
            if path == 'parametros':
                return self.sim.p
            if path == 'estado':
                return self.estado()
            if path == 'resultados':
                return self.sim.resultados()
            if path.startswith('frutos/'):
                try:
                    ident = int(path.rsplit('/', 1)[1])
                except ValueError:
                    raise ValueError('ID debe ser entero') from None
                fruto = next((f for f in self.sim.frutos if f['id'] == ident), None)
                if fruto is None:
                    raise ValueError('Fruto inexistente')
                return fruto
            if path == 'resultados.csv':
                campos = ['id', 'canal', 'diametro_mm', 'referencia', 'prediccion', 'destino', 'estado',
                          't_ingreso', 't_deteccion', 't_decision', 't_preparado', 't_actuacion', 't_salida', 'actuaciones', 'fallo']
                return self.csv(campos, self.sim.frutos)
            if path == 'eventos.csv':
                return self.csv(['n', 't_s', 'tipo', 'id', 'detalle'], sorted(self.sim.eventos, key=lambda e: (e['t_s'], e['n'])))
            raise ValueError('Ruta inexistente')
        if not isinstance(data, dict):
            raise ValueError('Se requiere objeto JSON')
        if path == 'configuracion':
            self.sim.configurar(data)
        elif path == 'iniciar':
            if not self.sim.activa:
                self.revision_reloj += 1
            self.sim.activa = True
        elif path == 'pausar':
            self.sim.activa = False
            self.revision_reloj += 1
        elif path == 'paso':
            if self.sim.activa:
                raise ValueError('Pausar antes del paso manual')
            self.paso()
        elif path == 'reiniciar':
            self.sim.reset()
            if self.ciclo:
                self.ciclo.reiniciar()
            self.error = None
            self.revision_reloj += 1
        else:
            raise ValueError('Ruta inexistente')
        return self.estado()

    @staticmethod
    def csv(campos, rows):
        out = io.StringIO(newline='')
        writer = csv.DictWriter(out, campos, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)
        return '\ufeff' + out.getvalue()
