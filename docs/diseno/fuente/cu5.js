// CUU21 a CUU26 – Cosecha, historial, reportes y administración
window.CU.push({
  id: 'CUU21', nombre: 'Registrar los resultados de cosecha', controlador: 'ControladorRegistrarCosecha',
  supuestos: [
    'El resultado observado se modela como ResultadoCosecha, parte de LoteCampania y separado de las predicciones. La colección cosechas conserva el historial de correcciones (4.a): el resultado anterior queda marcado como no vigente.',
    'LoteCampania valida el resultado (experto): la superficie cosechada no puede superar la superficie del lote.',
    'Las adversidades son opcionales (3.a): si no se informan quedan en NULL.'
  ],
  dsd: [
    { titulo: 'Evento 1 – ingresarResultados', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarCosecha
participant LCD as lcDao:«Repository» LoteCampaniaDao
participant LC as lcActual:LoteCampania
participant L as lote:Lote
participant CVG as cosechaVigente:ResultadoCosecha
Note over UI: UI recibe del actor: idLote + idCampania + fechaCosecha + superficieCosechadaHa + rendimientoKgHa + humedadPct + adversidades
UI->>+C: ingresarResultados(idLote : Integer, idCampania : Integer, fechaCosecha : Date, superficieCosechadaHa : Real, rendimientoKgHa : Real, humedadPct : Real, adversidades : String)
C->>+LCD: buscarPorLoteYCampania(idLote : Integer, idCampania : Integer)
Note right of LCD: JPQL: SELECT lc FROM LoteCampania lc WHERE lc.lote.idLote = ?1 AND lc.campania.idCampania = ?2
LCD-->>-C: «lcActual : LoteCampania»
C->>+LC: crearResultado(fechaCosecha : Date, superficieCosechadaHa : Real, rendimientoKgHa : Real, humedadPct : Real, adversidades : String)
LC->>+L: getSuperficieHa()
L-->>-LC: «superficieHa : Real»
Note right of LC: valido = (superficieCosechadaHa <= superficieHa) AND (rendimientoKgHa >= 0) AND (fechaCosecha posterior a fechaSiembra)
opt valido == true
  create participant RC as cosechaNueva:ResultadoCosecha
  LC-->>RC: create(fechaCosecha : Date, superficieCosechadaHa : Real, rendimientoKgHa : Real, humedadPct : Real, adversidades : String)
end
LC-->>-C: «cosechaNueva : ResultadoCosecha»
C-->>-UI: «cosechaNueva : ResultadoCosecha»
alt cosechaNueva IS NOT NULL
  UI->>+LC: tieneCosecha()
  LC-->>-UI: «yaExiste : Boolean»
  opt yaExiste == true
    UI->>+LC: getRendimientoObservado()
    LC->>+CVG: getRendimientoKgHa()
    CVG-->>-LC: «rendimientoKgHa : Real»
    LC-->>-UI: «rendimientoAnterior : Real»
  end
  Note over UI: UI muestra al actor: resultado declarado (y los valores anteriores si ya existía) para confirmar
else cosechaNueva IS NULL
  Note over UI: UI muestra al actor: datos que requieren corrección
end
` },
    { titulo: 'Evento 2 – confirmarResultado', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarCosecha
participant LC as lcActual:LoteCampania
participant CVG as cosechaVigente:ResultadoCosecha
participant CS as «multiobjeto» cosechas:ResultadoCosecha
participant LCD as lcDao:«Repository» LoteCampaniaDao
Note over UI: UI recibe del actor: confirmación
UI->>+C: confirmarResultado()
C->>+LC: registrarCosecha(cosechaNueva : ResultadoCosecha)
opt cosechaVigente IS NOT NULL
  LC->>+CVG: marcarCorregida()
  Note right of CVG: vigente = false
  CVG-->>-LC:
end
LC->>+CS: add(cosechaNueva : ResultadoCosecha)
CS-->>-LC:
Note right of LC: cosechaVigente = cosechaNueva
LC-->>-C:
C->>+LCD: save(lcActual : LoteCampania)
LCD-->>-C:
C-->>-UI: «lcActual : LoteCampania»
Note over UI: UI muestra al actor: "Resultado de cosecha registrado"
` }
  ],
  dcd: `
classDiagram
class ControladorRegistrarCosecha {
  +ingresarResultados(idLote : Integer, idCampania : Integer, fechaCosecha : Date, superficieCosechadaHa : Real, rendimientoKgHa : Real, humedadPct : Real, adversidades : String) ResultadoCosecha
  +confirmarResultado() LoteCampania
}
class LoteCampaniaDao {
  <<Repository>>
  +buscarPorLoteYCampania(idLote : Integer, idCampania : Integer) LoteCampania
  +save(lc : LoteCampania)
}
class LoteCampania {
  -idLoteCampania : Integer = {@Id @GeneratedValue}
  -fechaSiembra : Date
  +crearResultado(fechaCosecha : Date, superficieCosechadaHa : Real, rendimientoKgHa : Real, humedadPct : Real, adversidades : String) ResultadoCosecha
  +tieneCosecha() Boolean
  +getRendimientoObservado() Real
  +registrarCosecha(rc : ResultadoCosecha)
}
class ResultadoCosecha {
  -fechaCosecha : Date
  -superficieCosechadaHa : Real
  -rendimientoKgHa : Real
  -humedadPct : Real
  -adversidades : String
  -vigente : Boolean
  +create(fechaCosecha : Date, superficieCosechadaHa : Real, rendimientoKgHa : Real, humedadPct : Real, adversidades : String)
  +getRendimientoKgHa() Real
  +marcarCorregida()
}
class Lote {
  -idLote : Integer = {@Id @GeneratedValue}
  -superficieHa : Real
  +getSuperficieHa() Real
}
class Campania {
  -idCampania : Integer = {@Id @GeneratedValue}
}
ControladorRegistrarCosecha "*" --> "0..1 -lcDao" LoteCampaniaDao
ControladorRegistrarCosecha "*" --> "0..1 -lcActual" LoteCampania
ControladorRegistrarCosecha "1" --> "0..1 -cosechaNueva" ResultadoCosecha
LoteCampaniaDao ..> LoteCampania
LoteCampania "*" --> "1 -lote" Lote
LoteCampania "*" --> "1 -campania" Campania
LoteCampania "1" *--> "* -cosechas" ResultadoCosecha
LoteCampania "1" --> "0..1 -cosechaVigente" ResultadoCosecha
`
});

