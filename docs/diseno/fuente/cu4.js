// CUU15 a CUU20 – Economía, simulación, comparación y arrendamientos
window.CU.push({
  id: 'CUU15', nombre: 'Definir los supuestos económicos de una campaña', controlador: 'ControladorDefinirSupuestos',
  supuestos: [
    'Los supuestos se modelan como SupuestoEconomico, parte (composición) de LoteCampania. Guarda la cotización y la fecha usadas en la conversión.',
    'El costo de alquiler se ingresa con su unidad (USD/ha o qq/ha) y se normaliza a USD/ha una sola vez, para no sumarlo dos veces.',
    'Si no hay cotización (2.a) o falta el tipo de cambio (4.a), normalizar devuelve false y la UI solicita el valor propio.'
  ],
  dsd: [
    { titulo: 'Evento 1 – consultarReferencias', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorDefinirSupuestos
participant LCD as lcDao:«Repository» LoteCampaniaDao
participant LC as lcActual:LoteCampania
participant GD as pgDao:«Repository» PrecioGranoDao
participant TD as tcDao:«Repository» TipoCambioDao
participant PR as precios[i]:PrecioGrano
Note over UI: UI recibe del actor: idLoteCampania
UI->>+C: consultarReferencias(idLoteCampania : Integer)
C->>+LCD: getOne(idLoteCampania : Integer)
LCD-->>-C: «lcActual : LoteCampania»
C->>+LC: getEspecie()
LC-->>-C: «especie : Especie»
C->>+GD: buscarPorEspecie(especie : Especie)
Note right of GD: JPQL: SELECT p FROM PrecioGrano p WHERE p.especie = ?1 ORDER BY p.fecha DESC
GD-->>-C: «precios : PrecioGrano[*]»
C->>+TD: buscarUltimo()
Note right of TD: JPQL: SELECT t FROM TipoCambio t WHERE t.fecha = (SELECT MAX(t2.fecha) FROM TipoCambio t2)
TD-->>-C: «tcActual : TipoCambio»
C-->>-UI: «precios : PrecioGrano[*]»
alt precios IS NOT EMPTY
  loop Para cada p en precios
    UI->>+PR: getPrecio()
    PR-->>-UI: «precio : Real»
    UI->>+PR: getMoneda()
    PR-->>-UI: «moneda : String»
    UI->>+PR: getUnidad()
    PR-->>-UI: «unidad : String»
    UI->>+PR: getFecha()
    PR-->>-UI: «fecha : Date»
    UI->>+PR: getFuente()
    PR-->>-UI: «fuente : String»
  end
  Note over UI: UI muestra al actor: precio + moneda + unidad + fecha + fuente de cada referencia
else precios IS EMPTY
  Note over UI: UI muestra al actor: "No existe cotización: informe un valor propio con fecha y unidad"
end
` },
    { titulo: 'Evento 2 – informarSupuestos', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorDefinirSupuestos
participant TC as tcActual:TipoCambio
Note over UI: UI recibe del actor: precioVenta + moneda + gastosComercializacion + costoAlquiler + unidadAlquiler
UI->>+C: informarSupuestos(precioVenta : Real, moneda : String, gastosComercializacion : Real, costoAlquiler : Real, unidadAlquiler : String)
create participant SE as supuestosActuales:SupuestoEconomico
C-->>SE: create(precioVenta : Real, moneda : String, gastosComercializacion : Real, costoAlquiler : Real, unidadAlquiler : String)
C->>+SE: normalizar(tcActual : TipoCambio)
opt tcActual IS NOT NULL
  SE->>+TC: getCotizacion()
  TC-->>-SE: «cotizacion : Real»
  SE->>+TC: getFecha()
  TC-->>-SE: «fechaCotizacion : Date»
  Note right of SE: precioVentaUsd y costoAlquilerUsdHa se calculan con cotizacion. Guarda cotizacion y fechaCotizacion utilizadas
end
Note right of SE: normalizado = (valores >= 0) AND (unidades admitidas) AND (conversiones completas)
SE-->>-C: «normalizado : Boolean»
C-->>-UI: «supuestosActuales : SupuestoEconomico»
UI->>+SE: estaNormalizado()
SE-->>-UI: «normalizado : Boolean»
UI->>+SE: getPrecioVentaUsd()
SE-->>-UI: «precioVentaUsd : Real»
UI->>+SE: getCostoAlquilerUsdHa()
SE-->>-UI: «costoAlquilerUsdHa : Real»
Note over UI: UI muestra al actor: supuestos normalizados + cotización utilizada (o el dato a completar o corregir si normalizado == false)
` },
    { titulo: 'Evento 3 – confirmarSupuestos', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorDefinirSupuestos
participant LC as lcActual:LoteCampania
participant LCD as lcDao:«Repository» LoteCampaniaDao
Note over UI: UI recibe del actor: confirmación
UI->>+C: confirmarSupuestos()
C->>+LC: asignarSupuestos(supuestosActuales : SupuestoEconomico)
LC-->>-C:
C->>+LCD: save(lcActual : LoteCampania)
LCD-->>-C:
C-->>-UI: «lcActual : LoteCampania»
Note over UI: UI muestra al actor: "Los supuestos se usarán en las próximas simulaciones"
` }
  ],
  dcd: `
classDiagram
class ControladorDefinirSupuestos {
  +consultarReferencias(idLoteCampania : Integer) PrecioGrano[*]
  +informarSupuestos(precioVenta : Real, moneda : String, gastosComercializacion : Real, costoAlquiler : Real, unidadAlquiler : String) SupuestoEconomico
  +confirmarSupuestos() LoteCampania
}
class LoteCampaniaDao {
  <<Repository>>
  +getOne(idLoteCampania : Integer) LoteCampania
  +save(lc : LoteCampania)
}
class PrecioGranoDao {
  <<Repository>>
  +buscarPorEspecie(e : Especie) PrecioGrano[*]
}
class TipoCambioDao {
  <<Repository>>
  +buscarUltimo() TipoCambio
}
class LoteCampania {
  -idLoteCampania : Integer = {@Id @GeneratedValue}
  +getEspecie() Especie
  +asignarSupuestos(s : SupuestoEconomico)
}
class SupuestoEconomico {
  -precioVenta : Real
  -moneda : String
  -gastosComercializacion : Real
  -costoAlquiler : Real
  -unidadAlquiler : String
  -precioVentaUsd : Real
  -costoAlquilerUsdHa : Real
  -cotizacion : Real
  -fechaCotizacion : Date
  -normalizado : Boolean
  +create(precioVenta : Real, moneda : String, gastosComercializacion : Real, costoAlquiler : Real, unidadAlquiler : String)
  +normalizar(tc : TipoCambio) Boolean
  +estaNormalizado() Boolean
  +getPrecioVentaUsd() Real
  +getCostoAlquilerUsdHa() Real
}
class PrecioGrano {
  -idPrecioGrano : Integer = {@Id @GeneratedValue}
  -precio : Real
  -moneda : String
  -unidad : String
  -fecha : Date
  -fuente : String
  +getPrecio() Real
  +getMoneda() String
  +getUnidad() String
  +getFecha() Date
  +getFuente() String
}
class TipoCambio {
  -idTipoCambio : Integer = {@Id @GeneratedValue}
  -cotizacion : Real
  -fecha : Date
  +getCotizacion() Real
  +getFecha() Date
}
class Especie
ControladorDefinirSupuestos "*" --> "0..1 -lcDao" LoteCampaniaDao
ControladorDefinirSupuestos "*" --> "0..1 -pgDao" PrecioGranoDao
ControladorDefinirSupuestos "*" --> "0..1 -tcDao" TipoCambioDao
ControladorDefinirSupuestos "*" --> "0..1 -lcActual" LoteCampania
ControladorDefinirSupuestos "*" --> "0..1 -tcActual" TipoCambio
ControladorDefinirSupuestos "1" --> "0..1 -supuestosActuales" SupuestoEconomico
ControladorDefinirSupuestos ..> Especie
ControladorDefinirSupuestos ..> PrecioGrano
LoteCampaniaDao ..> LoteCampania
PrecioGranoDao ..> PrecioGrano
PrecioGranoDao ..> Especie
TipoCambioDao ..> TipoCambio
SupuestoEconomico ..> TipoCambio
LoteCampania "*" --> "1 -especie" Especie
LoteCampania "1" *--> "0..1 -supuestos" SupuestoEconomico
PrecioGrano "*" --> "1 -especie" Especie
`
});

window.CU.push({
  id: 'CUU16', nombre: 'Simular el rendimiento y margen de un escenario', controlador: 'ControladorSimularEscenario',
  supuestos: [
    'El motor predictivo es parte del sistema: se representa con la clase de dominio Modelo (una versión habilitada por especie), que crea la Prediccion (patrón Creador).',
    'Las prestaciones habilitadas son un atributo de Plan (prestaciones), no un valor fijo en el DSD.',
    'Si faltan entradas o no hay modelo compatible (3.a), o la ejecución no produce resultado (5.a), pred queda en NULL y no se guarda nada.',
    'La Prediccion guarda entradas, versión del modelo y percentiles P10/P50/P90 para ser reproducible.'
  ],
  dsd: [
    { titulo: 'Evento 1 – prepararSimulacion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorSimularEscenario
participant LCD as lcDao:«Repository» LoteCampaniaDao
participant U as usuarioLogueado:Usuario
participant S as suscripcionActual:Suscripcion
participant P as plan:Plan
participant PRS as «multiobjeto» prestaciones:String
participant LC as lcActual:LoteCampania
participant MD as mDao:«Repository» ModeloDao
participant M as modeloActual:Modelo
Note over UI: UI recibe del actor: idLoteCampania + nombreEscenario
UI->>+C: prepararSimulacion(idLoteCampania : Integer, nombreEscenario : String)
C->>+LCD: getOne(idLoteCampania : Integer)
LCD-->>-C: «lcActual : LoteCampania»
C->>+U: habilitaPrestacion("simulacion")
U->>+S: habilitaPrestacion(prestacion : String)
S->>+P: incluyePrestacion(prestacion : String)
P->>+PRS: contains(prestacion : String)
PRS-->>-P: «habilitada : Boolean»
P-->>-S: «habilitada : Boolean»
S-->>-U: «habilitada : Boolean»
U-->>-C: «habilitada : Boolean»
Note over C: preparada = false
opt habilitada == true
  C->>+LC: getEspecie()
  LC-->>-C: «especie : Especie»
  C->>+MD: buscarHabilitadoPorEspecie(especie : Especie)
  Note right of MD: JPQL: SELECT m FROM Modelo m WHERE m.especie = ?1 AND m.estado = 'habilitado'
  MD-->>-C: «modeloActual : Modelo»
  opt modeloActual IS NOT NULL
    C->>+LC: tieneEntradasCompletas()
    Note right of LC: completas = lote con suelo y clima AND cultivar AND fechaSiembra AND supuestos IS NOT NULL
    LC-->>-C: «preparada : Boolean»
  end
end
C-->>-UI: «preparada : Boolean»
alt preparada == true
  UI->>+M: getVersion()
  M-->>-UI: «version : String»
  UI->>+M: getLimitaciones()
  M-->>-UI: «limitaciones : String»
  UI->>+LC: getEntradas()
  LC-->>-UI: «entradas : String»
  Note over UI: UI muestra al actor: supuestos + fuentes + limitaciones y solicita confirmar la ejecución
else preparada == false
  Note over UI: UI muestra al actor: restricción del plan, o entradas faltantes o modelo no disponible
end
` },
    { titulo: 'Evento 2 – ejecutarSimulacion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorSimularEscenario
participant M as modeloActual:Modelo
participant LC as lcActual:LoteCampania
participant SE as supuestos:SupuestoEconomico
participant PD as pdDao:«Repository» PrediccionDao
Note over UI: UI recibe del actor: confirmación
UI->>+C: ejecutarSimulacion()
C->>+M: simular(lcActual : LoteCampania, nombreEscenario : String)
M->>+LC: getEntradas()
LC-->>-M: «entradas : String»
Note right of M: Calcula rendimientoP10, rendimientoP50 y rendimientoP90 (kg/ha) con las entradas
M->>+LC: calcularMargen(rendimientoP50 : Real)
LC->>+SE: calcularMargen(rendimientoP50 : Real, costoInsumosHa : Real)
Note right of SE: margen = rendimientoP50 * precioVentaUsd - gastosComercializacion - costoInsumosHa - costoAlquilerUsdHa
SE-->>-LC: «margen : Real»
LC-->>-M: «margen : Real»
opt resultado válido
  create participant PRD as pred:Prediccion
  M-->>PRD: create(nombreEscenario : String, lcActual : LoteCampania, entradas : String, rendimientoP10 : Real, rendimientoP50 : Real, rendimientoP90 : Real, margen : Real)
  Note right of PRD: fecha = date(), modelo = modeloActual, versionModelo = version
end
M-->>-C: «pred : Prediccion»
opt pred IS NOT NULL
  C->>+PD: save(pred : Prediccion)
  PD-->>-C:
end
C-->>-UI: «pred : Prediccion»
alt pred IS NOT NULL
  UI->>+PRD: getRendimientoP50()
  PRD-->>-UI: «rendimientoP50 : Real»
  UI->>+PRD: getRendimientoP10()
  PRD-->>-UI: «rendimientoP10 : Real»
  UI->>+PRD: getRendimientoP90()
  PRD-->>-UI: «rendimientoP90 : Real»
  UI->>+PRD: getMargen()
  PRD-->>-UI: «margen : Real»
  Note over UI: UI muestra al actor: rendimiento + margen + unidades + interpretación de la incertidumbre (P10 a P90)
else pred IS NULL
  Note over UI: UI muestra al actor: "La simulación no pudo completarse"
end
` }
  ],
  dcd: `
classDiagram
class ControladorSimularEscenario {
  -nombreEscenario : String
  +prepararSimulacion(idLoteCampania : Integer, nombreEscenario : String) Boolean
  +ejecutarSimulacion() Prediccion
}
class LoteCampaniaDao {
  <<Repository>>
  +getOne(idLoteCampania : Integer) LoteCampania
}
class ModeloDao {
  <<Repository>>
  +buscarHabilitadoPorEspecie(e : Especie) Modelo
}
class PrediccionDao {
  <<Repository>>
  +save(p : Prediccion)
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  +habilitaPrestacion(prestacion : String) Boolean
}
class Suscripcion {
  +habilitaPrestacion(prestacion : String) Boolean
}
class Plan {
  -prestaciones : String[*]
  +incluyePrestacion(prestacion : String) Boolean
}
class LoteCampania {
  -idLoteCampania : Integer = {@Id @GeneratedValue}
  +getEspecie() Especie
  +tieneEntradasCompletas() Boolean
  +getEntradas() String
  +calcularMargen(rendimientoP50 : Real) Real
}
class SupuestoEconomico {
  -precioVentaUsd : Real
  -gastosComercializacion : Real
  -costoAlquilerUsdHa : Real
  +calcularMargen(rendimientoP50 : Real, costoInsumosHa : Real) Real
}
class Modelo {
  -idModelo : Integer = {@Id @GeneratedValue}
  -version : String
  -estado : String
  -limitaciones : String
  +getVersion() String
  +getLimitaciones() String
  +simular(lc : LoteCampania, nombreEscenario : String) Prediccion
}
class Prediccion {
  -idPrediccion : Integer = {@Id @GeneratedValue}
  -nombreEscenario : String
  -fecha : Date
  -entradas : String
  -versionModelo : String
  -rendimientoP10 : Real
  -rendimientoP50 : Real
  -rendimientoP90 : Real
  -margen : Real
  +create(nombreEscenario : String, lc : LoteCampania, entradas : String, rendimientoP10 : Real, rendimientoP50 : Real, rendimientoP90 : Real, margen : Real)
  +getRendimientoP10() Real
  +getRendimientoP50() Real
  +getRendimientoP90() Real
  +getMargen() Real
}
class Especie
ControladorSimularEscenario "*" --> "0..1 -lcDao" LoteCampaniaDao
ControladorSimularEscenario "*" --> "0..1 -mDao" ModeloDao
ControladorSimularEscenario "*" --> "0..1 -pdDao" PrediccionDao
ControladorSimularEscenario "*" --> "0..1 -usuarioLogueado" Usuario
ControladorSimularEscenario "*" --> "0..1 -lcActual" LoteCampania
ControladorSimularEscenario "*" --> "0..1 -modeloActual" Modelo
ControladorSimularEscenario ..> Prediccion
ControladorSimularEscenario ..> Especie
LoteCampaniaDao ..> LoteCampania
ModeloDao ..> Modelo
ModeloDao ..> Especie
PrediccionDao ..> Prediccion
Modelo ..> LoteCampania
Usuario "1" *--> "0..1 -suscripcionActual" Suscripcion
Suscripcion "*" --> "1 -plan" Plan
LoteCampania "*" --> "1 -especie" Especie
LoteCampania "1" *--> "0..1 -supuestos" SupuestoEconomico
Modelo "*" --> "1 -especie" Especie
Prediccion "*" --> "1 -loteCampania" LoteCampania
Prediccion "*" --> "1 -modelo" Modelo
`
});

window.CU.push({
  id: 'CUU17', nombre: 'Comparar escenarios productivo-económicos', controlador: 'ControladorCompararEscenarios',
  supuestos: [
    'El evento seleccionarEscenario se repite por cada escenario. La selección se guarda en la colección seleccion del controlador (variable de instancia usada en el evento siguiente).',
    'La comparación se calcula al consultar y no se persiste: Comparacion es una clase de dominio sin DAO.',
    'Comparacion es el experto que detecta diferencias de moneda, superficie, período y versión de modelo.'
  ],
  dsd: [
    { titulo: 'Evento 1 – seleccionarEscenario (se repite por cada escenario)', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorCompararEscenarios
participant PD as pdDao:«Repository» PrediccionDao
participant P as p:Prediccion
participant SEL as «multiobjeto» seleccion:Prediccion
Note over UI: UI recibe del actor: idPrediccion
UI->>+C: seleccionarEscenario(idPrediccion : Integer)
C->>+PD: getOne(idPrediccion : Integer)
PD-->>-C: «p : Prediccion»
C->>+P: esAccesiblePara(usuarioLogueado : Usuario)
P-->>-C: «accesible : Boolean»
opt accesible == true
  C->>+SEL: add(p : Prediccion)
  SEL-->>-C:
end
C-->>-UI: «accesible : Boolean»
Note over UI: UI muestra al actor: escenario agregado a la selección (o "resultado no accesible")
` },
    { titulo: 'Evento 2 – compararEscenarios', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorCompararEscenarios
participant U as usuarioLogueado:Usuario
participant SEL as «multiobjeto» seleccion:Prediccion
participant EI as escenarios[i]:Prediccion
Note over UI: UI recibe del actor: indicadores a comparar
UI->>+C: compararEscenarios()
C->>+U: habilitaPrestacion("comparacion")
Note right of U: Delega en suscripcionActual y plan (ver DSD de CUU16, Evento 1)
U-->>-C: «habilitada : Boolean»
C->>+SEL: size()
SEL-->>-C: «cantidad : Integer»
opt habilitada == true AND cantidad >= 2
  create participant CO as comp:Comparacion
  C-->>CO: create(seleccion : Prediccion[*])
  C->>+CO: evaluarCompatibilidad()
  Note right of CO: comparable = true
  loop Para cada e en escenarios
    CO->>+EI: getMoneda()
    EI-->>-CO: «moneda : String»
    CO->>+EI: getSuperficieHa()
    EI-->>-CO: «superficieHa : Real»
    CO->>+EI: getVersionModelo()
    EI-->>-CO: «versionModelo : String»
    Note right of CO: Si la moneda o la unidad difieren: comparable = false. Registra cada diferencia de supuestos en diferencias
  end
  CO-->>-C: «comparable : Boolean»
end
C-->>-UI: «comp : Comparacion»
alt comp IS NOT NULL
  UI->>+CO: esComparable()
  CO-->>-UI: «comparable : Boolean»
  UI->>+CO: getDiferencias()
  CO-->>-UI: «diferencias : String[*]»
  loop Para cada e en escenarios
    UI->>+EI: getNombreEscenario()
    EI-->>-UI: «nombreEscenario : String»
    UI->>+EI: getRendimientoP50()
    EI-->>-UI: «rendimientoP50 : Real»
    UI->>+EI: getMargen()
    EI-->>-UI: «margen : Real»
  end
  Note over UI: UI muestra al actor: indicadores comparables con sus unidades + diferencias de supuestos (o la incompatibilidad si comparable == false)
else comp IS NULL
  Note over UI: UI muestra al actor: "Seleccione al menos dos escenarios" o "El plan no habilita la comparación"
end
` }
  ],
  dcd: `
classDiagram
class ControladorCompararEscenarios {
  +seleccionarEscenario(idPrediccion : Integer) Boolean
  +compararEscenarios() Comparacion
}
class PrediccionDao {
  <<Repository>>
  +getOne(idPrediccion : Integer) Prediccion
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  +habilitaPrestacion(prestacion : String) Boolean
}
class Comparacion {
  -comparable : Boolean
  -diferencias : String[*]
  +create(escenarios : Prediccion[*])
  +evaluarCompatibilidad() Boolean
  +esComparable() Boolean
  +getDiferencias() String[*]
}
class Prediccion {
  -idPrediccion : Integer = {@Id @GeneratedValue}
  -nombreEscenario : String
  -moneda : String
  -superficieHa : Real
  -versionModelo : String
  -rendimientoP50 : Real
  -margen : Real
  +esAccesiblePara(u : Usuario) Boolean
  +getNombreEscenario() String
  +getMoneda() String
  +getSuperficieHa() Real
  +getVersionModelo() String
  +getRendimientoP50() Real
  +getMargen() Real
}
ControladorCompararEscenarios "*" --> "0..1 -pdDao" PrediccionDao
ControladorCompararEscenarios "*" --> "0..1 -usuarioLogueado" Usuario
ControladorCompararEscenarios "*" --> "* -seleccion" Prediccion
ControladorCompararEscenarios ..> Comparacion
PrediccionDao ..> Prediccion
Prediccion ..> Usuario
Comparacion "*" --> "2..* -escenarios" Prediccion
`
});

window.CU.push({
  id: 'CUU18', nombre: 'Obtener recomendaciones de cultivos de servicio', controlador: 'ControladorRecomendarCultivosServicio',
  supuestos: [
    'Ampliación del modelo (cuestión abierta del CU): se agrega la clase CultivoServicio con sus criterios agronómicos. Cada cultivo de servicio evalúa si es apto para la planificación (patrón Experto).',
    'La recomendación no modifica la planificación: adoptarla se hace luego con CUU13.',
    'Si no hay candidatos para el objetivo (3.b) o ninguno es apto (3.a), la colección alternativas queda vacía.'
  ],
  dsd: [
    { titulo: 'Evento 1 – solicitarRecomendaciones', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRecomendarCultivosServicio
participant LCD as lcDao:«Repository» LoteCampaniaDao
participant U as usuarioLogueado:Usuario
participant SD as csDao:«Repository» CultivoServicioDao
participant CI as candidatos[i]:CultivoServicio
participant LC as lcActual:LoteCampania
Note over UI: UI recibe del actor: idLote + idCampania + objetivoManejo + restricciones
UI->>+C: solicitarRecomendaciones(idLote : Integer, idCampania : Integer, objetivoManejo : String, restricciones : String)
C->>+LCD: buscarPorLoteYCampania(idLote : Integer, idCampania : Integer)
Note right of LCD: JPQL: SELECT lc FROM LoteCampania lc WHERE lc.lote.idLote = ?1 AND lc.campania.idCampania = ?2
LCD-->>-C: «lcActual : LoteCampania»
C->>+U: habilitaPrestacion("recomendaciones")
Note right of U: Delega en suscripcionActual y plan (ver DSD de CUU16, Evento 1)
U-->>-C: «habilitada : Boolean»
opt habilitada == true
  create participant AL as «multiobjeto» alternativas:CultivoServicio
  C-->>AL: create()
  C->>+SD: buscarPorObjetivo(objetivoManejo : String)
  Note right of SD: JPQL: SELECT cs FROM CultivoServicio cs WHERE cs.objetivo = ?1
  SD-->>-C: «candidatos : CultivoServicio[*]»
  loop Para cada cs en candidatos
    C->>+CI: esAptoPara(lcActual : LoteCampania, restricciones : String)
    CI->>+LC: getFechaSiembra()
    LC-->>-CI: «fechaSiembra : Date»
    CI->>+LC: getAntecesor()
    LC-->>-CI: «antecesor : String»
    Note right of CI: apto = ventana de siembra compatible con fechaSiembra AND antecesor admitido AND cumple restricciones
    CI-->>-C: «apto : Boolean»
    opt apto == true
      C->>+AL: add(cs : CultivoServicio)
      AL-->>-C:
    end
  end
end
C-->>-UI: «alternativas : CultivoServicio[*]»
participant AI as alternativas[i]:CultivoServicio
alt alternativas IS NOT EMPTY
  loop Para cada a en alternativas
    UI->>+AI: getNombre()
    AI-->>-UI: «nombre : String»
    UI->>+AI: getFundamento()
    AI-->>-UI: «fundamento : String»
    UI->>+AI: getCondicionesUso()
    AI-->>-UI: «condicionesUso : String»
    UI->>+AI: getLimitaciones()
    AI-->>-UI: «limitaciones : String»
  end
  Note over UI: UI muestra al actor: alternativas con fundamento, condiciones de uso y limitaciones
else alternativas IS EMPTY OR alternativas IS NULL
  Note over UI: UI muestra al actor: prestación no habilitada, o "No se puede recomendar una alternativa para esas condiciones"
end
` }
  ],
  dcd: `
classDiagram
class ControladorRecomendarCultivosServicio {
  +solicitarRecomendaciones(idLote : Integer, idCampania : Integer, objetivoManejo : String, restricciones : String) CultivoServicio[*]
}
class LoteCampaniaDao {
  <<Repository>>
  +buscarPorLoteYCampania(idLote : Integer, idCampania : Integer) LoteCampania
}
class CultivoServicioDao {
  <<Repository>>
  +buscarPorObjetivo(objetivoManejo : String) CultivoServicio[*]
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  +habilitaPrestacion(prestacion : String) Boolean
}
class LoteCampania {
  -idLoteCampania : Integer = {@Id @GeneratedValue}
  -fechaSiembra : Date
  -antecesor : String
  +getFechaSiembra() Date
  +getAntecesor() String
}
class CultivoServicio {
  -idCultivoServicio : Integer = {@Id @GeneratedValue}
  -nombre : String
  -objetivo : String
  -fundamento : String
  -condicionesUso : String
  -limitaciones : String
  +esAptoPara(lc : LoteCampania, restricciones : String) Boolean
  +getNombre() String
  +getFundamento() String
  +getCondicionesUso() String
  +getLimitaciones() String
}
class Lote {
  -idLote : Integer = {@Id @GeneratedValue}
}
class Campania {
  -idCampania : Integer = {@Id @GeneratedValue}
}
ControladorRecomendarCultivosServicio "*" --> "0..1 -lcDao" LoteCampaniaDao
ControladorRecomendarCultivosServicio "*" --> "0..1 -csDao" CultivoServicioDao
ControladorRecomendarCultivosServicio "*" --> "0..1 -usuarioLogueado" Usuario
ControladorRecomendarCultivosServicio ..> LoteCampania
ControladorRecomendarCultivosServicio ..> CultivoServicio
LoteCampaniaDao ..> LoteCampania
CultivoServicioDao ..> CultivoServicio
CultivoServicio ..> LoteCampania
LoteCampania "*" --> "1 -lote" Lote
LoteCampania "*" --> "1 -campania" Campania
`
});

