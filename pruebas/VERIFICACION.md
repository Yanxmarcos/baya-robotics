# Verificación de la versión Vercel

Fecha: 2 de noviembre de 2026. Comparación local en Edge/WebGL, con todos los accesos externos bloqueados. La prueba utiliza un servidor de archivos estáticos para la versión web; el motor original se inicia aparte únicamente como referencia visual.

## Resultado

- HTML, CSS, modelo Three.js, bibliotecas y fuentes del motor conservan sus bytes respecto al proyecto original.
- Cuatro pruebas de integridad del paquete: aprobadas.
- Nueve escenarios CPython/WebAssembly: aprobados, incluyendo semillas y estados de todos los frutos; tolerancia relativa `1e-9`.
- Escenario base: 240 ingresos, 240 salidas, cero pérdidas y destinos 113/50/73/4. Misma matriz de confusión del original.
- Controles, parámetros, reanudación, paso, inspector, etapas, métricas, CSV, GLB, sesiones independientes y celular: comprobados.
- GLB exportado: 633596 bytes, 197 nodos, 188 mallas, versión 2.
- Errores JavaScript: cero. Recursos externos durante la visita: cero.

## Escena 3D original frente a la web

| Vista | Píxeles diferentes en el área de escena |
|---|---:|
| isometrica | 0 |
| superior | 0 |
| frontal | 0 |
| lateral | 0 |
| interior | 0 |
| explotada | 0 |

El resto de la página conserva la estructura y los estilos. En capturas completas aparecen diferencias mínimas en los indicadores dinámicos de conexión/FPS y en el espacio que ocupa su texto; no corresponden a cambios de geometría, cámaras, materiales o controles. Sólo se adaptan los mensajes que mencionaban el servidor HTTP.

Runtime web: Pyodide 0.28.3, Python 3.13.2 y NumPy 2.2.5. Referencia local: Python 3.13.5 y NumPy 2.2.6. La comparación numérica verifica los escenarios descritos; no implica identidad de versiones ni una garantía de rendimiento en todo dispositivo.

Esta verificación se realizó antes de subir a GitHub y Vercel. La comprobación de la URL pública queda para después de crear el repositorio y desplegarlo. Resultados detallados y huellas de los archivos: `verificacion.json`.