window.CU.push({
  id: 'CUU22', nombre: 'Consultar el historial productivo y contrastar resultados', controlador: 'ControladorConsultarHistorial',
  supuestos: [
    'El historial de un lote son sus LoteCampania del período, con sus aplicaciones y su cosecha vigente.',
    'LoteCampania calcula el desvío (experto). Devuelve NULL si falta la cosecha (4.a) o si las bases no son compatibles (4.b): nunca se calcula un desvío engañoso.'
  ],
  dsd: [
    { titulo: 'Evento 1 – consultarHistorial', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorConsultarHistorial
participant LD as lDao:«Repository» LoteDao
participant LCD as lcDao:«Repository» LoteCampaniaDao
participant HI as historial[i]:LoteCampania
participant AS as «multiobjeto» aplicaciones:AplicacionInsumo
Note over UI: UI recibe del actor: idLote + fechaDesde + fechaHasta
UI->>+C: consultarHistorial(idLote : Integer, fechaDesde : Date, fechaHasta : Date)
C->>+LD: getOne(idLote : Integer)
LD-->>-C: «loteActual : Lote»
C->>+LCD: buscarPorLoteYPeriodo(loteActual : Lote, fechaDesde : Date, fechaHasta : Date)
Note right of LCD: JPQL: SELECT lc FROM LoteCampania lc WHERE lc.lote = ?1 AND lc.campania.fechaInicio BETWEEN ?2 AND ?3 ORDER BY lc.campania.fechaInicio
LCD-->>-C: «historial : LoteCampania[*]»
C-->>-UI: «historial : LoteCampania[*]»
alt historial IS NOT EMPTY
  loop Para cada lc en historial
    UI->>+HI: getIdLoteCampania()
    HI-->>-UI: «idLoteCampania : Integer»
    UI->>+HI: getNombreCultivar()
    HI-->>-UI: «nombreCultivar : String»
    UI->>+HI: getFechaSiembra()
    HI-->>-UI: «fechaSiembra : Date»
    UI->>+HI: getCantidadAplicaciones()
    HI->>+AS: size()
    AS-->>-HI: «cantidad : Integer»
    HI-->>-UI: «cantidadAplicaciones : Integer»
    UI->>+HI: getRendimientoObservado()
    HI-->>-UI: «rendimientoObservado : Real»
  end
  Note over UI: UI muestra al actor: planificaciones, aplicaciones y cosechas del período
else historial IS EMPTY
  Note over UI: UI muestra al actor: "No hay registros en el período"
end
` },
    { titulo: 'Evento 2 – contrastarResultados', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorConsultarHistorial
participant LCD as lcDao:«Repository» LoteCampaniaDao
participant PD as pdDao:«Repository» PrediccionDao
participant LC as lc:LoteCampania
participant CVG as cosechaVigente:ResultadoCosecha
participant P as pred:Prediccion
Note over UI: UI recibe del actor: idLoteCampania + idPrediccion
UI->>+C: contrastarResultados(idLoteCampania : Integer, idPrediccion : Integer)
C->>+LCD: getOne(idLoteCampania : Integer)
LCD-->>-C: «lc : LoteCampania»
C->>+PD: getOne(idPrediccion : Integer)
PD-->>-C: «pred : Prediccion»
C->>+LC: calcularDesvio(pred : Prediccion)
Note right of LC: desvio = NULL
opt cosechaVigente IS NOT NULL
  LC->>+CVG: getRendimientoKgHa()
  CVG-->>-LC: «observado : Real»
  LC->>+P: esComparableCon(lc : LoteCampania)
  Note right of P: comparable = (loteCampania == lc) AND (unidad == "kg/ha")
  P-->>-LC: «comparable : Boolean»
  opt comparable == true
    LC->>+P: getRendimientoP50()
    P-->>-LC: «estimado : Real»
    Note right of LC: desvio = observado - estimado
  end
end
LC-->>-C: «desvio : Real»
C-->>-UI: «desvio : Real»
alt desvio IS NOT NULL
  UI->>+P: getFecha()
  P-->>-UI: «fecha : Date»
  UI->>+P: getEntradas()
  P-->>-UI: «entradas : String»
  Note over UI: UI muestra al actor: observado + estimado + desvio + fecha y supuestos de la predicción
else desvio IS NULL
  Note over UI: UI muestra al actor: historial disponible sin calcular diferencia (falta cosecha o bases incompatibles)
end
` }
  ],
  dcd: `
classDiagram
class ControladorConsultarHistorial {
  +consultarHistorial(idLote : Integer, fechaDesde : Date, fechaHasta : Date) LoteCampania[*]
  +contrastarResultados(idLoteCampania : Integer, idPrediccion : Integer) Real
}
class LoteDao {
  <<Repository>>
  +getOne(idLote : Integer) Lote
}
class LoteCampaniaDao {
  <<Repository>>
  +buscarPorLoteYPeriodo(l : Lote, fechaDesde : Date, fechaHasta : Date) LoteCampania[*]
  +getOne(idLoteCampania : Integer) LoteCampania
}
class PrediccionDao {
  <<Repository>>
  +getOne(idPrediccion : Integer) Prediccion
}
class Lote {
  -idLote : Integer = {@Id @GeneratedValue}
}
class Campania {
  -idCampania : Integer = {@Id @GeneratedValue}
  -fechaInicio : Date
}
class LoteCampania {
  -idLoteCampania : Integer = {@Id @GeneratedValue}
  -fechaSiembra : Date
  +getIdLoteCampania() Integer
  +getNombreCultivar() String
  +getFechaSiembra() Date
  +getCantidadAplicaciones() Integer
  +getRendimientoObservado() Real
  +calcularDesvio(p : Prediccion) Real
}
class AplicacionInsumo
class ResultadoCosecha {
  -rendimientoKgHa : Real
  +getRendimientoKgHa() Real
}
class Prediccion {
  -idPrediccion : Integer = {@Id @GeneratedValue}
  -fecha : Date
  -entradas : String
  -unidad : String
  -rendimientoP50 : Real
  +esComparableCon(lc : LoteCampania) Boolean
  +getRendimientoP50() Real
  +getFecha() Date
  +getEntradas() String
}
ControladorConsultarHistorial "*" --> "0..1 -lDao" LoteDao
ControladorConsultarHistorial "*" --> "0..1 -lcDao" LoteCampaniaDao
ControladorConsultarHistorial "*" --> "0..1 -pdDao" PrediccionDao
ControladorConsultarHistorial ..> Lote
ControladorConsultarHistorial ..> LoteCampania
ControladorConsultarHistorial ..> Prediccion
LoteDao ..> Lote
LoteCampaniaDao ..> LoteCampania
LoteCampaniaDao ..> Lote
PrediccionDao ..> Prediccion
LoteCampania ..> Prediccion
LoteCampania "*" --> "1 -lote" Lote
LoteCampania "*" --> "1 -campania" Campania
LoteCampania "1" *--> "* -aplicaciones" AplicacionInsumo
LoteCampania "1" --> "0..1 -cosechaVigente" ResultadoCosecha
Prediccion "*" --> "1 -loteCampania" LoteCampania
`
});

