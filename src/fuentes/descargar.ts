import fs from "node:fs/promises";
import { httpClient } from "../lib/http.js";

// Descarga los archivos "crudos" de fuentes que se publican como archivo
// completo (no hace falta scrapear). La base los carga desde data/raw/ en
// docker/postgres/init/04_carga_magyp_noaa.sql, así que después de correr
// esto hay que recrear la base con `pnpm db:reset`.

// MAGyP publica el CSV con la fecha de corte en el nombre
// (estimaciones-agricolas-2026-03.csv), así que la URL cambia en cada
// actualización. En vez de hardcodearla se pide a la API CKAN del portal
// la URL vigente del recurso.
const MAGYP_PACKAGE_URL =
  "https://datos.magyp.gob.ar/api/3/action/package_show?id=estimaciones-agricolas";
const MAGYP_RESOURCE_NAME = /^estimaciones agr/i;

// Tabla ONI de NOAA CPC: texto plano, una fila por trimestre móvil desde 1950.
const NOAA_ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt";

// Georef (gobierno nacional): departamentos con código INDEC y centroide.
// Hay 529, así que con max=1000 entran en una sola página.
const GEOREF_DEPARTAMENTOS_URL =
  "https://apis.datos.gob.ar/georef/api/departamentos?max=1000&campos=id,nombre,provincia.id,centroide";

// Pronóstico probabilístico oficial NOAA CPC/IRI (Niña / Neutral / Niño para
// los próximos 9 trimestres). No hay archivo de datos: la tabla está en el
// HTML de la página (id="probabilities-table").
const NOAA_PRONOSTICO_URL = "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/";
const TRIMESTRES = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"];
const MESES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function pronosticoEnso(destino: string) {
  const { data: html } = await httpClient.get<string>(NOAA_PRONOSTICO_URL);
  const emision = html.match(/Issued (\w+) (\d{4})/);
  const tabla = html.match(/<table id="probabilities-table">([\s\S]*?)<\/table>/);
  if (!emision || !tabla) throw new Error("No se encontró la tabla de probabilidades de NOAA");
  const mesEmision = MESES_EN.indexOf(emision[1]) + 1;
  let anio = Number(emision[2]);

  const filas = ["emitido,anio,trimestre,prob_nina_pct,prob_neutral_pct,prob_nino_pct"];
  let mesAnterior = 0;
  for (const [, trimestre, nina, neutral, nino] of tabla[1].matchAll(
    /<abbr>(\w{3})[\s\S]*?<\/abbr><\/th><td>(\d+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td>/g
  )) {
    // Igual que en el archivo ONI, el trimestre se rotula con el año de su mes del medio
    const mesMedio = TRIMESTRES.indexOf(trimestre) + 1;
    if (mesAnterior && mesMedio < mesAnterior) anio++;
    mesAnterior = mesMedio;
    filas.push([`${emision[2]}-${String(mesEmision).padStart(2, "0")}-01`, anio, trimestre, nina, neutral, nino].join(","));
  }
  // Se conservan las emisiones anteriores ya guardadas: sirven para medir qué tan bien pronostica NOAA
  const emitido = filas[1]?.split(",")[0];
  const anteriores = await fs.readFile(destino, "utf-8")
    .then((t) => t.split(/\r?\n/).slice(1).filter((l) => l && !l.startsWith(`${emitido},`)))
    .catch(() => [] as string[]);
  await fs.writeFile(destino, [filas[0], ...anteriores, ...filas.slice(1)].join("\n") + "\n", "utf-8");
  console.log(`- ${destino} (${filas.length - 1} trimestres, emitido ${emision[1]} ${emision[2]}; ${anteriores.length} filas de emisiones anteriores)`);
}

type CkanPackage = {
  result: { resources: { name: string; format: string; url: string }[] };
};

async function descargar(url: string, destino: string) {
  const response = await httpClient.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 120_000,
  });
  await fs.writeFile(destino, Buffer.from(response.data));
  console.log(`- ${destino} (${(response.data.byteLength / 1024).toFixed(0)} KB) ← ${url}`);
}

async function main() {
  await fs.mkdir("data/raw", { recursive: true });

  const { data } = await httpClient.get<CkanPackage>(MAGYP_PACKAGE_URL);
  const recurso = data.result.resources.find(
    (r) => r.format.toUpperCase() === "CSV" && MAGYP_RESOURCE_NAME.test(r.name)
  );
  if (!recurso) throw new Error("No se encontró el CSV de estimaciones agrícolas en MAGyP");
  await descargar(recurso.url, "data/raw/magyp-estimaciones-agricolas.csv");

  await descargar(NOAA_ONI_URL, "data/raw/noaa-oni.txt");

  await descargar(GEOREF_DEPARTAMENTOS_URL, "data/raw/georef-departamentos.json");

  await pronosticoEnso("data/raw/noaa-enso-pronostico.csv");
}

main().catch((error: unknown) => {
  console.error("Error descargando fuentes:", error);
  process.exitCode = 1;
});
