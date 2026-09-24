import fs from "node:fs/promises";
import axios from "axios";
import ExcelJS from "exceljs";
import { httpClient } from "../lib/http.js";
import { esperar } from "./departamentos-agricolas.js";

// Precios y tipo de cambio históricos:
//
// 1. BCR — precios pizarra de la Cámara Arbitral de Cereales de Rosario
//    (ARS/tn, un precio por día hábil). La página de consultas
//    (cac.bcr.com.ar/es/precios-de-pizarra/consultas) tiene un export a Excel
//    en /es/api/prices/987/export con los mismos filtros. Pedido por más de
//    un año devuelve error 500, así que se baja año por año.
//    → data/raw/bcr-pizarra.csv
//
// 2. BCRA — tipo de cambio oficial (API de Estadísticas Cambiarias,
//    máximo 1.000 filas por consulta → año por año desde 2002; antes regía
//    la convertibilidad 1 ARS = 1 USD).
//    → data/raw/bcra-tipo-cambio.csv
//
// La base los carga desde docker/postgres/init/08_carga_economia_enso.sql.

const BCR_EXPORT = "https://www.cac.bcr.com.ar/es/api/prices/987/export";
// id de producto en el filtro de BCR → nombre en la tabla especie
const BCR_PRODUCTOS: Record<number, string> = { 13: "SOJA", 3: "MAIZ", 8: "TRIGO PAN", 9: "GIRASOL", 6: "SORGO" };
const BCR_DESDE = 1988;

const BCRA_API = "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD";
const BCRA_DESDE = 2002;

async function preciosBcr(hasta: number) {
  const filas = ["fecha,especie,precio_ars_tn"];
  for (const [producto, especie] of Object.entries(BCR_PRODUCTOS)) {
    let total = 0;
    for (let anio = BCR_DESDE; anio <= hasta; anio++) {
      const params = { product: producto, type: "pizarra", date_start: `${anio}-01-01`, date_end: finDeAnio(anio), period: "day" };
      let buffer: ArrayBuffer | null = null;
      for (let intento = 1; intento <= 3 && !buffer; intento++) {
        try {
          buffer = (await httpClient.get<ArrayBuffer>(BCR_EXPORT, { params, responseType: "arraybuffer", timeout: 120_000 })).data;
        } catch {
          await esperar(5_000 * intento);
        }
      }
      if (!buffer) {
        console.log(`  ${especie} ${anio}: sin respuesta, se saltea`);
        continue;
      }
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(buffer);
      // Encabezado de 5 filas ('Consulta de precios', producto, 'Fecha de operación | Precio'); después fecha + precio
      libro.worksheets[0].eachRow((fila) => {
        const [fecha, precio] = [fila.getCell(1).value, fila.getCell(2).value];
        if (fecha instanceof Date && typeof precio === "number") {
          // BCR guarda la fecha como medianoche de Argentina (03:00 UTC): la parte de fecha es la correcta
          filas.push(`${fecha.toISOString().slice(0, 10)},${especie},${precio}`);
          total++;
        }
      });
      await esperar(300);
    }
    console.log(`- BCR ${especie}: ${total} días`);
  }
  await fs.writeFile("data/raw/bcr-pizarra.csv", filas.join("\n") + "\n", "utf-8");
}

type RespuestaBcra = { results: { fecha: string; detalle: { tipoCotizacion: number }[] }[] };

// El BCRA rechaza fechas futuras: el año en curso se pide solo hasta hoy
const finDeAnio = (anio: number) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const fin = `${anio}-12-31`;
  return fin > hoy ? hoy : fin;
};

async function tipoCambioBcra(hasta: number) {
  const filas = ["fecha,valor_ars_usd"];
  for (let anio = BCRA_DESDE; anio <= hasta; anio++) {
    const { data } = await axios.get<RespuestaBcra>(BCRA_API, {
      params: { fechadesde: `${anio}-01-01`, fechahasta: finDeAnio(anio), limit: 1000 },
      timeout: 60_000,
    });
    for (const r of data.results) {
      const valor = r.detalle[0]?.tipoCotizacion;
      if (valor) filas.push(`${r.fecha},${valor}`);
    }
    await esperar(300);
  }
  await fs.writeFile("data/raw/bcra-tipo-cambio.csv", filas.join("\n") + "\n", "utf-8");
  console.log(`- BCRA: ${filas.length - 1} días de tipo de cambio`);
}

async function main() {
  const hasta = new Date().getFullYear();
  await fs.mkdir("data/raw", { recursive: true });
  await tipoCambioBcra(hasta);
  await preciosBcr(hasta);
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
