// CUU09 a CUU14 – Base productiva, planificación e insumos
window.CU.push({
  id: 'CUU09', nombre: 'Registrar un lote', controlador: 'ControladorRegistrarLote',
  supuestos: [
    'loteActual y establecimientoActual son variables de instancia del controlador: el lote se crea en memoria en el Evento 1 y se persiste recién al confirmar (Evento 2).',
    'Las referencias de suelo y clima se buscan por ubicación en sus DAO. Si no existen, el lote se guarda con esa referencia pendiente (3.a).',
    'El contorno se representa como texto (geometría serializada).'
  ],
  dsd: [
    { titulo: 'Evento 1 – ingresarDatosLote', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarLote
participant ED as eDao:«Repository» EstablecimientoDao
participant E as establecimientoActual:Establecimiento
participant SD as spDao:«Repository» SueloPerfilDao
participant KD as ccDao:«Repository» CeldaClimaDao
Note over UI: UI recibe del actor: idEstablecimiento + nombre + latitud + longitud + superficieHa + tenencia + contorno
UI->>+C: ingresarDatosLote(idEstablecimiento : Integer, nombre : String, latitud : Real, longitud : Real, superficieHa : Real, tenencia : String, contorno : String)
C->>+ED: getOne(idEstablecimiento : Integer)
ED-->>-C: «establecimientoActual : Establecimiento»
C->>+E: perteneceA(usuarioLogueado : Usuario)
E-->>-C: «autorizado : Boolean»
opt autorizado == true
  create participant L as loteActual:Lote
  C-->>L: create(establecimientoActual : Establecimiento, nombre : String, latitud : Real, longitud : Real, superficieHa : Real, tenencia : String, contorno : String)
  C->>+L: esValido()
  Note right of L: valido = (superficieHa > 0) AND (latitud y longitud dentro de rango)
  L-->>-C: «valido : Boolean»
  opt valido == true
    C->>+SD: buscarPorUbicacion(latitud : Real, longitud : Real)
    Note right of SD: JPQL: SELECT s FROM SueloPerfil s WHERE ?1 BETWEEN s.latMin AND s.latMax AND ?2 BETWEEN s.lonMin AND s.lonMax
    SD-->>-C: «perfil : SueloPerfil»
    C->>+KD: buscarPorUbicacion(latitud : Real, longitud : Real)
    Note right of KD: JPQL: SELECT k FROM CeldaClima k WHERE ?1 BETWEEN k.latMin AND k.latMax AND ?2 BETWEEN k.lonMin AND k.lonMax
    KD-->>-C: «celda : CeldaClima»
    C->>+L: asignarReferencias(perfil : SueloPerfil, celda : CeldaClima)
    L-->>-C:
  end
end
C-->>-UI: «loteActual : Lote»
alt loteActual IS NOT NULL
  UI->>+L: esValido()
  L-->>-UI: «valido : Boolean»
  UI->>+L: tieneReferenciaSuelo()
  L-->>-UI: «conSuelo : Boolean»
  UI->>+L: tieneReferenciaClima()
  L-->>-UI: «conClima : Boolean»
  Note over UI: UI muestra al actor: datos declarados + referencias estimadas (o cuál falta) + inconsistencias si valido == false
else loteActual IS NULL
  Note over UI: UI muestra al actor: "Operación rechazada" (sin revelar datos del establecimiento)
end
` },
    { titulo: 'Evento 2 – confirmarLote', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarLote
participant LD as lDao:«Repository» LoteDao
participant L as loteActual:Lote
Note over UI: UI recibe del actor: confirmación
UI->>+C: confirmarLote()
C->>+LD: save(loteActual : Lote)
LD-->>-C:
C-->>-UI: «loteActual : Lote»
UI->>+L: getIdLote()
L-->>-UI: «idLote : Integer»
Note over UI: UI muestra al actor: idLote + "Lote registrado"
` }
  ],
  dcd: `
classDiagram
class ControladorRegistrarLote {
  +ingresarDatosLote(idEstablecimiento : Integer, nombre : String, latitud : Real, longitud : Real, superficieHa : Real, tenencia : String, contorno : String) Lote
  +confirmarLote() Lote
}
class EstablecimientoDao {
  <<Repository>>
  +getOne(idEstablecimiento : Integer) Establecimiento
}
class LoteDao {
  <<Repository>>
  +save(l : Lote)
}
class SueloPerfilDao {
  <<Repository>>
  +buscarPorUbicacion(latitud : Real, longitud : Real) SueloPerfil
}
class CeldaClimaDao {
  <<Repository>>
  +buscarPorUbicacion(latitud : Real, longitud : Real) CeldaClima
}
class Establecimiento {
  -idEstablecimiento : Integer = {@Id @GeneratedValue}
  +perteneceA(u : Usuario) Boolean
}
class Lote {
  -idLote : Integer = {@Id @GeneratedValue}
  -nombre : String
  -latitud : Real
  -longitud : Real
  -superficieHa : Real
  -tenencia : String
  -contorno : String
  +create(e : Establecimiento, nombre : String, latitud : Real, longitud : Real, superficieHa : Real, tenencia : String, contorno : String)
  +esValido() Boolean
  +asignarReferencias(perfil : SueloPerfil, celda : CeldaClima)
  +tieneReferenciaSuelo() Boolean
  +tieneReferenciaClima() Boolean
  +getIdLote() Integer
}
class SueloPerfil {
  -idSueloPerfil : Integer = {@Id @GeneratedValue}
  -latMin : Real
  -latMax : Real
  -lonMin : Real
  -lonMax : Real
}
class CeldaClima {
  -idCeldaClima : Integer = {@Id @GeneratedValue}
  -latMin : Real
  -latMax : Real
  -lonMin : Real
  -lonMax : Real
}
class Usuario
ControladorRegistrarLote "*" --> "0..1 -eDao" EstablecimientoDao
ControladorRegistrarLote "*" --> "0..1 -lDao" LoteDao
ControladorRegistrarLote "*" --> "0..1 -spDao" SueloPerfilDao
ControladorRegistrarLote "*" --> "0..1 -ccDao" CeldaClimaDao
ControladorRegistrarLote "*" --> "0..1 -usuarioLogueado" Usuario
ControladorRegistrarLote "*" --> "0..1 -establecimientoActual" Establecimiento
ControladorRegistrarLote "1" --> "0..1 -loteActual" Lote
ControladorRegistrarLote ..> SueloPerfil
ControladorRegistrarLote ..> CeldaClima
EstablecimientoDao ..> Establecimiento
LoteDao ..> Lote
SueloPerfilDao ..> SueloPerfil
CeldaClimaDao ..> CeldaClima
Establecimiento "*" --> "1 -usuario" Usuario
Lote "*" --> "1 -establecimiento" Establecimiento
Lote "*" --> "0..1 -sueloPerfil" SueloPerfil
Lote "*" --> "0..1 -celdaClima" CeldaClima
`
});

