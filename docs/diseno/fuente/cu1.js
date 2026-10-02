// CUU01 a CUU07 – Acceso, suscripciones y campañas
window.CU.push({
  id: 'CUU01', nombre: 'Iniciar sesión', controlador: 'ControladorIniciarSesion',
  supuestos: [
    'La credencial obligatoria faltante (2.a) la valida la UI antes de enviar el evento.',
    'El controlador deja disponible para la vista el objeto usuarioLogueado (model de Spring MVC); la UI le pide las prestaciones para mostrarlas.',
    'El envío del correo de restablecimiento (2.c.2) se delega a un servicio de infraestructura que no se modela.'
  ],
  dsd: [
    { titulo: 'Evento 1 – iniciarSesion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorIniciarSesion
participant UD as uDao:«Repository» UsuarioDao
participant U as u:Usuario
participant S as suscripcionActual:Suscripcion
participant P as plan:Plan
Note over UI: UI recibe del actor: email + password
UI->>+C: iniciarSesion(email : String, password : String)
C->>+UD: buscarPorEmail(email : String)
Note right of UD: JPQL: SELECT u FROM Usuario u WHERE u.email = ?1
UD-->>-C: «u : Usuario»
Note over C: respuesta = "No se puede autenticar al usuario"
opt u IS NOT NULL
  C->>+U: validarAcceso(password : String)
  Note right of U: accesoValido = (this.password == password) AND (estado == "habilitada")
  U-->>-C: «accesoValido : Boolean»
  alt accesoValido == true
    C->>+U: tieneSuscripcionVigente()
    U->>+S: estaVigente()
    Note right of S: vigente = (estado == "activa") AND (fechaFin >= date())
    S-->>-U: «vigente : Boolean»
    U-->>-C: «vigente : Boolean»
    alt vigente == true
      Note over C: usuarioLogueado = u. respuesta = "Sesión iniciada"
    else vigente == false
      Note over C: respuesta = "Suscripción vencida o cancelada: puede contratar o cambiar de plan"
    end
  else accesoValido == false
    C->>+U: getEstado()
    U-->>-C: «estado : String»
    Note over C: respuesta = "Credenciales inválidas" o "Cuenta inhabilitada: canales de asistencia", según estado
  end
end
C-->>-UI: «respuesta : String»
opt respuesta == "Sesión iniciada"
  UI->>+U: getPrestacionesHabilitadas()
  U->>+S: getPrestaciones()
  S->>+P: getPrestaciones()
  P-->>-S: «prestaciones : String[*]»
  S-->>-U: «prestaciones : String[*]»
  U-->>-UI: «prestaciones : String[*]»
end
Note over UI: UI muestra al actor: respuesta + prestaciones
` },
    { titulo: 'Evento 2 – solicitarRestablecimiento (alternativa 2.c)', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorIniciarSesion
participant UD as uDao:«Repository» UsuarioDao
participant U as u:Usuario
Note over UI: UI recibe del actor: email
UI->>+C: solicitarRestablecimiento(email : String)
C->>+UD: buscarPorEmail(email : String)
UD-->>-C: «u : Usuario»
opt u IS NOT NULL
  C->>+U: generarTokenRestablecimiento()
  Note right of U: tokenRestablecimiento = nuevo token, vencimientoToken = date() + 1 día
  U-->>-C: «token : String»
  C->>+UD: save(u : Usuario)
  UD-->>-C:
end
C-->>-UI: «token : String»
Note over UI: UI muestra al actor: "Se enviaron las instrucciones al correo informado"
` },
    { titulo: 'Evento 3 – establecerNuevaPassword (alternativa 2.c)', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorIniciarSesion
participant UD as uDao:«Repository» UsuarioDao
participant U as u:Usuario
Note over UI: UI recibe del actor: token + nuevaPassword
UI->>+C: establecerNuevaPassword(token : String, nuevaPassword : String)
C->>+UD: buscarPorToken(token : String)
Note right of UD: JPQL: SELECT u FROM Usuario u WHERE u.tokenRestablecimiento = ?1
UD-->>-C: «u : Usuario»
Note over C: cambiada = false
opt u IS NOT NULL
  C->>+U: cambiarPassword(token : String, nuevaPassword : String)
  Note right of U: Si vencimientoToken >= date(): password = nuevaPassword, tokenRestablecimiento = NULL
  U-->>-C: «cambiada : Boolean»
  opt cambiada == true
    C->>+UD: save(u : Usuario)
    UD-->>-C:
  end
end
C-->>-UI: «cambiada : Boolean»
Note over UI: UI muestra al actor: resultado y reinicia la autenticación (Evento 1)
` }
  ],
  dcd: `
classDiagram
class ControladorIniciarSesion {
  +iniciarSesion(email : String, password : String) String
  +solicitarRestablecimiento(email : String) String
  +establecerNuevaPassword(token : String, nuevaPassword : String) Boolean
}
class UsuarioDao {
  <<Repository>>
  +buscarPorEmail(email : String) Usuario
  +buscarPorToken(token : String) Usuario
  +save(u : Usuario)
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  -email : String
  -password : String
  -estado : String
  -tokenRestablecimiento : String
  -vencimientoToken : Date
  +validarAcceso(password : String) Boolean
  +getEstado() String
  +tieneSuscripcionVigente() Boolean
  +getPrestacionesHabilitadas() String[*]
  +generarTokenRestablecimiento() String
  +cambiarPassword(token : String, nuevaPassword : String) Boolean
}
class Suscripcion {
  -estado : String
  -fechaFin : Date
  +estaVigente() Boolean
  +getPrestaciones() String[*]
}
class Plan {
  -prestaciones : String[*]
  +getPrestaciones() String[*]
}
ControladorIniciarSesion "*" --> "0..1 -uDao" UsuarioDao
ControladorIniciarSesion "*" --> "0..1 -usuarioLogueado" Usuario
UsuarioDao ..> Usuario
Usuario "1" *--> "0..1 -suscripcionActual" Suscripcion
Suscripcion "*" --> "1 -plan" Plan
`
});

window.CU.push({
  id: 'CUU02', nombre: 'Registrarse', controlador: 'ControladorRegistrarse',
  supuestos: [
    'La pasarela de pagos es un sistema externo: se accede mediante la interfaz «Service» PasarelaPago, que devuelve un ResultadoPago (estado: confirmado, rechazado o pendiente).',
    'Si la pasarela no confirma (4.b), la cuenta y la suscripción se guardan en estado "pendiente" para conciliar luego esa misma operación; no se genera otro cobro.',
    'El contador de usuarios activos por plan se obtiene por consulta (no se almacena como atributo).'
  ],
  dsd: [
    { titulo: 'Evento 1 – ingresarDatosRegistro', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarse
participant UD as uDao:«Repository» UsuarioDao
participant PD as pDao:«Repository» PlanDao
Note over UI: UI recibe del actor: nombre + email + password + aceptación de condiciones
UI->>+C: ingresarDatosRegistro(nombre : String, email : String, password : String)
C->>+UD: buscarPorEmail(email : String)
Note right of UD: JPQL: SELECT u FROM Usuario u WHERE u.email = ?1
UD-->>-C: «existente : Usuario»
opt existente IS NULL
  create participant NU as nuevoUsuario:Usuario
  C-->>NU: create(nombre : String, email : String, password : String)
  Note right of NU: estado = "pendiente", fechaAceptacion = date()
  C->>+PD: findAll()
  PD-->>-C: «planes : Plan[*]»
end
C-->>-UI: «planes : Plan[*]»
participant PL as planes[i]:Plan
alt planes IS NOT NULL
  loop Para cada p en planes
    UI->>+PL: getIdPlan()
    PL-->>-UI: «idPlan : Integer»
    UI->>+PL: getNombre()
    PL-->>-UI: «nombre : String»
    UI->>+PL: getPrecio()
    PL-->>-UI: «precio : Real»
  end
  Note over UI: UI muestra al actor: idPlan + nombre + precio de cada plan
else planes IS NULL
  Note over UI: UI muestra al actor: "Ya existe una cuenta equivalente"
end
` },
    { titulo: 'Evento 2 – seleccionarPlan', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarse
participant PD as pDao:«Repository» PlanDao
participant PS as planSeleccionado:Plan
Note over UI: UI recibe del actor: idPlan
UI->>+C: seleccionarPlan(idPlan : Integer)
C->>+PD: getOne(idPlan : Integer)
PD-->>-C: «planSeleccionado : Plan»
C-->>-UI: «planSeleccionado : Plan»
UI->>+PS: getPrecio()
PS-->>-UI: «precio : Real»
Note over UI: UI muestra al actor: precio a pagar
` },
    { titulo: 'Evento 3 – autorizarPago', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarse
participant PS as planSeleccionado:Plan
participant PP as pasarela:«Service» PasarelaPago
participant RP as res:ResultadoPago
participant NU as nuevoUsuario:Usuario
Note over UI: UI recibe del actor: datosMedioPago
UI->>+C: autorizarPago(datosMedioPago : String)
C->>+PS: getPrecio()
PS-->>-C: «precio : Real»
C->>+PP: solicitarPago(precio : Real, datosMedioPago : String)
PP-->>-C: «res : ResultadoPago»
C->>+RP: getEstado()
RP-->>-C: «estadoPago : String»
alt estadoPago == "rechazado"
  Note over C: respuesta = "Pago rechazado: puede autorizar otro medio de pago"
else estadoPago != "rechazado"
  C->>+NU: suscribir(planSeleccionado : Plan, res : ResultadoPago)
  create participant S as s:Suscripcion
  NU-->>S: create(planSeleccionado : Plan, res : ResultadoPago)
  Note right of S: estado = "activa" si el pago está confirmado, "pendiente" si no hubo confirmación
  create participant PGS as «multiobjeto» pagos:Pago
  S-->>PGS: create()
  create participant PG as pg:Pago
  S-->>PG: create(precio : Real, res : ResultadoPago)
  S->>+PGS: add(pg : Pago)
  PGS-->>-S:
  Note right of NU: suscripcionActual = s, estado = "habilitada" si s está activa
  NU-->>-C:
  participant UD as uDao:«Repository» UsuarioDao
  C->>+UD: save(nuevoUsuario : Usuario)
  UD-->>-C:
  Note over C: respuesta = "Cuenta habilitada" u "Operación pendiente de confirmación"
end
C-->>-UI: «respuesta : String»
Note over UI: UI muestra al actor: respuesta
` }
  ],
  dcd: `
classDiagram
class ControladorRegistrarse {
  +ingresarDatosRegistro(nombre : String, email : String, password : String) Plan[*]
  +seleccionarPlan(idPlan : Integer) Plan
  +autorizarPago(datosMedioPago : String) String
}
class UsuarioDao {
  <<Repository>>
  +buscarPorEmail(email : String) Usuario
  +save(u : Usuario)
}
class PlanDao {
  <<Repository>>
  +findAll() Plan[*]
  +getOne(idPlan : Integer) Plan
}
class PasarelaPago {
  <<Service>>
  +solicitarPago(monto : Real, datosMedioPago : String) ResultadoPago
}
class ResultadoPago {
  -estado : String
  -referencia : String
  +getEstado() String
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  -nombre : String
  -email : String
  -password : String
  -estado : String
  -fechaAceptacion : Date
  +create(nombre : String, email : String, password : String)
  +suscribir(p : Plan, res : ResultadoPago)
}
class Suscripcion {
  -estado : String
  -fechaInicio : Date
  +create(p : Plan, res : ResultadoPago)
}
class Pago {
  -monto : Real
  -fecha : Date
  -estado : String
  -referencia : String
  +create(monto : Real, res : ResultadoPago)
}
class Plan {
  -idPlan : Integer = {@Id @GeneratedValue}
  -nombre : String
  -precio : Real
  +getIdPlan() Integer
  +getNombre() String
  +getPrecio() Real
}
ControladorRegistrarse "*" --> "0..1 -uDao" UsuarioDao
ControladorRegistrarse "*" --> "0..1 -pDao" PlanDao
ControladorRegistrarse "*" --> "0..1 -pasarela" PasarelaPago
ControladorRegistrarse "1" --> "0..1 -nuevoUsuario" Usuario
ControladorRegistrarse "*" --> "0..1 -planSeleccionado" Plan
ControladorRegistrarse ..> ResultadoPago
PasarelaPago ..> ResultadoPago
UsuarioDao ..> Usuario
PlanDao ..> Plan
Usuario ..> ResultadoPago
Usuario "1" *--> "0..1 -suscripcionActual" Suscripcion
Suscripcion "*" --> "1 -plan" Plan
Suscripcion "1" *--> "1..* -pagos" Pago
`
});

