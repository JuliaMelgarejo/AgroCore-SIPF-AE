# Documentación de diseño – SIPF-AE

Diagramas de Secuencia de Diseño (DSD) y Diagramas de Clases de Diseño (DCD) de los 26 casos de uso de nivel usuario (CUU01 a CUU26), más un diagrama de clases unificado.

## Arquitectura

MVC con capa de servicios y DAO:

- **UI**: recibe los datos del actor y muestra los resultados.
- **Controlador** (uno por caso de uso): recibe el evento de la UI y lo delega en el servicio.
- **Servicio** (`«Service»`, uno por caso de uso): contiene la lógica del caso de uso, coordina los DAO y los objetos de dominio y conserva los objetos de la conversación entre eventos.
- **DAO** (`«Repository»`): acceso a datos de cada clase persistente, con sus consultas JPQL.
- **Dominio**: clases de negocio con comportamiento (patrones Experto y Creador).
- **Adaptadores** (`«Adapter»`): pasarela de pagos y proveedor de datos externos.

Los diagramas siguen las pautas de la cátedra Diseño de Sistemas (UTN FRRo): `«multiobjeto»` para colecciones, marcos `alt`/`opt`/`loop`, retornos tipados y anotaciones `{@Id @GeneratedValue}`.

## Contenido

| Ruta | Qué es |
|---|---|
| [diagramas.html](diagramas.html) | Página con todos los diagramas y las decisiones de diseño de cada caso de uso. Se abre en el navegador (necesita internet para dibujar). |
| [svg/](svg) | Los 89 diagramas en SVG. |
| [fuente/](fuente) | Código fuente de los diagramas (Mermaid) y la página que los dibuja. |

## Diagrama de clases unificado

- [Dominio](svg/DCD_unificado_dominio.svg): las 36 clases de dominio con sus asociaciones.
- [Completo](svg/DCD_unificado_completo.svg): las 114 clases (controladores, servicios, DAO, adaptadores y dominio).

## Casos de uso

