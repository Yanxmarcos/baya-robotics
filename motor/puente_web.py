"""Mismos contratos y reloj del servidor original, sin sockets ni cambios al motor."""
import csv
import io
import json
from simulacion import Simulacion


class PuenteWeb:
    def __init__(self):
        self.sim = Simulacion()
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
                self.sim.paso()
                self.acumulado -= dt
        except Exception as exc:
            self.error = str(exc)
            self.sim.activa = False

    def estado(self):
        data = self.sim.estado()
        data['error_motor'] = self.error
        return data

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
            self.sim.paso()
        elif path == 'reiniciar':
            self.sim.reset()
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