window.CU.push({
  id: 'CUU19', nombre: 'Consultar ofertas de alquiler de campos', controlador: 'ControladorConsultarOfertas',
  supuestos: [
    'Es una consulta: no modifica ofertas. Precio, unidad o enlace no informados llegan como NULL y la UI los muestra como "no informado" sin calcular costos.',
    'La fecha de recolección se muestra siempre: no demuestra que la oferta siga vigente.'
  ],
  dsd: [
    { titulo: 'Evento 1 – buscarOfertas', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorConsultarOfertas
participant DD as dDao:«Repository» DepartamentoDao
participant AD as avDao:«Repository» AvisoAlquilerCampoDao
participant OI as ofertas[i]:AvisoAlquilerCampo
Note over UI: UI recibe del actor: idDepartamento + superficieMin + superficieMax
UI->>+C: buscarOfertas(idDepartamento : Integer, superficieMin : Real, superficieMax : Real)
C->>+DD: getOne(idDepartamento : Integer)
DD-->>-C: «d : Departamento»
C->>+AD: buscarPorCriterios(d : Departamento, superficieMin : Real, superficieMax : Real)
Note right of AD: JPQL: SELECT a FROM AvisoAlquilerCampo a WHERE a.departamento = ?1 AND a.superficieHa BETWEEN ?2 AND ?3
AD-->>-C: «ofertas : AvisoAlquilerCampo[*]»
C-->>-UI: «ofertas : AvisoAlquilerCampo[*]»
alt ofertas IS NOT EMPTY
  loop Para cada o en ofertas
    UI->>+OI: getIdAviso()
    OI-->>-UI: «idAviso : Integer»
    UI->>+OI: getSuperficieHa()
    OI-->>-UI: «superficieHa : Real»
    UI->>+OI: getFuente()
    OI-->>-UI: «fuente : String»
    UI->>+OI: getFechaRecoleccion()
    OI-->>-UI: «fechaRecoleccion : Date»
  end
  Note over UI: UI muestra al actor: idAviso + superficieHa + fuente + fechaRecoleccion de cada oferta
else ofertas IS EMPTY
  Note over UI: UI muestra al actor: "No existen ofertas coincidentes, cambie los criterios"
end
` },
    { titulo: 'Evento 2 – seleccionarOferta', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorConsultarOfertas
participant AD as avDao:«Repository» AvisoAlquilerCampoDao
participant O as oferta:AvisoAlquilerCampo
Note over UI: UI recibe del actor: idAviso
UI->>+C: seleccionarOferta(idAviso : Integer)
C->>+AD: getOne(idAviso : Integer)
AD-->>-C: «oferta : AvisoAlquilerCampo»
C-->>-UI: «oferta : AvisoAlquilerCampo»
UI->>+O: getUbicacion()
O-->>-UI: «ubicacion : String»
UI->>+O: getSuperficieHa()
O-->>-UI: «superficieHa : Real»
UI->>+O: getAptitud()
O-->>-UI: «aptitud : String»
UI->>+O: getPrecio()
O-->>-UI: «precio : Real»
UI->>+O: getUnidad()
O-->>-UI: «unidad : String»
UI->>+O: getEnlace()
O-->>-UI: «enlace : String»
UI->>+O: getFechaRecoleccion()
O-->>-UI: «fechaRecoleccion : Date»
Note over UI: UI muestra al actor: ubicación + superficie + aptitud + precio y unidad (o "no informado") + enlace de origen + fechaRecoleccion
` }
  ],
  dcd: `
classDiagram
class ControladorConsultarOfertas {
  +buscarOfertas(idDepartamento : Integer, superficieMin : Real, superficieMax : Real) AvisoAlquilerCampo[*]
  +seleccionarOferta(idAviso : Integer) AvisoAlquilerCampo
}
class DepartamentoDao {
  <<Repository>>
  +getOne(idDepartamento : Integer) Departamento
}
class AvisoAlquilerCampoDao {
  <<Repository>>
  +buscarPorCriterios(d : Departamento, superficieMin : Real, superficieMax : Real) AvisoAlquilerCampo[*]
  +getOne(idAviso : Integer) AvisoAlquilerCampo
}
class Departamento {
  -idDepartamento : Integer = {@Id}
}
class AvisoAlquilerCampo {
  -idAviso : Integer = {@Id @GeneratedValue}
  -ubicacion : String
  -superficieHa : Real
  -aptitud : String
  -precio : Real
  -unidad : String
  -enlace : String
  -fuente : String
  -fechaRecoleccion : Date
  +getIdAviso() Integer
  +getUbicacion() String
  +getSuperficieHa() Real
  +getAptitud() String
  +getPrecio() Real
  +getUnidad() String
  +getEnlace() String
  +getFuente() String
  +getFechaRecoleccion() Date
}
ControladorConsultarOfertas "*" --> "0..1 -dDao" DepartamentoDao
ControladorConsultarOfertas "*" --> "0..1 -avDao" AvisoAlquilerCampoDao
ControladorConsultarOfertas ..> Departamento
ControladorConsultarOfertas ..> AvisoAlquilerCampo
DepartamentoDao ..> Departamento
AvisoAlquilerCampoDao ..> AvisoAlquilerCampo
AvisoAlquilerCampoDao ..> Departamento
AvisoAlquilerCampo "*" --> "1 -departamento" Departamento
`
});

