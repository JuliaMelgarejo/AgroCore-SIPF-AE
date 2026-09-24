import fs from "node:fs/promises";
import { httpClient } from "../lib/http.js";
import { esperar } from "./departamentos-agricolas.js";

// Futuros de granos de Matba Rofex desde la plataforma pública "Matriz"
// (matbarofex.primary.ventures), la misma que se ve en el navegador.
//
// No hace falta cuenta: en modo invitado la plataforma expone la serie
// diaria (apertura, máximo, mínimo, cierre, volumen) de cada contrato en
// /api/v2/series/securities/{id}. Es la API interna del sitio (no una API
// documentada), así que puede cambiar sin aviso.
//
// La API de trading de Primary (api.primary.com.ar) exige una cuenta con
// acceso por API habilitado; un usuario de la plataforma web no sirve ahí
// (devuelve 401), por eso no se usa.
//
// Los contratos se identifican como rx_DDA_{GRANO}_ROS_{MES}{AA}
// (ej. rx_DDA_SOJ_ROS_MAY27 = soja Rosario mayo 2027). Los vencidos siguen
// respondiendo, así que se prueban todos los meses desde 2018: hay datos
// desde 2019, cuando se fusionaron Matba y Rofex. Los que no existen
// vuelven vacíos y se saltean.
//
// Salida: data/raw/matba-rofex-futuros.csv (cierre diario en USD/tn), que la
// base carga en precio_grano desde docker/postgres/init/06_carga_matba_rofex.sql.
//
// Uso: pnpm fuentes:rofex

const BASE = "https://matbarofex.primary.ventures";
const DESTINO = "data/raw/matba-rofex-futuros.csv";
const DESDE_ANIO = 2018;

// Prefijo del contrato → especie (nombre en la tabla especie)
const GRANOS: Record<string, string> = {
  SOJ: "SOJA",
  MAI: "MAIZ",
  TRI: "TRIGO PAN",
  GIR: "GIRASOL",
  SOR: "SORGO",
};
const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

type Vela = { d: string; o: number; h: number; l: number; c: number; v: number };

async function serieDiaria(id: string, hasta: string): Promise<Vela[]> {
  for (let intento = 1; ; intento++) {
    try {
      const { data } = await httpClient.get<{ series?: Vela[] }>(`${BASE}/api/v2/series/securities/${id}`, {
        params: { resolution: "D", from: `${DESDE_ANIO}-01-01T00:00:00.000Z`, to: hasta },
        timeout: 60_000,
      });
      return data.series ?? [];
    } catch (error) {
      if (intento >= 3) throw error;
      await esperar(5_000 * intento);
    }
  }
}

async function main() {
  const hoy = new Date();
  const hasta = hoy.toISOString();
  const ultimoAnio = hoy.getFullYear() + 2; // se negocian posiciones hasta ~2 años adelante

  const filas = ["fecha,especie,posicion,simbolo,precio_cierre,volumen"];
  for (const [grano, especie] of Object.entries(GRANOS)) {
    let contratos = 0;
    let dias = 0;
    for (let anio = DESDE_ANIO; anio <= ultimoAnio; anio++) {
      for (const mes of MESES) {
        const posicion = `${mes}${String(anio).slice(2)}`;
        const id = `rx_DDA_${grano}_ROS_${posicion}`;
        const velas = await serieDiaria(id, hasta);
        await esperar(200);
        if (!velas.length) continue;
        contratos++;
        for (const v of velas) {
          filas.push([v.d.slice(0, 10), especie, posicion, `${grano}.ROS/${posicion}`, v.c, v.v].join(","));
          dias++;
        }
      }
    }
    console.log(`- ${especie}: ${contratos} contratos, ${dias} cierres diarios`);
  }

  await fs.mkdir("data/raw", { recursive: true });
  await fs.writeFile(DESTINO, filas.join("\n") + "\n", "utf-8");
  console.log(`\n${filas.length - 1} cierres → ${DESTINO} (recargar la base con pnpm db:reset)`);
}

main().catch((error: unknown) => {
  console.error("Error con Matba Rofex:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
