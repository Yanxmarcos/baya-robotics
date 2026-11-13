# BAYA Móvil · Clasificación de arándanos en movimiento

BAYA Móvil es un proyecto académico de Robótica de la Universidad Nacional de Trujillo. Simula un carrito de tres ruedas que sigue una línea negra mientras un módulo a bordo preclasifica arándanos. El escenario representa una zona de poscosecha con dos puntos de carga y uno de entrega.

Dos sensores reflectivos virtuales leen la cinta. Sus lecturas corrigen las velocidades de las ruedas motrices. Mientras el carrito se desplaza, cada fruto avanza por la banda, recibe una clasificación y se dirige a su salida. La web muestra en paralelo el guiado y la clasificación.

## El proceso simulado

1. Alimentación y distribución de los frutos en cuatro canales.
2. Transporte y giro hacia la zona de inspección.
3. Generación de mediciones sintéticas de diámetro, color y defecto.
4. Clasificación por reglas en rechazo, estándar o premium.
5. Seguimiento del fruto y sincronización de la actuación.
6. Separación en su destino o recuperación ante contingencias.

## Características

- Carrito 3D basado en el prototipo, con dos ruedas motrices y una rueda loca delantera.
- Cámaras de seguimiento, pista completa, superior, frontal y lateral, con órbita y acercamiento.
- Lectura de los dos sensores, siguiente punto del recorrido y vueltas completadas.
- Representaciones exterior, interior conceptual y vista explotada.
- Controles de inicio, pausa, reanudación, reinicio y avance paso a paso.
- Ajustes de velocidad, alimentación, semilla, reproducción y criterios de clasificación.
- Selección de piezas y frutos, búsqueda por ID, seguimiento y visualización del recorrido.
- Etiquetas de módulos, cotas estimadas y explicación de las etapas del proceso.
- Registro de eventos, conteos, matriz de confusión y recuperación de fallos.
- Exportación de resultados y eventos en CSV y del modelo tridimensional en GLB.
- Interfaz en español adaptable a computadoras y celulares.

## Tecnología

La interfaz y el guiado virtual utilizan HTML, CSS, JavaScript y Three.js. El motor de clasificación usa Python con NumPy en Pyodide y WebAssembly. El reloj de simulación sincroniza la movilidad con la clasificación.

Cada visitante dispone de una simulación independiente dentro de su pestaña.

## Alcance académico

El prototipo físico corresponde a la base seguidora de línea. La integración del clasificador sobre el carrito se representa en la web mediante una maqueta 3D con datos sintéticos y reglas de clasificación. El ultrasonido y el servomotor se muestran como componentes del carrito. La simulación se centra en el seguimiento de línea. Las estaciones marcan puntos de paso del escenario.

## Integrantes

- Avila Salinas Jorge Alexis
- Cazorla Castañeda Cristian Jeanpiere
- Chan Vásquez Yanxmarcos
- Linares Sanchez Edirck Antony
- Pesantes Ruiz Ellison Adrian
- Rodriguez Rodriguez Cristopher Antony
- Ruiz Olivares  Alberth Ivan Alexis

**Universidad Nacional de Trujillo · Ingeniería Informática · Curso de Robótica**
