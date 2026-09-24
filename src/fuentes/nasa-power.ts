import fs from "node:fs/promises";
import axios from "axios";
import { celda05, departamentosAgricolas, esperar } from "./departamentos-agricolas.js";

// Clima diario de NASA POWER (comunidad AG) para cada celda de 0,5° que
// contiene un departamento agrícola, desde 1981 hasta hoy.
//
// Un CSV por celda en data/raw/nasa-power/ (así se puede cortar y retomar:
// las celdas ya bajadas se saltean). La base lo carga en celda_clima y
// clima_diario desde docker/postgres/init/07_carga_clima_suelo.sql.
//
// POWER no publica ET0, así que se calcula con Hargreaves-Samani
// (FAO-56, ec. 52), que solo necesita temperaturas y latitud.

const URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
const PARAMETROS = ["T2M_MAX", "T2M_MIN", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN", "RH2M", "WS2M"];
const DESDE = "19810101";
const DIR = "data/raw/nasa-power";
const CONCURRENCIA = 3;
const SIN_DATO = -999;

// Radiación extraterrestre Ra (MJ/m²/día), FAO-56 ec. 21
function radiacionExtraterrestre(latGrados: number, diaJuliano: number) {
  const phi = (latGrados * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos(((2 * Math.PI) / 365) * diaJuliano);
  const delta = 0.409 * Math.sin(((2 * Math.PI) / 365) * diaJuliano - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta))));
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}

// ET0 Hargreaves (mm/día): 0,0023 · (Tmedia + 17,8) · √(Tmax − Tmin) · Ra/λ, con 1/λ = 0,408
function et0Hargreaves(tmax: number, tmin: number, lat: number, fecha: Date) {
  const inicio = Date.UTC(fecha.getUTCFullYear(), 0, 0);
  const dia = Math.floor((fecha.getTime() - inicio) / 86_400_000);
  const ra = radiacionExtraterrestre(lat, dia);
  return 0.0023 * ((tmax + tmin) / 2 + 17.8) * Math.sqrt(Math.max(tmax - tmin, 0)) * ra * 0.408;
}

type Respuesta = { properties: { parameter: Record<string, Record<string, number>> } };

async function bajarCelda(lat: number, lon: number, hasta: string) {
  const archivo = `${DIR}/celda_${lat}_${lon}.csv`;
  try {
    await fs.access(archivo);
    return "ya estaba";
  } catch {}

  for (let intento = 1; ; intento++) {
    try {
      const { data } = await axios.get<Respuesta>(URL, {
        params: { parameters: PARAMETROS.join(","), community: "AG", latitude: lat, longitude: lon, start: DESDE, end: hasta, format: "JSON" },
        timeout: 180_000,
      });
      const p = data.properties.parameter;
      const v = (param: string, dia: string) => {
        const x = p[param]?.[dia];
        return x === undefined || x === SIN_DATO ? "" : String(x);
      };
      const filas = ["lat,lon,fecha,t_max_c,t_min_c,precipitacion_mm,radiacion_mj_m2,humedad_relativa_pct,viento_m_s,et0_mm"];
      for (const dia of Object.keys(p.T2M_MAX)) {
        const fecha = new Date(`${dia.slice(0, 4)}-${dia.slice(4, 6)}-${dia.slice(6, 8)}T00:00:00Z`);
        const tmax = p.T2M_MAX[dia];
        const tmin = p.T2M_MIN[dia];
        const et0 = tmax !== SIN_DATO && tmin !== SIN_DATO ? et0Hargreaves(tmax, tmin, lat, fecha).toFixed(2) : "";
        filas.push([lat, lon, fecha.toISOString().slice(0, 10), v("T2M_MAX", dia), v("T2M_MIN", dia), v("PRECTOTCORR", dia),
          v("ALLSKY_SFC_SW_DWN", dia), v("RH2M", dia), v("WS2M", dia), et0].join(","));
      }
      // Se escribe a un temporal y se renombra: un corte a mitad no deja un CSV incompleto
      await fs.writeFile(`${archivo}.tmp`, filas.join("\n") + "\n", "utf-8");
      await fs.rename(`${archivo}.tmp`, archivo);
      return `${filas.length - 1} días`;
    } catch (error) {
      if (intento >= 5) throw error;
      await esperar(10_000 * intento);
    }
  }
}

async function main() {
  await fs.mkdir(DIR, { recursive: true });
  const deptos = await departamentosAgricolas();
  const celdas = [...new Map(deptos.map((d) => {
    const c = celda05(d.lat, d.lon);
    return [`${c.lat}_${c.lon}`, c] as const;
  })).values()];
  const hasta = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  console.log(`${deptos.length} departamentos agrícolas → ${celdas.length} celdas de 0,5°`);

  let hechas = 0;
  const cola = [...celdas];
  const errores: string[] = [];
  await Promise.all(Array.from({ length: CONCURRENCIA }, async () => {
    for (let c = cola.shift(); c; c = cola.shift()) {
      try {
        const r = await bajarCelda(c.lat, c.lon, hasta);
        console.log(`[${++hechas}/${celdas.length}] ${c.lat},${c.lon}: ${r}`);
      } catch (error) {
        errores.push(`${c.lat},${c.lon}`);
        console.log(`[${++hechas}/${celdas.length}] ${c.lat},${c.lon}: ERROR ${error instanceof Error ? error.message : error}`);
      }
    }
  }));
  console.log(errores.length ? `Terminado con ${errores.length} errores (volver a correr para reintentar): ${errores.join(" ")}` : "Terminado sin errores");
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
