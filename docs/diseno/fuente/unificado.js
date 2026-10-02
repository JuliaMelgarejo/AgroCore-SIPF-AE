// Une los DCD de todos los casos de uso en un único diagrama de clases
window.unificar = function () {
  const clases = new Map();     // nombre -> { estereotipo, atributos: Map, metodos: Map }
  const relaciones = new Map(); // clave -> { a, ma, tipo, mb, b }
  const clase = n => {
    if (!clases.has(n)) clases.set(n, { estereotipo: '', atributos: new Map(), metodos: new Map() });
    return clases.get(n);
  };
  const rol = m => (m.match(/-\w+/) || [''])[0];

  window.CU.forEach(cu => {
    let actual = null;
    cu.dcd.split('\n').forEach(raw => {
      const l = raw.trim();
      let m;
      if (actual) {
        if (l === '}') { actual = null; return; }
        if ((m = l.match(/^<<(\w+)>>$/))) { actual.estereotipo = m[1]; return; }
        if ((m = l.match(/^[+\-#](\w+)\((.*)\)/))) {
          // Mismo método = mismo nombre y mismos tipos de parámetros
          const tipos = m[2].split(',').map(p => (p.split(':')[1] || '').trim()).join(',');
          const k = m[1] + '(' + tipos + ')';
          if (!actual.metodos.has(k)) actual.metodos.set(k, l);
        } else if ((m = l.match(/^[+\-#](\w+)\s*:/))) {
          if (!actual.atributos.has(m[1])) actual.atributos.set(m[1], l);
        }
        return;
      }
      if ((m = l.match(/^class (\w+) \{$/))) { actual = clase(m[1]); return; }
      if ((m = l.match(/^class (\w+)$/))) { clase(m[1]); return; }
      if ((m = l.match(/^(\w+) (?:"([^"]*)" )?(\*-->|-->|\.\.>) (?:"([^"]*)" )?(\w+)$/))) {
        const r = { a: m[1], ma: m[2] || '', tipo: m[3], mb: m[4] || '', b: m[5] };
        clase(r.a); clase(r.b);
        const k = r.tipo === '..>' ? r.a + '..>' + r.b : r.a + '>' + r.b + rol(r.mb);
        if (!relaciones.has(k)) relaciones.set(k, r);
      }
    });
  });

  // Una dependencia sobra si ya existe una asociación entre las mismas clases
  const asociadas = new Set([...relaciones.values()].filter(r => r.tipo !== '..>').map(r => r.a + '>' + r.b));
  const rels = [...relaciones.values()].filter(r => r.tipo !== '..>' || !asociadas.has(r.a + '>' + r.b));

  const capaDe = (n, c) => n.startsWith('Controlador') ? 'Controladores'
    : c.estereotipo === 'Service' ? (window.VARIANTE ? 'Servicios' : 'Adaptadores') // sin capa de servicios, «Service» son los sistemas externos
    : c.estereotipo === 'Repository' ? 'DAO'
    : c.estereotipo === 'Adapter' ? 'Adaptadores' : 'Dominio';
  const capas = { Controladores: [], Servicios: [], DAO: [], Adaptadores: [], Dominio: [] };
  clases.forEach((c, n) => capas[capaDe(n, c)].push(n));

  const pintarClase = (n, sangria) => {
    const c = clases.get(n);
    const cuerpo = [...(c.estereotipo ? ['<<' + c.estereotipo + '>>'] : []), ...c.atributos.values(), ...c.metodos.values()];
    if (!cuerpo.length) return [sangria + 'class ' + n];
    return [sangria + 'class ' + n + ' {', ...cuerpo.map(x => sangria + '  ' + x), sangria + '}'];
  };
  const pintarRel = r => r.a + (r.ma ? ' "' + r.ma + '"' : '') + ' ' + r.tipo + (r.mb ? ' "' + r.mb + '"' : '') + ' ' + r.b;

  const dominio = new Set(capas.Dominio);
  const dcdDominio = ['classDiagram',
    ...capas.Dominio.flatMap(n => pintarClase(n, '')),
    ...rels.filter(r => dominio.has(r.a) && dominio.has(r.b)).map(pintarRel)].join('\n');

  // De izquierda a derecha quedan las capas en columnas: controladores, servicios, DAO y dominio
  const dcdCompleto = ['classDiagram', 'direction LR',
    ...Object.keys(capas).flatMap(k => capas[k].flatMap(n => pintarClase(n, ''))),
    ...rels.map(pintarRel)].join('\n');

  const n = k => capas[k].length;
  window.CU.push({
    id: 'DCD', nombre: 'Diagrama de clases unificado', unificado: true,
    meta: clases.size + ' clases · ' + rels.length + ' relaciones · une los DCD de ' + window.CU.length + ' casos de uso',
    supuestos: [
      'Se generó uniendo los DCD de todos los casos de uso: cada clase aparece una sola vez con la suma de los atributos y métodos que usa algún DSD.',
      'Capas: ' + n('Controladores') + ' controladores, ' + (n('Servicios') ? n('Servicios') + ' servicios, ' : '') + n('DAO') + ' DAO, ' +
        n('Adaptadores') + ' adaptadores de sistemas externos y ' + n('Dominio') + ' clases de dominio.',
      'Si dos casos de uso declaran la misma asociación (mismas clases y mismo rol) se conserva una sola. Una dependencia se omite cuando ya existe una asociación entre esas clases.',
      'El diagrama completo es muy grande y se lee por columnas (controladores a la izquierda, dominio a la derecha): conviene descargarlo en SVG y hacer zoom. El del dominio es el que resume el modelo.'
    ],
    bloques: [
      { titulo: 'DCD unificado · Dominio', code: dcdDominio, file: 'DCD_unificado_dominio' },
      { titulo: 'DCD unificado · Completo (controladores, servicios, DAO, adaptadores y dominio)', code: dcdCompleto, file: 'DCD_unificado_completo' }
    ]
  });
};