window.CU.push({
  id: 'CUU23', nombre: 'Exportar un reporte de resultados', controlador: 'ControladorExportarReporte',
  supuestos: [
    'El evento seleccionarResultado se repite por cada resultado a incluir. La selección queda en la colección seleccion del controlador.',
    'El Reporte no se almacena de forma permanente (cuestión abierta del CU): no tiene DAO.',
    'Un resultado es histórico (3.a) cuando la planificación se modificó después de calcularlo: el Reporte lo identifica y conserva los supuestos originales.'
  ],
  dsd: [
    { titulo: 'Evento 1 – seleccionarResultado (se repite por cada resultado)', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorExportarReporte
participant PD as pdDao:«Repository» PrediccionDao
participant P as p:Prediccion
participant SEL as «multiobjeto» seleccion:Prediccion
Note over UI: UI recibe del actor: idPrediccion
UI->>+C: seleccionarResultado(idPrediccion : Integer)
C->>+PD: existsById(idPrediccion : Integer)
PD-->>-C: «existe : Boolean»
Note over C: agregado = false
opt existe == true
  C->>+PD: getOne(idPrediccion : Integer)
  PD-->>-C: «p : Prediccion»
  C->>+P: esAccesiblePara(usuarioLogueado : Usuario)
  P-->>-C: «agregado : Boolean»
  opt agregado == true
    C->>+SEL: add(p : Prediccion)
    SEL-->>-C:
  end
end
C-->>-UI: «agregado : Boolean»
Note over UI: UI muestra al actor: resultado agregado (o "No se puede exportar: resultado no disponible o no accesible")
` },
    { titulo: 'Evento 2 – exportarReporte', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorExportarReporte
participant U as usuarioLogueado:Usuario
participant SI as seleccion[i]:Prediccion
Note over UI: UI recibe del actor: formato
UI->>+C: exportarReporte(formato : String)
C->>+U: habilitaFormato(formato : String)
Note right of U: Delega en suscripcionActual y plan (ver DSD de CUU06, Evento 3)
U-->>-C: «habilitado : Boolean»
opt habilitado == true
  create participant R as r:Reporte
  C-->>R: create(formato : String)
  Note right of R: fecha = date()
  create participant IT as «multiobjeto» resultados:Prediccion
  R-->>IT: create()
  loop Para cada p en seleccion
    C->>+R: agregarResultado(p : Prediccion)
    R->>+SI: esHistorica()
    Note right of SI: historica = fecha anterior a loteCampania.fechaModificacion
    SI-->>-R: «historica : Boolean»
    R->>+IT: add(p : Prediccion)
    IT-->>-R:
    Note right of R: Si historica == true: contieneHistoricos = true
    R-->>-C:
  end
  C->>+R: generarArchivo()
  Note right of R: Arma el archivo con entradas, resultados, unidades, fuentes, fecha y versión del modelo de cada resultado
  R-->>-C: «generado : Boolean»
end
C-->>-UI: «r : Reporte»
alt r IS NOT NULL
  UI->>+R: getArchivo()
  R-->>-UI: «archivo : String»
  Note over UI: UI muestra al actor: archivo para descargar (si archivo IS NULL informa el fallo y permite reintentar)
else r IS NULL
  UI->>+U: getFormatosHabilitados()
  U-->>-UI: «formatosHabilitados : String[*]»
  Note over UI: UI muestra al actor: formatos habilitados para elegir otro
end
` }
  ],
  dcd: `
classDiagram
class ControladorExportarReporte {
  +seleccionarResultado(idPrediccion : Integer) Boolean
  +exportarReporte(formato : String) Reporte
}
class PrediccionDao {
  <<Repository>>
  +existsById(idPrediccion : Integer) Boolean
  +getOne(idPrediccion : Integer) Prediccion
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  +habilitaFormato(formato : String) Boolean
  +getFormatosHabilitados() String[*]
}
class Prediccion {
  -idPrediccion : Integer = {@Id @GeneratedValue}
  -fecha : Date
  -entradas : String
  -versionModelo : String
  +esAccesiblePara(u : Usuario) Boolean
  +esHistorica() Boolean
}
class LoteCampania {
  -fechaModificacion : Date
}
class Reporte {
  -formato : String
  -fecha : Date
  -contieneHistoricos : Boolean
  -archivo : String
  +create(formato : String)
  +agregarResultado(p : Prediccion)
  +generarArchivo() Boolean
  +getArchivo() String
}
ControladorExportarReporte "*" --> "0..1 -pdDao" PrediccionDao
ControladorExportarReporte "*" --> "0..1 -usuarioLogueado" Usuario
ControladorExportarReporte "*" --> "* -seleccion" Prediccion
ControladorExportarReporte ..> Reporte
PrediccionDao ..> Prediccion
Prediccion ..> Usuario
Prediccion "*" --> "1 -loteCampania" LoteCampania
Reporte "*" --> "1..* -resultados" Prediccion
`
});

