# BAYA · Clasificación óptica de arándanos

Versión preparada para publicar en **Vercel desde GitHub**. Conserva la interfaz y el modelo tridimensional de la aplicación local: vistas, materiales, colores, iluminación, controles, inspector, clasificación, resultados y exportaciones CSV/GLB.

El motor original se ejecuta en el navegador mediante **Pyodide/WebAssembly dentro de un Web Worker**. El visitante no instala Python y no se necesita contratar un backend. El mismo código Python calcula los resultados; JavaScript conecta la interfaz con el motor. La animación y el cálculo siguen separados.

## Publicar en Vercel

1. Subir **el contenido de esta carpeta** a la raíz del nuevo repositorio GitHub. En esa raíz deben quedar `package.json`, `vercel.json`, `interfaz/`, `motor/`, `web/`, `herramientas/`, `licencias/` y los demás archivos de esta entrega.
2. En Vercel seleccionar **Add New → Project**, importar ese repositorio y autorizar su acceso mediante la interfaz de GitHub.
3. Usar estos valores si Vercel pide confirmarlos:

   | Campo | Valor |
   |---|---|
   | Framework Preset | Other |
   | Root Directory | Raíz del repositorio (`.`) |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm ci --ignore-scripts` |
   | Node.js | 22.x |
   | Variables de entorno | Ninguna |

4. Pulsar **Deploy**. `vercel.json` ya contiene la configuración necesaria.

Si se sube esta carpeta dentro de otro repositorio, establecer la carpeta que contiene este README como **Root Directory**. No usar `interfaz/` como raíz: faltaría el motor.

No hace falta subir `dist/`, `.cache-pyodide/`, `node_modules/` ni una instalación de Python. El build descarga versiones fijas de los recursos oficiales y comprueba sus SHA-256. Los navegadores descargan todos los recursos del propio dominio publicado, sin depender de CDNs externos durante la visita.

## Probar en la computadora

Instalar Node.js 22 y ejecutar en esta carpeta:

```sh
npm ci --ignore-scripts
npm run build
npm run preview
```

Abrir `http://127.0.0.1:4173`. Es una vista previa estática del resultado publicado. No ejecutar `index.html` por doble clic. La primera construcción necesita internet para descargar el runtime; las posteriores reutilizan su caché local. No hay dependencias npm de ejecución.

## Funciones conservadas

- Inicio, pausa, reanudación, reinicio y paso manual de 0,01 s.
- Velocidad, alimentación, semilla y reproducción entre 0,25× y 8×.
- Umbrales de diámetro, azul, defecto, latencia y fallo de percepción.
- Vistas isométrica, superior, frontal y lateral; órbita y zoom.
- Exterior, interior conceptual y vista explotada.
- Etiquetas, cotas, selección de piezas y frutos, búsqueda por ID, seguimiento y recorrido.
- Explicación de etapas, registro, conteos, recuperación y matriz de confusión.
- CSV de frutos, CSV de eventos y exportación del modelo GLB.
- Presentación adaptable a escritorio y celular.

## Qué se conserva y qué cambia de entorno

`interfaz/` contiene los archivos originales. El build copia **sin modificar** `index.html`, `estilos.css`, `modelo.js` y las bibliotecas Three.js. Sólo adapta en `app.js` la consulta de datos, las descargas y los mensajes que antes mencionaban al servidor local. No se rehace la escena ni se sustituye por una imagen.

`motor/simulacion.py`, `clasificador.py`, `modelo_clasificadora.py` y `configuracion/parametros.json` conservan el código del proyecto original. `puente_web.py` adapta el reloj y los contratos al navegador; `web/motor-worker.js` mantiene el cálculo fuera del hilo que dibuja la interfaz.

Cada pestaña tiene su propia simulación. Pausar o reiniciar no afecta a otros visitantes. Al recargar o cerrar la pestaña se pierde esa sesión: descargar los CSV antes si se desean conservar sus resultados. El navegador puede limitar el trabajo en segundo plano; esta versión está destinada a una demostración interactiva con la página abierta.

La primera visita debe cargar aproximadamente 15 MB de runtime sin comprimir, además del visor. Puede tardar según la conexión y el equipo; el modelo 3D aparece mientras se prepara el motor. No se necesita GPU en un servidor: WebGL se ejecuta en el dispositivo del visitante.

Las rutas HTTP `/api/...` del servidor local se sustituyen por mensajes al Worker. Los controles siguen funcionando y exportando sus datos, pero esta publicación estática no ofrece una API HTTP para clientes externos. El cliente JavaScript mantiene las operaciones mediante `api()` en `motor-cliente.js`.

## Verificación realizada

- Conservación por SHA-256 del HTML, CSS, geometría, bibliotecas y fuentes del motor.
- Ejecución real en Edge/WebGL con los archivos estáticos, sin un backend de simulación.
- Nueve escenarios comparados con CPython: escenario de 240 frutos, cambios de velocidad y umbrales, falta de percepción, decisión tardía, alimentación saturada y semillas 0, 42 y 2147483647.
- Comparación de estado, todos los frutos y métricas: coincidencia de categorías/conteos; tolerancia numérica relativa de `1e-9`.
- Caso de referencia: **240 ingresos, 240 salidas, 0 pérdidas; rechazo 113, estándar 50, premium 73 y recuperación 4**. Misma matriz de confusión que el proyecto local.
- Seis vistas comparadas con la aplicación original en el mismo navegador, excluyendo indicadores variables de conexión/FPS.
- Controles, búsqueda/seguimiento, CSV, GLB válido, pestañas independientes y celular sin desbordamiento horizontal comprobados.

La distribución web fija **Pyodide 0.28.3, Python 3.13.2 y NumPy 2.2.5**. El entorno local de referencia usa Python 3.13.5 y NumPy 2.2.6. La paridad descrita se comprobó entre esos entornos; no se afirma que sus versiones sean idénticas.

El resumen de las pruebas está en `pruebas/VERIFICACION.md`. Tras construir, `npm test` comprueba el paquete. Las pruebas de aceptación del navegador están en `pruebas/navegador.mjs`; requieren Playwright, pngjs y pixelmatch como herramientas de desarrollo. `pruebas/generar_referencia.py` requiere NumPy para regenerar los casos CPython; no participa en el build de Vercel.

## Alcance académico y terceros

Referencia provisional: TOMRA KATO 260. Geometría estimada, características sintéticas y clasificación por reglas; no reproduce LUCAi ni constituye CAD de fabricación. El prototipo físico y la cámara real permanecen como ampliaciones del proyecto.

Three.js r170 conserva su licencia en `interfaz/vendor/LICENSE`. Las licencias de Pyodide, CPython y NumPy están en `licencias/`; el build las incluye en el sitio. Las referencias e instrucciones oficiales están en `TERCEROS.md`.

No se necesitan contraseñas, tokens ni claves dentro del código. Conectar GitHub y Vercel mediante sus pantallas de autorización.
