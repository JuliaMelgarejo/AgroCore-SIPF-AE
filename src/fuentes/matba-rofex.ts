import fs from "node:fs/promises";
import axios from "axios";

// Futuros de granos de Matba Rofex a través de la API de Primary
// (la misma que usan las librerías oficiales pyRofex / jsRofex).
//
// Flujo:
//   1. POST auth/getToken con X-Username / X-Password → header X-Auth-Token
//   2. GET rest/instruments/all → se quedan los futuros de granos de Rosario
//      (SOJ.ROS/MAY27, MAI.ROS/ABR27, TRI.ROS/ENE27, ...), sin opciones
//   3. GET rest/data/getTrades por cada futuro → operaciones del período
//   4. Se resume a un cierre diario (precio de la última operación del día
//      y volumen) en data/raw/matba-rofex-futuros.csv, que la base carga en
//      precio_grano desde docker/postgres/init/06_carga_matba_rofex.sql
//
// Las credenciales NO van en el código: se leen del .env (ignorado por git).
//   ROFEX_USER=...
//   ROFEX_PASSWORD=...
//   ROFEX_API_URL=https://api.primary.com.ar/   (opcional; para pruebas: https://api.remarkets.primary.com.ar/)
//
// Uso: pnpm fuentes:rofex [días hacia atrás, por defecto 365]

const API_URL = process.env.ROFEX_API_URL ?? "https://api.primary.com.ar/";
const MARKET_ID = "ROFX";
const DESTINO = "data/raw/matba-rofex-futuros.csv";

// Prefijo del símbolo → especie (nombre en la tabla especie)
const ESPECIES: Record<string, string> = {
  SOJ: "SOJA",
  MAI: "MAIZ",
  TRI: "TRIGO PAN",
  GIR: "GIRASOL",
  SOR: "SORGO",
};
// Futuro de Rosario sin strike (las opciones traen " 350 C" / " 350 P" al final)
const FUTURO_GRANO = /^(SOJ|MAI|TRI|GIR|SOR)\.ROS\/([A-Z]{3}\d{2})$/;

type Instrumento = { instrumentId: { marketId: string; symbol: string } };
type Trade = { price: number; size: number; datetime: string };

async function obtenerToken(usuario: string, clave: string): Promise<string> {
  const response = await axios.post(new URL("auth/getToken", API_URL).toString(), null, {
    headers: { "X-Username": usuario, "X-Password": clave },
    timeout: 30_000,
  });
  const token = response.headers["x-auth-token"];
  if (!token) throw new Error("La API no devolvió X-Auth-Token (¿la cuenta tiene habilitado el acceso por API?)");
  return token;
}

function fechaIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const usuario = process.env.ROFEX_USER;
  const clave = process.env.ROFEX_PASSWORD;
  if (!usuario || !clave) {
    throw new Error("Faltan ROFEX_USER / ROFEX_PASSWORD en el .env");
  }
  const dias = Number(process.argv[2] ?? 365);

  const token = await obtenerToken(usuario, clave);
  const api = axios.create({ baseURL: API_URL, headers: { "X-Auth-Token": token }, timeout: 60_000 });

  const { data: instrumentos } = await api.get<{ instruments: Instrumento[] }>("rest/instruments/all");
  const futuros = instrumentos.instruments
    .map((i) => i.instrumentId)
    .filter((i) => i.marketId === MARKET_ID && FUTURO_GRANO.test(i.symbol))
    .map((i) => i.symbol);
  console.log(`${futuros.length} futuros de granos encontrados`);

  const hasta = new Date();
  const desde = new Date(hasta.getTime() - dias * 86_400_000);
  const filas = ["fecha,especie,posicion,simbolo,precio_cierre,volumen"];

  for (const simbolo of futuros) {
    const [, prefijo, posicion] = simbolo.match(FUTURO_GRANO)!;
    const { data } = await api.get<{ status: string; trades?: Trade[] }>("rest/data/getTrades", {
      params: { marketId: MARKET_ID, symbol: simbolo, dateFrom: fechaIso(desde), dateTo: fechaIso(hasta) },
    });
    const trades = data.trades ?? [];

    // Cierre diario = precio de la última operación del día; volumen = suma de contratos
    const porDia = new Map<string, { ultimo: Trade; volumen: number }>();
    for (const t of trades) {
      const dia = t.datetime.slice(0, 10);
      const actual = porDia.get(dia);
      if (!actual) porDia.set(dia, { ultimo: t, volumen: t.size });
      else {
        actual.volumen += t.size;
        if (t.datetime > actual.ultimo.datetime) actual.ultimo = t;
      }
    }
    for (const [dia, { ultimo, volumen }] of [...porDia].sort()) {
      filas.push([dia, ESPECIES[prefijo], posicion, simbolo, ultimo.price, volumen].join(","));
    }
    console.log(`- ${simbolo}: ${trades.length} operaciones, ${porDia.size} días`);
  }

  await fs.mkdir("data/raw", { recursive: true });
  await fs.writeFile(DESTINO, filas.join("\n") + "\n", "utf-8");
  console.log(`\n${filas.length - 1} cierres diarios → ${DESTINO} (recargar la base con pnpm db:reset)`);
}

main().catch((error: unknown) => {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  console.error("Error con la API de Matba Rofex:", status ? `HTTP ${status}` : error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