window.CU.push({
  id: 'CUU24', nombre: 'Actualizar los datos de una fuente externa', controlador: 'ControladorActualizarFuente',
  supuestos: [
    'El proveedor externo (actor secundario) se accede por la interfaz «Service» ProveedorDatos, que devuelve los registros recibidos (NULL si no responde o deniega el acceso).',
    'Se agrega la clase CargaDatos (historial de ejecuciones y rechazos, cuestión abierta del CU): guarda válidos y rechazados. ultimaCarga de FuenteDato solo cambia cuando la incorporación se confirma.',
    'La copia de cada registro válido a su entidad de destino (PrecioGrano, TipoCambio, etc.) depende de la fuente y no se detalla.',
    'El administrador está autenticado y con permiso (precondición).'
  ],
  dsd: [
    { titulo: 'Evento 1 – solicitarActualizacion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorActualizarFuente
participant FD as fDao:«Repository» FuenteDatoDao
participant PV as proveedor:«Service» ProveedorDatos
participant RI as registros[i]:RegistroExterno
participant F as fuenteActual:FuenteDato
Note over UI: UI recibe del actor: idFuente + fechaDesde + fechaHasta
UI->>+C: solicitarActualizacion(idFuente : Integer, fechaDesde : Date, fechaHasta : Date)
C->>+FD: getOne(idFuente : Integer)
FD-->>-C: «fuenteActual : FuenteDato»
C->>+PV: obtenerDatos(fuenteActual : FuenteDato, fechaDesde : Date, fechaHasta : Date)
PV-->>-C: «registros : RegistroExterno[*]»
opt registros IS NOT NULL
  create participant CG as cargaActual:CargaDatos
  C-->>CG: create(fuenteActual : FuenteDato, fechaDesde : Date, fechaHasta : Date)
  create participant VS as «multiobjeto» validos:RegistroExterno
  CG-->>VS: create()
  create participant RS as «multiobjeto» rechazados:RegistroExterno
  CG-->>RS: create()
  loop Para cada r en registros
    C->>+CG: evaluar(r : RegistroExterno)
    CG->>+RI: esValido()
    Note right of RI: valido = estructura, fecha y unidad esperadas
    RI-->>-CG: «valido : Boolean»
    CG->>+F: yaIncorporado(r : RegistroExterno)
    F-->>-CG: «duplicado : Boolean»
    alt valido == true AND duplicado == false
      CG->>+VS: add(r : RegistroExterno)
      VS-->>-CG:
    else valido == false
      CG->>+RS: add(r : RegistroExterno)
      RS-->>-CG:
    end
    CG-->>-C:
  end
end
C-->>-UI: «cargaActual : CargaDatos»
alt cargaActual IS NOT NULL
  UI->>+CG: getCantidadValidos()
  CG->>+VS: size()
  VS-->>-CG: «cantidad : Integer»
  CG-->>-UI: «cantidadValidos : Integer»
  UI->>+CG: getCantidadRechazados()
  CG->>+RS: size()
  RS-->>-CG: «cantidad : Integer»
  CG-->>-UI: «cantidadRechazados : Integer»
  Note over UI: UI muestra al actor: resumen de válidos, observaciones y rechazados ("sin novedades" si ambos son 0)
else cargaActual IS NULL
  Note over UI: UI muestra al actor: "El proveedor no responde o deniega el acceso" (se conservan los últimos datos válidos)
end
` },
    { titulo: 'Evento 2 – confirmarIncorporacion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorActualizarFuente
participant CG as cargaActual:CargaDatos
participant VS as «multiobjeto» validos:RegistroExterno
participant F as fuenteActual:FuenteDato
participant GD as cgDao:«Repository» CargaDatosDao
Note over UI: UI recibe del actor: confirmación
UI->>+C: confirmarIncorporacion()
C->>+CG: confirmar()
CG->>+VS: isEmpty()
VS-->>-CG: «sinValidos : Boolean»
opt sinValidos == false
  Note right of CG: estado = "incorporada", fechaEjecucion = date()
  CG->>+F: registrarCarga(fechaEjecucion : Date)
  Note right of F: ultimaCarga = fechaEjecucion
  F-->>-CG:
end
CG-->>-C: «incorporada : Boolean»
opt incorporada == true
  C->>+GD: save(cargaActual : CargaDatos)
  GD-->>-C:
end
C-->>-UI: «incorporada : Boolean»
Note over UI: UI muestra al actor: resultado y fecha de la actualización (o "No hay datos válidos para incorporar")
` }
  ],
  dcd: `
classDiagram
class ControladorActualizarFuente {
  +solicitarActualizacion(idFuente : Integer, fechaDesde : Date, fechaHasta : Date) CargaDatos
  +confirmarIncorporacion() Boolean
}
class FuenteDatoDao {
  <<Repository>>
  +getOne(idFuente : Integer) FuenteDato
}
class CargaDatosDao {
  <<Repository>>
  +save(cg : CargaDatos)
}
class ProveedorDatos {
  <<Service>>
  +obtenerDatos(f : FuenteDato, fechaDesde : Date, fechaHasta : Date) RegistroExterno[*]
}
class FuenteDato {
  -idFuente : Integer = {@Id @GeneratedValue}
  -ultimaCarga : Date
  +yaIncorporado(r : RegistroExterno) Boolean
  +registrarCarga(fechaEjecucion : Date)
}
class CargaDatos {
  -idCargaDatos : Integer = {@Id @GeneratedValue}
  -fechaDesde : Date
  -fechaHasta : Date
  -fechaEjecucion : Date
  -estado : String
  +create(f : FuenteDato, fechaDesde : Date, fechaHasta : Date)
  +evaluar(r : RegistroExterno)
  +getCantidadValidos() Integer
  +getCantidadRechazados() Integer
  +confirmar() Boolean
}
class RegistroExterno {
  -fecha : Date
  -unidad : String
  -valor : Real
  +esValido() Boolean
}
ControladorActualizarFuente "*" --> "0..1 -fDao" FuenteDatoDao
ControladorActualizarFuente "*" --> "0..1 -cgDao" CargaDatosDao
ControladorActualizarFuente "*" --> "0..1 -proveedor" ProveedorDatos
ControladorActualizarFuente "*" --> "0..1 -fuenteActual" FuenteDato
ControladorActualizarFuente "1" --> "0..1 -cargaActual" CargaDatos
ControladorActualizarFuente ..> RegistroExterno
FuenteDatoDao ..> FuenteDato
CargaDatosDao ..> CargaDatos
ProveedorDatos ..> RegistroExterno
ProveedorDatos ..> FuenteDato
FuenteDato ..> RegistroExterno
CargaDatos "*" --> "1 -fuente" FuenteDato
CargaDatos "1" *--> "* -validos" RegistroExterno
CargaDatos "1" *--> "* -rechazados" RegistroExterno
`
});

