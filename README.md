# BAYA · Clasificación óptica de arándanos

BAYA es un proyecto académico de Robótica de la Universidad Nacional de Trujillo que representa, mediante una simulación tridimensional interactiva, el proceso de clasificación óptica de arándanos inspirado en la TOMRA KATO 260.

Su propósito es explicar la relación entre percepción, decisión y actuación: cada fruto ingresa con una identidad propia, avanza por el transporte, recibe una clasificación y se dirige a una salida determinada. La simulación permite observar ese recorrido, modificar sus parámetros y analizar sus resultados.

## El proceso simulado

1. Alimentación y distribución de los frutos en cuatro canales.
2. Transporte y giro hacia la zona de inspección.
3. Generación de mediciones sintéticas de diámetro, color y defecto.
4. Clasificación por reglas en rechazo, estándar o premium.
5. Seguimiento del fruto y sincronización de la actuación.
6. Separación en su destino o recuperación ante contingencias.

## Características

- Modelo 3D con vistas isométrica, superior, frontal y lateral, órbita y acercamiento.
- Representaciones exterior, interior conceptual y vista explotada.
- Controles de inicio, pausa, reanudación, reinicio y avance paso a paso.
- Ajustes de velocidad, alimentación, semilla, reproducción y criterios de clasificación.
- Selección de piezas y frutos, búsqueda por ID, seguimiento y visualización del recorrido.
- Etiquetas de módulos, cotas estimadas y explicación de las etapas del proceso.
- Registro de eventos, conteos, matriz de confusión y recuperación de fallos.
- Exportación de resultados y eventos en CSV y del modelo tridimensional en GLB.
- Interfaz en español adaptable a computadoras y celulares.

## Tecnología

La interfaz utiliza HTML, CSS, JavaScript y Three.js. El motor de simulación está desarrollado en Python con NumPy y se ejecuta en el navegador mediante Pyodide y WebAssembly. Un Web Worker mantiene el cálculo separado de la representación gráfica.

Cada visitante dispone de una simulación independiente dentro de su pestaña. El modelo y los controles conservan la presentación de la versión local del proyecto.

## Alcance académico

BAYA utiliza datos sintéticos y reglas de clasificación para estudiar el comportamiento del sistema. La geometría y las dimensiones son estimaciones académicas basadas en la referencia industrial. La cámara real, el aprendizaje automático y la construcción de un prototipo físico forman parte de las ampliaciones propuestas.

## Integrantes

- Avila Salinas Jorge Alexis
- Cazorla Castañeda Cristian Jeanpiere
- Chan Vásquez Yanxmarcos
- Linares Sanchez Edirck Antony
- Pesantes Ruiz Ellison Adrian
- Rodriguez Rodriguez Cristopher Antony
- Ruiz Olivares  Alberth Ivan Alexis

**Universidad Nacional de Trujillo · Ingeniería Informática · Curso de Robótica**
