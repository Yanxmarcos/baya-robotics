"""BAYA Reglas v1: sólo características observadas sintéticas, sin etiqueta real."""
def clasificar(mediciones, umbrales):
    if mediciones is None:
        return None
    if mediciones['defecto'] > umbrales['defecto_max'] or mediciones['azul'] < umbrales['azul_min']:
        return 'rechazo'
    if mediciones['diametro_mm'] >= umbrales['diametro_premium_mm']:
        return 'premium'
    return 'estandar'
