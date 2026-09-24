import fs from "node:fs/promises";
import axios from "axios";
import { departamentosAgricolas, esperar, type DepartamentoAgricola } from "./departamentos-agricolas.js";

// Perfil de suelo de SoilGrids 250 m (ISRIC) en el centroide de cada
// departamento agrícola: 8 propiedades × 6 profundidades (0-5 … 100-200 cm).
//
// La API pública admite ~5 consultas por minuto, y cada consulta completa
// tarda 1-2 minutos en responder. Por eso se lanzan en paralelo pero
// espaciadas (una nueva cada 13 s como mínimo): se respeta el límite y
// ~300 departamentos tardan ~1,5 horas. Un JSON por departamento en
// data/raw/soilgrids/ para poder cortar y retomar. La base lo carga en
// suelo_perfil / suelo_horizonte desde 07_carga_clima_suelo.sql.
//
// Ojo: el centroide puede caer en una ciudad o laguna, donde SoilGrids no
// tiene dato; esos perfiles quedan sin cargar.

const URL = "https://rest.isric.org/soilgrids/v2.0/properties/query";
const PROPIEDADES = ["clay", "silt", "sand", "soc", "phh2o", "cec", "bdod", "nitrogen"];
const PROFUNDIDADES = ["0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm", "100-200cm"];
const DIR = "data/raw/soilgrids";
const INTERVALO_MS = 13_000;
const EN_PARALELO = 6;

// Turnero compartido: cada consulta espera su turno, separado INTERVALO_MS del anterior
let proximoTurno = 0;
async function esperarTurno() {
  const ahora = Date.now();
  const turno = Math.max(ahora, proximoTurno);
  proximoTurno = turno + INTERVALO_MS;
  await esperar(turno - ahora);
}

async function bajar(d: DepartamentoAgricola) {
  const params = new URLSearchParams({ lon: String(d.lon), lat: String(d.lat), value: "mean" });
  PROPIEDADES.forEach((p) => params.append("property", p));
  PROFUNDIDADES.forEach((p) => params.append("depth", p));

  for (let intento = 1; ; intento++) {
    await esperarTurno();
    try {
      const { data } = await axios.get(`${URL}?${params}`, { timeout: 300_000 });
      await fs.writeFile(`${DIR}/${d.id}.json`, JSON.stringify({ departamento_id: d.id, lat: d.lat, lon: d.lon, respuesta: data }), "utf-8");
      return;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (intento >= 5) throw new Error(status ? `HTTP ${status}` : error instanceof Error ? error.message : String(error));
      await esperar(status === 429 ? 60_000 : 15_000 * intento);
    }
  }
}

async function main() {
  await fs.mkdir(DIR, { recursive: true });
  const deptos = await departamentosAgricolas();
  const hechos = new Set((await fs.readdir(DIR)).filter((f) => f.endsWith(".json")).map((f) => Number(f.slice(0, -5))));
  const cola = deptos.filter((d) => !hechos.has(d.id));
  console.log(`${deptos.length} departamentos agrícolas, ${hechos.size} ya bajados, faltan ${cola.length}`);

  let listos = 0;
  const errores: number[] = [];
  await Promise.all(Array.from({ length: EN_PARALELO }, async () => {
    for (let d = cola.shift(); d; d = cola.shift()) {
      try {
        await bajar(d);
        console.log(`[${++listos}] ${d.id} ${d.nombre}: ok`);
      } catch (error) {
        errores.push(d.id);
        console.log(`[${++listos}] ${d.id} ${d.nombre}: ERROR ${error instanceof Error ? error.message : error}`);
      }
    }
  }));
  console.log(errores.length ? `Terminado con ${errores.length} errores (volver a correr para reintentar): ${errores.join(" ")}` : "Terminado sin errores");
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