| Caso de uso | Nombre | DSD por evento | DCD |
|---|---|---|---|
| CUU01 | Iniciar sesión | [E1](svg/CUU01_DSD_evento1.svg) · [E2](svg/CUU01_DSD_evento2.svg) · [E3](svg/CUU01_DSD_evento3.svg) | [DCD](svg/CUU01_DCD.svg) |
| CUU02 | Registrarse | [E1](svg/CUU02_DSD_evento1.svg) · [E2](svg/CUU02_DSD_evento2.svg) · [E3](svg/CUU02_DSD_evento3.svg) | [DCD](svg/CUU02_DCD.svg) |
| CUU03 | Cambiar de plan | [E1](svg/CUU03_DSD_evento1.svg) · [E2](svg/CUU03_DSD_evento2.svg) · [E3](svg/CUU03_DSD_evento3.svg) | [DCD](svg/CUU03_DCD.svg) |
| CUU04 | Cancelar suscripción | [E1](svg/CUU04_DSD_evento1.svg) · [E2](svg/CUU04_DSD_evento2.svg) | [DCD](svg/CUU04_DCD.svg) |
| CUU05 | Registrar una campaña agrícola | [E1](svg/CUU05_DSD_evento1.svg) · [E2](svg/CUU05_DSD_evento2.svg) | [DCD](svg/CUU05_DCD.svg) |
| CUU06 | Consultar los resultados de una campaña | [E1](svg/CUU06_DSD_evento1.svg) · [E2](svg/CUU06_DSD_evento2.svg) · [E3](svg/CUU06_DSD_evento3.svg) | [DCD](svg/CUU06_DCD.svg) |
| CUU07 | Contratar una suscripción | [E1](svg/CUU07_DSD_evento1.svg) · [E2](svg/CUU07_DSD_evento2.svg) | [DCD](svg/CUU07_DCD.svg) |
| CUU08 | Registrar un establecimiento productivo | [E1](svg/CUU08_DSD_evento1.svg) · [E2](svg/CUU08_DSD_evento2.svg) | [DCD](svg/CUU08_DCD.svg) |
| CUU09 | Registrar un lote | [E1](svg/CUU09_DSD_evento1.svg) · [E2](svg/CUU09_DSD_evento2.svg) | [DCD](svg/CUU09_DCD.svg) |
| CUU10 | Definir ambientes de un lote | [E1](svg/CUU10_DSD_evento1.svg) · [E2](svg/CUU10_DSD_evento2.svg) · [E3](svg/CUU10_DSD_evento3.svg) | [DCD](svg/CUU10_DCD.svg) |
| CUU11 | Registrar un análisis de suelo | [E1](svg/CUU11_DSD_evento1.svg) · [E2](svg/CUU11_DSD_evento2.svg) · [E3](svg/CUU11_DSD_evento3.svg) | [DCD](svg/CUU11_DCD.svg) |
| CUU12 | Consultar cultivares y antecedentes de ensayo | [E1](svg/CUU12_DSD_evento1.svg) · [E2](svg/CUU12_DSD_evento2.svg) | [DCD](svg/CUU12_DCD.svg) |
| CUU13 | Modificar la planificación de un lote en una campaña | [E1](svg/CUU13_DSD_evento1.svg) · [E2](svg/CUU13_DSD_evento2.svg) · [E3](svg/CUU13_DSD_evento3.svg) | [DCD](svg/CUU13_DCD.svg) |
| CUU14 | Registrar una aplicación de insumos | [E1](svg/CUU14_DSD_evento1.svg) · [E2](svg/CUU14_DSD_evento2.svg) | [DCD](svg/CUU14_DCD.svg) |
| CUU15 | Definir los supuestos económicos de una campaña | [E1](svg/CUU15_DSD_evento1.svg) · [E2](svg/CUU15_DSD_evento2.svg) · [E3](svg/CUU15_DSD_evento3.svg) | [DCD](svg/CUU15_DCD.svg) |
| CUU16 | Simular el rendimiento y margen de un escenario | [E1](svg/CUU16_DSD_evento1.svg) · [E2](svg/CUU16_DSD_evento2.svg) | [DCD](svg/CUU16_DCD.svg) |
| CUU17 | Comparar escenarios productivo-económicos | [E1](svg/CUU17_DSD_evento1.svg) · [E2](svg/CUU17_DSD_evento2.svg) | [DCD](svg/CUU17_DCD.svg) |
| CUU18 | Obtener recomendaciones de cultivos de servicio | [E1](svg/CUU18_DSD_evento1.svg) | [DCD](svg/CUU18_DCD.svg) |
| CUU19 | Consultar ofertas de alquiler de campos | [E1](svg/CUU19_DSD_evento1.svg) · [E2](svg/CUU19_DSD_evento2.svg) | [DCD](svg/CUU19_DCD.svg) |
| CUU20 | Evaluar la viabilidad de un arrendamiento | [E1](svg/CUU20_DSD_evento1.svg) · [E2](svg/CUU20_DSD_evento2.svg) · [E3](svg/CUU20_DSD_evento3.svg) | [DCD](svg/CUU20_DCD.svg) |
| CUU21 | Registrar los resultados de cosecha | [E1](svg/CUU21_DSD_evento1.svg) · [E2](svg/CUU21_DSD_evento2.svg) | [DCD](svg/CUU21_DCD.svg) |
| CUU22 | Consultar el historial productivo y contrastar resultados | [E1](svg/CUU22_DSD_evento1.svg) · [E2](svg/CUU22_DSD_evento2.svg) | [DCD](svg/CUU22_DCD.svg) |
| CUU23 | Exportar un reporte de resultados | [E1](svg/CUU23_DSD_evento1.svg) · [E2](svg/CUU23_DSD_evento2.svg) | [DCD](svg/CUU23_DCD.svg) |
| CUU24 | Actualizar los datos de una fuente externa | [E1](svg/CUU24_DSD_evento1.svg) · [E2](svg/CUU24_DSD_evento2.svg) | [DCD](svg/CUU24_DCD.svg) |
| CUU25 | Evaluar y habilitar una versión de modelo predictivo | [E1](svg/CUU25_DSD_evento1.svg) · [E2](svg/CUU25_DSD_evento2.svg) | [DCD](svg/CUU25_DCD.svg) |
| CUU26 | Comparar una recomendación externa con un escenario propio | [E1](svg/CUU26_DSD_evento1.svg) · [E2](svg/CUU26_DSD_evento2.svg) · [E3](svg/CUU26_DSD_evento3.svg) | [DCD](svg/CUU26_DCD.svg) |

## Cómo regenerar los diagramas

Los diagramas se definen en `fuente/cu1.js` a `fuente/cu5.js`. `fuente/servicios.js` agrega la capa de servicios y `fuente/unificado.js` arma el diagrama de clases unificado.

Para verlos en local, ejecutar `fuente/serve.ps1` con PowerShell y abrir `http://localhost:8765/`.