window.CU.push({
  id: 'CUU20', nombre: 'Evaluar la viabilidad de un arrendamiento', controlador: 'ControladorEvaluarArrendamiento',
  supuestos: [
    'CU estructurado: el paso 5 incluye a CUU16. En el DSD se representa con el marco ref (como nota, porque la herramienta no dibuja el marco ref).',
    'Se propone distinguir el lote hipotético del administrado con el atributo hipotetico de Lote, y un vínculo opcional de LoteCampania con la oferta (cuestión abierta del CU).',
    'CUU16 ya guarda la Prediccion: el paso 6 no la duplica, solo le agrega el rendimiento de indiferencia.',
    'Un margen negativo (5.b) es un resultado válido: se presenta igual.'
  ],
  dsd: [
    { titulo: 'Evento 1 – identificarOferta', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorEvaluarArrendamiento
participant AD as avDao:«Repository» AvisoAlquilerCampoDao
participant O as ofertaActual:AvisoAlquilerCampo
Note over UI: UI recibe del actor: idAviso (o condiciones propias: ubicación + superficieHa)
UI->>+C: identificarOferta(idAviso : Integer)
C->>+AD: getOne(idAviso : Integer)
AD-->>-C: «ofertaActual : AvisoAlquilerCampo»
C-->>-UI: «ofertaActual : AvisoAlquilerCampo»
UI->>+O: getUbicacion()
O-->>-UI: «ubicacion : String»
UI->>+O: getSuperficieHa()
O-->>-UI: «superficieHa : Real»
UI->>+O: getPrecio()
O-->>-UI: «precio : Real»
UI->>+O: getUnidad()
O-->>-UI: «unidad : String»
Note over UI: UI muestra al actor: datos disponibles de la oferta y solicita cultivo, manejo y supuestos económicos
` },
    { titulo: 'Evento 2 – completarAlternativa', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorEvaluarArrendamiento
participant U as usuarioLogueado:Usuario
participant ED as eDao:«Repository» EspecieDao
participant VD as cvDao:«Repository» CultivarDao
participant TD as tcDao:«Repository» TipoCambioDao
participant O as ofertaActual:AvisoAlquilerCampo
Note over UI: UI recibe del actor: idEspecie + idCultivar + fechaSiembra + densidad + precioVenta + moneda + gastosComercializacion + costoAlquiler + unidadAlquiler
UI->>+C: completarAlternativa(idEspecie : Integer, idCultivar : Integer, fechaSiembra : Date, densidad : Real, precioVenta : Real, moneda : String, gastosComercializacion : Real, costoAlquiler : Real, unidadAlquiler : String)
C->>+U: habilitaPrestacion("arrendamiento")
Note right of U: Delega en suscripcionActual y plan (ver DSD de CUU16, Evento 1)
U-->>-C: «habilitada : Boolean»
Note over C: lista = false
opt habilitada == true
  C->>+ED: getOne(idEspecie : Integer)
  ED-->>-C: «especie : Especie»
  C->>+VD: getOne(idCultivar : Integer)
  VD-->>-C: «cultivar : Cultivar»
  C->>+O: crearLoteHipotetico()
  create participant L as loteHip:Lote
  O-->>L: create(ubicacion : String, superficieHa : Real)
  Note right of L: hipotetico = true
  O-->>-C: «loteHip : Lote»
  create participant LC as lcHip:LoteCampania
  C-->>LC: create(loteHip : Lote, especie : Especie, cultivar : Cultivar, fechaSiembra : Date, densidad : Real)
  C->>+TD: buscarUltimo()
  Note right of TD: JPQL: SELECT t FROM TipoCambio t WHERE t.fecha = (SELECT MAX(t2.fecha) FROM TipoCambio t2)
  TD-->>-C: «tc : TipoCambio»
  create participant SE as sup:SupuestoEconomico
  C-->>SE: create(precioVenta : Real, moneda : String, gastosComercializacion : Real, costoAlquiler : Real, unidadAlquiler : String)
  C->>+SE: normalizar(tc : TipoCambio)
  SE-->>-C: «normalizado : Boolean»
  opt normalizado == true
    C->>+LC: asignarSupuestos(sup : SupuestoEconomico)
    LC-->>-C:
    C->>+LC: vincularOferta(ofertaActual : AvisoAlquilerCampo)
    LC-->>-C:
    Note over C: lista = true
  end
end
C-->>-UI: «lista : Boolean»
Note over UI: UI muestra al actor: alternativa lista para evaluar, o restricción del plan, o "complete el costo de alquiler en una unidad comparable"
` },
    { titulo: 'Evento 3 – evaluarViabilidad', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorEvaluarArrendamiento
participant M as modeloActual:Modelo
participant PRD as pred:Prediccion
participant LC as lcHip:LoteCampania
participant SE as sup:SupuestoEconomico
participant PD as pdDao:«Repository» PrediccionDao
Note over UI: UI recibe del actor: confirmación
UI->>+C: evaluarViabilidad()
Note over C,M: ref: CUU16 – Simular el rendimiento y margen de un escenario (Eventos 1 y 2 con lcHip) → «pred : Prediccion»
opt pred IS NOT NULL
  C->>+PRD: calcularRendimientoIndiferencia()
  PRD->>+LC: getCostoTotalHa()
  LC->>+SE: getCostoAlquilerUsdHa()
  SE-->>-LC: «costoAlquilerUsdHa : Real»
  LC-->>-PRD: «costoTotalHa : Real»
  PRD->>+LC: getPrecioNetoUsd()
  LC->>+SE: getPrecioVentaUsd()
  SE-->>-LC: «precioVentaUsd : Real»
  LC-->>-PRD: «precioNetoUsd : Real»
  Note right of PRD: rendimientoIndiferencia = costoTotalHa / precioNetoUsd
  PRD-->>-C: «rendimientoIndiferencia : Real»
  C->>+PD: save(pred : Prediccion)
  PD-->>-C:
end
C-->>-UI: «pred : Prediccion»
alt pred IS NOT NULL
  UI->>+PRD: getMargen()
  PRD-->>-UI: «margen : Real»
  UI->>+PRD: getRendimientoP50()
  PRD-->>-UI: «rendimientoP50 : Real»
  UI->>+PRD: getRendimientoIndiferencia()
  PRD-->>-UI: «rendimientoIndiferencia : Real»
  Note over UI: UI muestra al actor: margen (aunque sea negativo) + rendimiento estimado + rendimiento de indiferencia + supuestos
else pred IS NULL
  Note over UI: UI muestra al actor: "No se puede concluir la evaluación" (sin calificarla como viable)
end
` }
  ],
  dcd: `
classDiagram
class ControladorEvaluarArrendamiento {
  +identificarOferta(idAviso : Integer) AvisoAlquilerCampo
  +completarAlternativa(idEspecie : Integer, idCultivar : Integer, fechaSiembra : Date, densidad : Real, precioVenta : Real, moneda : String, gastosComercializacion : Real, costoAlquiler : Real, unidadAlquiler : String) Boolean
  +evaluarViabilidad() Prediccion
}
class AvisoAlquilerCampoDao {
  <<Repository>>
  +getOne(idAviso : Integer) AvisoAlquilerCampo
}
class EspecieDao {
  <<Repository>>
  +getOne(idEspecie : Integer) Especie
}
class CultivarDao {
  <<Repository>>
  +getOne(idCultivar : Integer) Cultivar
}
class TipoCambioDao {
  <<Repository>>
  +buscarUltimo() TipoCambio
}
class PrediccionDao {
  <<Repository>>
  +save(p : Prediccion)
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  +habilitaPrestacion(prestacion : String) Boolean
}
class AvisoAlquilerCampo {
  -idAviso : Integer = {@Id @GeneratedValue}
  -ubicacion : String
  -superficieHa : Real
  -precio : Real
  -unidad : String
  +getUbicacion() String
  +getSuperficieHa() Real
  +getPrecio() Real
  +getUnidad() String
  +crearLoteHipotetico() Lote
}
class Lote {
  -idLote : Integer = {@Id @GeneratedValue}
  -ubicacion : String
  -superficieHa : Real
  -hipotetico : Boolean
  +create(ubicacion : String, superficieHa : Real)
}
class LoteCampania {
  -idLoteCampania : Integer = {@Id @GeneratedValue}
  -fechaSiembra : Date
  -densidad : Real
  +create(l : Lote, e : Especie, cv : Cultivar, fechaSiembra : Date, densidad : Real)
  +asignarSupuestos(s : SupuestoEconomico)
  +vincularOferta(o : AvisoAlquilerCampo)
  +getCostoTotalHa() Real
  +getPrecioNetoUsd() Real
}
class SupuestoEconomico {
  -precioVentaUsd : Real
  -costoAlquilerUsdHa : Real
  +create(precioVenta : Real, moneda : String, gastosComercializacion : Real, costoAlquiler : Real, unidadAlquiler : String)
  +normalizar(tc : TipoCambio) Boolean
  +getPrecioVentaUsd() Real
  +getCostoAlquilerUsdHa() Real
}
class Prediccion {
  -idPrediccion : Integer = {@Id @GeneratedValue}
  -rendimientoP50 : Real
  -margen : Real
  -rendimientoIndiferencia : Real
  +calcularRendimientoIndiferencia() Real
  +getRendimientoP50() Real
  +getMargen() Real
  +getRendimientoIndiferencia() Real
}
class Modelo
class Especie
class Cultivar
class TipoCambio
ControladorEvaluarArrendamiento "*" --> "0..1 -avDao" AvisoAlquilerCampoDao
ControladorEvaluarArrendamiento "*" --> "0..1 -eDao" EspecieDao
ControladorEvaluarArrendamiento "*" --> "0..1 -cvDao" CultivarDao
ControladorEvaluarArrendamiento "*" --> "0..1 -tcDao" TipoCambioDao
ControladorEvaluarArrendamiento "*" --> "0..1 -pdDao" PrediccionDao
ControladorEvaluarArrendamiento "*" --> "0..1 -usuarioLogueado" Usuario
ControladorEvaluarArrendamiento "*" --> "0..1 -ofertaActual" AvisoAlquilerCampo
ControladorEvaluarArrendamiento "1" --> "0..1 -lcHip" LoteCampania
ControladorEvaluarArrendamiento "*" --> "0..1 -modeloActual" Modelo
ControladorEvaluarArrendamiento ..> Prediccion
ControladorEvaluarArrendamiento ..> SupuestoEconomico
ControladorEvaluarArrendamiento ..> Lote
AvisoAlquilerCampoDao ..> AvisoAlquilerCampo
EspecieDao ..> Especie
CultivarDao ..> Cultivar
TipoCambioDao ..> TipoCambio
PrediccionDao ..> Prediccion
AvisoAlquilerCampo ..> Lote
SupuestoEconomico ..> TipoCambio
LoteCampania "*" --> "1 -lote" Lote
LoteCampania "*" --> "1 -especie" Especie
LoteCampania "*" --> "1 -cultivar" Cultivar
LoteCampania "*" --> "0..1 -oferta" AvisoAlquilerCampo
LoteCampania "1" *--> "0..1 -supuestos" SupuestoEconomico
Prediccion "*" --> "1 -loteCampania" LoteCampania
Prediccion "*" --> "1 -modelo" Modelo
`
});