window.CU.push({
  id: 'CUU10', nombre: 'Definir ambientes de un lote', controlador: 'ControladorDefinirAmbientes',
  supuestos: [
    'El evento agregarAmbiente se repite por cada ambiente. Los ambientes se agregan al lote en memoria y solo se persisten al confirmar: si no se confirma, se conserva la distribución anterior.',
    'El Lote es el experto en información: valida que la superficie sea positiva y que la suma no supere su superficie.',
    'AmbienteLote no tiene DAO propio: es parte (composición) de Lote y se guarda con LoteDao.'
  ],
  dsd: [
    { titulo: 'Evento 1 – seleccionarLote', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorDefinirAmbientes
participant LD as lDao:«Repository» LoteDao
participant L as loteActual:Lote
Note over UI: UI recibe del actor: idLote
UI->>+C: seleccionarLote(idLote : Integer)
C->>+LD: getOne(idLote : Integer)
LD-->>-C: «loteActual : Lote»
C->>+L: perteneceA(usuarioLogueado : Usuario)
L-->>-C: «autorizado : Boolean»
opt autorizado == true
  C->>+L: iniciarDistribucion()
  create participant AM as «multiobjeto» ambientes:AmbienteLote
  L-->>AM: create()
  L-->>-C:
end
C-->>-UI: «autorizado : Boolean»
opt autorizado == true
  UI->>+L: getSuperficieHa()
  L-->>-UI: «superficieHa : Real»
end
Note over UI: UI muestra al actor: superficieHa del lote (o rechazo si autorizado == false)
` },
    { titulo: 'Evento 2 – agregarAmbiente (se repite por cada ambiente)', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorDefinirAmbientes
participant L as loteActual:Lote
participant AI as ambientes[i]:AmbienteLote
participant AM as «multiobjeto» ambientes:AmbienteLote
Note over UI: UI recibe del actor: nombre + superficieHa + potencialProductivo
UI->>+C: agregarAmbiente(nombre : String, superficieHa : Real, potencialProductivo : String)
C->>+L: agregarAmbiente(nombre : String, superficieHa : Real, potencialProductivo : String)
Note right of L: asignada = 0
loop Para cada a en ambientes
  L->>+AI: getSuperficieHa()
  AI-->>-L: «sup : Real»
  Note right of L: asignada = asignada + sup
end
Note right of L: agregado = (superficieHa > 0) AND (asignada + superficieHa <= this.superficieHa)
opt agregado == true
  create participant A as a:AmbienteLote
  L-->>A: create(nombre : String, superficieHa : Real, potencialProductivo : String)
  L->>+AM: add(a : AmbienteLote)
  AM-->>-L:
end
L-->>-C: «agregado : Boolean»
C-->>-UI: «agregado : Boolean»
UI->>+L: getSuperficieSinAsignar()
Note right of L: sinAsignar = this.superficieHa - suma de superficieHa de ambientes
L-->>-UI: «sinAsignar : Real»
Note over UI: UI muestra al actor: distribución declarada + sinAsignar (o la diferencia a corregir si agregado == false)
` },
    { titulo: 'Evento 3 – confirmarDistribucion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorDefinirAmbientes
participant LD as lDao:«Repository» LoteDao
Note over UI: UI recibe del actor: confirmación
UI->>+C: confirmarDistribucion()
C->>+LD: save(loteActual : Lote)
LD-->>-C:
C-->>-UI: «loteActual : Lote»
Note over UI: UI muestra al actor: "Ambientes registrados" (la superficie sin asignar queda explícita)
` }
  ],
  dcd: `
classDiagram
class ControladorDefinirAmbientes {
  +seleccionarLote(idLote : Integer) Boolean
  +agregarAmbiente(nombre : String, superficieHa : Real, potencialProductivo : String) Boolean
  +confirmarDistribucion() Lote
}
class LoteDao {
  <<Repository>>
  +getOne(idLote : Integer) Lote
  +save(l : Lote)
}
class Lote {
  -idLote : Integer = {@Id @GeneratedValue}
  -superficieHa : Real
  +perteneceA(u : Usuario) Boolean
  +iniciarDistribucion()
  +agregarAmbiente(nombre : String, superficieHa : Real, potencialProductivo : String) Boolean
  +getSuperficieHa() Real
  +getSuperficieSinAsignar() Real
}
class AmbienteLote {
  -nombre : String
  -superficieHa : Real
  -potencialProductivo : String
  +create(nombre : String, superficieHa : Real, potencialProductivo : String)
  +getSuperficieHa() Real
}
class Usuario
ControladorDefinirAmbientes "*" --> "0..1 -lDao" LoteDao
ControladorDefinirAmbientes "*" --> "0..1 -usuarioLogueado" Usuario
ControladorDefinirAmbientes "*" --> "0..1 -loteActual" Lote
LoteDao ..> Lote
Lote ..> Usuario
Lote "1" *--> "* -ambientes" AmbienteLote
`
});

window.CU.push({
  id: 'CUU11', nombre: 'Registrar un análisis de suelo', controlador: 'ControladorRegistrarAnalisisSuelo',
  supuestos: [
    'Un análisis es un SueloPerfil compuesto por SueloHorizonte (uno por intervalo de profundidad). El evento agregarHorizonte se repite por cada medición.',
    'Los valores no informados quedan en NULL (no se reemplazan por cero): la UI los identifica al presentar las mediciones.',
    'El lote conserva el historial de perfiles (rol perfiles) para no perder la referencia usada en simulaciones previas.'
  ],
  dsd: [
    { titulo: 'Evento 1 – iniciarAnalisis', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarAnalisisSuelo
participant LD as lDao:«Repository» LoteDao
participant L as loteActual:Lote
Note over UI: UI recibe del actor: idLote + fecha + procedencia
UI->>+C: iniciarAnalisis(idLote : Integer, fecha : Date, procedencia : String)
C->>+LD: getOne(idLote : Integer)
LD-->>-C: «loteActual : Lote»
C->>+L: perteneceA(usuarioLogueado : Usuario)
L-->>-C: «autorizado : Boolean»
opt autorizado == true
  create participant SP as perfilActual:SueloPerfil
  C-->>SP: create(fecha : Date, procedencia : String)
  create participant HS as «multiobjeto» horizontes:SueloHorizonte
  SP-->>HS: create()
end
C-->>-UI: «autorizado : Boolean»
Note over UI: UI muestra al actor: control para el ingreso de mediciones
` },
    { titulo: 'Evento 2 – agregarHorizonte (se repite por cada medición)', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarAnalisisSuelo
participant SP as perfilActual:SueloPerfil
participant HI as horizontes[i]:SueloHorizonte
participant HS as «multiobjeto» horizontes:SueloHorizonte
Note over UI: UI recibe del actor: profDesdeCm + profHastaCm + materiaOrganicaPct + ph + textura
UI->>+C: agregarHorizonte(profDesdeCm : Real, profHastaCm : Real, materiaOrganicaPct : Real, ph : Real, textura : String)
C->>+SP: agregarHorizonte(profDesdeCm : Real, profHastaCm : Real, materiaOrganicaPct : Real, ph : Real, textura : String)
Note right of SP: valido = (profDesdeCm < profHastaCm) AND (valores dentro de los rangos admitidos)
loop Para cada h en horizontes
  SP->>+HI: seSuperpone(profDesdeCm : Real, profHastaCm : Real)
  HI-->>-SP: «superpone : Boolean»
  Note right of SP: Si superpone == true entonces valido = false
end
opt valido == true
  create participant H as h:SueloHorizonte
  SP-->>H: create(profDesdeCm : Real, profHastaCm : Real, materiaOrganicaPct : Real, ph : Real, textura : String)
  SP->>+HS: add(h : SueloHorizonte)
  HS-->>-SP:
end
SP-->>-C: «valido : Boolean»
C-->>-UI: «valido : Boolean»
Note over UI: UI muestra al actor: mediciones cargadas y campos no informados (o los campos a corregir si valido == false)
` },
    { titulo: 'Evento 3 – confirmarAnalisis', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarAnalisisSuelo
participant L as loteActual:Lote
participant PS as «multiobjeto» perfiles:SueloPerfil
participant LD as lDao:«Repository» LoteDao
Note over UI: UI recibe del actor: confirmación
UI->>+C: confirmarAnalisis()
C->>+L: asociarPerfil(perfilActual : SueloPerfil)
L->>+PS: add(perfilActual : SueloPerfil)
PS-->>-L:
Note right of L: sueloPerfil = perfilActual (perfil vigente)
L-->>-C:
C->>+LD: save(loteActual : Lote)
LD-->>-C:
C-->>-UI: «perfilActual : SueloPerfil»
Note over UI: UI muestra al actor: "Análisis registrado y vinculado al lote"
` }
  ],
  dcd: `
classDiagram
class ControladorRegistrarAnalisisSuelo {
  +iniciarAnalisis(idLote : Integer, fecha : Date, procedencia : String) Boolean
  +agregarHorizonte(profDesdeCm : Real, profHastaCm : Real, materiaOrganicaPct : Real, ph : Real, textura : String) Boolean
  +confirmarAnalisis() SueloPerfil
}
class LoteDao {
  <<Repository>>
  +getOne(idLote : Integer) Lote
  +save(l : Lote)
}
class Lote {
  -idLote : Integer = {@Id @GeneratedValue}
  +perteneceA(u : Usuario) Boolean
  +asociarPerfil(p : SueloPerfil)
}
class SueloPerfil {
  -fecha : Date
  -procedencia : String
  +create(fecha : Date, procedencia : String)
  +agregarHorizonte(profDesdeCm : Real, profHastaCm : Real, materiaOrganicaPct : Real, ph : Real, textura : String) Boolean
}
class SueloHorizonte {
  -profDesdeCm : Real
  -profHastaCm : Real
  -materiaOrganicaPct : Real
  -ph : Real
  -textura : String
  +create(profDesdeCm : Real, profHastaCm : Real, materiaOrganicaPct : Real, ph : Real, textura : String)
  +seSuperpone(profDesdeCm : Real, profHastaCm : Real) Boolean
}
class Usuario
ControladorRegistrarAnalisisSuelo "*" --> "0..1 -lDao" LoteDao
ControladorRegistrarAnalisisSuelo "*" --> "0..1 -usuarioLogueado" Usuario
ControladorRegistrarAnalisisSuelo "*" --> "0..1 -loteActual" Lote
ControladorRegistrarAnalisisSuelo "1" --> "0..1 -perfilActual" SueloPerfil
LoteDao ..> Lote
Lote ..> Usuario
Lote "1" *--> "* -perfiles" SueloPerfil
Lote "*" --> "0..1 -sueloPerfil" SueloPerfil
SueloPerfil "1" *--> "1..* -horizontes" SueloHorizonte
`
});

