// Variante MVC + capa de servicios: el controlador solo recibe el evento de la UI y delega en un
// «Service» por caso de uso, que coordina DAO y dominio y conserva los objetos de la conversación.
(function () {
  const primitivos = new Set(['String', 'Integer', 'Real', 'Boolean', 'Date']);

  function dsdConServicio(code, servicio) {
    const lines = code.trim().replace(/«Service»/g, '«Adapter»').split('\n');
    let ultimoRetorno = -1, primero = true;
    lines.forEach((l, i) => { if (/^\s*C-->>-UI:/.test(l)) ultimoRetorno = i; });
    const out = [];
    lines.forEach((l, i) => {
      if (/^participant C as /.test(l)) {
        out.push(l, 'participant SV as sv:«Service» ' + servicio);
      } else if (primero && /^\s*UI->>\+C: /.test(l)) {
        primero = false;
        out.push(l, l.replace('UI->>+C:', 'C->>+SV:'));
      } else if (i === ultimoRetorno) {
        out.push(l.replace('C-->>-UI:', 'SV-->>-C:'), l);
      } else {
        out.push(l.replace(/^(\s*)C(-{1,2}>>)/, '$1SV$2')
                  .replace(/(>>[+-]?)C:/, '$1SV:')
                  .replace(/^(\s*Note over )C(,|:)/, '$1SV$2'));
      }
    });
    return out.join('\n');
  }

  function dcdConServicio(code, controlador, servicio) {
    const L = code.trim().replace(/<<Service>>/g, '<<Adapter>>').split('\n');
    const ini = L.findIndex(l => l.trim() === 'class ' + controlador + ' {');
    const fin = L.indexOf('}', ini);
    const cuerpo = L.slice(ini + 1, fin);
    const atributos = cuerpo.filter(l => /^\s*-/.test(l));
    const metodos = cuerpo.filter(l => /^\s*\+/.test(l));
    // Las asociaciones y dependencias del controlador (DAO, adaptadores, objetos de la conversación) pasan al servicio
    const resto = L.slice(fin + 1).map(l => l.startsWith(controlador + ' ') ? servicio + l.slice(controlador.length) : l);
    const retornos = [...new Set(metodos.map(m => (m.match(/\)\s*([A-Za-z]+)(\[\*\])?\s*$/) || [])[1])
      .filter(t => t && !primitivos.has(t)))];
    return [
      'classDiagram',
      'class ' + controlador + ' {', ...metodos, '}',
      'class ' + servicio + ' {', '  <<Service>>', ...atributos, ...metodos, '}',
      ...L.slice(1, ini),
      ...resto,
      controlador + ' "1" --> "1 -servicio" ' + servicio,
      ...retornos.map(t => controlador + ' ..> ' + t)
    ].join('\n');
  }

  window.CU.forEach(cu => {
    const servicio = cu.controlador.replace(/^Controlador/, 'Servicio');
    cu.servicio = servicio;
    cu.dsd.forEach(d => { d.code = dsdConServicio(d.code, servicio); });
    cu.dcd = dcdConServicio(cu.dcd, cu.controlador, servicio);
    cu.supuestos = [
      'Capa de servicios: ' + cu.controlador + ' solo recibe el evento de la UI y delega en ' + servicio +
      ' («Service»), que contiene la lógica del caso de uso: coordina los DAO y los objetos de dominio y decide el resultado. ' +
      'El servicio tiene alcance de sesión, por eso conserva los objetos de la conversación entre eventos.',
      ...cu.supuestos.map(s => s
        .replace(/«Service»/g, '«Adapter»')
        .replace(/del controlador/g, 'del servicio')
        .replace(/el controlador/g, 'el servicio')
        .replace(/El controlador/g, 'El servicio')
        .replace(/desde la Clase Controladora/g, 'desde el servicio'))
    ];
  });
  window.VARIANTE = 'MVC + capa de servicios';
})();