window.CU.push({
  id: 'CUU03', nombre: 'Cambiar de plan', controlador: 'ControladorCambiarPlan',
  supuestos: [
    'El usuario está autenticado: el controlador lo conoce por el rol usuarioLogueado.',
    'El efecto económico (ajuste) lo calcula la Suscripcion comparando el precio del plan actual con el nuevo. Si el ajuste es 0 o negativo no se solicita pago.',
    'ajuste y nuevoPlan se guardan como variables de instancia del controlador porque se usan en el evento siguiente.'
  ],
  dsd: [
    { titulo: 'Evento 1 – consultarPlanes', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorCambiarPlan
participant PD as pDao:«Repository» PlanDao
participant PL as planes[i]:Plan
Note over UI: UI recibe del actor: ""
UI->>+C: consultarPlanes()
C->>+PD: findAll()
PD-->>-C: «planes : Plan[*]»
C-->>-UI: «planes : Plan[*]»
loop Para cada p en planes
  UI->>+PL: getIdPlan()
  PL-->>-UI: «idPlan : Integer»
  UI->>+PL: getNombre()
  PL-->>-UI: «nombre : String»
  UI->>+PL: getPrestaciones()
  PL-->>-UI: «prestaciones : String[*]»
  UI->>+PL: getPrecio()
  PL-->>-UI: «precio : Real»
end
Note over UI: UI muestra al actor: idPlan + nombre + prestaciones + precio de cada plan
` },
    { titulo: 'Evento 2 – seleccionarPlan', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorCambiarPlan
participant PD as pDao:«Repository» PlanDao
participant U as usuarioLogueado:Usuario
participant S as suscripcionActual:Suscripcion
participant PA as plan:Plan
participant NP as nuevoPlan:Plan
Note over UI: UI recibe del actor: idPlan
UI->>+C: seleccionarPlan(idPlan : Integer)
C->>+PD: getOne(idPlan : Integer)
PD-->>-C: «nuevoPlan : Plan»
C->>+U: calcularAjusteCambio(nuevoPlan : Plan)
U->>+S: calcularAjuste(nuevoPlan : Plan)
alt nuevoPlan != plan
  S->>+PA: getPrecio()
  PA-->>-S: «precioActual : Real»
  S->>+NP: getPrecio()
  NP-->>-S: «precioNuevo : Real»
  Note right of S: ajuste = precioNuevo - precioActual
else nuevoPlan == plan
  Note right of S: ajuste = NULL (la suscripción no requiere cambios)
end
S-->>-U: «ajuste : Real»
U-->>-C: «ajuste : Real»
C-->>-UI: «ajuste : Real»
Note over UI: UI muestra al actor: ajuste a pagar, o "Ya posee ese plan" si ajuste IS NULL
` },
    { titulo: 'Evento 3 – confirmarCambio', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorCambiarPlan
participant PP as pasarela:«Service» PasarelaPago
participant RP as res:ResultadoPago
participant U as usuarioLogueado:Usuario
participant S as suscripcionActual:Suscripcion
participant PGS as «multiobjeto» pagos:Pago
participant UD as uDao:«Repository» UsuarioDao
Note over UI: UI recibe del actor: datosMedioPago
UI->>+C: confirmarCambio(datosMedioPago : String)
Note over C: estadoPago = "sin cargo"
opt ajuste > 0
  C->>+PP: solicitarPago(ajuste : Real, datosMedioPago : String)
  PP-->>-C: «res : ResultadoPago»
  C->>+RP: getEstado()
  RP-->>-C: «estadoPago : String»
end
alt estadoPago == "rechazado"
  Note over C: respuesta = "Pago rechazado: se conserva el plan vigente"
else estadoPago == "pendiente"
  C->>+U: registrarCambioPendiente(nuevoPlan : Plan)
  U->>+S: registrarCambioPendiente(nuevoPlan : Plan)
  Note right of S: planPendiente = nuevoPlan (el plan vigente no cambia)
  S-->>-U:
  U-->>-C:
  C->>+UD: save(usuarioLogueado : Usuario)
  UD-->>-C:
  Note over C: respuesta = "Cambio pendiente de conciliación"
else estadoPago == "confirmado" OR estadoPago == "sin cargo"
  C->>+U: cambiarPlan(nuevoPlan : Plan, ajuste : Real)
  U->>+S: cambiarPlan(nuevoPlan : Plan, ajuste : Real)
  Note right of S: plan = nuevoPlan, fechaCambio = date()
  opt ajuste > 0
    create participant PG as pg:Pago
    S-->>PG: create(ajuste : Real)
    S->>+PGS: add(pg : Pago)
    PGS-->>-S:
  end
  S-->>-U:
  U-->>-C:
  C->>+UD: save(usuarioLogueado : Usuario)
  UD-->>-C:
  Note over C: respuesta = "Plan actualizado"
end
C-->>-UI: «respuesta : String»
Note over UI: UI muestra al actor: respuesta + nuevo plan y prestaciones habilitadas
` }
  ],
  dcd: `
classDiagram
class ControladorCambiarPlan {
  -ajuste : Real
  +consultarPlanes() Plan[*]
  +seleccionarPlan(idPlan : Integer) Real
  +confirmarCambio(datosMedioPago : String) String
}
class PlanDao {
  <<Repository>>
  +findAll() Plan[*]
  +getOne(idPlan : Integer) Plan
}
class UsuarioDao {
  <<Repository>>
  +save(u : Usuario)
}
class PasarelaPago {
  <<Service>>
  +solicitarPago(monto : Real, datosMedioPago : String) ResultadoPago
}
class ResultadoPago {
  -estado : String
  +getEstado() String
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  +calcularAjusteCambio(nuevoPlan : Plan) Real
  +cambiarPlan(nuevoPlan : Plan, ajuste : Real)
  +registrarCambioPendiente(nuevoPlan : Plan)
}
class Suscripcion {
  -fechaCambio : Date
  +calcularAjuste(nuevoPlan : Plan) Real
  +cambiarPlan(nuevoPlan : Plan, ajuste : Real)
  +registrarCambioPendiente(nuevoPlan : Plan)
}
class Pago {
  -monto : Real
  -fecha : Date
  +create(monto : Real)
}
class Plan {
  -idPlan : Integer = {@Id @GeneratedValue}
  -nombre : String
  -precio : Real
  -prestaciones : String[*]
  +getIdPlan() Integer
  +getNombre() String
  +getPrestaciones() String[*]
  +getPrecio() Real
}
ControladorCambiarPlan "*" --> "0..1 -pDao" PlanDao
ControladorCambiarPlan "*" --> "0..1 -uDao" UsuarioDao
ControladorCambiarPlan "*" --> "0..1 -pasarela" PasarelaPago
ControladorCambiarPlan "*" --> "0..1 -usuarioLogueado" Usuario
ControladorCambiarPlan "*" --> "0..1 -nuevoPlan" Plan
ControladorCambiarPlan ..> ResultadoPago
PasarelaPago ..> ResultadoPago
PlanDao ..> Plan
UsuarioDao ..> Usuario
Usuario ..> Plan
Usuario "1" *--> "0..1 -suscripcionActual" Suscripcion
Suscripcion "*" --> "1 -plan" Plan
Suscripcion "*" --> "0..1 -planPendiente" Plan
Suscripcion "1" *--> "1..* -pagos" Pago
`
});

window.CU.push({
  id: 'CUU04', nombre: 'Cancelar suscripción', controlador: 'ControladorCancelarSuscripcion',
  supuestos: [
    'Si el usuario no confirma (3.a) la UI no envía el evento confirmarCancelacion y la suscripción queda sin cambios.',
    'La fecha efectiva de la cancelación es el fin del período ya abonado (fechaFin).'
  ],
  dsd: [
    { titulo: 'Evento 1 – solicitarCancelacion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorCancelarSuscripcion
participant U as usuarioLogueado:Usuario
participant S as suscripcionActual:Suscripcion
Note over UI: UI recibe del actor: ""
UI->>+C: solicitarCancelacion()
C->>+U: getFechaEfectivaCancelacion()
U->>+S: getFechaFin()
S-->>-U: «fechaFin : Date»
U-->>-C: «fechaEfectiva : Date»
C-->>-UI: «fechaEfectiva : Date»
Note over UI: UI muestra al actor: fechaEfectiva + consecuencias sobre el acceso y la renovación
` },
    { titulo: 'Evento 2 – confirmarCancelacion', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorCancelarSuscripcion
participant U as usuarioLogueado:Usuario
participant S as suscripcionActual:Suscripcion
participant UD as uDao:«Repository» UsuarioDao
Note over UI: UI recibe del actor: confirmación
UI->>+C: confirmarCancelacion()
C->>+U: cancelarSuscripcion()
U->>+S: cancelar()
Note right of S: estado = "cancelada", renovacionAutomatica = false, fechaBaja = date()
S-->>-U:
U-->>-C:
C->>+UD: save(usuarioLogueado : Usuario)
UD-->>-C:
C-->>-UI: «usuarioLogueado : Usuario»
Note over UI: UI muestra al actor: "La baja quedó registrada"
` }
  ],
  dcd: `
classDiagram
class ControladorCancelarSuscripcion {
  +solicitarCancelacion() Date
  +confirmarCancelacion() Usuario
}
class UsuarioDao {
  <<Repository>>
  +save(u : Usuario)
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  +getFechaEfectivaCancelacion() Date
  +cancelarSuscripcion()
}
class Suscripcion {
  -estado : String
  -fechaFin : Date
  -renovacionAutomatica : Boolean
  -fechaBaja : Date
  +getFechaFin() Date
  +cancelar()
}
ControladorCancelarSuscripcion "*" --> "0..1 -uDao" UsuarioDao
ControladorCancelarSuscripcion "*" --> "0..1 -usuarioLogueado" Usuario
UsuarioDao ..> Usuario
Usuario "1" *--> "0..1 -suscripcionActual" Suscripcion
`
});

window.CU.push({
  id: 'CUU05', nombre: 'Registrar una campaña agrícola', controlador: 'ControladorRegistrarCampania',
  supuestos: [
    'El límite de campañas (1 en Básico, 5 en Profesional, sin límite en Empresarial) no se escribe fijo en el DSD: es el atributo limiteCampanias de Plan (NULL = sin límite).',
    'campaniaActual se guarda como variable de instancia del controlador para persistirla recién cuando el usuario confirma (Evento 2).',
    'Los datos obligatorios incompletos (2.c) los controla la UI; las relaciones inválidas (2.d) las valida el dominio (cultivar de otra especie, lote ajeno).'
  ],
  dsd: [
    { titulo: 'Evento 1 – ingresarDatosCampania', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarCampania
participant CD as cDao:«Repository» CampaniaDao
participant AC as «multiobjeto» activas:Campania
participant U as usuarioLogueado:Usuario
participant S as suscripcionActual:Suscripcion
participant P as plan:Plan
participant LD as lDao:«Repository» LoteDao
participant ED as eDao:«Repository» EspecieDao
participant VD as cvDao:«Repository» CultivarDao
participant L as lote:Lote
participant CV as cultivar:Cultivar
Note over UI: UI recibe del actor: nombre + fechaInicio + idLote + idEspecie + idCultivar + fechaSiembra + densidad
UI->>+C: ingresarDatosCampania(nombre : String, fechaInicio : Date, idLote : Integer, idEspecie : Integer, idCultivar : Integer, fechaSiembra : Date, densidad : Real)
C->>+CD: buscarActivasPorUsuario(usuarioLogueado : Usuario)
Note right of CD: JPQL: SELECT c FROM Campania c WHERE c.usuario = ?1 AND c.estado = 'activa'
CD-->>-C: «activas : Campania[*]»
C->>+AC: size()
AC-->>-C: «cantActivas : Integer»
C->>+U: admiteNuevaCampania(cantActivas : Integer)
U->>+S: admiteNuevaCampania(cantActivas : Integer)
S->>+P: getLimiteCampanias()
P-->>-S: «limiteCampanias : Integer»
Note right of S: admite = (limiteCampanias IS NULL) OR (cantActivas < limiteCampanias)
S-->>-U: «admite : Boolean»
U-->>-C: «admite : Boolean»
opt admite == true
  C->>+LD: getOne(idLote : Integer)
  LD-->>-C: «lote : Lote»
  C->>+ED: getOne(idEspecie : Integer)
  ED-->>-C: «especie : Especie»
  C->>+VD: getOne(idCultivar : Integer)
  VD-->>-C: «cultivar : Cultivar»
  C->>+L: perteneceA(usuarioLogueado : Usuario)
  L-->>-C: «loteAccesible : Boolean»
  C->>+CV: esDeEspecie(especie : Especie)
  CV-->>-C: «compatible : Boolean»
  opt loteAccesible == true AND compatible == true
    create participant CA as campaniaActual:Campania
    C-->>CA: create(nombre : String, fechaInicio : Date, usuarioLogueado : Usuario)
    create participant LCS as «multiobjeto» lotesCampania:LoteCampania
    CA-->>LCS: create()
    C->>+CA: agregarLote(lote : Lote, especie : Especie, cultivar : Cultivar, fechaSiembra : Date, densidad : Real)
    create participant LC as lc:LoteCampania
    CA-->>LC: create(lote : Lote, especie : Especie, cultivar : Cultivar, fechaSiembra : Date, densidad : Real)
    CA->>+LCS: add(lc : LoteCampania)
    LCS-->>-CA:
    CA-->>-C:
  end
end
C-->>-UI: «campaniaActual : Campania»
Note over UI: UI muestra al actor: datos validados para confirmar. Si campaniaActual IS NULL: "Se alcanzó el límite del plan" o los datos a corregir
` },
    { titulo: 'Evento 2 – confirmarCampania', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarCampania
participant CD as cDao:«Repository» CampaniaDao
participant CA as campaniaActual:Campania
Note over UI: UI recibe del actor: confirmación
UI->>+C: confirmarCampania()
C->>+CD: save(campaniaActual : Campania)
CD-->>-C:
C-->>-UI: «campaniaActual : Campania»
UI->>+CA: getIdCampania()
CA-->>-UI: «idCampania : Integer»
Note over UI: UI muestra al actor: idCampania
` }
  ],
  dcd: `
classDiagram
class ControladorRegistrarCampania {
  +ingresarDatosCampania(nombre : String, fechaInicio : Date, idLote : Integer, idEspecie : Integer, idCultivar : Integer, fechaSiembra : Date, densidad : Real) Campania
  +confirmarCampania() Campania
}
class CampaniaDao {
  <<Repository>>
  +buscarActivasPorUsuario(u : Usuario) Campania[*]
  +save(c : Campania)
}
class LoteDao {
  <<Repository>>
  +getOne(idLote : Integer) Lote
}
class EspecieDao {
  <<Repository>>
  +getOne(idEspecie : Integer) Especie
}
class CultivarDao {
  <<Repository>>
  +getOne(idCultivar : Integer) Cultivar
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  +admiteNuevaCampania(cantActivas : Integer) Boolean
}
class Suscripcion {
  +admiteNuevaCampania(cantActivas : Integer) Boolean
}
class Plan {
  -limiteCampanias : Integer
  +getLimiteCampanias() Integer
}
class Campania {
  -idCampania : Integer = {@Id @GeneratedValue}
  -nombre : String
  -fechaInicio : Date
  -estado : String
  +create(nombre : String, fechaInicio : Date, u : Usuario)
  +agregarLote(l : Lote, e : Especie, cv : Cultivar, fechaSiembra : Date, densidad : Real)
  +getIdCampania() Integer
}
class LoteCampania {
  -fechaSiembra : Date
  -densidad : Real
  +create(l : Lote, e : Especie, cv : Cultivar, fechaSiembra : Date, densidad : Real)
}
class Lote {
  -idLote : Integer = {@Id @GeneratedValue}
  +perteneceA(u : Usuario) Boolean
}
class Especie {
  -idEspecie : Integer = {@Id @GeneratedValue}
}
class Cultivar {
  -idCultivar : Integer = {@Id @GeneratedValue}
  +esDeEspecie(e : Especie) Boolean
}
ControladorRegistrarCampania "*" --> "0..1 -cDao" CampaniaDao
ControladorRegistrarCampania "*" --> "0..1 -lDao" LoteDao
ControladorRegistrarCampania "*" --> "0..1 -eDao" EspecieDao
ControladorRegistrarCampania "*" --> "0..1 -cvDao" CultivarDao
ControladorRegistrarCampania "*" --> "0..1 -usuarioLogueado" Usuario
ControladorRegistrarCampania "1" --> "0..1 -campaniaActual" Campania
ControladorRegistrarCampania ..> Lote
ControladorRegistrarCampania ..> Especie
ControladorRegistrarCampania ..> Cultivar
CampaniaDao ..> Campania
LoteDao ..> Lote
EspecieDao ..> Especie
CultivarDao ..> Cultivar
Usuario "1" *--> "0..1 -suscripcionActual" Suscripcion
Suscripcion "*" --> "1 -plan" Plan
Campania "*" --> "1 -usuario" Usuario
Campania "1" *--> "1..* -lotesCampania" LoteCampania
LoteCampania "*" --> "1 -lote" Lote
LoteCampania "*" --> "1 -especie" Especie
LoteCampania "*" --> "1 -cultivar" Cultivar
Cultivar "*" --> "1 -especie" Especie
`
});

window.CU.push({
  id: 'CUU06', nombre: 'Consultar los resultados de una campaña', controlador: 'ControladorConsultarResultados',
  supuestos: [
    'Los resultados de una campaña son sus predicciones (simulaciones guardadas por CUU16).',
    'Los formatos de reporte habilitados son un atributo de Plan (formatosHabilitados), no un valor fijo.',
    'El Reporte no se persiste: se genera para la descarga (igual que en CUU23).'
  ],
  dsd: [
    { titulo: 'Evento 1 – consultarCampanias', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorConsultarResultados
participant CD as cDao:«Repository» CampaniaDao
participant CS as campanias[i]:Campania
Note over UI: UI recibe del actor: ""
UI->>+C: consultarCampanias()
C->>+CD: buscarPorUsuario(usuarioLogueado : Usuario)
Note right of CD: JPQL: SELECT c FROM Campania c WHERE c.usuario = ?1
CD-->>-C: «campanias : Campania[*]»
C-->>-UI: «campanias : Campania[*]»
alt campanias IS NOT EMPTY
  loop Para cada c en campanias
    UI->>+CS: getIdCampania()
    CS-->>-UI: «idCampania : Integer»
    UI->>+CS: getNombre()
    CS-->>-UI: «nombre : String»
  end
  Note over UI: UI muestra al actor: idCampania + nombre de cada campaña
else campanias IS EMPTY
  Note over UI: UI muestra al actor: "No tiene campañas registradas"
end
` },
    { titulo: 'Evento 2 – seleccionarCampania', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorConsultarResultados
participant CD as cDao:«Repository» CampaniaDao
participant PD as pdDao:«Repository» PrediccionDao
participant PS as predicciones[i]:Prediccion
Note over UI: UI recibe del actor: idCampania
UI->>+C: seleccionarCampania(idCampania : Integer)
C->>+CD: getOne(idCampania : Integer)
CD-->>-C: «campaniaActual : Campania»
C->>+PD: buscarPorCampania(campaniaActual : Campania)
Note right of PD: JPQL: SELECT p FROM Prediccion p WHERE p.loteCampania.campania = ?1
PD-->>-C: «predicciones : Prediccion[*]»
C-->>-UI: «predicciones : Prediccion[*]»
alt predicciones IS NOT EMPTY
  loop Para cada p en predicciones
    UI->>+PS: getNombreEscenario()
    PS-->>-UI: «nombreEscenario : String»
    UI->>+PS: getRendimientoP50()
    PS-->>-UI: «rendimientoP50 : Real»
    UI->>+PS: getMargen()
    PS-->>-UI: «margen : Real»
  end
  Note over UI: UI muestra al actor: nombreEscenario + rendimientoP50 + margen de cada resultado
else predicciones IS EMPTY
  Note over UI: UI muestra al actor: "La campaña no posee resultados disponibles"
end
` },
    { titulo: 'Evento 3 – solicitarReporte', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorConsultarResultados
participant U as usuarioLogueado:Usuario
participant S as suscripcionActual:Suscripcion
participant P as plan:Plan
participant FS as «multiobjeto» formatosHabilitados:String
Note over UI: UI recibe del actor: formato
UI->>+C: solicitarReporte(formato : String)
C->>+U: habilitaFormato(formato : String)
U->>+S: habilitaFormato(formato : String)
S->>+P: habilitaFormato(formato : String)
P->>+FS: contains(formato : String)
FS-->>-P: «habilitado : Boolean»
P-->>-S: «habilitado : Boolean»
S-->>-U: «habilitado : Boolean»
U-->>-C: «habilitado : Boolean»
opt habilitado == true
  create participant R as r:Reporte
  C-->>R: create(formato : String)
  Note right of R: fecha = date()
  create participant IT as «multiobjeto» resultados:Prediccion
  R-->>IT: create()
  loop Para cada p en predicciones
    C->>+R: agregarResultado(p : Prediccion)
    R->>+IT: add(p : Prediccion)
    IT-->>-R:
    R-->>-C:
  end
end
C-->>-UI: «r : Reporte»
alt r IS NOT NULL
  UI->>+R: getArchivo()
  Note right of R: Arma el archivo con entradas, resultados, unidades, fuentes y supuestos de cada resultado
  R-->>-UI: «archivo : String»
  Note over UI: UI muestra al actor: archivo para descargar
else r IS NULL
  UI->>+P: getFormatosHabilitados()
  P-->>-UI: «formatosHabilitados : String[*]»
  Note over UI: UI muestra al actor: formatos disponibles para elegir otro
end
` }
  ],
  dcd: `
classDiagram
class ControladorConsultarResultados {
  +consultarCampanias() Campania[*]
  +seleccionarCampania(idCampania : Integer) Prediccion[*]
  +solicitarReporte(formato : String) Reporte
}
class CampaniaDao {
  <<Repository>>
  +buscarPorUsuario(u : Usuario) Campania[*]
  +getOne(idCampania : Integer) Campania
}
class PrediccionDao {
  <<Repository>>
  +buscarPorCampania(c : Campania) Prediccion[*]
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  +habilitaFormato(formato : String) Boolean
}
class Suscripcion {
  +habilitaFormato(formato : String) Boolean
}
class Plan {
  -formatosHabilitados : String[*]
  +habilitaFormato(formato : String) Boolean
  +getFormatosHabilitados() String[*]
}
class Campania {
  -idCampania : Integer = {@Id @GeneratedValue}
  -nombre : String
  +getIdCampania() Integer
  +getNombre() String
}
class LoteCampania
class Prediccion {
  -idPrediccion : Integer = {@Id @GeneratedValue}
  -nombreEscenario : String
  -rendimientoP50 : Real
  -margen : Real
  +getNombreEscenario() String
  +getRendimientoP50() Real
  +getMargen() Real
}
class Reporte {
  -formato : String
  -fecha : Date
  +create(formato : String)
  +agregarResultado(p : Prediccion)
  +getArchivo() String
}
ControladorConsultarResultados "*" --> "0..1 -cDao" CampaniaDao
ControladorConsultarResultados "*" --> "0..1 -pdDao" PrediccionDao
ControladorConsultarResultados "*" --> "0..1 -usuarioLogueado" Usuario
ControladorConsultarResultados "*" --> "0..1 -campaniaActual" Campania
ControladorConsultarResultados "*" --> "* -predicciones" Prediccion
ControladorConsultarResultados ..> Reporte
CampaniaDao ..> Campania
PrediccionDao ..> Prediccion
Usuario "1" *--> "0..1 -suscripcionActual" Suscripcion
Suscripcion "*" --> "1 -plan" Plan
Campania "*" --> "1 -usuario" Usuario
Prediccion "*" --> "1 -loteCampania" LoteCampania
LoteCampania "*" --> "1 -campania" Campania
Reporte "*" --> "* -resultados" Prediccion
`
});