window.CU.push({
  id: 'CUU12', nombre: 'Consultar cultivares y antecedentes de ensayo', controlador: 'ControladorConsultarCultivares',
  supuestos: [
    'Es una consulta: no hay save. Los DAO devuelven objetos y la UI les pide los datos que muestra, en un único loop por colección.',
    'Los campos no informados llegan como NULL y la UI los muestra como "no informado" (un evento transgénico vacío no se interpreta como ausencia demostrada).'
  ],
  dsd: [
    { titulo: 'Evento 1 – buscarCultivares', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorConsultarCultivares
participant ED as eDao:«Repository» EspecieDao
participant VD as cvDao:«Repository» CultivarDao
participant CS as cultivares[i]:Cultivar
participant F as fuente:FuenteDato
Note over UI: UI recibe del actor: idEspecie + criterioNombre
UI->>+C: buscarCultivares(idEspecie : Integer, criterioNombre : String)
C->>+ED: getOne(idEspecie : Integer)
ED-->>-C: «especie : Especie»
C->>+VD: buscarPorEspecieYNombre(especie : Especie, criterioNombre : String)
Note right of VD: JPQL: SELECT c FROM Cultivar c WHERE c.especie = ?1 AND c.nombre LIKE '%?2%' ORDER BY c.nombre
VD-->>-C: «cultivares : Cultivar[*]»
C-->>-UI: «cultivares : Cultivar[*]»
alt cultivares IS NOT EMPTY
  loop Para cada cv en cultivares
    UI->>+CS: getIdCultivar()
    CS-->>-UI: «idCultivar : Integer»
    UI->>+CS: getNombre()
    CS-->>-UI: «nombre : String»
    UI->>+CS: getFechaActualizacionFuente()
    CS->>+F: getUltimaCarga()
    F-->>-CS: «ultimaCarga : Date»
    CS-->>-UI: «ultimaCarga : Date»
  end
  Note over UI: UI muestra al actor: idCultivar + nombre + fecha de actualización de la fuente
else cultivares IS EMPTY
  Note over UI: UI muestra al actor: "No existen cultivares coincidentes, modifique los criterios"
end
` },
    { titulo: 'Evento 2 – seleccionarCultivar', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorConsultarCultivares
participant VD as cvDao:«Repository» CultivarDao
participant CV as cv:Cultivar
participant EN as ensayos[i]:EnsayoCultivar
Note over UI: UI recibe del actor: idCultivar
UI->>+C: seleccionarCultivar(idCultivar : Integer)
C->>+VD: getOne(idCultivar : Integer)
VD-->>-C: «cv : Cultivar»
C-->>-UI: «cv : Cultivar»
UI->>+CV: getNombre()
CV-->>-UI: «nombre : String»
UI->>+CV: getNroRegistro()
CV-->>-UI: «nroRegistro : String»
UI->>+CV: getCondicionGenetica()
CV-->>-UI: «condicionGenetica : String»
UI->>+CV: getEventosTransgenicos()
CV-->>-UI: «eventosTransgenicos : String»
UI->>+CV: getFechaInscripcion()
CV-->>-UI: «fechaInscripcion : Date»
UI->>+CV: getEnsayos()
CV-->>-UI: «ensayos : EnsayoCultivar[*]»
alt ensayos IS NOT EMPTY
  loop Para cada e en ensayos
    UI->>+EN: getLocalidad()
    EN-->>-UI: «localidad : String»
    UI->>+EN: getCampania()
    EN-->>-UI: «campania : String»
    UI->>+EN: getFuente()
    EN-->>-UI: «fuente : String»
  end
  Note over UI: UI muestra al actor: ficha del cultivar + ensayos (localidad, campaña, fuente)
else ensayos IS EMPTY
  Note over UI: UI muestra al actor: ficha del cultivar + "Sin ensayos registrados"
end
` }
  ],
  dcd: `
classDiagram
class ControladorConsultarCultivares {
  +buscarCultivares(idEspecie : Integer, criterioNombre : String) Cultivar[*]
  +seleccionarCultivar(idCultivar : Integer) Cultivar
}
class EspecieDao {
  <<Repository>>
  +getOne(idEspecie : Integer) Especie
}
class CultivarDao {
  <<Repository>>
  +buscarPorEspecieYNombre(e : Especie, criterioNombre : String) Cultivar[*]
  +getOne(idCultivar : Integer) Cultivar
}
class Especie {
  -idEspecie : Integer = {@Id @GeneratedValue}
}
class Cultivar {
  -idCultivar : Integer = {@Id @GeneratedValue}
  -nombre : String
  -nroRegistro : String
  -condicionGenetica : String
  -eventosTransgenicos : String
  -fechaInscripcion : Date
  +getIdCultivar() Integer
  +getNombre() String
  +getNroRegistro() String
  +getCondicionGenetica() String
  +getEventosTransgenicos() String
  +getFechaInscripcion() Date
  +getFechaActualizacionFuente() Date
  +getEnsayos() EnsayoCultivar[*]
}
class EnsayoCultivar {
  -localidad : String
  -campania : String
  -fuente : String
  +getLocalidad() String
  +getCampania() String
  +getFuente() String
}
class FuenteDato {
  -ultimaCarga : Date
  +getUltimaCarga() Date
}
ControladorConsultarCultivares "*" --> "0..1 -eDao" EspecieDao
ControladorConsultarCultivares "*" --> "0..1 -cvDao" CultivarDao
ControladorConsultarCultivares ..> Especie
ControladorConsultarCultivares ..> Cultivar
EspecieDao ..> Especie
CultivarDao ..> Cultivar
CultivarDao ..> Especie
Cultivar "*" --> "1 -especie" Especie
Cultivar "*" --> "1 -fuente" FuenteDato
Cultivar "1" *--> "* -ensayos" EnsayoCultivar
`
});

