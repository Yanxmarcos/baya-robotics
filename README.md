# BAYA Móvil · Recojo, clasificación y despacho de arándanos

BAYA Móvil es un proyecto académico de Robótica de la Universidad Nacional de Trujillo. Simula una estación móvil a escala para zonas de poscosecha. Un carrito de tres ruedas sigue una línea entre dos puntos de recojo y una estación de despacho.

Dos sensores reflectivos virtuales leen la cinta y corrigen el rumbo. En cada punto de recojo el carrito se detiene y gira el riel lateral para recibir arándanos cargados a mano. La banda clasifica el lote durante la parada y el traslado. En la estación celeste se retiran las cuatro cestas: premium, estándar, rechazo y recuperación.

## El proceso simulado

1. Alimentación por un único riel lateral y transporte de los frutos en fila.
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

El prototipo físico corresponde a la base seguidora de línea, de unos 21 cm. El primer piso contiene Arduino Uno, LM259S, L298N, HC-SR04 sobre servo, dos módulos reflectivos MH Sensor Series Flying-Fish, motores, ruedas, portapilas, pilas, cables, protoboard y un condensador de función específica pendiente de confirmar. El segundo piso se representa a unos 8,5 cm del primero e integra el riel, el sensor de clasificación y las cestas. La carga, el módulo óptico y el despacho se simulan con datos sintéticos.

## Integrantes

- Avila Salinas Jorge Alexis
- Cazorla Castañeda Cristian Jeanpiere
- Chan Vásquez Yanxmarcos
- Linares Sanchez Edirck Antony
- Pesantes Ruiz Ellison Adrian
- Rodriguez Rodriguez Cristopher Antony
- Ruiz Olivares  Alberth Ivan Alexis

**Universidad Nacional de Trujillo · Ingeniería Informática · Curso de Robótica**