window.CU.push({
  id: 'CUU25', nombre: 'Evaluar y habilitar una versión de modelo predictivo', controlador: 'ControladorEvaluarModelo',
  supuestos: [
    'Los umbrales de aceptación no se escriben fijos en el DSD: están en la clase CriterioAceptacion (por especie), que AgroCore mantiene.',
    'Se agrega EvaluacionModelo (evidencia de evaluación) como parte de Modelo, y los atributos estado y ambito en Modelo (cuestión abierta del CU).',
    'Al habilitar una versión se deshabilita la anterior de la misma especie, que se conserva identificada. Si la candidata no cumple, sigue en uso la versión anterior.'
  ],
  dsd: [
    { titulo: 'Evento 1 – evaluarVersion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorEvaluarModelo
participant MD as mDao:«Repository» ModeloDao
participant KD as ceDao:«Repository» ConjuntoEvaluacionDao
participant CE as conjunto:ConjuntoEvaluacion
participant M as candidato:Modelo
participant EVS as «multiobjeto» evaluaciones:EvaluacionModelo
Note over UI: UI recibe del actor: idModelo + idConjunto
UI->>+C: evaluarVersion(idModelo : Integer, idConjunto : Integer)
C->>+MD: getOne(idModelo : Integer)
MD-->>-C: «candidato : Modelo»
C->>+KD: getOne(idConjunto : Integer)
KD-->>-C: «conjunto : ConjuntoEvaluacion»
C->>+CE: esCompatibleCon(candidato : Modelo)
Note right of CE: compatible = (especie == candidato.especie) AND (independienteDelEntrenamiento == true)
CE-->>-C: «compatible : Boolean»
opt compatible == true
  C->>+M: evaluar(conjunto : ConjuntoEvaluacion)
  Note right of M: Ejecuta el modelo sobre el conjunto y calcula errorMedioPct
  create participant EV as evaluacionActual:EvaluacionModelo
  M-->>EV: create(conjunto : ConjuntoEvaluacion, errorMedioPct : Real)
  Note right of EV: fecha = date()
  M->>+EVS: add(evaluacionActual : EvaluacionModelo)
  EVS-->>-M:
  M-->>-C: «evaluacionActual : EvaluacionModelo»
  C->>+MD: save(candidato : Modelo)
  MD-->>-C:
end
C-->>-UI: «evaluacionActual : EvaluacionModelo»
alt evaluacionActual IS NOT NULL
  UI->>+EV: getErrorMedioPct()
  EV-->>-UI: «errorMedioPct : Real»
  UI->>+CE: getPoblacion()
  CE-->>-UI: «poblacion : Integer»
  UI->>+CE: getPeriodo()
  CE-->>-UI: «periodo : String»
  Note over UI: UI muestra al actor: métricas + población + período de evaluación
else evaluacionActual IS NULL
  Note over UI: UI muestra al actor: "Datos no compatibles o evaluación no independiente" (no se habilita la versión)
end
` },
    { titulo: 'Evento 2 – habilitarVersion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorEvaluarModelo
participant M as candidato:Modelo
participant RD as crDao:«Repository» CriterioAceptacionDao
participant EV as evaluacionActual:EvaluacionModelo
participant CR as criterio:CriterioAceptacion
participant MD as mDao:«Repository» ModeloDao
participant MA as anterior:Modelo
Note over UI: UI recibe del actor: ambito
UI->>+C: habilitarVersion(ambito : String)
C->>+M: getEspecie()
M-->>-C: «especie : Especie»
C->>+RD: buscarPorEspecie(especie : Especie)
Note right of RD: JPQL: SELECT cr FROM CriterioAceptacion cr WHERE cr.especie = ?1
RD-->>-C: «criterio : CriterioAceptacion»
C->>+EV: cumple(criterio : CriterioAceptacion)
EV->>+CR: getErrorMaximoPct()
CR-->>-EV: «errorMaximoPct : Real»
Note right of EV: cumple = (errorMedioPct <= errorMaximoPct)
EV-->>-C: «cumple : Boolean»
opt cumple == true
  C->>+MD: buscarHabilitadoPorEspecie(especie : Especie)
  Note right of MD: JPQL: SELECT m FROM Modelo m WHERE m.especie = ?1 AND m.estado = 'habilitado'
  MD-->>-C: «anterior : Modelo»
  opt anterior IS NOT NULL
    C->>+MA: deshabilitar()
    Note right of MA: estado = "reemplazado"
    MA-->>-C:
    C->>+MD: save(anterior : Modelo)
    MD-->>-C:
  end
  C->>+M: habilitar(ambito : String)
  Note right of M: estado = "habilitado", ambito = ambito, fechaHabilitacion = date()
  M-->>-C:
  C->>+MD: save(candidato : Modelo)
  MD-->>-C:
end
C-->>-UI: «cumple : Boolean»
Note over UI: UI muestra al actor: "Versión habilitada para el ámbito" (o los criterios incumplidos, y se conserva la versión habilitada)
` }
  ],
  dcd: `
classDiagram
class ControladorEvaluarModelo {
  +evaluarVersion(idModelo : Integer, idConjunto : Integer) EvaluacionModelo
  +habilitarVersion(ambito : String) Boolean
}
class ModeloDao {
  <<Repository>>
  +getOne(idModelo : Integer) Modelo
  +buscarHabilitadoPorEspecie(e : Especie) Modelo
  +save(m : Modelo)
}
class ConjuntoEvaluacionDao {
  <<Repository>>
  +getOne(idConjunto : Integer) ConjuntoEvaluacion
}
class CriterioAceptacionDao {
  <<Repository>>
  +buscarPorEspecie(e : Especie) CriterioAceptacion
}
class Modelo {
  -idModelo : Integer = {@Id @GeneratedValue}
  -version : String
  -estado : String
  -ambito : String
  -fechaHabilitacion : Date
  +getEspecie() Especie
  +evaluar(ce : ConjuntoEvaluacion) EvaluacionModelo
  +habilitar(ambito : String)
  +deshabilitar()
}
class EvaluacionModelo {
  -fecha : Date
  -errorMedioPct : Real
  +create(ce : ConjuntoEvaluacion, errorMedioPct : Real)
  +getErrorMedioPct() Real
  +cumple(cr : CriterioAceptacion) Boolean
}
class ConjuntoEvaluacion {
  -idConjunto : Integer = {@Id @GeneratedValue}
  -poblacion : Integer
  -periodo : String
  -independienteDelEntrenamiento : Boolean
  +esCompatibleCon(m : Modelo) Boolean
  +getPoblacion() Integer
  +getPeriodo() String
}
class CriterioAceptacion {
  -idCriterio : Integer = {@Id @GeneratedValue}
  -errorMaximoPct : Real
  +getErrorMaximoPct() Real
}
class Especie
ControladorEvaluarModelo "*" --> "0..1 -mDao" ModeloDao
ControladorEvaluarModelo "*" --> "0..1 -ceDao" ConjuntoEvaluacionDao
ControladorEvaluarModelo "*" --> "0..1 -crDao" CriterioAceptacionDao
ControladorEvaluarModelo "*" --> "0..1 -candidato" Modelo
ControladorEvaluarModelo "*" --> "0..1 -evaluacionActual" EvaluacionModelo
ControladorEvaluarModelo ..> ConjuntoEvaluacion
ControladorEvaluarModelo ..> CriterioAceptacion
ControladorEvaluarModelo ..> Especie
ModeloDao ..> Modelo
ModeloDao ..> Especie
ConjuntoEvaluacionDao ..> ConjuntoEvaluacion
CriterioAceptacionDao ..> CriterioAceptacion
CriterioAceptacionDao ..> Especie
ConjuntoEvaluacion ..> Modelo
EvaluacionModelo ..> CriterioAceptacion
Modelo "*" --> "1 -especie" Especie
Modelo "1" *--> "* -evaluaciones" EvaluacionModelo
EvaluacionModelo "*" --> "1 -conjunto" ConjuntoEvaluacion
ConjuntoEvaluacion "*" --> "1 -especie" Especie
CriterioAceptacion "*" --> "1 -especie" Especie
`
});

