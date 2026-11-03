"""Genera casos contra el motor CPython original; no es parte del build de Vercel."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'motor'))
from simulacion import Simulacion
from puente_web import PuenteWeb

CASOS = [
    {'nombre': 'escenario_240', 'acciones': [['avanzar', 60], ['configurar', {'alimentacion_s': 0}], ['avanzar', 20]]},
    {'nombre': 'cambio_velocidad', 'acciones': [['configurar', {'alimentacion_s': 0, 'fallo_percepcion': 0}], ['alimentar', 0], ['avanzar', 4], ['configurar', {'velocidad_m_s': .8}], ['avanzar', 7]]},
    {'nombre': 'fallo_percepcion', 'acciones': [['configurar', {'alimentacion_s': 0, 'fallo_percepcion': 1}], ['alimentar', 0], ['avanzar', 18]]},
    {'nombre': 'decision_tardia', 'acciones': [['configurar', {'alimentacion_s': 0, 'velocidad_m_s': 1.2, 'procesamiento_s': 6, 'fallo_percepcion': 0}], ['alimentar', 0], ['avanzar', 10]]},
    {'nombre': 'alimentacion_saturada', 'acciones': [['configurar', {'alimentacion_s': 40, 'velocidad_m_s': .05}], ['avanzar', 4]]},
    {'nombre': 'umbrales_durante_el_flujo', 'acciones': [['avanzar', 6], ['configurar', {'diametro_premium_mm': 20, 'defecto_max': .1, 'azul_min': .8}], ['avanzar', 9], ['configurar', {'alimentacion_s': 0}], ['avanzar', 20]]},
]
for semilla in [0, 42, 2147483647]:
    CASOS.append({'nombre': f'semilla_{semilla}', 'acciones': [['configurar', {'semilla': semilla}], ['avanzar', 12], ['configurar', {'alimentacion_s': 0}], ['avanzar', 20]]})

for caso in CASOS:
    sim = Simulacion()
    for accion, valor in caso['acciones']:
        if accion == 'avanzar':
            for _ in range(round(valor / sim.p['proceso']['paso_s'])):
                sim.paso()
        else:
            getattr(sim, accion)(valor)
    caso['esperado'] = {'estado': sim.estado(), 'resultados': sim.resultados(), 'frutos': sim.frutos}

(ROOT / 'pruebas' / 'referencia.json').write_text(json.dumps(CASOS, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(CASOS)} escenarios CPython generados. Base: {CASOS[0]["esperado"]["estado"]["contadores"]}')