window.CU.push({
  id: 'CUU07', nombre: 'Contratar una suscripción', controlador: 'ControladorContratarSuscripcion',
  supuestos: [
    'La pasarela de pagos (actor secundario) se accede por la interfaz «Service» PasarelaPago.',
    'Para no duplicar cobros (5.a) se busca el Pago por la referencia que informa la pasarela antes de crear la suscripción.',
    'Pago tiene DAO propio solo por esa búsqueda específica. La suscripción y sus pagos se guardan al guardar el Usuario.'
  ],
  dsd: [
    { titulo: 'Evento 1 – consultarPlanes', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorContratarSuscripcion
participant PD as pDao:«Repository» PlanDao
participant PL as planes[i]:Plan
Note over UI: UI recibe del actor: ""
UI->>+C: consultarPlanes()
C->>+PD: findAll()
PD-->>-C: «planes : Plan[*]»
C-->>-UI: «planes : Plan[*]»
loop Para cada p en planes
  UI->>+PL: getIdPlan()
  PL-->>-UI: «idPlan : Integer»
  UI->>+PL: getPrestaciones()
  PL-->>-UI: «prestaciones : String[*]»
  UI->>+PL: getLimiteCampanias()
  PL-->>-UI: «limiteCampanias : Integer»
  UI->>+PL: getPrecio()
  PL-->>-UI: «precio : Real»
  UI->>+PL: getPeriodoFacturacion()
  PL-->>-UI: «periodoFacturacion : String»
end
Note over UI: UI muestra al actor: prestaciones + límites + precio + período de facturación de cada plan
` },
    { titulo: 'Evento 2 – contratarPlan', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorContratarSuscripcion
participant PD as pDao:«Repository» PlanDao
participant PS as planSeleccionado:Plan
participant PP as pasarela:«Service» PasarelaPago
participant RP as res:ResultadoPago
participant GD as pgDao:«Repository» PagoDao
participant U as usuarioLogueado:Usuario
participant UD as uDao:«Repository» UsuarioDao
Note over UI: UI recibe del actor: idPlan + aceptación de condiciones + datosMedioPago
UI->>+C: contratarPlan(idPlan : Integer, datosMedioPago : String)
C->>+PD: getOne(idPlan : Integer)
PD-->>-C: «planSeleccionado : Plan»
C->>+PS: getPrecio()
PS-->>-C: «precio : Real»
C->>+PP: solicitarPago(precio : Real, datosMedioPago : String)
PP-->>-C: «res : ResultadoPago»
C->>+RP: getEstado()
RP-->>-C: «estadoPago : String»
alt estadoPago == "rechazado"
  Note over C: respuesta = "Pago rechazado: la suscripción no se activa"
else estadoPago == "pendiente"
  Note over C: respuesta = "Operación pendiente: no se activa la suscripción ni se inicia otro cobro"
else estadoPago == "confirmado"
  C->>+RP: getReferencia()
  RP-->>-C: «referencia : String»
  C->>+GD: buscarPorReferencia(referencia : String)
  Note right of GD: JPQL: SELECT p FROM Pago p WHERE p.referencia = ?1
  GD-->>-C: «pagoExistente : Pago»
  opt pagoExistente IS NULL
    C->>+U: suscribir(planSeleccionado : Plan, res : ResultadoPago)
    create participant S as s:Suscripcion
    U-->>S: create(planSeleccionado : Plan, res : ResultadoPago)
    Note right of S: estado = "activa", fechaInicio = date(), fechaFin según periodoFacturacion
    create participant PGS as «multiobjeto» pagos:Pago
    S-->>PGS: create()
    create participant PG as pg:Pago
    S-->>PG: create(precio : Real, res : ResultadoPago)
    S->>+PGS: add(pg : Pago)
    PGS-->>-S:
    U-->>-C:
    C->>+UD: save(usuarioLogueado : Usuario)
    UD-->>-C:
  end
  Note over C: respuesta = "Suscripción activa" (sin duplicar el cobro si el pago ya estaba registrado)
end
C-->>-UI: «respuesta : String»
Note over UI: UI muestra al actor: respuesta + prestaciones habilitadas
` }
  ],
  dcd: `
classDiagram
class ControladorContratarSuscripcion {
  +consultarPlanes() Plan[*]
  +contratarPlan(idPlan : Integer, datosMedioPago : String) String
}
class PlanDao {
  <<Repository>>
  +findAll() Plan[*]
  +getOne(idPlan : Integer) Plan
}
class PagoDao {
  <<Repository>>
  +buscarPorReferencia(referencia : String) Pago
}
class UsuarioDao {
  <<Repository>>
  +save(u : Usuario)
}
class PasarelaPago {
  <<Service>>
  +solicitarPago(monto : Real, datosMedioPago : String) ResultadoPago
}
class ResultadoPago {
  -estado : String
  -referencia : String
  +getEstado() String
  +getReferencia() String
}
class Usuario {
  -idUsuario : Integer = {@Id @GeneratedValue}
  +suscribir(p : Plan, res : ResultadoPago)
}
class Suscripcion {
  -estado : String
  -fechaInicio : Date
  -fechaFin : Date
  +create(p : Plan, res : ResultadoPago)
}
class Pago {
  -idPago : Integer = {@Id @GeneratedValue}
  -monto : Real
  -fecha : Date
  -referencia : String
  +create(monto : Real, res : ResultadoPago)
}
class Plan {
  -idPlan : Integer = {@Id @GeneratedValue}
  -prestaciones : String[*]
  -limiteCampanias : Integer
  -precio : Real
  -periodoFacturacion : String
  +getIdPlan() Integer
  +getPrestaciones() String[*]
  +getLimiteCampanias() Integer
  +getPrecio() Real
  +getPeriodoFacturacion() String
}
ControladorContratarSuscripcion "*" --> "0..1 -pDao" PlanDao
ControladorContratarSuscripcion "*" --> "0..1 -pgDao" PagoDao
ControladorContratarSuscripcion "*" --> "0..1 -uDao" UsuarioDao
ControladorContratarSuscripcion "*" --> "0..1 -pasarela" PasarelaPago
ControladorContratarSuscripcion "*" --> "0..1 -usuarioLogueado" Usuario
ControladorContratarSuscripcion ..> Plan
ControladorContratarSuscripcion ..> ResultadoPago
ControladorContratarSuscripcion ..> Pago
PasarelaPago ..> ResultadoPago
PlanDao ..> Plan
PagoDao ..> Pago
UsuarioDao ..> Usuario
Usuario ..> ResultadoPago
Usuario "1" *--> "0..1 -suscripcionActual" Suscripcion
Suscripcion "*" --> "1 -plan" Plan
Suscripcion "1" *--> "1..* -pagos" Pago
`
});
