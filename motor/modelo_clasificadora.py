"""Parámetros compartidos; las dimensiones NO son cotas oficiales TOMRA."""
import json
import sys
from pathlib import Path

RAIZ = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))

def parametros():
    return json.loads((RAIZ / 'configuracion/parametros.json').read_text(encoding='utf-8'))

def posicion_canal(canal, geometria):
    return (canal - (geometria['canales'] - 1) / 2) * geometria['paso_canal_m']

def trayectoria(fruto, geometria):
    """Posición en metros; descarga cinemática ilustrativa, sin neumática."""
    z = posicion_canal(fruto['canal'], geometria)
    y = geometria['altura_banda_m'] + fruto['diametro_mm'] / 2000
    if fruto['t_actuacion'] is not None:
        u = fruto['progreso_descarga']
        return [fruto['x_m'], y - 0.42 * u * u, z + (0.94 - z) * u]
    return [fruto['x_m'], y, z]
