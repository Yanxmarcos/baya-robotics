"""Motor determinista de paso fijo. El servidor serializa acceso con RLock."""
import copy
import math
from collections import Counter, deque
import numpy as np
from clasificador import clasificar
from modelo_clasificadora import parametros, trayectoria

CLASES = ('rechazo', 'estandar', 'premium')

class Simulacion:
    def __init__(self):
        self.p = parametros()
        self.reset()

    def reset(self):
        self.rng = np.random.default_rng(self.p['proceso']['semilla'])
        self.t = self.desplazamiento = 0.0
        self.pasos = 0
        self.activa = False
        self.frutos = []
        self.eventos = deque(maxlen=1000)
        self.serie_evento = 0
        self.siguiente_alimentacion = 0.0
        self.intento = self.bloqueados = 0
        self.ocupado = {}
        self.contadores = Counter()
        self.evento('reinicio', None, 'Escenario restablecido; datos sintéticos', 0.0)

    def evento(self, tipo, fruto, detalle, tiempo):
        self.serie_evento += 1
        self.eventos.append(dict(n=self.serie_evento, t_s=round(tiempo, 6), tipo=tipo,
                                 id=fruto['id'] if fruto else None, detalle=detalle))

    def configurar(self, cambios):
        if not isinstance(cambios, dict) or not cambios:
            raise ValueError('Se requiere un objeto con parámetros modificables')
        limites = {
            'velocidad_m_s': ('proceso', 0.05, 1.2), 'alimentacion_s': ('proceso', 0, 40),
            'reproduccion': ('proceso', 0.25, 8), 'semilla': ('proceso', 0, 2147483647),
            'procesamiento_s': ('proceso', 0, 6), 'fallo_percepcion': ('proceso', 0, 1),
            'diametro_premium_mm': ('clasificacion', 10, 25),
            'defecto_max': ('clasificacion', 0, 1), 'azul_min': ('clasificacion', 0, 1)
        }
        for k, v in cambios.items():
            if k not in limites:
                raise ValueError('Parámetro desconocido o no modificable: ' + k)
            grupo, lo, hi = limites[k]
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not lo <= v <= hi:
                raise ValueError(f'{k}: número finito entre {lo} y {hi}')
            if k == 'semilla' and (v != int(v) or self.frutos or self.activa):
                raise ValueError('La semilla debe ser entera; pausar y reiniciar antes de cambiarla')
        for k, v in cambios.items():
            self.p[limites[k][0]][k] = v
        if 'semilla' in cambios:
            self.rng = np.random.default_rng(int(cambios['semilla']))
        self.evento('configuracion', None, str(cambios), self.t)

    def alimentar(self, tiempo):
        g, p = self.p['geometria'], self.p['proceso']
        canal = self.intento % g['canales']
        self.intento += 1
        if any(f['canal'] == canal and f['estado'] not in ('salida', 'descarga') and
               f['x_m'] < p['espaciado_min_m'] - 1e-12 for f in self.frutos):
            self.bloqueados += 1
            return
        if len(self.frutos) >= p['max_frutos']:
            return
        d = float(self.rng.uniform(12, 22))
        azul = float(self.rng.uniform(0.2, 1))
        defecto = float(self.rng.beta(1.2, 5))
        # Verdad de evaluación fija e independiente de los umbrales del operador.
        ref = 'rechazo' if defecto > 0.28 or azul < 0.45 else ('premium' if d >= 17 else 'estandar')
        f = dict(id=len(self.frutos)+1, canal=canal, x_m=0.0, diametro_mm=d,
                 apariencia=dict(azul=azul, defecto=defecto), referencia=ref,
                 mediciones=None, prediccion=None, destino=None, estado='transporte',
                 t_ingreso=tiempo, t_deteccion=None, t_decision=None, t_preparado=None,
                 t_actuacion=None, t_salida=None, progreso_descarga=0.0,
                 x_salida_m=None, actuaciones=0, fallo=None, umbrales=None)
        self.frutos.append(f)
        self.evento('ingreso', f, f'Canal {canal+1}', tiempo)

    def inspeccionar(self, f, tiempo):
        p = self.p['proceso']
        f['t_deteccion'] = tiempo
        f['estado'] = 'inspeccion'
        f['umbrales'] = copy.deepcopy(self.p['clasificacion'])
        if self.rng.random() < p['fallo_percepcion']:
            f['fallo'] = 'percepcion'
        else:
            f['mediciones'] = dict(
                diametro_mm=max(0, float(f['diametro_mm'] + self.rng.normal(0, 0.7))),
                azul=float(np.clip(f['apariencia']['azul'] + self.rng.normal(0, .04), 0, 1)),
                defecto=float(np.clip(f['apariencia']['defecto'] + self.rng.normal(0, .05), 0, 1)))
        f['t_decision'] = tiempo + p['captura_s'] + p['procesamiento_s'] + p['comunicacion_s']
        f['t_preparado'] = f['t_decision'] + p['actuador_s']
        self.evento('deteccion', f, 'Medición sintética; etiqueta de referencia excluida del clasificador', tiempo)

    def decidir(self, f):
        f['prediccion'] = clasificar(f['mediciones'], f['umbrales'])
        f['destino'] = f['prediccion'] or 'revision'
        f['x_salida_m'] = self.p['geometria']['salidas_x_m'][f['destino']]
        f['estado'] = 'seguimiento'
        self.evento('decision', f, f['destino'], f['t_decision'])

    def _mover(self, f, a, b):
        if f['estado'] == 'salida':
            return
        g, p = self.p['geometria'], self.p['proceso']
        viejo = f['x_m']
        nuevo = viejo + p['velocidad_m_s'] * (b-a)
        if f['t_actuacion'] is None:
            if f['t_deteccion'] is None and viejo <= g['sensor_x_m'] <= nuevo + 1e-12:
                self.inspeccionar(f, a + max(0, g['sensor_x_m']-viejo) / p['velocidad_m_s'])
            if f['t_decision'] is not None and f['prediccion'] is None and f['destino'] is None and f['t_decision'] <= b + 1e-12:
                self.decidir(f)
            # Un fruto sin decisión que sobrepase la primera salida pasa a recuperación.
            objetivo = f['x_salida_m']
            if objetivo is not None and nuevo >= objetivo - 1e-12:
                llegada = a + max(0, objetivo-viejo) / p['velocidad_m_s']
                if f['t_preparado'] > llegada + 1e-10 and f['destino'] != 'revision':
                    f['fallo'] = 'decision_tardia'
                    f['destino'] = 'revision'
                    f['x_salida_m'] = g['salidas_x_m']['revision']
                    objetivo = f['x_salida_m']
                    self.evento('tardia', f, 'Recuperación por falta de preparación a tiempo', llegada)
                if nuevo >= objetivo - 1e-12:
                    llegada = a + max(0, objetivo-viejo) / p['velocidad_m_s']
                    clave = (f['canal'], f['destino'])
                    if f['destino'] != 'revision' and self.ocupado.get(clave, -1) > llegada + 1e-12:
                        f['fallo'] = 'conflicto_actuador'
                        f['destino'] = 'revision'
                        f['x_salida_m'] = g['salidas_x_m']['revision']
                        self.evento('conflicto', f, 'Recurso ocupado; recuperación', llegada)
                    else:
                        self.ocupado[clave] = llegada + p['pulso_s']
                        f['t_actuacion'] = llegada
                        f['actuaciones'] += 1
                        f['estado'] = 'descarga'
                        self.evento('actuacion', f, f['destino'], llegada)
            # Incluso con una latencia enorme no se pierde el fruto.
            if f['destino'] is None and nuevo >= g['salidas_x_m']['revision'] - 1e-12:
                llegada = a + max(0, g['salidas_x_m']['revision']-viejo) / p['velocidad_m_s']
                f.update(destino='revision', fallo='sin_decision', x_salida_m=g['salidas_x_m']['revision'],
                         t_actuacion=llegada, actuaciones=1, estado='descarga')
                self.evento('actuacion', f, 'Recuperación pasiva sin decisión', llegada)
            if f['t_actuacion'] is None:
                f['x_m'] = nuevo
        if f['t_actuacion'] is not None:
            f['x_m'] = f['x_salida_m']
            f['progreso_descarga'] = min(1, max(0, (b-f['t_actuacion']) / g['duracion_descarga_s']))
            if f['progreso_descarga'] >= 1 - 1e-10:
                f['estado'] = 'salida'
                f['t_salida'] = f['t_actuacion'] + g['duracion_descarga_s']
                self.contadores[f['destino']] += 1
                self.evento('salida', f, f['destino'], f['t_salida'])

    def paso(self):
        p = self.p['proceso']
        a, b = self.t, (self.pasos+1)*p['paso_s']
        for f in self.frutos:
            self._mover(f, a, b)
        # Intentos a tiempos exactos; no depende de FPS ni del navegador.
        if p['alimentacion_s'] > 0 and len(self.frutos) < p['max_frutos']:
            self.siguiente_alimentacion = max(self.siguiente_alimentacion, a)
            while self.siguiente_alimentacion < b - 1e-12:
                instante = self.siguiente_alimentacion
                antes = len(self.frutos)
                self.alimentar(instante)
                if len(self.frutos) > antes:
                    self._mover(self.frutos[-1], instante, b)
                self.siguiente_alimentacion += 1 / p['alimentacion_s']
        else:
            self.siguiente_alimentacion = b
        self.pasos += 1
        self.t = b
        self.desplazamiento += p['velocidad_m_s'] * p['paso_s']

    def estado(self):
        en_proceso = sum(f['estado'] != 'salida' for f in self.frutos)
        salidos = sum(self.contadores.values())
        visibles = []
        for f in self.frutos:
            if f['estado'] != 'salida':
                item = copy.deepcopy(f)
                item['posicion_m'] = trayectoria(f, self.p['geometria'])
                visibles.append(item)
        return dict(version=self.p['version'], t_s=self.t, pasos=self.pasos, activa=self.activa,
                    desplazamiento_m=self.desplazamiento, frutos=visibles,
                    contadores=dict(ingresados=len(self.frutos), en_proceso=en_proceso,
                                    salidos=salidos, perdidas=0, **{c:self.contadores[c] for c in (*CLASES, 'revision')}),
                    conservacion=len(self.frutos)==en_proceso+salidos,
                    alimentacion_bloqueada=self.bloqueados, limite_alcanzado=len(self.frutos)>=self.p['proceso']['max_frutos'],
                    eventos=sorted(self.eventos, key=lambda e:(e['t_s'],e['n']))[-100:],
                    configuracion=copy.deepcopy(self.p['proceso']))

    def resultados(self):
        matriz = [[0]*3 for _ in range(3)]
        for f in self.frutos:
            if f['prediccion'] in CLASES:
                matriz[CLASES.index(f['referencia'])][CLASES.index(f['prediccion'])] += 1
        n = sum(map(sum, matriz))
        por_clase = {}
        for i, c in enumerate(CLASES):
            tp, reales, predichos = matriz[i][i], sum(matriz[i]), sum(row[i] for row in matriz)
            precision = tp / predichos if predichos else None
            recall = tp / reales if reales else None
            por_clase[c] = dict(precision=precision, recall=recall, soporte=reales,
                               f1=2*tp/(reales+predichos) if reales+predichos else None)
        return dict(datos='sinteticos', clases=CLASES, filas='referencia', columnas='prediccion',
                    matriz=matriz, evaluados=n, sin_prediccion=sum(f['prediccion'] is None for f in self.frutos),
                    exactitud=sum(matriz[i][i] for i in range(3))/n if n else None,
                    por_clase=por_clase, contadores=self.estado()['contadores'])