window.CU.push({
  id: 'CUU13', nombre: 'Modificar la planificación de un lote en una campaña', controlador: 'ControladorModificarPlanificacion',
  supuestos: [
    'La planificación es el objeto LoteCampania (relación lote-campaña). Los cambios se aplican en memoria (Evento 2) y solo se persisten al confirmar (Evento 3): si el usuario conserva la planificación anterior no se guarda nada.',
    'Las predicciones previas no se modifican: cada Prediccion conserva sus propias entradas. fechaModificacion permite distinguir los resultados calculados con datos anteriores.'
  ],
  dsd: [
    { titulo: 'Evento 1 – seleccionarPlanificacion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorModificarPlanificacion
participant LCD as lcDao:«Repository» LoteCampaniaDao
participant LC as lcActual:LoteCampania
participant CV as cultivar:Cultivar
Note over UI: UI recibe del actor: idLote + idCampania
UI->>+C: seleccionarPlanificacion(idLote : Integer, idCampania : Integer)
C->>+LCD: buscarPorLoteYCampania(idLote : Integer, idCampania : Integer)
Note right of LCD: JPQL: SELECT lc FROM LoteCampania lc WHERE lc.lote.idLote = ?1 AND lc.campania.idCampania = ?2
LCD-->>-C: «lcActual : LoteCampania»
C-->>-UI: «lcActual : LoteCampania»
UI->>+LC: getNombreCultivar()
LC->>+CV: getNombre()
CV-->>-LC: «nombre : String»
LC-->>-UI: «nombreCultivar : String»
UI->>+LC: getFechaSiembra()
LC-->>-UI: «fechaSiembra : Date»
UI->>+LC: getDensidad()
LC-->>-UI: «densidad : Real»
UI->>+LC: getAntecesor()
LC-->>-UI: «antecesor : String»
UI->>+LC: getManejo()
LC-->>-UI: «manejo : String»
Note over UI: UI muestra al actor: cultivar + fechaSiembra + densidad + antecesor + manejo
` },
    { titulo: 'Evento 2 – informarCambios', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorModificarPlanificacion
participant ED as eDao:«Repository» EspecieDao
participant VD as cvDao:«Repository» CultivarDao
participant LC as lcActual:LoteCampania
participant CV as cultivar:Cultivar
participant PD as pdDao:«Repository» PrediccionDao
participant PS as previas[i]:Prediccion
Note over UI: UI recibe del actor: idEspecie + idCultivar + fechaSiembra + densidad + antecesor + manejo
UI->>+C: informarCambios(idEspecie : Integer, idCultivar : Integer, fechaSiembra : Date, densidad : Real, antecesor : String, manejo : String)
C->>+ED: getOne(idEspecie : Integer)
ED-->>-C: «especie : Especie»
C->>+VD: getOne(idCultivar : Integer)
VD-->>-C: «cultivar : Cultivar»
C->>+LC: actualizarPlanificacion(especie : Especie, cultivar : Cultivar, fechaSiembra : Date, densidad : Real, antecesor : String, manejo : String)
LC->>+CV: esDeEspecie(especie : Especie)
CV-->>-LC: «compatible : Boolean»
Note right of LC: valido = compatible AND (densidad > 0) AND (fechaSiembra dentro de la campaña). Si valido: asigna los datos y fechaModificacion = date()
LC-->>-C: «valido : Boolean»
opt valido == true
  C->>+PD: buscarPorLoteCampania(lcActual : LoteCampania)
  Note right of PD: JPQL: SELECT p FROM Prediccion p WHERE p.loteCampania = ?1
  PD-->>-C: «previas : Prediccion[*]»
end
C-->>-UI: «previas : Prediccion[*]»
alt previas IS NOT NULL
  loop Para cada p en previas
    UI->>+PS: getNombreEscenario()
    PS-->>-UI: «nombreEscenario : String»
    UI->>+PS: getFecha()
    PS-->>-UI: «fecha : Date»
  end
  Note over UI: UI muestra al actor: resultados anteriores que corresponden a otros datos de entrada y solicita confirmación
else previas IS NULL
  Note over UI: UI muestra al actor: inconsistencias a corregir (cultivar de otra especie o datos inválidos)
end
` },
    { titulo: 'Evento 3 – confirmarCambios', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorModificarPlanificacion
participant LCD as lcDao:«Repository» LoteCampaniaDao
Note over UI: UI recibe del actor: confirmación
UI->>+C: confirmarCambios()
C->>+LCD: save(lcActual : LoteCampania)
LCD-->>-C:
C-->>-UI: «lcActual : LoteCampania»
Note over UI: UI muestra al actor: "Planificación actualizada"
` }
  ],
  dcd: `
classDiagram
class ControladorModificarPlanificacion {
  +seleccionarPlanificacion(idLote : Integer, idCampania : Integer) LoteCampania
  +informarCambios(idEspecie : Integer, idCultivar : Integer, fechaSiembra : Date, densidad : Real, antecesor : String, manejo : String) Prediccion[*]
  +confirmarCambios() LoteCampania
}
class LoteCampaniaDao {
  <<Repository>>
  +buscarPorLoteYCampania(idLote : Integer, idCampania : Integer) LoteCampania
  +save(lc : LoteCampania)
}
class EspecieDao {
  <<Repository>>
  +getOne(idEspecie : Integer) Especie
}
class CultivarDao {
  <<Repository>>
  +getOne(idCultivar : Integer) Cultivar
}
class PrediccionDao {
  <<Repository>>
  +buscarPorLoteCampania(lc : LoteCampania) Prediccion[*]
}
class LoteCampania {
  -idLoteCampania : Integer = {@Id @GeneratedValue}
  -fechaSiembra : Date
  -densidad : Real
  -antecesor : String
  -manejo : String
  -fechaModificacion : Date
  +getNombreCultivar() String
  +getFechaSiembra() Date
  +getDensidad() Real
  +getAntecesor() String
  +getManejo() String
  +actualizarPlanificacion(e : Especie, cv : Cultivar, fechaSiembra : Date, densidad : Real, antecesor : String, manejo : String) Boolean
}
class Lote {
  -idLote : Integer = {@Id @GeneratedValue}
}
class Campania {
  -idCampania : Integer = {@Id @GeneratedValue}
}
class Especie {
  -idEspecie : Integer = {@Id @GeneratedValue}
}
class Cultivar {
  -idCultivar : Integer = {@Id @GeneratedValue}
  -nombre : String
  +getNombre() String
  +esDeEspecie(e : Especie) Boolean
}
class Prediccion {
  -idPrediccion : Integer = {@Id @GeneratedValue}
  -nombreEscenario : String
  -fecha : Date
  +getNombreEscenario() String
  +getFecha() Date
}
ControladorModificarPlanificacion "*" --> "0..1 -lcDao" LoteCampaniaDao
ControladorModificarPlanificacion "*" --> "0..1 -eDao" EspecieDao
ControladorModificarPlanificacion "*" --> "0..1 -cvDao" CultivarDao
ControladorModificarPlanificacion "*" --> "0..1 -pdDao" PrediccionDao
ControladorModificarPlanificacion "*" --> "0..1 -lcActual" LoteCampania
ControladorModificarPlanificacion ..> Especie
ControladorModificarPlanificacion ..> Cultivar
ControladorModificarPlanificacion ..> Prediccion
LoteCampaniaDao ..> LoteCampania
EspecieDao ..> Especie
CultivarDao ..> Cultivar
PrediccionDao ..> Prediccion
PrediccionDao ..> LoteCampania
LoteCampania "*" --> "1 -lote" Lote
LoteCampania "*" --> "1 -campania" Campania
LoteCampania "*" --> "1 -especie" Especie
LoteCampania "*" --> "1 -cultivar" Cultivar
Cultivar "*" --> "1 -especie" Especie
Prediccion "*" --> "1 -loteCampania" LoteCampania
`
});

window.CU.push({
  id: 'CUU14', nombre: 'Registrar una aplicación de insumos', controlador: 'ControladorRegistrarAplicacion',
  supuestos: [
    'LoteCampania crea la aplicación y valida dosis, costo y compatibilidad de unidad (experto + creador). Si es inválida devuelve NULL y no se registra.',
    'AplicacionInsumo es parte de LoteCampania (composición): se guarda con LoteCampaniaDao.',
    'La dosis se interpreta como cantidad por hectárea (cuestión abierta del CU).'
  ],
  dsd: [
    { titulo: 'Evento 1 – ingresarAplicacion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarAplicacion
participant LCD as lcDao:«Repository» LoteCampaniaDao
participant ID as iDao:«Repository» InsumoDao
participant LC as lcActual:LoteCampania
participant I as insumo:Insumo
Note over UI: UI recibe del actor: idLote + idCampania + idInsumo + fecha + dosis + unidad + costoHa
UI->>+C: ingresarAplicacion(idLote : Integer, idCampania : Integer, idInsumo : Integer, fecha : Date, dosis : Real, unidad : String, costoHa : Real)
C->>+LCD: buscarPorLoteYCampania(idLote : Integer, idCampania : Integer)
Note right of LCD: JPQL: SELECT lc FROM LoteCampania lc WHERE lc.lote.idLote = ?1 AND lc.campania.idCampania = ?2
LCD-->>-C: «lcActual : LoteCampania»
C->>+ID: existsById(idInsumo : Integer)
ID-->>-C: «existe : Boolean»
opt existe == true
  C->>+ID: getOne(idInsumo : Integer)
  ID-->>-C: «insumo : Insumo»
  C->>+LC: crearAplicacion(insumo : Insumo, fecha : Date, dosis : Real, unidad : String, costoHa : Real)
  LC->>+I: admiteUnidad(unidad : String)
  I-->>-LC: «compatible : Boolean»
  opt compatible == true AND dosis > 0 AND costoHa >= 0
    create participant AP as aplicacionActual:AplicacionInsumo
    LC-->>AP: create(insumo : Insumo, fecha : Date, dosis : Real, unidad : String, costoHa : Real)
  end
  LC-->>-C: «aplicacionActual : AplicacionInsumo»
end
C-->>-UI: «aplicacionActual : AplicacionInsumo»
alt aplicacionActual IS NOT NULL
  UI->>+AP: getCostoHa()
  AP-->>-UI: «costoHa : Real»
  Note over UI: UI muestra al actor: aplicación + costo declarado para confirmar
else aplicacionActual IS NULL
  Note over UI: UI muestra al actor: insumo inexistente, unidad incompatible o valores a corregir
end
` },
    { titulo: 'Evento 2 – confirmarAplicacion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarAplicacion
participant LC as lcActual:LoteCampania
participant APS as «multiobjeto» aplicaciones:AplicacionInsumo
participant LCD as lcDao:«Repository» LoteCampaniaDao
Note over UI: UI recibe del actor: confirmación
UI->>+C: confirmarAplicacion()
C->>+LC: agregarAplicacion(aplicacionActual : AplicacionInsumo)
LC->>+APS: add(aplicacionActual : AplicacionInsumo)
APS-->>-LC:
LC-->>-C:
C->>+LCD: save(lcActual : LoteCampania)
LCD-->>-C:
C-->>-UI: «aplicacionActual : AplicacionInsumo»
Note over UI: UI muestra al actor: "Aplicación registrada"
` }
  ],
  dcd: `
classDiagram
class ControladorRegistrarAplicacion {
  +ingresarAplicacion(idLote : Integer, idCampania : Integer, idInsumo : Integer, fecha : Date, dosis : Real, unidad : String, costoHa : Real) AplicacionInsumo
  +confirmarAplicacion() AplicacionInsumo
}
class LoteCampaniaDao {
  <<Repository>>
  +buscarPorLoteYCampania(idLote : Integer, idCampania : Integer) LoteCampania
  +save(lc : LoteCampania)
}
class InsumoDao {
  <<Repository>>
  +existsById(idInsumo : Integer) Boolean
  +getOne(idInsumo : Integer) Insumo
}
class LoteCampania {
  -idLoteCampania : Integer = {@Id @GeneratedValue}
  +crearAplicacion(i : Insumo, fecha : Date, dosis : Real, unidad : String, costoHa : Real) AplicacionInsumo
  +agregarAplicacion(ap : AplicacionInsumo)
}
class AplicacionInsumo {
  -fecha : Date
  -dosis : Real
  -unidad : String
  -costoHa : Real
  +create(i : Insumo, fecha : Date, dosis : Real, unidad : String, costoHa : Real)
  +getCostoHa() Real
}
class Insumo {
  -idInsumo : Integer = {@Id @GeneratedValue}
  -unidadesAdmitidas : String[*]
  +admiteUnidad(unidad : String) Boolean
}
class Lote {
  -idLote : Integer = {@Id @GeneratedValue}
}
class Campania {
  -idCampania : Integer = {@Id @GeneratedValue}
}
ControladorRegistrarAplicacion "*" --> "0..1 -lcDao" LoteCampaniaDao
ControladorRegistrarAplicacion "*" --> "0..1 -iDao" InsumoDao
ControladorRegistrarAplicacion "*" --> "0..1 -lcActual" LoteCampania
ControladorRegistrarAplicacion "1" --> "0..1 -aplicacionActual" AplicacionInsumo
ControladorRegistrarAplicacion ..> Insumo
LoteCampaniaDao ..> LoteCampania
InsumoDao ..> Insumo
LoteCampania ..> Insumo
LoteCampania "*" --> "1 -lote" Lote
LoteCampania "*" --> "1 -campania" Campania
LoteCampania "1" *--> "* -aplicaciones" AplicacionInsumo
AplicacionInsumo "*" --> "1 -insumo" Insumo
`
});
