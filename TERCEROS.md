# Recursos y procedencia

| Recurso | Versión fijada | Procedencia |
|---|---|---|
| Three.js, OrbitControls, GLTFExporter y BufferGeometryUtils | r170 | Archivos locales del proyecto original; https://github.com/mrdoob/three.js/tree/r170 |
| Pyodide | 0.28.3 | Distribución oficial: https://cdn.jsdelivr.net/pyodide/v0.28.3/full/ |
| Python de la distribución web | 3.13.2 | Incluido en Pyodide; licencia CPython en `licencias/CPYTHON_LICENSE` |
| NumPy para WebAssembly | 2.2.5 | Wheel y SHA-256 registrados en `pyodide-lock.json`, incluido en la distribución anterior |

Las versiones están fijadas para reproducir las pruebas. No se presentan como las más recientes. Los recursos se descargan durante la construcción y se publican bajo el mismo dominio que BAYA. `runtime-integridad.json` fija las huellas de los archivos utilizados.

Documentación consultada para la adaptación:

- Pyodide, ejecutar en un Web Worker: https://pyodide.org/en/0.28.3/usage/webworker.html
- Pyodide, descarga y alojamiento propio: https://pyodide.org/en/0.28.3/usage/downloading-and-deploying.html
- Pyodide, paquetes incluidos: https://pyodide.org/en/0.28.3/usage/packages-in-pyodide.html
- Configuración del proyecto Vercel: https://vercel.com/docs/project-configuration/vercel-json
- Configuración de construcción Vercel: https://vercel.com/docs/builds/configure-a-build

El código y los recursos originales de BAYA se conservan con su carácter académico. Los nombres y marcas industriales identifican únicamente la referencia documental del proyecto.