window.CU.push({
  id: 'CUU26', nombre: 'Comparar una recomendación externa con un escenario propio', controlador: 'ControladorCompararRecomendacionExterna',
  supuestos: [
    'La recomendación externa se registra con su procedencia (fuente, fecha, enlace) y nunca se atribuye al sistema.',
    'RecomendacionExterna calcula la diferencia con el escenario propio (experto). Devuelve NULL si las unidades o el alcance no son compatibles (5.a).',
    'Si no existe un escenario propio (4.a), la recomendación queda registrada y la comparación pendiente.'
  ],
  dsd: [
    { titulo: 'Evento 1 – ingresarRecomendacion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorCompararRecomendacionExterna
participant LCD as lcDao:«Repository» LoteCampaniaDao
participant VD as cvDao:«Repository» CultivarDao
Note over UI: UI recibe del actor: idLote + idCampania + fuente + fecha + nombreCultivar + rendimientoEsperado + unidad + enlace
UI->>+C: ingresarRecomendacion(idLote : Integer, idCampania : Integer, fuente : String, fecha : Date, nombreCultivar : String, rendimientoEsperado : Real, unidad : String, enlace : String)
C->>+LCD: buscarPorLoteYCampania(idLote : Integer, idCampania : Integer)
Note right of LCD: JPQL: SELECT lc FROM LoteCampania lc WHERE lc.lote.idLote = ?1 AND lc.campania.idCampania = ?2
LCD-->>-C: «lcActual : LoteCampania»
C->>+VD: buscarPorNombre(nombreCultivar : String)
Note right of VD: JPQL: SELECT c FROM Cultivar c WHERE UPPER(c.nombre) = UPPER(?1)
VD-->>-C: «cv : Cultivar»
opt cv IS NOT NULL
  create participant RE as recActual:RecomendacionExterna
  C-->>RE: create(lcActual : LoteCampania, cv : Cultivar, fuente : String, fecha : Date, rendimientoEsperado : Real, unidad : String, enlace : String)
end
C-->>-UI: «recActual : RecomendacionExterna»
alt recActual IS NOT NULL
  UI->>+RE: getCamposFaltantes()
  RE-->>-UI: «camposFaltantes : String[*]»
  Note over UI: UI muestra al actor: datos a incorporar + unidades + campos faltantes, para confirmar
else recActual IS NULL
  Note over UI: UI muestra al actor: "No se pudo identificar el cultivar: aclare la correspondencia"
end
` },
    { titulo: 'Evento 2 – confirmarIncorporacion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorCompararRecomendacionExterna
participant RD as reDao:«Repository» RecomendacionExternaDao
participant PD as pdDao:«Repository» PrediccionDao
participant EI as escenarios[i]:Prediccion
Note over UI: UI recibe del actor: confirmación
UI->>+C: confirmarIncorporacion()
C->>+RD: save(recActual : RecomendacionExterna)
RD-->>-C:
C->>+PD: buscarPorLoteCampania(lcActual : LoteCampania)
Note right of PD: JPQL: SELECT p FROM Prediccion p WHERE p.loteCampania = ?1
PD-->>-C: «escenarios : Prediccion[*]»
C-->>-UI: «escenarios : Prediccion[*]»
alt escenarios IS NOT EMPTY
  loop Para cada e en escenarios
    UI->>+EI: getIdPrediccion()
    EI-->>-UI: «idPrediccion : Integer»
    UI->>+EI: getNombreEscenario()
    EI-->>-UI: «nombreEscenario : String»
  end
  Note over UI: UI muestra al actor: recomendación registrada + escenarios propios para elegir
else escenarios IS EMPTY
  Note over UI: UI muestra al actor: recomendación registrada. "La comparación queda pendiente"
end
` },
    { titulo: 'Evento 3 – compararConEscenario', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorCompararRecomendacionExterna
participant PD as pdDao:«Repository» PrediccionDao
participant RE as recActual:RecomendacionExterna
participant P as pred:Prediccion
Note over UI: UI recibe del actor: idPrediccion
UI->>+C: compararConEscenario(idPrediccion : Integer)
C->>+PD: getOne(idPrediccion : Integer)
PD-->>-C: «pred : Prediccion»
C->>+RE: calcularDiferencia(pred : Prediccion)
RE->>+P: getUnidad()
P-->>-RE: «unidadPred : String»
Note right of RE: diferencia = NULL
opt unidad == unidadPred
  RE->>+P: getRendimientoP50()
  P-->>-RE: «rendimientoP50 : Real»
  Note right of RE: diferencia = rendimientoEsperado - rendimientoP50
end
RE-->>-C: «diferencia : Real»
C-->>-UI: «diferencia : Real»
UI->>+RE: getFuente()
RE-->>-UI: «fuente : String»
UI->>+P: getEntradas()
P-->>-UI: «entradas : String»
Note over UI: UI muestra al actor: ambos antecedentes con sus supuestos + diferencia (o por qué no se calcula si diferencia IS NULL)
` }
  ],
  dcd: `
classDiagram
class ControladorCompararRecomendacionExterna {
  +ingresarRecomendacion(idLote : Integer, idCampania : Integer, fuente : String, fecha : Date, nombreCultivar : String, rendimientoEsperado : Real, unidad : String, enlace : String) RecomendacionExterna
  +confirmarIncorporacion() Prediccion[*]
  +compararConEscenario(idPrediccion : Integer) Real
}
class LoteCampaniaDao {
  <<Repository>>
  +buscarPorLoteYCampania(idLote : Integer, idCampania : Integer) LoteCampania
}
class CultivarDao {
  <<Repository>>
  +buscarPorNombre(nombreCultivar : String) Cultivar
}
class RecomendacionExternaDao {
  <<Repository>>
  +save(re : RecomendacionExterna)
}
class PrediccionDao {
  <<Repository>>
  +buscarPorLoteCampania(lc : LoteCampania) Prediccion[*]
  +getOne(idPrediccion : Integer) Prediccion
}
class RecomendacionExterna {
  -idRecomendacion : Integer = {@Id @GeneratedValue}
  -fuente : String
  -fecha : Date
  -rendimientoEsperado : Real
  -unidad : String
  -enlace : String
  +create(lc : LoteCampania, cv : Cultivar, fuente : String, fecha : Date, rendimientoEsperado : Real, unidad : String, enlace : String)
  +getCamposFaltantes() String[*]
  +calcularDiferencia(p : Prediccion) Real
  +getFuente() String
}
class LoteCampania {
  -idLoteCampania : Integer = {@Id @GeneratedValue}
}
class Lote {
  -idLote : Integer = {@Id @GeneratedValue}
}
class Campania {
  -idCampania : Integer = {@Id @GeneratedValue}
}
class Cultivar {
  -idCultivar : Integer = {@Id @GeneratedValue}
  -nombre : String
}
class Prediccion {
  -idPrediccion : Integer = {@Id @GeneratedValue}
  -nombreEscenario : String
  -unidad : String
  -rendimientoP50 : Real
  -entradas : String
  +getIdPrediccion() Integer
  +getNombreEscenario() String
  +getUnidad() String
  +getRendimientoP50() Real
  +getEntradas() String
}
ControladorCompararRecomendacionExterna "*" --> "0..1 -lcDao" LoteCampaniaDao
ControladorCompararRecomendacionExterna "*" --> "0..1 -cvDao" CultivarDao
ControladorCompararRecomendacionExterna "*" --> "0..1 -reDao" RecomendacionExternaDao
ControladorCompararRecomendacionExterna "*" --> "0..1 -pdDao" PrediccionDao
ControladorCompararRecomendacionExterna "*" --> "0..1 -lcActual" LoteCampania
ControladorCompararRecomendacionExterna "1" --> "0..1 -recActual" RecomendacionExterna
ControladorCompararRecomendacionExterna ..> Cultivar
ControladorCompararRecomendacionExterna ..> Prediccion
LoteCampaniaDao ..> LoteCampania
CultivarDao ..> Cultivar
RecomendacionExternaDao ..> RecomendacionExterna
PrediccionDao ..> Prediccion
PrediccionDao ..> LoteCampania
RecomendacionExterna ..> Prediccion
RecomendacionExterna "*" --> "1 -loteCampania" LoteCampania
RecomendacionExterna "*" --> "1 -cultivar" Cultivar
LoteCampania "*" --> "1 -lote" Lote
LoteCampania "*" --> "1 -campania" Campania
Prediccion "*" --> "1 -loteCampania" LoteCampania
`
});
