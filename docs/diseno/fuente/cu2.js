window.CU.push({
  id: 'CUU08',
  nombre: 'Registrar un establecimiento productivo',
  controlador: 'ControladorRegistrarEstablecimiento',
  supuestos: [
    'El usuario ya está autenticado (precondición): el controlador lo conoce por la asociación con rol usuarioLogueado, sin buscarlo en un DAO.',
    'La validación de campos obligatorios vacíos es responsabilidad de la UI (vista); el controlador valida la existencia del departamento.'
  ],
  dsd: [
    { titulo: 'Evento 1 – iniciarRegistro', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarEstablecimiento
participant DD as dDao:«Repository» DepartamentoDao
participant DS as departamentos[i]:Departamento
Note over UI: UI recibe del actor: ""
UI->>+C: iniciarRegistro()
C->>+DD: findAll()
DD-->>-C: «departamentos : Departamento[*]»
C-->>-UI: «departamentos : Departamento[*]»
loop Para cada d en departamentos
  UI->>+DS: getIdDepartamento()
  DS-->>-UI: «idDepartamento : Integer»
  UI->>+DS: getNombre()
  DS-->>-UI: «nombre : String»
end
Note over UI: UI muestra al actor: idDepartamento + nombre de cada departamento
` },
    { titulo: 'Evento 2 – registrarEstablecimiento', code: `
sequenceDiagram
participant UI as :UI
participant C as c:ControladorRegistrarEstablecimiento
participant DD as dDao:«Repository» DepartamentoDao
participant ED as eDao:«Repository» EstablecimientoDao
Note over UI: UI recibe del actor: nombre + idDepartamento
UI->>+C: registrarEstablecimiento(nombre : String, idDepartamento : Integer)
C->>+DD: existsById(idDepartamento : Integer)
DD-->>-C: «existe : Boolean»
opt existe == true
  C->>+DD: getOne(idDepartamento : Integer)
  DD-->>-C: «d : Departamento»
  create participant E as e:Establecimiento
  C-->>E: create(nombre : String, d : Departamento, usuarioLogueado : Usuario)
  C->>+ED: save(e : Establecimiento)
  ED-->>-C:
end
C-->>-UI: «e : Establecimiento»
alt e IS NOT NULL
  UI->>+E: getIdEstablecimiento()
  E-->>-UI: «idEstablecimiento : Integer»
  Note over UI: UI muestra al actor: idEstablecimiento
else e IS NULL
  Note over UI: UI muestra al actor: "El departamento no existe, corrija los datos"
end
` }
  ],
  dcd: `
classDiagram
class ControladorRegistrarEstablecimiento {
  +iniciarRegistro() Departamento[*]
  +registrarEstablecimiento(nombre : String, idDepartamento : Integer) Establecimiento
}
class DepartamentoDao {
  <<Repository>>
  +findAll() Departamento[*]
  +existsById(idDepartamento : Integer) Boolean
  +getOne(idDepartamento : Integer) Departamento
}
class EstablecimientoDao {
  <<Repository>>
  +save(e : Establecimiento)
}
class Establecimiento {
  -idEstablecimiento : Integer = {@Id @GeneratedValue}
  -nombre : String
  +create(nombre : String, d : Departamento, u : Usuario)
  +getIdEstablecimiento() Integer
}
class Departamento {
  -idDepartamento : Integer = {@Id}
  -nombre : String
  +getIdDepartamento() Integer
  +getNombre() String
}
class Usuario
ControladorRegistrarEstablecimiento "*" --> "0..1 -dDao" DepartamentoDao
ControladorRegistrarEstablecimiento "*" --> "0..1 -eDao" EstablecimientoDao
ControladorRegistrarEstablecimiento "*" --> "0..1 -usuarioLogueado" Usuario
ControladorRegistrarEstablecimiento ..> Establecimiento
ControladorRegistrarEstablecimiento ..> Departamento
DepartamentoDao ..> Departamento
EstablecimientoDao ..> Establecimiento
Establecimiento "*" --> "1 -departamento" Departamento
Establecimiento "*" --> "1 -usuario" Usuario
`
});
